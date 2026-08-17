import Link from "next/link";

import { CreateGuanForm } from "@/components/guan/create-guan-form";
import { Notice, ScreenTitle, ghostButton } from "@/components/ui";
import { loadProfile } from "@/lib/data/source";

export const metadata = { title: "สร้างก๊วน — Baddy" };

export const dynamic = "force-dynamic";

/**
 * Create a guan (PRD FR-1, US-1.1).
 *
 * Inside the tab shell rather than on its own, so someone who opened it by
 * mistake can leave the way they came. The sign-in bar in that shell is also the
 * answer to the only state this screen cannot handle itself: `create_guan` needs
 * to know who the owner is, and a signed-out visitor has no answer to that.
 */
export default async function NewGuanPage() {
  const { kind, viewer } = await loadProfile();
  const signedOut = kind !== "sample" && viewer.playerId === null;

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="สร้างก๊วน"
        subtitle="ตั้งชื่อก๊วนแล้วได้ลิงก์เชิญไปแชร์ในแชท สมาชิกกดเข้าร่วมด้วย LINE ได้เลย"
        action={
          <Link href="/profile" className={ghostButton}>
            ยกเลิก
          </Link>
        }
      />

      {kind === "sample" ? (
        <Notice>
          นี่คือโหมดข้อมูลตัวอย่าง — ดูหน้าจอได้ แต่สร้างก๊วนจริงยังไม่ได้จนกว่าจะตั้งค่า Supabase
        </Notice>
      ) : null}

      {signedOut ? (
        <Notice>
          ต้องเข้าสู่ระบบด้วย LINE ก่อนถึงจะสร้างก๊วนได้ — ใช้ปุ่มเข้าสู่ระบบด้านบนของหน้า
        </Notice>
      ) : null}

      <CreateGuanForm />
    </main>
  );
}
