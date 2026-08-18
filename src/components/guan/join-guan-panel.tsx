"use client";

import { useActionState } from "react";

import { Notice, primaryButton } from "@/components/ui";
import { joinGuanByInvite, type FormState } from "@/lib/data/mutations";
import { useLiff } from "@/lib/liff/provider";

const EMPTY: FormState = { errors: {} };

/**
 * The button at the end of an invite link (US-1.2).
 *
 * Which of the two things this renders depends on something only the client
 * knows. Inside LINE the provider exchanges the ID token and refreshes, and the
 * server comes back with a `playerId` — so the join button appears on its own
 * without anyone tapping anything. Anywhere else, LINE Login is a redirect, and
 * the honest thing to show is a button that says so.
 *
 * It never redirects to LINE by itself. Someone following a link from a group
 * chat should be told what they are about to join before they are bounced to a
 * login screen — and on a shared laptop an unannounced bounce is how the wrong
 * person ends up in the guan.
 */
export function JoinGuanPanel({
  code,
  signedIn,
}: {
  code: string;
  signedIn: boolean;
}) {
  const [state, action, pending] = useActionState(joinGuanByInvite, EMPTY);
  const { status, login, error } = useLiff();

  if (signedIn) {
    return (
      <form action={action} className="flex flex-col gap-2.5">
        <input type="hidden" name="code" value={code} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "กำลังเข้าร่วม…" : "เข้าร่วมก๊วนนี้"}
        </button>
        {state.errors.form ? <Notice>{state.errors.form}</Notice> : null}
      </form>
    );
  }

  // The provider is mid-flight: inside LINE this resolves by itself in a moment,
  // so offering a login button here would be a race with it.
  if (status === "loading" || status === "signing-in") {
    return (
      <button type="button" disabled className={primaryButton}>
        กำลังเชื่อมต่อ LINE…
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={login} className={primaryButton}>
        เข้าสู่ระบบด้วย LINE เพื่อเข้าร่วม
      </button>
      <p className="text-center text-[11px] leading-relaxed text-faint text-pretty">
        ใช้บัญชี LINE ที่มีอยู่ ไม่ต้องสมัครอะไรใหม่ — โปรไฟล์เดิมของคุณจะถูกผูกเข้ากับก๊วนนี้
      </p>
      {status === "error" ? <Notice>{error ?? "เชื่อมต่อ LINE ไม่สำเร็จ"}</Notice> : null}
      {status === "browser" ? (
        <Notice>
          ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID — เข้าสู่ระบบด้วย LINE ในเครื่องนี้ยังไม่ได้
        </Notice>
      ) : null}
    </div>
  );
}
