"use client";

import { useRouter } from "next/navigation";

import { useRealtimeBoard } from "@/lib/data/use-realtime-board";

/**
 * Keeps the server-rendered board fresh.
 *
 * `router.refresh()` re-runs the page's own data loading, so realtime never
 * becomes a second, divergent source of truth — it just decides *when* to
 * re-read. Renders nothing unless the connection is unhealthy, since a green
 * "connected" badge is noise on a board people glance at between games.
 */
export function BoardLiveSync({
  sessionId,
  enabled,
}: {
  sessionId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const status = useRealtimeBoard(sessionId, () => router.refresh(), {
    enabled,
  });

  if (!enabled || status === "live" || status === "connecting") return null;

  return (
    <p className="mx-4 mb-4 rounded-xl bg-pending-bg px-3 py-2 text-[11px] text-pending">
      การเชื่อมต่อสดหลุด — กำลังรีเฟรชให้เองทุก 10 วินาที
    </p>
  );
}
