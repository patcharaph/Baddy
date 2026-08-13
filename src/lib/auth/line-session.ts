import "server-only";

import { requireLineChannelId } from "@/lib/env";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

import { syntheticEmailFor, verifyLineIdToken, type LineProfile } from "./line-token";

/**
 * Turns a verified LINE identity into a Supabase session.
 *
 * Supabase has no LINE provider and no generic OIDC option — its third-party
 * auth only trusts Clerk, Firebase, Auth0, Cognito and WorkOS — so the bridge is
 * ours to build:
 *
 *   LIFF id token → LINE verifies it → find/create the Supabase user
 *     → admin magic link → verifyOtp → real session, cookies set
 *
 * Minting a JWT with the project secret would be shorter, but it produces a
 * token with no refresh path and sidesteps the auth server entirely. Going
 * through verifyOtp yields an ordinary session that refreshes and revokes like
 * any other.
 */

export type SignInResult =
  | { ok: true; playerId: string; isNew: boolean }
  | { ok: false; reason: string };

export async function signInWithLineIdToken(
  idToken: string,
): Promise<SignInResult> {
  let channelId: string;
  try {
    channelId = requireLineChannelId();
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  const verified = await verifyLineIdToken(idToken, channelId);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const admin = getSupabaseAdminClient();
  const email = syntheticEmailFor(verified.profile.userId);

  // `magiclink` creates the auth user if it does not exist yet, so first-time
  // and returning players take the same path.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !link?.properties?.hashed_token) {
    return {
      ok: false,
      reason: `ออก session ไม่สำเร็จ: ${linkError?.message ?? "ไม่ได้รับ token กลับมา"}`,
    };
  }

  // Redeemed on the server so the access and refresh tokens are written
  // straight into httpOnly cookies and never pass through the browser.
  const supabase = await getSupabaseServerClient();
  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });

  if (verifyError || !session.user) {
    return {
      ok: false,
      reason: `เข้าสู่ระบบไม่สำเร็จ: ${verifyError?.message ?? "ไม่ทราบสาเหตุ"}`,
    };
  }

  const player = await linkPlayerProfile(
    admin,
    session.user.id,
    verified.profile,
  );

  return player;
}

/**
 * Attach the Supabase user to a player profile, creating it on first sign-in.
 *
 * The profile is keyed on `line_user_id`, not on the auth user, because a player
 * is an entity of their own (ADR-2). Someone who was added to a guan before they
 * ever opened the app already has a row, and this claims it rather than creating
 * a duplicate that would strand their history.
 */
async function linkPlayerProfile(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  authUserId: string,
  profile: LineProfile,
): Promise<SignInResult> {
  const { data: existing, error: findError } = await admin
    .from("players")
    .select("id, auth_user_id, display_name, avatar_url")
    .eq("line_user_id", profile.userId)
    .maybeSingle();

  if (findError) {
    return { ok: false, reason: `หาโปรไฟล์ผู้เล่นไม่สำเร็จ: ${findError.message}` };
  }

  if (existing) {
    const { error: updateError } = await admin
      .from("players")
      .update({
        auth_user_id: authUserId,
        // LINE is the source of truth for name and picture; refresh them, but
        // do not wipe what we have if LINE sent nothing this time.
        display_name: profile.displayName ?? existing.display_name,
        avatar_url: profile.pictureUrl ?? existing.avatar_url,
      })
      .eq("id", existing.id);

    if (updateError) {
      return { ok: false, reason: `อัปเดตโปรไฟล์ไม่สำเร็จ: ${updateError.message}` };
    }

    return { ok: true, playerId: existing.id, isNew: false };
  }

  const { data: created, error: insertError } = await admin
    .from("players")
    .insert({
      line_user_id: profile.userId,
      auth_user_id: authUserId,
      display_name: profile.displayName ?? "ผู้เล่นใหม่",
      avatar_url: profile.pictureUrl,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return {
      ok: false,
      reason: `สร้างโปรไฟล์ผู้เล่นไม่สำเร็จ: ${insertError?.message ?? "ไม่ทราบสาเหตุ"}`,
    };
  }

  return { ok: true, playerId: created.id, isNew: true };
}
