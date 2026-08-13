import { BoardLiveSync } from "@/components/queue/board-live-sync";
import { NextMatchButton } from "@/components/queue/next-match-button";
import { EmptyState, SourceNote } from "@/components/source-note";
import { TopBar } from "@/components/top-bar";
import { Avatar, SectionTitle, SkillChip } from "@/components/ui";
import { loadBoard } from "@/lib/data/source";
import type { PlayerView } from "@/lib/data/types";
import { formatElapsed } from "@/lib/domain/money";

export const metadata = { title: "กระดานคิว — Baddy" };

// The board is only ever correct as of right now, so it is never cached.
export const dynamic = "force-dynamic";

/**
 * Live Queue Board (PRD FR-5, US-3.3).
 *
 * The waiting order is not stored anywhere — it is the queue engine's fairness
 * ordering, recomputed from wait time and games played. That is what makes it
 * defensible when someone asks why they are behind another player.
 */
export default async function QueuePage() {
  const { kind, board, now } = await loadBoard();

  if (!board) {
    return (
      <>
        <TopBar left="🏸 กระดานคิว" />
        <EmptyState
          title="ยังไม่มีรอบเล่นที่เปิดอยู่"
          detail="เปิดรอบใหม่แล้วคิวจะขึ้นที่นี่"
        />
      </>
    );
  }

  const { session, courts, queue, players, checkedInCount, freeCourts } = board;
  const byId = new Map(players.map((p) => [p.id, p]));

  const timeLabel = new Date(session.startsAt).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

  return (
    <>
      <TopBar
        left={
          <>
            🏸 <b className="font-semibold">{session.venue ?? session.guanName}</b>
            <span className="mx-1.5 opacity-50">·</span>
            {timeLabel}
          </>
        }
        right={
          <>
            มาแล้ว <b className="font-semibold">{checkedInCount}</b> คน
          </>
        }
      />

      <main className="px-4 pt-4">
        <SourceNote kind={kind} />

        <SectionTitle note={`${courts.length} คอร์ท`}>กำลังเล่น</SectionTitle>

        {courts.length === 0 ? (
          <p className="mb-3 rounded-2xl border border-dashed border-line bg-surface px-3 py-6 text-center text-[12.5px] text-muted">
            ยังไม่มีใครลงคอร์ท — กดสุ่มแมตช์ด้านล่างได้เลย
          </p>
        ) : null}

        {courts.map((court) => (
          <article
            key={court.matchId}
            className="mb-[11px] rounded-2xl border border-line bg-surface px-[13px] py-3"
          >
            <div className="mb-[9px] flex items-center justify-between">
              <h3 className="flex items-center gap-[7px] font-display text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-court" aria-hidden />
                คอร์ท {court.courtNo}
              </h3>
              {court.startedAt ? (
                <span className="rounded-full bg-court-bg px-2 py-[3px] font-mono text-[12.5px] font-semibold text-court tabular-nums">
                  ◷ {formatElapsed(court.startedAt, now)}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Side playerIds={court.playerIds.slice(0, 2)} byId={byId} />
              <span className="font-display text-xs font-bold text-muted">VS</span>
              <Side playerIds={court.playerIds.slice(2)} byId={byId} />
            </div>
          </article>
        ))}

        <div className="mt-4">
          <SectionTitle note={`รอ ${queue.length} คน`}>คิวถัดไป</SectionTitle>
        </div>

        {queue.length === 0 ? (
          <p className="mb-3 rounded-2xl border border-dashed border-line bg-surface px-3 py-6 text-center text-[12.5px] text-muted">
            ไม่มีใครรอคิวอยู่
          </p>
        ) : null}

        <ol>
          {queue.map((entry, index) => {
            const player = byId.get(entry.playerId);
            if (!player) return null;

            return (
              <li
                key={entry.playerId}
                className="mb-2 flex items-center gap-[11px] rounded-[13px] border border-line bg-surface px-3 py-2.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-navy font-mono text-xs font-semibold text-white tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                    {player.displayName}
                    {player.skillLevel ? (
                      <SkillChip level={player.skillLevel} />
                    ) : null}
                  </div>
                  <div className="mt-px text-[11.5px] text-muted">
                    รอ {entry.waitedMinutes} นาที · เล่นไป {entry.gamesPlayed} เกม
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <NextMatchButton
          sessionId={session.id}
          freeCourts={freeCourts}
          queue={queue}
          players={players}
          now={now}
          canStart={kind === "live"}
        />
      </main>

      <BoardLiveSync sessionId={session.id} enabled={kind === "live"} />
    </>
  );
}

function Side({
  playerIds,
  byId,
}: {
  playerIds: string[];
  byId: Map<string, PlayerView>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {playerIds.map((id) => {
        const player = byId.get(id);
        if (!player) return null;

        return (
          <div key={id} className="flex items-center gap-[7px] text-[13px]">
            <Avatar name={player.displayName} color={player.color} />
            <span className="truncate">{player.displayName}</span>
            {player.skillLevel ? (
              <span className="ml-auto">
                <SkillChip level={player.skillLevel} />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
