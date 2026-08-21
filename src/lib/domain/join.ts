/**
 * Where a player lands when they join a session, and who moves up when a place
 * comes free (PRD FR-3, US-2.2, US-2.4).
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

// ---------------------------------------------------------------------------
// Auto-promote (US-2.4)
// ---------------------------------------------------------------------------

export interface WaitingPlayer {
  playerId: string;
  /** Position in the waitlist. Null rows sort behind every numbered one. */
  waitlistPosition: number | null;
}

export interface PromotionInput {
  /** Null when the session has no quota. */
  capacity: number | null;
  /** How many are currently counted against the quota. */
  checkedInCount: number;
  waiting: readonly WaitingPlayer[];
}

export interface WaitlistPromotion {
  /** Players who get a place now, in the order they were waiting. */
  promoted: string[];
  /**
   * Everyone still waiting whose number has to change, closed up to 1…n.
   *
   * Rows that already carry the right number are left out: this is the list of
   * writes to make, not the list of people still waiting.
   */
  renumbered: { playerId: string; waitlistPosition: number }[];
}

/**
 * Who moves off the waitlist now that the quota has room (US-2.4).
 *
 * The check-in screen promises "เต็มแล้วเข้า waitlist และเลื่อนขึ้นอัตโนมัติ" in two
 * places, and until this existed that was a sentence the app did not keep. It
 * runs whenever a seat can have come free — someone checked out, or the
 * organizer raised the quota — rather than on a timer, because the promise is
 * about a place opening up, not about a clock.
 *
 * Order is by `waitlist_position` and nothing else. Arrival time would be the
 * kinder-sounding rule and the wrong one: the number is what the player was
 * shown ("waitlist ลำดับ 3"), and a queue that renumbers itself by a hidden
 * field is a queue nobody can check.
 *
 * The renumbering is deliberate rather than incidental. `placeJoiner` numbers a
 * new waiter as `waitlistCount + 1`, so a gap left behind by a promoted player
 * would eventually hand two people the same number.
 */
export function promoteFromWaitlist(input: PromotionInput): WaitlistPromotion {
  const { capacity, checkedInCount, waiting } = input;

  const ordered = [...waiting].sort((a, b) => {
    const byPosition =
      (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) -
      (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER);
    if (byPosition !== 0) return byPosition;

    // Same number, or both unnumbered: settle it the same way the queue settles
    // ties, so two calls in a row cannot disagree about who is next.
    return a.playerId.localeCompare(b.playerId);
  });

  // No quota means nobody should be waiting at all — the only way to be on a
  // waitlist in an unlimited session is for the quota to have been cleared
  // after the fact, which is exactly the case this has to drain.
  const seats =
    capacity === null ? ordered.length : Math.max(0, capacity - checkedInCount);

  const promoted = ordered.slice(0, seats);
  const staying = ordered.slice(seats);

  return {
    promoted: promoted.map((p) => p.playerId),
    renumbered: staying
      .map((p, index) => ({ playerId: p.playerId, waitlistPosition: index + 1 }))
      .filter(
        (row, index) => staying[index].waitlistPosition !== row.waitlistPosition,
      ),
  };
}
