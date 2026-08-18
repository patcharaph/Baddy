"use server";

/**
 * Writes, as Server Actions.
 *
 * Every one of these revalidates the page it affects. The queue board also
 * subscribes to realtime, but a revalidate is what makes the acting device
 * correct even if its own subscription has dropped — the board must never be
 * stale for the person who just pressed the button.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  guanIdForSession,
  requireCurrentPlayerId,
  requireGuanOrganizer,
  requireOrganizer,
  requireOrganizerForMatch,
  requireSelfOrOrganizer,
} from "@/lib/auth/guard";
import { PREVIEW_ROLE_COOKIE, type PreviewRole } from "@/lib/data/viewer";
import {
  validateGuanDraft,
  validateSessionDraft,
  validateSessionEdit,
  type FieldErrors,
} from "@/lib/domain/drafts";
import { parseInviteCode } from "@/lib/domain/invite";
import { placeJoiner } from "@/lib/domain/join";
import { hasSupabaseConfig } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme";

function fail(what: string, message: string): never {
  throw new Error(`${what}ไม่สำเร็จ: ${message}`);
}

/** Every screen reads from the same session, so a write invalidates all of them. */
function revalidateSession(): void {
  for (const path of ["/", "/checkin", "/queue", "/shuttle", "/money", "/settle"]) {
    revalidatePath(path);
  }

  // The manage screen counts the matches still on court to decide whether the
  // round can be closed, so ending one has to reach it too. A dynamic segment
  // needs the route pattern and the `page` type rather than a literal path.
  revalidatePath("/session/[id]", "page");
}

/**
 * Put a proposed match on court.
 *
 * The match row and its players are written before the status flips to
 * `playing`, so a half-written match never appears on anyone's board.
 */
export async function startMatch(
  sessionId: string,
  courtNo: number,
  playerIds: string[],
): Promise<{ matchId: string }> {
  if (playerIds.length === 0) {
    fail("เริ่มแมตช์", "ยังไม่ได้เลือกผู้เล่น");
  }

  await requireOrganizer(sessionId);

  const supabase = await getSupabaseServerClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      session_id: sessionId,
      court_no: courtNo,
      status: "queued",
    })
    .select("id")
    .single();

  if (matchError || !match) {
    // The partial unique index means this is usually "that court is already in
    // use", which is worth saying out loud rather than showing a constraint name.
    fail(
      "เริ่มแมตช์",
      matchError?.message.includes("matches_one_live_per_court")
        ? `คอร์ท ${courtNo} มีแมตช์อยู่แล้ว`
        : (matchError?.message ?? "ไม่ทราบสาเหตุ"),
    );
  }

  const { error: playersError } = await supabase
    .from("match_players")
    .insert(playerIds.map((player_id) => ({ match_id: match.id, player_id })));

  if (playersError) {
    // Roll back rather than leaving an empty match holding a court hostage.
    await supabase.from("matches").delete().eq("id", match.id);
    fail("เริ่มแมตช์", playersError.message);
  }

  const { error: startError } = await supabase
    .from("matches")
    .update({ status: "playing", started_at: new Date().toISOString() })
    .eq("id", match.id);

  if (startError) fail("เริ่มแมตช์", startError.message);

  revalidateSession();
  return { matchId: match.id };
}

/** End a match, which frees its court and restarts everyone's wait clock. */
export async function endMatch(matchId: string): Promise<void> {
  await requireOrganizerForMatch(matchId);

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("matches")
    .update({ status: "done", ended_at: new Date().toISOString() })
    .eq("id", matchId);

  if (error) fail("จบแมตช์", error.message);

  revalidateSession();
}

/**
 * The organizer's +1 when a new shuttle is opened (FR-6).
 *
 * `matchId` matters: it is what lets the per-game mode charge over-quota
 * shuttles to the four players who used them.
 */
export async function logShuttle(
  sessionId: string,
  unitPrice: number,
  matchId: string | null = null,
  count = 1,
): Promise<void> {
  if (count <= 0) fail("บันทึกลูก", `จำนวนลูกต้องมากกว่า 0 (ได้ ${count})`);

  await requireOrganizer(sessionId);

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.from("shuttle_logs").insert({
    session_id: sessionId,
    match_id: matchId,
    count,
    unit_price: unitPrice,
  });

  if (error) fail("บันทึกลูก", error.message);

  revalidateSession();
}

/**
 * Undo the most recent `+1`.
 *
 * Deletes rather than marking void: a mis-tap is not history worth keeping, and
 * an organizer who has to explain a phantom shuttle at settle-up has lost more
 * than the audit trail was worth.
 */
