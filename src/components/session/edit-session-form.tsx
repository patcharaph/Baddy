"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import {
  SessionFields,
  type SessionFieldValues,
} from "@/components/session/session-fields";
import { Notice, primaryButton } from "@/components/ui";
import { updateSession, type FormState } from "@/lib/data/mutations";
import type { SessionView } from "@/lib/data/types";
import { isoToLocalDateTime } from "@/lib/domain/drafts";
import type { SplitMode } from "@/lib/supabase/database.types";

const EMPTY: FormState = { errors: {} };

/**
 * Change a round that already exists (FR-2).
 *
 * The same fields as opening one, filled in with what the round currently says.
 * The times are the reason this is a Client Component and not a server-rendered
 * form: `datetime-local` has no zone, so the value shown has to be resolved
 * against the same zone the submit will be read against — the browser's. Filling
 * them in on the server would render the host's wall clock, and then saving a
 * round nobody meant to move would move it.
 *
 * Until the offset is read the two time fields are empty and the submit is
 * disabled, so there is no window in which this form can save a round against a
 * zone it guessed.
 */
export function EditSessionForm({ session }: { session: SessionView }) {
  const [state, action, pending] = useActionState(updateSession, EMPTY);
  const [mode, setMode] = useState<SplitMode>(session.splitMode);

  const tzOffset = useSyncExternalStore(neverChanges, readTzOffset, () => null);
  const ready = tzOffset !== null;

  const { errors } = state;

  const values: SessionFieldValues = {
    venue: session.venue ?? "",
    startsAtLocal: localTime(session.startsAt, tzOffset),
    endsAtLocal: localTime(session.endsAt, tzOffset),
    courtCount: String(session.courtCount),
    capacity: session.capacity === null ? "" : String(session.capacity),
    courtRate: String(session.courtTotal),
    buffetRate: session.buffetRate === null ? "" : String(session.buffetRate),
    womenRate: session.womenRate === null ? "" : String(session.womenRate),
    perGameRate:
      session.perGameRate === null ? "" : String(session.perGameRate),
    shuttlesIncludedPerMatch: String(session.shuttlesIncludedPerMatch),
  };

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sessionId" value={session.id} />
      <input type="hidden" name="tzOffsetMinutes" value={tzOffset ?? ""} />

      <SessionFields
        values={values}
        errors={errors}
        mode={mode}
        onModeChange={setMode}
        identityKey={session.id}
      />

      {errors.form ? <Notice>{errors.form}</Notice> : null}

      <button
        type="submit"
        disabled={pending || !ready}
        className={primaryButton}
      >
        {pending ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
      </button>
    </form>
  );
}

/** Empty until the browser's offset is known — see the note on the component. */
function localTime(iso: string | null, tzOffset: string | null): string {
  if (iso === null || tzOffset === null) return "";
  return isoToLocalDateTime(iso, Number(tzOffset)) ?? "";
}

function neverChanges(): () => void {
  return () => {};
}

function readTzOffset(): string {
  return String(new Date().getTimezoneOffset());
}
