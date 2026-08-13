"use client";

import { useMemo, useState } from "react";

import { TopBar } from "@/components/top-bar";
import { Avatar, SectionTitle } from "@/components/ui";
import {
  collectedTotal,
  computeCostShares,
  type CostResult,
} from "@/lib/domain/cost-engine";
import { baht, formatBaht } from "@/lib/domain/money";
import { SPLIT_MODE_LABELS, type SplitMode } from "@/lib/domain/types";
import {
  SAMPLE_FINISHED_MATCHES,
  SAMPLE_PAID_PLAYER_IDS,
  SAMPLE_PARTICIPANTS,
  SAMPLE_PLAYERS_BY_ID,
  SAMPLE_SESSION,
  SAMPLE_SHUTTLE_COUNT,
  SAMPLE_SHUTTLE_LOGS,
} from "@/lib/sample/session";

const MODES: SplitMode[] = ["buffet", "per_game", "even"];

const HINTS: Record<SplitMode, string> = {
  buffet: `เรตเดียวจบ ค่าลูกรวมในเรตแล้ว (ช ${SAMPLE_SESSION.buffetRate} · ญ ${SAMPLE_SESSION.womenRate}) — นิยมสุด ตั้งค่าน้อยสุด`,
  per_game: `ค่าลูก = จำนวนเกม × ${baht(SAMPLE_SESSION.perGameRate)} + ค่าสนามหาร · ลูกที่เกินโควตาแชร์ใน 4 คนของแมตช์`,
  even: `ค่าลูกจริง ${SAMPLE_SHUTTLE_COUNT} ลูก × ${baht(SAMPLE_SESSION.shuttleUnitPrice)} + ค่าสนาม แล้วหารเท่ากันทุกคน`,
};

export function MoneyScreen() {
  const [mode, setMode] = useState<SplitMode>(SAMPLE_SESSION.splitMode);
  const [paid, setPaid] = useState<string[]>(SAMPLE_PAID_PLAYER_IDS);

  // Recomputed from source on every mode change — no stored totals to go stale.
  const result: CostResult = useMemo(
    () =>
      computeCostShares({
        splitMode: mode,
        participants: SAMPLE_PARTICIPANTS,
        courtTotal: SAMPLE_SESSION.courtTotal,
        buffetRate: SAMPLE_SESSION.buffetRate,
        womenRate: SAMPLE_SESSION.womenRate,
        perGameRate: SAMPLE_SESSION.perGameRate,
        matches: SAMPLE_FINISHED_MATCHES,
        shuttleLogs: SAMPLE_SHUTTLE_LOGS,
      }),
    [mode],
  );

  const collected = collectedTotal(result, paid);

  const togglePaid = (playerId: string) =>
    setPaid((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId],
    );

  return (
    <>
      <TopBar
        left={
          <>
            💰 สรุปเงิน
            <span className="mx-1.5 opacity-50">·</span>
            {SAMPLE_SESSION.venue} · {result.shares.length} คน
          </>
        }
        right={SAMPLE_SESSION.dateLabel}
      />

      <main className="px-4 pt-4">
        <SectionTitle>วิธีหารเงิน</SectionTitle>

        <div
          role="tablist"
          aria-label="วิธีหารเงิน"
          className="mb-3.5 flex gap-1.5 rounded-xl bg-chip p-1"
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-[9px] px-1 py-2 text-[11.5px] ${
                mode === m
                  ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgba(23,33,62,.12)]"
                  : "font-medium text-muted"
              }`}
            >
              {SPLIT_MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <p className="mx-0.5 mb-3 text-[11.5px] leading-relaxed text-muted">
          {HINTS[mode]}
        </p>

        <section className="mb-2 rounded-2xl bg-[linear-gradient(135deg,#1B2547,#31407A)] px-4 py-[15px] text-white">
          <div className="text-xs opacity-75">ยอดรวมทั้งรอบ</div>
          <div className="mt-0.5 font-mono text-3xl font-semibold tabular-nums">
            ฿{formatBaht(result.grandTotal)}
          </div>
          <div className="mt-[11px] flex gap-4 border-t border-white/16 pt-[11px] text-xs">
            <div className="opacity-90">
              ค่าสนาม{" "}
              <b className="font-mono font-semibold tabular-nums">
                {formatBaht(result.courtTotal)}
              </b>
            </div>
            <div className="opacity-90">
              ค่าลูก{" "}
              <b className="font-mono font-semibold tabular-nums">
                {formatBaht(result.shuttleTotal)}
              </b>
            </div>
            <div className="opacity-90">
              เก็บแล้ว{" "}
              <b className="font-mono font-semibold tabular-nums">
                {formatBaht(collected)}
              </b>
            </div>
          </div>
        </section>

        <div className="mt-3.5">
          <SectionTitle note={`${result.shares.length} คน`}>
            ยอดรายคน
          </SectionTitle>
        </div>

        <ul>
          {result.shares.map((share) => {
            const player = SAMPLE_PLAYERS_BY_ID.get(share.playerId);
            const isPaid = paid.includes(share.playerId);

            return (
              <li
                key={share.playerId}
                className={`mb-2 flex items-center gap-[11px] rounded-[13px] border px-3 py-[11px] ${
                  player?.isMe ? "border-primary bg-me-bg" : "border-line bg-surface"
                }`}
              >
                <Avatar
                  name={share.displayName}
                  color={player?.color ?? "#5B6BB0"}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">
                    {player?.isMe
                      ? `${share.displayName} (คุณ)`
                      : share.displayName}
                  </div>
                  {/* The transparency requirement: every total says where it came from. */}
                  <div className="mt-0.5 text-[11px] text-muted">
                    {share.breakdown}
                  </div>
                </div>
                <div className="text-right font-mono text-[15px] font-semibold tabular-nums">
                  {baht(share.total)}
                </div>
                <button
                  type="button"
                  onClick={() => togglePaid(share.playerId)}
                  aria-pressed={isPaid}
                  className={`ml-0.5 shrink-0 rounded-lg px-2.5 py-[5px] text-[11px] font-semibold whitespace-nowrap ${
                    isPaid
                      ? "bg-paid-bg text-paid"
                      : "bg-pending-bg text-pending"
                  }`}
                >
                  {isPaid ? "จ่ายแล้ว ✓" : "ค้าง"}
                </button>
              </li>
            );
          })}
        </ul>

        <section className="mt-1.5 rounded-2xl border border-dashed border-line bg-surface p-4 text-center">
          <PromptPayPlaceholder />
          <div className="mt-1 font-display text-[13px] font-semibold">
            พร้อมเพย์ · {SAMPLE_SESSION.promptpayName}
          </div>
          <div className="text-[11px] text-muted">
            สแกนโอนแล้วกด “จ่ายแล้ว” ได้เลย
          </div>
        </section>
      </main>
    </>
  );
}

/**
 * Stand-in for the real PromptPay QR.
 *
 * Generating one needs the EMVCo payload spec and the guan's PromptPay target —
 * still flagged as NEEDS VALIDATION in the technical requirements, so it is
 * deliberately not faked with a scannable-looking code.
 */
function PromptPayPlaceholder() {
  return (
    <div
      className="mx-auto my-2 flex h-[120px] w-[120px] items-center justify-center rounded-xl bg-chip text-[11px] text-muted"
      role="img"
      aria-label="ตัวอย่างตำแหน่ง QR พร้อมเพย์"
    >
      QR พร้อมเพย์
    </div>
  );
}
