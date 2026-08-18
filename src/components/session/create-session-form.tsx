"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import { controlClass, Field, selectInput } from "@/components/form";
import {
  SessionFields,
  type SessionFieldValues,
} from "@/components/session/session-fields";
import { Notice, primaryButton } from "@/components/ui";
import type { GuanMembershipView } from "@/lib/data/queries";
import { createSession, type FormState } from "@/lib/data/mutations";
import type { SplitMode } from "@/lib/supabase/database.types";

const EMPTY: FormState = { errors: {} };

/** The default hour a guan books. Nothing here depends on it being right. */
const DEFAULT_START_HOUR = 19;

/**
 * Open a round (US-2.1).
 *
 * Two things make this a Client Component rather than a plain `<form action>`:
 *
 *   1. The rate fields depend on the split mode. Rendering all three sets at once
 *      would ask the organizer for numbers their mode will never read, and the
 *      one it *does* need is the one that decides whether the money screen works
 *      at all tonight.
 *   2. `datetime-local` has no timezone. The offset has to be read in the browser
 *      — on the server "local" is the host's zone, which is how a 19:00 round
 *      becomes an 02:00 one. The submit button stays disabled until it is read,
 *      so the form cannot be sent without it.
 *
 * The fields themselves live in `SessionFields`, shared with the edit form.
 */
export function CreateSessionForm({ guans }: { guans: GuanMembershipView[] }) {
  const [state, action, pending] = useActionState(createSession, EMPTY);
  const [mode, setMode] = useState<SplitMode>("buffet");
  const [guanId, setGuanId] = useState(guans[0]?.guanId ?? "");

  // Both of these are the browser's answer and the server has no valid one, so
  // they are read through `useSyncExternalStore`: it renders the server snapshot
  // during hydration and swaps in the client's afterwards, which is the whole
  // job. Doing it in an effect would be a second render triggered by a setState
  // that React has no reason to expect.
  const tzOffset = useSyncExternalStore(neverChanges, readTzOffset, () => null);
  const defaultStart = useSyncExternalStore(neverChanges, readDefaultStart, () => "");

  const { errors } = state;
  const guan = guans.find((g) => g.guanId === guanId) ?? guans[0];
  const ready = tzOffset !== null;

  // A new round starts from the guan's defaults and blanks for everything the
  // organizer has to decide tonight.
  const values: SessionFieldValues = {
    venue: guan?.homeVenue ?? "",
    startsAtLocal: defaultStart,
    endsAtLocal: "",
    courtCount: "2",
    capacity: "",
    courtRate: guan ? String(guan.defaultCourtRate) : "0",
    buffetRate: "",
    womenRate: "",
    perGameRate: "",
    shuttlesIncludedPerMatch: "1",
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Read after mount; `ready` gates the submit so it is never absent. */}
      <input type="hidden" name="tzOffsetMinutes" value={tzOffset ?? ""} />

      <SessionFields
        values={values}
        errors={errors}
        mode={mode}
        onModeChange={setMode}
        identityKey={guan?.guanId ?? ""}
        leading={
          guans.length > 1 ? (
            <Field id="guanId" label="ก๊วน" error={errors.guanId}>
              <select
                id="guanId"
                name="guanId"
                value={guanId}
                onChange={(e) => setGuanId(e.target.value)}
                className={controlClass(selectInput, errors.guanId)}
              >
                {guans.map((g) => (
                  <option key={g.guanId} value={g.guanId}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="guanId" value={guanId} />
          )
        }
      />

      {errors.form ? <Notice>{errors.form}</Notice> : null}

      <button
        type="submit"
        disabled={pending || !ready}
        className={primaryButton}
      >
        {pending ? "กำลังเปิดรอบ…" : "เปิดรอบ"}
      </button>
    </form>
  );
}

/**
 * Neither of the two browser values below changes while the form is open, so
 * there is nothing to subscribe to — the store exists only for the
 * server/client snapshot split.
 */
function neverChanges(): () => void {
  return () => {};
}

/** Both return strings, so React's `Object.is` check settles after one render. */
function readTzOffset(): string {
  return String(new Date().getTimezoneOffset());
}

function readDefaultStart(): string {
  return todayAt(DEFAULT_START_HOUR);
}

/**
 * `datetime-local` wants the browser's wall clock, not an ISO instant.
 *
 * Built from the local components rather than `toISOString().slice(0, 16)`,
 * which would hand the input a UTC time and pre-fill the round with the wrong
 * hour in every zone but one.
 */
function todayAt(hour: number): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(hour)}:00`
  );
}
