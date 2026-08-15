"use client";

import { useTransition } from "react";

import { setPreviewRole } from "@/lib/data/mutations";
import type { PreviewRole } from "@/lib/data/viewer";

const ROLES: { value: PreviewRole; label: string }[] = [
  { value: "organizer", label: "หัวหน้าก๊วน" },
  { value: "player", label: "ผู้เล่น" },
  { value: "newcomer", label: "ยังไม่เข้ารอบ" },
];

const HINTS: Record<PreviewRole, string> = {
  organizer:
    "เปิดรอบ เช็คอินแทนคนอื่น จัดคิว บันทึกลูก เลือกวิธีหาร และติ๊กสถานะจ่าย",
  player: "เช็คอินได้แค่ของตัวเอง ดูคิวและยอดของตัวเองแบบอ่านอย่างเดียว",
  newcomer:
    "ผู้เล่นที่อยู่ในก๊วนแต่ยังไม่มีชื่อในรอบนี้ — เข้าร่วมเองได้จากหน้าเช็คอิน",
};

/**
 * Says out loud that the screen is running on sample data, and lets the reviewer
 * switch between the two roles the design is built around.
 *
 * Sample numbers that look real are how a demo turns into a bug report, so this
 * is deliberately hard to miss — and it disappears entirely once Supabase is
 * configured, because then the role is a membership, not a choice.
 */
export function PreviewBar({ role }: { role: PreviewRole }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-b border-line bg-inset px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-faint">
          SAMPLE DATA
        </span>
        <span className="text-[10.5px] text-ghost">
          ยังไม่ได้เชื่อม Supabase
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="มุมมองที่กำลังดู"
        className="mt-2 flex gap-1.5 rounded-[13px] bg-inset p-1"
      >
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={role === r.value}
            disabled={pending}
            onClick={() => startTransition(() => setPreviewRole(r.value))}
            className={`min-h-9 flex-1 rounded-[10px] text-xs font-semibold transition-colors ${
              role === r.value
                ? "bg-accent-fill text-on-accent"
                : "bg-transparent text-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-faint text-pretty">
        {HINTS[role]}
      </p>
    </div>
  );
}
