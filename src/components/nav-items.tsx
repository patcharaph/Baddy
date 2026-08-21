import type { MemberRole } from "@/lib/domain/types";

/**
 * The destinations the shell offers, and the icons for them.
 *
 * Shared by the two things that render them — the bottom tabs on a phone and the
 * side rail on a desktop — because they are one navigation shown two ways. Kept
 * apart from both so that adding a screen cannot land in one and not the other,
 * which on a laptop would be a tab that simply does not exist.
 *
 * An organizer's items are the four things they run: the round, the queue, the
 * money, themselves. Check-in and shuttle logging are not among them because
 * they are always reached from the thing that prompted them (a waitlist card, a
 * court that just finished), and a permanent slot would put them a level away.
 *
 * A player gets check-in instead, because it is the only thing they actually do
 * here, and it has to be reachable the second they walk in.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: () => React.JSX.Element;
}

const ORGANIZER_ITEMS: readonly NavItem[] = [
  { href: "/", label: "หน้าหลัก", icon: HomeIcon },
  { href: "/queue", label: "คิว", icon: BoardIcon },
  { href: "/money", label: "เงิน", icon: MoneyIcon },
  { href: "/profile", label: "โปรไฟล์", icon: ProfileIcon },
];

const PLAYER_ITEMS: readonly NavItem[] = [
  { href: "/", label: "หน้าหลัก", icon: HomeIcon },
  { href: "/checkin", label: "เช็คอิน", icon: CheckIcon },
  { href: "/queue", label: "คิว", icon: BoardIcon },
  { href: "/money", label: "ยอดฉัน", icon: MoneyIcon },
  { href: "/profile", label: "โปรไฟล์", icon: ProfileIcon },
];

export function navItemsFor(role: MemberRole): readonly NavItem[] {
  return role === "organizer" ? ORGANIZER_ITEMS : PLAYER_ITEMS;
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "h-[19px] w-[19px]",
  "aria-hidden": true,
} as const;

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" />
    </svg>
  );
}

/** A court, seen from above — the same shape the queue board draws. */
function BoardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M12 4.5v15M3.5 12h17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.4 12.2 2.5 2.5 4.7-5" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.6 10h3.2a1.35 1.35 0 010 2.7H9.6" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8.5" r="3.3" />
      <path d="M5.5 19.5c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" />
    </svg>
  );
}
