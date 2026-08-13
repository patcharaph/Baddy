# Technical Requirements & ADR — Badminton ก๊วน SaaS (ข้อกำหนดทางเทคนิค — ระบบจัดก๊วนแบด)

## Document Info (ข้อมูลเอกสาร)

| Field | Value |
|-------|-------|
| Project | line-guan-badminton |
| Version | 0.1 (Draft) |
| Scope | MVP (multi-tenant, LINE-native), data model เผื่อโตไป B |
| Related | line-guan-badminton-prd.md, -user-stories.md |
| Last Validation Date | 2026-08-13 |

---

## 1. Architecture Overview (ภาพรวมสถาปัตยกรรม)

ทุกอย่างอยู่บน LINE ผ่าน LIFF โดย backend อยู่บน Supabase และหัวใจคือ **real-time queue** และ **cost engine ที่หารตามเวลาที่อยู่จริง**

```
+------------------+       +----------------------+       +--------------------------+
|  LINE App        |       |  LIFF App (Next.js)  |       |  Supabase (Backend)      |
|  - Rich Menu     | ----> |  - หัวหน้า: จัดคิว/ลูก/เงิน| ----> |  - PostgreSQL            |
|  - Push          |       |  - ผู้เล่น: คิว/ยอดจ่าย   |       |  - Auth (LINE Login)     |
|                  | <---- |  - Live Queue Board    | <---- |  - Realtime (queue board)|
+------------------+       +----------------------+       |  - Edge Functions        |
                                                          |  - RLS (แยกสิทธิ์ก๊วน)     |
                                                          +--------------------------+
```

Cost flow (แนวคิด): เวลาเช็คอิน-ออกของผู้เล่น + shuttle logs (มี timestamp) → cost engine คำนวณส่วนแบ่งค่าคอร์ท (ตามนาทีที่อยู่) และค่าลูก (ตามช่วงที่เปิดลูก) → ยอดต่อคน → settle-up

---

## 2. Tech Stack & Rationale (เทคโนโลยีและเหตุผล)

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js + TypeScript + Tailwind + LIFF SDK | อยู่ใน LINE, mobile-first, หา dev ง่าย |
| Hosting | Vercel | deploy ง่าย, free tier พอสำหรับช่วงเริ่ม |
| Backend + DB | Supabase (PostgreSQL) | relational เหมาะกับ cost engine + หลายก๊วน (multi-tenant) |
| Realtime | Supabase Realtime | กระดานคิวอัปเดตสดทุกเครื่อง |
| Auth | Supabase Auth + LINE Login | ไม่ต้องสมัครเว็บ ผูกกับ LINE userId |
| Access control | Row Level Security (RLS) | แยกข้อมูลรายก๊วน กันข้ามก๊วน |
| Serverless | Supabase Edge Functions | รับ LINE webhook, คำนวณ cost, จัดคิว |
| Payment display | PromptPay QR (generate) | แสดง QR ให้โอน (ไม่ตัดเงินจริงในระบบ) |
| Notifications | LINE push | แจ้ง waitlist เลื่อน, สรุปยอด |

⚠️ NEEDS VALIDATION: ตรวจเวอร์ชัน stable ล่าสุดของ Next.js, LIFF SDK, Supabase client ก่อนเริ่มโค้ด
⚠️ NEEDS VALIDATION: วิธี generate PromptPay QR (มาตรฐาน EMVCo/PromptPay) และ LINE Login/LIFF token verification ตามเอกสารล่าสุด

---

## 3. Data Model (โครงสร้างข้อมูล)

ออกแบบให้ **โปรไฟล์ผู้เล่นเป็น entity อิสระ** (portable) แยกจากการเป็นสมาชิกก๊วน — เพื่อโตไป B (network)

**players** (โปรไฟล์พกพา, B-seed)
- `id` (PK), `line_user_id` (unique), `display_name`, `skill_level`, `created_at`

**guans** (ก๊วน = tenant)
- `id` (PK), `name`, `home_venue`, `default_court_rate`, `promptpay_target`, `owner_player_id` (FK)

**memberships** (ผู้เล่น ↔ ก๊วน)
- `id` (PK), `guan_id` (FK), `player_id` (FK), `role` (`organizer` | `player`), `joined_at`

