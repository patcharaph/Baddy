import { describe, expect, it } from "vitest";

import {
  isoToLocalDateTime,
  localDateTimeToIso,
  validateGuanDraft,
  validateSessionDraft,
  validateSessionEdit,
  type DraftResult,
  type FieldErrors,
  type RawSessionDraft,
  type RawSessionEdit,
} from "./drafts";

/** Bangkok: UTC+7, so getTimezoneOffset() reports -420. */
const BKK = "-420";

function sessionForm(overrides: RawSessionDraft = {}): RawSessionDraft {
  return {
    guanId: "guan-1",
    startsAtLocal: "2026-08-18T19:00",
    tzOffsetMinutes: BKK,
    courtCount: "2",
    courtRate: "600",
    splitMode: "buffet",
    buffetRate: "120",
    ...overrides,
  };
}

function errorsOf<T>(result: DraftResult<T>): FieldErrors {
  return result.ok ? {} : result.errors;
}

describe("localDateTimeToIso", () => {
  it("reads the wall clock in the player's zone, not the server's", () => {
    expect(localDateTimeToIso("2026-08-18T19:00", -420)).toBe("2026-08-18T12:00:00.000Z");
  });

  it("handles a zone behind UTC", () => {
    expect(localDateTimeToIso("2026-08-18T19:00", 300)).toBe("2026-08-19T00:00:00.000Z");
  });

  it("treats UTC itself as a zone like any other", () => {
    expect(localDateTimeToIso("2026-08-18T19:00", 0)).toBe("2026-08-18T19:00:00.000Z");
  });

  it("accepts the seconds some browsers include", () => {
    expect(localDateTimeToIso("2026-08-18T19:00:30", -420)).toBe(
      "2026-08-18T12:00:30.000Z",
    );
  });

  it("rejects a date the calendar does not have", () => {
    expect(localDateTimeToIso("2026-02-31T19:00", -420)).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(localDateTimeToIso("2028-02-29T19:00", 0)).toBe("2028-02-29T19:00:00.000Z");
  });

  it("rejects an hour that does not exist", () => {
    expect(localDateTimeToIso("2026-08-18T25:00", 0)).toBeNull();
  });

  it("rejects a minute that does not exist", () => {
    expect(localDateTimeToIso("2026-08-18T19:99", 0)).toBeNull();
  });

  it("rejects an offset no timezone has", () => {
    expect(localDateTimeToIso("2026-08-18T19:00", -5000)).toBeNull();
  });

  it("rejects a date with no time", () => {
    expect(localDateTimeToIso("2026-08-18", -420)).toBeNull();
  });

  it("rejects an empty value", () => {
    expect(localDateTimeToIso("", -420)).toBeNull();
  });
});

describe("validateGuanDraft", () => {
  it("takes a name and nothing else", () => {
    expect(validateGuanDraft({ name: "ก๊วนวันพุธ" })).toEqual({
      ok: true,
      value: { name: "ก๊วนวันพุธ", homeVenue: null, defaultCourtRate: 0 },
    });
  });

  it("trims the name rather than storing the spaces", () => {
    const result = validateGuanDraft({ name: "  ก๊วนวันพุธ  " });
    expect(result.ok && result.value.name).toBe("ก๊วนวันพุธ");
  });

  it("refuses a guan with no name", () => {
    expect(errorsOf(validateGuanDraft({ name: "   " }))).toHaveProperty("name");
  });

  it("refuses a name too long to fit a header", () => {
    expect(errorsOf(validateGuanDraft({ name: "ก".repeat(61) }))).toHaveProperty("name");
  });

  it("reads a blank venue as no venue", () => {
    const result = validateGuanDraft({ name: "ก๊วน", homeVenue: "  " });
    expect(result.ok && result.value.homeVenue).toBeNull();
  });

  it("reads a blank rate as zero, not as an error", () => {
    const result = validateGuanDraft({ name: "ก๊วน", defaultCourtRate: "" });
    expect(result.ok && result.value.defaultCourtRate).toBe(0);
  });

  it("refuses a fractional rate rather than rounding it", () => {
    expect(
      errorsOf(validateGuanDraft({ name: "ก๊วน", defaultCourtRate: "87.5" })),
    ).toHaveProperty("defaultCourtRate");
  });

  it("refuses a negative rate", () => {
    expect(
      errorsOf(validateGuanDraft({ name: "ก๊วน", defaultCourtRate: "-1" })),
    ).toHaveProperty("defaultCourtRate");
  });
});

