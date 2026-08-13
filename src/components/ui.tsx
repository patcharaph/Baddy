import type { ReactNode } from "react";

/** Round initial-letter avatar, coloured per player. */
export function Avatar({
  name,
  color,
  size = 26,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.42,
      }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  );
}

/** Skill level chip (มือ). */
export function SkillChip({ level }: { level: string }) {
  return (
    <span className="rounded-[5px] bg-chip px-1.5 py-px text-[10px] font-semibold text-navy">
      {level}
    </span>
  );
}

export function SectionTitle({
  children,
  note,
}: {
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <h2 className="mx-0.5 mt-1 mb-2.5 flex items-center gap-[7px] font-display text-[15px] font-semibold">
      {children}
      {note ? (
        <span className="font-sans text-[12.5px] font-medium text-muted">
          {note}
        </span>
      ) : null}
    </h2>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-3 ${className}`}
    >
      {children}
    </div>
  );
}

export function ShuttleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 3l4 11H8l4-11z" fill="currentColor" />
      <circle cx="12" cy="18" r="3.4" fill="#FF6A45" />
      <path
        d="M9 14l-2 3M12 14v3.6M15 14l2 3"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
