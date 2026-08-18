/**
 * Database rows in, engine input out.
 *
 * Kept pure and separate from the Supabase calls so the shape of the data — who
 * counts as waiting, how many games someone has played, which court is free —
 * can be tested without a database. This is where most of the bugs would live,
 * so this is where the tests point.
 */

import type { CostParticipant, FinishedMatch, ShuttleLog } from "@/lib/domain/cost-engine";
import type { QueueCandidate } from "@/lib/domain/queue-engine";
import { orderByFairness, waitedMs } from "@/lib/domain/queue-engine";

import type {
  LiveCourtView,
  MatchRow,
  ParticipantRow,
  PlayerView,
  QueueEntryView,
  RosterEntryView,
  ShuttleLogRow,
  ShuttleSummaryView,
} from "./types";

const AVATAR_COLORS = [
  "#5B6BB0",
  "#3E9E96",
  "#C77777",
  "#D9954A",
  "#7A6BB0",
  "#4E8AC2",
];

/**
 * Pick an avatar colour from the player id.
 *
 * Derived rather than stored so a player keeps the same colour on every device
 * and in every guan, without a column for it.
 */
export function avatarColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function toPlayerView(row: ParticipantRow): PlayerView | null {
  const p = row.players;
  if (!p) return null;

  return {
    id: p.id,
    displayName: p.display_name,
    skillLevel: p.skill_level,
    avatarUrl: p.avatar_url,
    isWoman: p.is_woman ?? false,
    color: avatarColor(p.id),
  };
}

const toEpoch = (iso: string | null): number | null =>
  iso === null ? null : new Date(iso).getTime();

/** Matches on court right now. */
export function toLiveCourts(matches: readonly MatchRow[]): LiveCourtView[] {
  return matches
    .filter((m) => m.status === "playing")
    .map((m) => ({
      matchId: m.id,
      courtNo: m.court_no,
      startedAt: toEpoch(m.started_at),
      playerIds: m.match_players.map((mp) => mp.player_id),
    }))
    .sort((a, b) => a.courtNo - b.courtNo);
}

/**
 * Courts with nobody on them.
 *
 * A court holding a `queued` match is not free either — the organizer has
 * already arranged it and is about to start it.
 */
export function toFreeCourts(
  courtCount: number,
  matches: readonly MatchRow[],
): number[] {
  const taken = new Set(
    matches
      .filter((m) => m.status === "playing" || m.status === "queued")
      .map((m) => m.court_no),
  );

  const free: number[] = [];
  for (let courtNo = 1; courtNo <= courtCount; courtNo++) {
    if (!taken.has(courtNo)) free.push(courtNo);
  }
  return free;
}

/** Players in finished matches, which is what per-game billing counts. */
export function toFinishedMatches(matches: readonly MatchRow[]): FinishedMatch[] {
  return matches
    .filter((m) => m.status === "done")
    .map((m) => ({
      matchId: m.id,
      playerIds: m.match_players.map((mp) => mp.player_id),
    }));
}

/**
 * Queue engine input: everyone checked in and not currently on a court.
 *
 * A player who checked out has gone home — they keep their share of the bill but
 * they are not waiting for a game.
 */
export function toQueueCandidates(
  participants: readonly ParticipantRow[],
  matches: readonly MatchRow[],
): QueueCandidate[] {
  const onCourt = new Set(
    matches
      .filter((m) => m.status === "playing" || m.status === "queued")
      .flatMap((m) => m.match_players.map((mp) => mp.player_id)),
  );

  const lastFinished = new Map<string, number>();
  for (const match of matches) {
    if (match.status !== "done") continue;
    const endedAt = toEpoch(match.ended_at);
    if (endedAt === null) continue;

    for (const { player_id } of match.match_players) {
      const current = lastFinished.get(player_id);
      if (current === undefined || endedAt > current) {
        lastFinished.set(player_id, endedAt);
      }
    }
  }

  const gamesPlayed = new Map<string, number>();
  for (const match of matches) {
    if (match.status !== "done") continue;
    for (const { player_id } of match.match_players) {
      gamesPlayed.set(player_id, (gamesPlayed.get(player_id) ?? 0) + 1);
    }
  }

  return participants
    .filter((p) => p.status === "checked_in" && !onCourt.has(p.player_id))
    .map((p) => ({
      playerId: p.player_id,
      gamesPlayed: gamesPlayed.get(p.player_id) ?? 0,
      lastFinishedAt: lastFinished.get(p.player_id) ?? null,
      // A checked-in participant always has a check-in time; falling back to the
      // epoch would put a data error at the front of the queue, so fall back to
      // "just arrived" instead.
      checkedInAt: toEpoch(p.check_in_at) ?? Date.now(),
    }));
}

