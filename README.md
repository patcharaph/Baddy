# Baddy

จัดก๊วนแบดมินตันให้จบใน LINE — เปิดรอบ จัดคิว หารเงิน ไม่ต้องโหลดแอป ไม่ต้องสมัครเว็บ

Requirements และที่มาของทุกการตัดสินใจอยู่ใน [`docs/`](./docs):
[PRD](./docs/line-guan-badminton-prd.md) ·
[User stories](./docs/line-guan-badminton-user-stories.md) ·
[Technical requirements & ADR](./docs/line-guan-badminton-technical-req.md) ·
[Marketing plan](./docs/line-guan-badminton-marketing-plan.md) ·
[UI mockup](./docs/line-guan-badminton-ui-mockup.html)

---

## เริ่มใช้งาน

```bash
npm install
npm run dev          # http://localhost:3000 → /queue
```

รันได้เลยโดยไม่ต้องตั้งค่าอะไร — ถ้ายังไม่มี env จะใช้ข้อมูลตัวอย่างใน
`src/lib/sample/session.ts` ซึ่งไหลผ่าน queue engine และ cost engine ตัวจริง
(ไม่ใช่ตัวเลขที่ hardcode ไว้)

| คำสั่ง | ทำอะไร |
|--------|--------|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm test` | unit tests ของ engine |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |

### เชื่อม Supabase

```bash
cp .env.example .env.local     # แล้วกรอก URL + anon key + service role key
npm run db:push                # apply supabase/migrations/0001_init.sql
npm run db:seed                # ใส่รอบเล่นตัวอย่างลง DB จริง
```

ระหว่างที่ยังไม่ได้ทำ auth ให้ใส่ `DEV_BYPASS_RLS=1` ใน `.env.local` ด้วย —
ไม่งั้น RLS จะคืนค่าว่าง เพราะยังไม่มีผู้ใช้ให้ policy รู้จัก ตัวนี้อ่านด้วย service
role และ **ถูกบล็อกไม่ให้ทำงานใน production build**

เมื่อมี project จริงแล้ว ให้ generate types แทนการแก้มือ:

```bash
npm run db:types
```

---

## โครงสร้าง

```
src/
  app/
    (tabs)/            3 แท็บตาม mockup — queue / money / profile
  components/          UI ตาม design token ของ mockup
  lib/
    domain/            ★ queue engine + cost engine (pure TS, มีเทสต์)
    data/              ★ mappers (มีเทสต์) + queries + mutations + realtime
    supabase/          browser / server / admin client + types
    liff/              LIFF provider
    sample/            ข้อมูลตัวอย่าง รูปร่างเดียวกับที่ query คืนมา
scripts/seed.ts        ใส่ข้อมูลตัวอย่างลง Supabase จริง
supabase/
  migrations/          schema + RLS + realtime
docs/                  requirement ต้นทาง
```

### ข้อมูลไหลยังไง

```
Supabase rows ──► data/mappers ──► domain engines ──► หน้าจอ
     หรือ                            (คิว/ยอดเงิน)
lib/sample ────────┘
```

`data/source.ts` เป็นตัวเลือกแหล่งข้อมูล คืนได้ 3 สถานะ — `live` (มี session จริง),
`empty` (ต่อ Supabase แล้วแต่ยังไม่มีรอบเปิด), `sample` (ยังไม่ได้ตั้ง env)
หน้าจอเห็นเป็น `BoardView` เหมือนกันหมด ไม่รู้ว่าข้อมูลมาจากไหน

**mappers อยู่แยกจาก queries เพราะทดสอบได้** — "ใครนับว่ารอคิวอยู่", "เล่นไปกี่เกม",
"คอร์ทไหนว่าง" เป็น logic ที่พังได้ง่ายสุด จึงเขียนเป็น pure function แล้วเทสต์
โดยไม่ต้องมี DB (ปัจจุบัน 80 เทสต์รวมทั้ง engine และ mapper)

### Auth: LINE → Supabase

Supabase **ไม่มี LINE provider** และไม่มีตัวเลือก OIDC ทั่วไป — third-party auth
รองรับแค่ Clerk / Firebase / Auth0 / Cognito / WorkOS สะพานจึงต้องสร้างเอง:

```
LIFF id token ──► POST /api/auth/line
                    │  ตรวจกับ api.line.me/oauth2/v2.1/verify
                    │  หา/สร้าง auth user (magic link)
                    │  verifyOtp ฝั่ง server → เซ็ต cookie
                    ▼
                  players.auth_user_id ──► RLS มองเห็นว่าใครเรียก
