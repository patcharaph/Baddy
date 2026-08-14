/**
 * The sample session, expressed in exactly the shapes the Supabase queries
 * return.
 *
 * This is what lets the screens stay ignorant of where their data came from:
 * there is one `BoardView`, and either the database or this file produced it.
 */

import type { SessionCostData } from "@/lib/data/queries";
import type {
  BoardView,
  LiveCourtView,
  PlayerView,
  RosterEntryView,
  SessionView,
  ShuttleSummaryView,
} from "@/lib/data/types";
import { sortRoster, toQueueEntries } from "@/lib/data/mappers";

import {
  CHECKED_IN_COUNT,
  SAMPLE_COURTS,
  SAMPLE_FINISHED_MATCHES,
  SAMPLE_NOW,
  SAMPLE_PAID_PLAYER_IDS,
  SAMPLE_PARTICIPANTS,
  SAMPLE_PLAYERS,
  SAMPLE_QUEUE_CANDIDATES,
  SAMPLE_ROSTER,
  SAMPLE_SESSION,
  SAMPLE_SHUTTLE_ENTRIES,
  SAMPLE_SHUTTLE_LOGS,
} from "./session";

const SAMPLE_SESSION_ID = "sample-session";

const players: PlayerView[] = SAMPLE_PLAYERS.map((p) => ({
  id: p.id,
  displayName: p.name,
  skillLevel: p.skill,
  avatarUrl: null,
  isWoman: p.isWoman ?? false,
  color: p.color,
}));

const session: SessionView = {
  id: SAMPLE_SESSION_ID,
  guanId: "sample-guan",
  guanName: SAMPLE_SESSION.guanName,
  venue: SAMPLE_SESSION.venue,
  // 20:00–23:00, with SAMPLE_NOW sitting at 21:30 — mid-session, which is when
  // every screen here has something to show.
  startsAt: new Date(SAMPLE_NOW - 90 * 60_000).toISOString(),
  endsAt: new Date(SAMPLE_NOW + 90 * 60_000).toISOString(),
  courtCount: SAMPLE_SESSION.courtCount,
  courtTotal: SAMPLE_SESSION.courtTotal,
  capacity: SAMPLE_SESSION.capacity,
  splitMode: SAMPLE_SESSION.splitMode,
  buffetRate: SAMPLE_SESSION.buffetRate,
  womenRate: SAMPLE_SESSION.womenRate,
  perGameRate: SAMPLE_SESSION.perGameRate,
  shuttlesIncludedPerMatch: 1,
  promptpayTarget: SAMPLE_SESSION.promptpayName,
  closedAt: null,
};

const courts: LiveCourtView[] = SAMPLE_COURTS.map((c) => ({
  matchId: `sample-match-${c.courtNo}`,
  courtNo: c.courtNo,
  startedAt: c.startedAt,
  playerIds: [...c.sideA, ...c.sideB],
}));

const byId = new Map(players.map((p) => [p.id, p]));

const roster: RosterEntryView[] = sortRoster(
  SAMPLE_ROSTER.flatMap((entry) => {
    const player = byId.get(entry.playerId);
    return player
      ? [
          {
            player,
            status: entry.status,
            checkInAt: entry.checkInAt,
            waitlistPosition: entry.waitlistPosition,
          },
        ]
      : [];
  }),
);

const shuttles: ShuttleSummaryView = {
  count: SAMPLE_SHUTTLE_ENTRIES.length,
  unitPrice: SAMPLE_SESSION.shuttleUnitPrice,
  recent: [...SAMPLE_SHUTTLE_ENTRIES]
    .reverse()
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      loggedAt: e.loggedAt,
      courtNo: e.courtNo,
      matchNo: e.matchNo,
      count: 1,
    })),
};

export const SAMPLE_BOARD: BoardView = {
  session,
  players,
  courts,
  queue: toQueueEntries(SAMPLE_QUEUE_CANDIDATES, SAMPLE_NOW),
  waitlist: roster
    .filter((e) => e.status === "waitlist")
    .map((e) => e.player),
  roster,
  checkedInCount: CHECKED_IN_COUNT,
  freeCourts: [4],
  shuttles,
};

export const SAMPLE_COST_DATA: SessionCostData = {
  input: {
    splitMode: SAMPLE_SESSION.splitMode,
    participants: SAMPLE_PARTICIPANTS,
    courtTotal: SAMPLE_SESSION.courtTotal,
    buffetRate: SAMPLE_SESSION.buffetRate,
    womenRate: SAMPLE_SESSION.womenRate,
    perGameRate: SAMPLE_SESSION.perGameRate,
    matches: SAMPLE_FINISHED_MATCHES,
    shuttleLogs: SAMPLE_SHUTTLE_LOGS,
    shuttlesIncludedPerMatch: 1,
  },
  players,
  paidPlayerIds: SAMPLE_PAID_PLAYER_IDS,
};

/** The sample board's fixed clock, so timers render identically every time. */
export const SAMPLE_BOARD_NOW = SAMPLE_NOW;

/** The player the sample session treats as "you". */
export const SAMPLE_ME_ID = "champ";
