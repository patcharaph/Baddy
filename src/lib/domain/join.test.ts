import { describe, expect, it } from "vitest";

import { placeJoiner, promoteFromWaitlist } from "./join";

describe("placeJoiner", () => {
  it("lets a player straight in when the quota has room", () => {
    expect(
      placeJoiner({ capacity: 16, checkedInCount: 12, waitlistCount: 0 }),
    ).toEqual({ status: "checked_in", waitlistPosition: null });
  });

  it("lets everyone in when the session has no quota", () => {
    expect(
      placeJoiner({ capacity: null, checkedInCount: 99, waitlistCount: 3 }),
    ).toEqual({ status: "checked_in", waitlistPosition: null });
  });

  it("waitlists rather than refuses once the quota is full", () => {
    expect(
      placeJoiner({ capacity: 16, checkedInCount: 16, waitlistCount: 0 }),
    ).toEqual({ status: "waitlist", waitlistPosition: 1 });
  });

  it("numbers each new waiter behind the ones already waiting", () => {
    expect(
      placeJoiner({ capacity: 16, checkedInCount: 16, waitlistCount: 2 }),
    ).toEqual({ status: "waitlist", waitlistPosition: 3 });
  });

  // Over-capacity is reachable: the organizer can check people in past the
  // quota, and the next joiner still has to land somewhere sensible.
  it("waitlists when the session is already over its quota", () => {
    expect(
      placeJoiner({ capacity: 16, checkedInCount: 18, waitlistCount: 0 }),
    ).toEqual({ status: "waitlist", waitlistPosition: 1 });
  });

  it("treats a quota of zero as always full", () => {
    expect(
      placeJoiner({ capacity: 0, checkedInCount: 0, waitlistCount: 0 }),
    ).toEqual({ status: "waitlist", waitlistPosition: 1 });
  });
});

describe("promoteFromWaitlist", () => {
  const waiter = (playerId: string, waitlistPosition: number | null) => ({
    playerId,
    waitlistPosition,
  });

  it("moves nobody up while the quota is still full", () => {
    expect(
      promoteFromWaitlist({
        capacity: 16,
        checkedInCount: 16,
        waiting: [waiter("a", 1), waiter("b", 2)],
      }),
    ).toEqual({ promoted: [], renumbered: [] });
  });

  it("fills one free place with the player at the front", () => {
    expect(
      promoteFromWaitlist({
        capacity: 16,
        checkedInCount: 15,
        waiting: [waiter("a", 1), waiter("b", 2), waiter("c", 3)],
      }),
    ).toEqual({
      promoted: ["a"],
      // b and c close up behind: `placeJoiner` numbers the next joiner from the
      // count, so leaving a gap hands two people the same number.
      renumbered: [
        { playerId: "b", waitlistPosition: 1 },
        { playerId: "c", waitlistPosition: 2 },
      ],
    });
  });

  it("fills every free place at once, in waitlist order", () => {
    expect(
      promoteFromWaitlist({
        capacity: 16,
        checkedInCount: 13,
        waiting: [waiter("a", 1), waiter("b", 2), waiter("c", 3)],
      }),
    ).toEqual({ promoted: ["a", "b", "c"], renumbered: [] });
  });

  it("goes by the number the player was shown, not the order it was handed", () => {
    expect(
      promoteFromWaitlist({
        capacity: 4,
        checkedInCount: 3,
        waiting: [waiter("late", 1), waiter("early", 2)],
      }).promoted,
    ).toEqual(["late"]);
  });

  it("drains the whole waitlist when the quota is removed", () => {
    expect(
      promoteFromWaitlist({
        capacity: null,
        checkedInCount: 30,
        waiting: [waiter("a", 1), waiter("b", 2)],
      }),
    ).toEqual({ promoted: ["a", "b"], renumbered: [] });
  });

  it("promotes nobody when the session is over its quota", () => {
    // Reachable: the organizer can check people in past the quota.
    expect(
      promoteFromWaitlist({
        capacity: 16,
        checkedInCount: 18,
        waiting: [waiter("a", 1)],
      }),
    ).toEqual({ promoted: [], renumbered: [] });
  });

  it("treats a quota of zero as never having room", () => {
    expect(
      promoteFromWaitlist({
        capacity: 0,
        checkedInCount: 0,
        waiting: [waiter("a", 1)],
      }).promoted,
    ).toEqual([]);
  });

  it("closes gaps even when nobody is promoted", () => {
    // A waitlist left holed by an earlier promotion still has to be tidied, or
    // the next joiner is numbered on top of someone.
    expect(
      promoteFromWaitlist({
        capacity: 16,
        checkedInCount: 16,
        waiting: [waiter("a", 2), waiter("b", 5)],
      }).renumbered,
    ).toEqual([
      { playerId: "a", waitlistPosition: 1 },
      { playerId: "b", waitlistPosition: 2 },
    ]);
  });

  it("sorts unnumbered rows behind numbered ones instead of ahead", () => {
    expect(
      promoteFromWaitlist({
        capacity: 16,
        checkedInCount: 15,
        waiting: [waiter("nulled", null), waiter("numbered", 9)],
      }).promoted,
    ).toEqual(["numbered"]);
  });

  it("breaks a tie the same way twice", () => {
    const input = {
      capacity: 16,
      checkedInCount: 15,
      waiting: [waiter("b", 1), waiter("a", 1)],
    };

    expect(promoteFromWaitlist(input)).toEqual(promoteFromWaitlist(input));
    expect(promoteFromWaitlist(input).promoted).toEqual(["a"]);
  });

  it("does nothing to an empty waitlist", () => {
    expect(
      promoteFromWaitlist({ capacity: 16, checkedInCount: 2, waiting: [] }),
    ).toEqual({ promoted: [], renumbered: [] });
  });
});
