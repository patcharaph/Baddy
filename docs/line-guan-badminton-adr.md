# Architecture Decision Records (ADR) — Badminton ก๊วน SaaS (บันทึกการตัดสินใจเชิงสถาปัตยกรรม)

## Document Info (ข้อมูลเอกสาร)

| Field | Value |
|-------|-------|
| Project | line-guan-badminton |
| Version | 0.1 (Draft) |
| Related | line-guan-badminton-prd.md, -user-stories.md, -technical-req.md |
| Date | 2026-08-13 |

รูปแบบแต่ละ ADR: **Status / Context (บริบท) / Decision (การตัดสินใจ) / Alternatives (ทางเลือกที่พิจารณา) / Consequences (ผลที่ตามมา)**
Status ที่ใช้: `Accepted` (ยอมรับแล้ว), `Superseded` (ถูกแทนที่)

---

## ADR-1: LINE-native ผ่าน LIFF ไม่มีการสมัครเว็บแยก

**Status:** Accepted

**Context:** กลุ่มเป้าหมายคือก๊วนเล็ก/แคชวลที่อยู่ใน LINE อยู่แล้ว คู่แข่งหลัก (PlayMatch) เป็นแพลตฟอร์มเว็บที่ต้องสมัคร — friction สูง จุดต่างเชิงกลยุทธ์ของเราคือ "ไร้แรงเสียดทาน + อยู่ในที่ที่คนอยู่แล้ว"

**Decision:** ทำทั้งหมดใน LIFF + Rich Menu + LINE Login ผูกตัวตนกับ LINE userId ไม่มีการสมัคร/ล็อกอินเว็บแยก

**Alternatives:** (ก) เว็บแอป + สมัครเอง เหมือนคู่แข่ง; (ข) native app iOS/Android — โหลดยาก แรงเสียดทานสูง

**Consequences:** ✅ friction ต่ำสุด, distribution ผ่าน LINE ตรงกลุ่ม, ผู้เล่นเข้าร่วมด้วยคลิกเดียว · ⚠️ ผูกกับข้อจำกัดของ LIFF และ ecosystem ของ LINE, ทำงานนอก LINE ไม่ได้

---

## ADR-2: Player เป็น entity อิสระ แยกจากการเป็นสมาชิกก๊วน (portable identity)

**Status:** Accepted

**Context:** กลยุทธ์คือเริ่มที่ A (เครื่องมือเบา) แล้วโตไป B (เครือข่ายผู้เล่น) ถ้าผูกโปรไฟล์/สถิติกับก๊วนเดียว (แบบ ranking per-club ของคู่แข่ง) จะสร้าง network effect ไม่ได้

**Decision:** `players` เป็นตารางอิสระผูกกับ LINE userId, `memberships` เชื่อม player↔guan, สถิติสะสมอยู่ที่ player

**Alternatives:** เก็บผู้เล่นเป็น sub-record ของก๊วน — ง่ายกว่าตอนแรกแต่ปิดทางโตเป็นเครือข่าย

**Consequences:** ✅ วางรากฐาน network moat ตั้งแต่ MVP โดยไม่ต้อง migrate ใหญ่ภายหลัง · ⚠️ schema/logic ซับซ้อนขึ้นเล็กน้อย, ต้องจัดการ privacy เมื่อโปรไฟล์ข้ามก๊วน

---

## ADR-3: ใช้ Supabase (PostgreSQL) แทน Firebase

**Status:** Accepted

**Context:** ต้องคำนวณเงินแบบ relational (join เกม/ลูก/คน), เป็น multi-tenant ที่ต้องแยกสิทธิ์รายก๊วน, และต้องมี realtime สำหรับกระดานคิว

**Decision:** Supabase — PostgreSQL + Auth (LINE Login) + Realtime + Storage + Edge Functions + Row Level Security

**Alternatives:** Firebase/Firestore (NoSQL) คำนวณ relational ยุ่ง; self-host backend งานมากเกินสำหรับทีมเล็ก

**Consequences:** ✅ ได้ relational + realtime + RLS ครบในที่เดียว, free tier พอเริ่ม · ⚠️ ทีมต้องคุ้น SQL/RLS, พึ่ง vendor เดียว

---

