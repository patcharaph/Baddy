import "server-only";

import { hasSupabaseConfig } from "@/lib/env";
import { SAMPLE_BOARD, SAMPLE_BOARD_NOW, SAMPLE_COST_DATA } from "@/lib/sample/board";
import { getReadClient } from "@/lib/supabase/read-client";

import { fetchBoard, fetchCurrentSession, fetchSessionCostData } from "./queries";
import type { BoardView } from "./types";
import type { SessionCostData } from "./queries";

/**
 * Where the screens get their data.
 *
 * Three outcomes, and the pages have to handle all three:
 *   - `sample`  — no Supabase configured; the app still runs, on fixed data
 *   - `live`    — real session, real numbers
 *   - `empty`   — Supabase is configured but no session is open right now
 *
 * Keeping the fallback here rather than inside each page means a screen never
 * half-renders against a source it did not expect.
 */
export type SourceKind = "sample" | "live" | "empty";

export interface BoardResult {
  kind: SourceKind;
  board: BoardView | null;
  /** The clock the board was rendered against. */
  now: number;
}

export async function loadBoard(): Promise<BoardResult> {
  if (!hasSupabaseConfig) {
    return { kind: "sample", board: SAMPLE_BOARD, now: SAMPLE_BOARD_NOW };
  }

  const supabase = await getReadClient();
  const session = await fetchCurrentSession(supabase);
  if (!session) {
    return { kind: "empty", board: null, now: Date.now() };
  }

  const now = Date.now();
  return { kind: "live", board: await fetchBoard(supabase, session, now), now };
}

export interface CostResult {
  kind: SourceKind;
  data: SessionCostData | null;
  sessionId: string | null;
}

export async function loadCostData(): Promise<CostResult> {
  if (!hasSupabaseConfig) {
    return { kind: "sample", data: SAMPLE_COST_DATA, sessionId: null };
  }

  const supabase = await getReadClient();
  const session = await fetchCurrentSession(supabase);
  if (!session) {
    return { kind: "empty", data: null, sessionId: null };
  }

  return {
    kind: "live",
    data: await fetchSessionCostData(supabase, session),
    sessionId: session.id,
  };
}
