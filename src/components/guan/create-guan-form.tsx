"use client";

import { useActionState } from "react";

import {
  controlClass,
  Field,
  FieldSet,
  numberInput,
  textInput,
} from "@/components/form";
import { Notice, primaryButton } from "@/components/ui";
import { createGuan, type FormState } from "@/lib/data/mutations";

const EMPTY: FormState = { errors: {} };

/**
 * Create a guan (US-1.1).
 *
 * Only the name is required. The venue and the rate are per-session defaults the
 * organizer overrides anyway, so demanding them here would put a form between
 * someone and the guan they came to create — before they necessarily know either.
 *
 * A Client Component because the errors come back from the action and belong next
 * to the field that caused them; `required` is left off the name input on purpose
 * so the sentence a blank name produces is the server's one, in Thai, and not the
 * browser's in whatever locale it happens to be in.
 */
export function CreateGuanForm() {
  const [state, action, pending] = useActionState(createGuan, EMPTY);
  const { errors } = state;

  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldSet legend="ก๊วนใหม่" note="แก้ทีหลังได้">
        <Field id="name" label="ชื่อก๊วน" error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            enterKeyHint="next"
            autoComplete="off"
            placeholder="ก๊วนวันพุธ"
            className={controlClass(textInput, errors.name)}
          />
        </Field>

        <Field
          id="homeVenue"
          label="สนามประจำ"
          hint="เว้นว่างได้ — ตั้งต่อรอบก็ได้"
          error={errors.homeVenue}
        >
          <input
            id="homeVenue"
            name="homeVenue"
            type="text"
            autoComplete="off"
            placeholder="ยิมเทศบาล คอร์ท 3–4"
            className={controlClass(textInput, errors.homeVenue)}
          />
        </Field>

        <Field
          id="defaultCourtRate"
          label="ค่าคอร์ทตั้งต้น (บาท)"
          hint="ยอดค่าคอร์ททั้งรอบ ไม่ใช่ต่อชั่วโมง — ใส่เป็นค่าเริ่มต้นของรอบใหม่"
          error={errors.defaultCourtRate}
        >
          <input
            id="defaultCourtRate"
            name="defaultCourtRate"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="600"
            className={controlClass(numberInput, errors.defaultCourtRate)}
          />
        </Field>
      </FieldSet>

      {errors.form ? <Notice>{errors.form}</Notice> : null}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "กำลังสร้าง…" : "สร้างก๊วน"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-faint text-pretty">
        คุณจะเป็นหัวหน้าก๊วนอัตโนมัติ และได้ลิงก์เชิญไว้แชร์ในแชทก๊วนทันที
      </p>
    </form>
  );
}
