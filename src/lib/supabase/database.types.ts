/**
 * Types for the schema in supabase/migrations/0001_init.sql.
 *
 * Hand-written for now so the scaffold typechecks without a live project.
 * Once a Supabase project exists, regenerate instead of editing:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type MemberRole = "organizer" | "player";

export type ParticipantStatus =
  | "rsvp"
  | "checked_in"
  | "waitlist"
  | "checked_out"
  | "cancelled";

export type MatchStatus = "queued" | "playing" | "done";

export type SplitMode = "buffet" | "per_game" | "even";

interface PlayersRow {
  id: string;
  auth_user_id: string | null;
  line_user_id: string;
  display_name: string;
  avatar_url: string | null;
  skill_level: string | null;
  is_woman: boolean | null;
  created_at: string;
}

interface GuansRow {
  id: string;
  name: string;
  home_venue: string | null;
  default_court_rate: number;
  promptpay_target: string | null;
  owner_player_id: string;
  invite_code: string;
  created_at: string;
}

interface MembershipsRow {
  id: string;
  guan_id: string;
  player_id: string;
  role: MemberRole;
  joined_at: string;
}

interface SessionsRow {
  id: string;
  guan_id: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  court_count: number;
  court_rate: number;
  capacity: number | null;
  split_mode: SplitMode;
  buffet_rate: number | null;
  women_rate: number | null;
  per_game_rate: number | null;
  shuttles_included_per_match: number;
  closed_at: string | null;
  created_at: string;
}

interface SessionParticipantsRow {
  id: string;
  session_id: string;
  player_id: string;
  status: ParticipantStatus;
  waitlist_position: number | null;
  check_in_at: string | null;
  check_out_at: string | null;
  created_at: string;
}

interface MatchesRow {
  id: string;
  session_id: string;
  court_no: number;
  status: MatchStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface MatchPlayersRow {
  match_id: string;
  player_id: string;
}

interface ShuttleLogsRow {
  id: string;
  session_id: string;
  match_id: string | null;
  court_no: number | null;
  count: number;
  unit_price: number;
  logged_at: string;
  logged_by: string | null;
}

interface CostSharesRow {
  id: string;
  session_id: string;
  player_id: string;
  court_share: number;
  shuttle_share: number;
  total: number;
  breakdown: string | null;
  paid: boolean;
  paid_at: string | null;
  computed_at: string;
}

/** Columns with a database default are optional on insert. */
type Insert<Row, Optional extends keyof Row> = Omit<Row, Optional> &
  Partial<Pick<Row, Optional>>;

type Table<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: Insert<Row, Optional>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      players: Table<PlayersRow, "id" | "created_at">;
      guans: Table<GuansRow, "id" | "created_at" | "invite_code" | "default_court_rate">;
      memberships: Table<MembershipsRow, "id" | "joined_at" | "role">;
      sessions: Table<
        SessionsRow,
        | "id"
        | "created_at"
        | "court_count"
        | "court_rate"
        | "split_mode"
        | "shuttles_included_per_match"
      >;
      session_participants: Table<
        SessionParticipantsRow,
        "id" | "created_at" | "status"
      >;
      matches: Table<MatchesRow, "id" | "created_at" | "status">;
      match_players: Table<MatchPlayersRow, never>;
      shuttle_logs: Table<ShuttleLogsRow, "id" | "logged_at" | "count">;
      cost_shares: Table<
        CostSharesRow,
        | "id"
        | "computed_at"
        | "paid"
        | "court_share"
        | "shuttle_share"
        | "total"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      current_player_id: { Args: Record<string, never>; Returns: string };
      is_guan_member: { Args: { target_guan_id: string }; Returns: boolean };
      is_guan_organizer: { Args: { target_guan_id: string }; Returns: boolean };
      session_guan_id: { Args: { target_session_id: string }; Returns: string };
    };
    Enums: {
      member_role: MemberRole;
      participant_status: ParticipantStatus;
      match_status: MatchStatus;
      split_mode: SplitMode;
    };
    CompositeTypes: Record<string, never>;
  };
}