/** The queue as the board renders it: fairness order plus the numbers shown. */
export function toQueueEntries(
  candidates: readonly QueueCandidate[],
  now: number,
): QueueEntryView[] {
  return orderByFairness(candidates, { now }).map((c) => ({
    playerId: c.playerId,
    gamesPlayed: c.gamesPlayed,
    waitedMinutes: Math.round(waitedMs(c, now) / 60_000),
  }));
}

/**
 * Who owes money for this session.
 *
 * Includes players who have gone home (`checked_out`) — leaving early does not
 * clear the bill — and excludes people still on the waitlist or cancelled, who
 * never played.
 */
export function toCostParticipants(
  participants: readonly ParticipantRow[],
): CostParticipant[] {
  return participants
    .filter((p) => p.status === "checked_in" || p.status === "checked_out")
    .map((p) => ({
      playerId: p.player_id,
      displayName: p.players?.display_name ?? "ไม่ทราบชื่อ",
      isWoman: p.players?.is_woman ?? false,
    }));
}

export function toShuttleLogs(rows: readonly ShuttleLogRow[]): ShuttleLog[] {
  return rows.map((r) => ({
    matchId: r.match_id,
    count: r.count,
    unitPrice: r.unit_price,
  }));
}

/** Waitlisted players, in the order they will be promoted. */
export function toWaitlist(participants: readonly ParticipantRow[]): PlayerView[] {
  return participants
    .filter((p) => p.status === "waitlist")
    .sort(
      (a, b) =>
        (a.waitlist_position ?? Number.MAX_SAFE_INTEGER) -
        (b.waitlist_position ?? Number.MAX_SAFE_INTEGER),
    )
    .map(toPlayerView)
    .filter((p): p is PlayerView => p !== null);
}

export function countCheckedIn(participants: readonly ParticipantRow[]): number {
  return participants.filter((p) => p.status === "checked_in").length;
}

/** Status order on the check-in screen: who needs the organizer's attention first. */
const ROSTER_ORDER: Record<ParticipantRow["status"], number> = {
  waitlist: 0,
  rsvp: 1,
  checked_in: 2,
  checked_out: 3,
  cancelled: 4,
};

/**
 * The order the check-in screen lists people in.
 *
 * Waitlisted players come first because they are the ones the organizer has to
 * decide about; cancelled players come last because they are only there so the
 * list does not silently lose someone. Everyone else is in arrival order, so the
 * middle of the list reads like the door.
 *
 * Exported so the sample board can be ordered by the same rule it will be
 * ordered by once it is real data.
 */
export function sortRoster(entries: RosterEntryView[]): RosterEntryView[] {
  return [...entries].sort((a, b) => {
    const byStatus = ROSTER_ORDER[a.status] - ROSTER_ORDER[b.status];
    if (byStatus !== 0) return byStatus;

    if (a.status === "waitlist" && b.status === "waitlist") {
      return (
        (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) -
        (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return (
      (a.checkInAt ?? Number.MAX_SAFE_INTEGER) -
      (b.checkInAt ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

/** The whole session roster, ready for the check-in screen. */
export function toRoster(
  participants: readonly ParticipantRow[],
): RosterEntryView[] {
  const entries = participants
    .map((p) => {
      const player = toPlayerView(p);
      if (!player) return null;

      return {
        player,
        status: p.status,
        checkInAt: toEpoch(p.check_in_at),
        waitlistPosition: p.waitlist_position,
      };
    })
    .filter((e): e is RosterEntryView => e !== null);

  return sortRoster(entries);
}

/** Default shuttle price when a session has not logged one yet (PRD FR-6). */
export const DEFAULT_SHUTTLE_PRICE = 60;

/**
 * The shuttle tally, plus the tail of the log.
 *
 * Match numbers are derived from when matches started rather than stored, so a
 * log line can say "แมตช์ที่ 9" — the number the organizer counted out loud —
 * without a column that could disagree with the match list.
 */
export function toShuttleSummary(
  logs: readonly ShuttleLogRow[],
  matches: readonly MatchRow[],
  limit = 6,
): ShuttleSummaryView {
  const matchNoById = new Map<string, number>();
  matches
    .filter((m) => m.started_at !== null)
    .sort((a, b) => (toEpoch(a.started_at) ?? 0) - (toEpoch(b.started_at) ?? 0))
    .forEach((m, i) => matchNoById.set(m.id, i + 1));

  const sorted = [...logs].sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
  );

  return {
    count: logs.reduce((sum, l) => sum + l.count, 0),
    // The most recently logged price is what the next `+1` should cost.
    unitPrice: sorted[0]?.unit_price ?? DEFAULT_SHUTTLE_PRICE,
    recent: sorted.slice(0, limit).map((l) => ({
      id: l.id,
      loggedAt: new Date(l.logged_at).getTime(),
      courtNo: l.court_no,
      matchNo: l.match_id ? (matchNoById.get(l.match_id) ?? null) : null,
      count: l.count,
    })),
  };
}
