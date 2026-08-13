"use client";

import { useEffect, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Tables whose changes should move the board. */
const WATCHED_TABLES = [
  "matches",
  "match_players",
  "session_participants",
] as const;

export type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Keeps the queue board in sync across every phone in the guan (PRD FR-5).
 *
 * Realtime is treated as a hint, not as a data channel: a change on any watched
 * table triggers `onChange`, which re-fetches through the normal path. Applying
 * payloads directly would mean maintaining a second copy of the queue rules on
 * the client, and any dropped message would silently desync the board.
 *
 * A poll runs alongside it — slow while the channel is healthy, faster once it
 * is not. Inside LINE's webview the socket dies whenever the app is
 * backgrounded, and an organizer must never be looking at a frozen board.
 */
export function useRealtimeBoard(
  sessionId: string | null,
  onChange: () => void,
  { enabled = true }: { enabled?: boolean } = {},
): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  // Kept in a ref so a new callback identity on each render does not tear down
  // and rebuild the subscription. Updated in an effect rather than during
  // render, so a render that React throws away cannot leave a stale callback.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`board:${sessionId}`);

    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          // match_players has no session_id of its own; its parent match does,
          // so those events arrive unfiltered and are filtered by the re-fetch.
          ...(table === "match_players"
            ? {}
            : { filter: `session_id=eq.${sessionId}` }),
        },
        () => onChangeRef.current(),
      );
    }

    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        setStatus("live");
        // Catch up on anything missed while the channel was down.
        onChangeRef.current();
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        setStatus("reconnecting");
      } else if (state === "CLOSED") {
        setStatus("offline");
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, enabled]);

  // Fallback poll. Frequent enough to be useful when realtime is down, rare
  // enough to be cheap when it is up.
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const intervalMs = status === "live" ? 60_000 : 10_000;
    const timer = setInterval(() => onChangeRef.current(), intervalMs);
    return () => clearInterval(timer);
  }, [sessionId, enabled, status]);

  // A webview that comes back from the background has almost certainly missed
  // events, whatever the channel thinks its state is.
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") onChangeRef.current();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sessionId, enabled]);

  return status;
}
