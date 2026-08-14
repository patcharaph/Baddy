import "server-only";

import { cookies } from "next/headers";

import { getCurrentPlayer } from "@/lib/auth/current-player";
import type { MemberRole } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/env";
import { SAMPLE_ME_ID } from "@/lib/sample/board";
import { getReadClient } from "@/lib/supabase/read-client";

/**
 * Who is looking at the screen, and what they are allowed to touch.
 *
 * The prototype splits every screen in two — the organizer can move other
 * people's check-ins, the queue and the money; a player can only move their own
 * check-in and read the rest. That split is data, not a preference, so it is
 * resolved once here and handed to the screens rather than guessed per page.
 */
export interface Viewer {
  /** Null when nobody is signed in yet (LIFF is still bootstrapping). */
  playerId: string | null;
  role: MemberRole;
  /** True when `role` came from the preview switch, not from a membership. */
  preview: boolean;
}

export const PREVIEW_ROLE_COOKIE = "baddy_preview_role";

/**
 * The role the sample board is being reviewed as.
 *
 * Sample data has no memberships to read, and both halves of the design need to
 * be reviewable, so the role comes from a cookie the preview switch writes.
 */
async function previewRole(): Promise<MemberRole> {
  const store = await cookies();
  return store.get(PREVIEW_ROLE_COOKIE)?.value === "player"
    ? "player"
    : "organizer";
}

/**
 * Resolve the viewer for a guan.
 *
 * Defaults to `player` when there is no membership row: an unknown viewer must
 * never get the organizer's buttons, and a missing membership is exactly the
 * case where we know the least.
 */
export async function resolveViewer(guanId: string | null): Promise<Viewer> {
  if (!hasSupabaseConfig) {
    return { playerId: SAMPLE_ME_ID, role: await previewRole(), preview: true };
  }

  const player = await getCurrentPlayer();
  if (!player || !guanId) {
    return { playerId: player?.id ?? null, role: "player", preview: false };
  }

  const supabase = await getReadClient();
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("guan_id", guanId)
    .eq("player_id", player.id)
    .maybeSingle();

  return {
    playerId: player.id,
    role: data?.role === "organizer" ? "organizer" : "player",
    preview: false,
  };
}
