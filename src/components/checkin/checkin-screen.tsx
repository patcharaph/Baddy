"use client";

import { useState, useTransition } from "react";

import {
  Avatar,
  Notice,
  ProgressBar,
  ScreenTitle,
  SectionHeading,
} from "@/components/ui";
import { setCheckIn } from "@/lib/data/mutations";
import type { ParticipantStatus } from "@/lib/domain/types";

/** One roster row, already formatted — the screen never parses a timestamp. */
export interface RosterRow {
  id: string;
  name: string;
  skillLevel: string | null;
  status: ParticipantStatus;
  /** `20:04`, or null if they have not arrived. */
  checkInLabel: string | null;
  waitlistPosition: number | null;
}

interface Props {
  /** Null on sample data, where there is nothing to write to. */
  sessionId: string | null;
  roster: RosterRow[];
  capacity: number | null;
  /** Whether the organizer's roster is shown, or only the viewer's own row. */
  canEditOthers: boolean;
  meId: string | null;
  /** The viewer's place in the queue, 1-based. Null when they are not in it. */
  myQueuePosition: number | null;
}

const PRESENT: ParticipantStatus[] = ["checked_in"];

export function CheckinScreen(props: Props) {
  const { sessionId, roster, capacity, canEditOthers, meId, myQueuePosition } =
    props;

  // Optimistic state: the chip has to move under the thumb immediately, because
  // the organizer is tapping down a line of people at the door.
  const [present, setPresent] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      roster.map((r) => [r.id, PRESENT.includes(r.status)] as const),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const live = sessionId !== null;

  const toggle = (id: string) => {
    const next = !present[id];
    setPresent((current) => ({ ...current, [id]: next }));
    setError(null);
    if (!live) return;

    startTransition(async () => {
      try {
        await setCheckIn(sessionId, id, next);
      } catch (e) {
        // Put the chip back: a roster that silently disagrees with the database
        // is how someone ends up unbilled.
        setPresent((current) => ({ ...current, [id]: !next }));
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const inCount = roster.filter((r) => present[r.id]).length;
  const quotaText = capacity === null ? `${inCount} คน` : `${inCount}/${capacity}`;

  if (!canEditOthers) {
    return (
      <SelfCheckin
        {...props}
        present={present}
        onToggle={() => meId && toggle(meId)}
        quotaText={quotaText}
        myQueuePosition={myQueuePosition}
        error={error}
        inCount={inCount}
      />
    );
  }

  return (
    <main className="flex flex-col gap-3.5 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="เช็คอิน"
        subtitle={`โควตา ${quotaText} · เต็มแล้วเข้า waitlist และเลื่อนขึ้นอัตโนมัติ`}
      />

      {capacity !== null ? <ProgressBar ratio={inCount / capacity} /> : null}
      {error ? <Notice>{error}</Notice> : null}

      <ul className="flex flex-col gap-2">
        {roster.map((row) => {
          const isIn = present[row.id] ?? false;
          return (
            <li
              key={row.id}
              className="flex min-h-14 items-center gap-3 rounded-[16px] border border-line-soft bg-inset-soft px-3 py-2"
            >
              <Avatar name={row.name} active={isIn} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13.5px] font-medium">
                  {row.name}
                  {row.id === meId ? (
                    <span className="text-muted"> (คุณ)</span>
                  ) : null}
                </span>
                <span className="truncate font-mono text-[11px] text-faint">
                  {rowMeta(row, isIn)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggle(row.id)}
                aria-pressed={isIn}
                className={`min-h-10 min-w-[74px] shrink-0 rounded-xl px-3 text-xs font-semibold transition-[filter] hover:brightness-110 ${
                  isIn
                    ? "border-none bg-accent-fill text-on-accent"
                    : "border border-line-strong bg-transparent text-muted"
                }`}
              >
                {isIn ? "เช็คอินแล้ว" : "เช็คอิน"}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function rowMeta(row: RosterRow, isIn: boolean): string {
  const skill = row.skillLevel ? `มือ ${row.skillLevel}` : "ยังไม่ระบุมือ";

  if (isIn) {
    return row.checkInLabel ? `${skill} · เข้า ${row.checkInLabel}` : `${skill} · อยู่ในรอบ`;
  }
  if (row.status === "waitlist") {
    return `${skill} · waitlist ลำดับ ${row.waitlistPosition ?? "—"}`;
  }
  if (row.status === "checked_out") {
    return `${skill} · กลับแล้ว`;
  }
  return `${skill} · ยังไม่มา`;
}

/**
 * The player's half of the same screen.
 *
 * A player can only move their own check-in — the queue and the money are the
 * organizer's to run — so the screen is one big card about them, with everyone
 * else reduced to a list they can read but not touch.
 */
function SelfCheckin({
  roster,
  meId,
  present,
  onToggle,
  quotaText,
  myQueuePosition,
  error,
  inCount,
}: Props & {
  present: Record<string, boolean>;
  onToggle: () => void;
  quotaText: string;
  error: string | null;
  inCount: number;
}) {
  const me = roster.find((r) => r.id === meId);
  const meIsIn = meId ? (present[meId] ?? false) : false;
  const others = roster.filter((r) => present[r.id]);

  return (
    <main className="flex flex-col gap-4 px-4 pt-[18px] pb-2">
      <ScreenTitle
        title="เช็คอินของฉัน"
        subtitle="คุณเช็คอินของตัวเองได้เท่านั้น · การจัดคิวและยอดเงินหัวหน้าก๊วนเป็นคนคุม"
      />

      {error ? <Notice>{error}</Notice> : null}

      {me ? (
        <section
          className={`flex flex-col gap-3.5 rounded-[20px] border p-[18px] shadow-card ${
            meIsIn
              ? "border-accent-line bg-surface accent-glow"
              : "border-line bg-surface"
          }`}
        >
          <div className="flex items-center gap-3">
            <Avatar name={me.name} active={meIsIn} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{me.name}</span>
              <span className="truncate font-mono text-[11px] text-muted">
                {rowMeta(me, meIsIn)}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-[9px] px-2.5 py-[5px] text-[11px] font-semibold ${
                meIsIn ? "bg-accent-soft text-accent" : "bg-chip text-muted"
              }`}
            >
              {meIsIn ? "อยู่ในรอบ" : "ยังไม่เช็คอิน"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[13px] bg-inset p-[11px]">
              <div className="text-[10.5px] text-muted">คิวของคุณ</div>
              <div className="font-mono text-[17px] font-bold">
                {myQueuePosition === null ? "—" : `คิวที่ ${myQueuePosition}`}
              </div>
            </div>
            <div className="rounded-[13px] bg-inset p-[11px]">
              <div className="text-[10.5px] text-muted">โควตารอบนี้</div>
              <div className="font-mono text-[17px] font-bold">{quotaText}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            className={`min-h-[52px] rounded-[16px] text-[15px] font-bold transition-[filter] hover:brightness-110 ${
              meIsIn
                ? "border border-line-strong bg-transparent text-ink"
                : "border-none bg-accent-fill text-on-accent"
            }`}
          >
            {meIsIn ? "ยกเลิกเช็คอิน" : "เช็คอินเข้ารอบนี้"}
          </button>

          <p className="text-[11.5px] leading-relaxed text-faint text-pretty">
            {meIsIn
              ? "อยู่ในคิวหมุนเวียนแล้ว — ถ้ากลับก่อนกดยกเลิกเพื่อให้ยอดหารตรง"
              : "ถ้าโควตาเต็ม ระบบจะใส่คุณใน waitlist และเลื่อนขึ้นอัตโนมัติเมื่อมีที่ว่าง"}
          </p>
        </section>
      ) : (
        <p className="rounded-[16px] border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-muted">
          คุณยังไม่ได้อยู่ในรอบนี้ — ทักหัวหน้าก๊วนให้เพิ่มชื่อก่อนนะ
        </p>
      )}

      <section className="flex flex-col gap-2">
        <SectionHeading note={`${inCount} คน`}>คนที่มาแล้ว</SectionHeading>
        <ul className="flex flex-col gap-2">
          {others.map((row) => (
            <li
              key={row.id}
              className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-inset-soft px-3 py-2"
            >
              <Avatar name={row.name} active={row.id === meId} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {row.name}
                {row.id === meId ? <span className="text-muted"> (คุณ)</span> : null}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-faint">
                {row.checkInLabel ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
