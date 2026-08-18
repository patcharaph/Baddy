"use client";

import { useLiff } from "@/lib/liff/provider";

/**
 * The bar at the top of the LIFF sheet: which guan, which round, who you are.
 *
 * It stays put across every screen because the one thing a player must never
 * have to work out is *which* round they are looking at — several guans share a
 * phone, and the numbers below are only meaningful under this title.
 *
 * Sticky rather than fixed: inside LINE's webview the iOS keyboard shifts fixed
 * elements out of the viewport.
 */
export function AppHeader({
  guanName,
  subtitle,
  isOrganizer,
}: {
  guanName: string;
  subtitle: string;
  isOrganizer: boolean;
}) {
  const { close, canClose } = useLiff();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-screen px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-accent-fill font-mono text-[13px] font-bold text-on-accent"
          aria-hidden
        >
          {guanName.charAt(0)}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold">{guanName}</span>
            <span
              className={`rounded-[6px] px-[7px] py-px font-mono text-[9px] font-semibold tracking-[0.08em] ${
                isOrganizer ? "bg-accent-soft text-accent" : "bg-chip text-muted"
              }`}
            >
              {isOrganizer ? "ADMIN" : "PLAYER"}
            </span>
          </div>
          <span className="truncate font-mono text-[10px] text-faint">
            {subtitle}
          </span>
        </div>

        {canClose ? (
          <button
            type="button"
            onClick={close}
            aria-label="ปิดหน้าต่าง"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chip text-[15px] text-muted"
          >
            ✕
          </button>
        ) : null}
      </div>
    </header>
  );
}
