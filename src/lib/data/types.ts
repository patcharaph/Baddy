/**
 * Shapes the UI reads.
 *
 * Deliberately not the raw database rows: the screens should not know that a
 * player's name arrives through a join on `session_participants`, and the
 * engines should not know about Supabase at all.
 */

import type { MatchStatus, ParticipantStatus, SplitMode } from "@/lib/domain/types";

export interface PlayerView {
  id: string;
  displayName: string;
  skillLevel: string | null;
  avatarUrl: string | null;
  isWoman: boolean;
  /** Deterministic avatar colour, derived from the id — see `avatarColor`. */
  color: string;
}

export interface SessionView {
  id: string;
  guanId: string;
  guanName: string;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  courtCount: number;
  courtTotal: number;
  capacity: number | null;
  splitMode: SplitMode;
  buffetRate: number | null;
  womenRate: number | null;
  perGameRate: number | null;
  shuttlesIncludedPerMatch: number;
  promptpayTarget: string | null;
  closedAt: string | null;
}

/** A match currently on court. */
export interface LiveCourtView {
  matchId: string;
  courtNo: number;
  /** Epoch ms, so the UI can render an elapsed timer without re-parsing. */
  startedAt: number | null;
  playerIds: string[];
}

/** Everything the queue board needs, already shaped for rendering. */
export interface BoardView {
  session: SessionView;
  players: PlayerView[];
  courts: LiveCourtView[];
  /** Checked-in players who are off court, in fairness order. */
  queue: QueueEntryView[];
  waitlist: PlayerView[];
  checkedInCount: number;
  /** Court numbers with no live match — what the queue engine fills. */
  freeCourts: number[];
}

export interface QueueEntryView {
  playerId: string;
  gamesPlayed: number;
  waitedMinutes: number;
}

/** Rows as they come back from the queries below. */
export interface ParticipantRow {
  player_id: string;
  status: ParticipantStatus;
  waitlist_position: number | null;
  check_in_at: string | null;
  check_out_at: string | null;
  players: {
    id: string;
    display_name: string;
    skill_level: string | null;
    avatar_url: string | null;
    is_woman: boolean | null;
  } | null;
}

export interface MatchRow {
  id: string;
  court_no: number;
  status: MatchStatus;
  started_at: string | null;
  ended_at: string | null;
  match_players: { player_id: string }[];
}

export interface ShuttleLogRow {
  match_id: string | null;
  count: number;
  unit_price: number;
}

export interface CostShareRow {
  player_id: string;
  paid: boolean;
}
