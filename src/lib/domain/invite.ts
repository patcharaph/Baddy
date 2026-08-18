/**
 * Invite codes and the links that carry them (PRD FR-1).
 *
 * Pure on purpose, like the rest of `domain/`: what counts as a code, and what a
 * shareable link looks like, are decisions worth testing without a database or a
 * LINE client in the room.
 */

/**
 * The shape `generate_invite_code()` mints: URL-safe base64, 12 characters.
 *
 * Strict on the alphabet, loose on the length. The alphabet is the part that
 * matters — anything outside it either cannot survive a URL or was never a code
 * to begin with, and rejecting it here means a typo produces "ลิงก์เชิญไม่ถูกต้อง"
 * instead of a round trip that finds nothing. The length is left open so a
 * future code can be longer without this file being the thing that refuses it.
 */
const INVITE_CODE = /^[A-Za-z0-9_-]{8,64}$/;

export function isInviteCode(value: string): boolean {
  return INVITE_CODE.test(value);
}

/**
 * Pull the code out of whatever the player actually has in their clipboard.
 *
 * People share links, not codes, and a link arrives with a scheme, a host, a
 * LIFF id and sometimes a `?openExternalBrowser=1` glued to the end. Accepting
 * only a bare code would mean the paste field rejects the exact thing every
 * invite is shaped like.
 *
 * Codes are case-sensitive — base64url uses both cases and `a` is not `A` — so
 * this trims and slices but never lowercases.
 */
export function parseInviteCode(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (isInviteCode(trimmed)) return trimmed;

  // A pasted link: take the segment after /join/, which is where both the LIFF
  // and the plain-browser form put it. Query and hash are dropped first so
  // `?openExternalBrowser=1` does not end up inside the code.
  const path = trimmed.split(/[?#]/, 1)[0];
  const segments = path.split("/").filter((s) => s !== "");
  const joinAt = segments.lastIndexOf("join");
  const candidate = joinAt >= 0 ? segments[joinAt + 1] : segments[segments.length - 1];

  if (candidate === undefined) return null;

  // A pasted URL can arrive percent-encoded even though the codes never need it.
  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    // Malformed escape — fall through and let the pattern refuse it.
  }

  return isInviteCode(decoded) ? decoded : null;
}

export interface InviteLinkContext {
  code: string;
  /** LIFF app id, when one is configured. */
  liffId: string;
  /** Origin of the running app, e.g. `https://baddy.example`. */
  origin: string;
}

/**
 * The link to put in the group chat.
 *
 * Prefers the LIFF form, because a `liff.line.me` link opened from a LINE chat
 * lands inside LINE's webview where the player is already signed in — the plain
 * link opens a browser and asks them to log in to LINE first, which is the step
 * FR-1 exists to remove. LIFF v2 forwards a path appended to the LIFF URL
 * through to the endpoint, so `/join/<code>` survives the hop.
 *
 * Falls back to the app's own origin when there is no LIFF id, which is the
 * development case — and still a working link, just not a one-tap one.
 */
export function inviteUrl({ code, liffId, origin }: InviteLinkContext): string {
  const path = `/join/${encodeURIComponent(code)}`;

  if (liffId !== "") {
    return `https://liff.line.me/${liffId}${path}`;
  }
  return `${origin.replace(/\/+$/, "")}${path}`;
}
