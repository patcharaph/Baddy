import { NextMatchButton } from "@/components/queue/next-match-button";
import { TopBar } from "@/components/top-bar";
import { Avatar, SectionTitle, SkillChip } from "@/components/ui";
import { formatElapsed } from "@/lib/domain/money";
import { orderByFairness, waitedMs } from "@/lib/domain/queue-engine";
import {
  CHECKED_IN_COUNT,
  SAMPLE_COURTS,
  SAMPLE_NOW,
  SAMPLE_QUEUE_CANDIDATES,
  SAMPLE_SESSION,
  samplePlayer,
} from "@/lib/sample/session";

export const metadata = { title: "กระดานคิว — Baddy" };

/**
 * Live Queue Board (PRD FR-5, US-3.3).
 *
 * The waiting order is not stored anywhere — it is the queue engine's fairness
 * ordering, recomputed from wait time and games played. That is what makes it
 * defensible when someone asks why they are behind another player.
 */
export default function QueuePage() {
  const waiting = orderByFairness(SAMPLE_QUEUE_CANDIDATES, { now: SAMPLE_NOW });

  return (
    <>
      <TopBar
        left={
          <>
            🏸 <b className="font-semibold">{SAMPLE_SESSION.venue}</b>
            <span className="mx-1.5 opacity-50">·</span>
            {SAMPLE_SESSION.timeLabel}
          </>
        }
        right={
          <>
            มาแล้ว <b className="font-semibold">{CHECKED_IN_COUNT}</b> คน
          </>
        }
      />

      <main className="px-4 pt-4">
        <SectionTitle note={`${SAMPLE_COURTS.length} คอร์ท`}>
          กำลังเล่น
        </SectionTitle>

        {SAMPLE_COURTS.map((court) => (
          <article
            key={court.courtNo}
            className="mb-[11px] rounded-2xl border border-line bg-surface px-[13px] py-3"
          >
            <div className="mb-[9px] flex items-center justify-between">
              <h3 className="flex items-center gap-[7px] font-display text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-court" aria-hidden />
                คอร์ท {court.courtNo}
              </h3>
              <span className="rounded-full bg-court-bg px-2 py-[3px] font-mono text-[12.5px] font-semibold text-court tabular-nums">
                ◷ {formatElapsed(court.startedAt, SAMPLE_NOW)}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Side playerIds={court.sideA} />
              <span className="font-display text-xs font-bold text-muted">
                VS
              </span>
              <Side playerIds={court.sideB} />
            </div>
          </article>
        ))}

        <div className="mt-4">
          <SectionTitle note={`รอ ${waiting.length} คน`}>คิวถัดไป</SectionTitle>
        </div>

        <ol>
          {waiting.map((candidate, index) => {
            const player = samplePlayer(candidate.playerId);
            const minutes = Math.round(waitedMs(candidate, SAMPLE_NOW) / 60_000);

            return (
              <li
                key={candidate.playerId}
                className={`mb-2 flex items-center gap-[11px] rounded-[13px] border px-3 py-2.5 ${
                  player.isMe
                    ? "border-primary bg-me-bg"
                    : "border-line bg-surface"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-navy font-mono text-xs font-semibold text-white tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                    {player.isMe ? `คุณ (${player.name})` : player.name}
                    {player.isMe ? (
                      <span className="rounded bg-primary px-1.5 py-px text-[9px] font-bold text-white">
                        คิวคุณ
                      </span>
                    ) : null}
                    <SkillChip level={player.skill} />
                  </div>
                  <div className="mt-px text-[11.5px] text-muted">
                    รอ {minutes} นาที · เล่นไป {candidate.gamesPlayed} เกม
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <NextMatchButton />
      </main>
    </>
  );
}

function Side({ playerIds }: { playerIds: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {playerIds.map((id) => {
        const player = samplePlayer(id);
        return (
          <div key={id} className="flex items-center gap-[7px] text-[13px]">
            <Avatar name={player.name} color={player.color} />
            <span className="truncate">{player.name}</span>
            <span className="ml-auto">
              <SkillChip level={player.skill} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
