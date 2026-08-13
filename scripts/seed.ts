/**
 * Seeds the sample session into a real Supabase project.
 *
 *   npx tsx scripts/seed.ts
 *
 * Uses the service role key, so it bypasses RLS — this is a development tool for
 * getting something on the screen before auth exists, not part of the app.
 *
 * Idempotent: it deletes and recreates the guan named below, so running it twice
 * does not leave two copies of the same evening.
 */

import { createClient } from "@supabase/supabase-js";

import {
  SAMPLE_COURTS,
  SAMPLE_FINISHED_MATCHES,
  SAMPLE_NOW,
  SAMPLE_PAID_PLAYER_IDS,
  SAMPLE_PLAYERS,
  SAMPLE_SESSION,
  SAMPLE_SHUTTLE_LOGS,
} from "../src/lib/sample/session";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อน (ดู .env.local)",
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey);

const GUAN_NAME = "ก๊วน Baddy (ตัวอย่าง)";
const iso = (epochMs: number) => new Date(epochMs).toISOString();

function check(error: { message: string } | null, what: string): void {
  if (error) {
    console.error(`${what}ล้มเหลว: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  console.log("กำลัง seed ข้อมูลตัวอย่าง…");

  // Start clean. Cascades take the sessions, matches and logs with it.
  const { error: wipeError } = await supabase
    .from("guans")
    .delete()
    .eq("name", GUAN_NAME);
  check(wipeError, "ลบข้อมูลเดิม");

  // --- players ------------------------------------------------------------
  // Upserted on line_user_id: a player is a person, not a row inside a guan, so
  // re-seeding must reuse the same profile (ADR-2).
  const { data: players, error: playersError } = await supabase
    .from("players")
    .upsert(
      SAMPLE_PLAYERS.map((p) => ({
        line_user_id: `sample-${p.id}`,
        display_name: p.name,
        skill_level: p.skill,
        is_woman: p.isWoman ?? false,
      })),
      { onConflict: "line_user_id" },
    )
    .select("id, line_user_id");
  check(playersError, "สร้างผู้เล่น");

  const idOf = new Map(
    (players ?? []).map((p) => [p.line_user_id.replace("sample-", ""), p.id]),
  );
  const playerId = (sampleId: string): string => {
    const id = idOf.get(sampleId);
    if (!id) throw new Error(`ไม่พบผู้เล่น ${sampleId} หลัง upsert`);
    return id;
  };

  // --- guan + membership --------------------------------------------------
  const ownerId = playerId("champ");
  const { data: guan, error: guanError } = await supabase
    .from("guans")
    .insert({
      name: GUAN_NAME,
      home_venue: SAMPLE_SESSION.venue,
      default_court_rate: SAMPLE_SESSION.courtTotal,
      promptpay_target: "0812345678",
      owner_player_id: ownerId,
    })
    .select("id")
    .single();
  check(guanError, "สร้างก๊วน");

  const guanId = guan!.id;

  const { error: membershipError } = await supabase.from("memberships").insert(
    SAMPLE_PLAYERS.map((p) => ({
      guan_id: guanId,
      player_id: playerId(p.id),
      role: p.id === "champ" ? ("organizer" as const) : ("player" as const),
    })),
  );
  check(membershipError, "เพิ่มสมาชิกก๊วน");

  // --- session ------------------------------------------------------------
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      guan_id: guanId,
      venue: SAMPLE_SESSION.venue,
      starts_at: iso(SAMPLE_NOW - 90 * 60_000),
      court_count: SAMPLE_SESSION.courtCount,
      court_rate: SAMPLE_SESSION.courtTotal,
      capacity: 20,
      split_mode: SAMPLE_SESSION.splitMode,
      buffet_rate: SAMPLE_SESSION.buffetRate,
      women_rate: SAMPLE_SESSION.womenRate,
      per_game_rate: SAMPLE_SESSION.perGameRate,
    })
    .select("id")
    .single();
  check(sessionError, "สร้างรอบเล่น");

  const sessionId = session!.id;

  // --- participants -------------------------------------------------------
  const { error: participantsError } = await supabase
    .from("session_participants")
    .insert(
      SAMPLE_PLAYERS.map((p) => ({
        session_id: sessionId,
        player_id: playerId(p.id),
        status: "checked_in" as const,
        check_in_at: iso(SAMPLE_NOW - 90 * 60_000),
      })),
    );
  check(participantsError, "เช็คอินผู้เล่น");

  // --- matches ------------------------------------------------------------
  // Finished matches first: they are what the wait clock and the per-game
  // charge are computed from.
  const finishedIds = new Map<string, string>();
  for (const [index, match] of SAMPLE_FINISHED_MATCHES.entries()) {
    const endedAt = SAMPLE_NOW - (SAMPLE_FINISHED_MATCHES.length - index) * 8 * 60_000;

    const { data: row, error } = await supabase
      .from("matches")
      .insert({
        session_id: sessionId,
        court_no: (index % SAMPLE_SESSION.courtCount) + 1,
        status: "done" as const,
        started_at: iso(endedAt - 12 * 60_000),
        ended_at: iso(endedAt),
      })
      .select("id")
      .single();
    check(error, `สร้างแมตช์ ${match.matchId}`);

    finishedIds.set(match.matchId, row!.id);

    const { error: mpError } = await supabase.from("match_players").insert(
      match.playerIds.map((id) => ({
        match_id: row!.id,
        player_id: playerId(id),
      })),
    );
    check(mpError, `เพิ่มผู้เล่นในแมตช์ ${match.matchId}`);
  }

  for (const court of SAMPLE_COURTS) {
    const { data: row, error } = await supabase
      .from("matches")
      .insert({
        session_id: sessionId,
        court_no: court.courtNo,
        status: "playing" as const,
        started_at: iso(court.startedAt),
      })
      .select("id")
      .single();
    check(error, `เริ่มแมตช์คอร์ท ${court.courtNo}`);

    const { error: mpError } = await supabase.from("match_players").insert(
      [...court.sideA, ...court.sideB].map((id) => ({
        match_id: row!.id,
        player_id: playerId(id),
      })),
    );
    check(mpError, `เพิ่มผู้เล่นคอร์ท ${court.courtNo}`);
  }

  // --- shuttle logs -------------------------------------------------------
  const { error: logsError } = await supabase.from("shuttle_logs").insert(
    SAMPLE_SHUTTLE_LOGS.map((log) => ({
      session_id: sessionId,
      match_id: log.matchId ? (finishedIds.get(log.matchId) ?? null) : null,
      count: log.count,
      unit_price: log.unitPrice,
    })),
  );
  check(logsError, "บันทึกลูกแบด");

  // --- cost shares --------------------------------------------------------
  // Only the paid flags matter here; the amounts are recomputed on every render
  // from the source data above (ADR-3).
  const { error: sharesError } = await supabase.from("cost_shares").insert(
    SAMPLE_PLAYERS.map((p) => ({
      session_id: sessionId,
      player_id: playerId(p.id),
      paid: SAMPLE_PAID_PLAYER_IDS.includes(p.id),
    })),
  );
  check(sharesError, "สร้างสถานะการจ่ายเงิน");

  console.log(`เสร็จแล้ว — session ${sessionId}`);
  console.log(
    `ผู้เล่น ${SAMPLE_PLAYERS.length} คน · แมตช์จบ ${SAMPLE_FINISHED_MATCHES.length} · กำลังเล่น ${SAMPLE_COURTS.length} คอร์ท`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
