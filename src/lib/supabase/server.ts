import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireServiceRoleKey, requireSupabaseConfig } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Server Supabase client bound to the request's cookies, so RLS sees the signed-in
 * player. Use this for anything rendered on the server.
 */
export async function getSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Session refresh happens in the
          // proxy/route handlers instead, so ignoring this is safe here.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely — only for trusted server work such
 * as the LINE webhook, where there is no signed-in user to act as.
 *
 * Never expose the result of this to the browser.
 */
export function getSupabaseAdminClient() {
  const { url } = requireSupabaseConfig();

  return createServerClient<Database>(url, requireServiceRoleKey(), {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
