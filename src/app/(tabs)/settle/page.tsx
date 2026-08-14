import { SettleScreen } from "@/components/money/settle-screen";
import { EmptyState } from "@/components/source-note";
import { Notice } from "@/components/ui";
import { loadCostData } from "@/lib/data/source";
import { tryComputeCostShares } from "@/lib/domain/cost-engine";

export const metadata = { title: "เคลียร์เงิน — Baddy" };

export const dynamic = "force-dynamic";

/** Settle-up: the QR to pay against, and who has paid (PRD FR-8). */
export default async function SettlePage() {
  const { kind, data, sessionId, viewer, promptpayTarget, guanName } =
    await loadCostData();

  if (!data) {
    return (
      <EmptyState
        title="ยังไม่มีรอบเล่นที่เปิดอยู่"
        detail="ปิดรอบเมื่อไหร่ ยอดกับ QR จะมาอยู่ที่นี่"
      />
    );
  }

  const computed = tryComputeCostShares(data.input);
  if (!computed.ok) {
    return (
      <main className="px-4 pt-6">
        <Notice>{computed.error}</Notice>
      </main>
    );
  }

  return (
    <SettleScreen
      sessionId={kind === "live" ? sessionId : null}
      rows={computed.result.shares.map((s) => ({
        playerId: s.playerId,
        displayName: s.displayName,
        total: s.total,
        breakdown: s.breakdown,
      }))}
      paidPlayerIds={data.paidPlayerIds}
      canEdit={viewer.role === "organizer"}
      meId={viewer.playerId}
      promptpayTarget={promptpayTarget}
      guanName={guanName}
    />
  );
}
