/**
 * What a form submitted, turned into something a row can be made of.
 *
 * The two creation flows (a guan, a session) are the only places in the app
 * where a human types the numbers the engines later divide by, so this is where
 * a `court_rate` of `"๑๐๐"`, a capacity of `"0"` and a buffet session with no
 * buffet rate have to be caught. Pure and tested for the usual reason: a
 * validator that needs a database to exercise never gets exercised.
 *
 * The mode-specific rate checks mirror `requireRate` in `cost-engine.ts` on
 * purpose. The engine already refuses to compute without them — but it refuses
 * at settle-up, hours later, in front of everyone waiting to pay. Refusing at
 * creation is the same rule enforced at the only moment it is cheap.
 */

import type { SplitMode } from "@/lib/supabase/database.types";

/** Field name → the sentence to show under that field. */
export type FieldErrors = Record<string, string>;

export type DraftResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

const SPLIT_MODES: readonly SplitMode[] = ["buffet", "per_game", "even"];

/** Long enough for "ก๊วนแบดวันพุธ ยิมเทศบาล 2", short enough to fit a header. */
const NAME_MAX = 60;
const VENUE_MAX = 80;

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

function text(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function optionalText(raw: string | null | undefined): string | null {
  const value = text(raw);
  return value === "" ? null : value;
}

/**
 * A whole number of baht, or a sentence saying why it is not one.
 *
 * Fractional input is rejected rather than rounded: `splitEvenly` refuses
 * fractional baht, so a rate of 87.5 would become a settle-up that cannot be
 * computed at all. Failing on the field the number was typed into is the version
 * of that the organizer can act on.
 */
function integer(
  raw: string | null | undefined,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const value = text(raw);
  if (value === "") return { ok: false, error: `ต้องกรอก${label}` };
  if (!/^-?\d+$/.test(value)) {
    return { ok: false, error: `${label}ต้องเป็นจำนวนเต็ม` };
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return { ok: false, error: `${label}เกินช่วงที่รับได้` };
  }
  return { ok: true, value: parsed };
}

/**
 * Convert what a `datetime-local` input submitted into an instant.
 *
 * `datetime-local` has no zone, and `new Date("2026-08-18T19:00")` resolves it
 * against whatever zone the *server* runs in. A guan playing at 19:00 in Bangkok
 * would be stored as 19:00 UTC by a server in London — the round would appear to
 * start at 02:00, and every "waited how long" on the board would be wrong by
 * seven hours. So the offset travels with the value, read in the browser where
 * "local" is actually the player's.
 */
export function localDateTimeToIso(
  value: string,
  tzOffsetMinutes: number,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  if (!Number.isFinite(tzOffsetMinutes)) return null;

  // Real offsets live inside ±14:00. Anything past that is a crafted post, not a
  // timezone, and would move the round to a different day.
  if (Math.abs(tzOffsetMinutes) > 14 * 60) return null;

  const [, ys, mos, ds, hs, mis, ss] = match;
  const [y, mo, d, h, mi, s] = [ys, mos, ds, hs, mis, ss ?? "0"].map(Number);

  if (h > 23 || mi > 59 || s > 59) return null;

  const naiveMs = Date.UTC(y, mo - 1, d, h, mi, s);

  // Date.UTC rolls 2026-02-31 forward into March without complaint. The form's
  // date picker never submits one, but this is reachable from a raw post, and a
  // session silently moved three days is worse than a refusal.
  const naive = new Date(naiveMs);
  if (
    naive.getUTCFullYear() !== y ||
    naive.getUTCMonth() !== mo - 1 ||
    naive.getUTCDate() !== d
  ) {
    return null;
  }

  // getTimezoneOffset() is the minutes to *add* to local time to reach UTC,
  // which is why this adds rather than subtracts.
  return new Date(naiveMs + tzOffsetMinutes * 60_000).toISOString();
}

// ---------------------------------------------------------------------------
// Guan
// ---------------------------------------------------------------------------

export interface GuanDraft {
  name: string;
  homeVenue: string | null;
  defaultCourtRate: number;
}

export interface RawGuanDraft {
  name?: string | null;
  homeVenue?: string | null;
  defaultCourtRate?: string | null;
}

/**
 * A guan needs a name and nothing else (US-1.1).
 *
 * The venue and the rate are defaults the organizer overrides per session, so
 * demanding them here would put a form between someone and the guan they are
 * trying to create before they know either. An empty rate means zero, not an
 * error.
 */
export function validateGuanDraft(raw: RawGuanDraft): DraftResult<GuanDraft> {
  const errors: FieldErrors = {};

  const name = text(raw.name);
  if (name === "") {
    errors.name = "ต้องตั้งชื่อก๊วนก่อน";
  } else if (name.length > NAME_MAX) {
    errors.name = `ชื่อก๊วนยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`;
  }

  const homeVenue = optionalText(raw.homeVenue);
  if (homeVenue !== null && homeVenue.length > VENUE_MAX) {
    errors.homeVenue = `ชื่อสนามยาวได้ไม่เกิน ${VENUE_MAX} ตัวอักษร`;
  }

  let defaultCourtRate = 0;
  if (text(raw.defaultCourtRate) !== "") {
    const parsed = integer(raw.defaultCourtRate, "ค่าคอร์ทตั้งต้น");
    if (!parsed.ok) {
      errors.defaultCourtRate = parsed.error;
    } else if (parsed.value < 0) {
      errors.defaultCourtRate = "ค่าคอร์ทติดลบไม่ได้";
    } else {
      defaultCourtRate = parsed.value;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, homeVenue, defaultCourtRate } };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SessionDraft {
  guanId: string;
  venue: string | null;
  startsAt: string;
  endsAt: string | null;
  courtCount: number;
  courtRate: number;
  capacity: number | null;
  splitMode: SplitMode;
  buffetRate: number | null;
  womenRate: number | null;
  perGameRate: number | null;
  shuttlesIncludedPerMatch: number;
}

export interface RawSessionDraft {
  guanId?: string | null;
  venue?: string | null;
  /** `datetime-local` value, e.g. `2026-08-18T19:00`. */
  startsAtLocal?: string | null;
  endsAtLocal?: string | null;
  /** `new Date().getTimezoneOffset()` from the browser that rendered the form. */
  tzOffsetMinutes?: string | null;
  courtCount?: string | null;
  courtRate?: string | null;
  capacity?: string | null;
  splitMode?: string | null;
  buffetRate?: string | null;
  womenRate?: string | null;
  perGameRate?: string | null;
  shuttlesIncludedPerMatch?: string | null;
}

export function validateSessionDraft(raw: RawSessionDraft): DraftResult<SessionDraft> {
  const errors: FieldErrors = {};

  const guanId = text(raw.guanId);
  if (guanId === "") errors.guanId = "ยังไม่ได้เลือกก๊วน";

  // No silent default. A missing offset used to mean "assume UTC", and the
  // failure that produces is a round stored seven hours off with every field on
  // the form looking correct — the kind of bug nobody reports as a bug.
  const offset = integer(raw.tzOffsetMinutes, "เขตเวลา");
  if (!offset.ok) {
    errors.tzOffsetMinutes = "อ่านเขตเวลาของเครื่องไม่ได้ — ลองรีเฟรชหน้านี้";
  }
  const tzOffsetMinutes = offset.ok ? offset.value : null;

  const startsAt =
    tzOffsetMinutes === null
      ? null
      : localDateTimeToIso(text(raw.startsAtLocal), tzOffsetMinutes);
  if (startsAt === null && !errors.tzOffsetMinutes) {
    errors.startsAtLocal = "ต้องเลือกวันและเวลาเริ่ม";
  }

  let endsAt: string | null = null;
  if (tzOffsetMinutes !== null && text(raw.endsAtLocal) !== "") {
    endsAt = localDateTimeToIso(text(raw.endsAtLocal), tzOffsetMinutes);
    if (endsAt === null) {
      errors.endsAtLocal = "เวลาเลิกไม่ถูกต้อง";
    } else if (startsAt !== null && endsAt <= startsAt) {
      errors.endsAtLocal = "เวลาเลิกต้องอยู่หลังเวลาเริ่ม";
    }
  }

  let courtCount = 1;
  const courts = integer(raw.courtCount, "จำนวนคอร์ท");
  if (!courts.ok) {
    errors.courtCount = courts.error;
  } else if (courts.value < 1) {
    errors.courtCount = "ต้องมีอย่างน้อย 1 คอร์ท";
  } else {
    courtCount = courts.value;
  }

  let courtRate = 0;
  if (text(raw.courtRate) !== "") {
    const rate = integer(raw.courtRate, "ค่าคอร์ท");
    if (!rate.ok) {
      errors.courtRate = rate.error;
    } else if (rate.value < 0) {
      errors.courtRate = "ค่าคอร์ทติดลบไม่ได้";
    } else {
      courtRate = rate.value;
    }
  }

  // Blank means "no quota", which is a real and common choice — a guan that
  // takes whoever turns up. It is not the same as 0, which the schema rejects
  // and `placeJoiner` reads as permanently full.
  let capacity: number | null = null;
  if (text(raw.capacity) !== "") {
    const parsed = integer(raw.capacity, "โควตาผู้เล่น");
    if (!parsed.ok) {
      errors.capacity = parsed.error;
    } else if (parsed.value < 1) {
      errors.capacity = "โควตาต้องมากกว่า 0 — เว้นว่างถ้าไม่จำกัด";
    } else {
      capacity = parsed.value;
    }
  }

  const modeRaw = text(raw.splitMode);
  const splitMode = SPLIT_MODES.includes(modeRaw as SplitMode)
    ? (modeRaw as SplitMode)
    : null;
  if (splitMode === null) errors.splitMode = "ต้องเลือกวิธีหารเงิน";

  const optionalRate = (
    key: keyof RawSessionDraft & string,
    label: string,
  ): number | null => {
    if (text(raw[key]) === "") return null;
    const parsed = integer(raw[key], label);
    if (!parsed.ok) {
      errors[key] = parsed.error;
      return null;
    }
    if (parsed.value < 0) {
      errors[key] = `${label}ติดลบไม่ได้`;
      return null;
    }
    return parsed.value;
  };

  const buffetRate = optionalRate("buffetRate", "เรตเหมาจ่าย");
  const womenRate = optionalRate("womenRate", "เรตหญิง");
  const perGameRate = optionalRate("perGameRate", "เรตค่าลูกต่อเกม");

  // The rate the chosen mode cannot do without. Only reported when the field
  // itself parsed cleanly, so "abc" does not produce two errors on one input.
  if (splitMode === "buffet" && buffetRate === null && !errors.buffetRate) {
    errors.buffetRate = "โหมดเหมาจ่ายต้องตั้งเรตเหมาจ่าย";
  }
  if (splitMode === "per_game" && perGameRate === null && !errors.perGameRate) {
    errors.perGameRate = "โหมดรายเกมต้องตั้งเรตค่าลูกต่อเกม";
  }

  let shuttlesIncludedPerMatch = 1;
  if (text(raw.shuttlesIncludedPerMatch) !== "") {
    const parsed = integer(raw.shuttlesIncludedPerMatch, "ลูกที่รวมในเรตต่อแมตช์");
    if (!parsed.ok) {
      errors.shuttlesIncludedPerMatch = parsed.error;
    } else if (parsed.value < 0) {
      errors.shuttlesIncludedPerMatch = "ติดลบไม่ได้";
    } else {
      shuttlesIncludedPerMatch = parsed.value;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Unreachable: both of these push an error above. Kept as a real check rather
  // than asserted away, because an assertion is a comment that stops being true
  // the moment the checks above are edited.
  if (startsAt === null || splitMode === null) {
    return { ok: false, errors: { splitMode: "ข้อมูลรอบไม่ครบ" } };
  }

  return {
    ok: true,
    value: {
      guanId,
      venue: optionalText(raw.venue),
      startsAt,
      endsAt,
      courtCount,
      courtRate,
      capacity,
      splitMode,
      buffetRate,
      // A women's rate only means anything in buffet mode, where the engine
      // reads it. Carrying it into the other two would leave a number on the row
      // that nothing uses and the next reader has to explain.
      womenRate: splitMode === "buffet" ? womenRate : null,
      perGameRate,
      shuttlesIncludedPerMatch,
    },
  };
}
