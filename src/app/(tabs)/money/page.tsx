import { MoneyScreen } from "@/components/money/money-screen";

export const metadata = { title: "หารเงิน — Baddy" };

/**
 * Cost split + settle-up (PRD FR-7, FR-8).
 *
 * The whole screen is client-side because switching split mode has to recompute
 * instantly while the organizer is standing at the net deciding which one to use.
 */
export default function MoneyPage() {
  return <MoneyScreen />;
}
