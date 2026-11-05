// Lego section (Anthony approved the researched section
// structure on Nov 2, 2026 — Sets by theme, Sealed, Minifigures,
// and Retiring Soon, modeled on BrickEconomy / Brickanize /
// Brickway).
//
// Nov 4, 2026: the FULL Lego catalog download landed (Anthony's
// direction, ~12:10 PM) — Rebrickable's official bulk data,
// imported resumably into the shared game-catalog store like
// Pokémon/Magic/Star Wars/Funko. The Sets area IS that catalog
// (the shared GamePanel, embedded): themes as sections, every
// set ghosted until owned, sealed-vs-opened tracked as two
// counts because that distinction drives Lego value. The
// Sealed area lists the sets marked sealed. Minifigures and
// Retiring Soon stay honest empty states: Rebrickable's bulk
// files carry no per-set minifigure counts and no retirement
// schedule, and nothing is invented to fill them.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { replaceNavState } from "./historyNav";
import { GamePanel } from "./games";

type LegoArea = "sets" | "sealed" | "minifigures" | "retiring";

const AREAS: { key: LegoArea; label: string; blurb: string }[] = [
  {
    key: "sets",
    label: "Sets",
    blurb:
      "Every Lego set in the catalog, grouped by theme — each of yours marked Sealed or Opened, because that distinction drives what a Lego set is worth.",
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

function SealedShelf() {
  const owned = useQuery({
    queryKey: ["gameOwnedItems", "lego"],
    queryFn: () => api.getGameOwnedItems({ game: "lego" }),
  });
  const sealedSets = (owned.data?.items ?? []).filter(
    (i) => i.ownedSealedQty > 0,
  );
  if (owned.isPending) {
    return (
      <p className="mt-4 text-sm text-[var(--dim)]">
        Loading your sealed shelf…
      </p>
    );
  }
  if (sealedSets.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[var(--text)]">
          Nothing here yet
        </p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
          No sealed sets added. Mark a set sealed from its page in
          Sets and it will sit here, apart from your opened builds.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
      {sealedSets.map((i) => (
        <li key={i.id} className="flex items-center gap-3 py-2.5">
          {i.imageUrl ? (
            <img
              src={i.imageUrl}
              alt=""
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded object-cover"
            />
          ) : (
            <span className="h-14 w-14 shrink-0 rounded bg-[var(--bg)]" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[var(--text)]">
              {i.name}
            </span>
            <span className="block text-xs text-[var(--dim)]">
              {i.sectionName} · #{i.printed}
              {i.rarity ? ` · ${i.rarity}` : ""}
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-[var(--gold)]/50 px-2.5 py-1 text-xs font-bold text-[var(--gold-soft)]">
            Sealed ×{i.ownedSealedQty}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LegoPanel({ onScan }: { onScan?: () => void }) {
  const [area, setArea] = useState<LegoArea>("sets");
  const catalog = useQuery({
    queryKey: ["gameCatalog", "lego"],
    queryFn: () => api.getGameCatalog({ game: "lego" }),
  });
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
    // BACK ROOT-CAUSE FIX (Anthony, Nov 5, 2026 — back in the
    // Lego section kept ejecting him from the section): area
    // switches used to REPLACE the Lego entry, so the device
    // Back had no in-section step to land on and popped the
    // whole Lego drill entry to Home. The FIRST area hop now
    // PUSHES one entry over the plain Lego entry, and the
    // sync listener above restores the area from whatever
    // entry Back lands on — Back steps area → Sets → Home →
    // exit, inside the three-back budget. Further hops while
    // an area entry is already on top replace it, so the
    // stack never grows past that one extra entry.
    try {
      const cur = window.history.state as {
        legoArea?: string;
      } | null;
      if (typeof cur?.legoArea === "string") {
        replaceNavState({ mcView: "lego", legoArea: key });
      } else {
        window.history.pushState(
          {
            ...((window.history.state as Record<string, unknown> | null) ??
              {}),
            mcView: "lego",
            legoArea: key,
          },
          "",
        );
      }
    } catch {
      replaceNavState({ mcView: "lego", legoArea: key });
    }
  };
  const current = AREAS.find((a) => a.key === area) ?? AREAS[0];
  const setsCataloged = catalog.data?.cardsTotal ?? 0;
  const setsOwned = catalog.data?.ownedTotal ?? 0;
  return (
    <div className="pt-4">
      <section aria-label="Legos collection summary">
        <p className="font-album text-lg leading-snug text-[var(--text)]">
          {catalog.isPending
            ? "Loading your Lego collection…"
            : setsCataloged > 0
              ? `${setsCataloged.toLocaleString()} sets in the catalog`
              : "The Lego catalog is on its way"}
        </p>
        <p className="mt-1.5 text-sm text-[var(--dim)]">
          {setsOwned > 0
            ? `You own ${setsOwned.toLocaleString()} ${setsOwned === 1 ? "copy" : "copies"} so far — sealed copies counted apart from opened ones.`
            : "Browse the catalog in Sets and mark what you own — each set as Sealed or Opened."}
          {catalog.data && !catalog.data.complete
            ? " The catalog download is still running in chunks; more sets land as it goes."
            : ""}
        </p>
      </section>

      <h1 className="font-album mt-5 text-2xl leading-tight text-[var(--text)]">
        Legos
      </h1>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Four areas, the way the Lego collection apps organize a
        collection. The Sets area carries the full catalog search.
      </p>

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
          {area === "sets" ? (
            <GamePanel game="lego" embedded onScan={onScan} />
          ) : area === "sealed" ? (
            <SealedShelf />
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
              <p className="text-sm font-medium text-[var(--text)]">
                Nothing here yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
                {area === "minifigures"
                  ? "No minifigures added yet — and the catalog source doesn't publish per-set minifigure counts, so none are shown rather than guessed."
                  : "Nothing is being tracked for retirement yet — the catalog source doesn't publish a retirement schedule, so this stays empty rather than inventing dates."}
              </p>
            </div>
          )}
        </section>
      ) : null}

      <footer className="mt-8 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--dim)]">
        Catalog: Rebrickable&rsquo;s official bulk Lego data — set
        numbers, names, themes, years, piece counts, and set images.
        That source publishes no prices and no per-set minifigure
        counts; a set&rsquo;s own page carries researched facts and
        market data (Brickset, BrickLink, BrickEconomy, Brickfact)
        once it has been looked up, each labeled with its source.
      </footer>
    </div>
  );
}
