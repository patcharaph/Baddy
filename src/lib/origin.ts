import "server-only";

import { headers } from "next/headers";

/**
 * The origin this request arrived on, for building links that leave the app.
 *
 * Read from the request rather than an env var so there is no
 * `NEXT_PUBLIC_APP_URL` to forget on a preview deploy — the one place a wrong
 * value would be invisible until someone tried to open a shared link and landed
 * on the wrong host.
 *
 * `x-forwarded-proto` is trusted because the only thing that sets it here is the
 * platform's own proxy. Falls back to `https`, since the one environment that is
 * genuinely `http` is localhost, and `host` carries the port that identifies it.
 */
export async function requestOrigin(): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";
  const proto =
    store.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}
