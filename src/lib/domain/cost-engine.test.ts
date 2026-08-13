import { describe, expect, it } from "vitest";

import {
  collectedTotal,
  computeCostShares,
  type CostInput,
  type CostParticipant,
} from "./cost-engine";

const participants: CostParticipant[] = [
  { playerId: "champ", displayName: "แชมป์" },
  { playerId: "boss", displayName: "บอส" },
  { playerId: "fah", displayName: "ฟ้า", isWoman: true },
  { playerId: "jo", displayName: "โจ้" },
  { playerId: "min", displayName: "มิ้น", isWoman: true },
  { playerId: "james", displayName: "เจมส์" },
];

const sumOf = (nums: number[]) => nums.reduce((a, b) => a + b, 0);

describe("buffet mode", () => {
  const base: CostInput = {
    splitMode: "buffet",
    participants,
    courtTotal: 900,
    buffetRate: 230,
    womenRate: 200,
  };

  it("charges one flat rate per head", () => {
    const result = computeCostShares(base);
    expect(result.shares.find((s) => s.playerId === "boss")?.total).toBe(230);
  });

  it("applies the women's rate when the guan sets one", () => {
    const result = computeCostShares(base);
    expect(result.shares.find((s) => s.playerId === "fah")?.total).toBe(200);
  });

  it("falls back to the single rate when no women's rate is set", () => {
    const result = computeCostShares({ ...base, womenRate: undefined });
    expect(result.shares.find((s) => s.playerId === "fah")?.total).toBe(230);
  });

  it("ignores court and shuttle data entirely", () => {
    const result = computeCostShares({
      ...base,
      shuttleLogs: [{ matchId: null, count: 20, unitPrice: 50 }],
    });

    expect(result.courtTotal).toBe(0);
    expect(result.shuttleTotal).toBe(0);
    expect(result.grandTotal).toBe(230 * 4 + 200 * 2);
  });

  it("tells the player the shuttles are already included", () => {
    const result = computeCostShares(base);
    expect(result.shares[0].breakdown).toContain("ค่าลูกรวมในเรตแล้ว");
  });

  it("names the missing setting instead of returning a wrong number", () => {
    expect(() =>
      computeCostShares({ ...base, buffetRate: undefined }),
    ).toThrow(/เรตเหมาจ่าย/);
  });
});

