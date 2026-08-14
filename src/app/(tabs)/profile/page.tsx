import { LiffStatusNote } from "@/components/profile/liff-status-note";
import { ThemeSwitch } from "@/components/theme-switch";
import { EmptyPanel, Pill, SectionHeading, StatTile } from "@/components/ui";
import { loadBoard, loadCostData, loadProfile } from "@/lib/data/source";
import { tryComputeCostShares } from "@/lib/domain/cost-engine";
import { baht } from "@/lib/domain/money";
import { getThemePreference } from "@/lib/theme";

export const metadata = { title: "โปรไฟล์ — Baddy" };

export const dynamic = "force-dynamic";

/**
 * Player profile (PRD FR-9, US-5.1/5.2) — the seed of the Phase 2+ player network.
 *
 * The profile belongs to the player, not to a guan, which is why the guan list
 * is the body of the screen rather than a footnote. The stats are scoped to
 * tonight and say so: lifetime numbers need an attendance history this scaffold
 * does not read yet, and a made-up "18 ครั้งที่มา" would be worse than none.
 */
export default async function ProfilePage() {
  const { viewer, guans } = await loadProfile();
  const { board } = await loadBoard();
  const cost = await loadCostData();
  const theme = await getThemePreference();

  const me =
    board?.roster.find((e) => e.player.id === viewer.playerId)?.player ?? null;
  const displayName = me?.displayName ?? "ยังไม่ได้เข้าสู่ระบบ";

  const gamesThisSession = (cost.data?.input.matches ?? []).filter((m) =>
    m.playerIds.includes(viewer.playerId ?? ""),
  ).length;

  const computed = cost.data ? tryComputeCostShares(cost.data.input) : null;
  const myShare = computed?.ok
    ? computed.result.shares.find((s) => s.playerId === viewer.playerId)
    : undefined;

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <section className="flex items-center gap-3.5 rounded-[20px] border border-line bg-gradient-to-b from-raised to-surface p-[18px] shadow-card">
        <span
          className="flex h-15 w-15 shrink-0 items-center justify-center rounded-[20px] bg-accent-fill text-2xl font-bold text-on-accent"
          aria-hidden
        >
          {displayName.charAt(0)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-lg font-bold">{displayName}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="accent">
              {me?.skillLevel ? `มือ ${me.skillLevel}` : "ยังไม่ระบุมือ"}
            </Pill>
            <span className="text-[11px] text-muted">โปรไฟล์ใช้ข้ามก๊วนได้</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeading note="รอบนี้">สถิติ</SectionHeading>
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="เกมที่ลง" value={gamesThisSession} />
          <StatTile
            label="ยอดรอบนี้"
            value={myShare ? baht(myShare.total) : "—"}
          />
          <StatTile label="ก๊วนที่อยู่" value={guans.length} accent />
        </div>
        <p className="text-[11px] leading-relaxed text-faint text-pretty">
          สถิติสะสมข้ามรอบ (ครั้งที่มา · เกมทั้งหมด) จะมาในเฟสถัดไป ตอนนี้แสดงเฉพาะรอบที่เปิดอยู่
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading note={`${guans.length} ก๊วน`}>ก๊วนของฉัน</SectionHeading>

        {guans.length === 0 ? (
          <EmptyPanel>ยังไม่ได้เข้าร่วมก๊วนไหน — ขอลิงก์เชิญจากหัวหน้าก๊วนได้เลย</EmptyPanel>
        ) : (
          <ul className="flex flex-col gap-2">
            {guans.map((guan) => (
              <li
                key={guan.guanId}
                className="flex min-h-14 items-center gap-3 rounded-[16px] border border-line-soft bg-inset-soft px-3.5 py-2.5"
              >
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-chip text-[13px] font-semibold"
                  aria-hidden
                >
                  {guan.name.charAt(0)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium">
                    {guan.name}
                  </span>
                  <span className="truncate text-[11px] text-faint">
                    {guan.homeVenue ?? "ยังไม่ได้ตั้งสนามประจำ"}
                  </span>
                </span>
                <Pill tone={guan.role === "organizer" ? "accent" : "quiet"}>
                  {guan.role === "organizer" ? "หัวหน้า" : "สมาชิก"}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading note="ทั้งแอป">ธีม</SectionHeading>
        <ThemeSwitch preference={theme} />
      </section>

      <LiffStatusNote />
    </main>
  );
}
