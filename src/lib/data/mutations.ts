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

import { PREVIEW_ROLE_COOKIE } from "@/lib/data/viewer";
import type { MemberRole } from "@/lib/domain/types";
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
 * Switch the sample board between the organizer's and the player's view.
 *
 * Sample data has no memberships to read, and both halves of the design need to
 * be reviewable, so the preview role lives in a cookie. It is only ever read
 * when Supabase is not configured — see `resolveViewer`.
 */
export async function setPreviewRole(role: MemberRole): Promise<void> {
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