describe("validateSessionDraft", () => {
  it("accepts a filled-in buffet session", () => {
    const result = validateSessionDraft(sessionForm({ venue: "ยิมเทศบาล", capacity: "16" }));

    expect(result).toEqual({
      ok: true,
      value: {
        guanId: "guan-1",
        venue: "ยิมเทศบาล",
        startsAt: "2026-08-18T12:00:00.000Z",
        endsAt: null,
        courtCount: 2,
        courtRate: 600,
        capacity: 16,
        splitMode: "buffet",
        buffetRate: 120,
        womenRate: null,
        perGameRate: null,
        shuttlesIncludedPerMatch: 1,
      },
    });
  });

  it("refuses a session with no guan behind it", () => {
    expect(errorsOf(validateSessionDraft(sessionForm({ guanId: "" })))).toHaveProperty(
      "guanId",
    );
  });

  it("refuses a session with no start time", () => {
    expect(
      errorsOf(validateSessionDraft(sessionForm({ startsAtLocal: "" }))),
    ).toHaveProperty("startsAtLocal");
  });

  // The offset is not defaulted, because assuming UTC stores a round seven hours
  // off a Bangkok guan with every visible field looking right.
  it("refuses a form that arrived without a timezone rather than assuming UTC", () => {
    const errors = errorsOf(validateSessionDraft(sessionForm({ tzOffsetMinutes: "" })));
    expect(errors).toHaveProperty("tzOffsetMinutes");
    expect(errors).not.toHaveProperty("startsAtLocal");
  });

  it("refuses an end time before the start", () => {
    expect(
      errorsOf(
        validateSessionDraft(
          sessionForm({ startsAtLocal: "2026-08-18T19:00", endsAtLocal: "2026-08-18T18:00" }),
        ),
      ),
    ).toHaveProperty("endsAtLocal");
  });

  it("refuses an end time equal to the start", () => {
    expect(
      errorsOf(
        validateSessionDraft(
          sessionForm({ startsAtLocal: "2026-08-18T19:00", endsAtLocal: "2026-08-18T19:00" }),
        ),
      ),
    ).toHaveProperty("endsAtLocal");
  });

  it("keeps an end time after the start", () => {
    const result = validateSessionDraft(
      sessionForm({ endsAtLocal: "2026-08-18T22:00" }),
    );
    expect(result.ok && result.value.endsAt).toBe("2026-08-18T15:00:00.000Z");
  });

  it("refuses a session with no courts", () => {
    expect(errorsOf(validateSessionDraft(sessionForm({ courtCount: "0" })))).toHaveProperty(
      "courtCount",
    );
  });

  // A blank quota is "whoever turns up", which is a normal way to run a guan.
  it("reads a blank quota as no quota", () => {
    const result = validateSessionDraft(sessionForm({ capacity: "" }));
    expect(result.ok && result.value.capacity).toBeNull();
  });

  // And zero is not that: the schema rejects it and placeJoiner reads it as full.
  it("refuses a quota of zero, pointing at the blank field instead", () => {
    expect(errorsOf(validateSessionDraft(sessionForm({ capacity: "0" })))).toHaveProperty(
      "capacity",
    );
  });

  it("refuses a split mode it does not have", () => {
    expect(
      errorsOf(validateSessionDraft(sessionForm({ splitMode: "per_minute" }))),
    ).toHaveProperty("splitMode");
  });

  // The check that exists so the money screen never opens on "ยังตั้งเรตไม่ครบ".
  it("refuses buffet mode with no buffet rate", () => {
    expect(
      errorsOf(validateSessionDraft(sessionForm({ splitMode: "buffet", buffetRate: "" }))),
    ).toHaveProperty("buffetRate");
  });

  it("refuses per-game mode with no per-game rate", () => {
    expect(
      errorsOf(
        validateSessionDraft(sessionForm({ splitMode: "per_game", buffetRate: "" })),
      ),
    ).toHaveProperty("perGameRate");
  });

  it("asks even-split mode for no rate at all", () => {
    const result = validateSessionDraft(
      sessionForm({ splitMode: "even", buffetRate: "" }),
    );
    expect(result.ok).toBe(true);
  });

  it("reports one error per field, not two, for unparseable input", () => {
    const errors = errorsOf(
      validateSessionDraft(sessionForm({ splitMode: "buffet", buffetRate: "ฟรี" })),
    );
    expect(errors.buffetRate).toBe("เรตเหมาจ่ายต้องเป็นจำนวนเต็ม");
  });

  it("keeps a women's rate in buffet mode, where the engine reads it", () => {
    const result = validateSessionDraft(sessionForm({ womenRate: "100" }));
    expect(result.ok && result.value.womenRate).toBe(100);
  });

  it("drops a women's rate in a mode that would never read it", () => {
    const result = validateSessionDraft(
      sessionForm({ splitMode: "even", buffetRate: "", womenRate: "100" }),
    );
    expect(result.ok && result.value.womenRate).toBeNull();
  });

  it("defaults the included shuttles to the one-per-match rule", () => {
    const result = validateSessionDraft(sessionForm());
    expect(result.ok && result.value.shuttlesIncludedPerMatch).toBe(1);
  });

  it("allows zero included shuttles", () => {
    const result = validateSessionDraft(sessionForm({ shuttlesIncludedPerMatch: "0" }));
    expect(result.ok && result.value.shuttlesIncludedPerMatch).toBe(0);
  });

  it("collects every bad field at once rather than stopping at the first", () => {
    const errors = errorsOf(
      validateSessionDraft({
        guanId: "",
        startsAtLocal: "",
        tzOffsetMinutes: BKK,
        courtCount: "0",
        splitMode: "",
      }),
    );

    expect(Object.keys(errors).sort()).toEqual([
      "courtCount",
      "guanId",
      "splitMode",
      "startsAtLocal",
    ]);
  });
});

