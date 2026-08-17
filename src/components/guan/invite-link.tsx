"use client";

import { useState, useTransition } from "react";

import { rotateInviteCode } from "@/lib/data/mutations";

/**
 * The link an organizer shares to fill their guan (US-1.1).
 *
 * Shows the URL as selectable text rather than hiding it behind a copy button
 * alone: `navigator.clipboard` needs a secure context and is not reliable inside
 * LINE's webview, and a copy button that silently does nothing is worse than a
 * link someone can long-press.
 *
 * The LINE share link is a plain `line.me/R/msg/text/` URL, not
 * `liff.shareTargetPicker`. The picker needs the LIFF SDK, an extra permission on
 * the channel, and only works inside LINE — this works everywhere the organizer
 * might be standing, including the laptop at the door.
 */
export function InviteLink({
  guanId,
  guanName,
  url,
  canRotate,
}: {
  guanId: string;
  guanName: string;
  url: string;
  canRotate: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [rotating, startRotate] = useTransition();

  const shareText = `ชวนเข้าก๊วน "${guanName}" ใน Baddy — กดลิงก์นี้เข้าร่วมได้เลย\n${url}`;
  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;

  async function copy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission in this webview. The URL is on screen anyway,
      // so say that rather than pretending it worked.
      setCopyFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-inset p-3">
      <p className="text-[11px] font-semibold text-muted">ลิงก์เชิญ</p>

      <p className="font-mono text-[11px] leading-relaxed break-all text-faint select-all">
        {url}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="min-h-9 flex-1 rounded-[11px] border border-line-strong bg-transparent px-3 text-[12px] font-semibold transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
        <a
          href={lineShareUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 flex-1 items-center justify-center rounded-[11px] border-none bg-accent-fill px-3 text-[12px] font-bold text-on-accent"
        >
          แชร์เข้า LINE
        </a>
      </div>

      {copyFailed ? (
        <p className="text-[11px] leading-snug text-warn">
          เบราว์เซอร์นี้ไม่ให้คัดลอกอัตโนมัติ — กดค้างที่ลิงก์ด้านบนเพื่อคัดลอกเองได้
        </p>
      ) : null}

      {canRotate ? (
        confirmingRotate ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] leading-snug text-warn text-pretty">
              ลิงก์เดิมจะใช้ไม่ได้ทันที ใครที่ยังไม่ได้กดเข้าร่วมจะต้องได้ลิงก์ใหม่
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={rotating}
                onClick={() =>
                  startRotate(async () => {
                    await rotateInviteCode(guanId);
                    setConfirmingRotate(false);
                  })
                }
                className="min-h-9 flex-1 rounded-[11px] border border-warn-line bg-warn-bg px-3 text-[12px] font-semibold text-warn disabled:opacity-40"
              >
                {rotating ? "กำลังเปลี่ยน…" : "ยืนยันเปลี่ยนลิงก์"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRotate(false)}
                className="min-h-9 rounded-[11px] border border-line-strong bg-transparent px-3 text-[12px] font-semibold"
              >
                ไม่เปลี่ยน
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRotate(true)}
            className="self-start text-[11px] font-medium text-faint underline decoration-dotted underline-offset-2"
          >
            ลิงก์หลุดไปที่อื่น? เปลี่ยนลิงก์ใหม่
          </button>
        )
      ) : null}
    </div>
  );
}
