"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseConfig } from "@/lib/env";

import type { Database } from "./database.types";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser Supabase client.
 *
 * Memoised because the realtime queue board subscribes from several components;
 * a fresh client per call would open a websocket per component.
 */
export function getSupabaseBrowserClient() {
  if (!cached) {
    const { url, anonKey } = requireSupabaseConfig();
    cached = createBrowserClient<Database>(url, anonKey);
  }
  return cached;
}
