"use client";

import { useTransition } from "react";

import { setTheme } from "@/lib/data/mutations";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: () => React.ReactElement }[] =
  [
    { value: "system", label: "ตามระบบ", icon: SystemIcon },
    { value: "light", label: "สว่าง", icon: SunIcon },
    { value: "dark", label: "มืด", icon: MoonIcon },
  ];

/**
 * Light / dark / follow-the-phone.
 *
 * Three options rather than a two-state switch: a badminton session runs from
 * evening into night, and "whatever my phone is doing" is the setting most
 * people actually want — a binary toggle would quietly opt them out of it.
 *
 * The choice round-trips through the server because `<html data-theme>` is
 * server-rendered; that costs a request but buys no flash of the wrong theme
 * when the LIFF sheet opens.
 */
export function ThemeSwitch({ preference }: { preference: ThemePreference }) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label="ธีมของแอป"
      className="flex gap-1.5 rounded-[14px] bg-inset p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => startTransition(() => setTheme(value))}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[11px] text-[12.5px] font-semibold transition-colors ${
              active
                ? "bg-accent-fill text-on-accent"
                : "bg-transparent text-muted"
            }`}
          >
            <Icon />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-[15px] w-[15px]",
  "aria-hidden": true,
} as const;

function SystemIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.5" width="18" height="13" rx="2" />
      <path d="M9 20.5h6" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 13.5A8 8 0 1110.5 4a6.4 6.4 0 009.5 9.5z" />
    </svg>
  );
}