## ADR-4: Cost engine ใช้ 3 โหมดจริง — ตัด "หารตามเวลาเป็นนาที" ออก

**Status:** Accepted (แทนที่ร่างเดิมที่หารค่าคอร์ท/ค่าลูกตามนาทีที่อยู่)

**Context:** ร่างแรกออกแบบหารเงินตามเวลาที่อยู่จริงเป็นนาที ต่อมาข้อมูลภาคสนาม (เคส Smash 44 + 3 โมเดลจริงในวงการ) ชี้ชัดว่าก๊วนไทย **ไม่ได้หารแบบนาที** แต่ใช้ บุฟเฟ่ต์เหมาจ่าย / รายเกม / หารเท่ากันตอนเลิก

**Decision:** cost engine รองรับ 3 โหมดจริง เลือกได้ต่อรอบ (`buffet` | `per_game` | `even`) และตัด minute-based proration ทิ้ง

**Alternatives:** minute-based proration — ยุติธรรมทางทฤษฎีแต่ไม่มีใครใช้จริงและซับซ้อนเกินจำเป็น

**Consequences:** ✅ ตรงพฤติกรรมจริง เข้าใจง่าย ลด over-engineering · ⚠️ ต้องรองรับหลายสูตร · 📝 บันทึกไว้ว่านี่คือการเปลี่ยนใจจากข้อมูลผู้ใช้จริง (ดีต่อการ trace ที่มาของ requirement)

---

## ADR-5: โหมดรายเกมใช้ข้อมูลจำนวนเกมจาก Queue Engine ซ้ำ

**Status:** Accepted

**Context:** โหมดรายเกมต้องรู้จำนวนเกมที่แต่ละคนลงเล่น ซึ่ง queue engine บันทึก `match_players` ของแมตช์ที่ `done` อยู่แล้ว

**Decision:** คิดค่าลูกรายเกมจากข้อมูลเกมของ queue engine โดยตรง (ไม่ต้องกรอกซ้ำ) และกฎ "ลูกเกินโควตา" ผูกผ่าน `shuttle_logs.match_id`

**Alternatives:** ให้หัวหน้ากรอกจำนวนเกมของแต่ละคนเอง — ซ้ำซ้อนและผิดพลาดง่าย

**Consequences:** ✅ ได้ฟีเจอร์คิดเงินรายเกมแทบฟรี = ข้อได้เปรียบเหนือเครื่องคิดเลขที่คู่แข่งทำไม่ได้ · ⚠️ ความถูกต้องของค่าลูกผูกกับการปิดแมตช์ให้ครบถ้วน

---

## ADR-6: กระดานคิว real-time ผ่าน Supabase Realtime

**Status:** Accepted

**Context:** สมาชิกหลายคนต้องเห็นคิว/คอร์ทอัปเดตพร้อมกันแบบสดบนมือถือของแต่ละคน

**Decision:** subscribe การเปลี่ยนแปลงของ `matches`/`session_participants` ผ่าน Supabase Realtime + มี fallback refresh เมื่อ realtime หลุด

**Alternatives:** polling (ถูกกว่าแต่หน่วง/เปลือง)); self-managed WebSocket (งานมากเกิน)

**Consequences:** ✅ UX สดจริง ตรงกับจุดขาย "กระดานคิว" · ⚠️ ต้องคุมโควตา realtime และจัดการ reconnection

---

## ADR-7: เคลียร์เงินด้วย QR พร้อมเพย์ + ติ๊กสถานะเอง (ไม่ต่อ payment gateway)

**Status:** Accepted

**Context:** ต้องเคลียร์เงินให้ง่าย แต่ payment gateway มีเรื่อง compliance/ค่าธรรมเนียม/ความซับซ้อนสูง ขณะที่คนไทยโอนพร้อมเพย์กันอยู่แล้ว

**Decision:** แสดง QR พร้อมเพย์ของก๊วน + ให้ติ๊กสถานะ "จ่ายแล้ว/ค้าง" เอง ระบบคำนวณและติดตามสถานะเท่านั้น ไม่ขยับเงินจริง

**Alternatives:** ต่อ payment gateway จริง (เกินจำเป็นสำหรับ MVP); เก็บเงินสดล้วนไม่มี tracking

