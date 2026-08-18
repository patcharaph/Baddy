"use client";

import { useRouter } from "next/navigation";
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
  /** Logged in to LINE; exchanging the ID token for a Supabase session. */
  | "signing-in"
  /** Initialised, logged in, and the Supabase session is established. */
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
  /** Close the LIFF window. A no-op outside LINE, where there is nothing to close. */
  close: () => void;
  /** False outside LINE, so the header hides a close button that would do nothing. */
  canClose: boolean;
  /**
   * True only inside LINE's webview.
   *
   * Not the same as "LIFF is configured": an organizer running the door from a
   * laptop has a working LIFF app and is not in the client, and the two cases
   * differ in what the shell may offer — there is no window to close and no
   * automatic identity to assume.
   */
  isInClient: boolean;
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
  const [isInClient, setIsInClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!hasLiffConfig) return;

    let cancelled = false;

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: publicEnv.liffId });
        if (cancelled) return;

        setIsInClient(liff.isInClient());

        // Outside LINE this is the normal first state, not a failure: the SDK
        // works in an ordinary browser, but nobody has been through LINE Login
        // yet. The shell offers the button rather than redirecting on its own —
        // an unannounced bounce to a login screen is how a shared laptop signs
        // the wrong person in.
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

        const token = liff.getIDToken();
        setIdToken(token);

        // Being logged in to LINE is not the same as being signed in here. The
        // ID token is exchanged for a Supabase session before the app is told
        // it is ready, so nothing renders against a session that does not exist.
        if (!token) {
          setError("LIFF ไม่ได้คืน id token — ตรวจ scope openid ของ LIFF app");
          setStatus("error");
          return;
        }

        setStatus("signing-in");
        const response = await fetch("/api/auth/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        });
        if (cancelled) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? `เข้าสู่ระบบไม่สำเร็จ (${response.status})`);
          setStatus("error");
          return;
        }

        setStatus("ready");
        // The pages were rendered before a session existed; re-run them now
        // that RLS can see who the caller is.
        router.refresh();
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
    // Runs once per mount: signing in twice would burn a second magic link for
    // no benefit. `router` is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        void import("@line/liff").then(async (m) => {
          m.default.logout();
          setProfile(null);
          setIdToken(null);
          setStatus("logged-out");
          // Drop the Supabase session too. Logging out of LINE while a server
          // cookie still names you is how the next person at a shared desk
          // inherits the last one's guan.
          await fetch("/api/auth/line", { method: "DELETE" }).catch(() => {});
          router.refresh();
        });
      },
      close: () => {
        if (!isInClient) return;
        void import("@line/liff").then((m) => m.default.closeWindow());
      },
      canClose: isInClient,
      isInClient,
    }),
    [status, profile, idToken, error, isInClient, router],
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
