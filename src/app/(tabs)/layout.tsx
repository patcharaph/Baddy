import { AppHeader } from "@/components/app-header";
import { PreviewBar } from "@/components/preview-bar";
import { TabBar } from "@/components/tab-bar";
import { loadBoard } from "@/lib/data/source";
import { sessionSubtitle } from "@/lib/format/datetime";
import { LiffProvider } from "@/lib/liff/provider";

/**
 * The LIFF shell: one column capped at phone width, header pinned above it and
 * tabs pinned below. Capping the width keeps the layout honest when it is opened
 * in a desktop browser during development.
 *
 * The layout loads the board so the header can name the round and the tabs can
 * match the viewer's role. `loadBoard` is request-cached, so the page inside
 * reads the same data without a second round trip.
 */
export default async function TabsLayout({ children }: LayoutProps<"/">) {
  const { board, viewer, kind } = await loadBoard();

  return (
    <LiffProvider>
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-screen">
        <AppHeader
          guanName={board?.session.guanName ?? "Baddy"}
          subtitle={
            board
              ? sessionSubtitle(board.session.startsAt, board.session.courtCount)
              : "ยังไม่มีรอบที่เปิดอยู่"
          }
          isOrganizer={viewer.role === "organizer"}
        />

        {kind === "sample" && viewer.previewAs ? (
          <PreviewBar role={viewer.previewAs} />
        ) : null}

        <div className="flex-1 pb-24">{children}</div>

        <TabBar role={viewer.role} />
      </div>
    </LiffProvider>
  );
}
