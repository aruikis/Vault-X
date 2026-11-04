// App themes (Anthony's request, Nov 2, 2026): a Theme picker in
// Settings. Each theme is just a set of values for the CSS variables
// in theme.css (background, surfaces, text, accent) — the rules live
// under :root[data-theme="..."] there. Picking a theme applies it
// app-wide immediately (the data-theme attribute on <html>), mirrors
// it to localStorage so the next open paints in the picked theme
// with no flash, and saves it to the collector profile on the
// server so the choice persists for the user across devices.
// Presentation only: no collection data is involved.

export type ThemeId =
  | "vault"
  | "light"
  | "midnight"
  | "crimson"
  | "contrast"
  | "rainbow";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Preview swatches for the picker row: page background, card
      surface, and accent, in the theme's own colors. */
  swatches: { bg: string; surface: string; accent: string };
}

export const THEMES: ThemeMeta[] = [
  {
    id: "vault",
    name: "Vault Dark",
    blurb: "The classic look — dark blue with the blue-purple glow.",
    swatches: { bg: "#060913", surface: "#0e1526", accent: "#6C7CFF" },
  },
  {
    id: "light",
    name: "Light",
    blurb: "Clean light background, dark text, same blue-purple accent.",
    swatches: { bg: "#edf0f8", surface: "#ffffff", accent: "#6C7CFF" },
  },
  {
    id: "midnight",
    name: "Midnight Purple",
    blurb: "Deep purple dark with a violet glow.",
    swatches: { bg: "#0b0516", surface: "#180c2c", accent: "#a78bfa" },
  },
  {
    id: "crimson",
    name: "Crimson Ember",
    blurb: "Near-black with a warm ember-red glow.",
    swatches: { bg: "#090505", surface: "#1c0f0b", accent: "#ff6b4a" },
  },
  {
    id: "contrast",
    name: "High Contrast",
    blurb: "Maximum contrast — brightest text, strongest outlines.",
    swatches: { bg: "#000000", surface: "#0a0a0a", accent: "#ffd60a" },
  },
  {
    id: "rainbow",
    name: "Rainbow",
    blurb:
      "The Trades look, everywhere — deep navy lit by blue and violet glows, with the blue-to-violet gradient on accents.",
    swatches: { bg: "#070a14", surface: "#141a2e", accent: "#9a5cf5" },
  },
];

export const DEFAULT_THEME: ThemeId = "vault";

const THEME_STORAGE_KEY = "vaultx-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return (
    value === "vault" ||
    value === "light" ||
    value === "midnight" ||
    value === "crimson" ||
    value === "contrast" ||
    value === "rainbow"
  );
}

/** The theme mirrored on this device (set synchronously at startup
    so a reopen paints in the picked theme, before the profile's
    saved choice arrives from the server). */
export function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // Storage unavailable: the default theme applies.
  }
  return DEFAULT_THEME;
}

/** Apply a theme right now: flip the data-theme attribute the CSS
    variables key off, and mirror the choice on this device. */
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
}
