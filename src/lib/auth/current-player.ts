import "server-only";

import { cache } from "react";

import { hasSupabaseConfig } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentPlayer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  skillLevel: string | null;
}

/**
 * The signed-in player, or null.
 *
 * Wrapped in `cache` so several components on one page asking "who am I?" share
 * a single round trip per request.
 *
 * Reads through the session-bound client on purpose: if RLS would hide this row
 * from the caller, the caller is not really signed in as them.
 */
export const getCurrentPlayer = cache(async (): Promise<CurrentPlayer | null> => {
  if (!hasSupabaseConfig) return null;

  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("players")
    .select("id, display_name, avatar_url, skill_level")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    skillLevel: data.skill_level,
  };
});
