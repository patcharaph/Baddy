/**
 * Cost engine — PRD FR-7, technical-req §5.
 *
 * Three split modes, one rule each, and every share carries the sentence that
 * explains where it came from. Transparency is a product requirement, not a nicety:
 * if a player can't check the number, the organizer is back to arguing in chat.
 *
 * Computed fresh from source data (participants + matches + shuttle logs) per
 * ADR-3, so the numbers can never drift from what actually happened.
 */

import { baht, splitEvenly } from "./money";
import type { PlayerId, SplitMode } from "./types";

export interface CostParticipant {
  playerId: PlayerId;
  displayName: string;
  /** Picks the women's buffet rate when the guan sets one. */
  isWoman?: boolean;
}

/** A match that finished — the queue engine already produced this. */
export interface FinishedMatch {
  matchId: string;
  playerIds: PlayerId[];
}

export interface ShuttleLog {
  /** Null when the organizer logged shuttles without a match attached. */
  matchId: string | null;
  count: number;
  unitPrice: number;
}

export interface CostInput {
  splitMode: SplitMode;
  /** Everyone who owes money for this session, in display order. */
  participants: readonly CostParticipant[];
  /** Total court cost for the whole session. */
  courtTotal: number;
  buffetRate?: number;
  womenRate?: number;
  perGameRate?: number;
  matches?: readonly FinishedMatch[];
  shuttleLogs?: readonly ShuttleLog[];
  /** Shuttles covered by the per-game rate before the over-quota rule kicks in. */
  shuttlesIncludedPerMatch?: number;
}

export interface CostShare {
  playerId: PlayerId;
  displayName: string;
  courtShare: number;
  shuttleShare: number;
  total: number;
  /** One line the player can read and check, e.g. "5 เกม × ฿25 · สนาม ฿75". */
  breakdown: string;
  detail: {
    gamesPlayed?: number;
    extraShuttles?: number;
    extraShuttleCost?: number;
    rateApplied?: number;
  };
}

export interface CostResult {
  mode: SplitMode;
  shares: CostShare[];
  /** Court money the guan collects through this mode (0 for buffet). */
  courtTotal: number;
  /** Shuttle money collected through this mode (0 for buffet). */
  shuttleTotal: number;
  grandTotal: number;
}

const DEFAULT_SHUTTLES_INCLUDED = 1;

function requireRate(value: number | undefined, label: string): number {
  if (value === undefined || value === null) {
    throw new Error(`cost-engine: โหมดนี้ต้องตั้ง${label}ก่อนถึงจะคำนวณได้`);
  }
  if (value < 0) {
    throw new Error(`cost-engine: ${label}ติดลบไม่ได้ (ได้ ${value})`);
  }
  return value;
}

function requireParticipants(input: CostInput): readonly CostParticipant[] {
  if (input.participants.length === 0) {
    throw new Error("cost-engine: รอบนี้ยังไม่มีผู้เข้าร่วม — หารเงินไม่ได้");
  }
  return input.participants;
}

/**
 * Mode A — buffet (PRD FR-7). One flat rate per head, shuttles already priced in,
 * so no game or shuttle data is needed at all. This is the mode most guans use.
 */
function computeBuffet(input: CostInput): CostResult {
  const participants = requireParticipants(input);
  const rate = requireRate(input.buffetRate, "เรตเหมาจ่าย");
  const womenRate = input.womenRate ?? rate;

  const shares = participants.map<CostShare>((p) => {
    const applied = p.isWoman ? womenRate : rate;
    return {
      playerId: p.playerId,
      displayName: p.displayName,
      courtShare: 0,
      shuttleShare: 0,
      total: applied,
      breakdown: p.isWoman && womenRate !== rate
        ? `เหมาจ่าย เรตหญิง ${baht(applied)} (ค่าลูกรวมในเรตแล้ว)`
        : `เหมาจ่าย ${baht(applied)} (ค่าลูกรวมในเรตแล้ว)`,
      detail: { rateApplied: applied },
    };
  });

  return {
    mode: "buffet",
    shares,
    // Court and shuttle are bundled into the flat rate — showing them separately
    // would imply the player is being charged twice.
    courtTotal: 0,
    shuttleTotal: 0,
    grandTotal: shares.reduce((sum, s) => sum + s.total, 0),
  };
}

/**
 * Over-quota shuttle cost per player, keyed by player id.
 *
 * Each match includes `shuttlesIncludedPerMatch` shuttles in the per-game rate.
 * Anything past that is charged at what the shuttles actually cost and split
 * across only the players of that match — they're the ones who burned them.
 */
