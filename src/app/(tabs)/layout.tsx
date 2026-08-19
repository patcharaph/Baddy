import { AppHeader } from "@/components/app-header";
import { PreviewBar } from "@/components/preview-bar";
import { SideNav } from "@/components/side-nav";
import { SignInBar } from "@/components/sign-in-bar";
import { TabBar } from "@/components/tab-bar";
import { loadBoard } from "@/lib/data/source";
import { sessionSubtitle } from "@/lib/format/datetime";
import { LiffProvider } from "@/lib/liff/provider";

/**
 * The app shell, in its two shapes.
 *
 * On a phone — which is where this is opened from LINE — it is what it always
 * was: one column capped at phone width, header pinned above it, tabs pinned
 * below.
 *
 * From `md` up the navigation moves out of the bottom bar and into a rail beside
 * the column. That is the whole of the desktop layout, and it is deliberately
 * the *only* structural difference: every screen inside is a single stack of
 * cards, so widening the shell reaches all of them at once and none of them has
 * to know which shape it is in.
 *
 * The column keeps a cap on a desktop too, just a larger one. The screens are
 * built out of rows with a label at one edge and a number at the other, and
 * stretching those to a 27-inch window puts a metre of nothing between the two
 * halves of every line. What the extra width is actually good for is putting
 * cards side by side, which is a per-screen decision, taken per screen.
 *
 * The layout loads the board so the header can name the round and the navigation
 * can match the viewer's role. `loadBoard` is request-cached, so the page inside
 * reads the same data without a second round trip.
 */
export default async function TabsLayout({ children }: LayoutProps<"/">) {
  const { board, viewer, kind } = await loadBoard();

  return (
    <LiffProvider>
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col md:max-w-[880px] md:flex-row md:items-start">
        <SideNav role={viewer.role} />

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col bg-screen md:max-w-[652px] md:border-x md:border-line">
          <AppHeader
            guanName={board?.session.guanName ?? "Baddy"}
            subtitle={
              board
                ? sessionSubtitle(
                    board.session.startsAt,
                    board.session.courtCount,
                  )
                : "ยังไม่มีรอบที่เปิดอยู่"
            }
            isOrganizer={viewer.role === "organizer"}
          />

          {/* Renders itself away inside LINE and whenever a session exists — see
              SignInBar. It sits above the preview bar because "you are signed
              out" outranks "this is sample data". */}
          <SignInBar />

          {kind === "sample" && viewer.previewAs ? (
            <PreviewBar role={viewer.previewAs} />
          ) : null}

          {/* The bottom padding is room for the tab bar, which floats over the
              column. There is no tab bar from `md` up, so there is nothing to
              leave room for — only the ordinary space at the end of a page. */}
          <div className="flex-1 pb-24 md:pb-10">{children}</div>
        </div>
      </div>

      <TabBar role={viewer.role} />
    </LiffProvider>
  );
}
