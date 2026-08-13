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
  SessionView,
} from "@/lib/data/types";
import { toQueueEntries } from "@/lib/data/mappers";

import {
  CHECKED_IN_COUNT,
  SAMPLE_COURTS,
  SAMPLE_FINISHED_MATCHES,
  SAMPLE_NOW,
  SAMPLE_PAID_PLAYER_IDS,
  SAMPLE_PARTICIPANTS,
  SAMPLE_PLAYERS,
  SAMPLE_QUEUE_CANDIDATES,
  SAMPLE_SESSION,
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
  startsAt: new Date(SAMPLE_NOW).toISOString(),
  endsAt: null,
  courtCount: SAMPLE_SESSION.courtCount,
  courtTotal: SAMPLE_SESSION.courtTotal,
  capacity: null,
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

export const SAMPLE_BOARD: BoardView = {
  session,
  players,
  courts,
  queue: toQueueEntries(SAMPLE_QUEUE_CANDIDATES, SAMPLE_NOW),
  waitlist: [],
  checkedInCount: CHECKED_IN_COUNT,
  freeCourts: [4],
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
