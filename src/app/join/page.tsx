import Link from "next/link";

import { PasteInviteForm } from "@/components/guan/paste-invite-form";
import { ghostButton } from "@/components/ui";

export const metadata = { title: "เข้าร่วมก๊วน — Baddy" };

/**
 * Enter an invite by hand (US-1.2).
 *
 * Reached from the dead-link screen and from the profile, for the case a link
 * arrived broken — which is the normal case for anything pasted through several
 * chats. Static: there is nothing to read until a code has been typed.
 */
export default function PasteInvitePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center gap-6 bg-screen px-5 py-10">
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-accent">
          BADDY
        </span>
        <p className="text-[11.5px] text-faint">เข้าร่วมก๊วนด้วยลิงก์เชิญ</p>
      </div>

      <section className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-6 shadow-card">
        <PasteInviteForm />
      </section>

      <Link href="/" className={`${ghostButton} self-center`}>
        กลับเข้าแอป
      </Link>
    </div>
  );
}
