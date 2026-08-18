import {
  ShuttleScreen,
  type ShuttleLogRowView,
} from "@/components/shuttle/shuttle-screen";
import { EmptyState } from "@/components/source-note";
import { loadBoard } from "@/lib/data/source";
import { timeLabel } from "@/lib/format/datetime";

export const metadata = { title: "บันทึกลูก — Baddy" };

export const dynamic = "force-dynamic";

/**
 * Shuttle logging (PRD FR-6) — organizer only.
 *
 * Not a tab: it is reached from the home card or from the court that just used
 * a shuttle, because that is the moment the tap belongs to.
 */
export default async function ShuttlePage() {
  const { board, viewer, kind } = await loadBoard();

  if (!board) {
    return (
      <EmptyState
        title="ยังไม่มีรอบเล่นที่เปิดอยู่"
        detail="เปิดรอบก่อน แล้วค่อยเริ่มนับลูก"
      />
    );
  }

  // Logging a shuttle changes what everyone owes, so it is the organizer's
  // alone. A player who follows a stale link gets a sentence, not a 403.
  if (viewer.role !== "organizer") {
    return (
      <EmptyState
        title="หน้านี้สำหรับหัวหน้าก๊วน"
        detail="การนับลูกมีผลกับยอดที่ทุกคนต้องจ่าย เลยให้หัวหน้าก๊วนเป็นคนกดคนเดียว — ดูจำนวนลูกที่ใช้ได้ที่หน้าหลัก"
      />
    );
  }

  const { shuttles, courts } = board;

  // The running number counts down from the total: the newest tap is #N.
  const log: ShuttleLogRowView[] = shuttles.recent.map((entry, index) => ({
    id: entry.id,
    timeLabel: timeLabel(entry.loggedAt),
    detail: [
      entry.courtNo === null ? "ไม่ระบุคอร์ท" : `คอร์ท ${entry.courtNo}`,
      entry.matchNo === null ? "ไม่ผูกแมตช์" : `แมตช์ที่ ${entry.matchNo}`,
    ].join(" · "),
    ordinal: `#${shuttles.count - index}`,
  }));

  return (
    <ShuttleScreen
      sessionId={kind === "live" ? board.session.id : null}
      count={shuttles.count}
      unitPrice={shuttles.unitPrice}
      log={log}
      courts={courts.map((c) => ({ matchId: c.matchId, courtNo: c.courtNo }))}
    />
  );
}
