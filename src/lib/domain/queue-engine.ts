/**
 * Queue engine — PRD FR-4, technical-req §4.
 *
 * Picks who goes on court next so nobody has to remember whose turn it is. Pure
 * functions over plain data: no Supabase, no React, so the fairness rules can be
 * unit-tested and argued about on their own.
 */

import type { PlayerId } from "./types";

export interface QueueCandidate {
  playerId: PlayerId;
  /** Matches this player has finished in this session. */
  gamesPlayed: number;
  /** Epoch ms when their last match ended; null if they haven't played yet. */
  lastFinishedAt: number | null;
  /** Epoch ms of check-in — the wait clock before their first game. */
  checkedInAt: number;
}

export interface ProposedMatch {
  courtNo: number;
  playerIds: PlayerId[];
}

export interface FairnessOptions {
  /** Epoch ms to measure waiting against. */
  now: number;
  /**
   * Waits within this many ms count as equal so that games-played decides.
   *
   * Without a bucket the wait timestamps are effectively unique and rule (2) —
   * "fewer games goes first" — would never fire. 60s is the granularity a guan
   * actually perceives as "we've been waiting the same amount of time".
   * Set to 0 for the strict wait-time-only ordering.
   */
  waitBucketMs?: number;
}

export const DEFAULT_WAIT_BUCKET_MS = 60_000;
export const DEFAULT_PLAYERS_PER_MATCH = 4;

/** How long this player has been off court. */
export function waitedMs(candidate: QueueCandidate, now: number): number {
  const since = candidate.lastFinishedAt ?? candidate.checkedInAt;
  return Math.max(0, now - since);
}

/**
 * Fairness order: longest wait first, then fewest games, then player id.
 *
 * The player id tiebreak exists so the same inputs always produce the same queue —
 * an organizer refreshing the board must not see the order shuffle.
 */
export function orderByFairness(
  candidates: readonly QueueCandidate[],
  { now, waitBucketMs = DEFAULT_WAIT_BUCKET_MS }: FairnessOptions,
): QueueCandidate[] {
  const bucketOf = (c: QueueCandidate) => {
    const waited = waitedMs(c, now);
    return waitBucketMs > 0 ? Math.floor(waited / waitBucketMs) : waited;
  };

  return [...candidates].sort((a, b) => {
    const byWait = bucketOf(b) - bucketOf(a);
    if (byWait !== 0) return byWait;

    const byGames = a.gamesPlayed - b.gamesPlayed;
    if (byGames !== 0) return byGames;

    return a.playerId.localeCompare(b.playerId);
  });
}

export interface BuildNextMatchesInput extends FairnessOptions {
  /** Checked-in players who are not currently on a court. */
  candidates: readonly QueueCandidate[];
  /** Court numbers with nobody on them, in the order they should be filled. */
  freeCourts: readonly number[];
  playersPerMatch?: number;
  /**
   * Players the organizer wants on court next regardless of fairness — the manual
   * side of FR-4. They keep fairness order among themselves.
   */
  pinnedPlayerIds?: readonly PlayerId[];
}

export interface BuildNextMatchesResult {
  matches: ProposedMatch[];
  /** Everyone left over, in fairness order — this is the queue the board shows. */
  waiting: QueueCandidate[];
}

/**
 * Fill every free court with the players who have waited longest.
 *
 * A court is only filled if a full match's worth of players is available; three
 * people standing around is not a game, and half-filling courts would strand them
 * at the front of the queue.
 */
export function buildNextMatches({
  candidates,
  freeCourts,
  playersPerMatch = DEFAULT_PLAYERS_PER_MATCH,
  pinnedPlayerIds = [],
  now,
  waitBucketMs,
}: BuildNextMatchesInput): BuildNextMatchesResult {
  if (playersPerMatch <= 0) {
    throw new Error(
      `buildNextMatches: จำนวนผู้เล่นต่อแมตช์ต้องมากกว่า 0 (ได้ ${playersPerMatch})`,
    );
  }

  const ordered = orderByFairness(candidates, { now, waitBucketMs });
  const pinned = new Set(pinnedPlayerIds);
  const queue = [
    ...ordered.filter((c) => pinned.has(c.playerId)),
    ...ordered.filter((c) => !pinned.has(c.playerId)),
  ];

  const matches: ProposedMatch[] = [];
  let cursor = 0;

  for (const courtNo of freeCourts) {
    if (queue.length - cursor < playersPerMatch) break;
    const group = queue.slice(cursor, cursor + playersPerMatch);
    cursor += playersPerMatch;
    matches.push({ courtNo, playerIds: group.map((c) => c.playerId) });
  }

  return { matches, waiting: queue.slice(cursor) };
}

function locate(
  matches: readonly ProposedMatch[],
  playerId: PlayerId,
): { matchIndex: number; slot: number } | null {
  for (let matchIndex = 0; matchIndex < matches.length; matchIndex++) {
    const slot = matches[matchIndex].playerIds.indexOf(playerId);
    if (slot !== -1) return { matchIndex, slot };
  }
  return null;
}

function clone(matches: readonly ProposedMatch[]): ProposedMatch[] {
  return matches.map((m) => ({ ...m, playerIds: [...m.playerIds] }));
}

/**
 * Swap two players who are both in proposed matches — the organizer rearranging
 * courts by hand before hitting start (US-3.2).
 */
export function swapPlayers(
  matches: readonly ProposedMatch[],
  playerA: PlayerId,
  playerB: PlayerId,
): ProposedMatch[] {
  const a = locate(matches, playerA);
  const b = locate(matches, playerB);

  if (!a) throw new Error(`swapPlayers: ไม่พบผู้เล่น ${playerA} ในแมตช์ที่จัดไว้`);
  if (!b) throw new Error(`swapPlayers: ไม่พบผู้เล่น ${playerB} ในแมตช์ที่จัดไว้`);

  const next = clone(matches);
  next[a.matchIndex].playerIds[a.slot] = playerB;
  next[b.matchIndex].playerIds[b.slot] = playerA;
  return next;
}

/** Pull someone off a proposed match and put a waiting player in their place. */
export function substitutePlayer(
  matches: readonly ProposedMatch[],
  outPlayerId: PlayerId,
  inPlayerId: PlayerId,
): ProposedMatch[] {
  const out = locate(matches, outPlayerId);
  if (!out) {
    throw new Error(`substitutePlayer: ไม่พบผู้เล่น ${outPlayerId} ในแมตช์ที่จัดไว้`);
  }
  if (locate(matches, inPlayerId)) {
    throw new Error(
      `substitutePlayer: ผู้เล่น ${inPlayerId} อยู่ในแมตช์อื่นอยู่แล้ว — สลับตัวแทน`,
    );
  }

  const next = clone(matches);
  next[out.matchIndex].playerIds[out.slot] = inPlayerId;
  return next;
}