```

**ทำไมไม่ sign JWT เองด้วย project secret** — สั้นกว่าก็จริง แต่ได้ token ที่ไม่มี
refresh path และข้าม auth server ไปเลย เส้นทาง `generateLink` → `verifyOtp` ให้
session ปกติที่ refresh และ revoke ได้เหมือน session อื่น

**client ส่งมาแค่ id token** ตัวตนทั้งหมดมาจากคำตอบของ LINE — ถ้ารับ userId จาก
client ตรง ๆ ใครก็สวมรอยเป็นใครก็ได้ และ token ถูก redeem ฝั่ง server เพื่อให้
access/refresh token ลง httpOnly cookie โดยไม่ผ่านเบราว์เซอร์

โปรไฟล์ผูกด้วย `line_user_id` ไม่ใช่ auth user — คนที่ถูกเพิ่มเข้าก๊วนก่อนเคยเปิดแอป
มี row อยู่แล้ว การ sign-in ครั้งแรกจะ claim row เดิม ไม่สร้างซ้ำจนประวัติหาย (ADR-2)

### Realtime

`useRealtimeBoard` ไม่เอา payload จาก realtime มาแปะหน้าจอตรง ๆ แต่ใช้เป็นสัญญาณ
ให้ `router.refresh()` ไปอ่านใหม่ผ่านทางเดิม — ถ้าเอา payload มาใช้ตรง ๆ จะต้อง
maintain กติกาคิวซ้ำอีกชุดฝั่ง client และถ้ามี event หลุดกระดานจะเพี้ยนเงียบ ๆ

มี fallback poll (60 วิ ตอนต่อติด / 10 วิ ตอนหลุด) และ re-fetch เมื่อ webview
กลับมา foreground เพราะ socket ใน LINE ตายทุกครั้งที่แอปถูกพับลง

### ทำไม engine ถึงเป็น pure function

`src/lib/domain/` ไม่รู้จัก Supabase และไม่รู้จัก React เลย รับ plain object ออกมาเป็น
plain object — กติกาความยุติธรรมของคิวและสูตรหารเงินจึงเทสต์ได้ตรง ๆ และเถียงกันได้
โดยไม่ต้องเปิดฐานข้อมูล ตอนนี้มีเทสต์ 57 เคสครอบทั้งสองตัว

**Queue engine** (`queue-engine.ts`) — เรียงคิวตามเวลารอ แล้วตามจำนวนเกมที่เล่นไป
จัด 4 คนลงคอร์ทที่ว่าง และรองรับให้หัวหน้าสลับ/เปลี่ยนตัวเองก่อนเริ่ม

**Cost engine** (`cost-engine.ts`) — 3 โหมดตาม FR-7 (บุฟเฟ่ต์ / รายเกม / หารเท่ากัน)
ทุกยอดมีประโยคอธิบายที่มาติดมาด้วย เพราะความโปร่งใสเป็น requirement ไม่ใช่ของแถม
และผลรวมของยอดรายคนเท่ากับยอดรวมรอบเสมอ (`splitEvenly` กระจายเศษบาทให้ครบ)

---

## สิ่งที่ยังไม่ได้ทำ (ตั้งใจ)

- LINE webhook, push notification (waitlist เลื่อน / สรุปยอด)
- การสร้าง QR พร้อมเพย์จริง — ตอนนี้เป็น placeholder โดยตั้งใจ
- Flow สร้างก๊วน / เข้าร่วมด้วยลิงก์เชิญ / RSVP / เช็คอิน (FR-1 ถึง FR-3)
- waitlist auto-promote (US-2.4) — schema รองรับแล้วแต่ยังไม่มี logic

---

## คำถามค้างที่ต้องเคลียร์

จาก PRD §11 และ technical-req §10 — ยังไม่ตัดสินใจ และมีผลกับโค้ดที่เขียนไปแล้ว:

| เรื่อง | สถานะตอนนี้ในโค้ด |
|--------|-------------------|
| สเกลระดับฝีมือ | `SKILL_LEVELS` ใช้ชุดจาก mockup (N/S/P-/P/P+/C/B) — ยังไม่ยืนยัน |
| ราคาลูกเกินโหมดรายเกม | เอกสารกำกวม ดูหัวข้อถัดไป |
| ราคา/เส้นแบ่ง freemium | ยังไม่มีในโค้ด |
| PDPA + การเก็บ `promptpay_target` | เก็บเป็น text ธรรมดา ยังไม่มี policy |
| นโยบายกรอกลูกย้อนหลัง | `shuttle_logs.logged_at` เขียนทับได้ ยังไม่มีกติกา |

### ลูกเกินในโหมดรายเกม — ตีความต่างกันได้ 2 แบบ

PRD บอก *"ลูกที่เกินหารใน 4 คนของแมตช์"* แต่ไม่ได้บอกว่าคิดที่ราคาไหน

- **โค้ดตอนนี้** คิดที่ราคาลูกจริง (`shuttle_logs.unit_price`) หารใน 4 คนของแมตช์นั้น
  — ตรงตามตัวอักษรของ technical-req §5 และใช้ฟิลด์ที่ schema มีอยู่
- **mockup** คิดที่ `จำนวนลูกเกิน × เรตต่อเกม` ต่อคน — ซึ่งให้ผลเท่ากันพอดีเมื่อ
  ราคาลูก = 4 × เรตต่อเกม (เช่น ลูก ฿100 กับเรต ฿25)

ในข้อมูลตัวอย่างใช้ลูก ฿60 กับเรต ฿25 สองสูตรนี้จึงให้ตัวเลขไม่เท่ากัน
ถ้าก๊วนจริงคิดแบบ mockup ให้แก้ที่ `extraShuttleCharges()` ใน `cost-engine.ts`

### เอกสารที่ขัดกันเอง

โหมด *"หารตามเวลาที่อยู่จริง (นาที)"* ถูกตัดออกจาก MVP แล้ว (PRD FR-7, tech §5)
แต่ยังค้างอยู่ 3 จุด — ควรแก้ให้ตรงกันก่อนใช้เอกสารเป็น spec

- `technical-req.md` §1 — architecture overview ยังเขียนว่า cost engine หารตามนาที
- `marketing-plan.md` §4 — สารหลักข้อ 2 ยังขายว่า "จ่ายตามเวลาที่อยู่จริง"
- `user-stories.md` US-2.5 — เช็คเอาท์อ้าง FR-7 ว่าไม่ถูกคิดช่วงที่ไม่อยู่

โค้ดยึดตาม 3 โหมดที่ตัดสินใจแล้ว ไม่ได้ทำโหมดตามนาที

---

## หมายเหตุ

- `AGENTS.md` ถูกเขียนโดย `next dev` เอง — commit ไปพร้อมงานได้เลย ไม่ต้องลบ
- npm cache ของโปรเจกต์นี้ชี้ไปที่ `D:/npm-cache` เพราะไดรฟ์ C: เต็ม
  ถ้าย้ายเครื่องให้ลบ `--cache` flag ออกได้
