"use client";

import { useLiff } from "@/lib/liff/provider";

/**
 * Shows how the app is currently authenticated.
 *
 * Useful during development — "why am I not seeing my own name" is otherwise a
 * silent failure — and it is the one place a LIFF init error becomes visible.
 */
export function LiffStatusNote() {
  const { status, profile, error } = useLiff();

  const body = {
    loading: "กำลังเชื่อมต่อ LINE…",
    ready: profile ? `เข้าสู่ระบบด้วย LINE: ${profile.displayName}` : "",
    "logged-out": "ยังไม่ได้เข้าสู่ระบบ LINE",
    browser:
      "โหมดเบราว์เซอร์ (ยังไม่ได้ตั้ง NEXT_PUBLIC_LIFF_ID) — กำลังใช้ข้อมูลตัวอย่าง",
    error: `เชื่อมต่อ LIFF ไม่สำเร็จ: ${error ?? "ไม่ทราบสาเหตุ"}`,
  }[status];

  return (
    <p
      className={`mb-2 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed ${
        status === "error"
          ? "bg-pending-bg text-pending"
          : "bg-chip text-muted"
      }`}
    >
      {body}
    </p>
  );
}
