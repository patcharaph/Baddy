import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";

import { getThemePreference, themeAttribute } from "@/lib/theme";

import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Every number the app shows — money, queue positions, court timers, shuttle
 * counts — is set in mono so a column of them lines up and can be scanned.
 */
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Baddy — จัดก๊วนแบดใน LINE",
  description:
    "เปิดรอบ จัดคิว และหารเงินก๊วนแบดให้จบใน LINE ไม่ต้องโหลดแอป ไม่ต้องสมัครเว็บ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Matches `--app` in each theme, so the browser chrome does not sit on a
  // different ground than the page. Follows the OS rather than the in-app
  // toggle: an override here would need the value at header time, and getting
  // the status bar slightly wrong costs less than making every route dynamic.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7eae0" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getThemePreference();

  return (
    <html
      lang="th"
      // Absent unless the reader has chosen — see `themeAttribute`.
      data-theme={themeAttribute(theme)}
      className={`${plexThai.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