export async function undoLastShuttle(sessionId: string): Promise<void> {
  await requireOrganizer(sessionId);

  const supabase = await getSupabaseServerClient();

  const { data: last, error: readError } = await supabase
    .from("shuttle_logs")
    .select("id")
    .eq("session_id", sessionId)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) fail("ย้อนกลับการบันทึกลูก", readError.message);
  if (!last) fail("ย้อนกลับการบันทึกลูก", "รอบนี้ยังไม่มีการบันทึกลูก");

  const { error } = await supabase
    .from("shuttle_logs")
    .delete()
    .eq("id", last.id);

  if (error) fail("ย้อนกลับการบันทึกลูก", error.message);

  revalidateSession();
}

/** Tick a player as paid, or untick them (FR-8). */
export async function setPaid(
  sessionId: string,
  playerId: string,
  paid: boolean,
): Promise<void> {
  // A player may tick their own row — `cost_shares_mark_own_paid` allows it, and
  // "I already transferred" is the player's own claim to make.
  await requireSelfOrOrganizer(sessionId, playerId);

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("cost_shares")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq("session_id", sessionId)
    .eq("player_id", playerId);

  if (error) fail("บันทึกสถานะการจ่าย", error.message);

  revalidatePath("/money");
  revalidatePath("/settle");
}

/** Change how this session splits its costs (US-4.2). */
export async function setSplitMode(
  sessionId: string,
  splitMode: "buffet" | "per_game" | "even",
): Promise<void> {
  await requireOrganizer(sessionId);

  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("sessions")
    .update({ split_mode: splitMode })
    .eq("id", sessionId);

  if (error) fail("เปลี่ยนวิธีหารเงิน", error.message);

  revalidatePath("/money");
  revalidatePath("/settle");
}

/**
 * Check a player in, or take them back out (FR-3).
 *
 * Taking someone out is two different things depending on whether they ever
 * arrived: someone who has played goes to `checked_out` and keeps their share of
 * the bill, while someone who never showed goes back to `rsvp`. Collapsing those
 * two into one status is how a player who went home early stops being billed.
 */
export async function setCheckIn(
  sessionId: string,
  playerId: string,
  present: boolean,
): Promise<void> {
  await requireSelfOrOrganizer(sessionId, playerId);

  const supabase = await getSupabaseServerClient();

  const { data: current, error: readError } = await supabase
    .from("session_participants")
    .select("check_in_at")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (readError) fail("เช็คอิน", readError.message);
  if (!current) fail("เช็คอิน", "ไม่พบผู้เล่นคนนี้ในรอบเล่นนี้");

  const now = new Date().toISOString();
  const patch = present
    ? {
        status: "checked_in" as const,
        // Keep the original arrival time: it is what the queue's wait ordering
        // is measured from, and re-checking in must not send someone to the back.
        check_in_at: current.check_in_at ?? now,
        check_out_at: null,
        waitlist_position: null,
      }
    : current.check_in_at
      ? { status: "checked_out" as const, check_out_at: now }
      : { status: "rsvp" as const, check_in_at: null, check_out_at: null };

  const { error } = await supabase
    .from("session_participants")
    .update(patch)
    .eq("session_id", sessionId)
    .eq("player_id", playerId);

  if (error) fail("เช็คอิน", error.message);

  revalidateSession();
}

/**
 * Put yourself in tonight's session (PRD FR-3, US-2.2).
 *
 * Takes no player id. The row it writes is keyed on "me", and an action that let
 * the caller name "me" would be an endpoint for adding anyone to anything — so
 * the id comes from the session cookie, server-side, and nowhere else.
 *
 * Membership in the guan is still required, and that check is the schema's:
 * `session_participants_insert` demands `is_guan_member`. A stranger with the
 * session id gets a refusal from Postgres, not from here.
 */
