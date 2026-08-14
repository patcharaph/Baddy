"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  Avatar,
  Figure,
  Notice,
  primaryButton,
  ScreenTitle,
  SectionHeading,
} from "@/components/ui";
import { setPaid, setSplitMode } from "@/lib/data/mutations";
import type { PlayerView } from "@/lib/data/types";
import {
  collectedTotal,
  tryComputeCostShares,
  type CostInput,
  type CostResult,
} from "@/lib/domain/cost-engine";
import { baht } from "@/lib/domain/money";
import { SPLIT_MODE_LABELS, type SplitMode } from "@/lib/domain/types";

const MODES: SplitMode[] = ["buffet", "per_game", "even"];

/**
 * The sentence under the mode tabs.
 *
 * Every mode is somebody's idea of fair, so the note says which trade the mode
 * is making rather than just naming it — that is the argument the organizer is
 * about to have with the group chat, pre-answered.
 */
function noteFor(mode: SplitMode, input: CostInput, shuttles: number): string {
  switch (mode) {
    case "buffet":
      return "เรตเดียวต่อคน ค่าลูกรวมในเรตแล้ว — โหมดที่ก๊วนใช้มากสุดและตั้งค่าเร็วสุด";
    case "per_game":
      return `ค่าลูกคิดตามจำนวนเกมที่ลงจริง (นับจาก queue engine) + ค่าสนามหารเท่ากัน · กฎ ${
        input.shuttlesIncludedPerMatch ?? 1
      } เกม = 1 ลูก ลูกเกินหารใน 4 คนของแมตช์`;
    case "even":
      return `หารเท่ากันตอนเลิก: ค่าลูกที่ใช้จริง ${shuttles} ลูก รวมค่าสนาม ÷ จำนวนคน (เศษกระจายให้คนแรก ๆ คนละ 1 บาท)`;
  }
}

/** The two figures that explain where the grand total came from, per mode. */
function figuresFor(
  mode: SplitMode,
  input: CostInput,
  result: CostResult,
  shuttles: number,
): [{ label: string; value: string }, { label: string; value: string }] {
  const heads = result.shares.length;

  switch (mode) {
    case "buffet":
      return [
        {
          label: "เรตต่อคน (ช/ญ)",
          value: `${input.buffetRate ?? "—"} / ${
            input.womenRate ?? input.buffetRate ?? "—"
          } ฿`,
        },
        { label: "คนที่ร่วมรอบนี้", value: `${heads} คน` },
      ];
    case "per_game":
      return [
        { label: `ค่าสนาม (หาร ${heads} คน)`, value: baht(result.courtTotal) },
        { label: "ค่าลูกตามเกมที่ลง", value: baht(result.shuttleTotal) },
      ];
    case "even":
      return [
        { label: "ค่าสนาม", value: baht(result.courtTotal) },
        { label: `ค่าลูก ${shuttles} ลูก`, value: baht(result.shuttleTotal) },
      ];
  }
}

/**
 * Cost split (PRD FR-7, US-4.2).
 *
 * Every total on this screen is recomputed from source on each render — the mode
 * is a setting, not a stored answer — so switching modes can never leave a stale
 * number behind. And every row carries the sentence that explains it, because a
 * player who cannot check the number is a player arguing in the group chat.
 */
