import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { hapticTick } from "./haptics";
import { GamePanel, type GameKey } from "./games";
import { useDragReorder } from "./dragReorder";
import { useSavedOrder } from "./reorderPrefs";
import {
pushWindowState,
readNavState,
replaceNavState,
scrubWindowKeys,
} from "./historyNav";
import sportsBaseball from "./assets/sports-baseball-tile-opt1.webp";
import sportsBasketball from "./assets/sports-basketball-tile-opt1.webp";
import sportsBaseballBanner from "./assets/sports-baseball-banner.webp";
import sportsBasketballBanner from "./assets/sports-basketball-banner.webp";

/**
 * Sports Cards (Anthony, Nov 4, 2026): the fifth main area
 * on Home, beside TCG Universe, Comics, Legos, and Funko.
 * Inside, exactly TWO sport subfolders for now — Baseball
 * and Basketball — with his provided tile artwork; football,
 * hockey, soccer, and everything else stay out until he
 * says otherwise.
 *
 * Each sport is organized by MANUFACTURER TABS, the same
 * framework as the other collections (set groups, binder
 * grids with the two/four-across toggle and ghosted missing
 * cards, card pages, owned steppers, search):
 * - Baseball → TEN tabs, one per big name on the cards
 *   (Anthony, Nov 4, 2026): Topps, Bowman, Fleer, Donruss,
 *   Upper Deck, Score, Pinnacle, Leaf, Panini, Beckett —
 *   corporate ownership is irrelevant (Bowman keeps its own
 *   tab though Topps owns it; Donruss its own though Panini
 *   runs it). Topps and Bowman carry real catalogs from
 *   Topps' own official checklists, DATA ONLY — no artwork
 *   is downloaded. The other eight names publish no
 *   downloadable checklist catalog, and the big checklist
 *   databases forbid bulk downloads in their terms, so
 *   those tabs carry that honest state instead of invented
 *   data or a borrowed catalog.
 * - Basketball → Panini first (it held the NBA license
 *   2009–late 2025), then Topps (the license holder now;
 *   its official basketball checklists import the same
 *   way). Panini publishes no downloadable checklist
 *   catalog — its checklist tool is a web app with no file
 *   index — so its tab carries the same honest state.
 */

type SportKey = "baseball" | "basketball";

type BrandTab = {
  key: string;
  label: string;
  /** The game-catalog key behind the tab, when the brand
      has an importable catalog. */
  game: GameKey | null;
  /** For a tab with no importable catalog: why, in one
      honest sentence. */
  noSourceNote?: string;
};

const LEGACY_NO_SOURCE =
  "it doesn't publish a downloadable checklist catalog, and the collector checklist databases that list its sets forbid bulk downloads in their terms";
const PANINI_NO_SOURCE =
  "it doesn't publish a downloadable checklist catalog the way Topps does (its checklist tool is a web app with no file index), and the big checklist databases forbid bulk downloads in their terms";

