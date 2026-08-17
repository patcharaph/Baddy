"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import {
  controlClass,
  Field,
  FieldSet,
  numberInput,
  selectInput,
  textInput,
} from "@/components/form";
import { Notice, primaryButton } from "@/components/ui";
import type { GuanMembershipView } from "@/lib/data/queries";
import { createSession, type FormState } from "@/lib/data/mutations";
import type { SplitMode } from "@/lib/supabase/database.types";

const EMPTY: FormState = { errors: {} };

/** The default hour a guan books. Nothing here depends on it being right. */
const DEFAULT_START_HOUR = 19;

const MODES: readonly {
  value: SplitMode;
  label: string;
  detail: string;
}[] = [
  {
    value: "buffet",
    label: "บุฟเฟ่ต์เหมาจ่าย",
    detail: "เรตเดียวต่อคน ค่าลูกรวมในเรตแล้ว — ก๊วนส่วนใหญ่ใช้แบบนี้",
  },
  {
    value: "per_game",
    label: "รายเกม",
    detail: "จ่ายตามจำนวนเกมที่ลง + ค่าสนามหาร — ลูกเกินหารใน 4 คนของแมตช์",
  },
  {
    value: "even",
    label: "หารเท่ากันตอนเลิก",
    detail: "(ค่าลูกรวมจริง + ค่าสนาม) ÷ จำนวนคน — ไม่ต้องตั้งเรตล่วงหน้า",
  },
];

/**
 * Open a round (US-2.1).
 *
 * Two things make this a Client Component rather than a plain `<form action>`:
 *
 *   1. The rate fields depend on the split mode. Rendering all three sets at once
 *      would ask the organizer for numbers their mode will never read, and the
 *      one it *does* need is the one that decides whether the money screen works
 *      at all tonight.
 *   2. `datetime-local` has no timezone. The offset has to be read in the browser
 *      — on the server "local" is the host's zone, which is how a 19:00 round
 *      becomes an 02:00 one. The submit button stays disabled until it is read,
 *      so the form cannot be sent without it.
 */
