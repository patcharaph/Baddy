/**
 * Reads. One round trip per table, assembled in `mappers.ts`.
 *
 * PostgREST cannot express "games played per player" or "which court is free"
 * without a view or an RPC, and both would put the fairness rules inside the
 * database where they cannot be unit tested. So the queries stay dumb and the
 * shaping stays in TypeScript.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CostInput } from "@/lib/domain/cost-engine";
import type { Database } from "@/lib/supabase/database.types";

import {
  countCheckedIn,
  toCostParticipants,
  toFinishedMatches,
  toFreeCourts,
  toLiveCourts,
  toPlayerView,
  toQueueCandidates,
  toQueueEntries,
  toRoster,
  toShuttleLogs,
  toShuttleSummary,
  toWaitlist,
} from "./mappers";
import type {
  BoardView,
  CostShareRow,
  MatchRow,
  ParticipantRow,
  PlayerView,
  SessionView,
  ShuttleLogRow,
} from "./types";

type Client = SupabaseClient<Database>;

/** Turns a PostgREST error into something that names the table that failed. */
function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): T {
  if (result.error) {
    throw new Error(`โหลด${what}ไม่สำเร็จ: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`โหลด${what}ไม่สำเร็จ: ไม่พบข้อมูล`);
  }
  return result.data;
}

const SESSION_SELECT = `
  id, guan_id, venue, starts_at, ends_at, court_count, court_rate, capacity,
  split_mode, buffet_rate, women_rate, per_game_rate,
  shuttles_included_per_match, closed_at,
  guans ( name, promptpay_target )
`;

const PARTICIPANT_SELECT = `
  player_id, status, waitlist_position, check_in_at, check_out_at,
  players ( id, display_name, skill_level, avatar_url, is_woman )
`;

const MATCH_SELECT = `
  id, court_no, status, started_at, ended_at,
  match_players ( player_id )
`;

interface SessionQueryRow {
  id: string;
  guan_id: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  court_count: number;
  court_rate: number;
  capacity: number | null;
  split_mode: SessionView["splitMode"];
  buffet_rate: number | null;
  women_rate: number | null;
  per_game_rate: number | null;
  shuttles_included_per_match: number;
  closed_at: string | null;
  guans: { name: string; promptpay_target: string | null } | null;
}

function toSessionView(row: SessionQueryRow): SessionView {
  return {
    id: row.id,
    guanId: row.guan_id,
    guanName: row.guans?.name ?? "ก๊วน",
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    courtCount: row.court_count,
    courtTotal: row.court_rate,
    capacity: row.capacity,
    splitMode: row.split_mode,
    buffetRate: row.buffet_rate,
    womenRate: row.women_rate,
    perGameRate: row.per_game_rate,
    shuttlesIncludedPerMatch: row.shuttles_included_per_match,
    promptpayTarget: row.guans?.promptpay_target ?? null,
    closedAt: row.closed_at,
  };
}

/**
 * The session the app should open on: the most recent one that has not been
 * closed. An organizer opening Baddy mid-evening wants tonight's session, not a
 * picker.
 */
export async function fetchCurrentSession(
  supabase: Client,
): Promise<SessionView | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .is("closed_at", null)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`โหลดรอบเล่นไม่สำเร็จ: ${error.message}`);
  }
  return data ? toSessionView(data as unknown as SessionQueryRow) : null;
}

export async function fetchSessionById(
  supabase: Client,
  sessionId: string,
): Promise<SessionView | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`โหลดรอบเล่นไม่สำเร็จ: ${error.message}`);
  }
  return data ? toSessionView(data as unknown as SessionQueryRow) : null;
}

async function fetchParticipants(
  supabase: Client,
  sessionId: string,
): Promise<ParticipantRow[]> {
  const result = await supabase
    .from("session_participants")
    .select(PARTICIPANT_SELECT)
    .eq("session_id", sessionId);

  return unwrap(result, "รายชื่อผู้เข้าร่วม") as unknown as ParticipantRow[];
}

async function fetchMatches(
  supabase: Client,
  sessionId: string,
): Promise<MatchRow[]> {
  const result = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("session_id", sessionId);

  return unwrap(result, "ข้อมูลแมตช์") as unknown as MatchRow[];
}

async function fetchShuttleLogs(
  supabase: Client,
  sessionId: string,
): Promise<ShuttleLogRow[]> {
  const result = await supabase
    .from("shuttle_logs")
    .select("id, match_id, court_no, logged_at, count, unit_price")
    .eq("session_id", sessionId);

  return unwrap(result, "บันทึกลูกแบด") as ShuttleLogRow[];
}

/**
 * Everything the queue board renders.
 *
 * `now` is passed in rather than read here so a server render and the client
 * that hydrates it agree on the clock.
 */
export async function fetchBoard(
  supabase: Client,
  session: SessionView,
  now: number,
): Promise<BoardView> {
  const [participants, matches, logs] = await Promise.all([
    fetchParticipants(supabase, session.id),
    fetchMatches(supabase, session.id),
    fetchShuttleLogs(supabase, session.id),
  ]);

  const players = participants
    .map(toPlayerView)
    .filter((p): p is PlayerView => p !== null);

  return {
    session,
    players,
    courts: toLiveCourts(matches),
    queue: toQueueEntries(toQueueCandidates(participants, matches), now),
    waitlist: toWaitlist(participants),
    roster: toRoster(participants),
    checkedInCount: countCheckedIn(participants),
    freeCourts: toFreeCourts(session.courtCount, matches),
    shuttles: toShuttleSummary(logs, matches),
  };
}

export interface GuanMembershipView {
  guanId: string;
  name: string;
  homeVenue: string | null;
  role: "organizer" | "player";
  defaultCourtRate: number;
  /**
   * The guan's invite code.
   *
   * Readable by every member, not just the organizer: `guans_select` is
   * membership-wide and Postgres has no column-level RLS, so this is the
   * schema's answer, not a choice made here. The profile only offers the link to
   * organizers — but the honest description of the boundary is "any member can
   * read it", which is why `rotate_invite_code` exists.
   */
  inviteCode: string;
}

/**
 * The guans a player belongs to (PRD FR-9).
 *
 * The profile is the player's, not the guan's — it is the seed of the Phase 2
 * player network — so this is the one read that deliberately crosses the tenant
 * boundary the rest of the app stays inside.
 */
export async function fetchMyGuans(
  supabase: Client,
  playerId: string,
): Promise<GuanMembershipView[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "guan_id, role, guans ( name, home_venue, default_court_rate, invite_code )",
    )
    .eq("player_id", playerId);

  if (error) {
    throw new Error(`โหลดก๊วนของฉันไม่สำเร็จ: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as {
    guan_id: string;
    role: "organizer" | "player";
    guans: {
      name: string;
      home_venue: string | null;
      default_court_rate: number;
      invite_code: string;
    } | null;
  }[];

  return rows.map((r) => ({
    guanId: r.guan_id,
    name: r.guans?.name ?? "ก๊วน",
    homeVenue: r.guans?.home_venue ?? null,
    role: r.role,
    defaultCourtRate: r.guans?.default_court_rate ?? 0,
    inviteCode: r.guans?.invite_code ?? "",
  }));
}

export interface InvitePreview {
  guanId: string;
  name: string;
  homeVenue: string | null;
  memberCount: number;
}

/**
 * The guan behind an invite code (US-1.2).
 *
 * Goes through the `guan_invite_preview` RPC rather than selecting `guans`,
 * because the person holding the invite is by definition not a member yet and
 * `guans_select` would return them nothing. See 0002 for why the policy is not
 * the thing that got loosened.
 *
 * A bad code is `null`, not an error: a mistyped or rotated link is an ordinary
 * thing to land on, and the page has a sentence for it.
 */
export async function fetchInvitePreview(
  supabase: Client,
  code: string,
): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("guan_invite_preview", { code });

  if (error) {
    throw new Error(`เปิดลิงก์เชิญไม่สำเร็จ: ${error.message}`);
  }

  const row = (data ?? [])[0];
  if (!row) return null;

  return {
    guanId: row.guan_id,
    name: row.name,
    homeVenue: row.home_venue,
    memberCount: Number(row.member_count),
  };
}

export interface SessionCostData {
  input: CostInput;
  players: PlayerView[];
  paidPlayerIds: string[];
}

/** Everything the money screen needs to run the cost engine. */
export async function fetchSessionCostData(
  supabase: Client,
  session: SessionView,
): Promise<SessionCostData> {
  const [participants, matches, logs, shares] = await Promise.all([
    fetchParticipants(supabase, session.id),
    fetchMatches(supabase, session.id),
    fetchShuttleLogs(supabase, session.id),
    supabase
      .from("cost_shares")
      .select("player_id, paid")
      .eq("session_id", session.id)
      .then((r) => unwrap(r, "สถานะการจ่ายเงิน") as CostShareRow[]),
  ]);

  return {
    input: {
      splitMode: session.splitMode,
      participants: toCostParticipants(participants),
      courtTotal: session.courtTotal,
      buffetRate: session.buffetRate ?? undefined,
      womenRate: session.womenRate ?? undefined,
      perGameRate: session.perGameRate ?? undefined,
      matches: toFinishedMatches(matches),
      shuttleLogs: toShuttleLogs(logs),
      shuttlesIncludedPerMatch: session.shuttlesIncludedPerMatch,
    },
    players: participants
      .map(toPlayerView)
      .filter((p): p is PlayerView => p !== null),
    paidPlayerIds: shares.filter((s) => s.paid).map((s) => s.player_id),
  };
}
