import { describe, expect, it } from "vitest";

import {
  buildNextMatches,
  orderByFairness,
  substitutePlayer,
  swapPlayers,
  waitedMs,
  type QueueCandidate,
} from "./queue-engine";

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

function candidate(
  playerId: string,
  opts: Partial<Omit<QueueCandidate, "playerId">> = {},
): QueueCandidate {
  return {
    playerId,
    gamesPlayed: opts.gamesPlayed ?? 0,
    lastFinishedAt: opts.lastFinishedAt ?? null,
    checkedInAt: opts.checkedInAt ?? NOW - 30 * MINUTE,
  };
}

/** Minutes ago, as an epoch timestamp. */
const agoMin = (m: number) => NOW - m * MINUTE;

describe("waitedMs", () => {
  it("measures from the last finished match", () => {
    const c = candidate("a", { lastFinishedAt: agoMin(8) });
    expect(waitedMs(c, NOW)).toBe(8 * MINUTE);
  });

  it("falls back to check-in for a player who has not played yet", () => {
    const c = candidate("a", { checkedInAt: agoMin(20), lastFinishedAt: null });
    expect(waitedMs(c, NOW)).toBe(20 * MINUTE);
  });
});

describe("orderByFairness", () => {
  it("puts the longest wait first", () => {
    const order = orderByFairness(
      [
        candidate("short", { lastFinishedAt: agoMin(2) }),
        candidate("long", { lastFinishedAt: agoMin(12) }),
        candidate("mid", { lastFinishedAt: agoMin(7) }),
      ],
      { now: NOW },
    );

    expect(order.map((c) => c.playerId)).toEqual(["long", "mid", "short"]);
  });

  it("breaks a comparable wait with fewer games played", () => {
    // Both waited ~5 minutes, so rule (2) decides.
    const order = orderByFairness(
      [
        candidate("veteran", { lastFinishedAt: agoMin(5), gamesPlayed: 6 }),
        candidate("rookie", { lastFinishedAt: agoMin(5), gamesPlayed: 2 }),
      ],
      { now: NOW },
    );

    expect(order.map((c) => c.playerId)).toEqual(["rookie", "veteran"]);
  });

  it("treats waits inside the bucket as equal, not as a strict ordering", () => {
    const order = orderByFairness(
      [
        // 20s longer wait, but four more games played.
        candidate("veteran", {
          lastFinishedAt: agoMin(5) - 20_000,
          gamesPlayed: 6,
        }),
        candidate("rookie", { lastFinishedAt: agoMin(5), gamesPlayed: 2 }),
      ],
      { now: NOW },
    );

    expect(order[0].playerId).toBe("rookie");
  });

  it("respects a raw wait ordering when bucketing is switched off", () => {
    const order = orderByFairness(
      [
        candidate("veteran", {
          lastFinishedAt: agoMin(5) - 20_000,
          gamesPlayed: 6,
        }),
        candidate("rookie", { lastFinishedAt: agoMin(5), gamesPlayed: 2 }),
      ],
      { now: NOW, waitBucketMs: 0 },
    );

    expect(order[0].playerId).toBe("veteran");
  });

  it("is stable across calls so the board does not reshuffle on refresh", () => {
    const players = [
      candidate("b", { lastFinishedAt: agoMin(5), gamesPlayed: 3 }),
      candidate("a", { lastFinishedAt: agoMin(5), gamesPlayed: 3 }),
      candidate("c", { lastFinishedAt: agoMin(5), gamesPlayed: 3 }),
    ];

    const first = orderByFairness(players, { now: NOW }).map((c) => c.playerId);
    const second = orderByFairness([...players].reverse(), { now: NOW }).map(
      (c) => c.playerId,
    );

    expect(first).toEqual(["a", "b", "c"]);
    expect(second).toEqual(first);
  });

  it("does not mutate the input", () => {
    const players = [
      candidate("z", { lastFinishedAt: agoMin(1) }),
      candidate("a", { lastFinishedAt: agoMin(9) }),
    ];
    orderByFairness(players, { now: NOW });
    expect(players.map((c) => c.playerId)).toEqual(["z", "a"]);
  });
});

