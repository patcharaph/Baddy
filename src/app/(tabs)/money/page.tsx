import { MoneyScreen } from "@/components/money/money-screen";
import { EmptyState } from "@/components/source-note";
import { loadCostData } from "@/lib/data/source";

export const metadata = { title: "หารเงิน — Baddy" };

// Totals move as shuttles are logged and matches finish, so never cache.
export const dynamic = "force-dynamic";

/** Cost split (PRD FR-7). Settle-up lives on /settle. */
export default async function MoneyPage() {
  const { kind, data, sessionId, viewer } = await loadCostData();

  if (!data) {
    return (
      <EmptyState
        title="ยังไม่มีรอบเล่นที่เปิดอยู่"
        detail="เปิดรอบแล้วยอดจะคำนวณให้อัตโนมัติ"
      />
    );
  }

  return (
    <MoneyScreen
      sessionId={kind === "live" ? sessionId : null}
      input={data.input}
      players={data.players}
      paidPlayerIds={data.paidPlayerIds}
      canEdit={viewer.role === "organizer"}
      meId={viewer.playerId}
    />
  );
}
