// Lego section scaffold (Anthony approved the researched section
// structure on Nov 2, 2026 — Sets by theme, Sealed, Minifigures, and
// Retiring Soon, modeled on BrickEconomy / Brickanize / Brickway).
//
// Scaffold only: Anthony has not cataloged any Lego sets or figures
// in this app yet, so every area is an honest empty state describing
// what will live there — no sets, themes, figures, prices, or
// retiring dates are invented. One real rule from Anthony is built
// into the structure: he has SEALED Lego sets, and sealed-vs-opened
// drives Lego value, so Sets and the Sealed area carry that
// distinction from the start.
//
// The view mirrors the Comics/Lorcana construction: a summary
// header, area pills (the Social/Portfolio pattern), and one page
// per area.

import { useEffect, useState } from "react";
import { SearchScanRow } from "./searchScanRow";

type LegoArea = "sets" | "sealed" | "minifigures" | "retiring";

const AREAS: { key: LegoArea; label: string; blurb: string }[] = [
  {
    key: "sets",
    label: "Sets",
    blurb:
      "Your sets grouped by theme — each set marked Sealed or Opened, because that distinction drives what a Lego set is worth.",
  },
  {
    key: "sealed",
    label: "Sealed",
    blurb:
      "The sealed shelf: sets still in their box, tracked separately from opened builds the way your sealed Lorcana sits apart from the binder.",
  },
  {
    key: "minifigures",
    label: "Minifigures",
    blurb:
      "Minifigures on their own — the figures pulled from sets, plus any collected solo.",
  },
  {
    key: "retiring",
    label: "Retiring Soon",
    blurb:
      "Sets nearing retirement, so a set you want doesn't quietly leave shelves before you grab it.",
  },
];

export function LegoPanel({ onScan }: { onScan?: () => void }) {
  const [area, setArea] = useState<LegoArea>("sets");
  // Section search (Nov 3, 2026, ~11:14 PM): the Search +
  // Scan row every collection section carries. No Lego
  // items are cataloged yet, so a search honestly reports
  // the empty catalog instead of pretending to look.
  const [legoQuery, setLegoQuery] = useState("");
  // Area switches are navigation steps (whole-app back-gesture fix):
  // each pushes a history entry, and this listener syncs the area
  // from whatever entry Back lands on — a Lego entry restores its
  // area (the plain Lego entry means the default, Sets), and pops
  // landing on overlay entries (no mcView) are left to the overlays'
  // own traps. It also runs once on mount, so returning to Lego via
  // Back restores the area its entry names.
  useEffect(() => {
    const syncFromHistory = () => {
      const st = window.history.state as {
        mcView?: string;
        legoArea?: string;
      } | null;
      if (!st || st.mcView !== "lego") return;
      const a = AREAS.find((x) => x.key === st.legoArea);
      setArea(a ? a.key : "sets");
    };
    syncFromHistory();
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);
  const pickArea = (key: LegoArea) => {
    if (key === area) return;
    setArea(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      window.history.pushState({ mcView: "lego", legoArea: key }, "");
    } catch {
      // History unavailable: the area still switched.
    }
  };
  const current = AREAS.find((a) => a.key === area) ?? AREAS[0];
  return (
    <div className="pt-4">
      <section aria-label="Legos collection summary">
        <p className="font-album text-lg leading-snug text-[var(--text)]">
          No Lego sets cataloged yet
        </p>
        <p className="mt-1.5 text-sm text-[var(--dim)]">
          This section is scaffolded and ready — when you catalogue
          your sets, they will land here with their sealed or opened
          state attached.
        </p>
      </section>

      <h1 className="font-album mt-5 text-2xl leading-tight text-[var(--text)]">
        Legos
      </h1>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Four areas, the way the Lego collection apps organize a
        collection. Pick an area to see what it will hold.
      </p>

      <div className="mt-4">
        <SearchScanRow
          inputId="lego-section-search"
          label="Search your Lego sets and minifigures"
          placeholder="Search sets, themes, figures…"
          value={legoQuery}
          onChange={setLegoQuery}
          onScan={onScan}
        />
      </div>
      {legoQuery.trim().length >= 2 ? (
        <p className="mt-3 text-sm text-[var(--dim)]">
          No Lego items are cataloged yet, so there&rsquo;s nothing
          to match — once your sets are cataloged, this bar searches
          them.
        </p>
      ) : null}

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Legos areas"
      >
        {AREAS.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-pressed={area === a.key}
            onClick={() => pickArea(a.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              area === a.key
                ? "bg-[var(--gold)] font-bold text-black"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {current ? (
        <section aria-label={current.label} className="mt-5">
          <h2 className="font-album text-lg text-[var(--text)]">
            {current.label}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
            {current.blurb}
          </p>
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--text)]">
              Nothing here yet
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
              {area === "sets"
                ? "No sets added. When they are, they'll be grouped by theme, each marked Sealed or Opened."
                : area === "sealed"
                  ? "No sealed sets added. Your sealed sets will sit here, apart from opened builds."
                  : area === "minifigures"
                    ? "No minifigures added yet."
                    : "Nothing is being tracked for retirement yet — sets get flagged here once they're cataloged."}
            </p>
          </div>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--dim)]">
        Structure approved from the collection-app research
        (BrickEconomy / Brickanize / Brickway patterns). No Lego items
        have been cataloged in this app yet, so no sets, values, or
        retirement dates are shown.
      </footer>
    </div>
  );
}
