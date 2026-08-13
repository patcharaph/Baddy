import { MoneyScreen } from "@/components/money/money-screen";
import { EmptyState } from "@/components/source-note";
import { TopBar } from "@/components/top-bar";
import { loadCostData } from "@/lib/data/source";

export const metadata = { title: "หารเงิน — Baddy" };

// Totals move as shuttles are logged and matches finish, so never cache.
export const dynamic = "force-dynamic";

/** Cost split + settle-up (PRD FR-7, FR-8). */
export default async function MoneyPage() {
  const { kind, data, sessionId } = await loadCostData();

  if (!data) {
    return (
      <>
        <TopBar left="💰 สรุปเงิน" />
        <EmptyState
          title="ยังไม่มีรอบเล่นที่เปิดอยู่"
          detail="เปิดรอบแล้วยอดจะคำนวณให้อัตโนมัติ"
        />
      </>
    );
  }

  return (
    <MoneyScreen
      kind={kind}
      sessionId={sessionId}
      input={data.input}
      players={data.players}
      paidPlayerIds={data.paidPlayerIds}
    />
  );
}
