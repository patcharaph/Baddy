import type { ReactNode } from "react";

/**
 * Form parts, for the two screens where someone types instead of taps.
 *
 * Separate from `ui.tsx` because the rest of the app has almost no inputs — the
 * prototype is a board you press, not a form you fill — and the rules these need
 * (a label bound to its control, an error message the field points at) are not
 * rules anything in `ui.tsx` has.
 *
 * Same discipline as the rest: no raw colours, 46px minimum touch target, and
 * numbers rendered mono so a rate lines up with the rates on the money screen.
 */

/** Shared control chrome. Extended rather than copied by each input. */
const controlBase =
  "w-full min-h-[46px] rounded-[14px] border bg-inset px-3.5 text-[14px] " +
  "text-ink placeholder:text-ghost transition-colors " +
  "focus:border-accent focus:outline-none";

export const textInput = `${controlBase} border-line`;

/** Money and counts. Mono so the digits are comparable down a column. */
export const numberInput = `${controlBase} border-line font-mono`;

export const selectInput = `${controlBase} border-line appearance-none pr-9`;

const errorRing = "border-warn-line";

/**
 * A labelled control, and the sentence that says what is wrong with it.
 *
 * The error is rendered inside the field rather than collected at the top of the
 * form, because "โควตาต้องมากกว่า 0" is only actionable next to the box that
 * holds the 0. `htmlFor`/`id` are required arguments for the same reason a label
 * is: tapping the label has to focus the control on a phone.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] leading-snug text-warn">{error}</p>
      ) : hint ? (
        <p className="text-[11px] leading-snug text-faint text-pretty">{hint}</p>
      ) : null}
    </div>
  );
}

/** `className` for a control that currently has an error against it. */
export function controlClass(base: string, error?: string): string {
  return error ? `${base.replace("border-line", errorRing)}` : base;
}

/** A group of fields under one heading, boxed the way the cards elsewhere are. */
export function FieldSet({
  legend,
  note,
  children,
}: {
  legend: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4">
      <legend className="flex items-baseline gap-2 px-1">
        <span className="text-[13px] font-bold">{legend}</span>
        {note ? <span className="text-[11px] text-faint">{note}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}
