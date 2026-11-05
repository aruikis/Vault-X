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

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
useMutation,
useQuery,
useQueryClient,
type QueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { fmtMoneyUSD, useT } from "./i18n";
import { SearchScanRow } from "./searchScanRow";
import {
  GradedSlabsBox,
  SlabCapturePanel,
  SlabDetailView,
  type GradedCardPick,
  type GradedSlab,
} from "./gradedScan";
import {
  CutoutImg,
  getProxiedUrl,
  useCutoutState,
} from "./cutoutImg";
import { Turntable } from "./turntable";
import { OwnedLocationBar } from "./whereItLives";
import { WatchToggleButton } from "./portfolioTools";
import { VxSelect } from "./vxSelect";
import {
GridColsToggle,
useGridCols,
type GridCols,
} from "./gridCols";
import {
  ONLY_MINE_ALWAYS,
  ONLY_MINE_THRESHOLD,
  OnlyMineToggle,
  useOnlyMine,
} from "./onlyMine";
import {
  pushWindowState,
  readNavState,
  replaceNavState,
  scrubWindowKeys,
  useWindowHistory,
} from "./historyNav";

export type GameKey =
  | "pokemon"
  | "magic"
  | "starwars"
  | "funko"
  | "lego"
  | "topps"
  | "bowman"
  | "topps-basketball"
  | "disney-topps"
  | "starwars-topps"
  | "gpk"
  | "wwe-topps";

export const GAME_TITLES: Record<GameKey, string> = {
  pokemon: "Pokémon",
  magic: "Magic: The Gathering",
  starwars: "Star Wars Unlimited",
  funko: "Funko Pop!",
  lego: "Legos",
  topps: "Topps Baseball",
  bowman: "Bowman Baseball",
  "topps-basketball": "Topps Basketball",
  "disney-topps": "Disney Topps",
  "starwars-topps": "Star Wars Topps",
  gpk: "Garbage Pail Kids",
  "wwe-topps": "WWE Topps",
};

/** The Topps sports catalogs are data-only (Anthony, Nov 4,
    2026): rows carry number, player, team, and subset from
    Topps' official checklists — no artwork exists for them
    anywhere in the app, by his direction. */
export function gameIsDataOnly(game: GameKey): boolean {
  return (
    game === "topps" ||
    game === "bowman" ||
    game === "topps-basketball" ||
    game === "disney-topps" ||
    game === "starwars-topps" ||
    game === "gpk" ||
    game === "wwe-topps"
  );
}

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
    "Catalog: Rebrickable's official bulk Lego data (sets and themes) — every set with its number, theme, year, piece count, and set image. That source publishes no prices and no per-set minifigure counts; open a set for its researched facts, minifigures, and market data, each labeled with its source.",
  topps:
    "Catalog: Topps' own official baseball checklists (topps.com) — every Topps-branded baseball product, 2018–2026, card by card: number, player, team, and subset. (Bowman baseball lives in its own tab.) Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
  bowman:
    "Catalog: Topps' own official baseball checklists (topps.com) — every Bowman-branded baseball product, card by card: number, player, team, and subset. Bowman is a Topps brand; it gets its own tab because collectors sort by the name on the card. Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
  "topps-basketball":
    "Catalog: Topps' own official basketball checklists (topps.com) — every Topps and Bowman basketball product, card by card: number, player, team, and subset. Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
  "disney-topps":
    "Catalog: Topps' own official Disney checklists (topps.com) — Topps Chrome Disney, Disney Sapphire, Disney Neon, Mint Disney, and the rest of Topps' Disney card releases, card by card. Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
  "starwars-topps":
    "Catalog: Topps' own official Star Wars checklists (topps.com) — Masterwork, Chrome, Galaxy, and the rest of Topps' Star Wars card releases, card by card. These are Topps collectible cards, separate from Star Wars Unlimited. Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
  gpk:
    "Catalog: Topps' own official Garbage Pail Kids checklists (topps.com) — every Garbage Pail Kids release Topps publishes a checklist for, card by card. Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
  "wwe-topps":
    "Catalog: Topps' own official WWE checklists (topps.com) — Chrome WWE, Finest WWE, Royalty, and the rest of Topps' WWE card releases, card by card. Data only: no artwork is downloaded, and the checklists publish no prices, so none are shown.",
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

/** A catalog image that can never show a broken-image icon
    (Anthony, Nov 4, 2026 — the Funko catalog is full of dead
    hobbydb links): if the source file fails to load, the
    image swaps for the same clean styled placeholder the
    no-artwork rows use. The catalog's own audit counts the
    dead links; this component is the guarantee that none of
    them ever renders as a torn picture. */
