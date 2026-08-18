import { NextResponse } from "next/server";

import { signInWithLineIdToken } from "@/lib/auth/line-session";
import { hasSupabaseConfig } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Exchanges a LIFF ID token for a Supabase session cookie.
 *
 * The only thing the client sends is the token. Everything about who the caller
 * is comes back from LINE — a client-supplied userId would let anyone claim any
 * account.
 */
/**
 * Ends the Supabase session.
 *
 * Exists because signing out of LINE in a browser tab does not touch the httpOnly
 * cookies this route set — and on the desktop this app now supports, "sign out"
 * has to mean it. Inside LINE there is one account per phone and this is close to
 * a no-op; on a shared laptop it is the whole point.
 */
export async function DELETE() {
  if (!hasSupabaseConfig) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า Supabase" },
      { status: 503 },
    );
  }

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง" }, { status: 400 });
  }

  if (typeof idToken !== "string" || idToken === "") {
    return NextResponse.json({ error: "ไม่มี id token" }, { status: 400 });
  }

  const result = await signInWithLineIdToken(idToken);

  if (!result.ok) {
    // 401: the token was rejected. The reason is safe to show — it is either a
    // LINE validation message or our own configuration problem, and the
    // organizer needs to know which.
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  return NextResponse.json({ playerId: result.playerId, isNew: result.isNew });
}
