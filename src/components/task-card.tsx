import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One row of the "what needs doing" list on the home screen.
 *
 * The dot is the whole point: lime means this is waiting on you right now, grey
 * means it is only here so you can see it. A list where everything is urgent is
 * a list nobody reads, so at most one or two rows should ever be lime.
 */
export function TaskCard({
  href,
  title,
  detail,
  badge,
  urgent = false,
  badgeTone = "quiet",
}: {
  href: string;
  title: string;
  detail: string;
  badge: ReactNode;
  urgent?: boolean;
  badgeTone?: "accent" | "quiet" | "mono";
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-line bg-inset-soft px-3.5 py-2.5 transition-colors hover:border-accent"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          urgent ? "bg-accent-fill" : "bg-faint"
        }`}
        aria-hidden
      />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-medium">{title}</span>
        <span className="truncate text-[11.5px] text-muted">{detail}</span>
      </span>

      <span
        className={`shrink-0 rounded-[9px] px-2.5 py-[5px] text-[11px] font-semibold whitespace-nowrap ${
          badgeTone === "accent"
            ? "bg-accent-soft text-accent"
            : badgeTone === "mono"
              ? "bg-chip font-mono text-ink"
              : "bg-chip text-ink"
        }`}
      >
        {badge}
      </span>
    </Link>
  );
}
