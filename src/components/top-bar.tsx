import type { ReactNode } from "react";

import { ShuttleIcon } from "./ui";

/**
 * Navy header with the brand and one line of session context.
 *
 * Sticky rather than fixed so it survives the iOS keyboard, which shifts fixed
 * elements out of the viewport inside LINE's webview.
 */
export function TopBar({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 bg-[linear-gradient(135deg,#1B2547,#2C3B6E)] px-[18px] pt-4 pb-3.5 text-white">
      <div className="flex items-center gap-2 font-display text-xl font-bold tracking-[0.3px]">
        <ShuttleIcon className="h-[22px] w-[22px] shrink-0" />
        Baddy
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-white/12 px-[11px] py-2 text-[12.5px]">
        <span className="min-w-0 truncate">{left}</span>
        {right ? <span className="shrink-0">{right}</span> : null}
      </div>
    </header>
  );
}