const SPORTS: {
  key: SportKey;
  label: string;
  art: string;
  artAlt: string;
  /** The sport page's banner (Anthony, Nov 5, 2026): a
      purpose-composed WIDE banner, separate from the square
      tile art — the word alone in the same lettering, the
      player complete inside the frame, and NO "Vault X"
      wording anywhere in it. */
  banner: string;
  bannerAlt: string;
  brands: BrandTab[];
}[] = [
  {
    key: "baseball",
    label: "Baseball",
    art: sportsBaseball,
    artAlt:
      "Baseball artwork: a worn leather glove with a baseball resting in it, on a dark background",
    banner: sportsBaseballBanner,
    bannerAlt:
      "Baseball banner: the word Baseball in large purple chrome lettering beside a complete batter silhouette, bat raised, over a glowing diamond under stadium lights",
    brands: [
      { key: "topps", label: "Topps", game: "topps" },
      { key: "bowman", label: "Bowman", game: "bowman" },
      { key: "fleer", label: "Fleer", game: null, noSourceNote: LEGACY_NO_SOURCE },
      { key: "donruss", label: "Donruss", game: null, noSourceNote: LEGACY_NO_SOURCE },
      { key: "upper-deck", label: "Upper Deck", game: null, noSourceNote: LEGACY_NO_SOURCE },
      { key: "score", label: "Score", game: null, noSourceNote: LEGACY_NO_SOURCE },
      { key: "pinnacle", label: "Pinnacle", game: null, noSourceNote: LEGACY_NO_SOURCE },
      { key: "leaf", label: "Leaf", game: null, noSourceNote: LEGACY_NO_SOURCE },
      { key: "panini", label: "Panini", game: null, noSourceNote: PANINI_NO_SOURCE },
      { key: "beckett", label: "Beckett", game: null, noSourceNote: "Beckett is a grading and price-guide company rather than a card manufacturer, and it publishes no downloadable checklist catalog; the collector checklist databases forbid bulk downloads in their terms" },
    ],
  },
  {
    key: "basketball",
    label: "Basketball",
    art: sportsBasketball,
    artAlt:
      "Basketball artwork: a basketball resting on a dark court",
    banner: sportsBasketballBanner,
    bannerAlt:
      "Basketball banner: the word Basketball in large blue-purple chrome lettering beside a complete player silhouette mid-dunk at the hoop over a glowing court",
    brands: [
      { key: "panini", label: "Panini", game: null, noSourceNote: PANINI_NO_SOURCE },
      { key: "topps", label: "Topps", game: "topps-basketball" },
    ],
  },
];

const SPORT_STORAGE_KEY = "vaultx-sports-open-sport";

function BackPill({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTick();
        onClick();
      }}
      aria-label={`Back to ${label}`}
      className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition active:scale-95"
    >
      <span aria-hidden="true">‹</span> {label}
    </button>
  );
}

/** The sport page's collection summary: real owned/cataloged
    counts from the active brand's catalog query once the
    download has brought cards in; the honest not-yet line
    before that. */
function SportSummary({
  sportLabel,
  brand,
}: {
  sportLabel: string;
  brand: BrandTab;
}) {
  const game = brand.game;
  const catalog = useQuery({
    queryKey: ["gameCatalog", game],
    queryFn: () => api.getGameCatalog({ game: game! }),
    enabled: game != null,
  });
  const data = catalog.data;
  return (
    <div className="mt-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-3.5 py-3">
      <h2 className="text-sm font-bold text-[var(--text)]">
        Your collection
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        {game == null
          ? `No ${brand.label} ${sportLabel.toLowerCase()} cards yet.`
          : data && (data.ownedTotal > 0 || data.cardsTotal > 0)
            ? `${data.ownedTotal.toLocaleString()} owned · ${data.cardsTotal.toLocaleString()} ${brand.label} cards cataloged`
            : `No ${sportLabel.toLowerCase()} cards yet — the ${brand.label} catalog below brings them in.`}
      </p>
    </div>
  );
}

