// Game catalog sections (Anthony, Nov 3, 2026, late — the
// three-game build): Pokémon, Magic: The Gathering, and Star
// Wars: Unlimited, each browsable by set and collector number
// like the Lorcana binder — printings shown ghosted until the
// collector marks copies owned, add-by-search across the whole
// game catalog, and a resumable catalog download (the catalogs
// hold tens of thousands of printings, so the download runs in
// chunks and its progress is always shown honestly, never
// dressed up as finished before it is).
//
// Catalog data is text + artwork links from each game's
// canonical free source (Pokémon: PokemonTCG/pokemon-tcg-data;
// Magic: Scryfall; Star Wars: Unlimited: Fantasy Flight's
// official card API) — artwork bytes are not stored, matching
// the Lorcana catalog's model. Prices show only where the
// source publishes one; the Star Wars source publishes none,
// so its cards honestly show no price.

import { useEffect, useRef, useState } from "react";
import {
useMutation,
useQuery,
useQueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { fmtMoneyUSD, useT } from "./i18n";
import { SearchScanRow } from "./searchScanRow";
import { WatchToggleButton } from "./portfolioTools";
import { VxSelect } from "./vxSelect";
import {
GridColsToggle,
useGridCols,
type GridCols,
} from "./gridCols";
import {
  pushWindowState,
  readNavState,
  scrubWindowKeys,
} from "./historyNav";

export type GameKey = "pokemon" | "magic" | "starwars" | "funko" | "lego";

export const GAME_TITLES: Record<GameKey, string> = {
  pokemon: "Pokémon",
  magic: "Magic: The Gathering",
  starwars: "Star Wars Unlimited",
  funko: "Funko Pop!",
  lego: "Legos",
};

const GAME_SOURCE_LINES: Record<GameKey, string> = {
  pokemon:
    "Catalog: Pokémon TCG data (PokemonTCG/pokemon-tcg-data). Prices from TCGplayer where the source publishes them.",
  magic:
    "Catalog: Scryfall. Prices in USD where Scryfall publishes them.",
  starwars:
    "Catalog: Fantasy Flight's official Star Wars: Unlimited card database. That source publishes no prices, so none are shown.",
  funko:
    "Catalog: the open-source funko-pop-data dataset, scraped from Pop Price Guide / HobbyDB — the collector-tracked Funko catalog. Known gaps: that dataset was last updated in January 2021, so figures released since are not in it yet, and it carries no figure numbers or prices, so none are shown.",
  lego:
    "Catalog: Rebrickable's official bulk Lego data (sets and themes) — every set with its number, theme, year, piece count, and set image. Known gaps: that source publishes no prices, so none are shown, and its bulk files carry no per-set minifigure counts yet.",
};

/** The item noun for a catalog: cards are "printings";
    Funko figures are "figures" (Anthony, Nov 4, 2026);
    Lego rows are "sets". */
export function gameNoun(game: GameKey): string {
  return game === "funko" ? "figures" : game === "lego" ? "sets" : "printings";
}

/** The progress unit for a catalog download: sets for the
    card games, pages for Star Wars, chunks for Funko/Lego. */
export function gameUnit(game: GameKey): string {
  return game === "starwars"
    ? "pages"
    : game === "funko" || game === "lego"
      ? "chunks"
      : "sets";
}

type SectionCard = ApiResponse<
  typeof api,
  "getGameSection"
>["cards"][number];
type SearchCard = ApiResponse<
  typeof api,
  "searchGameCards"
>["results"][number];

type DetailCard = {
  id: number;
  name: string;
  printed: string;
  sectionName: string;
  rarity: string | null;
  finish: string | null;
  imageUrl: string | null;
  price: number | null;
  ownedQty: number;
  ownedSealedQty: number;
};

function fmtPrice(n: number): string {
  return fmtMoneyUSD(n);
}

/** One set-page grid tile. At the default two-across
    density (Anthony, Nov 4, 2026) it carries the same
    on-grid count stepper as the Lorcana pockets — big
    round − / + buttons saving through setGameCardOwned on
    every tap, so copies can be added while cataloging
    without opening each card; at four-across it is the
    plain tap-to-open tile it has always been. */
function GameGridTile({
  game,
  c,
  cols,
  onOpen,
}: {
  game: GameKey;
  c: SectionCard;
  cols: GridCols;
  onOpen: (c: SectionCard) => void;
}) {
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(c.ownedQty);
  useEffect(() => {
    setQty(c.ownedQty);
  }, [c.ownedQty]);
  const save = useMutation({
    mutationFn: (next: number) =>
      api.setGameCardOwned({ id: c.id, ownedQty: next }),
    onSuccess: (r) => {
      setQty(r.ownedQty);
      void queryClient.invalidateQueries({
        queryKey: ["gameCatalog", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSection", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSearch", game],
      });
    },
  });
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(999, qty + delta));
    setQty(next);
    save.mutate(next);
  };
  // Lego tracks sealed copies apart from opened ones; the
  // tile's ghosting and owned total count both, while its
  // stepper edits the opened count (the detail view carries
  // the separate Sealed stepper).
  const sealedQty = game === "lego" ? c.ownedSealedQty : 0;
  const totalOwned = qty + sealedQty;
  const shownQty = cols === 2 ? totalOwned : c.ownedQty + sealedQty;
  const art = c.imageUrl ? (
    <img
      src={c.imageUrl}
      alt=""
      loading="lazy"
      className={`aspect-[3/4] w-full rounded-lg object-cover ${
        shownQty === 0 ? "opacity-35 grayscale-[45%]" : ""
      }`}
    />
  ) : (
    <span
      className={`flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-1 text-center text-[10px] text-[var(--dim)] ${
        shownQty === 0 ? "opacity-60" : ""
      }`}
    >
      No artwork link
    </span>
  );
  const aria = `${c.name}, number ${c.printed}${shownQty > 0 ? `, owned ${shownQty}` : ", missing"}`;
  if (cols !== 2) {
    return (
      <button
        type="button"
        onClick={() => onOpen(c)}
        aria-label={aria}
        className="text-left"
      >
        {art}
        <span className="mt-1 block truncate text-[11px] font-medium leading-tight text-[var(--text)]">
          {c.name}
        </span>
        <span className="block text-[10px] tabular-nums text-[var(--dim)]">
          {c.printed ? `#${c.printed}` : c.finish ?? ""}
          {shownQty > 0 ? ` · ×${shownQty}` : ""}
        </span>
      </button>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => onOpen(c)}
        aria-label={aria}
        className="block w-full text-left"
      >
        {art}
      </button>
      <span className="mt-1 block truncate text-xs font-medium leading-tight text-[var(--text)]">
        {c.name}
      </span>
      <span className="block text-[11px] tabular-nums text-[var(--dim)]">
        {c.printed ? `#${c.printed}` : ""}
        {c.finish ? ` · ${c.finish}` : ""}
      </span>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={`Remove one copy of ${c.name}`}
          disabled={qty <= 0}
          onClick={() => step(-1)}
          data-dir="minus"
          className="stepper-ring flex h-8 w-8 items-center justify-center rounded-full text-base leading-none disabled:opacity-35"
        >
          −
        </button>
        <span
          className={`text-sm font-semibold tabular-nums text-[var(--text)] ${
            totalOwned === 0 ? "zero-owned" : ""
          }`}
        >
          {totalOwned} owned
        </span>
        <button
          type="button"
          aria-label={`Add one copy of ${c.name}`}
          onClick={() => step(1)}
          data-dir="plus"
          className="stepper-ring flex h-8 w-8 items-center justify-center rounded-full text-base leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Price alerts for one game-catalog item (Anthony, Nov 4,
    2026): creation lives on the item's detail view like every
    other item type, through the same setPriceAlert action —
    the Portfolio Alerts area is the management home. Only
    rendered when the item carries a tracked price; untracked
    items show the plain no-pricing note instead. */