describe("per-game mode", () => {
  // champ: 3 games, boss: 2, fah: 1 — the rest sit out some rounds.
  const matches = [
    { matchId: "m1", playerIds: ["champ", "boss", "fah", "jo"] },
    { matchId: "m2", playerIds: ["champ", "boss", "min", "james"] },
    { matchId: "m3", playerIds: ["champ", "jo", "min", "james"] },
  ];

  const base: CostInput = {
    splitMode: "per_game",
    participants,
    courtTotal: 900,
    perGameRate: 25,
    matches,
    shuttleLogs: [],
  };

  it("charges shuttles by games played", () => {
    const result = computeCostShares(base);
    const champ = result.shares.find((s) => s.playerId === "champ")!;
    const fah = result.shares.find((s) => s.playerId === "fah")!;

    expect(champ.detail.gamesPlayed).toBe(3);
    expect(champ.shuttleShare).toBe(75);
    expect(fah.detail.gamesPlayed).toBe(1);
    expect(fah.shuttleShare).toBe(25);
  });

  it("charges nothing for shuttles to someone who never got on court", () => {
    const result = computeCostShares({
      ...base,
      participants: [...participants, { playerId: "late", displayName: "มาสาย" }],
    });

    const late = result.shares.find((s) => s.playerId === "late")!;
    expect(late.shuttleShare).toBe(0);
    expect(late.total).toBe(late.courtShare);
  });

  it("splits the court evenly and loses nothing to rounding", () => {
    const result = computeCostShares(base);
    expect(sumOf(result.shares.map((s) => s.courtShare))).toBe(900);
  });

  it("charges over-quota shuttles only to the players of that match", () => {
    // m1 burned 3 shuttles; 1 is included, so 2 extra at ฿60 = ฿120 across 4.
    const result = computeCostShares({
      ...base,
      shuttleLogs: [{ matchId: "m1", count: 3, unitPrice: 60 }],
    });

    const champ = result.shares.find((s) => s.playerId === "champ")!;
    const james = result.shares.find((s) => s.playerId === "james")!;

    expect(champ.detail.extraShuttles).toBe(2);
    expect(champ.detail.extraShuttleCost).toBe(30);
    expect(champ.shuttleShare).toBe(75 + 30);

    // james was not in m1, so the extras are not his problem.
    expect(james.detail.extraShuttles).toBe(0);
    expect(james.shuttleShare).toBe(50);
  });

  it("charges nothing extra when a match stays inside its quota", () => {
    const result = computeCostShares({
      ...base,
      shuttleLogs: [{ matchId: "m1", count: 1, unitPrice: 60 }],
    });

    expect(result.shares.every((s) => s.detail.extraShuttles === 0)).toBe(true);
  });

  it("ignores shuttles logged without a match", () => {
    const result = computeCostShares({
      ...base,
      shuttleLogs: [{ matchId: null, count: 5, unitPrice: 60 }],
    });

    expect(result.shares.every((s) => s.detail.extraShuttleCost === 0)).toBe(
      true,
    );
  });

  it("averages the price when one match logged shuttles at two prices", () => {
    // 2 x ฿60 + 2 x ฿40 = ฿200 over 4 shuttles = ฿50 each; 3 are extra = ฿150.
    const result = computeCostShares({
      ...base,
      shuttleLogs: [
        { matchId: "m1", count: 2, unitPrice: 60 },
        { matchId: "m1", count: 2, unitPrice: 40 },
      ],
    });

    const champ = result.shares.find((s) => s.playerId === "champ")!;
    const jo = result.shares.find((s) => s.playerId === "jo")!;

    expect(jo.detail.extraShuttles).toBe(3);
    // ฿150 across the 4 in m1 = [38, 38, 37, 37]; jo is last in that match.
    expect(champ.detail.extraShuttleCost).toBe(38);
    expect(jo.detail.extraShuttleCost).toBe(37);
  });

  it("shows the player where the number came from", () => {
    const result = computeCostShares({
      ...base,
      shuttleLogs: [{ matchId: "m1", count: 3, unitPrice: 60 }],
    });

    const champ = result.shares.find((s) => s.playerId === "champ")!;
    expect(champ.breakdown).toBe("3 เกม × ฿25 · ลูกเกิน 2 ลูก ฿30 · สนาม ฿150");
  });

  it("reconciles: every share adds up to the session total", () => {
    const result = computeCostShares({
      ...base,
      shuttleLogs: [{ matchId: "m2", count: 4, unitPrice: 55 }],
    });

    expect(sumOf(result.shares.map((s) => s.total))).toBe(result.grandTotal);
  });

  it("names the missing setting instead of returning a wrong number", () => {
    expect(() =>
      computeCostShares({ ...base, perGameRate: undefined }),
    ).toThrow(/เรตค่าลูกต่อเกม/);
  });
});

describe("even mode", () => {
  const base: CostInput = {
    splitMode: "even",
    participants,
    courtTotal: 900,
    shuttleLogs: [
      { matchId: "m1", count: 10, unitPrice: 50 },
      { matchId: "m2", count: 6, unitPrice: 50 },
    ],
  };

  it("charges everyone the same", () => {
    const result = computeCostShares(base);
    const totals = new Set(result.shares.map((s) => s.total));

    expect(result.shuttleTotal).toBe(800);
    expect(totals).toEqual(new Set([283, 284])); // ฿1,700 over 6 people
  });

  it("reconciles: every share adds up to the session total", () => {
    const result = computeCostShares(base);
    expect(sumOf(result.shares.map((s) => s.total))).toBe(1700);
    expect(result.grandTotal).toBe(1700);
  });

  it("works with no shuttles logged at all", () => {
    const result = computeCostShares({ ...base, shuttleLogs: [] });
    expect(result.shuttleTotal).toBe(0);
    expect(sumOf(result.shares.map((s) => s.total))).toBe(900);
  });

  it("shows the headcount and the shuttle count in the breakdown", () => {
    const result = computeCostShares(base);
    expect(result.shares[0].breakdown).toContain("หารเท่ากัน 6 คน");
    expect(result.shares[0].breakdown).toContain("16 ลูก");
  });
});

describe("guards", () => {
  it("refuses to divide by an empty session", () => {
    expect(() =>
      computeCostShares({
        splitMode: "even",
        participants: [],
        courtTotal: 900,
      }),
    ).toThrow(/ยังไม่มีผู้เข้าร่วม/);
  });

  it("rejects a negative rate", () => {
    expect(() =>
      computeCostShares({
        splitMode: "buffet",
        participants,
        courtTotal: 0,
        buffetRate: -10,
      }),
    ).toThrow(/ติดลบ/);
  });
});

describe("collectedTotal", () => {
  it("adds up only the players who have paid", () => {
    const result = computeCostShares({
      splitMode: "buffet",
      participants,
      courtTotal: 0,
      buffetRate: 230,
      womenRate: 200,
    });

    expect(collectedTotal(result, ["boss", "min"])).toBe(430);
    expect(collectedTotal(result, [])).toBe(0);
  });
});
