import { describe, expect, it } from "vitest";

import { placeJoiner } from "./join";

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
