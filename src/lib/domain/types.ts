/**
 * Domain types shared by the queue engine, the cost engine and the UI.
 * Mirrors the tables in supabase/migrations/0001_init.sql.
 */

export type PlayerId = string;

/**
 * ⚠️ OPEN QUESTION (docs/line-guan-badminton-prd.md §11): the skill scale is not
 * confirmed yet. These are the values the mockup uses, ordered weakest → strongest.
 */
export const SKILL_LEVELS = [
  "มือหน้าบ้าน",
  "N",
  "S",
  "P-",
  "P",
  "P+",
  "C",
  "B",
  "A",
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export type MemberRole = "organizer" | "player";

export type ParticipantStatus =
  | "rsvp"
  | "checked_in"
  | "waitlist"
  | "checked_out"
  | "cancelled";

export type MatchStatus = "queued" | "playing" | "done";

/** The three split modes real Thai guans use — see PRD FR-7. */
export type SplitMode = "buffet" | "per_game" | "even";

export const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  buffet: "บุฟเฟ่ต์",
  per_game: "รายเกม",
  even: "หารเท่ากัน",
};

export interface Player {
  id: PlayerId;
  lineUserId: string;
  displayName: string;
  skillLevel: SkillLevel | null;
  /** Only used to pick the women's buffet rate — see PRD FR-7. */
  isWoman?: boolean;
}
