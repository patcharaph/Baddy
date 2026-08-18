import type { ReactNode } from "react";

/**
 * The building blocks every screen in the LIFF prototype is made of.
 *
 * They exist so the semantic palette, the 44px touch targets and the "numbers
 * are always mono" rule are decided once. A screen that needs something slightly
 * different should extend one of these rather than open-code a colour — nothing
 * here names a raw colour, which is what lets both themes come from one build.
 */

/**
 * Button styling as class strings rather than components.
 *
 * Buttons live on both sides of the server/client line here — some are `Link`s
 * rendered on the server, some carry an `onClick` — and a shared component would
 * force every one of them into a Client Component just to be styled.
 *
 * The 44px minimum is from the prototype's design notes: this is a phone screen
 * used standing up, mid-game, one-handed.
 */
const buttonBase =
  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] " +
  "px-4 text-sm font-semibold transition-colors disabled:opacity-40";

/** The one thing this screen wants you to do. */
export const primaryButton = `${buttonBase} border-none bg-accent-fill text-on-accent hover:bg-accent-fill-hover active:bg-accent-fill-hover`;

/** Everything else. */
export const ghostButton = `${buttonBase} border border-line-strong bg-transparent text-ink hover:border-accent hover:text-accent`;

/**
 * Rounded-square initial avatar.
 *
 * `active` is the lime state and means one specific thing: this person is in
 * the round right now (or is you). Everything else is the quiet grey — a list
 * where every avatar is lime tells the organizer nothing.
 */
export function Avatar({
  name,
  active = false,
  size = 34,
}: {
  name: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-semibold ${
        active ? "bg-accent-soft text-accent" : "bg-chip text-muted"
      }`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  );
}

/** A small status pill. `tone` is the only thing that varies. */
export function Pill({
  children,
  tone = "quiet",
}: {
  children: ReactNode;
  tone?: "accent" | "quiet";
}) {
  return (
    <span
      className={`rounded-[7px] px-2 py-[3px] text-[10.5px] font-semibold whitespace-nowrap ${
        tone === "accent" ? "bg-accent-soft text-accent" : "bg-chip text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/** The live dot: accented and breathing when something is happening right now. */
export function LiveDot({ live = true }: { live?: boolean }) {
  return (
    <span
      className={`h-[7px] w-[7px] shrink-0 rounded-full ${
        live ? "animate-pulse-dot bg-accent-fill" : "bg-faint"
      }`}
      aria-hidden
    />
  );
}

/** The heading every screen opens with: what this is, and one line of why. */
export function ScreenTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-2.5">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl leading-tight font-bold">{title}</h1>
        {subtitle ? (
          <p className="text-[12.5px] leading-snug text-muted text-pretty">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A section break inside a screen, with an optional right-aligned note. */
export function SectionHeading({
  children,
  note,
}: {
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {note ? (
        <span className="font-mono text-[11px] text-faint">{note}</span>
      ) : null}
    </div>
  );
}

/** A number worth reading at a glance, with its label under it. */
export function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[3px] rounded-[14px] bg-inset px-2.5 py-3">
      <div
        className={`font-mono text-[22px] leading-none font-bold ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] leading-tight text-muted">{label}</div>
    </div>
  );
}

/** A labelled figure inside a card — quieter than a StatTile. */
export function Figure({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-[13px] bg-inset p-[11px]">
      <div className="text-[10.5px] leading-tight text-muted">{label}</div>
      <div className="font-mono text-[17px] leading-tight font-bold">{value}</div>
    </div>
  );
}

/** Progress towards a quota or a payment total. */
export function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-chip">
      <div
        className="h-full rounded-full bg-accent-fill transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Said when a list is empty, rather than showing nothing at all. */
export function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[16px] border border-dashed border-line px-3 py-7 text-center text-[12.5px] text-muted">
      {children}
    </p>
  );
}

/** A warning the screen cannot fix on its own — a failed write, a missing rate. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[14px] border border-warn-line bg-warn-bg px-3 py-2.5 text-[11.5px] leading-relaxed text-warn">
      {children}
    </p>
  );
}
