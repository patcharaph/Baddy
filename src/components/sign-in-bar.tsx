"use client";

import { useLiff } from "@/lib/liff/provider";

/**
 * The way in, for anyone who did not arrive through LINE.
 *
 * Inside LINE this never renders: the webview is already signed in and the LIFF
 * bootstrap exchanges its token before the first paint. It exists for the case
 * the app was originally built without — an organizer running the door from a
 * laptop, where LINE Login is a redirect rather than an ambient fact.
 *
 * Without this, `logged-out` was a dead end. The provider has always had a
 * `login()`; nothing called it, so an unauthenticated visitor saw a working app
 * with every query returning nothing — RLS is doing its job, and the screen
 * looked like an empty guan rather than a locked one. Saying "you are not signed
 * in" is the difference between those two.
 */
export function SignInBar() {
  const { status, login, error } = useLiff();

  if (status !== "logged-out" && status !== "error") return null;

  const failed = status === "error";

  return (
    <div
      className={`border-b px-4 py-3 ${
        failed ? "border-warn-line bg-warn-bg" : "border-line bg-inset"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={`text-[12.5px] font-semibold ${failed ? "text-warn" : ""}`}
          >
            {failed ? "เชื่อมต่อ LINE ไม่สำเร็จ" : "ยังไม่ได้เข้าสู่ระบบ"}
          </span>
          <span
            className={`text-[11px] leading-snug text-pretty ${
              failed ? "text-warn" : "text-muted"
            }`}
          >
            {failed
              ? (error ?? "ไม่ทราบสาเหตุ")
              : "เข้าสู่ระบบด้วย LINE เพื่อดูรอบของก๊วนคุณ — ใช้บนคอมได้ ไม่ต้องเปิดในแอป LINE"}
          </span>
        </div>

        <button
          type="button"
          onClick={login}
          className="min-h-10 shrink-0 rounded-xl border-none bg-accent-fill px-4 text-xs font-bold text-on-accent transition-[filter] hover:brightness-110"
        >
          {failed ? "ลองใหม่" : "เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}
