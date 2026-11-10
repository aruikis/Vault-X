// App layouts (Anthony, Nov 10, 2026): a Layout picker in
// Settings, SEPARATE from the Theme picker — his product
// model is multiple layouts AND multiple themes as independent
// choices. Themes are colors (themes.ts / theme.css); layouts
// are structure: the navigation's form, how Home is organized,
// the iconography, and the spacing rhythm. The New Vision
// layout is the modern reorganization (floating dock
// navigation with icon-forward tabs, the Home hero + Scan bar
// + icon quick actions, airier spacing and rounder geometry);
// Classic is the layout the app has always had. Both are
// permanent, fully supported options: every function, count,
// and behavior rule (back-button behavior, refresh-in-place,
// steppers, the shared dropdowns) works identically under
// either — only the presentation is reorganized.
//
// Picking a layout applies it app-wide immediately (the
// data-layout attribute on <html>, which the structural CSS
// in theme.css and the layout-aware components key off),
// mirrors it to localStorage so the next open paints in the
// picked layout with no flash, and saves it to the collector
// profile on the server so the choice follows the user
// across devices — exactly the theme preference's pattern.
// Presentation only: no collection data is involved.
//
// The New Vision 2.0 Beta THEME ("jarvis") predates the split
// and has always bundled this layout with its colors; it
// keeps doing so (a user on that theme sees the Vision layout
// whatever this separate choice says), so the reorganization
// follows EITHER the layout picked here OR that theme. Every
// other theme pairs freely with either layout.

export type LayoutId = "classic" | "vision";

export interface LayoutMeta {
  id: LayoutId;
  name: string;
  blurb: string;
}

export const LAYOUTS: LayoutMeta[] = [
  {
    id: "classic",
    name: "Classic",
    blurb:
      "The layout Vault X has always had — the bottom bar with labeled tabs, the Collector ID at the top of Home, the familiar spacing everywhere.",
  },
  {
    id: "vision",
    name: "New Vision",
    blurb:
      "The modern reorganization — a floating dock with icon-forward tabs, Home led by your portfolio hero and the big Scan bar with icon quick actions, and airier spacing with rounder shapes throughout. Same app, same data, same controls; pick any theme to pair with it.",
  },
];

export const DEFAULT_LAYOUT: LayoutId = "classic";

const LAYOUT_STORAGE_KEY = "vaultx-layout";

export function isLayoutId(value: unknown): value is LayoutId {
  return value === "classic" || value === "vision";
}

/** The layout mirrored on this device (set synchronously at
    startup so a reopen paints in the picked layout, before
    the profile's saved choice arrives from the server). */
export function readStoredLayout(): LayoutId {
  try {
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (isLayoutId(stored)) return stored;
  } catch {
    // Storage unavailable: the default layout applies.
  }
  return DEFAULT_LAYOUT;
}

/** Apply a layout right now: flip the data-layout attribute
    the structural CSS keys off, and mirror the choice on
    this device. */
export function applyLayout(layout: LayoutId): void {
  document.documentElement.dataset.layout = layout;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Storage unavailable: the layout still applies for
    // this session.
  }
}

/** True while the Vision reorganization should present:
    the New Vision layout is picked, or the New Vision 2.0
    Beta theme (which bundles the layout) is active. */
export function visionLayoutActive(
  layout: LayoutId,
  theme: string,
): boolean {
  return layout === "vision" || theme === "jarvis";
}