export function CreateSessionForm({ guans }: { guans: GuanMembershipView[] }) {
  const [state, action, pending] = useActionState(createSession, EMPTY);
  const [mode, setMode] = useState<SplitMode>("buffet");
  const [guanId, setGuanId] = useState(guans[0]?.guanId ?? "");

  // Both of these are the browser's answer and the server has no valid one, so
  // they are read through `useSyncExternalStore`: it renders the server snapshot
  // during hydration and swaps in the client's afterwards, which is the whole
  // job. Doing it in an effect would be a second render triggered by a setState
  // that React has no reason to expect.
  const tzOffset = useSyncExternalStore(neverChanges, readTzOffset, () => null);
  const defaultStart = useSyncExternalStore(neverChanges, readDefaultStart, () => "");

  const { errors } = state;
  const guan = guans.find((g) => g.guanId === guanId) ?? guans[0];
  const ready = tzOffset !== null;

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Read after mount; `ready` gates the submit so it is never absent. */}
      <input type="hidden" name="tzOffsetMinutes" value={tzOffset ?? ""} />

      <FieldSet legend="รอบเล่น">
        {guans.length > 1 ? (
          <Field id="guanId" label="ก๊วน" error={errors.guanId}>
            <select
              id="guanId"
              name="guanId"
              value={guanId}
              onChange={(e) => setGuanId(e.target.value)}
              className={controlClass(selectInput, errors.guanId)}
            >
              {guans.map((g) => (
                <option key={g.guanId} value={g.guanId}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="guanId" value={guanId} />
        )}

        <Field
          id="startsAtLocal"
          label="เริ่มเมื่อไหร่"
          error={errors.startsAtLocal ?? errors.tzOffsetMinutes}
        >
          <input
            id="startsAtLocal"
            name="startsAtLocal"
            type="datetime-local"
            defaultValue={defaultStart}
            key={defaultStart}
            className={controlClass(textInput, errors.startsAtLocal)}
          />
        </Field>

        <Field
          id="endsAtLocal"
          label="เลิกกี่โมง"
          hint="เว้นว่างได้ ถ้ายังไม่รู้ว่าจะเล่นถึงกี่โมง"
          error={errors.endsAtLocal}
        >
          <input
            id="endsAtLocal"
            name="endsAtLocal"
            type="datetime-local"
            className={controlClass(textInput, errors.endsAtLocal)}
          />
        </Field>

        <Field id="venue" label="สนาม" error={errors.venue}>
          <input
            id="venue"
            name="venue"
            type="text"
            autoComplete="off"
            defaultValue={guan?.homeVenue ?? ""}
            key={guan?.guanId}
            placeholder="ยิมเทศบาล คอร์ท 3–4"
            className={controlClass(textInput, errors.venue)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="courtCount" label="จำนวนคอร์ท" error={errors.courtCount}>
            <input
              id="courtCount"
              name="courtCount"
              type="text"
              inputMode="numeric"
              defaultValue="2"
              className={controlClass(numberInput, errors.courtCount)}
            />
          </Field>

          <Field
            id="capacity"
            label="โควตาผู้เล่น"
            hint="เว้นว่าง = ไม่จำกัด"
            error={errors.capacity}
          >
            <input
              id="capacity"
              name="capacity"
              type="text"
              inputMode="numeric"
              placeholder="ไม่จำกัด"
              className={controlClass(numberInput, errors.capacity)}
            />
          </Field>
        </div>

        <Field
          id="courtRate"
          label="ค่าคอร์ททั้งรอบ (บาท)"
          hint="ยอดรวมที่จะนำไปหาร ไม่ใช่เรตต่อชั่วโมง"
          error={errors.courtRate}
        >
          <input
            id="courtRate"
            name="courtRate"
            type="text"
            inputMode="numeric"
            defaultValue={guan ? String(guan.defaultCourtRate) : "0"}
            key={`rate-${guan?.guanId}`}
            className={controlClass(numberInput, errors.courtRate)}
          />
        </Field>
      </FieldSet>

      <FieldSet legend="หารเงินยังไง" note="เลือกได้ 1 แบบต่อรอบ">
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3 transition-colors ${
                mode === m.value
                  ? "border-accent-line bg-accent-soft"
                  : "border-line-soft bg-inset-soft"
              }`}
            >
              <input
                type="radio"
                name="splitMode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-fill)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={`text-[13px] font-semibold ${
                    mode === m.value ? "text-accent" : ""
                  }`}
                >
                  {m.label}
                </span>
                <span className="text-[11px] leading-snug text-muted text-pretty">
                  {m.detail}
                </span>
              </span>
            </label>
          ))}
        </div>

        {errors.splitMode ? (
          <p className="text-[11px] text-warn">{errors.splitMode}</p>
        ) : null}

        {/* Only the chosen mode's rates are asked for — and the one it cannot do
            without is required, so tonight's money screen cannot open on
            "ยังตั้งเรตไม่ครบ". */}
        {mode === "buffet" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field id="buffetRate" label="เรตต่อคน (บาท)" error={errors.buffetRate}>
              <input
                id="buffetRate"
                name="buffetRate"
                type="text"
                inputMode="numeric"
                placeholder="120"
                className={controlClass(numberInput, errors.buffetRate)}
              />
            </Field>
            <Field
              id="womenRate"
              label="เรตหญิง (บาท)"
              hint="เว้นว่างถ้าเรตเดียวกัน"
              error={errors.womenRate}
            >
              <input
                id="womenRate"
                name="womenRate"
                type="text"
                inputMode="numeric"
                placeholder="เท่ากัน"
                className={controlClass(numberInput, errors.womenRate)}
              />
            </Field>
          </div>
        ) : null}

        {mode === "per_game" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="perGameRate"
              label="เรตต่อเกม (บาท)"
              error={errors.perGameRate}
            >
              <input
                id="perGameRate"
                name="perGameRate"
                type="text"
                inputMode="numeric"
                placeholder="25"
                className={controlClass(numberInput, errors.perGameRate)}
              />
            </Field>
            <Field
              id="shuttlesIncludedPerMatch"
              label="ลูกที่รวมต่อแมตช์"
              hint="กติกามาตรฐานคือ 1 เกม = 1 ลูก"
              error={errors.shuttlesIncludedPerMatch}
            >
              <input
                id="shuttlesIncludedPerMatch"
                name="shuttlesIncludedPerMatch"
                type="text"
                inputMode="numeric"
                defaultValue="1"
                className={controlClass(
                  numberInput,
                  errors.shuttlesIncludedPerMatch,
                )}
              />
            </Field>
          </div>
        ) : null}

        {mode === "even" ? (
          <p className="rounded-[14px] bg-inset px-3 py-2.5 text-[11.5px] leading-relaxed text-muted text-pretty">
            โหมดนี้ไม่ต้องตั้งเรตล่วงหน้า — ยอดมาจากค่าลูกที่กดจริงตลอดรอบบวกค่าสนาม
            แล้วหารตามจำนวนคน
          </p>
        ) : null}
      </FieldSet>

      {errors.form ? <Notice>{errors.form}</Notice> : null}

      <button
        type="submit"
        disabled={pending || !ready}
        className={primaryButton}
      >
        {pending ? "กำลังเปิดรอบ…" : "เปิดรอบ"}
      </button>
    </form>
  );
}

/**
 * Neither of the two browser values below changes while the form is open, so
 * there is nothing to subscribe to — the store exists only for the
 * server/client snapshot split.
 */
function neverChanges(): () => void {
  return () => {};
}

/** Both return strings, so React's `Object.is` check settles after one render. */
function readTzOffset(): string {
  return String(new Date().getTimezoneOffset());
}

function readDefaultStart(): string {
  return todayAt(DEFAULT_START_HOUR);
}

/**
 * `datetime-local` wants the browser's wall clock, not an ISO instant.
 *
 * Built from the local components rather than `toISOString().slice(0, 16)`,
 * which would hand the input a UTC time and pre-fill the round with the wrong
 * hour in every zone but one.
 */
function todayAt(hour: number): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(hour)}:00`
  );
}
