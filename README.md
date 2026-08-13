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

### ตั้งค่า LINE + Supabase

```bash
cp .env.example .env.local
```

แล้วกรอกค่าตาม comment ในไฟล์ จากนั้นรัน migration:

```bash
npx supabase db push        # หรือ paste supabase/migrations/0001_init.sql ใน SQL editor
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
    supabase/          browser / server / admin client + types
    liff/              LIFF provider
    sample/            ข้อมูลตัวอย่างสำหรับรันโดยไม่มี backend
supabase/
  migrations/          schema + RLS + realtime
docs/                  requirement ต้นทาง
```

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

Scaffold นี้จบที่ schema + engine + หน้าจอ ยังไม่มี:

- การเชื่อม UI เข้ากับ Supabase จริง (ตอนนี้อ่านจาก `sample/`)
- Realtime subscription ของกระดานคิว — schema เปิด publication ไว้แล้ว
- LINE webhook, push notification (waitlist เลื่อน / สรุปยอด)
- การสร้าง QR พร้อมเพย์จริง — ตอนนี้เป็น placeholder โดยตั้งใจ
- Flow สร้างก๊วน / เข้าร่วมด้วยลิงก์เชิญ / RSVP / เช็คอิน (FR-1 ถึง FR-3)

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
