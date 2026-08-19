"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItemsFor } from "@/components/nav-items";
import type { MemberRole } from "@/lib/domain/types";

/**
 * The desktop navigation: the same destinations as the bottom tabs, down the
 * side instead of across the bottom.
 *
 * Only from `md` up. On a phone the thumb is at the bottom of the screen and the
 * tabs belong there; on a laptop the pointer is anywhere, the window is wider
 * than it is tall, and the side is where a person looks for the way around.
 *
 * It is `sticky` rather than fixed so it scrolls into place inside the frame the
 * layout centres, instead of pinning itself to a window edge that may be a long
 * way further out than the app.
 *
 * Labels are always shown. An icon-only rail saves room the desktop already has
 * to spare, and these five words are the only thing that says whether "เงิน" is
 * the guan's money or yours.
 */
export function SideNav({ role }: { role: MemberRole }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลัก"
      className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col gap-1 px-3 py-6 md:flex"
    >
      <Link
        href="/"
        className="mb-4 flex items-center gap-2.5 px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-accent"
      >
        BADDY
      </Link>

      {navItemsFor(role).map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-[13px] px-3 text-[13px] font-medium transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-chip hover:text-ink"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
