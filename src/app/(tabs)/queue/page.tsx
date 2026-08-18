import { BoardLiveSync } from "@/components/queue/board-live-sync";
import { CourtActions } from "@/components/queue/court-actions";
import { NextMatchButton } from "@/components/queue/next-match-button";
import { EmptyState } from "@/components/source-note";
import { EmptyPanel, Pill, ScreenTitle, SectionHeading } from "@/components/ui";
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
 * defensible when someone asks why they are behind another player, and it is why
 * the section says "พักนานได้ลงก่อน" out loud.
 */
export default async function QueuePage() {
  const { kind, board, viewer, now } = await loadBoard();

  if (!board) {
    return (
      <EmptyState
        title="ยังไม่มีรอบเล่นที่เปิดอยู่"
        detail="เปิดรอบใหม่แล้วคิวจะขึ้นที่นี่"
      />
    );
  }

  const { session, courts, queue, players, freeCourts, shuttles } = board;
  const byId = new Map(players.map((p) => [p.id, p]));
  const isOrganizer = viewer.role === "organizer";
  const live = kind === "live";
  const meId = viewer.playerId;

  // Courts with nobody on them still get a card: an empty court is the most
  // actionable thing on this screen, not an absence.
  const cards = [
    ...courts.map((c) => ({ courtNo: c.courtNo, court: c })),
    ...freeCourts.map((courtNo) => ({ courtNo, court: null })),
  ].sort((a, b) => a.courtNo - b.courtNo);

  return (
    <>
      <main className="flex flex-col gap-3.5 px-4 pt-[18px] pb-2">
        <ScreenTitle
          title="กระดานคิว"
          subtitle={`อัปเดตสด · ${courts.length}/${session.courtCount} คอร์ทกำลังเล่น`}
        />

        <div className="flex flex-col gap-2.5">
          {cards.map(({ courtNo, court }) => (
            <article
              key={courtNo}
              className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-card"
            >
              <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5 py-2.5">
                <span className="font-mono text-[13px] font-bold text-accent">
                  คอร์ท {courtNo}
                </span>
                <Pill tone={court ? "accent" : "quiet"}>
                  {court ? "กำลังเล่น" : "พร้อมลง"}
                </Pill>
                <span className="flex-1" />
                <span className="font-mono text-[11px] font-medium text-faint">
                  {court?.startedAt ? formatElapsed(court.startedAt, now) : "—"}
                </span>
              </div>

              {court ? (
                <div className="relative grid grid-cols-2 gap-2.5 court-lines p-3.5">
                  {/* The net. */}
                  <div
                    className="absolute inset-y-2.5 left-1/2 border-l border-dashed border-accent-line"
                    aria-hidden
                  />
                  <Side
                    playerIds={court.playerIds.slice(0, 2)}
                    byId={byId}
                    meId={meId}
                    accent
                  />
                  <Side
                    playerIds={court.playerIds.slice(2, 4)}
                    byId={byId}
                    meId={meId}
                  />
                </div>
              ) : (
                /* An empty court is one line, not four empty boxes — the space it
                   would take is space the courts in play need more. */
                <p className="px-3.5 py-4 text-center text-[12px] text-faint">
                  {isOrganizer
                    ? "ยังไม่มีใครลงคอร์ทนี้ — กดสุ่มแมตช์ถัดไปด้านล่าง"
                    : "ยังไม่มีใครลงคอร์ทนี้"}
                </p>
              )}

              {isOrganizer && court ? (
                <CourtActions
                  matchId={court.matchId}
                  sessionId={live ? session.id : null}
                  shuttlePrice={shuttles.unitPrice}
                  canWrite={live}
                />
              ) : null}
            </article>
          ))}
        </div>

        <section className="mt-1 flex flex-col gap-2">
          <SectionHeading note="พักนานได้ลงก่อน">คิวถัดไป</SectionHeading>

          {queue.length === 0 ? (
            <EmptyPanel>ไม่มีใครรอคิวอยู่</EmptyPanel>
          ) : (
            <ol className="flex flex-col gap-2">
              {queue.map((entry, index) => {
                const player = byId.get(entry.playerId);
                if (!player) return null;

                const next = index === 0;
                return (
                  <li
                    key={entry.playerId}
                    className={`flex min-h-12 items-center gap-2.5 rounded-[14px] border px-3 py-2 ${
                      next
                        ? "border-accent-line bg-accent-tint"
                        : "border-line-soft bg-inset-soft"
                    }`}
                  >
                    <span
                      className={`w-[22px] shrink-0 font-mono text-xs font-bold ${
                        next ? "text-accent" : "text-faint"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {player.displayName}
                      {player.id === meId ? (
                        <span className="text-muted"> (คุณ)</span>
                      ) : null}
                      {player.skillLevel ? (
                        <span className="text-faint"> · มือ {player.skillLevel}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-[10.5px] text-faint">
                      รอ {entry.waitedMinutes} น. · {entry.gamesPlayed} เกม
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {isOrganizer ? (
          <NextMatchButton
            sessionId={session.id}
            freeCourts={freeCourts}
            queue={queue}
            players={players}
            now={now}
            canStart={live}
          />
        ) : null}
      </main>

      <BoardLiveSync sessionId={session.id} enabled={live} />
    </>
  );
}

/** One half of a court: two players on the same side of the net. */
function Side({
  playerIds,
  byId,
  meId,
  accent = false,
}: {
  playerIds: string[];
  byId: Map<string, PlayerView>;
  meId: string | null;
  accent?: boolean;
}) {
  const slots = [0, 1];

  return (
    <div className="flex flex-col gap-2.5">
      {slots.map((i) => {
        const player = playerIds[i] ? byId.get(playerIds[i]) : undefined;

        if (!player) {
          return (
            <div
              key={i}
              className="flex min-h-[52px] flex-col justify-center rounded-xl border border-dashed border-line px-2.5 text-[11.5px] text-ghost"
            >
              ว่าง
            </div>
          );
        }

        return (
          <div
            key={player.id}
            className={`flex min-h-[52px] flex-col justify-center gap-[3px] rounded-xl border px-2.5 py-2 ${
              accent
                ? "border-accent-line bg-accent-tint"
                : "border-line-soft bg-inset"
            }`}
          >
            <span className="truncate text-[12.5px] leading-tight font-medium">
              {player.displayName}
              {player.id === meId ? (
                <span className="text-muted"> (คุณ)</span>
              ) : null}
            </span>
            <span className="font-mono text-[10px] text-faint">
              {player.skillLevel ? `มือ ${player.skillLevel}` : "ไม่ระบุมือ"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
