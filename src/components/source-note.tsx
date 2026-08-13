import type { SourceKind } from "@/lib/data/source";

/**
 * Says out loud when the screen is not showing real data.
 *
 * Sample numbers that look real are how a demo turns into a bug report, so the
 * banner is deliberately hard to miss and disappears entirely once a live
 * session is connected.
 */
export function SourceNote({ kind }: { kind: SourceKind }) {
  if (kind !== "sample") return null;

  return (
    <p className="mb-3 rounded-xl bg-pending-bg px-3 py-2 text-[11px] leading-relaxed text-pending">
      ข้อมูลตัวอย่าง — ยังไม่ได้เชื่อม Supabase (ตั้งค่าใน <code>.env.local</code>)
    </p>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="px-4 pt-10">
      <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center">
        <div className="font-display text-[15px] font-semibold">{title}</div>
        <p className="mt-1.5 text-[12.5px] text-muted">{detail}</p>
      </div>
    </main>
  );
}