export async function joinSession(sessionId: string): Promise<void> {
  const guanId = await guanIdForSession(sessionId);
  if (!guanId) fail("เข้าร่วมรอบ", "ไม่พบรอบเล่นนี้ หรือคุณไม่ได้อยู่ในก๊วนนี้");

  const playerId = await requireCurrentPlayerId(guanId);
  const supabase = await getSupabaseServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("capacity, closed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) fail("เข้าร่วมรอบ", sessionError.message);
  if (!session) fail("เข้าร่วมรอบ", "ไม่พบรอบเล่นนี้");
  if (session.closed_at) fail("เข้าร่วมรอบ", "รอบนี้ปิดไปแล้ว");

  const { data: rows, error: rosterError } = await supabase
    .from("session_participants")
    .select("player_id, status")
    .eq("session_id", sessionId);

  if (rosterError) fail("เข้าร่วมรอบ", rosterError.message);

  const roster = rows ?? [];
  if (roster.some((r) => r.player_id === playerId)) {
    // Not an error worth showing: a double tap, or a second tab. The roster
    // already says what the player wanted it to say.
    revalidateSession();
    return;
  }

  const placement = placeJoiner({
    capacity: session.capacity,
    checkedInCount: roster.filter((r) => r.status === "checked_in").length,
    waitlistCount: roster.filter((r) => r.status === "waitlist").length,
  });

  const { error } = await supabase.from("session_participants").insert({
    session_id: sessionId,
    player_id: playerId,
    status: placement.status,
    waitlist_position: placement.waitlistPosition,
    check_in_at:
      placement.status === "checked_in" ? new Date().toISOString() : null,
  });

  if (error) fail("เข้าร่วมรอบ", error.message);

  revalidateSession();
}

// ---------------------------------------------------------------------------
// Creating a guan and a session (PRD FR-1, FR-2)
//
// These four are shaped differently from everything above: they are the only
// writes a *form* performs, so a bad value is expected traffic rather than an
// exception. They return field errors for `useActionState` to render next to the
// input that caused them, and only throw for the cases a form cannot fix —
// permission, and a Postgres error.
// ---------------------------------------------------------------------------

export interface FormState {
  errors: FieldErrors;
}

/** Errors with nowhere better to sit. Rendered above the submit button. */
const FORM = "form";

const NO_SUPABASE: FormState = {
  errors: {
    [FORM]:
      "โหมดข้อมูลตัวอย่างสร้างของจริงไม่ได้ — ตั้งค่า Supabase ใน .env.local ก่อน",
  },
};

function formError(message: string): FormState {
  return { errors: { [FORM]: message } };
}

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value : null;
}

/**
 * Create a guan and become its organizer (US-1.1).
 *
 * The insert goes through the `create_guan` RPC rather than two inserts from
 * here, because `guans_select` is `is_guan_member(id)`: a guan whose membership
 * row failed to land is invisible to the person who just created it. See 0002.
 */
export async function createGuan(
  _previous: FormState | null,
  form: FormData,
): Promise<FormState> {
  if (!hasSupabaseConfig) return NO_SUPABASE;

  const draft = validateGuanDraft({
    name: field(form, "name"),
    homeVenue: field(form, "homeVenue"),
    defaultCourtRate: field(form, "defaultCourtRate"),
  });

  if (!draft.ok) return { errors: draft.errors };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("create_guan", {
    guan_name: draft.value.name,
    venue: draft.value.homeVenue,
    court_rate: draft.value.defaultCourtRate,
  });

  if (error) return formError(`สร้างก๊วนไม่สำเร็จ: ${error.message}`);

  revalidatePath("/profile");
  // To the profile, which is where the invite link lives — creating a guan
  // nobody has been invited to is not a finished action (US-1.1).
  redirect("/profile");
}

/**
 * Open a round (US-2.1).
 *
 * A plain insert: `sessions_write_organizer` already covers this, and there is
 * only one row to write, so there is nothing here an RPC would make atomic.
 *
 * The rate the chosen split mode needs is required here rather than at
 * settle-up. The cost engine refuses without it either way — the difference is
 * whether the refusal happens now, in front of the organizer filling in a form,
 * or at 23:00 in front of everyone waiting to pay.
 */
export async function createSession(
  _previous: FormState | null,
  form: FormData,
): Promise<FormState> {
  if (!hasSupabaseConfig) return NO_SUPABASE;

  const draft = validateSessionDraft({
    guanId: field(form, "guanId"),
    venue: field(form, "venue"),
    startsAtLocal: field(form, "startsAtLocal"),
    endsAtLocal: field(form, "endsAtLocal"),
    tzOffsetMinutes: field(form, "tzOffsetMinutes"),
    courtCount: field(form, "courtCount"),
    courtRate: field(form, "courtRate"),
    capacity: field(form, "capacity"),
    splitMode: field(form, "splitMode"),
    buffetRate: field(form, "buffetRate"),
    womenRate: field(form, "womenRate"),
    perGameRate: field(form, "perGameRate"),
    shuttlesIncludedPerMatch: field(form, "shuttlesIncludedPerMatch"),
  });

  if (!draft.ok) return { errors: draft.errors };

  const s = draft.value;
  await requireGuanOrganizer(s.guanId);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("sessions").insert({
    guan_id: s.guanId,
    venue: s.venue,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    court_count: s.courtCount,
    court_rate: s.courtRate,
    capacity: s.capacity,
    split_mode: s.splitMode,
    buffet_rate: s.buffetRate,
    women_rate: s.womenRate,
    per_game_rate: s.perGameRate,
    shuttles_included_per_match: s.shuttlesIncludedPerMatch,
  });

  if (error) return formError(`เปิดรอบไม่สำเร็จ: ${error.message}`);

  revalidateSession();
  redirect("/");
}

