import "server-only";

import { resolveViewer } from "@/lib/data/viewer";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Who is allowed to press which button, checked before the write is attempted.
 *
 * RLS is the real boundary and stays the real boundary — these checks do not
 * replace it. They exist because a policy that hides a row turns an unauthorised
 * `update ... where id = ?` into an update of zero rows, and PostgREST reports
 * that as success. A player calling `endMatch` directly would be told the match
 * ended while the board never moved.
 *
 * So the guard's job is not to authorise. It is to make refusal *loud*, in a
 * sentence the person can act on, before the silent version can happen.
 */

const DENIED = "คุณไม่มีสิทธิ์ทำรายการนี้ — เฉพาะหัวหน้าก๊วนเท่านั้น";
const NOT_A_MEMBER = "คุณไม่ได้อยู่ในก๊วนนี้";

function deny(message: string): never {
  throw new Error(message);
}

/** The guan a session belongs to, or null when the caller cannot even see it. */
async function guanIdForSession(sessionId: string): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("sessions")
    .select("guan_id")
    .eq("id", sessionId)
    .maybeSingle();

  return data?.guan_id ?? null;
}

/** The session a match belongs to — `endMatch` only ever holds a match id. */
async function sessionIdForMatch(matchId: string): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("matches")
    .select("session_id")
    .eq("id", matchId)
    .maybeSingle();

  return data?.session_id ?? null;
}

/** Refuse anyone who is not the organizer of this session's guan. */
export async function requireOrganizer(sessionId: string): Promise<void> {
  const guanId = await guanIdForSession(sessionId);
  if (!guanId) deny(NOT_A_MEMBER);

  const viewer = await resolveViewer(guanId);
  if (viewer.role !== "organizer") deny(DENIED);
}

/** Same, for the one action that arrives holding a match instead of a session. */
export async function requireOrganizerForMatch(matchId: string): Promise<void> {
  const sessionId = await sessionIdForMatch(matchId);
  if (!sessionId) deny(NOT_A_MEMBER);

  await requireOrganizer(sessionId);
}

/**
 * Allow the organizer, or the player acting on their own row.
 *
 * Mirrors `session_participants_update` and `cost_shares_mark_own_paid` in the
 * schema. Where the policy and this disagree, the policy wins — that is the
 * point of keeping both.
 */
export async function requireSelfOrOrganizer(
  sessionId: string,
  playerId: string,
): Promise<void> {
  const guanId = await guanIdForSession(sessionId);
  if (!guanId) deny(NOT_A_MEMBER);

  const viewer = await resolveViewer(guanId);
  if (viewer.role === "organizer") return;
  if (viewer.playerId !== null && viewer.playerId === playerId) return;

  deny("คุณแก้ได้เฉพาะรายการของตัวเอง");
}

/**
 * The signed-in player id, for actions that must never take one from the client.
 *
 * `joinSession` is the case this exists for: an action that writes a row keyed
 * on "me" has to decide who "me" is on the server, or it is just an endpoint for
 * adding anyone to anything.
 */
export async function requireCurrentPlayerId(guanId: string): Promise<string> {
  const viewer = await resolveViewer(guanId);
  if (viewer.playerId === null) deny("ยังไม่ได้เข้าสู่ระบบ");
  return viewer.playerId;
}

export { guanIdForSession };
