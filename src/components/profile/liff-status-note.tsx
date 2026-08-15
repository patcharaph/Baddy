"use client";

import { useLiff } from "@/lib/liff/provider";

/**
 * Shows how the app is currently authenticated, and lets you change it.
 *
 * Useful during development — "why am I not seeing my own name" is otherwise a
 * silent failure — and it is the one place a LIFF init error becomes visible.
 *
 * The sign-out button only appears outside LINE. Inside the client there is one
 * account per phone and signing out would strand the user in a webview with no
 * way back in; on a laptop the guan is passed around and leaving your session
 * behind is a real way to hand someone else the organizer's buttons.
 */
export function LiffStatusNote() {
  const { status, profile, error, login, logout, isInClient } = useLiff();

  const body = {
    loading: "กำลังเชื่อมต่อ LINE…",
    "signing-in": "กำลังเข้าสู่ระบบ…",
    ready: profile ? `เข้าสู่ระบบด้วย LINE: ${profile.displayName}` : "",
    "logged-out": "ยังไม่ได้เข้าสู่ระบบ LINE",
    browser:
      "โหมดเบราว์เซอร์ (ยังไม่ได้ตั้ง NEXT_PUBLIC_LIFF_ID) — กำลังใช้ข้อมูลตัวอย่าง",
    error: `เชื่อมต่อ LIFF ไม่สำเร็จ: ${error ?? "ไม่ทราบสาเหตุ"}`,
  }[status];

  const action =
    status === "logged-out" || status === "error"
      ? { label: "เข้าสู่ระบบด้วย LINE", run: login }
      : status === "ready" && !isInClient
        ? { label: "ออกจากระบบ", run: logout }
        : null;

  return (
    <div className="flex flex-col gap-2">
      <p
        className={`rounded-[14px] px-3 py-2.5 text-[11px] leading-relaxed ${
          status === "error"
            ? "border border-warn-line bg-warn-bg text-warn"
            : "bg-inset text-muted"
        }`}
      >
        {body}
      </p>

      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="min-h-11 rounded-[14px] border border-line-strong bg-transparent text-[13px] font-semibold text-ink transition-colors hover:bg-inset"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
