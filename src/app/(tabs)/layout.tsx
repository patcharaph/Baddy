import type { ReactNode } from "react";

import { TabBar } from "@/components/tab-bar";
import { LiffProvider } from "@/lib/liff/provider";

/**
 * The LIFF shell: one column capped at phone width, with room at the bottom for
 * the tab bar. Capping the width keeps the layout honest when it is opened in a
 * desktop browser during development.
 */
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <LiffProvider>
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-screen">
        <div className="flex-1 pb-20">{children}</div>
        <TabBar />
      </div>
    </LiffProvider>
  );
}