/**
 * Change a round that is already running (FR-2).
 *
 * The same validator as opening one, because a round edited past the rules the
 * create form enforces is a round the cost engine refuses at settle-up — a
 * buffet session whose rate is cleared at 21:00 breaks the money screen just as
 * completely as one that never had a rate.
 *
 * `guan_id` is not in the update. It is not on the form either, but a Server
 * Action receives whatever is posted to it, so the column that decides which
 * guan's members can see this round is simply never written here.
 */
export async function updateSession(
  _previous: FormState | null,
  form: FormData,
): Promise<FormState> {
  if (!hasSupabaseConfig) return NO_SUPABASE;

  const draft = validateSessionEdit({
    sessionId: field(form, "sessionId"),
    venue: field(form, "venue"),
    startsAtLocal: field(form, "startsAtLocal"),
    endsAtLocal: field(form, "endsAtLocal"),
    tzOffsetMinutes: field(form, "tzOffsetMinutes"),
    courtCount: field(form, "courtCount"),
    courtRate: field(form, "courtRate"),
    capacity: field(form, "capacity"),
    splitMode: field(form, "splitMode"),
    buffetRate: field(form, "buffetRate"),
    womenRate: field(form, "womenRate"),
    perGameRate: field(form, "perGameRate"),
    shuttlesIncludedPerMatch: field(form, "shuttlesIncludedPerMatch"),
  });

  if (!draft.ok) return { errors: draft.errors };

  const s = draft.value;
  await requireOrganizer(s.sessionId);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .update({
      venue: s.venue,
      starts_at: s.startsAt,
      ends_at: s.endsAt,
      court_count: s.courtCount,
      court_rate: s.courtRate,
      capacity: s.capacity,
      split_mode: s.splitMode,
      buffet_rate: s.buffetRate,
      women_rate: s.womenRate,
      per_game_rate: s.perGameRate,
      shuttles_included_per_match: s.shuttlesIncludedPerMatch,
    })
    .eq("id", s.sessionId)
    .select("id, closed_at");

  if (error) return formError(`แก้ไขรอบไม่สำเร็จ: ${error.message}`);

  // `select` on the way out is what turns the update into something that can
  // report failure. Without it an update RLS hid every row from comes back as a
  // success, and the organizer is told the round was saved while nothing moved.
  const saved = data?.[0];
  if (!saved) {
    return formError("แก้ไขรอบไม่สำเร็จ: ไม่พบรอบนี้ หรือคุณไม่มีสิทธิ์แก้");
  }

  revalidateSession();
  revalidatePath(`/session/${s.sessionId}`);

  // Home shows the round that was just edited — unless it is closed, in which
  // case home shows nothing and the way back to this round is the page it was
  // edited from.
  redirect(saved.closed_at === null ? "/" : `/session/${s.sessionId}`);
}

/**
 * Close a round (FR-2).
 *
 * A closed round stops being the one every screen opens on — `closed_at` is what
 * `fetchCurrentSession` filters by — so this is how next week's round becomes
 * the current one instead of last week's hanging around forever.
 *
 * It refuses while a court is still occupied. Closing mid-match leaves matches
 * that can never be ended attached to a round nothing links to any more, and the
 * shuttles logged against them never reach anyone's bill. Ending the matches
 * first is one screen away, and the refusal says so.
 */
export async function closeSession(sessionId: string): Promise<void> {
  await requireOrganizer(sessionId);

  const supabase = await getSupabaseServerClient();

  const { data: live, error: liveError } = await supabase
    .from("matches")
    .select("id")
    .eq("session_id", sessionId)
    .in("status", ["playing", "queued"]);

  if (liveError) fail("ปิดรอบ", liveError.message);
  if (live && live.length > 0) {
    fail(
      "ปิดรอบ",
      `ยังมีแมตช์ที่ยังไม่จบอยู่ ${live.length} แมตช์ — จบให้ครบที่หน้ากระดานคิวก่อน`,
    );
  }

  const { data, error } = await supabase
    .from("sessions")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("closed_at", null)
    .select("id");

  if (error) fail("ปิดรอบ", error.message);

  // Zero rows here means the round was already closed, not that the write was
  // refused — `requireOrganizer` above has already made refusal loud. A second
  // press is the same outcome as the first, so it is not an error; re-stamping
  // `closed_at` would only move the round out of the undo window below.
  void data;

  revalidateSession();
  revalidatePath(`/session/${sessionId}`);
}