function SportPage({
  sport,
  onBack,
}: {
  sport: (typeof SPORTS)[number];
  onBack: () => void;
}) {
  const [brandKey, setBrandKey] = useState(sport.brands[0]!.key);
  const brand =
    sport.brands.find((b) => b.key === brandKey) ?? sport.brands[0]!;
  return (
    <section aria-label={`${sport.label} cards`} className="pt-4">
      <BackPill label="Sports Cards" onClick={onBack} />
      {/* The banner (Anthony, Nov 5, 2026): HALF the old
          height — h-[88px] against the old h-44 — and a
          purpose-composed wide banner artwork instead of
          the square tile art squeezed through object-top,
          which had cropped it to a sliver showing the word
          at the very bottom with the top of the player's
          head and bat. The banner art is composed for this
          shape (word on the left, the whole player inside
          the frame), so object-cover at this height shows
          it clean, and it carries no "Vault X" wording. */}
      <img
        src={sport.banner}
        alt={sport.bannerAlt}
        loading="lazy"
        draggable={false}
        className="mt-3 block h-[88px] w-full rounded-2xl border border-[var(--border)] object-cover object-center"
      />
      <h1 className="mt-3 font-album text-2xl text-[var(--text)]">
        {sport.label}
      </h1>
      {sport.key === "baseball" ? (
        <button
          type="button"
          onClick={() => {
            hapticTick();
            window.dispatchEvent(
              new CustomEvent("vaultx:open-slab-scan"),
            );
          }}
          aria-label="Scan a PSA slab — opens the scanner in slab mode to read its cert number"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-semibold text-[var(--gold-soft)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-4.5 w-4.5 shrink-0"
            aria-hidden="true"
          >
            <path d="M4 5v14M8 5v14M11 5v14M15 5v14M17.5 5v14M21 5v14" />
          </svg>
          Scan a PSA slab
        </button>
      ) : null}
      <SportSummary sportLabel={sport.label} brand={brand} />
      {/* Manufacturer tabs (Anthony, Nov 4, 2026): one tab
          per card maker for the sport; a tab opens that
          maker's catalog in the same framework as the other
          collections. */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label={`${sport.label} manufacturers`}
      >
        {sport.brands.map((b) => {
          const active = b.key === brand.key;
          return (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                hapticTick();
                setBrandKey(b.key);
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                active
                  ? "bg-[var(--gold)] text-black"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      {brand.game ? (
        <GamePanel key={brand.game} game={brand.game} />
      ) : (
        <div className="mt-4 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-4">
          <h2 className="font-album text-lg text-[var(--text)]">
            {brand.label} {sport.label}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
            No {brand.label} catalog yet — {brand.noSourceNote},
            so there is nothing honest to import yet. When a
            real {brand.label} source opens up, this tab fills
            the same way Topps does: set groups, binder grids
            with the missing cards ghosted, a page for every
            card, and its value tracked like everything else
            in the vault.
          </p>
        </div>
      )}
    </section>
  );
}

export function SportsCardsPage({
  onBack,
}: {
  /** Back to Home. */
  onBack: () => void;
}) {
  const [sport, setSport] = useState<SportKey | null>(() => {
    try {
      const saved = window.sessionStorage.getItem(SPORT_STORAGE_KEY);
      return saved === "baseball" || saved === "basketball"
        ? saved
        : null;
    } catch {
      return null;
    }
  });
  // Back audit (Anthony, Nov 5, 2026 — app-wide re-check):
  // a sport page is a drill-in over the Sports Cards list,
  // so it takes the window's one history entry like every
  // other drill-in that must return in ONE Back press. The
  // phone's Back now lands on the Sports Cards list (never
  // straight out of the app from Baseball/Basketball), the
  // on-screen Back pill consumes the same entry exactly
  // once, and the three-back budget holds: sport → list →
  // (Sports Cards is a main view) exit. Before this fix the
  // sport lived only in session state, so the phone's Back
  // exited the app from inside a sport.
  const sportPushedRef = useRef(false);
  const sportHeldRef = useRef(false);
  useEffect(() => {
    // Refresh-in-place seeding: a reload mid-sport lands on
    // the sport's own pushed entry, which still names it.
    if (sport && readNavState()?.sportsSport === sport) {
      sportHeldRef.current = true;
      sportPushedRef.current = true;
    }
    const onPopState = () => {
      if (
        sportHeldRef.current &&
        readNavState()?.sportsSport == null
      ) {
        sportHeldRef.current = false;
        sportPushedRef.current = false;
        setSport(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () =>
      window.removeEventListener("popstate", onPopState);
    // Mount-only: refs and setSport are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openSport = (key: SportKey) => {
    hapticTick();
    setSport(key);
    if (sportHeldRef.current) {
      // Already holding the entry (sport-to-sport hop):
      // rename the sport in place, no second push.
      replaceNavState({
        ...(readNavState() ?? {}),
        sportsSport: key,
      });
      return;
    }
    sportPushedRef.current = pushWindowState(
      { ...(readNavState() ?? {}), mcView: "sports", sportsSport: key },
      "sportsSport",
    );
    sportHeldRef.current = true;
  };
  const closeSport = () => {
    if (sportPushedRef.current) {
      window.history.back();
    } else {
      sportHeldRef.current = false;
      scrubWindowKeys(["sportsSport"]);
      setSport(null);
    }
  };
  // Universal Search (and any deep link) can hand off a
  // Topps card: the event names the sports catalog, and the
  // page opens that card's sport. GamePanel itself consumes
  // the section/card handoff keys on mount.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const game = (e as CustomEvent<{ game?: string }>).detail?.game;
      if (game === "topps" || game === "bowman") openSport("baseball");
      else if (game === "topps-basketball") openSport("basketball");
    };
    window.addEventListener("vaultx:open-game-section", onOpen);
    return () =>
      window.removeEventListener("vaultx:open-game-section", onOpen);
    // openSport is stable in practice (refs + setSport).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (sport) {
        window.sessionStorage.setItem(SPORT_STORAGE_KEY, sport);
      } else {
        window.sessionStorage.removeItem(SPORT_STORAGE_KEY);
      }
    } catch {
      // Private mode: the sport list is the fallback.
    }
  }, [sport]);
  const baseballCatalog = useQuery({
    queryKey: ["gameCatalog", "topps"],
    queryFn: () => api.getGameCatalog({ game: "topps" }),
  });
  const bowmanCatalog = useQuery({
    queryKey: ["gameCatalog", "bowman"],
    queryFn: () => api.getGameCatalog({ game: "bowman" }),
  });
  const basketballCatalog = useQuery({
    queryKey: ["gameCatalog", "topps-basketball"],
    queryFn: () => api.getGameCatalog({ game: "topps-basketball" }),
  });
  const ownedTotal =
    (baseballCatalog.data?.ownedTotal ?? 0) +
    (bowmanCatalog.data?.ownedTotal ?? 0) +
    (basketballCatalog.data?.ownedTotal ?? 0);
  const catalogedTotal =
    (baseballCatalog.data?.cardsTotal ?? 0) +
    (bowmanCatalog.data?.cardsTotal ?? 0) +
    (basketballCatalog.data?.cardsTotal ?? 0);
  const active = SPORTS.find((s) => s.key === sport) ?? null;

  // Long-press drag reorder (Anthony, Nov 5, 2026): the
  // sport tiles reorder through the same shared mechanism
  // as the universe pages; the saved order is per user
  // ("sports").
  const { ordered: orderedSportKeys, saveOrder: saveSportOrder } =
    useSavedOrder(
      "sports",
      SPORTS.map((s) => s.key),
    );
  const sportDrag = useDragReorder({
    keys: orderedSportKeys,
    onCommit: saveSportOrder,
  });
  const orderedSports = orderedSportKeys
    .map((k) => SPORTS.find((s) => s.key === k))
    .filter((s) => s != null);

  if (active) {
    return <SportPage sport={active} onBack={closeSport} />;
  }

  return (
    <section aria-label="Sports Cards" className="pt-4">
      <BackPill label="Home" onClick={onBack} />
      <h1 className="mt-3 font-album text-2xl text-[var(--text)]">
        Sports Cards
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Your sports cards, organized by sport — the same
        framework as the rest of the vault.
      </p>
      <div className="mt-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-3.5 py-3">
        <h2 className="text-sm font-bold text-[var(--text)]">
          Your collection
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {ownedTotal > 0 || catalogedTotal > 0
            ? `${ownedTotal.toLocaleString()} owned · ${catalogedTotal.toLocaleString()} cards cataloged across Baseball and Basketball.`
            : "No sports cards yet. Two sports are open — Baseball and Basketball; more arrive when you say so."}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
        Hold a tile until it lifts, then drag it over the
        other to swap places — the order saves as yours.
      </p>
      <div
        ref={sportDrag.containerRef}
        className="mt-4 flex flex-wrap justify-center gap-3"
      >
        {orderedSports.map((s) => (
          <div
            key={s.key}
            {...sportDrag.itemProps(s.key)}
            className={`relative w-[calc((100%-1.5rem)/3)] ${
              sportDrag.draggingKey === s.key ? "z-30" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (sportDrag.suppressClick()) return;
                openSport(s.key);
              }}
              aria-label={`Open your ${s.label} cards`}
              className="block w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <img
                src={s.art}
                alt={s.artAlt}
                loading="lazy"
                draggable={false}
                className="block aspect-square w-full object-cover"
              />
              <span className="block px-1 py-2 text-center text-xs font-semibold text-[var(--text)] sm:text-sm">
                {s.label}
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
