"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { hasLiffConfig, publicEnv } from "@/lib/env";

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export type LiffStatus =
  /** LIFF SDK is still initialising. */
  | "loading"
  /** Initialised and the player is logged in. */
  | "ready"
  /** Initialised but not logged in — call `login()`. */
  | "logged-out"
  /** No LIFF id configured; running as a plain web page for local development. */
  | "browser"
  | "error";

export interface LiffState {
  status: LiffStatus;
  profile: LiffProfile | null;
  /** Send this to the server to verify who the caller is — never trust userId alone. */
  idToken: string | null;
  error: string | null;
  login: () => void;
  logout: () => void;
}

const LiffContext = createContext<LiffState | null>(null);

/**
 * Initialises the LIFF SDK and exposes the logged-in player.
 *
 * The SDK touches `window` on import, so it is loaded dynamically inside an
 * effect rather than at module scope, which would break server rendering.
 *
 * Without NEXT_PUBLIC_LIFF_ID the provider settles into `browser` status instead
 * of erroring, so the app can be developed and reviewed outside LINE.
 */
export function LiffProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiffStatus>(
    hasLiffConfig ? "loading" : "browser",
  );
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLiffConfig) return;

    let cancelled = false;

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: publicEnv.liffId });
        if (cancelled) return;

        if (!liff.isLoggedIn()) {
          setStatus("logged-out");
          return;
        }

        const p = await liff.getProfile();
        if (cancelled) return;

        setProfile({
          userId: p.userId,
          displayName: p.displayName,
          pictureUrl: p.pictureUrl,
        });
        setIdToken(liff.getIDToken());
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        // Surface the real reason: a wrong LIFF id and an expired token fail very
        // differently and the organizer needs to know which one they hit.
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LiffState>(
    () => ({
      status,
      profile,
      idToken,
      error,
      login: () => {
        void import("@line/liff").then((m) => m.default.login());
      },
      logout: () => {
        void import("@line/liff").then((m) => {
          m.default.logout();
          setProfile(null);
          setIdToken(null);
          setStatus("logged-out");
        });
      },
    }),
    [status, profile, idToken, error],
  );

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>;
}

export function useLiff(): LiffState {
  const ctx = useContext(LiffContext);
  if (!ctx) {
    throw new Error("useLiff ต้องอยู่ภายใต้ <LiffProvider>");
  }
  return ctx;
}