**sessions** (รอบเล่น)
- `id` (PK), `guan_id` (FK), `date`, `starts_at`, `ends_at`, `court_count`, `court_rate`, `capacity`, `split_mode` (`buffet` | `per_game` | `even`), `buffet_rate` (nullable), `women_rate` (nullable), `per_game_rate` (nullable)

**session_participants** (ใครอยู่รอบไหน + เวลาที่อยู่)
- `id` (PK), `session_id` (FK), `player_id` (FK), `status` (`rsvp` | `checked_in` | `waitlist` | `checked_out` | `cancelled`), `check_in_at`, `check_out_at`

**matches** (แมตช์/คิว)
- `id` (PK), `session_id` (FK), `court_no`, `status` (`queued` | `playing` | `done`), `started_at`, `ended_at`
- **match_players**: `match_id` (FK), `player_id` (FK)

**shuttle_logs** (บันทึกลูก + เวลา)
- `id` (PK), `session_id` (FK), `match_id` (FK, nullable — ผูกลูกกับแมตช์สำหรับกฎลูกเกินรายเกม), `court_no` (nullable), `count`, `unit_price`, `logged_at`

**cost_shares** (ผลการหารต่อคน — คำนวณจาก participants + shuttle_logs)
- `id` (PK), `session_id` (FK), `player_id` (FK), `court_share`, `shuttle_share`, `total`, `paid` (boolean)

⚠️ ASSUMPTION: cost_shares คำนวณสด/สร้างตอนปิดรอบ ไม่เก็บซ้ำแบบขัดแย้งกับ source data

---

## 4. Queue Engine (เครื่องยนต์จัดคิว)

- Input: ผู้เล่นสถานะ `checked_in` ที่ว่าง (ไม่ได้อยู่ในแมตช์ `playing`)
- Fairness: จัดลำดับด้วย (1) เวลารอตั้งแต่จบเกมล่าสุด (มากได้ก่อน) และ (2) จำนวนเกมที่เล่นไป (น้อยได้ก่อน)
- เมื่อคอร์ทว่าง: หยิบผู้เล่น 4 คนตามลำดับความยุติธรรม สร้าง match ใหม่ (`queued` → `playing`)
- Manual override: หัวหน้าสลับ/ล็อกผู้เล่นในแมตช์ได้ ก่อนเปลี่ยนเป็น `playing`
- ⚠️ ASSUMPTION: MVP รองรับคู่ (doubles) 4 คน/คอร์ทเป็นค่าเริ่มต้น

---

## 5. Cost Engine (เครื่องยนต์หารเงิน)

รองรับ **3 โหมดที่ก๊วนไทยใช้จริง** (อ้างอิงข้อมูลภาคสนาม) หัวหน้าเลือกต่อรอบผ่าน `split_mode`:

**Mode A — Buffet / เหมาจ่าย** (`split_mode = buffet`) — นิยมสุด
- แต่ละคนจ่าย `buffet_rate` เท่ากัน (รองรับ `women_rate` แยกเพศได้)
- ค่าลูกรวมอยู่ในเรตแล้ว ไม่คิดแยก — ไม่ต้องพึ่งข้อมูลเกม/ลูก
- ง่ายและเร็วสุด เหมาะกับก๊วนบุฟเฟ่ต์สาธารณะ

**Mode B — Per-game / รายเกม** (`split_mode = per_game`)
- ค่าลูกต่อคน = จำนวนเกมที่ลงเล่น × `per_game_rate`
  - จำนวนเกมนับจาก `match_players` ที่ match `status = done` — **queue engine ให้ข้อมูลนี้อยู่แล้ว** (แทบได้มาฟรี)
- กฎลูกเกิน: 1 เกม = โควตา 1 ลูก; ลูกที่เกินในเกมนั้น (`shuttle_logs` ที่ผูก `match_id`) หารเพิ่มเฉพาะ 4 คนในแมตช์นั้น
- ค่าสนาม = `court_rate` ÷ จำนวนผู้เข้าร่วม (หัวหน้าปรับได้)

**Mode C — Equal at end / หารเท่ากันตอนเลิก** (`split_mode = even`)
- ค่าลูกรวม = Σ(`shuttle_logs.count` × `unit_price`); ค่าสนามรวม = `court_rate`
- (ค่าลูกรวม + ค่าสนามรวม) ÷ จำนวนผู้เข้าร่วม เท่ากันทุกคน

