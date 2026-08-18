"use client";

import { useState, useTransition } from "react";

import { Notice, ScreenTitle, SectionHeading } from "@/components/ui";
import { logShuttle, undoLastShuttle } from "@/lib/data/mutations";
import { baht } from "@/lib/domain/money";

/** One line of history, already formatted on the server. */
export interface ShuttleLogRowView {
  id: string;
  timeLabel: string;
  detail: string;
  /** The running shuttle number, e.g. `#14`. */
  ordinal: string;
}

export interface LiveCourtOption {
  matchId: string;
  courtNo: number;
}

/**
 * Shuttle logging (PRD FR-6).
 *
 * One tap, one shuttle. The counter is deliberately the biggest thing on the
 * screen: this gets used mid-rally, at arm's length, by someone who is also
 * holding a racket.
 *
 * The tap carries a match id whenever there is a live court to attach it to,
 * because that attribution is the whole basis of the per-game split — a shuttle
 * with no match behind it can only ever be divided evenly.
 */
export function ShuttleScreen({
  sessionId,
  count,
  unitPrice,
  log,
  courts,
}: {
  /** Null on sample data, where there is nothing to write to. */
  sessionId: string | null;
  count: number;
  unitPrice: number;
  log: ShuttleLogRowView[];
  courts: LiveCourtOption[];
}) {
  const [shuttles, setShuttles] = useState(count);
  const [matchId, setMatchId] = useState<string | null>(
    courts[0]?.matchId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const live = sessionId !== null;

  const run = (delta: number, action: (id: string) => Promise<void>) => {
    if (shuttles + delta < 0) return;
    setShuttles((n) => n + delta);
    setError(null);
    if (!live) return;

    startTransition(async () => {
      try {
        await action(sessionId);
      } catch (e) {
        setShuttles((n) => n - delta);
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="บันทึกลูก"
        subtitle="กด +1 เมื่อเปิดลูกใหม่ ระบบผูกเวลาและแมตช์ให้อัตโนมัติ"
      />

      {error ? <Notice>{error}</Notice> : null}

      <section className="flex flex-col items-center gap-3.5 rounded-[22px] border border-accent-line bg-surface accent-glow p-[22px] shadow-card">
        <span className="font-mono text-[11px] tracking-[0.16em] text-muted">
          SHUTTLES USED
        </span>

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[64px] leading-none font-bold tracking-[-0.03em] text-accent">
            {shuttles}
          </span>
          <span className="text-[15px] font-medium text-muted">ลูก</span>
        </div>

        <span className="font-mono text-[13px] font-medium text-muted">
          = {baht(shuttles * unitPrice)} ({baht(unitPrice)}/ลูก)
        </span>

        {courts.length > 1 ? (
          <div
            role="radiogroup"
            aria-label="คอร์ทที่เปิดลูกใหม่"
            className="flex w-full gap-1.5 rounded-[13px] bg-inset p-1"
          >
            {courts.map((c) => (
              <button
                key={c.matchId}
                type="button"
                role="radio"
                aria-checked={matchId === c.matchId}
                onClick={() => setMatchId(c.matchId)}
                className={`min-h-9 flex-1 rounded-[10px] font-mono text-xs font-semibold transition-colors ${
                  matchId === c.matchId
                    ? "bg-accent-fill text-on-accent"
                    : "bg-transparent text-muted"
                }`}
              >
                คอร์ท {c.courtNo}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex w-full gap-2.5">
          <button
            type="button"
            disabled={pending || shuttles === 0}
            onClick={() => run(-1, (id) => undoLastShuttle(id))}
            aria-label="ย้อนกลับการบันทึกลูกล่าสุด"
            className="min-h-[52px] shrink-0 rounded-[16px] border border-line-strong px-5 font-mono text-[15px] font-semibold text-ink transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            −1
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(1, (id) => logShuttle(id, unitPrice, matchId))}
            className="min-h-[52px] flex-1 rounded-[16px] bg-accent-fill text-base font-bold text-on-accent transition-colors hover:bg-accent-fill-hover disabled:opacity-40"
          >
            +1 เปิดลูกใหม่
          </button>
        </div>

        {courts.length === 0 ? (
          <p className="text-center text-[11px] leading-snug text-faint text-pretty">
            ยังไม่มีแมตช์ที่กำลังเล่น — ลูกที่บันทึกตอนนี้จะไม่ผูกกับแมตช์ไหน
            และจะหารเท่ากันเสมอ
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading note={`${log.length} รายการล่าสุด`}>
          ประวัติล่าสุด
        </SectionHeading>

        {log.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-muted">
            ยังไม่ได้บันทึกลูกในรอบนี้
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {log.map((row) => (
              <li
                key={row.id}
                className="flex min-h-11 items-center gap-3 rounded-[13px] bg-inset-soft px-3 py-2"
              >
                <span className="w-11 shrink-0 font-mono text-[11.5px] font-medium text-accent">
                  {row.timeLabel}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                  {row.detail}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-medium text-faint">
                  {row.ordinal}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