export function MoneyScreen({
  sessionId,
  input,
  players,
  paidPlayerIds,
  canEdit,
  meId,
}: {
  /** Null on sample data, where there is nothing to write to. */
  sessionId: string | null;
  input: CostInput;
  players: PlayerView[];
  paidPlayerIds: string[];
  canEdit: boolean;
  meId: string | null;
}) {
  const [mode, setMode] = useState<SplitMode>(input.splitMode);
  const [paid, setPaidIds] = useState<string[]>(paidPlayerIds);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const live = sessionId !== null;
  const byId = new Map(players.map((p) => [p.id, p]));
  const shuttles = (input.shuttleLogs ?? []).reduce((n, l) => n + l.count, 0);

  const computed = useMemo(
    () => tryComputeCostShares({ ...input, splitMode: mode }),
    [input, mode],
  );

  /**
   * Switching mode updates the screen immediately and persists in the
   * background: the organizer is usually mid-conversation about which mode to
   * use, and a spinner between taps makes that conversation harder.
   */
  const changeMode = (next: SplitMode) => {
    setMode(next);
    setError(null);
    if (!live) return;

    startTransition(async () => {
      try {
        await setSplitMode(sessionId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

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
        // Put the tick back where it was — a payment status that silently
        // disagrees with the database is worse than an error message.
        setPaidIds((current) =>
          nextPaid
            ? current.filter((id) => id !== playerId)
            : [...current, playerId],
        );
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const title = canEdit ? "หารเงิน" : "ยอดของฉัน";
  const subtitle = canEdit
    ? "เลือกวิธีหารของรอบนี้ — ผู้เล่นกดดูที่มาของยอดได้ทุกคน"
    : "หัวหน้าก๊วนเลือกวิธีหารไว้แล้ว — คุณตรวจที่มาของยอดได้ทุกบรรทัด";

  const modeControl = canEdit ? (
    <div
      role="tablist"
      aria-label="วิธีหารเงิน"
      className="flex gap-1.5 rounded-[14px] bg-inset p-1"
    >
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => changeMode(m)}
          className={`min-h-[42px] flex-1 rounded-[11px] text-[12.5px] font-semibold transition-colors ${
            mode === m ? "bg-accent-fill text-on-accent" : "bg-transparent text-muted"
          }`}
        >
          {SPLIT_MODE_LABELS[m]}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-line-soft bg-inset px-3.5 py-3">
      <span className="text-[11.5px] text-muted">วิธีหารรอบนี้</span>
      <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
        {SPLIT_MODE_LABELS[mode]}
      </span>
      <span className="flex-1" />
      <span className="font-mono text-[10.5px] text-ghost">READ ONLY</span>
    </div>
  );

  if (!computed.ok) {
    return (
      <main className="flex flex-col gap-3.5 px-4 pt-[18px] pb-2">
        <ScreenTitle title={title} subtitle={subtitle} />
        {modeControl}
        <Notice>{computed.error}</Notice>
      </main>
    );
  }

  const result = computed.result;
  const [figureA, figureB] = figuresFor(mode, input, result, shuttles);
  const paidCount = result.shares.filter((s) => paid.includes(s.playerId)).length;
  const collected = collectedTotal(result, paid);

  return (
    <main className="flex flex-col gap-3.5 px-4 pt-[18px] pb-2">
      <ScreenTitle title={title} subtitle={subtitle} />

      {modeControl}
      {error ? <Notice>{error}</Notice> : null}

      <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 shadow-card">
        <p className="text-xs leading-relaxed text-muted text-pretty">
          {noteFor(mode, input, shuttles)}
          {canEdit
            ? ""
            : " · หัวหน้าก๊วนเลือกวิธีนี้ไว้ — คุณดูที่มาของยอดได้อย่างเดียว"}
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <Figure label={figureA.label} value={figureA.value} />
          <Figure label={figureB.label} value={figureB.value} />
        </div>

        <div className="flex items-baseline justify-between border-t border-dashed border-line pt-3">
          <span className="text-[13.5px] font-semibold">รวมทั้งรอบ</span>
          <span className="font-mono text-[22px] font-bold text-accent">
            {baht(result.grandTotal)}
          </span>
        </div>

        <div className="flex items-baseline justify-between text-[11.5px] text-muted">
          <span>เก็บแล้ว</span>
          <span className="font-mono text-ink">{baht(collected)}</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading note={`${paidCount}/${result.shares.length} จ่ายแล้ว`}>
          ยอดต่อคน
        </SectionHeading>

        <ul className="flex flex-col gap-2">
          {result.shares.map((share) => {
            const player = byId.get(share.playerId);
            const isPaid = paid.includes(share.playerId);
            const isMe = share.playerId === meId;

            return (
              <li
                key={share.playerId}
                className={`flex min-h-[58px] items-center gap-2.5 rounded-[16px] border px-3 py-2.5 ${
                  isMe
                    ? "border-accent-line bg-accent-tint"
                    : "border-line-soft bg-inset-soft"
                }`}
              >
                <Avatar name={share.displayName} active={isPaid || isMe} />

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium">
                    {share.displayName}
                    {isMe ? <span className="text-muted"> (คุณ)</span> : null}
                    {player?.skillLevel ? (
                      <span className="text-ghost"> · {player.skillLevel}</span>
                    ) : null}
                  </span>
                  {/* The transparency requirement: every total says where it came from. */}
                  <span className="truncate font-mono text-[10.5px] text-faint">
                    {share.breakdown}
                  </span>
                </span>

                <span className="shrink-0 font-mono text-[15px] font-bold">
                  {baht(share.total)}
                </span>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => togglePaid(share.playerId)}
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

      <Link href="/settle" className={`${primaryButton} mt-1 min-h-[52px]`}>
        {canEdit ? "เปิด QR เคลียร์เงิน" : "เปิด QR จ่ายเงิน"}
      </Link>
    </main>
  );
}
