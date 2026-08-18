"use client";

import type { ReactNode } from "react";

import {
  controlClass,
  Field,
  FieldSet,
  numberInput,
  textInput,
} from "@/components/form";
import type { FieldErrors } from "@/lib/domain/drafts";
import type { SplitMode } from "@/lib/supabase/database.types";

/**
 * Every field a round is made of, shared by the form that opens one and the form
 * that edits one.
 *
 * Both ask for the same eleven numbers under the same rules —
 * `validateSessionDraft` and `validateSessionEdit` are one validator with a
 * different id in front of it — so two copies of this markup would mean the next
 * change to the rate fields lands on one screen and not the other. A round
 * opened under rules the edit form does not enforce is a money screen that
 * refuses to open at 23:00.
 *
 * Everything is uncontrolled: the server action is what reads these, and the
 * only value React has to be told about is the split mode, because it decides
 * which rate fields exist. `identityKey` covers the one case that breaks —
 * when the *source* of the defaults changes, a different guan picked in the
 * create form, the inputs have to remount or they keep the old values.
 */
export interface SessionFieldValues {
  venue: string;
  /** `datetime-local` strings, already in the browser's zone. */
  startsAtLocal: string;
  endsAtLocal: string;
  courtCount: string;
  capacity: string;
  courtRate: string;
  buffetRate: string;
  womenRate: string;
  perGameRate: string;
  shuttlesIncludedPerMatch: string;
}

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

export function SessionFields({
  values,
  errors,
  mode,
  onModeChange,
  identityKey,
  leading,
}: {
  values: SessionFieldValues;
  errors: FieldErrors;
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  /** Changes when the defaults come from a different source, remounting them. */
  identityKey: string;
  /** Rendered at the top of the first group — the guan picker, when there is one. */
  leading?: ReactNode;
}) {
  return (
    <>
      <FieldSet legend="รอบเล่น">
        {leading}

        <Field
          id="startsAtLocal"
          label="เริ่มเมื่อไหร่"
          error={errors.startsAtLocal ?? errors.tzOffsetMinutes}
        >
          <input
            id="startsAtLocal"
            name="startsAtLocal"
            type="datetime-local"
            defaultValue={values.startsAtLocal}
            key={`start-${values.startsAtLocal}`}
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
            defaultValue={values.endsAtLocal}
            key={`end-${values.endsAtLocal}`}
            className={controlClass(textInput, errors.endsAtLocal)}
          />
        </Field>

        <Field id="venue" label="สนาม" error={errors.venue}>
          <input
            id="venue"
            name="venue"
            type="text"
            autoComplete="off"
            defaultValue={values.venue}
            key={`venue-${identityKey}`}
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
              defaultValue={values.courtCount}
              key={`courts-${identityKey}`}
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
              defaultValue={values.capacity}
              key={`capacity-${identityKey}`}
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
            defaultValue={values.courtRate}
            key={`rate-${identityKey}`}
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
                onChange={() => onModeChange(m.value)}
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
                defaultValue={values.buffetRate}
                key={`buffet-${identityKey}`}
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
                defaultValue={values.womenRate}
                key={`women-${identityKey}`}
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
                defaultValue={values.perGameRate}
                key={`pergame-${identityKey}`}
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
                defaultValue={values.shuttlesIncludedPerMatch}
                key={`included-${identityKey}`}
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
    </>
  );
}
