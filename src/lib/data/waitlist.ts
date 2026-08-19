import "server-only";

import { promoteFromWaitlist } from "@/lib/domain/join";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Move players off the waitlist once the session has room (US-2.4).
 *
 * Deliberately *not* in `mutations.ts`: every export of a `"use server"` module
 * is a POST endpoint, and this is a step other actions take rather than a button
 * anyone presses. Exporting it there would publish "promote whoever is next in
 * this session" to anyone who can reach the app.
 *
 * It is called after a seat can have come free — someone checked out, the
 * organizer raised the quota — rather than on a schedule, because the promise on
 * the check-in screen is about a place opening up, not about a clock.
 *
 * Safe to call when nothing has changed: with a full quota and a tidy waitlist
 * it computes an empty plan and writes nothing.
 */
export async function promoteWaitlist(sessionId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("capacity, closed_at")
    .eq("id", sessionId)
    .maybeSingle();

  // A promotion is never the reason a caller fails. Every call site has already
  // done the thing the player asked for — checking someone out, saving a round —
  // and turning "could not tidy the waitlist" into a failed check-out would be a
  // worse outcome than a waitlist that stays put until the next call.
  if (sessionError || !session || session.closed_at) return 0;

  const { data: rows, error: rosterError } = await supabase
    .from("session_participants")
    .select("player_id, status, waitlist_position")
    .eq("session_id", sessionId);

  if (rosterError || !rows) return 0;

  const plan = promoteFromWaitlist({
    capacity: session.capacity,
    checkedInCount: rows.filter((r) => r.status === "checked_in").length,
    waiting: rows
      .filter((r) => r.status === "waitlist")
      .map((r) => ({
        playerId: r.player_id,
        waitlistPosition: r.waitlist_position,
      })),
  });

  if (plan.promoted.length === 0 && plan.renumbered.length === 0) return 0;

  let promotedCount = 0;

  if (plan.promoted.length > 0) {
    // `eq("status", "waitlist")` is what makes two people leaving at the same
    // moment safe: the second run promotes only whoever is still waiting, and
    // the `select` says who that actually was rather than assuming the plan
    // survived the race.
    const { data: moved, error } = await supabase
      .from("session_participants")
      .update({
        status: "checked_in",
        waitlist_position: null,
        // Now, not the time they joined the waitlist. `check_in_at` is what the
        // queue measures a wait from, and until this moment they were not in the
        // rotation at all — backdating it would drop someone who has just been
        // given a place straight to the front of the queue, ahead of everyone
        // who has been playing all evening.
        check_in_at: new Date().toISOString(),
        check_out_at: null,
      })
      .eq("session_id", sessionId)
      .eq("status", "waitlist")
      .in("player_id", plan.promoted)
      .select("player_id");

    if (error) return 0;
    promotedCount = moved?.length ?? 0;
  }

  // Renumbering is per-row because each row gets a different number. It stays a
  // handful of writes: this only runs on a session whose waitlist just moved.
  for (const row of plan.renumbered) {
    await supabase
      .from("session_participants")
      .update({ waitlist_position: row.waitlistPosition })
      .eq("session_id", sessionId)
      .eq("player_id", row.playerId)
      .eq("status", "waitlist");
  }

  return promotedCount;
}
