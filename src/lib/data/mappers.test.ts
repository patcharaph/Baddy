import { describe, expect, it } from "vitest";

import {
  avatarColor,
  countCheckedIn,
  toCostParticipants,
  toFinishedMatches,
  toFreeCourts,
  toLiveCourts,
  toQueueCandidates,
  toQueueEntries,
  toShuttleLogs,
  toWaitlist,
} from "./mappers";
import type { MatchRow, ParticipantRow } from "./types";

const NOW = Date.UTC(2026, 9, 26, 14, 30, 0);
const MINUTE = 60_000;
const iso = (minutesAgo: number) =>
  new Date(NOW - minutesAgo * MINUTE).toISOString();

function participant(
  playerId: string,
  overrides: Partial<ParticipantRow> = {},
): ParticipantRow {
  return {
    player_id: playerId,
    status: "checked_in",
    waitlist_position: null,
    check_in_at: iso(90),
    check_out_at: null,
    players: {
      id: playerId,
      display_name: playerId.toUpperCase(),
      skill_level: "P",
      avatar_url: null,
      is_woman: false,
    },
    ...overrides,
  };
}

function match(
  id: string,
  courtNo: number,
  status: MatchRow["status"],
  playerIds: string[],
  overrides: Partial<MatchRow> = {},
): MatchRow {
  return {
    id,
    court_no: courtNo,
    status,
    started_at: iso(20),
    ended_at: status === "done" ? iso(10) : null,
    match_players: playerIds.map((player_id) => ({ player_id })),
    ...overrides,
  };
}

