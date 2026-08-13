-- Baddy — initial schema
-- Mirrors docs/line-guan-badminton-technical-req.md §3.
--
-- Two ideas drive the shape of this schema:
--   1. A player is an entity of their own, not a row inside a guan (ADR-2). The
--      profile is portable across guans, which is what the Phase 2+ player network
--      is built on, and it means no big migration later.
--   2. Money is derived, never authored (ADR-3). cost_shares only caches the
--      result plus the paid flag; the truth lives in session_participants,
--      matches and shuttle_logs, so a disputed total can always be traced back.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type member_role as enum ('organizer', 'player');

create type participant_status as enum (
  'rsvp',
  'checked_in',
  'waitlist',
  'checked_out',
  'cancelled'
);

create type match_status as enum ('queued', 'playing', 'done');

-- The three modes Thai guans actually use (PRD FR-7). A per-minute mode was
-- deliberately dropped: field data says guans do not split that way.
create type split_mode as enum ('buffet', 'per_game', 'even');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Portable player profile. Keyed by LINE userId so a player who joins a second
-- guan is recognised as the same person.
create table players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  line_user_id text not null unique,
  display_name text not null,
  avatar_url text,
  skill_level text,
  -- Only read to pick the women's buffet rate; nullable because it is optional.
  is_woman boolean,
  created_at timestamptz not null default now()
);

-- A guan is the tenant boundary. Everything below hangs off it.
create table guans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  home_venue text,
  default_court_rate integer not null default 0 check (default_court_rate >= 0),
  promptpay_target text,
  owner_player_id uuid not null references players (id) on delete restrict,
  invite_code text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  guan_id uuid not null references guans (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  role member_role not null default 'player',
  joined_at timestamptz not null default now(),
  unique (guan_id, player_id)
);

create index memberships_player_idx on memberships (player_id);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  guan_id uuid not null references guans (id) on delete cascade,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  court_count integer not null default 1 check (court_count > 0),
  -- Total court cost for the session, not a per-hour rate: it is what gets split.
  court_rate integer not null default 0 check (court_rate >= 0),
  capacity integer check (capacity > 0),
  split_mode split_mode not null default 'buffet',
  buffet_rate integer check (buffet_rate >= 0),
  women_rate integer check (women_rate >= 0),
  per_game_rate integer check (per_game_rate >= 0),
  shuttles_included_per_match integer not null default 1
    check (shuttles_included_per_match >= 0),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index sessions_guan_starts_idx on sessions (guan_id, starts_at desc);

create table session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  status participant_status not null default 'rsvp',
  -- Position in the waitlist; null unless status = 'waitlist'.
  waitlist_position integer,
  check_in_at timestamptz,
  check_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, player_id),
  constraint check_out_after_check_in
    check (check_out_at is null or check_in_at is null or check_out_at >= check_in_at)
);

create index session_participants_session_idx
  on session_participants (session_id, status);

create table matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  court_no integer not null check (court_no > 0),
  status match_status not null default 'queued',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index matches_session_status_idx on matches (session_id, status);

-- One court cannot host two live matches. This is the invariant the queue engine
-- assumes when it asks for "free courts".
create unique index matches_one_live_per_court
  on matches (session_id, court_no)
  where status in ('queued', 'playing');

create table match_players (
  match_id uuid not null references matches (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  primary key (match_id, player_id)
);

create index match_players_player_idx on match_players (player_id);

-- Every +1 the organizer taps. match_id lets the per-game over-quota rule charge
-- the extra shuttles to the four who burned them.
create table shuttle_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  match_id uuid references matches (id) on delete set null,
  court_no integer,
  count integer not null default 1 check (count > 0),
  unit_price integer not null check (unit_price >= 0),
  logged_at timestamptz not null default now(),
  logged_by uuid references players (id) on delete set null
);

create index shuttle_logs_session_idx on shuttle_logs (session_id);
create index shuttle_logs_match_idx on shuttle_logs (match_id);

