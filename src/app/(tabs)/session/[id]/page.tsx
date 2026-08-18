import Link from "next/link";

import { CloseSessionPanel } from "@/components/session/close-session-panel";
import { EditSessionForm } from "@/components/session/edit-session-form";
import { EmptyState } from "@/components/source-note";
import { ghostButton, Notice, primaryButton, ScreenTitle } from "@/components/ui";
import { loadManageSession } from "@/lib/data/source";
import { sessionHeadline } from "@/lib/format/datetime";

export const metadata = { title: "แก้ไขรอบ — Baddy" };

export const dynamic = "force-dynamic";

/**
 * Edit and close a round (PRD FR-2).
 *
 * Addressed by id rather than by "the round that is open", because the round
 * this screen is most needed for is sometimes a closed one: closing removes a
 * round from every other screen, and this is the page that can still reach it.
 *
 * Organizer-only, checked here as well as in the actions. The check in the
 * actions is what makes a direct POST fail; this one is what keeps a player from
 * filling in a form that was never going to save.
 */
export default async function ManageSessionPage({
  params,
}: PageProps<"/session/[id]">) {
  const { id } = await params;
  const { kind, session, viewer, liveMatchCount } = await loadManageSession(id);

  if (!session) {
    return (
      <EmptyState
        title="ไม่พบรอบนี้"
        detail="ลิงก์อาจเก่าไปแล้ว หรือรอบนี้อยู่ในก๊วนที่คุณไม่ได้เป็นสมาชิก"
        action={
          <Link href="/" className={primaryButton}>
            กลับหน้าแรก
          </Link>
        }
      />
    );
  }

  if (viewer.role !== "organizer") {
    return (
      <EmptyState
        title="แก้ไขรอบได้เฉพาะหัวหน้าก๊วน"
        detail="ถ้าเวลาหรือเรตของรอบนี้ไม่ตรง บอกหัวหน้าก๊วนให้แก้ให้ — คนอื่นแก้แทนไม่ได้"
        action={
          <Link href="/" className={primaryButton}>
            กลับหน้าแรก
          </Link>
        }
      />
    );
  }

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="แก้ไขรอบ"
        subtitle={sessionHeadline(session.startsAt, session.endsAt)}
        action={
          <Link href="/" className={ghostButton}>
            ยกเลิก
          </Link>
        }
      />

      {kind === "sample" ? (
        <Notice>
          นี่คือโหมดข้อมูลตัวอย่าง — ดูหน้าจอได้ แต่แก้รอบจริงยังไม่ได้จนกว่าจะตั้งค่า Supabase
        </Notice>
      ) : null}

      {session.closedAt ? (
        <Notice>
          รอบนี้ปิดไปแล้ว — แก้ได้ แต่จะยังไม่ขึ้นหน้าจอไหนจนกว่าจะกดเปิดกลับด้านล่าง
        </Notice>
      ) : null}

      {/* Both of these are allowed and neither removes anybody, which is exactly
          why they are worth saying: the numbers change, the people already in
          the round do not. */}
      <p className="rounded-[14px] bg-inset px-3 py-2.5 text-[11.5px] leading-relaxed text-muted text-pretty">
        ลดโควตาต่ำกว่าจำนวนคนที่เช็คอินแล้วได้ — คนที่อยู่ในรอบไม่ถูกเอาออก
        แต่คนถัดไปจะเข้า waitlist แทน · ลดจำนวนคอร์ทต่ำกว่าคอร์ทที่กำลังเล่นอยู่ได้เหมือนกัน
        แมตช์นั้นยังเล่นและกดจบได้ตามปกติ แค่จะไม่มีคิวใหม่ลงคอร์ทนั้นอีก
      </p>

      <EditSessionForm session={session} />

      <CloseSessionPanel
        sessionId={session.id}
        closedAt={session.closedAt}
        liveMatchCount={liveMatchCount}
        canWrite={kind !== "sample"}
      />
    </main>
  );
}
