import type { ReactNode } from "react";

/**
 * What a screen shows when there is nothing to show.
 *
 * Every screen hangs off "the round that is open right now", so all of them need
 * the same answer when no round is open — and it has to say what to do next, not
 * just that the list is empty.
 */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <main className="px-4 pt-10">
      <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-line px-5 py-12 text-center">
        <div className="text-[15px] font-semibold">{title}</div>
        <p className="text-[12.5px] leading-relaxed text-muted text-pretty">
          {detail}
        </p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </main>
  );
}
