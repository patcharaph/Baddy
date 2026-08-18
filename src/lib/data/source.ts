import "server-only";

import { cache } from "react";

import { getCurrentPlayer } from "@/lib/auth/current-player";
import { hasSupabaseConfig } from "@/lib/env";
import {
  SAMPLE_BOARD,
  SAMPLE_BOARD_NOW,
  SAMPLE_COST_DATA,
  SAMPLE_INVITE_CODE,
} from "@/lib/sample/board";
import { getReadClient } from "@/lib/supabase/read-client";

import {
  fetchBoard,
  fetchCurrentSession,
  fetchInvitePreview,
  fetchLastClosedSession,
  fetchLiveMatchCount,
  fetchMyGuans,
  fetchSessionById,
  fetchSessionCostData,
} from "./queries";
import type { BoardView, SessionView } from "./types";
import { resolveViewer, type Viewer } from "./viewer";
import type {
  GuanMembershipView,
  InvitePreview,
  SessionCostData,
} from "./queries";

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
          defaultCourtRate: session.courtTotal,
          inviteCode: SAMPLE_INVITE_CODE,
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

export interface InviteResult {
  kind: SourceKind;
  preview: InvitePreview | null;
  /** True when the signed-in player is already in this guan. */
  alreadyMember: boolean;
  /** Null when nobody is signed in — the page offers LINE Login instead. */
  playerId: string | null;
}

/**
 * The invite landing page's data (US-1.2).
 *
 * Deliberately not `cache`d across the join: the page re-reads after the
 * membership is written, and a cached "not a member" would send the new member
 * straight back to the button they just pressed.
 *
 * Unlike every other loader here, this one has to work for someone who is not
 * signed in and belongs to nothing — that is the entire situation it exists for.
 */
export async function loadInvite(code: string): Promise<InviteResult> {
  if (!hasSupabaseConfig) {
    return {
      kind: "sample",
      preview:
        code === SAMPLE_INVITE_CODE
          ? {
              guanId: SAMPLE_BOARD.session.guanId,
              name: SAMPLE_BOARD.session.guanName,
              homeVenue: SAMPLE_BOARD.session.venue,
              memberCount: SAMPLE_BOARD.roster.length,
            }
          : null,
      alreadyMember: false,
      playerId: null,
    };
  }

  const supabase = await getReadClient();
  const preview = await fetchInvitePreview(supabase, code);
  const player = await getCurrentPlayer();

  if (!preview || !player) {
    return {
      kind: "live",
      preview,
      alreadyMember: false,
      playerId: player?.id ?? null,
    };
  }

  const { data } = await supabase
    .from("memberships")
    .select("id")
    .eq("guan_id", preview.guanId)
    .eq("player_id", player.id)
    .maybeSingle();

  return {
    kind: "live",
    preview,
    alreadyMember: data !== null,
    playerId: player.id,
  };
}

/**
 * The guans the viewer may open a round for (US-2.1).
 *
 * A session belongs to a guan and only its organizer may create one, so the
 * create-session form needs this list before it can render — and an organizer of
 * nothing needs to be told to create a guan first, not handed an empty dropdown.
 */
export const loadOrganizerGuans = cache(async (): Promise<{
  kind: SourceKind;
  guans: GuanMembershipView[];
}> => {
  const { kind, guans } = await loadProfile();
  return { kind, guans: guans.filter((g) => g.role === "organizer") };
});

export interface ManageSessionResult {
  kind: SourceKind;
  session: SessionView | null;
  viewer: Viewer;
  /** Matches still holding a court. A round with any of these cannot be closed. */
  liveMatchCount: number;
}

/**
 * One round, by id, for the screen that edits and closes it (FR-2).
 *
 * By id rather than "the current one" because the round this screen edits is
 * sometimes a closed one — reopening a round nothing else links to any more is
 * the whole reason the id is in the URL.
 *
 * Not `cache`d: unlike the board, this is read once per request by one page.
 */
export async function loadManageSession(
  sessionId: string,
): Promise<ManageSessionResult> {
  if (!hasSupabaseConfig) {
    const sample = SAMPLE_BOARD.session;
    return {
      kind: "sample",
      session: sessionId === sample.id ? sample : null,
      viewer: await resolveViewer(null),
      liveMatchCount: SAMPLE_BOARD.courts.length,
    };
  }

  const supabase = await getReadClient();
  const session = await fetchSessionById(supabase, sessionId);
  if (!session) {
    return {
      kind: "empty",
      session: null,
      viewer: await resolveViewer(null),
      liveMatchCount: 0,
    };
  }

  const [viewer, liveMatchCount] = await Promise.all([
    resolveViewer(session.guanId),
    fetchLiveMatchCount(supabase, session.id),
  ]);

  return { kind: "live", session, viewer, liveMatchCount };
}

/**
 * How long after closing a round the home screen still offers to undo it.
 *
 * Long enough to cover "closed it while people were still packing up and
 * realised on the drive home", short enough that next week's empty screen is not
 * still advertising last week's round as a thing to reopen.
 */
export const REOPEN_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * The round the empty home screen offers to reopen, if there is one.
 *
 * Null unless the last closed round was closed inside `REOPEN_WINDOW_MS` and the
 * viewer organizes the guan it belongs to — this is an undo for the person who
 * pressed the button, not a history screen for everyone else.
 */
export async function loadReopenableSession(
  now: number,
): Promise<SessionView | null> {
  if (!hasSupabaseConfig) return null;

  const supabase = await getReadClient();
  const session = await fetchLastClosedSession(supabase);
  if (!session?.closedAt) return null;

  const closedAt = Date.parse(session.closedAt);
  if (!Number.isFinite(closedAt) || now - closedAt > REOPEN_WINDOW_MS) {
    return null;
  }

  const viewer = await resolveViewer(session.guanId);
  return viewer.role === "organizer" ? session : null;
}
