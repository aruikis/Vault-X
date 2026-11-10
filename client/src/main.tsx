import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

// Paint in the user's picked theme from the first frame: the choice
// is mirrored in localStorage (themes.ts), so read it before React
// renders and set the attribute the theme CSS keys off — no flash of
// the default theme on reopen. The profile's saved choice, fetched
// by the app once it loads, still wins if it differs.
try {
  const storedTheme = window.localStorage.getItem("vaultx-theme");
  if (storedTheme) document.documentElement.dataset.theme = storedTheme;
  // Same first-frame treatment for the document theme-color, so
  // the band around the header paints in the picked theme's
  // background from the very first frame on every page.
  const themeBg: Record<string, string> = {
    vault: "#060913",
    light: "#edf0f8",
    midnight: "#0b0516",
    crimson: "#090505",
    contrast: "#000000",
    rainbow: "#0b0f1e",
    jarvis: "#070b1a",
    clubhouse: "#0c1016",
  };
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) meta.content = themeBg[storedTheme ?? "vault"] ?? "#060913";
} catch {
  // Storage unavailable: the default Vault Dark theme applies.
}

// Same first-frame treatment for the LAYOUT (Nov 10, 2026):
// layouts are a per-user choice separate from the theme
// (Settings > Layout), mirrored in localStorage like the
// theme, so stamp data-layout before React renders and the
// picked layout's structure is there from the first frame.
try {
  const storedLayout = window.localStorage.getItem("vaultx-layout");
  if (storedLayout === "vision" || storedLayout === "classic") {
    document.documentElement.dataset.layout = storedLayout;
  }
} catch {
  // Storage unavailable: the Classic layout applies.
}

// Same first-frame treatment for the UI language (Nov 4,
// 2026): seed the i18n module's active language from the
// device mirror and stamp the document language, so the
// first paint and the shared formatters start in the
// picked language. The profile's saved choice still wins
// when it arrives.
try {
  const storedLang = window.localStorage.getItem("vaultx-language");
  if (
    storedLang === "es" ||
    storedLang === "de" ||
    storedLang === "fr" ||
    storedLang === "ja"
  ) {
    document.documentElement.lang =
      storedLang === "es"
        ? "es-ES"
        : storedLang === "de"
          ? "de-DE"
          : storedLang === "fr"
            ? "fr-FR"
            : "ja-JP";
  }
} catch {
  // Storage unavailable: English applies.
}

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// If you edit this file: keep `<QueryClientProvider client={spaceQueryClient}>`
// wrapping the app (every space shares the SDK's QueryClient), and keep
// BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div. The SDK styles select on
// `.hatch-space-root[data-hatch-space-root]` to apply mobile safe-area
// insets (notches, gesture bars, etc.), correct viewport sizing, and the
// hosting header/chrome offsets — dropping either breaks layout silently.
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
