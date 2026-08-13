/**
 * A sample session, so the screens can be built and reviewed before a Supabase
 * project exists. Everything here flows through the real queue and cost engines —
 * the UI never gets pre-computed answers, which is what makes this scaffold worth
 * looking at.
 *
 * Timestamps are fixed rather than derived from `Date.now()`: a clock that ticks
 * between the server render and the client render would show up as a React
 * hydration mismatch.
 */

import type { QueueCandidate } from "@/lib/domain/queue-engine";
import type { CostParticipant, FinishedMatch, ShuttleLog } from "@/lib/domain/cost-engine";
import type { SkillLevel, SplitMode } from "@/lib/domain/types";

/** Fixed "now" for the sample board: 21:30 into a 20:00–23:00 session. */
export const SAMPLE_NOW = Date.UTC(2026, 9, 26, 14, 30, 0);
const MINUTE = 60_000;
const minutesAgo = (m: number) => SAMPLE_NOW - m * MINUTE;

export interface SamplePlayer {
  id: string;
  name: string;
  skill: SkillLevel;
  isWoman?: boolean;
  /** Avatar colour, matching the mockup's palette. */
  color: string;
  isMe?: boolean;
}

const COLORS = ["#5B6BB0", "#3E9E96", "#C77777", "#D9954A", "#7A6BB0", "#4E8AC2"];

function player(
  id: string,
  name: string,
  skill: SkillLevel,
  index: number,
  extra: Partial<SamplePlayer> = {},
): SamplePlayer {
  return { id, name, skill, color: COLORS[index % COLORS.length], ...extra };
}

export const SAMPLE_PLAYERS: SamplePlayer[] = [
  player("champ", "แชมป์", "P", 0, { isMe: true }),
  player("boss", "บอส", "P", 1),
  player("nan", "แนน", "P-", 2, { isWoman: true }),
  player("jo", "โจ้", "P", 3),
  player("ping", "ปิง", "P+", 4),
  player("kong", "ก้อง", "S", 5),
  player("min", "มิ้น", "S", 0, { isWoman: true }),
  player("ae", "เอ", "N", 1),
  player("tee", "ตี้", "S", 2),
  player("pee", "พี", "C", 3),
  player("arm", "อาร์ม", "B", 4),
  player("nok", "นก", "C", 5, { isWoman: true }),
  player("toh", "โต", "B", 0),
  player("fah", "ฟ้า", "P-", 1, { isWoman: true }),
  player("james", "เจมส์", "S", 2),
  player("pook", "ปุ๊ก", "S", 3, { isWoman: true }),
];

export const SAMPLE_PLAYERS_BY_ID = new Map(
  SAMPLE_PLAYERS.map((p) => [p.id, p]),
);

export function samplePlayer(id: string): SamplePlayer {
  const found = SAMPLE_PLAYERS_BY_ID.get(id);
  if (!found) throw new Error(`ไม่พบผู้เล่นตัวอย่าง "${id}"`);
  return found;
}

export const SAMPLE_SESSION = {
  guanName: "Baddy",
  venue: "Smash 44",
  dateLabel: "26 ต.ค.",
  timeLabel: "20:00–23:00",
  courtCount: 3,
  /** Total court cost for the session. */
  courtTotal: 900,
  splitMode: "buffet" as SplitMode,
  buffetRate: 230,
  womenRate: 200,
  perGameRate: 25,
  shuttleUnitPrice: 60,
  promptpayName: "ก๊วน Baddy (Smash 44)",
} as const;

export interface SampleCourt {
  courtNo: number;
  startedAt: number;
  sideA: string[];
  sideB: string[];
}

/** The three courts currently in play on the queue board. */
export const SAMPLE_COURTS: SampleCourt[] = [
  {
    courtNo: 1,
    startedAt: minutesAgo(12.5),
    sideA: ["boss", "nan"],
    sideB: ["jo", "ping"],
  },
  {
    courtNo: 2,
    startedAt: minutesAgo(6.2),
    sideA: ["kong", "min"],
    sideB: ["ae", "tee"],
  },
  {
    courtNo: 3,
    startedAt: minutesAgo(9.8),
    sideA: ["pee", "arm"],
    sideB: ["nok", "toh"],
  },
];

const ON_COURT = new Set(SAMPLE_COURTS.flatMap((c) => [...c.sideA, ...c.sideB]));

/** Everyone checked in and currently off court — the queue engine's input. */
export const SAMPLE_QUEUE_CANDIDATES: QueueCandidate[] = [
  { playerId: "champ", gamesPlayed: 3, lastFinishedAt: minutesAgo(8), checkedInAt: minutesAgo(90) },
  { playerId: "fah", gamesPlayed: 3, lastFinishedAt: minutesAgo(7), checkedInAt: minutesAgo(90) },
  { playerId: "james", gamesPlayed: 4, lastFinishedAt: minutesAgo(5), checkedInAt: minutesAgo(85) },
  { playerId: "pook", gamesPlayed: 4, lastFinishedAt: minutesAgo(4), checkedInAt: minutesAgo(60) },
];

export const CHECKED_IN_COUNT = ON_COURT.size + SAMPLE_QUEUE_CANDIDATES.length;

/**
 * Finished matches so far. Drives the per-game split — the queue engine produces
 * exactly this shape, which is why per-game billing comes almost for free.
 */
export const SAMPLE_FINISHED_MATCHES: FinishedMatch[] = [
  { matchId: "m1", playerIds: ["champ", "boss", "fah", "jo"] },
  { matchId: "m2", playerIds: ["champ", "min", "james", "tee"] },
  { matchId: "m3", playerIds: ["boss", "jo", "pook", "nok"] },
  { matchId: "m4", playerIds: ["champ", "fah", "james", "arm"] },
  { matchId: "m5", playerIds: ["boss", "pook", "kong", "pee"] },
  { matchId: "m6", playerIds: ["jo", "nan", "ae", "toh"] },
  { matchId: "m7", playerIds: ["fah", "james", "ping", "min"] },
  { matchId: "m8", playerIds: ["boss", "pook", "nok", "tee"] },
];

/** Shuttle taps. m1 and m4 went long, so those matches owe over-quota shuttles. */
export const SAMPLE_SHUTTLE_LOGS: ShuttleLog[] = [
  { matchId: "m1", count: 2, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m2", count: 1, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m3", count: 1, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m4", count: 3, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m5", count: 1, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m6", count: 1, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m7", count: 2, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
  { matchId: "m8", count: 1, unitPrice: SAMPLE_SESSION.shuttleUnitPrice },
];

export const SAMPLE_SHUTTLE_COUNT = SAMPLE_SHUTTLE_LOGS.reduce(
  (sum, l) => sum + l.count,
  0,
);

/** Participants in display order — the cost engine bills them in this order. */
export const SAMPLE_PARTICIPANTS: CostParticipant[] = SAMPLE_PLAYERS.map((p) => ({
  playerId: p.id,
  displayName: p.name,
  isWoman: p.isWoman,
}));

/** Who has already transferred. */
export const SAMPLE_PAID_PLAYER_IDS = ["boss", "min", "tee", "arm"];
