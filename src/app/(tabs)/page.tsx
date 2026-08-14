import Link from "next/link";

import { EmptyState } from "@/components/source-note";
import { TaskCard } from "@/components/task-card";
import {
  ghostButton,
  LiveDot,
  primaryButton,
  SectionHeading,
  StatTile,
} from "@/components/ui";
import { loadBoard, loadCostData } from "@/lib/data/source";
import { tryComputeCostShares } from "@/lib/domain/cost-engine";
import { baht } from "@/lib/domain/money";
import { sessionHeadline } from "@/lib/format/datetime";

export const metadata = { title: "รอบวันนี้ — Baddy" };

// The round only exists in the present tense, so it is never cached.
export const dynamic = "force-dynamic";

/**
 * Home — the round as it stands right now (PRD FR-2).
 *
 * This is the screen someone opens between games with one hand, so it answers
 * the three questions that get asked out loud at a guan — how many are here, who
 * is waiting, how many shuttles have we burned — and then lists what is actually
 * waiting on the person looking at it.
 */
export default async function HomePage() {
  const { board, viewer } = await loadBoard();
  const cost = await loadCostData();

  if (!board) {
    return (
      <EmptyState
        title="ยังไม่มีรอบเล่นที่เปิดอยู่"
        detail="เปิดรอบใหม่แล้วทุกอย่างของคืนนี้จะมารวมอยู่ที่หน้านี้"
      />
    );
  }

  const { session, courts, queue, waitlist, shuttles, checkedInCount } = board;
  const isOrganizer = viewer.role === "organizer";
  const playing = courts.length > 0;
  const money = moneySummary(cost, viewer.playerId);

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-gradient-to-b from-raised to-surface p-[18px] shadow-card">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-[7px]">
            <LiveDot live={playing} />
            <span className="font-mono text-[10px] tracking-[0.12em] text-accent">
              {playing ? "LIVE · กำลังเล่น" : "เปิดรอบแล้ว · ยังไม่มีใครลงคอร์ท"}
            </span>
          </div>
          <h1 className="text-[21px] leading-tight font-bold">
            {sessionHeadline(session.startsAt, session.endsAt)}
          </h1>
          <p className="text-[13px] text-muted">
            {session.venue ?? session.guanName} · คอร์ท 1–{session.courtCount}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="เช็คอินแล้ว" value={checkedInCount} />
          <StatTile label="รอคิว" value={queue.length} />
          <StatTile label="ลูกที่ใช้" value={shuttles.count} accent />
        </div>

        <div className="flex gap-2.5">
          <Link href="/queue" className={`${primaryButton} flex-1`}>
            ดูกระดานคิว
          </Link>
          {isOrganizer ? (
            <Link href="/shuttle" className={`${ghostButton} font-mono`}>
              +1 ลูก
            </Link>
          ) : (
            <Link href="/checkin" className={ghostButton}>
              เช็คอินของฉัน
            </Link>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeading note={isOrganizer ? "ORGANIZER" : "PLAYER"}>
          {isOrganizer ? "งานที่ต้องทำ" : "ของฉันวันนี้"}
        </SectionHeading>

        {isOrganizer ? (
          <OrganizerTasks
            waitlistCount={waitlist.length}
            freeSeats={
              session.capacity === null
                ? null
                : Math.max(0, session.capacity - checkedInCount)
            }
            freeCourts={board.freeCourts}
            money={money}
          />
        ) : (
          <PlayerTasks board={board} playerId={viewer.playerId} money={money} />
        )}
      </section>
    </main>
  );
}

interface MoneySummary {
  grandTotal: number;
  paidCount: number;
  headcount: number;
  /** The signed-in player's share, when they have one. */
  myTotal: number | null;
  myPaid: boolean;
  error: string | null;
}

function moneySummary(
  cost: Awaited<ReturnType<typeof loadCostData>>,
  playerId: string | null = null,
): MoneySummary {
  const empty: MoneySummary = {
    grandTotal: 0,
    paidCount: 0,
    headcount: 0,
    myTotal: null,
    myPaid: false,
    error: null,
  };

  if (!cost.data) return empty;

  const computed = tryComputeCostShares(cost.data.input);
  if (!computed.ok) return { ...empty, error: computed.error };

  const paid = new Set(cost.data.paidPlayerIds);
  const mine = playerId
    ? computed.result.shares.find((s) => s.playerId === playerId)
    : undefined;

  return {
    grandTotal: computed.result.grandTotal,
    paidCount: computed.result.shares.filter((s) => paid.has(s.playerId)).length,
    headcount: computed.result.shares.length,
    myTotal: mine?.total ?? null,
    myPaid: mine ? paid.has(mine.playerId) : false,
    error: null,
  };
}

function OrganizerTasks({
  waitlistCount,
  freeSeats,
  freeCourts,
  money,
}: {
  waitlistCount: number;
  freeSeats: number | null;
  freeCourts: number[];
  money: MoneySummary;
}) {
  return (
    <>
      <TaskCard
        href="/checkin"
        urgent={waitlistCount > 0 && (freeSeats === null || freeSeats > 0)}
        title={
          waitlistCount > 0
            ? `มีคน waitlist ${waitlistCount} คน`
            : "ไม่มีใครรอเข้ารอบ"
        }
        detail={
          waitlistCount === 0
            ? "โควตายังไม่เต็ม"
            : freeSeats === null
              ? "ยังไม่ได้ตั้งโควตา — เลื่อนขึ้นได้เลย"
              : freeSeats > 0
                ? `มีที่ว่าง ${freeSeats} ที่ — เลื่อนขึ้นให้เลย`
                : "โควตาเต็ม รอมีคนกลับก่อน"
        }
        badge={waitlistCount > 0 ? "ดู" : "เช็คอิน"}
        badgeTone={waitlistCount > 0 ? "accent" : "quiet"}
      />

      <TaskCard
        href="/queue"
        urgent={freeCourts.length > 0}
        title={
          freeCourts.length > 0
            ? `คอร์ท ${freeCourts.join(", ")} ว่าง`
            : "ทุกคอร์ทกำลังเล่นอยู่"
        }
        detail={
          freeCourts.length > 0
            ? "ส่งคิวถัดไปลงคอร์ท"
            : "รอแมตช์ใดแมตช์หนึ่งจบก่อน"
        }
        badge="จัดคิว"
      />

      <TaskCard
        href="/money"
        title={money.error ? "ยังตั้งเรตไม่ครบ" : "ยอดที่ยังไม่เคลียร์"}
        detail={
          money.error
            ? money.error
            : `${money.paidCount}/${money.headcount} คนจ่ายแล้ว`
        }
        badge={money.error ? "ตั้งค่า" : baht(money.grandTotal)}
        badgeTone={money.error ? "quiet" : "mono"}
        urgent={money.error !== null}
      />
    </>
  );
}

function PlayerTasks({
  board,
  playerId,
  money,
}: {
  board: NonNullable<Awaited<ReturnType<typeof loadBoard>>["board"]>;
  playerId: string | null;
  money: MoneySummary;
}) {
  const me = board.roster.find((e) => e.player.id === playerId);
  const checkedIn = me?.status === "checked_in";
  const queueIndex = board.queue.findIndex((e) => e.playerId === playerId);
  const onCourt = board.courts.find((c) => c.playerIds.includes(playerId ?? ""));

  return (
    <>
      <TaskCard
        href="/checkin"
        urgent={!checkedIn}
        title={checkedIn ? "เช็คอินแล้ว" : "ยังไม่ได้เช็คอิน"}
        detail={
          checkedIn
            ? "อยู่ในคิวหมุนเวียนของรอบนี้"
            : me?.status === "waitlist"
              ? `อยู่ใน waitlist ลำดับที่ ${me.waitlistPosition ?? "—"}`
              : "กดเช็คอินเมื่อถึงสนาม"
        }
        badge={checkedIn ? "ดู" : "เช็คอิน"}
        badgeTone="accent"
      />

      <TaskCard
        href="/queue"
        title={
          onCourt
            ? `คุณอยู่คอร์ท ${onCourt.courtNo}`
            : queueIndex >= 0
              ? `คิวของคุณ: คิวที่ ${queueIndex + 1}`
              : "ยังไม่อยู่ในคิว"
        }
        detail={
          onCourt
            ? "กำลังเล่นอยู่ตอนนี้"
            : queueIndex >= 0
              ? `รออีก ${board.queue.length - queueIndex - 1} คนก่อนถึงคุณ`
              : "เช็คอินก่อนถึงจะเข้าคิวได้"
        }
        badge="ดูคิว"
      />

      <TaskCard
        href="/settle"
        title="ยอดที่คุณต้องจ่าย"
        detail={
          money.error
            ? "หัวหน้าก๊วนยังตั้งเรตไม่ครบ"
            : money.myTotal === null
              ? "คุณยังไม่ได้อยู่ในรอบนี้"
              : money.myPaid
                ? "จ่ายแล้ว — ขอบคุณครับ"
                : "กดดูที่มาของยอดได้"
        }
        badge={money.myTotal === null ? "—" : baht(money.myTotal)}
        badgeTone="mono"
      />
    </>
  );
}
