"use client";

import { useState, useTransition } from "react";

import { ghostButton } from "@/components/ui";
import { closeSession, reopenSession } from "@/lib/data/mutations";
import { dayLabel, timeLabel } from "@/lib/format/datetime";

/**
 * Close a round, and undo it (FR-2).
 *
 * Closing is the only action in the app that removes a round from every screen
 * at once — `fetchCurrentSession` reads `closed_at` — so it gets two guards that
 * nothing else here has:
 *
 *   1. A confirm step in place, not a browser dialog. Inside LINE's webview a
 *      modal is a good way to lose the session entirely, and this button sits on
 *      a phone held in one hand at the side of a court.
 *   2. It refuses while a court is still occupied. The server refuses too — that
 *      is the real check — but saying it before the press is what stops the
 *      organizer from wondering which button lied.
 *
 * A closed round keeps this screen, which is where the way back lives once the
 * home screen's undo window has passed.
 */
export function CloseSessionPanel({
  sessionId,
  closedAt,
  liveMatchCount,
  canWrite,
}: {
  sessionId: string;
  /** ISO instant, or null while the round is open. */
  closedAt: string | null;
  liveMatchCount: number;
  canWrite: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<void>) => {
    setError(null);
    if (!canWrite) return;

    startTransition(async () => {
      try {
        await action();
        setConfirming(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const blocked = liveMatchCount > 0;

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[13px] font-bold">
          {closedAt ? "รอบนี้ปิดแล้ว" : "ปิดรอบ"}
        </h2>
        <p className="text-[11.5px] leading-relaxed text-muted text-pretty">
          {closedAt
            ? `ปิดเมื่อ ${dayLabel(Date.parse(closedAt))} ${timeLabel(Date.parse(closedAt))} — รอบนี้ไม่ขึ้นบนหน้าจอไหนแล้ว แต่ยอดเงินและประวัติยังอยู่ครบ`
            : "ปิดแล้วทุกหน้าจะเลิกเปิดที่รอบนี้ และรอบถัดไปจะกลายเป็นรอบปัจจุบันแทน — ตัวเลขทั้งหมดยังอยู่ กดเปิดกลับได้"}
        </p>
      </div>

      {closedAt ? (
        <button
          type="button"
          disabled={!canWrite || pending}
          onClick={() => run(() => reopenSession(sessionId))}
          className={`${ghostButton} disabled:opacity-40`}
        >
          {pending ? "กำลังเปิดกลับ…" : "เปิดรอบนี้กลับมา"}
        </button>
      ) : blocked ? (
        <p className="rounded-[14px] bg-inset px-3 py-2.5 text-[11.5px] leading-relaxed text-muted text-pretty">
          ยังมีแมตช์ที่ยังไม่จบอยู่ {liveMatchCount} แมตช์ — จบให้ครบที่หน้ากระดานคิวก่อน
          ถึงจะปิดรอบได้ ไม่งั้นค่าลูกของแมตช์นั้นจะไม่ถูกคิดให้ใคร
        </p>
      ) : confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canWrite || pending}
            onClick={() => run(() => closeSession(sessionId))}
            className="min-h-11 flex-1 rounded-xl border border-warn-line bg-transparent text-[13px] font-semibold text-warn transition-colors disabled:opacity-40"
          >
            {pending ? "กำลังปิดรอบ…" : "ยืนยันปิดรอบ"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className={`${ghostButton} shrink-0`}
          >
            ยกเลิก
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canWrite}
          onClick={() => setConfirming(true)}
          className={`${ghostButton} disabled:opacity-40`}
        >
          ปิดรอบนี้
        </button>
      )}

      {error ? <p className="text-[11px] text-warn">{error}</p> : null}
    </section>
  );
}
