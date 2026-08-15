import "server-only";

import { cookies } from "next/headers";

import { getCurrentPlayer } from "@/lib/auth/current-player";
import type { MemberRole } from "@/lib/domain/types";
import { hasSupabaseConfig } from "@/lib/env";
import { SAMPLE_ME_ID, SAMPLE_NEWCOMER_ID } from "@/lib/sample/board";
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
  /**
   * Which preview is selected, so the switch can show it.
   *
   * Not the same as `role`: `newcomer` resolves to the `player` role, and the
   * switch still has to render it as its own choice. Null once Supabase is
   * configured, where there is no preview to show.
   */
  previewAs: PreviewRole | null;
}

export const PREVIEW_ROLE_COOKIE = "baddy_preview_role";

/**
 * What the sample board can be reviewed as.
 *
 * `newcomer` is a player like any other — same role, same permissions — who
 * simply has no row in tonight's session yet. It is a separate preview because
 * the screen a player sees before they join is a different screen, and every
 * sample player is already in the roster, so there is otherwise no way to look
 * at it without a Supabase project.
 */
export type PreviewRole = MemberRole | "newcomer";

/**
 * The viewer the sample board is being reviewed as.
 *
 * Sample data has no memberships to read, and every half of the design needs to
 * be reviewable, so this comes from a cookie the preview switch writes.
 */
async function previewViewer(): Promise<{
  playerId: string;
  role: MemberRole;
  previewAs: PreviewRole;
}> {
  const value = (await cookies()).get(PREVIEW_ROLE_COOKIE)?.value;

  if (value === "newcomer") {
    return {
      playerId: SAMPLE_NEWCOMER_ID,
      role: "player",
      previewAs: "newcomer",
    };
  }
  if (value === "player") {
    return { playerId: SAMPLE_ME_ID, role: "player", previewAs: "player" };
  }
  return { playerId: SAMPLE_ME_ID, role: "organizer", previewAs: "organizer" };
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
    return { ...(await previewViewer()), preview: true };
  }

  const player = await getCurrentPlayer();
  if (!player || !guanId) {
    return {
      playerId: player?.id ?? null,
      role: "player",
      preview: false,
      previewAs: null,
    };
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
    previewAs: null,
  };
}
