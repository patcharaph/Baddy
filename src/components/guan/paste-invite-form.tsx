"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { controlClass, Field, textInput } from "@/components/form";
import { primaryButton } from "@/components/ui";
import { parseInviteCode } from "@/lib/domain/invite";

/**
 * The way in when the link itself did not survive the trip.
 *
 * Links get truncated by chat clients, forwarded as screenshots, and read out
 * loud. `parseInviteCode` accepts the whole URL as well as a bare code, so this
 * field takes whatever the player actually has — which is almost never just the
 * code.
 *
 * Resolving happens client-side and then navigates, rather than posting: the
 * landing page already knows how to render every outcome of a code, so the only
 * thing left to do is get there.
 */
export function PasteInviteForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const code = parseInviteCode(value);
    if (code === null) {
      setError("อ่านลิงก์เชิญนี้ไม่ออก — วางลิงก์ทั้งอันที่ได้จากหัวหน้าก๊วนดูอีกครั้ง");
      return;
    }

    setError(undefined);
    router.push(`/join/${encodeURIComponent(code)}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        id="invite"
        label="ลิงก์เชิญ หรือรหัสก๊วน"
        hint="วางลิงก์ทั้งอันได้เลย ไม่ต้องตัดให้เหลือแค่รหัส"
        error={error}
      >
        <input
          id="invite"
          name="invite"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://liff.line.me/…/join/…"
          className={controlClass(textInput, error)}
        />
      </Field>

      <button type="submit" className={primaryButton}>
        เปิดคำเชิญ
      </button>
    </form>
  );
}
