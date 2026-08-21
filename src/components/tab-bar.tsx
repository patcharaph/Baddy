"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItemsFor } from "@/components/nav-items";
import type { MemberRole } from "@/lib/domain/types";

/**
 * The bottom tabs — the phone's navigation, and only the phone's.
 *
 * Hidden from `md` up, where `SideNav` takes over. A bar pinned to the bottom
 * edge of a laptop window is a long way from everything else on the screen and
 * is the single clearest tell that a page was drawn for a phone; the two render
 * the same list from `nav-items` so neither can drift from the other.
 *
 * Fixed rather than sticky so it survives the iOS keyboard, and capped to the
 * same width as the column above it so it lines up with the content it belongs
 * to rather than the window it happens to be in.
 */
export function TabBar({ role }: { role: MemberRole }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[430px] border-t border-line bg-screen/85 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+4px)] backdrop-blur-xl md:hidden">
      {navItemsFor(role).map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1.5 text-[10.5px] font-medium ${
              active ? "text-accent" : "text-faint"
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