-- Snapshot of the cost engine's output at settle-up time. Recomputable from
-- source at any point; `paid` is the only column that is authored here.
create table cost_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  court_share integer not null default 0,
  shuttle_share integer not null default 0,
  total integer not null default 0,
  -- The sentence shown to the player so they can check the number themselves.
  breakdown text,
  paid boolean not null default false,
  paid_at timestamptz,
  computed_at timestamptz not null default now(),
  unique (session_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER so a policy on memberships can ask "is this person a member?"
-- without re-entering memberships' own RLS and recursing.
-- ---------------------------------------------------------------------------

create or replace function current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from players where auth_user_id = auth.uid();
$$;

create or replace function is_guan_member(target_guan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from memberships m
    where m.guan_id = target_guan_id
      and m.player_id = current_player_id()
  );
$$;

create or replace function is_guan_organizer(target_guan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from memberships m
    where m.guan_id = target_guan_id
      and m.player_id = current_player_id()
      and m.role = 'organizer'
  );
$$;

create or replace function session_guan_id(target_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select guan_id from sessions where id = target_session_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Rule of thumb (technical-req §6): session data is visible to members of that
-- guan; writes that change the shape of a session belong to organizers; a player
-- may only move their own participation row.
-- ---------------------------------------------------------------------------

alter table players enable row level security;
alter table guans enable row level security;
alter table memberships enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table shuttle_logs enable row level security;
alter table cost_shares enable row level security;

-- players -------------------------------------------------------------------
-- A player is visible to anyone who shares a guan with them, so the queue board
-- can show names and skill levels.
create policy players_select on players
  for select using (
    id = current_player_id()
    or exists (
      select 1
      from memberships mine
      join memberships theirs on theirs.guan_id = mine.guan_id
      where mine.player_id = current_player_id()
        and theirs.player_id = players.id
    )
  );

create policy players_insert_self on players
  for insert with check (auth_user_id = auth.uid());

create policy players_update_self on players
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- guans ---------------------------------------------------------------------
create policy guans_select on guans
  for select using (is_guan_member(id));

create policy guans_insert on guans
  for insert with check (owner_player_id = current_player_id());

create policy guans_update_organizer on guans
  for update using (is_guan_organizer(id))
  with check (is_guan_organizer(id));

-- memberships ---------------------------------------------------------------
create policy memberships_select on memberships
  for select using (is_guan_member(guan_id));

-- Joining is self-serve via invite link, so a player inserts their own row.
-- Organizers can add anyone in their guan.
create policy memberships_insert on memberships
  for insert with check (
    player_id = current_player_id() or is_guan_organizer(guan_id)
  );

create policy memberships_update_organizer on memberships
  for update using (is_guan_organizer(guan_id))
  with check (is_guan_organizer(guan_id));

create policy memberships_delete on memberships
  for delete using (
    player_id = current_player_id() or is_guan_organizer(guan_id)
  );

-- sessions ------------------------------------------------------------------
create policy sessions_select on sessions
  for select using (is_guan_member(guan_id));

create policy sessions_write_organizer on sessions
  for all using (is_guan_organizer(guan_id))
  with check (is_guan_organizer(guan_id));

-- session_participants ------------------------------------------------------
create policy session_participants_select on session_participants
  for select using (is_guan_member(session_guan_id(session_id)));

-- RSVP and walk-in check-in are the player's own action.
create policy session_participants_insert on session_participants
  for insert with check (
    (player_id = current_player_id() and is_guan_member(session_guan_id(session_id)))
    or is_guan_organizer(session_guan_id(session_id))
  );

create policy session_participants_update on session_participants
  for update using (
    player_id = current_player_id()
    or is_guan_organizer(session_guan_id(session_id))
  )
  with check (
    player_id = current_player_id()
    or is_guan_organizer(session_guan_id(session_id))
  );

create policy session_participants_delete on session_participants
  for delete using (
    player_id = current_player_id()
    or is_guan_organizer(session_guan_id(session_id))
  );

-- matches / match_players ---------------------------------------------------
-- Everyone in the guan reads the board; only the organizer arranges it.
create policy matches_select on matches
  for select using (is_guan_member(session_guan_id(session_id)));

create policy matches_write_organizer on matches
  for all using (is_guan_organizer(session_guan_id(session_id)))
  with check (is_guan_organizer(session_guan_id(session_id)));

create policy match_players_select on match_players
  for select using (
    exists (
      select 1 from matches m
      where m.id = match_players.match_id
        and is_guan_member(session_guan_id(m.session_id))
    )
  );

create policy match_players_write_organizer on match_players
  for all using (
    exists (
      select 1 from matches m
      where m.id = match_players.match_id
        and is_guan_organizer(session_guan_id(m.session_id))
    )
  )
  with check (
    exists (
      select 1 from matches m
      where m.id = match_players.match_id
        and is_guan_organizer(session_guan_id(m.session_id))
    )
  );

-- shuttle_logs --------------------------------------------------------------
-- Members can read them because the money screen has to show where the shuttle
-- charge came from.
create policy shuttle_logs_select on shuttle_logs
  for select using (is_guan_member(session_guan_id(session_id)));

create policy shuttle_logs_write_organizer on shuttle_logs
  for all using (is_guan_organizer(session_guan_id(session_id)))
  with check (is_guan_organizer(session_guan_id(session_id)));

-- cost_shares ---------------------------------------------------------------
-- Everyone in the guan sees every share. Splitting a bill is a group activity —
-- hiding the other rows is what makes people argue in chat.
create policy cost_shares_select on cost_shares
  for select using (is_guan_member(session_guan_id(session_id)));

create policy cost_shares_write_organizer on cost_shares
  for all using (is_guan_organizer(session_guan_id(session_id)))
  with check (is_guan_organizer(session_guan_id(session_id)));

-- A player may tick their own row as paid. Column-level restriction is not
-- available in RLS, so the app writes this through a narrow update; the policy
-- keeps the row ownership check.
create policy cost_shares_mark_own_paid on cost_shares
  for update using (player_id = current_player_id())
  with check (player_id = current_player_id());

-- ---------------------------------------------------------------------------
-- Realtime
--
-- The queue board has to move on every device the moment a match starts
-- (PRD FR-5). replica identity full so deletes carry enough of the row for
-- subscribers to remove it from the board.
-- ---------------------------------------------------------------------------

alter table matches replica identity full;
alter table match_players replica identity full;
alter table session_participants replica identity full;
alter table shuttle_logs replica identity full;
alter table cost_shares replica identity full;

alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_players;
alter publication supabase_realtime add table session_participants;
alter publication supabase_realtime add table shuttle_logs;
alter publication supabase_realtime add table cost_shares;