**Consequences:** ✅ ง่าย เร็ว เลี่ยง compliance และค่าธรรมเนียม · ⚠️ ต้องเชื่อการติ๊กสถานะ ไม่มี reconcile อัตโนมัติ

---

## ADR-8: หารเงินคำนวณสดจาก source ไม่เก็บยอดซ้ำ

**Status:** Accepted

**Context:** ยอดต้องแก้ได้เมื่อมีการปรับ (เพิ่มลูก/แก้เกม/คนกลับก่อน) และต้องโปร่งใสให้ผู้เล่นตรวจได้

**Decision:** `cost_shares` คำนวณสดจาก `session_participants` + `matches` + `shuttle_logs` (สร้าง/อัปเดตตอนปิดรอบ) ไม่เก็บยอดที่อาจขัดกับ source data

**Alternatives:** เก็บยอดสำเร็จรูปตอนคำนวณครั้งแรก — เสี่ยงข้อมูลขัดแย้งเมื่อ source เปลี่ยน

**Consequences:** ✅ ข้อมูลไม่ขัดแย้ง แก้ย้อนได้ โปร่งใส · ⚠️ ต้องคำนวณใหม่เมื่อ source เปลี่ยน (ต้องคุม performance)

---

## ADR-9: ขอบเขตแบบ "เบา" — จงใจตัดฟีเจอร์ระดับโปร

**Status:** Accepted

**Context:** แข่งกับ incumbent ที่ฟีเจอร์ครบ (PlayMatch 400+ ก๊วน) ในฐานะนักพัฒนาเดี่ยว การไล่ทำฟีเจอร์ให้ครบกว่าคือแพ้

**Decision:** จงใจตัด บัญชีรายรับ-รายจ่ายก๊วน / คูปอง / MMR-ranking เต็มรูป / คลังสต็อกลูก ออกจาก MVP โฟกัส 3 งานหลัก (เช็คอิน+waitlist / คิว / หารเงิน)

**Alternatives:** ทำให้ครบเทียบเท่าคู่แข่ง — ใช้เวลามหาศาลและยังตามหลัง

**Consequences:** ✅ เบา เร็ว ต่างชัด ตรงกลุ่ม long-tail · ⚠️ เสี่ยงถูกมองว่าทำน้อย จึงต้องทำ 3 งานหลักให้ดีจริง และ incumbent อาจออกโหมด lite มาชน

---

## ADR-10: MVP โฟกัสแบดมินตันกีฬาเดียว

**Status:** Accepted

**Context:** กีฬาต่างกลไกกัน (แบด = คิวหมุนเวียนคอร์ท, บอล/ฟุตซอล = แบ่งทีม) การทำหลายกีฬาพร้อมกันทำให้ทั้งสองอย่างตื้น

**Decision:** MVP รองรับแบดมินตันอย่างเดียว ฟุตซอล/บอลเก็บไว้เฟสหลัง

**Alternatives:** ทำ generic หลายกีฬาตั้งแต่แรก — ซับซ้อนและเสียโฟกัส

**Consequences:** ✅ ทำกลไกยาก (คิว/หารเงิน) ได้ลึกและเนียน · ⚠️ ต้องออกแบบ schema เผื่อขยายกีฬาภายหลังพอสมควร

---

## Decision Log Summary (สรุปสถานะการตัดสินใจ)

| ADR | หัวข้อ | Status |
|-----|--------|--------|
| 1 | LINE-native (LIFF) ไม่สมัครเว็บ | Accepted |
| 2 | Player เป็น entity อิสระ (portable) | Accepted |
| 3 | Supabase แทน Firebase | Accepted |
| 4 | Cost engine 3 โหมดจริง (ตัด minute-based) | Accepted (supersedes) |
| 5 | รายเกมใช้ข้อมูลเกมจาก queue engine | Accepted |
| 6 | กระดานคิว real-time (Supabase Realtime) | Accepted |
| 7 | QR พร้อมเพย์ + ติ๊กเอง (ไม่ต่อ gateway) | Accepted |
| 8 | หารเงินคำนวณสดจาก source | Accepted |
| 9 | ขอบเขตเบา ตัดฟีเจอร์โปร | Accepted |
| 10 | แบดกีฬาเดียวใน MVP | Accepted |
