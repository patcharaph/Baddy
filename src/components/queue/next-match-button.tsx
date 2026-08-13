"use client";

import { useState, useTransition } from "react";

import { Avatar, SkillChip } from "@/components/ui";
import { startMatch } from "@/lib/data/mutations";
import type { PlayerView, QueueEntryView } from "@/lib/data/types";
import {
  buildNextMatches,
  substitutePlayer,
  type ProposedMatch,
  type QueueCandidate,
} from "@/lib/domain/queue-engine";

/**
 * Proposes the next match, then puts it on court (PRD FR-4).
 *
 * The proposal is shown before it is committed so the organizer can still swap
 * someone in — auto-fair by default, manual when they disagree (US-3.2).
 */
export function NextMatchButton({
  sessionId,
  freeCourts,
  queue,
  players,
  now,
  canStart,
}: {
  sessionId: string;
  freeCourts: number[];
  queue: QueueEntryView[];
  players: PlayerView[];
  now: number;
  /** False on sample data, where there is nothing to write to. */
  canStart: boolean;
}) {
  const [proposal, setProposal] = useState<ProposedMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(players.map((p) => [p.id, p]));

  // The board already handed us fairness order; rebuild the candidate shape the
  // engine wants so the same rules decide who goes on.
  const candidates: QueueCandidate[] = queue.map((entry) => ({
    playerId: entry.playerId,
    gamesPlayed: entry.gamesPlayed,
    lastFinishedAt: now - entry.waitedMinutes * 60_000,
    checkedInAt: now - entry.waitedMinutes * 60_000,
  }));

  const proposedIds = new Set(proposal?.playerIds ?? []);
  const benched = queue.filter((e) => !proposedIds.has(e.playerId));

  const propose = () => {
    setError(null);
    const { matches } = buildNextMatches({
      candidates,
      freeCourts,
      now,
    });
    setProposal(matches[0] ?? null);
  };

  const swapIn = (outId: string, inId: string) => {
    if (!proposal) return;
    try {
      setProposal(substitutePlayer([proposal], outId, inId)[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const commit = () => {
    if (!proposal) return;
    setError(null);
    startTransition(async () => {
      try {
        await startMatch(sessionId, proposal.courtNo, proposal.playerIds);
        setProposal(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const tooFewPlayers = queue.length < 4;
  const noFreeCourt = freeCourts.length === 0;
  const blocked = tooFewPlayers || noFreeCourt;

  return (
    <div className="mt-4">
      {error ? (
        <p className="mb-3 rounded-xl bg-pending-bg px-3 py-2 text-[11.5px] text-pending">
          {error}
        </p>
      ) : null}

      {proposal ? (
        <div className="mb-3 rounded-2xl border border-primary bg-me-bg px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              แมตช์ถัดไป · คอร์ท {proposal.courtNo}
            </h3>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="text-[11px] font-semibold text-primary-ink"
            >
              ยกเลิก
            </button>
          </div>

          <ul className="grid grid-cols-2 gap-2">
            {proposal.playerIds.map((id) => {
              const player = byId.get(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-[7px] rounded-xl bg-surface px-2 py-1.5 text-[13px]"
                >
                  <Avatar
                    name={player?.displayName ?? "?"}
                    color={player?.color ?? "#5B6BB0"}
                    size={22}
                  />
                  <span className="truncate">{player?.displayName ?? id}</span>
                  {player?.skillLevel ? (
                    <span className="ml-auto">
                      <SkillChip level={player.skillLevel} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {benched.length > 0 ? (
            <SwapControl
              proposal={proposal}
              benched={benched}
              byId={byId}
              onSwap={swapIn}
            />
          ) : null}

          <button
            type="button"
            onClick={commit}
            disabled={!canStart || pending}
            className="mt-3 w-full rounded-xl bg-navy py-2.5 font-display text-[13.5px] font-semibold text-white disabled:opacity-40"
          >
            {pending
              ? "กำลังเริ่ม…"
              : canStart
                ? `เริ่มเล่น คอร์ท ${proposal.courtNo}`
                : "เริ่มเล่นได้เมื่อเชื่อม Supabase แล้ว"}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={propose}
        disabled={blocked}
        className="w-full rounded-2xl bg-primary p-3.5 font-display text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(255,106,69,.35)] active:translate-y-px disabled:bg-muted disabled:shadow-none"
      >
        {noFreeCourt
          ? "ทุกคอร์ทกำลังเล่นอยู่"
          : tooFewPlayers
            ? `รออีก ${4 - queue.length} คนถึงจะจัดได้`
            : "สุ่มแมตช์ถัดไป → คอร์ทที่ว่าง"}
      </button>
    </div>
  );
}

/** Swap a proposed player for someone still in the queue. */
function SwapControl({
  proposal,
  benched,
  byId,
  onSwap,
}: {
  proposal: ProposedMatch;
  benched: QueueEntryView[];
  byId: Map<string, PlayerView>;
  onSwap: (outId: string, inId: string) => void;
}) {
  const [outId, setOutId] = useState(proposal.playerIds[0]);
  const [inId, setInId] = useState(benched[0]?.playerId ?? "");

  const name = (id: string) => byId.get(id)?.displayName ?? id;

  return (
    <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px]">
      <select
        value={outId}
        onChange={(e) => setOutId(e.target.value)}
        aria-label="ผู้เล่นที่จะเอาออก"
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5"
      >
        {proposal.playerIds.map((id) => (
          <option key={id} value={id}>
            {name(id)}
          </option>
        ))}
      </select>

      <span className="text-muted">↔</span>

      <select
        value={inId}
        onChange={(e) => setInId(e.target.value)}
        aria-label="ผู้เล่นที่จะใส่เข้าไป"
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5"
      >
        {benched.map((e) => (
          <option key={e.playerId} value={e.playerId}>
            {name(e.playerId)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onSwap(outId, inId)}
        className="shrink-0 rounded-lg bg-chip px-2.5 py-1.5 font-semibold text-navy"
      >
        สลับ
      </button>
    </div>
  );
}
