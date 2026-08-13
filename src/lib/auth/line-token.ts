/**
 * Verifying a LIFF ID token.
 *
 * The client hands us an ID token and claims to be a particular LINE user. That
 * claim is worth nothing on its own — LINE's own documentation warns that ID
 * tokens can be spoofed — so the token goes to LINE to be checked before any
 * part of it is believed.
 *
 * `fetchImpl` is injectable so this can be tested without the network, which is
 * the whole reason the verification lives here and not inside the route handler.
 */

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export interface LineProfile {
  /** LINE userId — the `sub` claim, and our `players.line_user_id`. */
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
}

export type VerifyResult =
  | { ok: true; profile: LineProfile }
  | { ok: false; reason: string };

interface LineVerifyPayload {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
}

export async function verifyLineIdToken(
  idToken: string,
  channelId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyResult> {
  if (!idToken) return { ok: false, reason: "ไม่มี id token" };
  if (!channelId) return { ok: false, reason: "ยังไม่ได้ตั้ง LINE_CHANNEL_ID" };

  let response: Response;
  try {
    response = await fetchImpl(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: `ติดต่อ LINE ไม่ได้: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let payload: LineVerifyPayload;
  try {
    payload = (await response.json()) as LineVerifyPayload;
  } catch {
    return { ok: false, reason: "LINE ตอบกลับมาในรูปแบบที่อ่านไม่ได้" };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason:
        payload.error_description ?? payload.error ?? `LINE ปฏิเสธ token (${response.status})`,
    };
  }

  // LINE checks the audience itself, but this code is what decides who the
  // caller is — it should not depend on a remote service having done its job.
  if (payload.aud !== channelId) {
    return { ok: false, reason: "token นี้ออกให้ channel อื่น" };
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: "token หมดอายุแล้ว — เข้าสู่ระบบใหม่อีกครั้ง" };
  }

  if (!payload.sub) {
    return { ok: false, reason: "token ไม่มี user id" };
  }

  return {
    ok: true,
    profile: {
      userId: payload.sub,
      displayName: payload.name ?? null,
      pictureUrl: payload.picture ?? null,
    },
  };
}

/**
 * The email a LINE user is represented by inside Supabase Auth.
 *
 * Supabase Auth needs an email to hang an account off, but a LINE login never
 * gives us one we should trust or send to. `.invalid` is reserved by RFC 2606
 * and can never resolve, so these addresses cannot be mailed even by accident.
 */
export function syntheticEmailFor(lineUserId: string): string {
  return `line_${lineUserId}@baddy.invalid`;
}
