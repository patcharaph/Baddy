import Link from "next/link";
import type { ReactNode } from "react";

import { JoinGuanPanel } from "@/components/guan/join-guan-panel";
import { ghostButton, primaryButton } from "@/components/ui";
import { loadInvite } from "@/lib/data/source";
import { parseInviteCode } from "@/lib/domain/invite";
import { LiffProvider } from "@/lib/liff/provider";

export const metadata = { title: "เข้าร่วมก๊วน — Baddy" };

export const dynamic = "force-dynamic";

/**
 * The invite landing page (PRD FR-1, US-1.2).
 *
 * Outside the tab shell on purpose. Whoever opens this is, by definition, not in
 * the guan yet — quite possibly in no guan at all — and putting them inside the
 * app's tabs would hand them an empty board and a bottom bar full of rounds they
 * cannot see, before they have agreed to join anything.
 *
 * It still needs `LiffProvider`: signing in is the whole content of the screen
 * for anyone who did not arrive from a LINE chat.
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code: raw } = await params;

  // Validated here rather than trusted from the URL, so a junk segment produces
  // the dead-link screen instead of a round trip that finds nothing.
  const code = parseInviteCode(decodeURIComponent(raw));
  if (code === null) {
    return (
      <Shell>
        <DeadLink />
      </Shell>
    );
  }

  const invite = await loadInvite(code);
  if (!invite.preview) {
    return (
      <Shell>
        <DeadLink />
      </Shell>
    );
  }

  if (invite.alreadyMember) {
    return (
      <Shell>
        <AlreadyMember name={invite.preview.name} />
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="flex flex-col gap-5 rounded-[22px] border border-line bg-gradient-to-b from-raised to-surface p-6 shadow-card">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-accent-fill text-2xl font-bold text-on-accent"
            aria-hidden
          >
            {invite.preview.name.charAt(0)}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl leading-tight font-bold text-pretty">
              {invite.preview.name}
            </h1>
            <p className="text-[12.5px] text-muted text-pretty">
              {invite.preview.homeVenue ?? "ยังไม่ได้ตั้งสนามประจำ"}
            </p>
          </div>
          <p className="font-mono text-[11px] text-faint">
            สมาชิก {invite.preview.memberCount} คน
          </p>
        </div>

        <JoinGuanPanel code={code} signedIn={invite.playerId !== null} />
      </section>
    </Shell>
  );
}

/**
 * The page around whichever of the four states applies.
 *
 * `LiffProvider` lives here rather than in each branch because the dead-link
 * screen is reachable while LINE is still initialising, and remounting the
 * provider would restart that.
 */
function Shell({ children }: { children: ReactNode }) {
  return (
    <LiffProvider>
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center gap-6 bg-screen px-5 py-10">
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-mono text-[10px] tracking-[0.18em] text-accent">
            BADDY
          </span>
          <p className="text-[11.5px] text-faint">คำเชิญเข้าก๊วนแบดมินตัน</p>
        </div>

        {children}

        <p className="text-center text-[11px] leading-relaxed text-faint text-pretty">
          เข้าร่วมแล้วจะเห็นรอบเล่น คิว และยอดเงินของก๊วนนี้ — โปรไฟล์เดียวใช้ได้ทุกก๊วน
        </p>
      </div>
    </LiffProvider>
  );
}

/**
 * A code that resolves to nothing.
 *
 * Says the two things it could be rather than "not found": invite links get
 * rotated when they leak, and the copy that lands in a chat gets truncated.
 */
function DeadLink() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-6 py-12 text-center">
      <h1 className="text-[15px] font-semibold">ลิงก์เชิญนี้ใช้ไม่ได้แล้ว</h1>
      <p className="text-[12.5px] leading-relaxed text-muted text-pretty">
        อาจถูกเปลี่ยนใหม่ไปแล้ว หรือลิงก์ที่ก็อปมาไม่ครบ — ขอลิงก์ล่าสุดจากหัวหน้าก๊วนอีกครั้งได้เลย
      </p>
      <Link href="/join" className={`${ghostButton} mt-1`}>
        วางลิงก์เชิญเอง
      </Link>
    </section>
  );
}

function AlreadyMember({ name }: { name: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-surface px-6 py-10 text-center">
      <h1 className="text-[15px] font-semibold text-pretty">
        คุณอยู่ในก๊วน {name} อยู่แล้ว
      </h1>
      <p className="text-[12.5px] leading-relaxed text-muted text-pretty">
        ไม่ต้องเข้าร่วมซ้ำ — เปิดแอปดูรอบที่เปิดอยู่ได้เลย
      </p>
      <Link href="/" className={`${primaryButton} mt-1`}>
        เปิด Baddy
      </Link>
    </section>
  );
}
