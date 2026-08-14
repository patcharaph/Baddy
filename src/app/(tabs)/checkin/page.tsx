import { CheckinScreen, type RosterRow } from "@/components/checkin/checkin-screen";
import { EmptyState } from "@/components/source-note";
import { loadBoard } from "@/lib/data/source";
import { timeLabel } from "@/lib/format/datetime";

export const metadata = { title: "เช็คอิน — Baddy" };

// Who is in the room changes by the minute, so this is never cached.
export const dynamic = "force-dynamic";

/**
 * Check-in and waitlist (PRD FR-3, US-2.1/2.2).
 *
 * One route, two screens: the organizer sees the whole roster and can move
 * anyone, a player sees only their own row. Splitting them into two URLs would
 * mean a shared link opened the wrong screen for half the guan.
 */
export default async function CheckinPage() {
  const { board, viewer, kind } = await loadBoard();

  if (!board) {
    return (
      <EmptyState
        title="ยังไม่มีรอบเล่นที่เปิดอยู่"
        detail="เปิดรอบก่อน แล้วรายชื่อกับ waitlist จะขึ้นที่นี่"
      />
    );
  }

  // Formatted here so the client component never has to parse a timestamp —
  // that is where a server/client timezone mismatch would come from.
  const roster: RosterRow[] = board.roster.map((entry) => ({
    id: entry.player.id,
    name: entry.player.displayName,
    skillLevel: entry.player.skillLevel,
    status: entry.status,
    checkInLabel: entry.checkInAt === null ? null : timeLabel(entry.checkInAt),
    waitlistPosition: entry.waitlistPosition,
  }));

  const queueIndex = board.queue.findIndex((e) => e.playerId === viewer.playerId);

  return (
    <CheckinScreen
      sessionId={kind === "live" ? board.session.id : null}
      roster={roster}
      capacity={board.session.capacity}
      canEditOthers={viewer.role === "organizer"}
      meId={viewer.playerId}
      myQueuePosition={queueIndex >= 0 ? queueIndex + 1 : null}
    />
  );
}
