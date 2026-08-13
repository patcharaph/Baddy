import { describe, expect, it } from "vitest";

import { baht, formatBaht, formatElapsed, splitEvenly } from "./money";

describe("splitEvenly", () => {
  it("splits a clean division equally", () => {
    expect(splitEvenly(900, 6)).toEqual([150, 150, 150, 150, 150, 150]);
  });

  it("never loses a baht to rounding", () => {
    const shares = splitEvenly(900, 7);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(900);
    expect(shares).toEqual([129, 129, 129, 129, 128, 128, 128]);
  });

  it("gives the remainder to the earliest shares", () => {
    expect(splitEvenly(10, 4)).toEqual([3, 3, 2, 2]);
  });

  it("handles one participant paying everything", () => {
    expect(splitEvenly(455, 1)).toEqual([455]);
  });

  it("handles zero", () => {
    expect(splitEvenly(0, 3)).toEqual([0, 0, 0]);
  });

  it("rejects a headcount of zero rather than dividing by it", () => {
    expect(() => splitEvenly(300, 0)).toThrow(/มากกว่า 0/);
  });

  it("rejects fractional baht", () => {
    expect(() => splitEvenly(300.5, 2)).toThrow(/จำนวนเต็มบาท/);
  });
});

describe("formatBaht", () => {
  it("groups thousands", () => {
    expect(formatBaht(1250)).toBe("1,250");
    expect(formatBaht(1250000)).toBe("1,250,000");
  });

  it("leaves short numbers alone", () => {
    expect(formatBaht(230)).toBe("230");
    expect(formatBaht(0)).toBe("0");
  });

  it("keeps the sign in front", () => {
    expect(formatBaht(-1250)).toBe("-1,250");
  });

  it("prefixes the currency symbol", () => {
    expect(baht(1250)).toBe("฿1,250");
  });
});

describe("formatElapsed", () => {
  it("renders mm:ss", () => {
    expect(formatElapsed(0, 750_000)).toBe("12:30");
    expect(formatElapsed(0, 6_000)).toBe("00:06");
  });

  it("clamps a clock that has not started yet", () => {
    expect(formatElapsed(1_000, 0)).toBe("00:00");
  });
});
