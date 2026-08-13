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

type PlayersRow = {
  id: string;
  auth_user_id: string | null;
  line_user_id: string;
  display_name: string;
  avatar_url: string | null;
  skill_level: string | null;
  is_woman: boolean | null;
  created_at: string;
}

type GuansRow = {
  id: string;
  name: string;
  home_venue: string | null;
  default_court_rate: number;
  promptpay_target: string | null;
  owner_player_id: string;
  invite_code: string;
  created_at: string;
}

type MembershipsRow = {
  id: string;
  guan_id: string;
  player_id: string;
  role: MemberRole;
  joined_at: string;
}

type SessionsRow = {
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

type SessionParticipantsRow = {
  id: string;
  session_id: string;
  player_id: string;
  status: ParticipantStatus;
  waitlist_position: number | null;
  check_in_at: string | null;
  check_out_at: string | null;
  created_at: string;
}

type MatchesRow = {
  id: string;
  session_id: string;
  court_no: number;
  status: MatchStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

type MatchPlayersRow = {
  match_id: string;
  player_id: string;
}

type ShuttleLogsRow = {
  id: string;
  session_id: string;
  match_id: string | null;
  court_no: number | null;
  count: number;
  unit_price: number;
  logged_at: string;
  logged_by: string | null;
}

type CostSharesRow = {
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

/** Columns that accept NULL, which therefore need not be supplied. */
type NullableKeys<Row> = {
  [K in keyof Row]-?: null extends Row[K] ? K : never;
}[keyof Row];

/**
 * Insert shape: everything is required except columns with a database default
 * (`Optional`) and columns that accept NULL.
 *
 * Note that the row types below must be `type` aliases, not `interface`.
 * PostgREST checks the schema against `Record<string, unknown>`, and an
 * interface has no implicit index signature, so declaring these as interfaces
 * silently collapses every table to `never`.
 */
type Insert<Row, Optional extends keyof Row> = Omit<
  Row,
  Optional | NullableKeys<Row>
> &
  Partial<Pick<Row, Optional | NullableKeys<Row>>>;

type Table<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: Insert<Row, Optional>;
  Update: Partial<Row>;
  Relationships: [];
};

/**
 * Empty sections must be written this way, not as `Record<string, never>`.
 *
 * PostgREST resolves a table as `Tables & Views`, so a `Record<string, never>`
 * for Views collapses every table to `never` and every insert stops
 * typechecking. This is also the form `supabase gen types` emits.
 */
type Empty = { [_ in never]: never };

export interface Database {
  __InternalSupabase: { PostgrestVersion: "12" };
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
    Views: Empty;
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
    CompositeTypes: Empty;
  };
}
