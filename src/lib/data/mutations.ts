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

import { getSupabaseServerClient } from "@/lib/supabase/server";

function fail(what: string, message: string): never {
  throw new Error(`${what}ไม่สำเร็จ: ${message}`);
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

  revalidatePath("/queue");
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

  revalidatePath("/queue");
  revalidatePath("/money");
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

  revalidatePath("/money");
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
}
