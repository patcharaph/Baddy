"use client";

import { useState } from "react";

import { Avatar, SkillChip } from "@/components/ui";
import { buildNextMatches, type ProposedMatch } from "@/lib/domain/queue-engine";
import {
  SAMPLE_NOW,
  SAMPLE_QUEUE_CANDIDATES,
  samplePlayer,
} from "@/lib/sample/session";

/**
 * Proposes the next match for whichever court frees up first (PRD FR-4).
 *
 * The proposal is shown before it is committed so the organizer can still
 * rearrange it — auto-fair by default, manual when they disagree (US-3.2).
 */
export function NextMatchButton() {
  const [proposal, setProposal] = useState<ProposedMatch | null>(null);

  const propose = () => {
    const { matches } = buildNextMatches({
      candidates: SAMPLE_QUEUE_CANDIDATES,
      // In the sample session all three courts are busy; this previews the match
      // for the one that finishes next.
      freeCourts: [1],
      now: SAMPLE_NOW,
    });
    setProposal(matches[0] ?? null);
  };

  return (
    <div className="mt-4">
      {proposal ? (
        <div className="mb-3 rounded-2xl border border-primary bg-me-bg px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              แมตช์ถัดไป · คอร์ท {proposal.courtNo}
            </h3>
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="text-[11px] font-semibold text-primary-ink"
            >
              ยกเลิก
            </button>
          </div>

          <ul className="grid grid-cols-2 gap-2">
            {proposal.playerIds.map((id) => {
              const player = samplePlayer(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-[7px] rounded-xl bg-surface px-2 py-1.5 text-[13px]"
                >
                  <Avatar name={player.name} color={player.color} size={22} />
                  <span className="truncate">{player.name}</span>
                  <span className="ml-auto">
                    <SkillChip level={player.skill} />
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-[11px] text-muted">
            จัดตามคิวยุติธรรม — คนพักนาน/เล่นน้อยได้ลงก่อน สลับตัวเองได้ก่อนเริ่ม
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={propose}
        className="w-full rounded-2xl bg-primary p-3.5 font-display text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(255,106,69,.35)] active:translate-y-px"
      >
        สุ่มแมตช์ถัดไป → คอร์ทที่ว่าง
      </button>
    </div>
  );
}
