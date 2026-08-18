/**
 * Where a player lands when they join a session themselves (PRD FR-3, US-2.2).
 *
 * Pure on purpose, like the queue and cost engines: "does this person get a
 * place or a waitlist number" is the rule people argue about at the door, and it
 * should be arguable from a test rather than from a database.
 */

export interface JoinPlacementInput {
  /** Null when the session has no quota — everyone gets in. */
  capacity: number | null;
  /** How many are already counted against the quota. */
  checkedInCount: number;
  /** How many are already waiting, used to number the next one. */
  waitlistCount: number;
}

export type JoinPlacement =
  | { status: "checked_in"; waitlistPosition: null }
  | { status: "waitlist"; waitlistPosition: number };

/**
 * Decide the joiner's place.
 *
 * A full session sends them to the back of the waitlist rather than refusing
 * them: the screen promises "เต็มแล้วเข้า waitlist และเลื่อนขึ้นอัตโนมัติ", and a
 * refusal here would make that a lie. Someone who cannot join is someone the
 * organizer never hears about.
 *
 * `waitlistCount` numbers the new row rather than `max(position) + 1` because a
 * gap left by someone who was promoted should be closed, not preserved — the
 * number is a queue position, not an identity.
 */
export function placeJoiner(input: JoinPlacementInput): JoinPlacement {
  const { capacity, checkedInCount, waitlistCount } = input;

  const hasRoom = capacity === null || checkedInCount < capacity;

  return hasRoom
    ? { status: "checked_in", waitlistPosition: null }
    : { status: "waitlist", waitlistPosition: waitlistCount + 1 };
}
