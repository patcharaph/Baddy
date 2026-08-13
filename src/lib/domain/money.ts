/**
 * Money helpers. All amounts are whole baht (integers) — guans settle in notes and
 * coins, and satang would only create rounding noise nobody can pay.
 */

/**
 * Split `total` into `count` whole-baht shares whose sum is exactly `total`.
 *
 * Plain division leaves a remainder that would make the per-person amounts fail to
 * add up to what the organizer actually has to collect. The remainder baht are
 * handed to the first shares in the array, so the caller controls who absorbs them
 * by controlling the order it passes participants in.
 */
export function splitEvenly(total: number, count: number): number[] {
  if (!Number.isInteger(total)) {
    throw new Error(`splitEvenly: ยอดรวมต้องเป็นจำนวนเต็มบาท (ได้ ${total})`);
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`splitEvenly: จำนวนคนต้องมากกว่า 0 (ได้ ${count})`);
  }

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / count);
  const remainder = abs - base * count;

  return Array.from({ length: count }, (_, i) =>
    sign * (base + (i < remainder ? 1 : 0)),
  );
}

/**
 * Format an amount with thousand separators.
 *
 * Hand-rolled rather than `toLocaleString` so the server and the client always
 * produce the same string — a locale difference between the two would show up as a
 * React hydration mismatch.
 */
export function formatBaht(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `฿1,250` */
export function baht(amount: number): string {
  return `฿${formatBaht(amount)}`;
}

/** Elapsed time as `mm:ss`, for the court timers on the queue board. */
export function formatElapsed(fromMs: number, nowMs: number): string {
  const totalSeconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
