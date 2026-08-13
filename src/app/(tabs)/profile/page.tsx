import { LiffStatusNote } from "@/components/profile/liff-status-note";
import { TopBar } from "@/components/top-bar";
import { Avatar, Card, SectionTitle, SkillChip } from "@/components/ui";
import { SKILL_LEVELS } from "@/lib/domain/types";
import {
  SAMPLE_FINISHED_MATCHES,
  SAMPLE_SESSION,
  samplePlayer,
} from "@/lib/sample/session";

export const metadata = { title: "โปรไฟล์ — Baddy" };

/**
 * Player profile (PRD FR-9, US-5.1/5.2) — the seed of the Phase 2+ player network.
 *
 * The profile belongs to the player, not to a guan, which is why the stats below
 * are framed as "across your guans" rather than per-club numbers.
 */
export default function ProfilePage() {
  const me = samplePlayer("champ");
  const gamesThisSession = SAMPLE_FINISHED_MATCHES.filter((m) =>
    m.playerIds.includes(me.id),
  ).length;

  return (
    <>
      <TopBar left="👤 โปรไฟล์ผู้เล่น" right="ใช้ได้ทุกก๊วน" />

      <main className="px-4 pt-4">
        <Card className="mb-3 flex items-center gap-3 !p-4">
          <Avatar name={me.name} color={me.color} size={52} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              {me.name}
              <SkillChip level={me.skill} />
            </div>
            <div className="text-[11.5px] text-muted">
              โปรไฟล์ผูกกับบัญชี LINE ของคุณ — เปลี่ยนก๊วนแล้วประวัติไม่หาย
            </div>
          </div>
        </Card>

        <SectionTitle note="รอบนี้">สถิติ</SectionTitle>
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="เกมที่ลง" value={gamesThisSession} />
          <Stat label="ก๊วนที่อยู่" value={1} />
          <Stat label="ครั้งที่มา" value={7} />
        </div>

        <SectionTitle note="มือ">ระดับฝีมือ</SectionTitle>
        <Card className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {SKILL_LEVELS.map((level) => (
              <span
                key={level}
                className={`rounded-lg px-2 py-1 text-[11.5px] ${
                  level === me.skill
                    ? "bg-primary font-semibold text-white"
                    : "bg-chip text-muted"
                }`}
              >
                {level}
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
            ⚠️ สเกลระดับฝีมือยังไม่ยืนยัน (PRD §11) — ชุดนี้อ้างอิงจาก mockup
            รอสรุปก่อนเปิดใช้กับผู้เล่นจริง
          </p>
        </Card>

        <SectionTitle>ก๊วนของฉัน</SectionTitle>
        <Card className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[13.5px] font-medium">
              ก๊วน {SAMPLE_SESSION.guanName}
            </div>
            <div className="text-[11.5px] text-muted">
              {SAMPLE_SESSION.venue} · หัวหน้าก๊วน
            </div>
          </div>
          <span className="rounded-lg bg-court-bg px-2 py-1 text-[11px] font-semibold text-court">
            organizer
          </span>
        </Card>

        <LiffStatusNote />
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 text-center">
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
