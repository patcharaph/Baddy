"use client";

import { useMemo, useState, useTransition } from "react";

import { SourceNote } from "@/components/source-note";
import { TopBar } from "@/components/top-bar";
import { Avatar, SectionTitle } from "@/components/ui";
import { setPaid, setSplitMode } from "@/lib/data/mutations";
import type { SourceKind } from "@/lib/data/source";
import type { PlayerView } from "@/lib/data/types";
import {
  collectedTotal,
  computeCostShares,
  type CostInput,
  type CostResult,
} from "@/lib/domain/cost-engine";
import { baht, formatBaht } from "@/lib/domain/money";
import { SPLIT_MODE_LABELS, type SplitMode } from "@/lib/domain/types";

const MODES: SplitMode[] = ["buffet", "per_game", "even"];

function hintFor(mode: SplitMode, input: CostInput): string {
  const shuttles = (input.shuttleLogs ?? []).reduce((n, l) => n + l.count, 0);
  const unitPrice = input.shuttleLogs?.[0]?.unitPrice ?? 0;

  switch (mode) {
    case "buffet":
      return `เรตเดียวจบ ค่าลูกรวมในเรตแล้ว (ช ${input.buffetRate ?? "—"} · ญ ${
        input.womenRate ?? input.buffetRate ?? "—"
      }) — นิยมสุด ตั้งค่าน้อยสุด`;
    case "per_game":
      return `ค่าลูก = จำนวนเกม × ${baht(
        input.perGameRate ?? 0,
      )} + ค่าสนามหาร · ลูกที่เกินโควตาแชร์ใน 4 คนของแมตช์`;
    case "even":
      return `ค่าลูกจริง ${shuttles} ลูก × ${baht(
        unitPrice,
      )} + ค่าสนาม แล้วหารเท่ากันทุกคน`;
  }
}

export function MoneyScreen({
  kind,
  sessionId,
  input,
  players,
  paidPlayerIds,
}: {
  kind: SourceKind;
  sessionId: string | null;
  input: CostInput;
  players: PlayerView[];
  paidPlayerIds: string[];
}) {
  const [mode, setMode] = useState<SplitMode>(input.splitMode);
  const [paid, setPaidIds] = useState<string[]>(paidPlayerIds);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const live = kind === "live" && sessionId !== null;
  const byId = new Map(players.map((p) => [p.id, p]));

  // Recomputed from source on every mode change — no stored totals to go stale.
  const result: CostResult | { error: string } = useMemo(() => {
    try {
      return computeCostShares({ ...input, splitMode: mode });
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [input, mode]);

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

  if ("error" in result) {
    return (
      <>
        <TopBar left="💰 สรุปเงิน" />
        <main className="px-4 pt-4">
          <SourceNote kind={kind} />
          <ModeTabs mode={mode} onChange={changeMode} />
          <p className="rounded-xl bg-pending-bg px-3 py-3 text-[12px] leading-relaxed text-pending">
            {result.error}
          </p>
        </main>
      </>
    );
  }

  const collected = collectedTotal(result, paid);

  return (
    <>
      <TopBar
        left={
          <>
            💰 สรุปเงิน
            <span className="mx-1.5 opacity-50">·</span>
            {result.shares.length} คน
          </>
        }
      />

      <main className="px-4 pt-4">
        <SourceNote kind={kind} />

        {error ? (
          <p className="mb-3 rounded-xl bg-pending-bg px-3 py-2 text-[11.5px] text-pending">
            {error}
          </p>
        ) : null}

        <SectionTitle>วิธีหารเงิน</SectionTitle>
        <ModeTabs mode={mode} onChange={changeMode} />

        <p className="mx-0.5 mb-3 text-[11.5px] leading-relaxed text-muted">
          {hintFor(mode, input)}
        </p>

        <section className="mb-2 rounded-2xl bg-[linear-gradient(135deg,#1B2547,#31407A)] px-4 py-[15px] text-white">
          <div className="text-xs opacity-75">ยอดรวมทั้งรอบ</div>
          <div className="mt-0.5 font-mono text-3xl font-semibold tabular-nums">
            ฿{formatBaht(result.grandTotal)}
          </div>
          <div className="mt-[11px] flex gap-4 border-t border-white/16 pt-[11px] text-xs">
            <Figure label="ค่าสนาม" value={result.courtTotal} />
            <Figure label="ค่าลูก" value={result.shuttleTotal} />
            <Figure label="เก็บแล้ว" value={collected} />
          </div>
        </section>

        <div className="mt-3.5">
          <SectionTitle note={`${result.shares.length} คน`}>ยอดรายคน</SectionTitle>
        </div>

        <ul>
          {result.shares.map((share) => {
            const player = byId.get(share.playerId);
            const isPaid = paid.includes(share.playerId);

            return (
              <li
                key={share.playerId}
                className="mb-2 flex items-center gap-[11px] rounded-[13px] border border-line bg-surface px-3 py-[11px]"
              >
                <Avatar
                  name={share.displayName}
                  color={player?.color ?? "#5B6BB0"}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">
                    {share.displayName}
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
                    isPaid ? "bg-paid-bg text-paid" : "bg-pending-bg text-pending"
                  }`}
                >
                  {isPaid ? "จ่ายแล้ว ✓" : "ค้าง"}
                </button>
              </li>
            );
          })}
        </ul>

        <section className="mt-1.5 rounded-2xl border border-dashed border-line bg-surface p-4 text-center">
          <div
            className="mx-auto my-2 flex h-[120px] w-[120px] items-center justify-center rounded-xl bg-chip text-[11px] text-muted"
            role="img"
            aria-label="ตัวอย่างตำแหน่ง QR พร้อมเพย์"
          >
            QR พร้อมเพย์
          </div>
          <div className="text-[11px] text-muted">
            สแกนโอนแล้วกด “จ่ายแล้ว” ได้เลย
          </div>
        </section>
      </main>
    </>
  );
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: SplitMode;
  onChange: (mode: SplitMode) => void;
}) {
  return (
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
          onClick={() => onChange(m)}
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
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="opacity-90">
      {label}{" "}
      <b className="font-mono font-semibold tabular-nums">{formatBaht(value)}</b>
    </div>
  );
}
