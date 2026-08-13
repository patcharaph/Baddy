/**
 * Environment access in one place, so a missing variable fails with a sentence
 * that names the variable instead of a runtime `undefined` three layers deep.
 *
 * NEXT_PUBLIC_* values are read as literal property accesses — Next inlines them
 * at build time and cannot substitute a dynamic `process.env[key]` lookup.
 */

export const publicEnv = {
  liffId: process.env.NEXT_PUBLIC_LIFF_ID ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

/**
 * True when Supabase credentials are present. The scaffold runs without them by
 * falling back to sample data, so this is a check, not an assertion.
 */
export const hasSupabaseConfig =
  publicEnv.supabaseUrl !== "" && publicEnv.supabaseAnonKey !== "";

/** True when a LIFF id is configured. Without one the app runs in browser mode. */
export const hasLiffConfig = publicEnv.liffId !== "";

export function requireSupabaseConfig(): {
  url: string;
  anonKey: string;
} {
  if (!hasSupabaseConfig) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า Supabase — ใส่ NEXT_PUBLIC_SUPABASE_URL และ " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local (ดูตัวอย่างที่ .env.example)",
    );
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}

/** Server-only. Never import this from a Client Component. */
export function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY — ต้องใช้สำหรับงานฝั่ง server เท่านั้น",
    );
  }
  return key;
}

/** LINE channel id, used to verify LIFF id tokens server-side. */
export function requireLineChannelId(): string {
  const id = process.env.LINE_CHANNEL_ID;
  if (!id) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID — ต้องใช้ตรวจสอบ id token ของ LIFF",
    );
  }
  return id;
}
