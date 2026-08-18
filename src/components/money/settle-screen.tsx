"use client";

import { useState, useTransition } from "react";

import { Notice, ProgressBar, ScreenTitle, SectionHeading } from "@/components/ui";
import { setPaid } from "@/lib/data/mutations";
import { baht } from "@/lib/domain/money";

export interface SettleRow {
  playerId: string;
  displayName: string;
  total: number;
  breakdown: string;
}

/**
 * Settle-up (PRD FR-8).
 *
 * Baddy never touches the money — it shows who to pay, how much, and lets
 * someone tick it off. That boundary is deliberate: the moment an app moves baht
 * it acquires a compliance surface a weekly badminton group cannot carry.
 */
export function SettleScreen({
  sessionId,
  rows,
  paidPlayerIds,
  canEdit,
  meId,
  promptpayTarget,
  guanName,
}: {
  /** Null on sample data, where there is nothing to write to. */
  sessionId: string | null;
  rows: SettleRow[];
  paidPlayerIds: string[];
  canEdit: boolean;
  meId: string | null;
  promptpayTarget: string | null;
  guanName: string;
}) {
  const [paid, setPaidIds] = useState<string[]>(paidPlayerIds);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const live = sessionId !== null;
  const mine = rows.find((r) => r.playerId === meId);
  const paidCount = rows.filter((r) => paid.includes(r.playerId)).length;

  const togglePaid = (playerId: string) => {
    const nextPaid = !paid.includes(playerId);
    setPaidIds((current) =>
      nextPaid ? [...current, playerId] : current.filter((id) => id !== playerId),
    );
    setError(null);
    if (!live) return;

    startTransition(async () => {
      try {
        await setPaid(sessionId, playerId, nextPaid);
      } catch (e) {
        setPaidIds((current) =>
          nextPaid
            ? current.filter((id) => id !== playerId)
            : [...current, playerId],
        );
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="เคลียร์เงิน"
        subtitle="ระบบคำนวณและติ๊กสถานะให้ ไม่มีการโอนเงินผ่านระบบ"
      />

      {error ? <Notice>{error}</Notice> : null}

      {/* Deliberately white in both themes: this card gets held up to someone
          else's camera, and a QR only scans reliably dark-on-white. Its greys
          are `black/…` rather than the theme tokens for the same reason — the
          surface under them never changes — so they carry their own AA check:
          /65 reads 7.0:1 and /55 reads 4.8:1 on white. */}
      <section className="flex flex-col items-center gap-3 rounded-[20px] border border-black/10 bg-white p-[18px] shadow-card">
        <span className="text-center font-mono text-[11px] tracking-[0.14em] text-[#0B0C0E]">
          PROMPTPAY · {promptpayTarget ?? guanName}
        </span>

        <div
          className="relative h-[172px] w-[172px] rounded-[10px] bg-[repeating-conic-gradient(#0B0C0E_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]"
          role="img"
          aria-label="ตัวอย่างตำแหน่ง QR พร้อมเพย์"
        >
          <span className="absolute inset-[38%] flex items-center justify-center rounded-md bg-white font-mono text-[11px] font-bold text-[#0B0C0E]">
            QR
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-[26px] font-bold text-[#0B0C0E]">
            {mine ? baht(mine.total) : "—"}
          </span>
          <span className="text-center text-[11.5px] text-black/65 text-pretty">
            {mine ? `ยอดของคุณ · ${mine.breakdown}` : "คุณยังไม่ได้อยู่ในรอบนี้"}
          </span>
        </div>

        <p className="text-center text-[10.5px] leading-snug text-black/55 text-pretty">
          {promptpayTarget
            ? "ยังไม่ได้ผูก QR จริง — สแกนไม่ได้ ใช้ตัวเลขด้านบนโอนเองไปก่อน"
            : "ก๊วนนี้ยังไม่ได้ตั้งพร้อมเพย์ — ถามหัวหน้าก๊วนว่าโอนเข้าบัญชีไหน"}
        </p>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeading
          note={
            <span className="text-accent">
              {paidCount}/{rows.length} จ่ายแล้ว
            </span>
          }
        >
          สถานะการจ่าย
        </SectionHeading>

        <ProgressBar ratio={rows.length === 0 ? 0 : paidCount / rows.length} />

        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const isPaid = paid.includes(row.playerId);
            const isMe = row.playerId === meId;

            return (
              <li
                key={row.playerId}
                className={`flex min-h-[52px] items-center gap-2.5 rounded-[14px] px-3 py-2 ${
                  isMe ? "bg-accent-tint" : "bg-inset-soft"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {row.displayName}
                  {isMe ? <span className="text-muted"> (คุณ)</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[13px] font-medium text-muted">
                  {baht(row.total)}
                </span>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => togglePaid(row.playerId)}
                    aria-pressed={isPaid}
                    className={`min-h-9 min-w-[72px] shrink-0 rounded-[11px] px-2.5 text-[11px] font-semibold transition-[filter] hover:brightness-110 ${
                      isPaid
                        ? "border-none bg-accent-soft text-accent"
                        : "border border-line-strong bg-transparent text-muted"
                    }`}
                  >
                    {isPaid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                  </button>
                ) : (
                  <span
                    className={`w-[66px] shrink-0 text-right text-[11px] font-medium ${
                      isPaid ? "text-accent" : "text-faint"
                    }`}
                  >
                    {isPaid ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
