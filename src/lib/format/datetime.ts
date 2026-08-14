/**
 * Thai date and time labels, in Bangkok time.
 *
 * Hand-rolled rather than `toLocaleString`: a locale or timezone difference
 * between the server render and the client that hydrates it shows up as a React
 * hydration mismatch, and `th-TH` additionally formats years in the Buddhist era,
 * which is not what a session header wants. Bangkok is a fixed UTC+7 with no
 * daylight saving, so the shift below is exact.
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const pad = (n: number) => n.toString().padStart(2, "0");

/** The instant as Bangkok wall-clock, read through the UTC getters. */
function bangkok(ms: number): Date {
  return new Date(ms + BANGKOK_OFFSET_MS);
}

/** `20:41` */
export function timeLabel(ms: number): string {
  const d = bangkok(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** `พฤ. 26 ต.ค.` */
export function dayLabel(ms: number): string {
  const d = bangkok(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** `พฤ. 26 ต.ค. · 20:00–23:00`, or just the start time when there is no end. */
export function sessionHeadline(
  startsAt: string,
  endsAt: string | null,
): string {
  const start = new Date(startsAt).getTime();
  const time = endsAt
    ? `${timeLabel(start)}–${timeLabel(new Date(endsAt).getTime())}`
    : timeLabel(start);

  return `${dayLabel(start)} · ${time}`;
}

/** `พฤ. 20:00 · คอร์ท 1–3` — the one line under the guan name. */
export function sessionSubtitle(
  startsAt: string,
  courtCount: number,
): string {
  const start = new Date(startsAt).getTime();
  const weekday = WEEKDAYS[bangkok(start).getUTCDay()];
  const courts = courtCount > 1 ? `คอร์ท 1–${courtCount}` : "คอร์ท 1";

  return `${weekday} ${timeLabel(start)} · ${courts}`;
}
