-- Baddy — creating a guan, and joining one by invite link (PRD FR-1)
--
-- 0001 gave guans an `invite_code` column and nothing that could use it. Two
-- things in that schema stand in the way of an invite link actually working, and
-- both are fixed here rather than worked around in the app:
--
--   1. The default code was base64, which contains `+` and `/`. A `/` inside
--      `/join/<code>` is not a code with a slash in it — it is a different route.
--   2. `guans_select` is `is_guan_member(id)`. The whole point of an invite is
--      that the person holding it is *not* a member yet, so the landing page
--      cannot read the name of the guan it is inviting them to.
--
-- (2) is not a policy to loosen. Making guans readable by code would mean
-- making them readable, full stop — RLS cannot see that the caller filtered on
-- `invite_code`, so the policy would have to be `using (true)`. The narrow
-- `security definer` functions below are the alternative: each answers exactly
-- one question and cannot be pointed at anything else.

-- ---------------------------------------------------------------------------
-- URL-safe invite codes
-- ---------------------------------------------------------------------------

-- 9 bytes → 12 base64 characters with no padding (9 divides by 3), translated
-- into the URL-safe alphabet. 72 bits, which is what makes it safe to treat the
-- link itself as the credential.
create or replace function generate_invite_code()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select translate(encode(gen_random_bytes(9), 'base64'), '+/', '-_');
$$;

alter table guans alter column invite_code set default generate_invite_code();

-- Any code minted by the old default is unusable in a URL. Volatile function in
-- the SET, so each row gets its own code.
update guans
set invite_code = generate_invite_code()
where invite_code ~ '[+/=]';

-- ---------------------------------------------------------------------------
-- What an invited stranger may see
-- ---------------------------------------------------------------------------

/*
 * The guan behind an invite code, for the landing page.
 *
 * Deliberately not `select *`: an invite tells you the name, the venue and how
 * many people are in it — enough to know whether you are in the right place.
 * It does not tell you the organizer's PromptPay number.
 *
 * Callable by anon so the name is on screen *before* LINE Login. Being asked to
 * sign in to see what you are being invited to is how invites get ignored.
 */
create or replace function guan_invite_preview(code text)
returns table (guan_id uuid, name text, home_venue text, member_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    g.id,
    g.name,
    g.home_venue,
    (select count(*) from memberships m where m.guan_id = g.id)
  from guans g
  where g.invite_code = code;
$$;

revoke all on function guan_invite_preview(text) from public;
grant execute on function guan_invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Joining
-- ---------------------------------------------------------------------------

/*
 * Redeem an invite code (US-1.2).
 *
 * `memberships_insert` already allows a player to insert their own row, so this
 * is not here to grant permission — it is here because the caller cannot read
 * `guans` to turn the code into the `guan_id` that insert needs. Resolving the
 * code and writing the row in the same function is also what keeps the code
 * itself from having to pass through the client.
 *
 * Always `role = 'player'`, and `do nothing` on conflict: a second tap on the
 * link is not an error, and it must not be a way to rewrite an existing
 * membership — least of all an organizer's, back down to player.
 */
create or replace function join_guan_by_invite(code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid;
  target_guan uuid;
begin
  me := current_player_id();
  if me is null then
    raise exception 'ยังไม่ได้เข้าสู่ระบบ' using errcode = '28000';
  end if;

  select g.id into target_guan from guans g where g.invite_code = code;
  if target_guan is null then
    raise exception 'ลิงก์เชิญนี้ใช้ไม่ได้แล้ว' using errcode = '22023';
  end if;

  insert into memberships (guan_id, player_id, role)
  values (target_guan, me, 'player')
  on conflict (guan_id, player_id) do nothing;

  return target_guan;
end;
$$;

revoke all on function join_guan_by_invite(text) from public;
grant execute on function join_guan_by_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Creating a guan
-- ---------------------------------------------------------------------------

/*
 * Create a guan and make the creator its organizer (US-1.1).
 *
 * One function rather than two inserts from the app, because the two are not
 * independent: `guans_select` is `is_guan_member(id)`, so a guan whose
 * membership row failed to land is invisible to the person who just created it —
 * not an error they can see, retry or clean up. In here they are one
 * transaction.
 *
 * `owner_player_id` is taken from the session, never from the caller. Trusting
 * an argument would make this an endpoint for creating guans owned by other
 * people.
 */
create or replace function create_guan(
  guan_name text,
  venue text default null,
  court_rate integer default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid;
  new_guan uuid;
begin
  me := current_player_id();
  if me is null then
    raise exception 'ยังไม่ได้เข้าสู่ระบบ' using errcode = '28000';
  end if;

  if guan_name is null or btrim(guan_name) = '' then
    raise exception 'ต้องตั้งชื่อก๊วนก่อน' using errcode = '22023';
  end if;

  insert into guans (name, home_venue, default_court_rate, owner_player_id)
  values (
    btrim(guan_name),
    nullif(btrim(coalesce(venue, '')), ''),
    greatest(coalesce(court_rate, 0), 0),
    me
  )
  returning id into new_guan;

  insert into memberships (guan_id, player_id, role)
  values (new_guan, me, 'organizer');

  return new_guan;
end;
$$;

revoke all on function create_guan(text, text, integer) from public;
grant execute on function create_guan(text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Revoking a leaked link
-- ---------------------------------------------------------------------------

/*
 * Mint a new invite code, invalidating the old one.
 *
 * The link is the credential, so there has to be a way to end one. A code
 * pasted into the wrong group chat is otherwise valid forever, and the only
 * remedy would be deleting the guan.
 */
create or replace function rotate_invite_code(target_guan_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  fresh text;
begin
  if not is_guan_organizer(target_guan_id) then
    raise exception 'เฉพาะหัวหน้าก๊วนเท่านั้น' using errcode = '42501';
  end if;

  update guans
  set invite_code = generate_invite_code()
  where id = target_guan_id
  returning invite_code into fresh;

  return fresh;
end;
$$;

revoke all on function rotate_invite_code(uuid) from public;
grant execute on function rotate_invite_code(uuid) to authenticated;