function extraShuttleCharges(
  matches: readonly FinishedMatch[],
  logs: readonly ShuttleLog[],
  includedPerMatch: number,
): Map<PlayerId, { cost: number; shuttles: number }> {
  const charges = new Map<PlayerId, { cost: number; shuttles: number }>();

  for (const match of matches) {
    const matchLogs = logs.filter((l) => l.matchId === match.matchId);
    const shuttles = matchLogs.reduce((sum, l) => sum + l.count, 0);
    const over = shuttles - includedPerMatch;
    if (over <= 0 || match.playerIds.length === 0) continue;

    // Average price, so a match logged at two different shuttle prices still
    // charges something defensible.
    const cost = matchLogs.reduce((sum, l) => sum + l.count * l.unitPrice, 0);
    const overCost = Math.round((cost / shuttles) * over);
    const perPlayer = splitEvenly(overCost, match.playerIds.length);

    match.playerIds.forEach((playerId, i) => {
      const current = charges.get(playerId) ?? { cost: 0, shuttles: 0 };
      charges.set(playerId, {
        cost: current.cost + perPlayer[i],
        shuttles: current.shuttles + over,
      });
    });
  }

  return charges;
}

/**
 * Mode B — per game (PRD FR-7). You pay shuttles for the games you actually
 * played, so someone who showed up late and got three games doesn't subsidise
 * someone who played eight. Game counts come free from the queue engine.
 */
function computePerGame(input: CostInput): CostResult {
  const participants = requireParticipants(input);
  const rate = requireRate(input.perGameRate, "เรตค่าลูกต่อเกม");
  const matches = input.matches ?? [];
  const logs = input.shuttleLogs ?? [];
  const included = input.shuttlesIncludedPerMatch ?? DEFAULT_SHUTTLES_INCLUDED;

  const gamesByPlayer = new Map<PlayerId, number>();
  for (const match of matches) {
    for (const playerId of match.playerIds) {
      gamesByPlayer.set(playerId, (gamesByPlayer.get(playerId) ?? 0) + 1);
    }
  }

  const extras = extraShuttleCharges(matches, logs, included);
  const courtShares = splitEvenly(input.courtTotal, participants.length);

  const shares = participants.map<CostShare>((p, i) => {
    const games = gamesByPlayer.get(p.playerId) ?? 0;
    const extra = extras.get(p.playerId) ?? { cost: 0, shuttles: 0 };
    const shuttleShare = games * rate + extra.cost;
    const courtShare = courtShares[i];

    const parts = [`${games} เกม × ${baht(rate)}`];
    if (extra.shuttles > 0) {
      parts.push(`ลูกเกิน ${extra.shuttles} ลูก ${baht(extra.cost)}`);
    }
    parts.push(`สนาม ${baht(courtShare)}`);

    return {
      playerId: p.playerId,
      displayName: p.displayName,
      courtShare,
      shuttleShare,
      total: courtShare + shuttleShare,
      breakdown: parts.join(" · "),
      detail: {
        gamesPlayed: games,
        extraShuttles: extra.shuttles,
        extraShuttleCost: extra.cost,
        rateApplied: rate,
      },
    };
  });

  const shuttleTotal = shares.reduce((sum, s) => sum + s.shuttleShare, 0);

  return {
    mode: "per_game",
    shares,
    courtTotal: input.courtTotal,
    shuttleTotal,
    grandTotal: input.courtTotal + shuttleTotal,
  };
}

/**
 * Mode C — even at the end (PRD FR-7). Everything the session cost, divided by
 * everyone who was there. Needs the real shuttle count, nothing else.
 */
function computeEven(input: CostInput): CostResult {
  const participants = requireParticipants(input);
  const logs = input.shuttleLogs ?? [];

  const shuttles = logs.reduce((sum, l) => sum + l.count, 0);
  const shuttleTotal = logs.reduce((sum, l) => sum + l.count * l.unitPrice, 0);

  const courtShares = splitEvenly(input.courtTotal, participants.length);
  const shuttleShares = splitEvenly(shuttleTotal, participants.length);

  const shares = participants.map<CostShare>((p, i) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    courtShare: courtShares[i],
    shuttleShare: shuttleShares[i],
    total: courtShares[i] + shuttleShares[i],
    breakdown:
      `หารเท่ากัน ${participants.length} คน · สนาม ${baht(courtShares[i])}` +
      ` + ลูก ${shuttles} ลูก ${baht(shuttleShares[i])}`,
    detail: { extraShuttles: 0 },
  }));

  return {
    mode: "even",
    shares,
    courtTotal: input.courtTotal,
    shuttleTotal,
    grandTotal: input.courtTotal + shuttleTotal,
  };
}

/**
 * Work out what each player owes for a session.
 *
 * @throws when the chosen mode is missing a rate the organizer has to set — the
 * message names the missing setting so the UI can point at the right field.
 */
export function computeCostShares(input: CostInput): CostResult {
  switch (input.splitMode) {
    case "buffet":
      return computeBuffet(input);
    case "per_game":
      return computePerGame(input);
    case "even":
      return computeEven(input);
    default: {
      const mode: never = input.splitMode;
      throw new Error(`cost-engine: ไม่รู้จักวิธีหารเงิน "${mode}"`);
    }
  }
}

/** Total already collected, for the "เก็บแล้ว" figure on the money screen. */
export function collectedTotal(
  result: CostResult,
  paidPlayerIds: Iterable<PlayerId>,
): number {
  const paid = new Set(paidPlayerIds);
  return result.shares.reduce(
    (sum, s) => sum + (paid.has(s.playerId) ? s.total : 0),
    0,
  );
}