**บทบาทของ shuttle real-time (+1):** ใช้กับ Mode B (นับลูกเกินต่อแมตช์) และ Mode C (นับลูกรวม); Mode A ไม่ต้องใช้
**ความโปร่งใส:** ทุกโหมดแสดงที่มาของยอดให้ผู้เล่นตรวจได้ (เช่น รายเกม: ลงกี่เกม + ลูกเกินกี่ลูก)

⚠️ หมายเหตุ: โหมด "หารตามเวลาที่อยู่จริง (นาที)" ถูกตัดออกจาก MVP เพราะข้อมูลภาคสนามชี้ว่าก๊วนจริงไม่ได้หารแบบนี้ — ใช้ 3 โหมดข้างต้นแทน

---

## 6. Security & Privacy (ความปลอดภัย)

- Verify LINE Login/LIFF token ฝั่ง server ก่อนผูก player — กันปลอมตัวตน
- RLS: ข้อมูล session/cost เห็นได้เฉพาะสมาชิกก๊วนนั้น; ยอดเงินรายคนเห็นได้โดยเจ้าตัว + organizer
- ⚠️ NEEDS VALIDATION: PDPA สำหรับข้อมูลผู้เล่น (ชื่อ/สถิติ) และการเก็บ promptpay_target

---

## 7. Debuggability (ทำให้ Debug ง่าย)

- ทุก Edge Function log: input summary (session_id, action), start/end time, success/fail, error+stack ถ้า fail, พร้อม `request_id`
- Error message ต้องเจาะจง เช่น "รอบนี้เต็มแล้ว (โควตา 16 คน) — คุณถูกเพิ่มเข้า waitlist ลำดับที่ 3"
- Cost engine ต้อง log ที่มาของยอดต่อคน (ช่วงเวลา + ลูกที่ผูก) เพื่อไล่ตรวจเมื่อผู้เล่นทักท้วง
- Realtime: มี health check ของ subscription และ fallback refresh เมื่อ realtime หลุด

---

## 8. Deployment & Cost (deploy และค่าใช้จ่าย)

- Environments: `dev` และ `production` แยก Supabase project + LIFF app
- Secrets (LINE channel, keys) เก็บใน env vars ไม่ commit
- ค่าใช้จ่ายช่วงเริ่มคาดว่าอยู่ใน free tier ของ Supabase + Vercel
- ⚠️ NEEDS VALIDATION: โควตา Supabase Realtime และ LINE push ปัจจุบันเมื่อ active หลายก๊วน

---

## 9. Architecture Decision Records (บันทึกการตัดสินใจ)

**ADR-1: LINE-native (LIFF) ไม่มีสมัครเว็บ** — เพื่อลด friction และต่างจากคู่แข่งที่เป็นแพลตฟอร์มเว็บ; แลกกับข้อจำกัดของ LIFF

**ADR-2: player เป็น entity อิสระจาก membership** — วางรากฐาน network (B) ตั้งแต่ MVP; schema ซับซ้อนขึ้นเล็กน้อยแต่ไม่ต้อง migrate ใหญ่ภายหลัง

**ADR-3: หารเงินคำนวณสดจาก source (participants + shuttle_logs)** — โปร่งใส ตรวจสอบได้ ลดข้อมูลขัดแย้ง

**ADR-4: ตัดฟีเจอร์ระดับโปรออก (บัญชี/คูปอง/MMR/คลังลูก)** — รักษาจุดยืน "เบา" ไม่ไล่ตามฟีเจอร์คู่แข่ง; ความเสี่ยงคือถูกมองว่าทำน้อย จึงต้องทำ 3 งานหลักให้ดีจริง

**ADR-5: Supabase แทน Firebase** — relational + realtime + RLS เหมาะกับ cost engine และ multi-tenant

---

## 10. Current Best Practices Validation (ตรวจแนวปฏิบัติปัจจุบัน)

Last validation date: 2026-08-13 — ตรวจก่อน finalize:
- ⚠️ เวอร์ชัน stable: Next.js, LIFF SDK, Supabase client
- ⚠️ มาตรฐาน PromptPay QR generation ปัจจุบัน
- ⚠️ วิธี verify LINE Login/LIFF token ตามเอกสาร LINE ล่าสุด
- ⚠️ แนวทาง Supabase RLS + Realtime สำหรับ multi-tenant
- ⚠️ PDPA สำหรับข้อมูลผู้เล่น