function SafeImg({
  src,
  alt,
  className,
  placeholderText,
}: {
  src: string;
  alt: string;
  className?: string;
  placeholderText: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed) {
    return (
      <span
        className={`flex items-center justify-center border border-dashed border-[var(--border)] bg-[var(--surface)] px-1 text-center text-[10px] text-[var(--dim)] ${className ?? ""}`}
        aria-label={alt}
        role="img"
      >
        {placeholderText}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/** One set-page grid tile. At the default two-across
    density (Anthony, Nov 4, 2026) it carries the same
    on-grid count stepper as the Lorcana pockets — big
    round − / + buttons saving through setGameCardOwned on
    every tap, so copies can be added while cataloging
    without opening each card; at four-across it is the
    plain tap-to-open tile it has always been. */
/** Grid art for catalog tiles (Anthony, Nov 5, 2026 — the
    Funko load fix): a tile in a big catalog grid must NOT
    run the full cutout pipeline — the old per-tile matte
    meant every one of a page's 150 tiles downloaded its
    photo, tried a canvas matte, fell back to a server-proxy
    fetch and a second matte, all on the main thread, which
    is what made the Funko section take forever to open.
    Grid art is now just the photo itself, lazy-loaded as
    the tile nears the viewport with async decoding, and a
    single proxied-copy rescue if the source host refuses
    the load. The full cutout treatment still runs where a
    figure is the focus: its detail page and the owned
    shelf. */
function GridArtImg({
  src,
  proxyId,
  className,
  placeholderText,
}: {
  src: string;
  proxyId?: number | null;
  className?: string;
  placeholderText: string;
}) {
  const [shown, setShown] = useState(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setShown(src);
    setFailed(false);
  }, [src]);
  if (failed) {
    return (
      <span
        className={`flex items-center justify-center border border-dashed border-[var(--border)] bg-black/20 px-1 text-center text-[10px] text-[var(--dim)] ${className ?? ""}`}
        role="img"
        aria-label=""
      >
        {placeholderText}
      </span>
    );
  }
  return (
    <img
      src={shown}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (shown === src && proxyId != null) {
          void getProxiedUrl(proxyId).then((u) => {
            if (u) setShown(u);
            else setFailed(true);
          });
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

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
      void queryClient.invalidateQueries({
        queryKey: ["gameOwnedItems", game],
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
    game === "funko" ? (
      /* Funko grid tile: the figure's photo, lazy-loaded
          (see GridArtImg — Nov 5, 2026 load fix; the
          per-tile cutout matte moved to the detail page
          and owned shelf, where the figure is the focus).
          The other games keep their framed cover art. */
      <GridArtImg
        src={c.imageUrl}
        placeholderText="Image unavailable"
        proxyId={c.id}
        className={`aspect-[3/4] w-full object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)] ${
          shownQty === 0 ? "opacity-35 grayscale-[45%]" : ""
        }`}
      />
    ) : (
      <SafeImg
        src={c.imageUrl}
        alt=""
        placeholderText="Image unavailable"
        className={`aspect-[3/4] w-full rounded-lg object-cover ${
          shownQty === 0 ? "opacity-35 grayscale-[45%]" : ""
        }`}
      />
    )
  ) : (
    <span
      className={`flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-1 text-center text-[10px] text-[var(--dim)] ${
        shownQty === 0 ? "opacity-60" : ""
      }`}
    >
      {gameIsDataOnly(game) ? "Data only · no artwork" : "No artwork link"}
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

/** Funko market box (Anthony, Nov 4, 2026): the item's
    Financial view, treated like the cards — value history
    over time built from eBay SOLD listings (the authority
    for Funko), with the current sold-based values by
    condition and the recorded history points. Where no sold
    data exists for a figure, it says so plainly; a value is
    never invented and asking prices never appear here. */
/* ---- Funko figure detail (Anthony, Nov 5, 2026 — the
   template standard he named): the figure pages are rebuilt
   on the LEGO set detail template, the presentation the TIE
   Fighter page passed his check with — the blurred photo
   backdrop and floating cut-out hero above (in the sheet),
   then this block: the same segmented tab bar (Figure
   details / Financial), headline stat tiles, facts as dark
   inset rows, the Your copy block arranged like the card
   pages' "In your collection" block with the stepper inside
   it, and every number on the Financial tab — including the
   verified eBay sold market and its recorded value history,
   carried over whole from the old inline market box. No
   Funko data is dropped; only the presentation changed. */
function FunkoFigureDetail({
  card,
  owned,
  onStep,
  savePending,
}: {
  card: DetailCard;
  owned: number;
  /** The sheet's owned-count stepper, rendered here inside
      the Your copy block (the Lego/card pages' placement). */
  onStep: (qty: number) => void;
  savePending: boolean;
}) {
  const [tab, setTab] = useState<"details" | "financial">("details");
  const market = useQuery({
    queryKey: ["gameCardMarket", card.id],
    queryFn: () => api.getGameCardMarket({ id: card.id }),
  });
  const data = market.data;
  const snap = data?.snapshot ?? null;
  const history = data?.history ?? [];
  const values = history.map((p) => p.unitValue);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min;
  return (
    <div className="mt-5 w-full text-left">
      <div
        className="flex rounded-full border border-white/12 bg-black/35 p-1"
        role="group"
        aria-label="Funko figure detail views"
      >
        {(
          [
            { key: "details", label: "Figure details" },
            { key: "financial", label: "Financial" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3.5 py-1.5 text-sm ${
              tab === t.key
                ? "bg-[var(--gold)] font-bold text-black"
                : "text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <LegoStatTile label="Number" value={card.printed || null} />
            <LegoStatTile label="Rarity" value={card.rarity || null} />
            <LegoStatTile label="Finish" value={card.finish || null} />
          </dl>

          <LegoSectionTitle title="Figure facts" />
          <dl className="mt-2 space-y-1.5">
            <LegoFactRow label="Number" value={card.printed || null} />
            <LegoFactRow label="Series" value={card.sectionName || null} />
            <LegoFactRow label="Rarity" value={card.rarity || null} />
            <LegoFactRow label="Finish" value={card.finish || null} />
          </dl>

          {/* Your copy, in the same arrangement as the Lego
              and card pages: the album heading with the owned
              count in gold beside it, then the Where it lives
              bar carrying the copies stepper inside it. */}
          <div className="mt-5 border-t border-white/12 pt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-album text-base text-[var(--text)]">
                Your copy
              </h3>
              <span
                className={`text-sm font-semibold ${
                  owned > 0 ? "text-[var(--gold-soft)]" : "text-red-400"
                }`}
              >
                {owned > 0
                  ? `${owned} cop${owned === 1 ? "y" : "ies"}`
                  : "Don’t own"}
              </span>
            </div>
            <div className="mt-3">
              <OwnedLocationBar
                targetKind="game"
                cardId={null}
                sealedName={null}
                comicId={null}
                gameCardId={card.id}
                ownedQty={owned}
                copiesQty={owned}
                copiesItemName={card.name}
                barClassName="bg-[var(--surface)]"
              >
                <div className="space-y-1.5">
                  <LegoStepperRow
                    label="Copies"
                    qty={owned}
                    onStep={onStep}
                    savePending={savePending}
                    itemName={card.name}
                  />
                </div>
              </OwnedLocationBar>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Watch + price alert live on the Financial tab,
              exactly as on the Lego pages. */}
          <div className="mt-4 flex w-full flex-col items-center">
            <WatchToggleButton
              targetKind="game"
              cardId={null}
              sealedName={null}
              gameCardId={card.id}
            />
            {card.price != null ? (
              <GameAlertBox gameCardId={card.id} currentPrice={card.price} />
            ) : null}
          </div>

          <LegoSectionTitle title="Market — eBay sold" />
          {market.isPending ? (
            <p className="mt-2 text-sm text-[var(--dim)]">
              Loading market data…
            </p>
          ) : snap ? (
            <>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                <LegoStatTile
                  label="Out of box"
                  value={fmtPrice(snap.outOfBox)}
                />
                <LegoStatTile label="In box" value={fmtPrice(snap.inBox)} />
                <LegoStatTile label="New" value={fmtPrice(snap.newSealed)} />
              </dl>
              <dl className="mt-2 space-y-1.5">
                {card.price != null ? (
                  <LegoFactRow
                    label="Listed price"
                    value={fmtPrice(card.price)}
                  />
                ) : null}
                {owned > 0 && snap.inBox != null ? (
                  <LegoFactRow
                    label="Your copies are worth"
                    value={fmtPrice(snap.inBox * owned)}
                  />
                ) : null}
              </dl>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">
                Last sold values from completed eBay sales, as of{" "}
                {snap.snapshotDate} (via{" "}
                <a
                  href={snap.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  PriceCharting
                </a>
                ). Asking prices never count.
              </p>
              {history.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
                    Value history (in box)
                  </p>
                  {history.length > 1 ? (
                    <svg
                      viewBox="0 0 100 28"
                      className="mt-1 h-8 w-full"
                      role="img"
                      aria-label={`Value history: ${history.length} recorded points from ${fmtPrice(values[0] ?? 0)} to ${fmtPrice(values[values.length - 1] ?? 0)}`}
                    >
                      <polyline
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.6"
                        points={history
                          .map((p, i) => {
                            const x =
                              history.length > 1
                                ? (i / (history.length - 1)) * 98 + 1
                                : 50;
                            const y =
                              span > 0
                                ? 25 - ((p.unitValue - min) / span) * 22
                                : 14;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(" ")}
                      />
                    </svg>
                  ) : null}
                  <ul className="mt-1 space-y-0.5">
                    {[...history].reverse().slice(0, 6).map((p) => (
                      <li
                        key={`${p.date}-${p.source}`}
                        className="flex items-center justify-between text-xs text-[var(--dim)]"
                      >
                        <span>{p.date}</span>
                        <span className="font-semibold text-[var(--text)]">
                          {fmtPrice(p.unitValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-[var(--dim)]">
                    Recorded daily from here on, the same cadence as
                    your cards&rsquo; re-pricing.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              No recent sales recorded for this figure yet — when
              eBay sold data is recorded for it, its value history
              will build here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Lego set detail (Anthony, Nov 4, 2026 — the Lego
   detail build-out, to the card/Funko standard): two tabs.
   REFORMATTED the same night (Anthony's live review: the
   information was right, the format looked generic and
   unfinished): the page now wears the Lorcana CARD detail
   presentation — a blurred blow-up of the set's own photo
   as the backdrop, the hero floating cut-out over it (or
   in the themed frame when it won't cut out), the card
   pages' segmented tab bar, headline stat tiles, facts and
   figures as dark inset rows/sections (no plain ruled
   lists anywhere), and the Your copy block arranged like
   the card's "In your collection" block with the steppers
   and Where it lives inside it. Every v1.86.0 field is
   kept; only the presentation changed. The sheet's header
   steppers/watch/alert moved into these blocks (watch and
   alerts on the Financial tab, like the card pages).
   Set details carries the product facts the Lego tracking
   sources publish (Brickset / BrickLink / BrickEconomy /
   Rebrickable / Brickfact), the minifigures & parts
   breakdown, the official description, and the Your copy
   ownership block. Financial carries retail vs sealed/used
   market values, growth, the value history chart, real sold
   listings with dates and sources, part-out value, and
   current retailer prices. Researched data arrives through
   researchLegoSet -> saveLegoSetResearch; a set with no
   research yet says so plainly and offers the research —
   fields are NEVER filled with invented numbers. */

type LegoDetailData = ApiResponse<typeof api, "getLegoSetDetail">;
type LegoNotesData = NonNullable<LegoDetailData["notes"]>;

const LEGO_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtLegoDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = LEGO_MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

const LEGO_CONDITION_OPTIONS = [
  { value: "new_sealed", label: "New & sealed" },
  { value: "built_complete", label: "Built — complete" },
  { value: "built_incomplete", label: "Built — incomplete" },
  { value: "in_pieces", label: "In pieces / unbuilt" },
];
const LEGO_CONDITION_LABELS: Record<string, string> = Object.fromEntries(
  LEGO_CONDITION_OPTIONS.map((o) => [o.value, o.label]),
);
const LEGO_COMPLETENESS_OPTIONS = [
  { value: "complete", label: "Complete — every piece" },
  { value: "missing_pieces", label: "Missing pieces" },
  { value: "unknown", label: "Not checked yet" },
];
const LEGO_COMPLETENESS_LABELS: Record<string, string> =
  Object.fromEntries(
    LEGO_COMPLETENESS_OPTIONS.map((o) => [o.value, o.label]),
  );

/**
 * One fact in the card pages' inset-row style (Anthony,
 * Nov 4, 2026, late — the Lego detail reformat): a dark
 * inset box with the label quiet on the left and the value
 * on the right, stacked with gaps — never a plain ruled
 * list. An unrecorded fact reads "Unavailable" in the dim
 * style, as before.
 */
function LegoFactRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-black/30 px-3 py-2">
      <dt className="shrink-0 text-xs font-medium text-[var(--dim)]">
        {label}
      </dt>
      <dd
        className={`text-right text-sm ${
          value
            ? "font-semibold text-[var(--text)]"
            : "text-xs font-normal text-[var(--dim)]"
        }`}
      >
        {value ?? "Unavailable"}
      </dd>
    </div>
  );
}

/** A copies stepper row in the card detail's finish-row
    style: the label on the left, − count + on the right,
    on a dark inset row. Used for a Lego set's opened and
    sealed counts inside the Your copy block. */
function LegoStepperRow({
  label,
  qty,
  onStep,
  savePending,
  itemName,
}: {
  label: string;
  qty: number;
  onStep: (qty: number) => void;
  savePending: boolean;
  itemName: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-1.5">
      <span className="flex h-8 items-center text-sm leading-none text-[var(--text)]">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Remove one ${label.toLowerCase()} copy of ${itemName}`}
          disabled={qty <= 0 || savePending}
          onClick={() => onStep(qty - 1)}
          data-dir="minus"
          className="stepper-ring flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold disabled:opacity-40"
        >
          −
        </button>
        <span
          className={`w-6 text-center text-sm font-semibold leading-none tabular-nums text-[var(--text)] ${
            qty === 0 ? "zero-owned" : ""
          }`}
        >
          {qty}
        </span>
        <button
          type="button"
          aria-label={`Add one ${label.toLowerCase()} copy of ${itemName}`}
          disabled={savePending}
          onClick={() => onStep(qty + 1)}
          data-dir="plus"
          className="stepper-ring flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold disabled:opacity-40"
        >
          +
        </button>
      </span>
    </div>
  );
}

/** A headline stat tile, mirroring the card detail's
    three-across stat grid: small uppercase label over the
    value, on a dark inset tile. */
function LegoStatTile({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg bg-black/30 px-2 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
        {label}
      </dt>
      <dd
        className={`mt-0.5 ${
          value
            ? "font-semibold text-[var(--text)]"
            : "text-sm font-normal text-[var(--dim)]"
        }`}
      >
        {value ?? "Unavailable"}
      </dd>
    </div>
  );
}

/** A section heading in the card pages' voice: the album
    face, with an optional quiet line under it. */
function LegoSectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="font-album text-base text-[var(--text)]">{title}</h3>
      {children}
    </div>
  );
}

/** The Your copy notes editor: paid price, condition,
    completeness, missing pieces. Local state is the
    in-flight typing only; the parent keys this component by
    the saved values, so a save (or a research landing)
    re-seeds the fields from the server truth. */
function LegoNotesEditor({
  cardId,
  cardName,
  notes,
}: {
  cardId: number;
  cardName: string;
  notes: LegoNotesData | null;
}) {
  const queryClient = useQueryClient();
  const [paid, setPaid] = useState(
    notes?.paidPriceUsd != null ? String(notes.paidPriceUsd) : "",
  );
  const [condition, setCondition] = useState(notes?.condition ?? "");
  const [completeness, setCompleteness] = useState(
    notes?.completeness ?? "",
  );
  const [missing, setMissing] = useState(
    notes?.missingPieces != null ? String(notes.missingPieces) : "",
  );
  const save = useMutation({
    mutationFn: () =>
      api.setLegoOwnershipNotes({
        id: cardId,
        paidPriceUsd:
          paid.trim() !== "" && Number.isFinite(Number(paid))
            ? Number(paid)
            : null,
        condition: (condition || null) as
          | "new_sealed"
          | "built_complete"
          | "built_incomplete"
          | "in_pieces"
          | null,
        completeness: (completeness || null) as
          | "complete"
          | "missing_pieces"
          | "unknown"
          | null,
        missingPieces:
          missing.trim() !== "" && Number.isFinite(Number(missing))
            ? Math.max(0, Math.floor(Number(missing)))
            : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["legoSetDetail", cardId],
      });
    },
  });
  return (
    <div className="mt-3 rounded-xl bg-black/30 p-3">
      <p className="text-xs font-semibold text-[var(--text)]">
        Your record for this set
      </p>
      <label className="mt-2.5 block text-[11px] font-medium text-[var(--dim)]">
        What you paid (per copy, $)
        <input
          type="text"
          inputMode="decimal"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          placeholder="Not recorded"
          aria-label={`What you paid per copy of ${cardName}, in dollars`}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text)]"
        />
      </label>
      <div className="mt-2.5">
        <span className="block text-[11px] font-medium text-[var(--dim)]">
          Condition
        </span>
        <div className="mt-1">
          <VxSelect
            value={condition}
            onChange={setCondition}
            options={[
              { value: "", label: "Not recorded" },
              ...LEGO_CONDITION_OPTIONS,
            ]}
            ariaLabel={`Condition of your ${cardName}`}
          />
        </div>
      </div>
      <div className="mt-2.5">
        <span className="block text-[11px] font-medium text-[var(--dim)]">
          Completeness
        </span>
        <div className="mt-1">
          <VxSelect
            value={completeness}
            onChange={setCompleteness}
            options={[
              { value: "", label: "Not recorded" },
              ...LEGO_COMPLETENESS_OPTIONS,
            ]}
            ariaLabel={`Completeness of your ${cardName}`}
          />
        </div>
      </div>
      {completeness === "missing_pieces" ? (
        <label className="mt-2.5 block text-[11px] font-medium text-[var(--dim)]">
          Pieces missing
          <input
            type="text"
            inputMode="numeric"
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            placeholder="How many?"
            aria-label={`How many pieces of ${cardName} are missing`}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text)]"
          />
        </label>
      ) : null}
      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate()}
        className="mt-3 w-full rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save your record"}
      </button>
      {save.isError ? (
        <p className="mt-2 text-xs text-red-400" role="alert">
          That didn&rsquo;t save — try again.
        </p>
      ) : null}
    </div>
  );
}

function LegoSetDetail({
  card,
  opened,
  sealed,
  onStepOpened,
  onStepSealed,
  savePending,
}: {
  card: DetailCard;
  opened: number;
  sealed: number;
  /** The sheet's owned-count steppers, rendered here inside
      the Your copy block (the card pages' placement). */
  onStepOpened: (qty: number) => void;
  onStepSealed: (qty: number) => void;
  savePending: boolean;
}) {
  const [tab, setTab] = useState<"details" | "financial">("details");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [researchStarted, setResearchStarted] = useState(false);
  const detail = useQuery({
    queryKey: ["legoSetDetail", card.id],
    queryFn: () => api.getLegoSetDetail({ id: card.id }),
  });
  const research = useMutation({
    mutationFn: () => api.researchLegoSet({ id: card.id }),
    onSuccess: (r) => {
      if (r.started) setResearchStarted(true);
    },
  });
  const data = detail.data;
  const d = data?.details ?? null;
  const notes = data?.notes ?? null;
  const facts = data?.facts;
  const history = data?.history ?? [];
  const totalOwned = opened + sealed;
  const pricePerPiece =
    d?.retailPriceUsd != null && facts?.pieces
      ? d.retailPriceUsd / facts.pieces
      : null;
  const growthPct =
    d?.marketSealedUsd != null &&
    d?.retailPriceUsd != null &&
    d.retailPriceUsd > 0
      ? ((d.marketSealedUsd - d.retailPriceUsd) / d.retailPriceUsd) *
        100
      : null;
  const yourValue =
    d == null
      ? null
      : sealed * (d.marketSealedUsd ?? 0) + opened * (d.marketUsedUsd ?? 0);
  const yourPaid =
    notes?.paidPriceUsd != null
      ? notes.paidPriceUsd * totalOwned
      : null;
  const histValues = history.map((p) => p.unitValue);
  const histMin = histValues.length ? Math.min(...histValues) : 0;
  const histMax = histValues.length ? Math.max(...histValues) : 0;
  const histSpan = histMax - histMin;
  const soldSealed = (d?.soldListings ?? []).filter(
    (s) => s.condition === "sealed",
  );
  const soldUsed = (d?.soldListings ?? []).filter(
    (s) => s.condition !== "sealed",
  );
  const soldRangeLine = (list: typeof soldSealed) =>
    list.length === 0
      ? null
      : `${fmtPrice(Math.min(...list.map((s) => s.priceUsd)))} – ${fmtPrice(Math.max(...list.map((s) => s.priceUsd)))} · avg ${fmtPrice(list.reduce((a, s) => a + s.priceUsd, 0) / list.length)} across the ${list.length} sales below`;
  const researchButton = (
    <button
      type="button"
      disabled={research.isPending || researchStarted}
      onClick={() => research.mutate()}
      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-60"
    >
      {researchStarted
        ? "Research started"
        : research.isPending
          ? "Starting…"
          : d
            ? "Re-run research"
            : "Research this set"}
    </button>
  );
  return (
    <div className="mt-5 w-full text-left">
      {/* The card pages' tab treatment (Anthony, Nov 4, 2026,
          late): one segmented pill bar, full width — Set
          details carries the set itself and Your copy;
          Financial carries every number. */}
      <div
        className="flex rounded-full border border-white/12 bg-black/35 p-1"
        role="group"
        aria-label="Lego set detail views"
      >
        {(
          [
            { key: "details", label: "Set details" },
            { key: "financial", label: "Financial" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3.5 py-1.5 text-sm ${
              tab === t.key
                ? "bg-[var(--gold)] font-bold text-black"
                : "text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {detail.isError ? (
        <div className="mt-4 rounded-2xl border border-white/12 bg-black/30 px-4 py-4 text-center">
          <p className="text-sm text-[var(--text)]">
            This set&rsquo;s details didn&rsquo;t load.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            The set itself is fine — its details request
            failed. Retry and the full page loads here; the
            page never just sits empty.
          </p>
          <button
            type="button"
            onClick={() => void detail.refetch()}
            disabled={detail.isFetching}
            className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-60"
          >
            {detail.isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : detail.isPending ? (
        <p className="mt-4 text-sm text-[var(--dim)]">
          Loading this set&rsquo;s details…
        </p>
      ) : tab === "details" ? (
        <div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <LegoStatTile
              label="Pieces"
              value={
                facts?.pieces ? facts.pieces.toLocaleString() : null
              }
            />
            <LegoStatTile
              label="Year"
              value={facts?.year ? String(facts.year) : null}
            />
            <LegoStatTile
              label="Price / piece"
              value={
                pricePerPiece != null
                  ? `$${pricePerPiece.toFixed(3)}`
                  : null
              }
            />
          </dl>

          <LegoSectionTitle title="Set facts" />
          <dl className="mt-2 space-y-1.5">
            <LegoFactRow label="Set number" value={card.printed} />
            <LegoFactRow label="Theme" value={card.sectionName} />
            <LegoFactRow
              label="Subtheme"
              value={facts?.subtheme ?? null}
            />
            <LegoFactRow
              label="Release date"
              value={fmtLegoDate(d?.releaseDate ?? null)}
            />
            <LegoFactRow label="Ages" value={d?.ages ?? null} />
            <LegoFactRow
              label="Availability"
              value={d?.availability ?? null}
            />
            {d?.retiredDate ? (
              <LegoFactRow
                label="Retired"
                value={fmtLegoDate(d.retiredDate)}
              />
            ) : null}
            {d?.expectedRetirement ? (
              <LegoFactRow
                label="Expected retirement"
                value={`${d.expectedRetirement} (estimate)`}
              />
            ) : null}
            <LegoFactRow
              label="Dimensions (built)"
              value={d?.dimensions ?? null}
            />
            <LegoFactRow
              label="Weight"
              value={
                d?.weightGrams != null
                  ? `${d.weightGrams.toLocaleString()} g`
                  : null
              }
            />
            <LegoFactRow
              label="Build time"
              value={d?.buildTime ?? null}
            />
            <LegoFactRow label="UPC" value={d?.upc ?? null} />
            <LegoFactRow label="EAN" value={d?.ean ?? null} />
          </dl>

          <LegoSectionTitle title="Minifigures & parts" />
          <button
            type="button"
            aria-expanded={breakdownOpen}
            onClick={() => setBreakdownOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between rounded-xl bg-black/30 px-3 py-2.5 text-sm font-semibold text-[var(--text)]"
          >
            {breakdownOpen ? "Hide the breakdown" : "Show the breakdown"}
            <span
              aria-hidden="true"
              className={`text-xs text-[var(--dim)] transition-transform ${breakdownOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
          {breakdownOpen ? (
            <div className="mt-2 rounded-xl bg-black/30 px-3 py-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                Minifigures
              </h4>
              {d && d.minifigs.length > 0 ? (
                <>
                  <ul className="mt-1.5 space-y-1.5">
                    {d.minifigs.map((f) => (
                      <li
                        key={`${f.name}-${f.code ?? ""}`}
                        className="flex items-baseline justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-1.5 text-sm"
                      >
                        <span className="min-w-0 text-[var(--text)]">
                          {f.name}
                          {f.code ? (
                            <span className="text-[var(--dim)]">
                              {" "}
                              · {f.code}
                            </span>
                          ) : null}
                          {f.uniqueToSet ? (
                            <span className="ml-1.5 rounded-full border border-[var(--gold)]/50 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold-soft)]">
                              Exclusive to this set
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-semibold text-[var(--text)]">
                          {f.valueUsd != null
                            ? fmtPrice(f.valueUsd)
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {d.minifigsValueUsd != null ? (
                    <p className="mt-2 text-xs text-[var(--dim)]">
                      Combined minifigure value:{" "}
                      <span className="font-semibold text-[var(--text)]">
                        {fmtPrice(d.minifigsValueUsd)}
                      </span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                  The minifigure list for this set hasn&rsquo;t been
                  researched yet — the catalog source doesn&rsquo;t
                  publish per-set minifigures, so none are shown
                  rather than guessed.
                </p>
              )}
              <h4 className="mt-3.5 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                Parts inventory
              </h4>
              {d &&
              (d.partsDistinct != null || d.partsSpares != null) ? (
                <dl className="mt-1.5 space-y-1.5">
                  <LegoFactRow
                    label="Distinct parts"
                    value={
                      d.partsDistinct != null
                        ? d.partsDistinct.toLocaleString()
                        : null
                    }
                  />
                  <LegoFactRow
                    label="Spare parts"
                    value={
                      d.partsSpares != null
                        ? d.partsSpares.toLocaleString()
                        : null
                    }
                  />
                </dl>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                  No parts inventory summary recorded for this set
                  yet.
                </p>
              )}
              {totalOwned > 0 ? (
                <p className="mt-2.5 text-xs leading-relaxed text-[var(--dim)]">
                  Your copy:{" "}
                  {notes?.completeness
                    ? (LEGO_COMPLETENESS_LABELS[
                        notes.completeness
                      ] ?? notes.completeness)
                    : "completeness not recorded yet"}
                  {notes?.completeness === "missing_pieces" &&
                  notes?.missingPieces != null
                    ? ` — ${notes.missingPieces} ${notes.missingPieces === 1 ? "piece" : "pieces"} missing`
                    : ""}
                  . Track it under Your copy below.
                </p>
              ) : null}
            </div>
          ) : null}

          {d?.description ? (
            <>
              <LegoSectionTitle title="About this set" />
              <p className="mt-2 whitespace-pre-line rounded-lg bg-black/30 px-3 py-2.5 text-sm leading-relaxed text-[var(--text)]">
                {d.description}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--dim)]">
                Official description, provided by LEGO.
              </p>
            </>
          ) : null}

          {/* Your copy, in the card pages' "In your
              collection" arrangement (Anthony, Nov 4, 2026,
              late): the album heading with the owned count in
              gold beside it, then the Where it lives bar
              carrying the opened/sealed steppers, the copy's
              recorded facts, and the record editor inside it
              — the same block the card detail uses. */}
          <div className="mt-5 border-t border-white/12 pt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-album text-base text-[var(--text)]">
                Your copy
              </h3>
              <span
                className={`text-sm font-semibold ${
                  totalOwned > 0
                    ? "text-[var(--gold-soft)]"
                    : "text-red-400"
                }`}
              >
                {totalOwned > 0
                  ? `${totalOwned} cop${totalOwned === 1 ? "y" : "ies"}`
                  : "Don’t own"}
              </span>
            </div>
            <div className="mt-3">
              <OwnedLocationBar
                targetKind="game"
                cardId={null}
                sealedName={null}
                comicId={null}
                gameCardId={card.id}
                ownedQty={totalOwned}
                copiesQty={totalOwned}
                copiesItemName={card.name}
                barClassName="bg-[var(--surface)]"
              >
                <div className="space-y-1.5">
                  <LegoStepperRow
                    label="Opened copies"
                    qty={opened}
                    onStep={onStepOpened}
                    savePending={savePending}
                    itemName={card.name}
                  />
                  <LegoStepperRow
                    label="Sealed copies"
                    qty={sealed}
                    onStep={onStepSealed}
                    savePending={savePending}
                    itemName={card.name}
                  />
                </div>
                <dl className="mt-3 space-y-1.5">
                  <LegoFactRow
                    label="Condition"
                    value={
                      notes?.condition
                        ? (LEGO_CONDITION_LABELS[notes.condition] ??
                          notes.condition)
                        : null
                    }
                  />
                  <LegoFactRow
                    label="Completeness"
                    value={
                      notes?.completeness
                        ? `${LEGO_COMPLETENESS_LABELS[notes.completeness] ?? notes.completeness}${
                            notes.completeness === "missing_pieces" &&
                            notes.missingPieces != null
                              ? ` — ${notes.missingPieces} missing`
                              : ""
                          }`
                        : null
                    }
                  />
                  <LegoFactRow
                    label="Paid (per copy)"
                    value={
                      notes?.paidPriceUsd != null
                        ? fmtPrice(notes.paidPriceUsd)
                        : null
                    }
                  />
                  <LegoFactRow
                    label="Date added"
                    value={fmtLegoDate(notes?.dateAdded ?? null)}
                  />
                </dl>
                <LegoNotesEditor
                  key={`${card.id}:${notes?.paidPriceUsd ?? ""}:${notes?.condition ?? ""}:${notes?.completeness ?? ""}:${notes?.missingPieces ?? ""}`}
                  cardId={card.id}
                  cardName={card.name}
                  notes={notes}
                />
              </OwnedLocationBar>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-black/30 px-3 py-3 text-center">
            {d ? (
              <p className="text-xs leading-relaxed text-[var(--dim)]">
                Set data researched {fmtLegoDate(d.researchedAt)}.
                Anything a source doesn&rsquo;t publish shows as
                unavailable rather than a guess.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-[var(--dim)]">
                This set&rsquo;s full details haven&rsquo;t been
                researched yet — release dates, barcodes, market
                values, and sold history live in the Lego tracking
                sources, not the catalog.
              </p>
            )}
            <div className="mt-2.5">{researchButton}</div>
            {researchStarted ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                Jarvis is gathering this set&rsquo;s details and
                market data now — they&rsquo;ll appear here when
                the research lands.
              </p>
            ) : null}
            {research.isError ? (
              <p className="mt-2 text-xs text-red-400" role="alert">
                The research couldn&rsquo;t start — try again.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          {/* Watch + price alert live on the Financial tab
              (the card pages keep theirs off the item tab
              too); they sat in the sheet header before the
              reformat. */}
          <div className="mt-4 flex w-full flex-col items-center">
            <WatchToggleButton
              targetKind="game"
              cardId={null}
              sealedName={null}
              gameCardId={card.id}
            />
            {card.price != null ? (
              <GameAlertBox
                gameCardId={card.id}
                currentPrice={card.price}
              />
            ) : null}
          </div>
          {d ? (
            <>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <LegoStatTile
                  label="Sealed value"
                  value={
                    d.marketSealedUsd != null
                      ? fmtPrice(d.marketSealedUsd)
                      : null
                  }
                />
                <LegoStatTile
                  label="Used value"
                  value={
                    d.marketUsedUsd != null
                      ? fmtPrice(d.marketUsedUsd)
                      : null
                  }
                />
                <LegoStatTile
                  label="Retail (RRP)"
                  value={
                    d.retailPriceUsd != null
                      ? fmtPrice(d.retailPriceUsd)
                      : null
                  }
                />
              </dl>

              <LegoSectionTitle title="The numbers" />
              <dl className="mt-2 space-y-1.5">
                {d.usedRange ? (
                  <LegoFactRow
                    label="Used range"
                    value={d.usedRange}
                  />
                ) : null}
                <LegoFactRow
                  label="Growth vs retail (sealed)"
                  value={
                    growthPct != null
                      ? `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`
                      : null
                  }
                />
                <LegoFactRow
                  label="Annual growth"
                  value={
                    d.annualGrowthPct != null
                      ? `${d.annualGrowthPct >= 0 ? "+" : ""}${d.annualGrowthPct.toFixed(2)}% a year`
                      : null
                  }
                />
                {totalOwned > 0 ? (
                  <LegoFactRow
                    label="Your copies are worth"
                    value={
                      yourValue != null && yourValue > 0
                        ? fmtPrice(yourValue)
                        : null
                    }
                  />
                ) : null}
                {totalOwned > 0 && yourPaid != null ? (
                  <LegoFactRow
                    label="You paid (all copies)"
                    value={fmtPrice(yourPaid)}
                  />
                ) : null}
                {totalOwned > 0 &&
                yourPaid != null &&
                yourValue != null &&
                yourValue > 0 ? (
                  <LegoFactRow
                    label="Gain / loss"
                    value={`${yourValue - yourPaid >= 0 ? "+" : "−"}${fmtPrice(Math.abs(yourValue - yourPaid))}`}
                  />
                ) : null}
              </dl>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--dim)]">
                Market values as of {fmtLegoDate(d.researchedAt)},
                from BrickEconomy. Your copies are valued sealed
                copies at the sealed value and opened copies at
                the used value.
              </p>

              <LegoSectionTitle title="Value history — sealed" />
              <div className="mt-2 rounded-xl bg-black/30 px-3 py-3">
                {history.length > 0 ? (
                  <>
                    {history.length > 1 ? (
                      <svg
                        viewBox="0 0 100 28"
                        className="mt-2 h-10 w-full"
                        role="img"
                        aria-label={`Value history: ${history.length} recorded points from ${fmtPrice(histValues[0] ?? 0)} to ${fmtPrice(histValues[histValues.length - 1] ?? 0)}`}
                      >
                        <polyline
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="1.6"
                          points={history
                            .map((p, i) => {
                              const x =
                                history.length > 1
                                  ? (i / (history.length - 1)) *
                                      98 +
                                    1
                                  : 50;
                              const y =
                                histSpan > 0
                                  ? 25 -
                                    ((p.unitValue - histMin) /
                                      histSpan) *
                                      22
                                  : 14;
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            })
                            .join(" ")}
                        />
                      </svg>
                    ) : null}
                    <ul className="mt-2 space-y-0.5">
                      {[...history]
                        .reverse()
                        .slice(0, 8)
                        .map((p) => (
                          <li
                            key={`${p.date}-${p.source}`}
                            className="flex items-baseline justify-between gap-2 text-xs text-[var(--dim)]"
                          >
                            <span>
                              {p.label}
                              <span className="text-[10px]">
                                {" "}
                                · {p.source}
                              </span>
                            </span>
                            <span className="font-semibold text-[var(--text)]">
                              {fmtPrice(p.unitValue)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                    No dated value points recorded for this set
                    yet.
                  </p>
                )}
              </div>

              <LegoSectionTitle title="Recent sold listings" />
              <div className="mt-2 rounded-xl bg-black/30 px-3 py-3">
                {d.soldListings.length > 0 ? (
                  <>
                    <ul className="mt-2 space-y-2">
                      {[...d.soldListings]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 10)
                        .map((s, i) => (
                          <li
                            key={`${s.date}-${s.priceUsd}-${i}`}
                            className="flex items-baseline justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-1.5"
                          >
                            <span className="min-w-0">
                              <span
                                className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                  s.condition === "sealed"
                                    ? "border border-[var(--gold)]/50 text-[var(--gold-soft)]"
                                    : "border border-[var(--border)] text-[var(--dim)]"
                                }`}
                              >
                                {s.condition === "sealed"
                                  ? "Sealed"
                                  : "Used"}
                              </span>
                              <span className="text-xs text-[var(--dim)]">
                                {fmtLegoDate(s.date) ?? s.date}
                              </span>
                              {s.title ? (
                                <span className="block truncate text-xs text-[var(--text)]">
                                  {s.title}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-[var(--text)]">
                              {fmtPrice(s.priceUsd)}
                            </span>
                          </li>
                        ))}
                    </ul>
                    {soldRangeLine(soldSealed) ? (
                      <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--dim)]">
                        Sealed: {soldRangeLine(soldSealed)}.
                      </p>
                    ) : null}
                    {soldRangeLine(soldUsed) ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--dim)]">
                        Used: {soldRangeLine(soldUsed)}.
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[11px] text-[var(--dim)]">
                      Completed sales only —{" "}
                      {d.soldListings[0]?.sourceUrl ? (
                        <a
                          href={d.soldListings[0].sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {d.soldListings[0].source} via
                          PriceCharting
                        </a>
                      ) : (
                        (d.soldListings[0]?.source ?? "eBay sold")
                      )}
                      . Asking prices never count as sales.
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                    No recent sold listings recorded for this set —
                    unavailable, rather than estimated.
                  </p>
                )}
              </div>

              <LegoSectionTitle title="Part-out value" />
              <div className="mt-2 rounded-xl bg-black/30 px-3 py-3">
                {d.partOutValueUsd != null ? (
                  <>
                    <p className="mt-1 text-lg font-bold text-[var(--text)]">
                      {fmtPrice(d.partOutValueUsd)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--dim)]">
                      What this set&rsquo;s parts sell for
                      individually on BrickLink — a part-out
                      figure, not the set&rsquo;s value.
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                    A part-out total isn&rsquo;t published for this
                    set in the sources checked — unavailable.
                  </p>
                )}
              </div>

              <LegoSectionTitle title="Cheapest now — sealed" />
              <div className="mt-2 rounded-xl bg-black/30 px-3 py-3">
                {d.retailers.length > 0 ? (
                  <>
                    <ul className="mt-2 space-y-1.5">
                      {[...d.retailers]
                        .sort((a, b) => a.priceUsd - b.priceUsd)
                        .map((r) => (
                          <li
                            key={r.name}
                            className="flex items-baseline justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-1.5 text-sm"
                          >
                            <span className="text-[var(--text)]">
                              {r.url ? (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline"
                                >
                                  {r.name}
                                </a>
                              ) : (
                                r.name
                              )}
                            </span>
                            <span className="font-semibold text-[var(--text)]">
                              {fmtPrice(r.priceUsd)}
                            </span>
                          </li>
                        ))}
                    </ul>
                    <p className="mt-1.5 text-[11px] text-[var(--dim)]">
                      Current listings for a sealed copy, as of{" "}
                      {fmtLegoDate(d.researchedAt)} — asking
                      prices, not sales.
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                    No current retailer prices recorded for this
                    set.
                  </p>
                )}
              </div>

              {d.forecast1yrUsd != null || d.forecast5yrUsd != null ? (
                <>
                  <LegoSectionTitle title="Forecast — estimate" />
                  <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-black/30 px-3 py-3">
                  <p className="text-xs leading-relaxed text-[var(--dim)]">
                    BrickEconomy&rsquo;s forecast for the sealed
                    value — an estimate, not a price:{" "}
                    {d.forecast1yrUsd != null
                      ? `about ${fmtPrice(d.forecast1yrUsd)} in one year`
                      : ""}
                    {d.forecast1yrUsd != null &&
                    d.forecast5yrUsd != null
                      ? ", "
                      : ""}
                    {d.forecast5yrUsd != null
                      ? `about ${fmtPrice(d.forecast5yrUsd)} in five years`
                      : ""}
                    .
                  </p>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl bg-black/30 px-3 py-4 text-center">
              <p className="text-sm font-medium text-[var(--text)]">
                No market data recorded for this set yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
                Retail price, sealed and used values, sold
                history, and part-out value come from the Lego
                tracking sources — nothing is shown until real
                data is researched, and nothing here is ever
                estimated silently.
              </p>
              <div className="mt-3">{researchButton}</div>
              {researchStarted ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  Jarvis is gathering this set&rsquo;s market data
                  now — it will appear here when the research
                  lands.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {d && d.sources.length > 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--dim)]">
          Sources:{" "}
          {d.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 ? " · " : ""}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {s.label}
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** The Lego set hero (Anthony, Nov 4, 2026, late — the
    detail reformat): the card pages' hero treatment. The
    set's photo is cut out of its white studio backdrop
    on-device (same matte as the Funko figures) and floats
    over the sheet's blurred-art backdrop with a silhouette
    shadow; when the photo won't cut out, it sits in the
    themed frame instead — a framed print on the backdrop,
    never a bare white rectangle pasted on the page. */
function LegoHeroImg({
  card,
  ghost,
}: {
  card: DetailCard;
  ghost: boolean;
}) {
  const { url, isCutout } = useCutoutState(card.imageUrl, card.id);
  if (!card.imageUrl || !url) {
    return (
      <div className="flex aspect-[4/3] w-72 max-w-full items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/40 px-4 text-center text-sm text-[var(--dim)]">
        No artwork link from the source for this set
      </div>
    );
  }
  if (isCutout) {
    return (
      /* Bordered stage (Anthony, Nov 5, 2026 — the
         every-item rule): even with its backdrop cut away,
         the set's photo sits inside the same ring border
         the Lorcana cards carry, so the detail page reads
         as a framed item on the turntable, not a bare
         cutout pasted on the backdrop. */
      <div
        className={`w-72 max-w-full rounded-2xl bg-white/[0.04] px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/15 ${
          ghost ? "opacity-50 grayscale-[30%]" : ""
        }`}
      >
        <img
          src={url}
          alt={`${card.name} artwork`}
          className="mx-auto block max-h-64 w-auto max-w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)]"
        />
      </div>
    );
  }
  return (
    /* Same stage as the cutout branch (Anthony, Nov 5,
       2026 — the Millennium Falcon case): when a set's
       photo keeps its studio backdrop, it still sits
       INSIDE the bordered stage, shown whole (contain —
       never cropped into a white block by object-cover),
       so every Lego set page presents its hero exactly
       the same way whether or not the backdrop cut away. */
    <div
      className={`w-72 max-w-full rounded-2xl bg-white/[0.04] px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/15 ${
        ghost ? "opacity-50 grayscale-[30%]" : ""
      }`}
    >
      <CutoutImg
        src={card.imageUrl}
        alt={`${card.name} artwork`}
        placeholderText="Image unavailable"
        proxyId={card.id}
        className="mx-auto block max-h-64 w-auto max-w-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)]"
      />
    </div>
  );
}

function CardDetailSheet({
  game,
  card,
  onClose,
  pendingUpc = null,
  onLinkUpc,
  onAddGradedSlab,
  onOpenGradedSlab,
}: {
  game: GameKey;
  card: DetailCard;
  onClose: () => void;
  /** A barcode scanned in the Funko section that matched
      nothing yet: this figure's page offers to link that
      barcode to it, so the next scan of the same box lands
      here directly (Anthony, Nov 4, 2026). */
  pendingUpc?: string | null;
  onLinkUpc?: () => void;
  /** Graded cert scanning (Anthony, Nov 5, 2026): opens
      the cert scanner with this card already chosen, so a
      slab of this card is two taps from saved. Absent on
      the games where slabs don't apply (Funko, Lego). */
  onAddGradedSlab?: () => void;
  /** Opens a saved slab's Card / Slab View from this card's
      graded-copies list (tap the slab's photo). */
  onOpenGradedSlab?: (slab: GradedSlab) => void;
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
  const isFunko = game === "funko";
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
      void queryClient.invalidateQueries({
        queryKey: ["gameOwnedItems", game],
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
      {/* Lego sets get the card pages' backdrop (Anthony,
          Nov 4, 2026, late — the detail reformat): a blurred,
          darkened blow-up of the set's own photo behind the
          page, like the Lorcana card detail. Other games keep
          the plain sheet. */}
      {(isLego || isFunko) && card.imageUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <img
            src={card.imageUrl}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-45 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#05070d]/40 to-[#05070d]" />
        </div>
      ) : null}
      <div
        className={`mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] ${
          isLego || isFunko ? "relative" : ""
        }`}
      >
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
          {/* EVERY item detail page (Anthony, Nov 5, 2026 —
              the standing rule, re-directed after he checked
              the Han Solo Millennium Falcon Funko page and
              the TIE Fighter Lego page): whatever the item,
              its photo gets the Lorcana card pages' exact
              presentation — the floating turntable sway and
              hand-turn, and the ring border around the item.
              Funko figures and Lego cutouts sit in a bordered
              stage frame; card art carries the border on its
              own frame, exactly like HoverCard. */}
          {isLego ? (
            <Turntable
              label={`${card.name} artwork, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
              floatClassName="w-72 max-w-full"
            >
              <LegoHeroImg card={card} ghost={totalOwned === 0} />
            </Turntable>
          ) : card.imageUrl ? (
            game === "funko" ? (
              /* Funko figure detail: the figure's white
                 studio background is cut away on-device (see
                 cutoutImg.tsx) and the figure stands inside
                 the bordered stage on the turntable, matching
                 the card pages. */
              <Turntable
                label={`${card.name} artwork, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
                floatClassName="w-64 max-w-full"
              >
                <div
                  className={`relative overflow-hidden rounded-2xl bg-white/[0.04] px-3 py-3 shadow-[0_28px_55px_rgba(0,0,0,0.6)] ring-1 ring-white/15 ${
                    totalOwned === 0 ? "opacity-50 grayscale-[30%]" : ""
                  }`}
                >
                  <CutoutImg
                    src={card.imageUrl}
                    alt={`${card.name} artwork`}
                    placeholderText="Image unavailable"
                    proxyId={card.id}
                    className="mx-auto block max-h-72 w-auto max-w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)]"
                  />
                  <span aria-hidden="true" className="card-glare" />
                </div>
              </Turntable>
            ) : (
              <Turntable
                label={`${card.name} artwork, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
                floatClassName="w-64 max-w-full"
              >
                <div
                  className={`relative overflow-hidden rounded-[10px] shadow-[0_28px_55px_rgba(0,0,0,0.6)] ring-1 ring-white/15 ${
                    totalOwned === 0 ? "opacity-50 grayscale-[30%]" : ""
                  }`}
                >
                  <SafeImg
                    src={card.imageUrl}
                    alt={`${card.name} artwork`}
                    placeholderText="Image unavailable"
                    className="block w-full select-none"
                  />
                  <span aria-hidden="true" className="card-glare" />
                </div>
              </Turntable>
            )
          ) : (
            <div className="flex aspect-[3/4] w-64 max-w-full items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 text-center text-sm text-[var(--dim)]">
              {gameIsDataOnly(game)
                ? "No artwork — this catalog is data only"
                : "No artwork link from the source for this printing"}
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
          {!isLego && !isFunko && card.price != null ? (
            <p className="mt-2 text-base font-semibold text-[var(--gold-soft)]">
              {fmtPrice(card.price)}
            </p>
          ) : null}
          {game === "funko" && pendingUpc && onLinkUpc ? (
            <div className="mt-4 w-full rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-3.5 text-center">
              <p className="text-sm leading-relaxed text-[var(--text)]">
                That scan read barcode{" "}
                <span className="font-bold tabular-nums">{pendingUpc}</span>,
                which isn&rsquo;t linked to any figure yet. If this is the
                figure on that box, link them — the next scan of that box
                opens this figure directly.
              </p>
              <button
                type="button"
                onClick={onLinkUpc}
                className="mt-2.5 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)]"
              >
                Link barcode {pendingUpc} to this figure
              </button>
            </div>
          ) : null}
          {/* For Lego sets and Funko figures the steppers,
              watch, and alert live inside their own detail
              blocks (the Your copy block and the Financial
              tab), matching the card pages' split — this
              header cluster is for the other games. */}
          {!isLego && !isFunko ? (
          <>
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--dim)]">
              {t("game.copiesOwned")}
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
          </>
          ) : null}
          {isFunko ? (
            <FunkoFigureDetail
              card={card}
              owned={owned}
              onStep={step}
              savePending={save.isPending}
            />
          ) : null}
          {onAddGradedSlab ? (
            <div className="mt-6 flex w-full justify-center">
              <GradedSlabsBox
                game={game}
                cardId={card.id}
                cardName={card.name}
                onAddSlab={onAddGradedSlab}
                onOpenSlab={onOpenGradedSlab}
              />
            </div>
          ) : null}
          {isLego ? (
            <LegoSetDetail
              card={card}
              opened={owned}
              sealed={sealed}
              onStepOpened={step}
              onStepSealed={stepSealed}
              savePending={save.isPending}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Funko box-barcode scanner (Anthony, Nov 4, 2026): the
    camera reads the UPC barcode printed on a Funko box and
    the app matches it against the barcodes LINKED to
    catalog figures (findGameCardByUpc). The catalog itself
    ships no barcodes, so an unlinked box honestly finds no
    match: the panel says so, keeps the code, and offers
    search by name — and once he opens the right figure, its
    page offers to link this barcode to it. Typing the
    digits under the barcode works everywhere, including
    browsers without a live barcode detector. */
function FunkoBarcodeScanner({
  onClose,
  onMatch,
  onNoMatch,
}: {
  onClose: () => void;
  onMatch: (card: DetailCard) => void;
  onNoMatch: (upc: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState<
    "starting" | "scanning" | "manual" | "checking" | "nomatch"
  >("starting");
  const [note, setNote] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: (upc: string) => api.findGameCardByUpc({ upc }),
    onSuccess: (r, upc) => {
      if (r.match) {
        doneRef.current = true;
        onMatch(r.match);
      } else {
        setLastCode(upc);
        setStatus("nomatch");
      }
    },
    onError: () => {
      setStatus("manual");
      setNote(
        "The lookup didn't go through — check the connection, or type the digits under the barcode.",
      );
    },
  });
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const stop = () => {
      if (timer != null) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
    const start = async () => {
      const BD = (
        window as unknown as {
          BarcodeDetector?: new (opts?: {
            formats?: string[];
          }) => {
            detect: (
              src: HTMLVideoElement,
            ) => Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;
      if (!BD || !navigator.mediaDevices?.getUserMedia) {
        setStatus("manual");
        setNote(
          "Live barcode scanning isn't available in this browser — type the digits under the box's barcode instead.",
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const detector = new BD({
          formats: ["upc_a", "upc_e", "ean_13", "ean_8"],
        });
        setStatus("scanning");
        timer = window.setInterval(() => {
          if (doneRef.current || cancelled) return;
          void detector
            .detect(video)
            .then((codes) => {
              const raw = codes[0]?.rawValue?.replace(/\D/g, "");
              if (raw && raw.length >= 8) {
                doneRef.current = true;
                setStatus("checking");
                lookupRef.current.mutate(raw);
              }
            })
            .catch(() => undefined);
        }, 350);
      } catch {
        if (!cancelled) {
          setStatus("manual");
          setNote(
            "The camera didn't open — type the digits under the box's barcode instead.",
          );
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const submitTyped = () => {
    const digits = typed.replace(/\D/g, "");
    if (digits.length < 8) {
      setNote("That code is too short — a box barcode has 12 or 13 digits.");
      return;
    }
    setNote(null);
    setStatus("checking");
    lookup.mutate(digits);
  };

  return (
    <div
      className="fixed inset-0 z-[75] overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Scan a Funko box barcode"
    >
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the barcode scanner"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
          >
            ←
          </button>
          <div>
            <h2 className="font-album text-xl text-[var(--text)]">
              Scan barcode
            </h2>
            <p className="text-xs text-[var(--dim)]">
              The UPC barcode on the bottom or back of the box
            </p>
          </div>
        </div>

        {status === "nomatch" ? (
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">
              No figure in the catalog carries barcode{" "}
              <span className="tabular-nums">{lastCode}</span> yet.
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
              The catalog doesn&rsquo;t ship with barcodes, so a box only
              matches after its barcode is linked to its figure. Find the
              figure by name, open it, and use the link button there —
              after that, this box scans straight to it.
            </p>
            <button
              type="button"
              onClick={() => lastCode && onNoMatch(lastCode)}
              className="mt-3 w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)]"
            >
              Search by name instead
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("manual");
                setLastCode(null);
              }}
              className="mt-2 w-full rounded-full px-4 py-2 text-sm text-[var(--dim)]"
            >
              Scan another barcode
            </button>
          </div>
        ) : (
          <>
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
                aria-label="Camera view for barcode scanning"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 border-[var(--gold)]/80"
              />
            </div>
            <p className="mt-3 text-center text-sm text-[var(--dim)]" role="status">
              {status === "checking"
                ? "Reading that barcode…"
                : status === "scanning"
                  ? "Point the camera at the box's barcode."
                  : "Starting the camera…"}
            </p>
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="…or type the digits under the barcode"
                aria-label="Type the barcode digits"
                className="h-11 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold tabular-nums text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
              />
              <button
                type="submit"
                disabled={typed.replace(/\D/g, "").length < 8}
                className="h-11 shrink-0 rounded-full bg-[var(--gold)] px-4 text-sm font-bold text-black disabled:opacity-50"
              >
                Look up
              </button>
            </form>
            {note ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]" role="status">
                {note}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Catalog download manager (Anthony, Nov 5,
   2026 — his thrice-asked question, verified in code and
   FIXED) ----------
   VERIFIED OLD BEHAVIOR: the chunk loop lived in GamePanel's
   component state. When he left the section, the panel
   unmounted — the loop's promise technically kept firing in
   the background, but its PROGRESS died with the component:
   returning showed no live progress (just the static
   not-complete state), the button offered "Continue" again,
   and tapping it started a SECOND loop alongside the first.
   The loop also silently stopped after 60 chunks even if he
   stayed, and died outright on any reload.
   THE FIX: the loop lives HERE, at module scope, keyed by
   game — outside any component. It runs until the catalog
   completes, an error stops it, or a generous safety cap is
   reached, no matter which tab or page he is on; chunk
   progress is already resumable server-side, so an
   interruption (reload, app kill) loses nothing and Continue
   picks up where it stopped. Panels subscribe to the
   per-game state, so leaving and returning shows the TRUE
   current progress — running, counts and all — and Continue
   can never start a duplicate: starting an already-running
   download is a no-op. Applies to every catalog on this
   template (Pokémon, Magic, Star Wars Unlimited, Funko,
   Lego, all Topps sports and Alternate Universe games). */
export type GameImportState = {
  running: boolean;
  cards: number;
  setsDone: number;
  setsTotal: number;
  note: string | null;
  complete: boolean;
};
const IDLE_IMPORT: GameImportState = {
  running: false,
  cards: 0,
  setsDone: 0,
  setsTotal: 0,
  note: null,
  complete: false,
};
const importStates = new Map<GameKey, GameImportState>();
const importListeners = new Map<GameKey, Set<() => void>>();
function getImportState(game: GameKey): GameImportState {
  return importStates.get(game) ?? IDLE_IMPORT;
}
function setImportState(game: GameKey, next: GameImportState) {
  importStates.set(game, next);
  const subs = importListeners.get(game);
  if (subs) for (const cb of [...subs]) cb();
}
function subscribeImport(game: GameKey, cb: () => void): () => void {
  let subs = importListeners.get(game);
  if (!subs) {
    subs = new Set();
    importListeners.set(game, subs);
  }
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
export function startGameImport(
  game: GameKey,
  queryClient: QueryClient,
): void {
  if (getImportState(game).running) return;
  setImportState(game, {
    ...getImportState(game),
    running: true,
    note: null,
  });
  void (async () => {
    // SELF-CANCELLING DOWNLOAD FIX (Anthony, Nov 5, 2026):
    // on the Pokémon page the download started, then about
    // five seconds later the page flickered and the button
    // flipped from Downloading back to Continue download —
    // every time. Cause, verified against the live source:
    // the Pokémon TCG API intermittently answers 500/502
    // for a page it served fine seconds earlier. A chunk
    // call whose FIRST page hit that answer came back
    // ok:false, and this loop treated ANY single failed
    // chunk as the end of the download — the first chunk
    // lands in ~4s, the next call failed in ~1s, and the
    // download "cancelled itself" at the ~5s mark. A failed
    // chunk is now treated as what it is — transient: the
    // loop keeps the Downloading state, shows a retrying
    // note, waits with a growing backoff, and tries the
    // same chunk again (chunks resume server-side, so a
    // retry never redoes landed work). Only TEN failed
    // chunks in a row — a sustained outage, not a hiccup —
    // stop the download, with the source's own message.
    let failures = 0;
    const MAX_FAILURES = 10;
    try {
      for (let i = 0; i < 2000; i++) {
        let r: Awaited<ReturnType<typeof api.importGameCatalog>> | null =
          null;
        let thrown = false;
        try {
          r = await api.importGameCatalog({ game });
        } catch {
          thrown = true;
        }
        if (r && !thrown) {
          void queryClient.invalidateQueries({
            queryKey: ["gameCatalog", game],
          });
        }
        if (!r || thrown || !r.ok) {
          failures += 1;
          if (failures >= MAX_FAILURES) {
            setImportState(game, {
              ...getImportState(game),
              running: false,
              note:
                r && !thrown
                  ? r.message
                  : "The download stopped — progress is saved; tap Continue to resume.",
            });
            return;
          }
          setImportState(game, {
            ...getImportState(game),
            running: true,
            note: "The source hiccuped — retrying the download…",
          });
          await new Promise<void>((resolve) =>
            window.setTimeout(
              resolve,
              Math.min(2000 * failures, 10000),
            ),
          );
          continue;
        }
        failures = 0;
        setImportState(game, {
          running: true,
          cards: r.cardsTotal,
          setsDone: r.setsDone,
          setsTotal: r.setsTotal,
          note: null,
          complete: r.complete,
        });
        if (r.complete) {
          setImportState(game, {
            ...getImportState(game),
            running: false,
            complete: true,
            note: `Catalog complete — ${r.cardsTotal.toLocaleString()} ${gameNoun(game)}.`,
          });
          return;
        }
      }
      setImportState(game, {
        ...getImportState(game),
        running: false,
        note: "Still downloading — progress is saved; tap Continue to keep going.",
      });
    } finally {
      void queryClient.invalidateQueries({
        queryKey: ["gameCatalog", game],
      });
    }
  })();
}
/** A panel's view of its game's download: live across
    unmount/remount, because the state lives in the manager
    above, not in the panel. */
function useGameImport(game: GameKey): GameImportState {
  return useSyncExternalStore(
    (cb) => subscribeImport(game, cb),
    () => getImportState(game),
  );
}

/** A set row's official product artwork (Anthony, Nov 5,
    2026): sections whose catalog source is text-only
    (Disney Topps, Garbage Pail Kids) carry a publisher
    product photo, ingested into the app's own blob storage
    by the getSectionArt action — this renders that owned
    copy, never a hotlink. Sections without artwork render
    nothing and the row keeps its text-only layout. */
function SectionArtThumb({
  game,
  sectionKey,
  name,
}: {
  game: string;
  sectionKey: string;
  name: string;
}) {
  const art = useQuery({
    queryKey: ["sectionArt", game, sectionKey],
    queryFn: () => api.getSectionArt({ game, sectionKey }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const url = art.data?.ok ? art.data.url : null;
  if (!url) return null;
  return (
    <img
      src={url}
      alt={`${name} product artwork`}
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-lg object-cover"
    />
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
    // Instant entry (Anthony, Nov 5, 2026 — the Funko load
    // fix, same pattern as the Admin fix): a section opens
    // from the cached catalog immediately and the counts
    // refresh behind it, instead of every entry waiting on
    // a full refetch of the section list and totals.
    staleTime: 5 * 60_000,
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
  // Progressive grid reveal (Anthony, Nov 5, 2026 — the
  // Funko load fix): a fetched section page holds up to 150
  // items, but only the first chunk renders (and starts
  // loading images) at first paint; "Show more" reveals
  // the next chunk from the page already in hand before
  // any further page is fetched. Resets per section/page.
  const GRID_REVEAL_START = 40;
  const [gridReveal, setGridReveal] = useState(GRID_REVEAL_START);
  useEffect(() => {
    setGridReveal(GRID_REVEAL_START);
  }, [sectionKey, offset]);
  // SECTION DRILL-IN entry (Anthony, Nov 5, 2026 — the
  // app-wide back re-audit's root fix): one set/section
  // opened from the section list is a drill-in over that
  // list, so it takes its own pushed history entry — the
  // phone's Back returns to the section list (the brand
  // page, for the Alternate Universe catalogs) in ONE
  // press instead of exiting the app, and the on-screen
  // "All sets" pill consumes the same entry exactly once.
  // The entry deliberately does NOT take the vxWin slot:
  // a card sheet opened from inside the section must still
  // be able to push its own entry above this one, so Back
  // from a card lands back on the section grid (base, then
  // section, then card — exactly the three-back budget).
  // Before this fix a section lived only in state, so Back
  // from any set page exited Vault X outright.
  const sectionPushedRef = useRef(false);
  const sectionHeldRef = useRef(false);
  const sectionTag = (key: string) => `${game}:${key}`;
  useEffect(() => {
    if (sectionKey) {
      const tag = sectionTag(sectionKey);
      if (readNavState()?.gameSection === tag) {
        // Refresh-in-place: the reload landed on the
        // section's own pushed entry, which still names it.
        sectionHeldRef.current = true;
        sectionPushedRef.current = true;
      } else {
        // Deep-linked / session-restored section (Library
        // spine, universal Search): take its entry now so
        // Back still returns to the list in one press.
        try {
          const cur = readNavState() ?? {};
          const depth =
            typeof cur.vxDepth === "number" &&
            Number.isFinite(cur.vxDepth)
              ? cur.vxDepth
              : 0;
          if (depth >= 2) {
            replaceNavState({ ...cur, gameSection: tag });
            sectionPushedRef.current = false;
          } else {
            window.history.pushState(
              { ...cur, gameSection: tag, vxDepth: depth + 1 },
              "",
            );
            sectionPushedRef.current = true;
          }
        } catch {
          sectionPushedRef.current = false;
        }
        sectionHeldRef.current = true;
      }
    }
    const onPopState = () => {
      if (
        sectionHeldRef.current &&
        readNavState()?.gameSection == null
      ) {
        sectionHeldRef.current = false;
        sectionPushedRef.current = false;
        setSectionKey(null);
        setOffset(0);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Mount-only: refs and setters are stable; the section
    // open at mount is the one being seeded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openSection = (key: string) => {
    setSectionKey(key);
    setOffset(0);
    if (sectionHeldRef.current) {
      // Section-to-section hop over the held entry: rename
      // it in place, never stack a second one.
      replaceNavState({
        ...(readNavState() ?? {}),
        gameSection: sectionTag(key),
      });
      return;
    }
    try {
      const cur = readNavState() ?? {};
      const depth =
        typeof cur.vxDepth === "number" && Number.isFinite(cur.vxDepth)
          ? cur.vxDepth
          : 0;
      if (depth >= 2) {
        replaceNavState({ ...cur, gameSection: sectionTag(key) });
        sectionPushedRef.current = false;
      } else {
        window.history.pushState(
          { ...cur, gameSection: sectionTag(key), vxDepth: depth + 1 },
          "",
        );
        sectionPushedRef.current = true;
      }
    } catch {
      sectionPushedRef.current = false;
    }
    sectionHeldRef.current = true;
  };
  const closeSection = () => {
    if (sectionPushedRef.current) {
      window.history.back();
    } else {
      sectionHeldRef.current = false;
      scrubWindowKeys(["gameSection"]);
      setSectionKey(null);
      setOffset(0);
    }
  };
  const [detail, setDetail] = useState<DetailCard | null>(null);
  // Universal Search handoff (Nov 4, 2026): the Search tab can
  // send one specific item — open its detail sheet on arrival
  // (its section is already the open one via the section key).
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(
        `vaultx-game-open-card:${game}`,
      );
      if (!raw) return;
      window.sessionStorage.removeItem(`vaultx-game-open-card:${game}`);
      const c = JSON.parse(raw) as DetailCard;
      if (typeof c?.id === "number") setDetail(c);
    } catch {
      // Unreadable handoff: the section still opened.
    }
    // Mount-only: the handoff is consumed once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [query, setQuery] = useState("");
  // Download state comes from the module-level manager
  // (see startGameImport above): it survives this panel
  // unmounting, so leaving the tab never loses the running
  // download or its progress.
  const importState = useGameImport(game);
  const importing = importState.running;
  const importNote = importState.note;
  // Funko barcode scan (Anthony, Nov 4, 2026): the scanner
  // overlay, and a scanned-but-unlinked barcode waiting to
  // be linked from the right figure's page.
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  // Back audit (Anthony, Nov 5, 2026): the barcode scanner
  // is a full-screen window, so it takes the window's one
  // history entry — the phone's Back closes the scanner
  // first and lands back on the Funko section, instead of
  // exiting the app from over it (it was plain state
  // before, with no trap at all).
  const barcodeWin = useWindowHistory(
    "funkoBarcodeScanner",
    setBarcodeOpen,
  );
  const [pendingUpc, setPendingUpc] = useState<string | null>(null);
  // Graded cert scan (Anthony, Nov 5, 2026): the cert
  // scanner overlay, and the card it was opened from — null
  // when it is opened from the section's pill, where the
  // card gets picked after the cert is read. Slabs belong
  // to the card catalogs; Funko figures and Lego sets never
  // show it. The scanner is a full-screen window, so it
  // takes the window history entry like the barcode
  // scanner does.
  const gradedEligible = game !== "funko" && game !== "lego";
  const [gradedOpen, setGradedOpen] = useState(false);
  const gradedWin = useWindowHistory(
    "gradedCertScanner",
    setGradedOpen,
  );
  const [gradedFixedCard, setGradedFixedCard] =
    useState<GradedCardPick | null>(null);
  // The Card / Slab View (Anthony, Nov 5, 2026): a saved
  // slab's own detail page, opened after a scan saves and
  // by tapping a slab's photo in a card's graded-copies
  // list. The view traps its own history entry.
  const [slabViewId, setSlabViewId] = useState<number | null>(
    null,
  );
  // What he OWNS in this section, shown on entry (Anthony,
  // Nov 4, 2026 — the Funko defect: his saved Falcon was
  // invisible behind a lone search field). Every game
  // section leads with the owned shelf; search is for
  // adding, not for finding what he already has.
  const ownedItems = useQuery({
    queryKey: ["gameOwnedItems", game],
    queryFn: () => api.getGameOwnedItems({ game }),
    // Same instant-entry caching as the catalog above: his
    // owned shelf paints from cache first, refresh behind.
    staleTime: 5 * 60_000,
  });
  const linkUpc = useMutation({
    mutationFn: (args: { id: number; upc: string }) =>
      api.setGameCardUpc(args),
    onSuccess: () => {
      setPendingUpc(null);
    },
  });

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
    // SEARCH RULE — STANDING, FOREVER (Anthony, Nov 5,
    // 2026): typeahead from the FIRST letter in every
    // section, no minimum characters, and previous results
    // stay on screen while the next keystroke resolves so
    // suggestions never disappear mid-typing. This panel
    // serves Pokémon, Magic, Star Wars Unlimited, Funko,
    // Lego, and every Topps sports / Alternate Universe
    // catalog — the rule applies to all of them, and to any
    // game added later, automatically.
    enabled: query.trim().length >= 1,
    placeholderData: (prev) => prev,
  });

  // Live download progress (Anthony, Nov 4, 2026 — app-wide
  // rule): a download button must SHOW it is working — the
  // running chunk counts feed a progress bar under the button
  // for as long as the download runs, never click-and-nothing.
  // The counts now come from the download manager, so the bar
  // shows the TRUE progress on return, mid-download included.
  const importProgress =
    importState.cards > 0 || importState.setsTotal > 0
      ? {
          cards: importState.cards,
          setsDone: importState.setsDone,
          setsTotal: importState.setsTotal,
        }
      : null;
  const runImport = () => startGameImport(game, queryClient);

  const data = catalog.data;
  const searching = query.trim().length >= 1;
  // "Only mine" (Anthony, Nov 5, 2026): the set/section
  // list below is this page's long list — when it displays
  // more than 15 entries the toggle shows, and ON keeps
  // only the sections he owns something in. This one wiring
  // covers every GamePanel list: Pokémon, Magic, Star Wars
  // Unlimited, Funko, Lego themes, every Sports Cards
  // manufacturer tab, and every Topps Alternate Universe
  // brand. PER-SECTION since later that day: the switch is
  // keyed by this panel's own game, so Star Wars Topps
  // being on leaves WWE, Disney Topps, and GPK untouched;
  // Disney Topps and GPK carry the toggle despite their
  // short lists (named exceptions).
  const onlyMine = useOnlyMine(game);
  const allSections = data?.sections ?? [];
  const shownSections = onlyMine
    ? allSections.filter((s) => s.owned > 0)
    : allSections;

  return (
    <div className="mt-5 pb-2">
      {embedded ? null : (
        <>
          <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
            {GAME_TITLES[game]}
          </h1>
          {game === "funko" ? (
            /* Funko header card (Anthony, Nov 4, 2026): the
               area under the title is its OWN bordered card
               carrying only his real collection info. The
               catalog-provenance verbiage that used to sit
               here (dataset scraping, known gaps, tracker
               notes) is deleted outright — boilerplate, not
               his data. */
            <div className="mt-3 rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">
                Your collection
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
                {(ownedItems.data?.items ?? []).length.toLocaleString()}{" "}
                {(ownedItems.data?.items ?? []).length === 1
                  ? "figure"
                  : "figures"}{" "}
                owned
                {data
                  ? ` · ${data.cardsTotal.toLocaleString()} ${noun} in the catalog`
                  : ""}
              </p>
              {(ownedItems.data?.items ?? []).length > 0 ? (
                <p className="mt-1 truncate text-xs text-[var(--gold-soft)]">
                  {(ownedItems.data?.items ?? [])
                    .slice(0, 3)
                    .map((i) => i.name)
                    .join(" · ")}
                  {(ownedItems.data?.items ?? []).length > 3 ? " · …" : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
              {GAME_SOURCE_LINES[game]}
            </p>
          )}
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
          {importing || importProgress ? (
            <div className="mt-3" role="status" aria-live="polite">
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-black/40"
                role="progressbar"
                aria-label="Catalog download progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  importProgress && importProgress.setsTotal > 0
                    ? Math.round(
                        (importProgress.setsDone /
                          importProgress.setsTotal) *
                          100,
                      )
                    : undefined
                }
              >
                <div
                  className={`h-full rounded-full bg-[var(--gold)] transition-[width] duration-500 ${
                    importing &&
                    (!importProgress || importProgress.setsTotal === 0)
                      ? "w-1/3 animate-pulse"
                      : ""
                  }`}
                  style={
                    importProgress && importProgress.setsTotal > 0
                      ? {
                          width: `${Math.min(
                            100,
                            Math.round(
                              (importProgress.setsDone /
                                importProgress.setsTotal) *
                                100,
                            ),
                          )}%`,
                        }
                      : undefined
                  }
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--dim)]">
                {importing
                  ? importProgress
                    ? `Downloading… ${importProgress.setsTotal > 0 ? `${importProgress.setsDone.toLocaleString()} of ${importProgress.setsTotal.toLocaleString()} ${unit} · ` : ""}${importProgress.cards.toLocaleString()} ${noun} so far`
                    : "Downloading…"
                  : "Download paused — progress is saved."}
              </p>
            </div>
          ) : null}
          {importNote ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]" role="status">
              {importNote}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Dead-end guard (Anthony, Nov 5, 2026 — the
          Garbage Pail Kids case): when the catalog query
          itself fails, the page must not sit silent with no
          sets and no control. This card always offers a way
          forward: retry the load, or run the catalog
          download with its progress bar. */}
      {!data && catalog.isError ? (
        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">
            This catalog didn&rsquo;t load
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            The sets couldn&rsquo;t be read just now. Retry the
            load, or run the catalog download — it picks up
            where it left off and shows its progress here.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void catalog.refetch()}
              className="flex-1 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--text)]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing}
              className="flex-1 rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
            >
              {importing ? t("game.downloading") : t("game.downloadCatalog")}
            </button>
          </div>
          {importNote ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]" role="status">
              {importNote}
            </p>
          ) : null}
        </div>
      ) : null}
      {data?.complete && game !== "funko" ? (
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
          onScan={
            game === "funko" ? () => barcodeWin.open() : onScan
          }
          scanLabel={game === "funko" ? "Scan barcode" : undefined}
        />
      </div>
      {gradedEligible ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => {
              setGradedFixedCard(null);
              gradedWin.open();
            }}
            aria-label="Scan a grading cert number"
            className="flex h-[34px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--gold-soft)] transition active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path d="M4 5v14M8 5v14M11 5v14M15 5v14M17.5 5v14M21 5v14" />
            </svg>
            Scan graded cert
          </button>
        </div>
      ) : null}
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
              {(
                game === "funko"
                  ? (search.data?.results ?? []).slice(0, 3)
                  : (search.data?.results ?? [])
              ).map((r: SearchCard) => (
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
                      game === "funko" ? (
                        <CutoutImg
                          src={r.imageUrl}
                          alt=""
                          placeholderText=""
                          proxyId={r.id}
                          className={`h-14 w-10 shrink-0 object-contain ${
                            r.ownedQty === 0
                              ? "opacity-40 grayscale-[40%]"
                              : ""
                          }`}
                        />
                      ) : (
                        <SafeImg
                          src={r.imageUrl}
                          alt=""
                          placeholderText=""
                          className={`h-14 w-10 shrink-0 rounded object-cover ${
                            r.ownedQty === 0
                              ? "opacity-40 grayscale-[40%]"
                              : ""
                          }`}
                        />
                      )
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
          {game === "funko" &&
          (search.data?.results ?? []).length > 3 ? (
            <p className="mt-2 text-xs text-[var(--dim)]">
              Showing the first 3 matches — keep typing to narrow it down.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Your shelf: what he owns in this section, FIRST
          (Anthony, Nov 4, 2026 — the Funko defect: his saved
          item was invisible behind a lone search field).
          Every game section leads with owned items; search is
          for adding more. */}
      {!searching &&
      sectionKey == null &&
      (ownedItems.data?.items ?? []).length > 0 ? (
        <div className="mt-5">
          <h2 className="font-album text-base text-[var(--text)]">
            Your shelf
          </h2>
          <ul className="mt-2 grid grid-cols-3 gap-2.5">
            {(ownedItems.data?.items ?? []).map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() =>
                    setDetail({
                      id: i.id,
                      name: i.name,
                      printed: i.printed,
                      sectionName: i.sectionName,
                      rarity: i.rarity,
                      finish: null,
                      imageUrl: i.imageUrl,
                      price: null,
                      ownedQty: i.ownedQty,
                      ownedSealedQty: i.ownedSealedQty,
                    })
                  }
                  aria-label={`${i.name}, owned ${i.ownedQty + i.ownedSealedQty}`}
                  className="block w-full text-left"
                >
                  {i.imageUrl ? (
                    game === "funko" || game === "lego" ? (
                      <CutoutImg
                        src={i.imageUrl}
                        alt=""
                        placeholderText="Image unavailable"
                        proxyId={i.id}
                        className={
                          game === "funko"
                            ? "aspect-[3/4] w-full object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.4)]"
                            : "aspect-[3/4] w-full rounded-lg object-cover"
                        }
                      />
                    ) : (
                      <SafeImg
                        src={i.imageUrl}
                        alt=""
                        placeholderText="Image unavailable"
                        className="aspect-[3/4] w-full rounded-lg object-cover"
                      />
                    )
                  ) : (
                    <span className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-1 text-center text-[10px] text-[var(--dim)]">
                      {gameIsDataOnly(game)
                        ? "Data only · no artwork"
                        : "No artwork link"}
                    </span>
                  )}
                  <span className="mt-1 block truncate text-[11px] font-medium leading-tight text-[var(--text)]">
                    {i.name}
                  </span>
                  <span className="block text-[10px] tabular-nums text-[var(--gold-soft)]">
                    ×{i.ownedQty + i.ownedSealedQty} owned
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Sets list, or one set's grid. */}
      {!searching && sectionKey == null ? (
        catalog.isPending ? (
          <p className="mt-4 text-sm text-[var(--dim)]">
            {t("game.loadingSets")}
          </p>
        ) : (data?.sections ?? []).length === 0 ? (
          <div className="mt-4 rounded-xl bg-[var(--surface)] px-3 py-3">
            <p className="text-sm leading-relaxed text-[var(--dim)]">
              No sets yet — the catalog download brings them
              in.
            </p>
            {/* Never a silent dead end (Anthony, Nov 5,
                2026): even an empty catalog page carries the
                download control with its progress. */}
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing}
              className="mt-3 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
            >
              {importing
                ? t("game.downloading")
                : data?.started
                  ? t("game.continueDownload")
                  : t("game.downloadCatalog")}
            </button>
            {importNote ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]" role="status">
                {importNote}
              </p>
            ) : null}
          </div>
        ) : (
          <>
          {allSections.length > ONLY_MINE_THRESHOLD ||
          ONLY_MINE_ALWAYS.has(game) ? (
            <div className="mt-4 flex items-center justify-end">
              <OnlyMineToggle section={game} />
            </div>
          ) : null}
          {shownSections.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[var(--surface)] px-3 py-3 text-sm leading-relaxed text-[var(--dim)]">
              Nothing here is in your collection yet — turn off
              Only mine to browse the full list.
            </p>
          ) : (
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--accent)] bg-[var(--surface)] px-4">
            {shownSections.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => openSection(s.key)}
                  aria-label={`Open ${s.name}`}
                  className="flex w-full items-center gap-2 py-3 text-left"
                >
                  {s.hasArt ? (
                    <SectionArtThumb
                      game={game}
                      sectionKey={s.key}
                      name={s.name}
                    />
                  ) : null}
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
          )}
          </>
        )
      ) : null}

      {!searching && sectionKey != null ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={closeSection}
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
                {(section.data?.cards ?? [])
                  .slice(0, gridReveal)
                  .map((c: SectionCard) => (
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
              gridReveal < (section.data.cards.length ?? 0) ? (
                <button
                  type="button"
                  onClick={() =>
                    setGridReveal((n) => n + 60)
                  }
                  className="mt-4 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
                >
                  Show more ({(section.data.cards.length ?? 0).toLocaleString()}{" "}
                  loaded of {section.data.total.toLocaleString()} in
                  this set)
                </button>
              ) : null}
              {section.data &&
              gridReveal >= (section.data.cards.length ?? 0) &&
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
          key={detail.id}
          game={game}
          card={detail}
          onClose={() => setDetail(null)}
          pendingUpc={game === "funko" ? pendingUpc : null}
          onLinkUpc={
            game === "funko" && pendingUpc
              ? () =>
                  linkUpc.mutate({ id: detail.id, upc: pendingUpc })
              : undefined
          }
          onAddGradedSlab={
            gradedEligible
              ? () => {
                  setGradedFixedCard(detail);
                  gradedWin.open();
                }
              : undefined
          }
          onOpenGradedSlab={
            gradedEligible
              ? (slab) => setSlabViewId(slab.id)
              : undefined
          }
        />
      ) : null}

      {gradedOpen && gradedEligible ? (
        <SlabCapturePanel
          game={game}
          fixedCard={gradedFixedCard}
          onClose={() => gradedWin.close()}
          onSavedSlab={(slab) => {
            // Anthony's flow: a saved scan lands directly on
            // the slab's Card / Slab View.
            gradedWin.close();
            setGradedFixedCard(null);
            window.setTimeout(() => setSlabViewId(slab.id), 60);
          }}
          onOpenExistingSlab={(slab) => {
            gradedWin.close();
            setGradedFixedCard(null);
            window.setTimeout(() => setSlabViewId(slab.id), 60);
          }}
        />
      ) : null}

      {slabViewId != null ? (
        <SlabDetailView
          slabId={slabViewId}
          onClose={() => setSlabViewId(null)}
        />
      ) : null}

      {barcodeOpen && game === "funko" ? (
        <FunkoBarcodeScanner
          onClose={() => barcodeWin.close()}
          onMatch={(card) => {
            // Consume the scanner's entry first, then open
            // the matched figure's sheet on its own entry —
            // the small delay lets the pop land so the two
            // windows never share one entry.
            barcodeWin.close();
            window.setTimeout(() => setDetail(card), 60);
          }}
          onNoMatch={(upc) => {
            setPendingUpc(upc);
            barcodeWin.close();
            document
              .getElementById(`game-search-${game}`)
              ?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