function GameAlertBox({
  gameCardId,
  currentPrice,
}: {
  gameCardId: number;
  currentPrice: number;
}) {
  const queryClient = useQueryClient();
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
  });
  const mine = (alerts.data?.alerts ?? []).filter(
    (a) => a.targetKind === "game" && a.gameCardId === gameCardId,
  );
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [threshold, setThreshold] = useState(currentPrice.toFixed(2));
  const setAlert = useMutation({
    mutationFn: () =>
      api.setPriceAlert({
        targetKind: "game",
        cardId: null,
        sealedName: null,
        comicId: null,
        gameCardId,
        direction,
        threshold: Number(threshold),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const del = useMutation({
    mutationFn: (id: number) => api.deletePriceAlert({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const valid =
    threshold.trim() !== "" &&
    Number.isFinite(Number(threshold)) &&
    Number(threshold) > 0;
  return (
    <div className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left">
      <p className="text-sm font-semibold text-[var(--text)]">Price alert</p>
      <p className="mt-0.5 text-xs text-[var(--dim)]">
        Now {fmtPrice(currentPrice)} — get flagged on Home when it
        crosses your line.
      </p>
      {mine.map((a) => (
        <div
          key={a.id}
          className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--bg)] px-2.5 py-1.5"
        >
          <span className="text-xs text-[var(--text)]">
            {a.direction === "below" ? "At or below" : "At or above"}{" "}
            {fmtPrice(a.threshold)}
            {a.triggered ? (
              <span className="ml-1.5 font-bold text-red-400">triggered</span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label="Delete this price alert"
            disabled={del.isPending}
            onClick={() => del.mutate(a.id)}
            className="text-xs font-semibold text-[var(--dim)] disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ))}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <VxSelect
          ariaLabel="Alert direction"
          value={direction}
          onChange={(v) => setDirection(v as "below" | "above")}
          options={[
            { value: "below", label: "Drops to or below" },
            { value: "above", label: "Rises to or above" },
          ]}
        />
        <span className="flex items-center gap-1 text-sm text-[var(--dim)]">
          $
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-label="Alert price in dollars"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
          />
        </span>
        <button
          type="button"
          disabled={!valid || setAlert.isPending}
          onClick={() => setAlert.mutate()}
          className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {setAlert.isPending ? "Setting…" : "Set alert"}
        </button>
      </div>
      {setAlert.isError ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          That alert didn&rsquo;t save — try again.
        </p>
      ) : null}
    </div>
  );
}

function CardDetailSheet({
  game,
  card,
  onClose,
}: {
  game: GameKey;
  card: DetailCard;
  onClose: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  // Back-gesture trap (Anthony, Nov 4, 2026 — the app-wide
  // rule from his verified-badge report: an open window eats
  // the phone's Back FIRST). This full-screen sheet takes the
  // window's one history entry (three-back rule: layers when a
  // window already holds the slot); the popstate trap closes
  // the sheet when Back pops it, and the on-screen Back button
  // goes through history.back() when this open did the push so
  // the entry is consumed exactly once.
  const pushedRef = useRef(false);
  const heldRef = useRef(false);
  useEffect(() => {
    pushedRef.current = pushWindowState(
      { ...(readNavState() ?? {}), lorcanaGameCard: true },
      "lorcanaGameCard",
    );
    heldRef.current = true;
    const onPopState = () => {
      if (
        heldRef.current &&
        readNavState()?.lorcanaGameCard !== true
      ) {
        heldRef.current = false;
        pushedRef.current = false;
        onClose();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // Unmounted some other way (a section switch) while open:
      // when this open did the push and the entry is still on
      // top, consume it so no stale entry lingers in the stack;
      // a layered open just drops its key in place.
      if (pushedRef.current) {
        pushedRef.current = false;
        heldRef.current = false;
        if (readNavState()?.lorcanaGameCard === true)
          window.history.back();
      } else if (heldRef.current) {
        heldRef.current = false;
        scrubWindowKeys(["lorcanaGameCard"]);
      }
    };
    // Mount-only: one entry per sheet opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeSheet = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      heldRef.current = false;
      scrubWindowKeys(["lorcanaGameCard"]);
      onClose();
    }
  };
  const [owned, setOwned] = useState(card.ownedQty);
  const [sealed, setSealed] = useState(card.ownedSealedQty);
  const isLego = game === "lego";
  const save = useMutation({
    mutationFn: (next: { qty: number; sealedQty?: number }) =>
      api.setGameCardOwned({
        id: card.id,
        ownedQty: next.qty,
        ...(next.sealedQty != null ? { sealedQty: next.sealedQty } : {}),
      }),
    onSuccess: (r) => {
      setOwned(r.ownedQty);
      setSealed(r.ownedSealedQty);
      void queryClient.invalidateQueries({
        queryKey: ["gameCatalog", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSection", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSearch", game],
      });
    },
  });
  const step = (qty: number) => {
    const next = Math.max(0, Math.min(999, qty));
    setOwned(next);
    save.mutate({ qty: next });
  };
  const stepSealed = (qty: number) => {
    const next = Math.max(0, Math.min(999, qty));
    setSealed(next);
    save.mutate({ qty: owned, sealedQty: next });
  };
  const totalOwned = owned + (isLego ? sealed : 0);
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} — ${GAME_TITLES[game]}`}
    >
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={closeSheet}
          aria-label="Back"
          className="flex h-10 items-center gap-0.5 rounded-full bg-white/[0.07] py-0 pr-3.5 pl-2 text-sm font-semibold text-[var(--text)] ring-1 ring-white/15 transition active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M14.5 5.5 8 12l6.5 6.5" />
          </svg>
          {t("game.back")}
        </button>
        <div className="mt-4 flex flex-col items-center">
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={`${card.name} card artwork`}
              className={`w-64 max-w-full rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] ${
                totalOwned === 0 ? "opacity-50 grayscale-[30%]" : ""
              }`}
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-[3/4] w-64 max-w-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 text-center text-sm text-[var(--dim)]">
              No artwork link from the source for this printing
            </div>
          )}
          <h2 className="font-album mt-4 text-center text-xl leading-tight text-[var(--text)]">
            {card.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            {card.sectionName}
            {card.printed ? ` · #${card.printed}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            {[card.rarity, card.finish].filter(Boolean).join(" · ") ||
              " "}
          </p>
          {card.price != null ? (
            <p className="mt-2 text-base font-semibold text-[var(--gold-soft)]">
              {fmtPrice(card.price)}
            </p>
          ) : null}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--dim)]">
              {isLego ? "Opened copies" : t("game.copiesOwned")}
            </span>
            <button
              type="button"
              aria-label="Remove one copy"
              disabled={owned <= 0 || save.isPending}
              onClick={() => step(owned - 1)}
              data-dir="minus"
              className="stepper-ring flex h-8 w-8 items-center justify-center rounded-full text-base font-bold disabled:opacity-40"
            >
              −
            </button>
            <span
              className={`min-w-8 text-center text-lg font-bold tabular-nums text-[var(--text)] ${
                owned === 0 ? "zero-owned" : ""
              }`}
            >
              {owned}
            </span>
            <button
              type="button"
              aria-label="Add one copy"
              disabled={save.isPending}
              onClick={() => step(owned + 1)}
              data-dir="plus"
              className="stepper-ring flex h-8 w-8 items-center justify-center rounded-full text-base font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
          {isLego ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--dim)]">
                Sealed copies
              </span>
              <button
                type="button"
                aria-label="Remove one sealed copy"
                disabled={sealed <= 0 || save.isPending}
                onClick={() => stepSealed(sealed - 1)}
                data-dir="minus"
                className="stepper-ring flex h-8 w-8 items-center justify-center rounded-full text-base font-bold disabled:opacity-40"
              >
                −
              </button>
              <span
                className={`min-w-8 text-center text-lg font-bold tabular-nums text-[var(--text)] ${
                  sealed === 0 ? "zero-owned" : ""
                }`}
              >
                {sealed}
              </span>
              <button
                type="button"
                aria-label="Add one sealed copy"
                disabled={save.isPending}
                onClick={() => stepSealed(sealed + 1)}
                data-dir="plus"
                className="stepper-ring flex h-8 w-8 items-center justify-center rounded-full text-base font-bold disabled:opacity-40"
              >
                +
              </button>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-[var(--dim)]">
            {totalOwned === 0
              ? t("game.missingGhosted")
              : t("game.inCollection")}
          </p>
          {/* Watch + price alert (Anthony, Nov 4, 2026): any
              cataloged item can be watched; alerts exist only
              where a price is actually tracked, and the view
              says so plainly when it isn't. */}
          <div className="mt-4 flex w-full max-w-sm flex-col items-center">
            <WatchToggleButton
              targetKind="game"
              cardId={null}
              sealedName={null}
              gameCardId={card.id}
            />
            {card.price != null ? (
              <GameAlertBox gameCardId={card.id} currentPrice={card.price} />
            ) : (
              <p className="mt-3 max-w-xs text-center text-xs leading-relaxed text-[var(--dim)]">
                Pricing isn&rsquo;t tracked for this item yet, so it
                can&rsquo;t be alerted — no price source (TCGplayer
                or eBay sold) covers it today. Watching still works.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GamePanel({
  game,
  onScan,
  embedded = false,
}: {
  game: GameKey;
  /** Opens the app's card scanner (the section top row's
      Scan pill, Nov 3, 2026). */
  onScan?: () => void;
  /** Embedded inside another section shell (the Lego
      panel's Sets area): the shell carries the page title
      and source line, so the panel skips its own. */
  embedded?: boolean;
}) {
  const t = useT();
  const noun = gameNoun(game);
  const unit = gameUnit(game);
  const queryClient = useQueryClient();
  // Grid density for this set page (shared per-user choice).
  const gridCols = useGridCols();
  const catalog = useQuery({
    queryKey: ["gameCatalog", game],
    queryFn: () => api.getGameCatalog({ game }),
  });
  // A Library spine (or any deep link) can ask for one
  // section up front: the key rides in sessionStorage so a
  // refresh of the section view restores the same section
  // instead of bouncing to the list.
  const [sectionKey, setSectionKey] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(
        `vaultx-game-open-section:${game}`,
      );
    } catch {
      return null;
    }
  });
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<DetailCard | null>(null);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const section = useQuery({
    queryKey: ["gameSection", game, sectionKey, offset],
    queryFn: () =>
      api.getGameSection({
        game,
        sectionKey: sectionKey ?? "",
        offset,
      }),
    enabled: sectionKey != null,
  });
  // Keep the deep-link key in step with the section actually
  // open, so it restores the current section on refresh and
  // never reopens a stale one.
  useEffect(() => {
    try {
      if (sectionKey) {
        window.sessionStorage.setItem(
          `vaultx-game-open-section:${game}`,
          sectionKey,
        );
      } else {
        window.sessionStorage.removeItem(
          `vaultx-game-open-section:${game}`,
        );
      }
    } catch {
      // Private mode: the list is the fallback.
    }
  }, [game, sectionKey]);
  const search = useQuery({
    queryKey: ["gameSearch", game, query.trim()],
    queryFn: () =>
      api.searchGameCards({ game, query: query.trim() }),
    enabled: query.trim().length >= 2,
  });

  const runImport = async () => {
    if (importing) return;
    setImporting(true);
    setImportNote(null);
    try {
      for (let i = 0; i < 60; i++) {
        const r = await api.importGameCatalog({ game });
        void queryClient.invalidateQueries({
          queryKey: ["gameCatalog", game],
        });
        if (!r.ok) {
          setImportNote(r.message);
          break;
        }
        if (r.complete) {
          setImportNote(
            `Catalog complete — ${r.cardsTotal.toLocaleString()} ${noun}.`,
          );
          break;
        }
        if (i === 59) {
          setImportNote(
            "Still downloading — progress is saved; tap Continue to keep going.",
          );
        }
      }
    } catch {
      setImportNote(
        "The download stopped — progress is saved; tap Continue to resume.",
      );
    } finally {
      setImporting(false);
      void queryClient.invalidateQueries({
        queryKey: ["gameCatalog", game],
      });
    }
  };

  const data = catalog.data;
  const searching = query.trim().length >= 2;

  return (
    <div className="mt-5 pb-2">
      {embedded ? null : (
        <>
          <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
            {GAME_TITLES[game]}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            {GAME_SOURCE_LINES[game]}
          </p>
        </>
      )}

      {/* Catalog download state — honest progress, always. */}
      {data && !data.complete ? (
        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">
            {data.started
              ? t("game.downloadInProgress")
              : t("game.downloadNotStarted")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            {data.cardsTotal > 0
              ? `${data.cardsTotal.toLocaleString()} ${noun} cataloged so far${
                  data.setsTotal > 0
                    ? ` — ${data.setsDone.toLocaleString()} of ${data.setsTotal.toLocaleString()} ${unit}`
                    : ""
                }. The download runs in chunks and resumes where it stopped.`
              : "Sets and cards appear here as the download lands."}
          </p>
          <button
            type="button"
            onClick={() => void runImport()}
            disabled={importing}
            className="mt-3 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
          >
            {importing
              ? t("game.downloading")
              : data.started
                ? t("game.continueDownload")
                : t("game.downloadCatalog")}
          </button>
          {importNote ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]" role="status">
              {importNote}
            </p>
          ) : null}
        </div>
      ) : null}
      {data?.complete ? (
        <p className="mt-2 text-xs text-[var(--dim)]">
          {data.cardsTotal.toLocaleString()} {noun} cataloged ·{" "}
          {data.ownedTotal.toLocaleString()} copies owned
          {importNote ? ` · ${importNote}` : ""}
        </p>
      ) : null}

      {/* Search + Scan row (Anthony, Nov 3, 2026, ~11:14 PM):
          the same top row every collection section carries —
          the add-by-search bar in the Scan pill's theme with
          its magnifier, the Scan pill at the top right. The
          bar searches THIS game's catalog (name + number
          honing, as before). */}
      <div className="mt-4">
        <SearchScanRow
          inputId={`game-search-${game}`}
          label={`Search ${GAME_TITLES[game]} cards by name or name and number`}
          placeholder="Search by name, or name + number…"
          value={query}
          onChange={setQuery}
          onScan={onScan}
        />
      </div>
      {searching ? (
        <div className="mt-3">
          {search.isPending ? (
            <p className="text-sm text-[var(--dim)]">{t("game.searching")}</p>
          ) : (search.data?.results ?? []).length === 0 ? (
            <p className="text-sm text-[var(--dim)]">
              No printings match yet — if the catalog is still
              downloading, they may not have landed.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
              {(search.data?.results ?? []).map((r: SearchCard) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setDetail({
                        id: r.id,
                        name: r.name,
                        printed: r.printed,
                        sectionName: r.sectionName,
                        rarity: r.rarity,
                        finish: r.finish,
                        imageUrl: r.imageUrl,
                        price: r.price,
                        ownedQty: r.ownedQty,
                        ownedSealedQty: r.ownedSealedQty,
                      })
                    }
                    aria-label={`${r.name}, ${r.sectionName} number ${r.printed}`}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    {r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        loading="lazy"
                        className={`h-14 w-10 shrink-0 rounded object-cover ${
                          r.ownedQty === 0
                            ? "opacity-40 grayscale-[40%]"
                            : ""
                        }`}
                      />
                    ) : (
                      <span className="h-14 w-10 shrink-0 rounded bg-[var(--bg)]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {r.name}
                      </span>
                      <span className="block text-xs text-[var(--dim)]">
                        {r.sectionName}
                        {r.printed ? ` · #${r.printed}` : ""}
                        {r.price != null
                          ? ` · ${fmtPrice(r.price)}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        r.ownedQty > 0
                          ? "text-[var(--gold-soft)]"
                          : "text-[var(--dim)]"
                      }`}
                    >
                      {r.ownedQty > 0
                        ? `Owned ×${r.ownedQty}`
                        : "Missing"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Sets list, or one set's grid. */}
      {!searching && sectionKey == null ? (
        catalog.isPending ? (
          <p className="mt-4 text-sm text-[var(--dim)]">
            {t("game.loadingSets")}
          </p>
        ) : (data?.sections ?? []).length === 0 ? (
          <p className="mt-4 rounded-xl bg-[var(--surface)] px-3 py-3 text-sm leading-relaxed text-[var(--dim)]">
            No sets yet — the catalog download above brings them
            in.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4">
            {(data?.sections ?? []).map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => {
                    setSectionKey(s.key);
                    setOffset(0);
                  }}
                  aria-label={`Open ${s.name}`}
                  className="flex w-full items-center gap-2 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text)]">
                      {s.name}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      {s.total.toLocaleString()} {noun}
                      {s.owned > 0
                        ? ` · ${s.owned.toLocaleString()} owned`
                        : ""}
                    </span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-lg text-[var(--dim)]">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {!searching && sectionKey != null ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSectionKey(null)}
            aria-label={`Back to ${GAME_TITLES[game]} sets`}
            className="flex h-10 items-center gap-0.5 rounded-full bg-white/[0.07] py-0 pr-3.5 pl-2 text-sm font-semibold text-[var(--text)] ring-1 ring-white/15 transition active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M14.5 5.5 8 12l6.5 6.5" />
            </svg>
            {t("game.allSets")}
          </button>
          <div className="mt-3 flex items-center justify-between gap-2">
            <h2 className="font-album min-w-0 truncate text-lg text-[var(--text)]">
              {section.data?.sectionName ?? ""}
            </h2>
            <GridColsToggle />
          </div>
          {section.isPending ? (
            <p className="mt-3 text-sm text-[var(--dim)]">
              {t("game.loadingCards")}
            </p>
          ) : (
            <>
              <div
                className={`mt-3 grid gap-2.5 ${
                  gridCols === 2 ? "grid-cols-2" : "grid-cols-4"
                }`}
              >
                {(section.data?.cards ?? []).map((c: SectionCard) => (
                  <GameGridTile
                    key={c.id}
                    game={game}
                    c={c}
                    cols={gridCols}
                    onOpen={(card) =>
                      setDetail({
                        id: card.id,
                        name: card.name,
                        printed: card.printed,
                        sectionName:
                          section.data?.sectionName ?? "",
                        rarity: card.rarity,
                        finish: card.finish,
                        imageUrl: card.imageUrl,
                        price: card.price,
                        ownedQty: card.ownedQty,
                        ownedSealedQty: card.ownedSealedQty,
                      })
                    }
                  />
                ))}
              </div>
              {section.data &&
              offset + (section.data.cards.length ?? 0) <
                section.data.total ? (
                <button
                  type="button"
                  onClick={() =>
                    setOffset(
                      offset + (section.data?.cards.length ?? 0),
                    )
                  }
                  className="mt-4 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
                >
                  Load more ({section.data.total.toLocaleString()}{" "}
                  in this set)
                </button>
              ) : null}
              {offset > 0 ? (
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="mt-2 w-full rounded-full px-4 py-2 text-sm text-[var(--dim)]"
                >
                  Back to the start of the set
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {detail ? (
        <CardDetailSheet
          game={game}
          card={detail}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