describe("buildNextMatches", () => {
  const eight = [
    candidate("p1", { lastFinishedAt: agoMin(10), gamesPlayed: 1 }),
    candidate("p2", { lastFinishedAt: agoMin(9), gamesPlayed: 2 }),
    candidate("p3", { lastFinishedAt: agoMin(8), gamesPlayed: 3 }),
    candidate("p4", { lastFinishedAt: agoMin(7), gamesPlayed: 4 }),
    candidate("p5", { lastFinishedAt: agoMin(6), gamesPlayed: 5 }),
    candidate("p6", { lastFinishedAt: agoMin(5), gamesPlayed: 6 }),
    candidate("p7", { lastFinishedAt: agoMin(4), gamesPlayed: 7 }),
    candidate("p8", { lastFinishedAt: agoMin(3), gamesPlayed: 8 }),
  ];

  it("fills each free court with the four who waited longest", () => {
    const { matches, waiting } = buildNextMatches({
      candidates: eight,
      freeCourts: [1, 2],
      now: NOW,
    });

    expect(matches).toEqual([
      { courtNo: 1, playerIds: ["p1", "p2", "p3", "p4"] },
      { courtNo: 2, playerIds: ["p5", "p6", "p7", "p8"] },
    ]);
    expect(waiting).toHaveLength(0);
  });

  it("leaves a court empty rather than starting a three-player game", () => {
    const { matches, waiting } = buildNextMatches({
      candidates: eight.slice(0, 7),
      freeCourts: [1, 2],
      now: NOW,
    });

    expect(matches).toHaveLength(1);
    expect(waiting.map((c) => c.playerId)).toEqual(["p5", "p6", "p7"]);
  });

  it("returns the leftovers in fairness order for the queue board", () => {
    const { waiting } = buildNextMatches({
      candidates: eight,
      freeCourts: [1],
      now: NOW,
    });

    expect(waiting.map((c) => c.playerId)).toEqual(["p5", "p6", "p7", "p8"]);
  });

  it("puts pinned players on court even when they just finished", () => {
    const { matches } = buildNextMatches({
      candidates: eight,
      freeCourts: [1],
      pinnedPlayerIds: ["p8"],
      now: NOW,
    });

    expect(matches[0].playerIds).toEqual(["p8", "p1", "p2", "p3"]);
  });

  it("proposes nothing when nobody is free", () => {
    const { matches, waiting } = buildNextMatches({
      candidates: [],
      freeCourts: [1, 2, 3],
      now: NOW,
    });

    expect(matches).toEqual([]);
    expect(waiting).toEqual([]);
  });

  it("proposes nothing when every court is busy", () => {
    const { matches, waiting } = buildNextMatches({
      candidates: eight,
      freeCourts: [],
      now: NOW,
    });

    expect(matches).toEqual([]);
    expect(waiting).toHaveLength(8);
  });

  it("supports a non-doubles match size", () => {
    const { matches } = buildNextMatches({
      candidates: eight,
      freeCourts: [1],
      playersPerMatch: 2,
      now: NOW,
    });

    expect(matches[0].playerIds).toEqual(["p1", "p2"]);
  });
});

describe("manual override", () => {
  const matches = [
    { courtNo: 1, playerIds: ["a", "b", "c", "d"] },
    { courtNo: 2, playerIds: ["e", "f", "g", "h"] },
  ];

  it("swaps two players across courts", () => {
    const next = swapPlayers(matches, "a", "h");

    expect(next[0].playerIds).toEqual(["h", "b", "c", "d"]);
    expect(next[1].playerIds).toEqual(["e", "f", "g", "a"]);
  });

  it("swaps two players on the same court", () => {
    const next = swapPlayers(matches, "a", "d");
    expect(next[0].playerIds).toEqual(["d", "b", "c", "a"]);
  });

  it("does not mutate the original proposal", () => {
    swapPlayers(matches, "a", "h");
    expect(matches[0].playerIds).toEqual(["a", "b", "c", "d"]);
  });

  it("names the player it could not find", () => {
    expect(() => swapPlayers(matches, "a", "nobody")).toThrow(/nobody/);
  });

  it("substitutes a waiting player in", () => {
    const next = substitutePlayer(matches, "c", "waiting");
    expect(next[0].playerIds).toEqual(["a", "b", "waiting", "d"]);
  });

  it("refuses to put someone on two courts at once", () => {
    expect(() => substitutePlayer(matches, "c", "e")).toThrow(/อยู่ในแมตช์อื่น/);
  });
});