describe("avatarColor", () => {
  it("gives the same player the same colour every time", () => {
    expect(avatarColor("champ")).toBe(avatarColor("champ"));
  });

  it("spreads different players across the palette", () => {
    const colors = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map(avatarColor),
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("toLiveCourts", () => {
  it("keeps only matches in play, ordered by court", () => {
    const courts = toLiveCourts([
      match("m3", 3, "playing", ["g", "h", "i", "j"]),
      match("m1", 1, "playing", ["a", "b", "c", "d"]),
      match("m2", 2, "done", ["e", "f", "g", "h"]),
      match("m4", 4, "queued", ["k", "l", "m", "n"]),
    ]);

    expect(courts.map((c) => c.courtNo)).toEqual([1, 3]);
    expect(courts[0].playerIds).toEqual(["a", "b", "c", "d"]);
  });

  it("exposes the start time as epoch ms for the timer", () => {
    const [court] = toLiveCourts([match("m1", 1, "playing", ["a"])]);
    expect(court.startedAt).toBe(NOW - 20 * MINUTE);
  });
});

describe("toFreeCourts", () => {
  it("returns courts with nothing on them", () => {
    const free = toFreeCourts(3, [match("m1", 2, "playing", ["a", "b", "c", "d"])]);
    expect(free).toEqual([1, 3]);
  });

  it("treats an arranged-but-not-started match as occupying its court", () => {
    const free = toFreeCourts(3, [match("m1", 1, "queued", ["a", "b", "c", "d"])]);
    expect(free).toEqual([2, 3]);
  });

  it("frees a court once its match is done", () => {
    const free = toFreeCourts(2, [match("m1", 1, "done", ["a", "b", "c", "d"])]);
    expect(free).toEqual([1, 2]);
  });

  it("returns nothing when every court is busy", () => {
    const free = toFreeCourts(2, [
      match("m1", 1, "playing", ["a"]),
      match("m2", 2, "playing", ["b"]),
    ]);
    expect(free).toEqual([]);
  });
});

describe("toQueueCandidates", () => {
  const matches: MatchRow[] = [
    match("m1", 1, "playing", ["onCourt1", "onCourt2"]),
    match("m2", 2, "done", ["waiting1", "waiting2"], { ended_at: iso(8) }),
    match("m3", 2, "done", ["waiting1"], { ended_at: iso(3) }),
  ];

  const participants: ParticipantRow[] = [
    participant("onCourt1"),
    participant("waiting1"),
    participant("waiting2"),
    participant("wentHome", { status: "checked_out", check_out_at: iso(5) }),
    participant("stillWaitlisted", { status: "waitlist", waitlist_position: 1 }),
    participant("neverShowed", { status: "rsvp", check_in_at: null }),
  ];

  it("excludes players who are on court", () => {
    const ids = toQueueCandidates(participants, matches).map((c) => c.playerId);
    expect(ids).not.toContain("onCourt1");
  });

  it("excludes players who went home, are waitlisted, or never checked in", () => {
    const ids = toQueueCandidates(participants, matches).map((c) => c.playerId);
    expect(ids).toEqual(["waiting1", "waiting2"]);
  });

  it("counts finished games per player", () => {
    const candidates = toQueueCandidates(participants, matches);
    expect(candidates.find((c) => c.playerId === "waiting1")?.gamesPlayed).toBe(2);
    expect(candidates.find((c) => c.playerId === "waiting2")?.gamesPlayed).toBe(1);
  });

  it("takes the most recent finish as the wait clock", () => {
    const candidates = toQueueCandidates(participants, matches);
    expect(candidates.find((c) => c.playerId === "waiting1")?.lastFinishedAt).toBe(
      NOW - 3 * MINUTE,
    );
  });

  it("leaves lastFinishedAt null for someone who has not played", () => {
    const candidates = toQueueCandidates([participant("fresh")], []);
    expect(candidates[0].lastFinishedAt).toBeNull();
    expect(candidates[0].checkedInAt).toBe(NOW - 90 * MINUTE);
  });

  it("ignores a finished match with no end time rather than crashing", () => {
    const candidates = toQueueCandidates(
      [participant("a")],
      [match("m1", 1, "done", ["a"], { ended_at: null })],
    );

    expect(candidates[0].gamesPlayed).toBe(1);
    expect(candidates[0].lastFinishedAt).toBeNull();
  });
});

describe("toQueueEntries", () => {
  it("orders by fairness and reports the numbers the board shows", () => {
    const entries = toQueueEntries(
      [
        {
          playerId: "justFinished",
          gamesPlayed: 5,
          lastFinishedAt: NOW - 2 * MINUTE,
          checkedInAt: NOW - 60 * MINUTE,
        },
        {
          playerId: "longWait",
          gamesPlayed: 2,
          lastFinishedAt: NOW - 11 * MINUTE,
          checkedInAt: NOW - 60 * MINUTE,
        },
      ],
      NOW,
    );

    expect(entries[0]).toEqual({
      playerId: "longWait",
      gamesPlayed: 2,
      waitedMinutes: 11,
    });
    expect(entries[1].waitedMinutes).toBe(2);
  });
});

describe("toCostParticipants", () => {
  it("bills players who are here and players who went home", () => {
    const participants = [
      participant("here"),
      participant("wentHome", { status: "checked_out", check_out_at: iso(5) }),
      participant("waitlisted", { status: "waitlist" }),
      participant("cancelled", { status: "cancelled" }),
      participant("noShow", { status: "rsvp" }),
    ];

    expect(toCostParticipants(participants).map((p) => p.playerId)).toEqual([
      "here",
      "wentHome",
    ]);
  });

  it("carries the women's-rate flag through", () => {
    const row = participant("nan");
    row.players!.is_woman = true;
    expect(toCostParticipants([row])[0].isWoman).toBe(true);
  });

  it("survives a missing player join instead of rendering undefined", () => {
    const row = participant("ghost", { players: null });
    expect(toCostParticipants([row])[0].displayName).toBe("ไม่ทราบชื่อ");
  });
});

describe("toFinishedMatches", () => {
  it("keeps only done matches", () => {
    const finished = toFinishedMatches([
      match("m1", 1, "done", ["a", "b"]),
      match("m2", 2, "playing", ["c", "d"]),
    ]);

    expect(finished).toEqual([{ matchId: "m1", playerIds: ["a", "b"] }]);
  });
});

describe("toShuttleLogs", () => {
  it("maps to the cost engine's shape", () => {
    expect(
      toShuttleLogs([{ match_id: "m1", count: 2, unit_price: 60 }]),
    ).toEqual([{ matchId: "m1", count: 2, unitPrice: 60 }]);
  });
});

describe("toWaitlist", () => {
  it("orders by waitlist position", () => {
    const waitlist = toWaitlist([
      participant("second", { status: "waitlist", waitlist_position: 2 }),
      participant("first", { status: "waitlist", waitlist_position: 1 }),
      participant("playing"),
    ]);

    expect(waitlist.map((p) => p.id)).toEqual(["first", "second"]);
  });

  it("puts rows with no position last rather than dropping them", () => {
    const waitlist = toWaitlist([
      participant("unpositioned", { status: "waitlist", waitlist_position: null }),
      participant("first", { status: "waitlist", waitlist_position: 1 }),
    ]);

    expect(waitlist.map((p) => p.id)).toEqual(["first", "unpositioned"]);
  });
});

describe("countCheckedIn", () => {
  it("counts only players currently at the venue", () => {
    expect(
      countCheckedIn([
        participant("a"),
        participant("b"),
        participant("gone", { status: "checked_out" }),
        participant("waiting", { status: "waitlist" }),
      ]),
    ).toBe(2);
  });
});
