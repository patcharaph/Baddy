import Link from "next/link";

import { CreateSessionForm } from "@/components/session/create-session-form";
import { EmptyState } from "@/components/source-note";
import { Notice, ScreenTitle, ghostButton, primaryButton } from "@/components/ui";
import { loadOrganizerGuans } from "@/lib/data/source";

export const metadata = { title: "เปิดรอบ — Baddy" };

export const dynamic = "force-dynamic";

/**
 * Open a round (PRD FR-2, US-2.1).
 *
 * The guan list is loaded before the form because a session cannot exist without
 * one, and an organizer of nothing needs to be sent to create a guan rather than
 * handed an empty dropdown and left to work out why the form does not submit.
 */
export default async function NewSessionPage() {
  const { kind, guans } = await loadOrganizerGuans();

  if (guans.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีก๊วนที่คุณเป็นหัวหน้า"
        detail="รอบเล่นต้องสังกัดก๊วน — สร้างก๊วนก่อนแล้วค่อยเปิดรอบ ถ้าคุณเป็นสมาชิกอยู่แล้ว ให้หัวหน้าก๊วนเปิดรอบให้"
        action={
          <Link href="/new-guan" className={primaryButton}>
            สร้างก๊วน
          </Link>
        }
      />
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="เปิดรอบ"
        subtitle="ตั้งเวลา สนาม คอร์ท โควตา และวิธีหารเงิน — เปิดแล้วสมาชิกเช็คอินเข้ามาได้เลย"
        action={
          <Link href="/" className={ghostButton}>
            ยกเลิก
          </Link>
        }
      />

      {kind === "sample" ? (
        <Notice>
          นี่คือโหมดข้อมูลตัวอย่าง — ดูหน้าจอได้ แต่เปิดรอบจริงยังไม่ได้จนกว่าจะตั้งค่า Supabase
        </Notice>
      ) : null}

      <CreateSessionForm guans={guans} />
    </main>
  );
}
