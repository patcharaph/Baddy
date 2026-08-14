import { cookies } from "next/headers";

/**
 * Light, dark, or whatever the phone is set to.
 *
 * `system` is the default and is deliberately a real third state rather than a
 * resolved light/dark: someone whose phone flips to dark at sunset should have
 * Baddy flip with it, and collapsing that into a stored "dark" would freeze it.
 */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_COOKIE = "baddy_theme";

/**
 * Read the stored preference.
 *
 * Kept on a cookie rather than in localStorage so the server already knows the
 * answer when it renders `<html>`. The localStorage version of this needs a
 * blocking script in `<head>` to avoid a flash of the wrong theme, and inside
 * LINE's webview that flash lands right when the sheet animates open.
 */
export async function getThemePreference(): Promise<ThemePreference> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * What to put on `<html data-theme>`.
 *
 * `system` stamps nothing, which is what lets the `prefers-color-scheme` block
 * in globals.css decide. An explicit choice stamps the attribute and wins.
 */
export function themeAttribute(
  preference: ThemePreference,
): "light" | "dark" | undefined {
  return preference === "system" ? undefined : preference;
}
