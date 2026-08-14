import "server-only";

import { cache } from "react";

import { hasSupabaseConfig } from "@/lib/env";
import { SAMPLE_BOARD, SAMPLE_BOARD_NOW, SAMPLE_COST_DATA } from "@/lib/sample/board";
import { getReadClient } from "@/lib/supabase/read-client";

import {
  fetchBoard,
  fetchCurrentSession,
  fetchMyGuans,
  fetchSessionCostData,
} from "./queries";
import type { BoardView } from "./types";
import { resolveViewer, type Viewer } from "./viewer";
import type { GuanMembershipView, SessionCostData } from "./queries";

/**
 * Where the screens get their data.
 *
 * Three outcomes, and the pages have to handle all three:
 *   - `sample`  — no Supabase configured; the app still runs, on fixed data
 *   - `live`    — real session, real numbers
 *   - `empty`   — Supabase is configured but no session is open right now
 *
 * Keeping the fallback here rather than inside each page means a screen never
 * half-renders against a source it did not expect. The viewer rides along for
 * the same reason: every screen in the design splits organizer from player, and
 * no screen should have to work that out for itself.
 */
export type SourceKind = "sample" | "live" | "empty";

export interface BoardResult {
  kind: SourceKind;
  board: BoardView | null;
  viewer: Viewer;
  /** The clock the board was rendered against. */
  now: number;
}

/**
 * Wrapped in `cache` because the tab layout and the page inside it both need the
 * session — the header names the round, the page renders it — and they render in
 * the same request. Without this, every navigation costs two round trips.
 */
export const loadBoard = cache(async (): Promise<BoardResult> => {
  if (!hasSupabaseConfig) {
    return {
      kind: "sample",
      board: SAMPLE_BOARD,
      viewer: await resolveViewer(null),
      now: SAMPLE_BOARD_NOW,
    };
  }

  const supabase = await getReadClient();
  const session = await fetchCurrentSession(supabase);
  if (!session) {
    return {
      kind: "empty",
      board: null,
      viewer: await resolveViewer(null),
      now: Date.now(),
    };
  }

  const now = Date.now();
  const [board, viewer] = await Promise.all([
    fetchBoard(supabase, session, now),
    resolveViewer(session.guanId),
  ]);

  return { kind: "live", board, viewer, now };
});

export interface CostResult {
  kind: SourceKind;
  data: SessionCostData | null;
  sessionId: string | null;
  viewer: Viewer;
  /** Who to pay, shown on the settle screen. Null when the guan has not set one. */
  promptpayTarget: string | null;
  guanName: string;
}

export const loadCostData = cache(async (): Promise<CostResult> => {
  if (!hasSupabaseConfig) {
    return {
      kind: "sample",
      data: SAMPLE_COST_DATA,
      sessionId: null,
      viewer: await resolveViewer(null),
      promptpayTarget: SAMPLE_BOARD.session.promptpayTarget,
      guanName: SAMPLE_BOARD.session.guanName,
    };
  }

  const supabase = await getReadClient();
  const session = await fetchCurrentSession(supabase);
  if (!session) {
    return {
      kind: "empty",
      data: null,
      sessionId: null,
      viewer: await resolveViewer(null),
      promptpayTarget: null,
      guanName: "ก๊วน",
    };
  }

  const [data, viewer] = await Promise.all([
    fetchSessionCostData(supabase, session),
    resolveViewer(session.guanId),
  ]);

  return {
    kind: "live",
    data,
    sessionId: session.id,
    viewer,
    promptpayTarget: session.promptpayTarget,
    guanName: session.guanName,
  };
});

export interface ProfileResult {
  kind: SourceKind;
  viewer: Viewer;
  guans: GuanMembershipView[];
}

/**
 * The player's own view of themselves, across every guan they are in.
 *
 * Separate from the board because it is the one screen that is not about tonight
 * — it survives changing guans, which is the point of it.
 */
export const loadProfile = cache(async (): Promise<ProfileResult> => {
  if (!hasSupabaseConfig) {
    const viewer = await resolveViewer(null);
    const session = SAMPLE_BOARD.session;

    return {
      kind: "sample",
      viewer,
      guans: [
        {
          guanId: session.guanId,
          name: session.guanName,
          homeVenue: session.venue,
          role: viewer.role,
        },
      ],
    };
  }

  const supabase = await getReadClient();
  const session = await fetchCurrentSession(supabase);
  const viewer = await resolveViewer(session?.guanId ?? null);

  return {
    kind: session ? "live" : "empty",
    viewer,
    guans: viewer.playerId ? await fetchMyGuans(supabase, viewer.playerId) : [],
  };
});
