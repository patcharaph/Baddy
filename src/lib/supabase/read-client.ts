import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabaseAdminClient, getSupabaseServerClient } from "./server";

/**
 * The client the pages read through.
 *
 * LINE → Supabase auth is not wired yet, so there is no signed-in user for RLS
 * to recognise and every policy correctly returns nothing. `DEV_BYPASS_RLS=1`
 * reads with the service role instead so the screens can be developed against
 * real data in the meantime.
 *
 * This is a temporary bridge, not a feature:
 *   - it refuses to run in a production build, so it cannot ship by accident
 *   - it is only reachable from server code
 *   - it goes away when auth lands, and nothing else has to change, because the
 *     queries take whichever client they are handed
 */
export async function getReadClient(): Promise<SupabaseClient<Database>> {
  const bypass = process.env.DEV_BYPASS_RLS === "1";

  if (!bypass) {
    return getSupabaseServerClient();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DEV_BYPASS_RLS ใช้ใน production ไม่ได้ — เป็นทางลัดสำหรับ dev ระหว่างที่ยังไม่ได้ทำ auth เท่านั้น",
    );
  }

  return getSupabaseAdminClient();
}
