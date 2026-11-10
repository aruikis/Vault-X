// App layouts (Anthony, Nov 10, 2026): a Layout picker in
// Settings, SEPARATE from the Theme picker — his product
// model is multiple layouts AND multiple themes as independent
// choices. Themes are colors (themes.ts / theme.css); layouts
// are structure: the navigation's form, how Home is organized,
// the iconography, and the spacing rhythm.
//
// Three layouts, all permanent, fully supported options:
// - Classic: the layout the app has always had (bottom bar
//   with labeled tabs). From v1.122.0 it carries New Vision's
//   bubbly tab-to-tab flow and its rounded icon treatment —
//   Anthony loved sifting through menus in New Vision and
//   asked for that same feel and those icons in the normal
//   layout. Only the motion and icon styling carried over;
//   Classic's organization is unchanged.
// - New Vision: the modern reorganization (floating dock
//   navigation with icon-forward tabs, the Home hero + Scan
//   bar + icon quick actions, airier spacing and rounder
//   geometry).
// - Atrium (added v1.122.0, Anthony's direction to formulate
//   something genuinely different): a museum-gallery model.
//   Home opens search-first, then ONE rotating Focus spotlight
//   (most valuable item, most recently added, the set closest
//   to complete), then the collections as full-width cinematic
//   banners stacked vertically, each with its completion ring.
//   Navigation is a top segmented row of "rooms" (Collections |
//   Play | Social | Portfolio) instead of a bottom dock, so the
//   bottom of the screen stays clean for steppers and
//   checkout/trade bars. Binder chapters get a sticky
//   mini-header with a collapsible sealed row; card and item
//   pages present the piece framed like gallery art with a
//   museum plaque beneath it. Headings set in a display serif
//   with a clean sans for body, and a fresh rounded line-icon
//   set that is always labeled, never icon-only.
//
// Every function, count, and behavior rule (back-button
// behavior, refresh-in-place, steppers, the shared themed
// dropdowns — including this picker) works identically under
// all three; only the presentation is reorganized. Picking a
// layout applies it app-wide immediately (the data-layout
// attribute on <html>, which the structural CSS in theme.css
// and the layout-aware components key off), mirrors it to
// localStorage so the next open paints in the picked layout
// with no flash, and saves it to the collector profile on the
// server so the choice follows the user across devices —
// exactly the theme preference's pattern. Presentation only:
// no collection data is involved, and no user's saved choice
// is ever changed for them — Atrium is opt-in.
//
// The New Vision 2.0 Beta THEME ("jarvis") predates the split
// and has always bundled the Vision layout with its colors;
// it keeps doing so for Classic and New Vision picks (a user
// on that theme sees the Vision layout whatever the Classic /
// New Vision choice says). An explicit Atrium pick wins over
// that bundling: Atrium is its own formulation and presents
// as Atrium in every theme's colors.

export type LayoutId = "classic" | "vision" | "atrium";

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
      "The layout Vault X has always had — the bottom bar with labeled tabs, the Collector ID at the top of Home, the familiar spacing everywhere. It now flows between tabs with New Vision's smooth, bubbly motion and uses New Vision's rounded icons.",
  },
  {
    id: "vision",
    name: "New Vision",
    blurb:
      "The modern reorganization — a floating dock with icon-forward tabs, Home led by your portfolio hero and the big Scan bar with icon quick actions, and airier spacing with rounder shapes throughout. Same app, same data, same controls; pick any theme to pair with it.",
  },
  {
    id: "atrium",
    name: "Atrium",
    blurb:
      "A different formulation — your collection as a gallery. Home opens with search, then one rotating Focus spotlight, then your collections as full-width banners with completion rings. Rooms run across the top (Collections, Play, Social, Portfolio) so the bottom stays clear, chapters get a slim sticky header, and every card or item sits framed with a museum-style plaque beneath it. Serif headings, labeled line icons, in whichever theme colors you pick.",
  },
];

export const DEFAULT_LAYOUT: LayoutId = "classic";

const LAYOUT_STORAGE_KEY = "vaultx-layout";

export function isLayoutId(value: unknown): value is LayoutId {
  return value === "classic" || value === "vision" || value === "atrium";
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
    Beta theme (which bundles the layout) is active. An
    explicit Atrium pick is its own formulation and never
    presents as Vision. */
export function visionLayoutActive(
  layout: LayoutId,
  theme: string,
): boolean {
  if (layout === "atrium") return false;
  return layout === "vision" || theme === "jarvis";
}

/** True while the Atrium gallery layout should present. */
export function atriumLayoutActive(layout: LayoutId): boolean {
  return layout === "atrium";
}
