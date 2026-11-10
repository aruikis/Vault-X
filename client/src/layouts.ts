// App layouts (Anthony, Nov 10, 2026): a Layout picker in
// Settings, SEPARATE from the Theme picker — his product
// model is multiple layouts AND multiple themes as independent
// choices. Themes are colors (themes.ts / theme.css); layouts
// are structure: the navigation's form, how Home is organized,
// the iconography, and the spacing rhythm.
//
// Two layouts:
// - Classic: the layout the app has always had. From v1.122.0
//   it carries New Vision's bubbly tab-to-tab flow and its
//   rounded icon treatment — Anthony loved sifting through
//   menus in New Vision and asked for that same feel and
//   those icons in the normal layout. From v1.123.0 its bottom
//   toolbar IS New Vision's dock, exactly (Anthony, Nov 9,
//   2026, evening: "I want the classic default version's
//   toolbar at the bottom to mimic new version's exactly") —
//   the floating rounded dock, icons only, the label riding
//   just the active tab's pill. Only the navigation's form,
//   motion, and icon styling carried over; Classic's
//   organization is unchanged.
// - New Vision: the modern reorganization (floating dock
//   navigation with icon-forward tabs, the Home hero + Scan
//   bar + icon quick actions, airier spacing and rounder
//   geometry).
//
// ATRIUM — REMOVED (Anthony, Nov 9, 2026, evening: "And
// atrium. Get rid of it altogether. No good."). The third
// layout (added v1.122.0) is gone in v1.123.0: it is no
// longer a LayoutId, so it disappears from the picker, and a
// saved "atrium" choice — on the device mirror or on the
// profile — is simply not a layout anymore: every reader
// below falls back to the Classic default with no error, and
// no other preference (theme, language, anything) is touched.
// Its presentation code (rooms bar, Home banners, gallery
// plaque/frame, structural CSS) came out with it.
//
// Every function, count, and behavior rule (back-button
// behavior, refresh-in-place, steppers, the shared themed
// dropdowns — including this picker) works identically under
// both layouts; only the presentation is reorganized. Picking
// a layout applies it app-wide immediately (the data-layout
// attribute on <html>, which the structural CSS in theme.css
// and the layout-aware components key off), mirrors it to
// localStorage so the next open paints in the picked layout
// with no flash, and saves it to the collector profile on the
// server so the choice follows the user across devices —
// exactly the theme preference's pattern. Presentation only:
// no collection data is involved.
//
// The New Vision 2.0 Beta THEME ("jarvis") predates the split
// and has always bundled the Vision layout with its colors;
// it keeps doing so: a user on that theme sees the Vision
// layout whatever the Classic / New Vision choice says.

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
      "The layout Vault X has always had — the Collector ID at the top of Home and the familiar spacing everywhere. Its bottom toolbar is New Vision's floating dock: icons only, with the label on just the tab you're on. It flows between tabs with New Vision's smooth, bubbly motion and uses New Vision's rounded icons.",
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
    the profile's saved choice arrives from the server). A
    mirror left by the removed Atrium layout is not a layout
    anymore and reads as the Classic default. */
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