/**
 * Undo a close.
 *
 * Closing is the one action that removes a round from every screen at once, and
 * it gets pressed on a phone at the side of a court, so it has to be reversible.
 * The home screen only offers this for a few hours after the fact — but that is
 * a decision about what to *offer*, not what is allowed, because reopening is
 * itself reversible by closing again.
 *
 * What it does refuse is reopening a round that would not become the current one
 * anyway. `fetchCurrentSession` takes the latest open round, so with a newer one
 * already open this would be a button that reports success and changes nothing
 * on screen.
 */
export async function reopenSession(sessionId: string): Promise<void> {
  await requireOrganizer(sessionId);

  const supabase = await getSupabaseServerClient();

  const { data: target, error: targetError } = await supabase
    .from("sessions")
    .select("starts_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (targetError) fail("เปิดรอบกลับ", targetError.message);
  if (!target) fail("เปิดรอบกลับ", "ไม่พบรอบนี้");

  const { data: newer, error: newerError } = await supabase
    .from("sessions")
    .select("id")
    .is("closed_at", null)
    // `gte`, not `gt`: two rounds starting at the same instant is a tie this
    // cannot break, and it cannot match the target itself — that one is closed.
    .gte("starts_at", target.starts_at)
    .limit(1);

  if (newerError) fail("เปิดรอบกลับ", newerError.message);
  if (newer && newer.length > 0) {
    fail("เปิดรอบกลับ", "มีรอบที่เปิดอยู่และใหม่กว่ารอบนี้ — ปิดรอบนั้นก่อน");
  }

  const { error } = await supabase
    .from("sessions")
    .update({ closed_at: null })
    .eq("id", sessionId);

  if (error) fail("เปิดรอบกลับ", error.message);

  revalidateSession();
  revalidatePath(`/session/${sessionId}`);
}

/**
 * Redeem an invite code (US-1.2).
 *
 * The code is the only argument because it is the only credential: whoever holds
 * it may join, and who they join *as* comes from the session cookie. `code` is
 * re-validated here rather than trusted from the route, since a server action is
 * an endpoint of its own and does not only receive what the page put in it.
 */
export async function joinGuanByInvite(
  _previous: FormState | null,
  form: FormData,
): Promise<FormState> {
  if (!hasSupabaseConfig) return NO_SUPABASE;

  const code = parseInviteCode(field(form, "code") ?? "");
  if (code === null) return formError("ลิงก์เชิญนี้ไม่ถูกต้อง");

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("join_guan_by_invite", { code });

  if (error) return formError(error.message);

  revalidatePath("/profile");
  revalidateSession();
  redirect("/");
}

/**
 * Replace a guan's invite code, ending every link that carried the old one.
 *
 * The link is the credential, so there has to be a way to revoke one — a code
 * pasted into the wrong group chat is otherwise permanent. Organizer-only, and
 * the RPC checks that too.
 */
export async function rotateInviteCode(guanId: string): Promise<void> {
  await requireGuanOrganizer(guanId);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("rotate_invite_code", {
    target_guan_id: guanId,
  });

  if (error) fail("เปลี่ยนลิงก์เชิญ", error.message);

  revalidatePath("/profile");
}

/**
 * Switch the sample board between the organizer's and the player's view.
 *
 * Sample data has no memberships to read, and both halves of the design need to
 * be reviewable, so the preview role lives in a cookie. It is only ever read
 * when Supabase is not configured — see `resolveViewer`.
 */
export async function setPreviewRole(role: PreviewRole): Promise<void> {
  const store = await cookies();
  store.set(PREVIEW_ROLE_COOKIE, role, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidateSession();
  revalidatePath("/profile");
}

/**
 * Store the reader's light/dark choice (or hand it back to the OS).
 *
 * A cookie rather than localStorage, because `<html data-theme>` is written by
 * the server — see `lib/theme.ts`. `revalidatePath("/", "layout")` is what makes
 * the root layout re-render with the new attribute; revalidating the individual
 * pages would leave the old `<html>` in place.
 */
export async function setTheme(preference: ThemePreference): Promise<void> {
  const store = await cookies();

  if (preference === "system") {
    // Delete rather than store "system": an absent cookie is exactly the state
    // the CSS reads as "follow prefers-color-scheme".
    store.delete(THEME_COOKIE);
  } else {
    store.set(THEME_COOKIE, preference, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
}
