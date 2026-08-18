"use client";

import { useState, useTransition } from "react";

import { endMatch, logShuttle } from "@/lib/data/mutations";

/**
 * The two things an organizer does to a court that is in play: end the game (so
 * the queue rotates) and log a shuttle against it.
 *
 * They sit together on the court card because that is when both decisions get
 * made — the game finishes, someone says "we opened two", and the organizer taps
 * both without leaving the board. Logging the shuttle here is also what keeps
 * the per-game split honest: the tap carries the match id with it.
 */
export function CourtActions({
  matchId,
  sessionId,
  shuttlePrice,
  canWrite,
}: {
  matchId: string;
  /** Null on sample data, where there is nothing to write to. */
  sessionId: string | null;
  shuttlePrice: number;
  canWrite: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<void>) => {
    setError(null);
    if (!canWrite || sessionId === null) return;

    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 px-3.5 pb-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canWrite || pending}
          onClick={() => run(() => endMatch(matchId))}
          className="min-h-11 flex-1 rounded-xl border-none bg-accent-soft text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft-hover disabled:opacity-40"
        >
          {pending ? "กำลังบันทึก…" : "จบเกม · หมุนคิว"}
        </button>
        <button
          type="button"
          disabled={!canWrite || pending}
          onClick={() =>
            run(() => logShuttle(sessionId as string, shuttlePrice, matchId))
          }
          aria-label={`บันทึกลูกใหม่ของแมตช์นี้ (฿${shuttlePrice})`}
          className="min-h-11 shrink-0 rounded-xl border border-line-strong px-4 font-mono text-[13px] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          +1
        </button>
      </div>
      {error ? (
        <p className="text-[11px] text-warn">{error}</p>
      ) : null}
    </div>
  );
}