describe("isoToLocalDateTime", () => {
  it("is the inverse of localDateTimeToIso", () => {
    expect(isoToLocalDateTime("2026-08-18T12:00:00.000Z", -420)).toBe(
      "2026-08-18T19:00",
    );
  });

  it("round-trips every offset the form can report", () => {
    for (const offset of [-720, -420, -330, 0, 300, 720]) {
      const iso = localDateTimeToIso("2026-08-18T19:00", offset);
      expect(iso).not.toBeNull();
      expect(isoToLocalDateTime(iso as string, offset)).toBe("2026-08-18T19:00");
    }
  });

  it("crosses the date line rather than clamping to the same day", () => {
    // 00:30 UTC is the previous evening in a zone behind UTC.
    expect(isoToLocalDateTime("2026-08-19T00:30:00.000Z", 300)).toBe(
      "2026-08-18T19:30",
    );
  });

  it("drops the seconds a stored instant carries", () => {
    expect(isoToLocalDateTime("2026-08-18T12:00:45.000Z", -420)).toBe(
      "2026-08-18T19:00",
    );
  });

  it("refuses an instant it cannot parse", () => {
    expect(isoToLocalDateTime("ไม่ใช่เวลา", -420)).toBeNull();
  });

  it("refuses an offset no timezone has", () => {
    expect(isoToLocalDateTime("2026-08-18T12:00:00.000Z", 15 * 60)).toBeNull();
    expect(isoToLocalDateTime("2026-08-18T12:00:00.000Z", NaN)).toBeNull();
  });
});

describe("validateSessionEdit", () => {
  function editForm(overrides: RawSessionEdit = {}): RawSessionEdit {
    return {
      sessionId: "session-1",
      startsAtLocal: "2026-08-18T19:00",
      tzOffsetMinutes: BKK,
      courtCount: "2",
      courtRate: "600",
      splitMode: "buffet",
      buffetRate: "120",
      ...overrides,
    };
  }

  it("accepts the same round the create form would have accepted", () => {
    const result = validateSessionEdit(editForm());

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toMatchObject({
      sessionId: "session-1",
      startsAt: "2026-08-18T12:00:00.000Z",
      courtCount: 2,
      courtRate: 600,
      splitMode: "buffet",
      buffetRate: 120,
    });
  });

  it("has no guan on it — an edit cannot move a round between guans", () => {
    const result = validateSessionEdit(
      editForm({ guanId: "another-guan" } as RawSessionEdit),
    );

    expect(result.ok).toBe(true);
    expect(result.ok && "guanId" in result.value).toBe(false);
  });

  it("needs to know which round it is editing", () => {
    expect(errorsOf(validateSessionEdit(editForm({ sessionId: "" })))).toHaveProperty(
      "sessionId",
    );
  });

  it("still refuses to clear the rate the chosen mode needs", () => {
    // The failure this prevents happens at settle-up, not here: a buffet round
    // whose rate is edited away is a money screen that cannot compute at 23:00.
    expect(
      errorsOf(validateSessionEdit(editForm({ buffetRate: "" }))),
    ).toHaveProperty("buffetRate");

    expect(
      errorsOf(
        validateSessionEdit(editForm({ splitMode: "per_game", perGameRate: "" })),
      ),
    ).toHaveProperty("perGameRate");
  });

  it("still refuses a round with no timezone behind its times", () => {
    expect(
      errorsOf(validateSessionEdit(editForm({ tzOffsetMinutes: null }))),
    ).toHaveProperty("tzOffsetMinutes");
  });

  it("still refuses an end time before the start", () => {
    expect(
      errorsOf(validateSessionEdit(editForm({ endsAtLocal: "2026-08-18T18:00" }))),
    ).toHaveProperty("endsAtLocal");
  });

  it("drops a women's rate when the mode is no longer buffet", () => {
    const result = validateSessionEdit(
      editForm({ splitMode: "even", womenRate: "200" }),
    );

    expect(result.ok && result.value.womenRate).toBeNull();
  });

  it("allows a capacity below the number already checked in", () => {
    // Nobody is removed by this — `placeJoiner` sends the *next* arrival to the
    // waitlist. The validator has no board to check against and should not
    // pretend otherwise.
    const result = validateSessionEdit(editForm({ capacity: "1" }));
    expect(result.ok && result.value.capacity).toBe(1);
  });
});
