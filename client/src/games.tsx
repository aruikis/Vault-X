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

import { useEffect, useState } from "react";
import {
useMutation,
useQuery,
useQueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { SearchScanRow } from "./searchScanRow";
import {
GridColsToggle,
useGridCols,
type GridCols,
} from "./gridCols";

export type GameKey = "pokemon" | "magic" | "starwars";

export const GAME_TITLES: Record<GameKey, string> = {
  pokemon: "Pokémon",
  magic: "Magic: The Gathering",
  starwars: "Star Wars Unlimited",
};

const GAME_SOURCE_LINES: Record<GameKey, string> = {
  pokemon:
    "Catalog: Pokémon TCG data (PokemonTCG/pokemon-tcg-data). Prices from TCGplayer where the source publishes them.",
  magic:
    "Catalog: Scryfall. Prices in USD where Scryfall publishes them.",
  starwars:
    "Catalog: Fantasy Flight's official Star Wars: Unlimited card database. That source publishes no prices, so none are shown.",
};

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
};

function fmtPrice(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const shownQty = cols === 2 ? qty : c.ownedQty;
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
          #{c.printed}
          {c.ownedQty > 0 ? ` · ×${c.ownedQty}` : ""}
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
        #{c.printed}
        {c.finish ? ` · ${c.finish}` : ""}
      </span>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={`Remove one copy of ${c.name}`}
          disabled={qty <= 0}
          onClick={() => step(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg leading-none text-[var(--text)] disabled:opacity-35"
        >
          −
        </button>
        <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
          {qty} owned
        </span>
        <button
          type="button"
          aria-label={`Add one copy of ${c.name}`}
          onClick={() => step(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg leading-none text-[var(--text)]"
        >
          +
        </button>
      </div>
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
  const queryClient = useQueryClient();
  const [owned, setOwned] = useState(card.ownedQty);
  const save = useMutation({
    mutationFn: (qty: number) =>
      api.setGameCardOwned({ id: card.id, ownedQty: qty }),
    onSuccess: (r) => {
      setOwned(r.ownedQty);
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
    save.mutate(next);
  };
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
          onClick={onClose}
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
          Back
        </button>
        <div className="mt-4 flex flex-col items-center">
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={`${card.name} card artwork`}
              className={`w-64 max-w-full rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] ${
                owned === 0 ? "opacity-50 grayscale-[30%]" : ""
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
            {card.sectionName} · #{card.printed}
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
              Copies owned
            </span>
            <button
              type="button"
              aria-label="Remove one copy"
              disabled={owned <= 0 || save.isPending}
              onClick={() => step(owned - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg font-bold text-[var(--text)] disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-8 text-center text-lg font-bold tabular-nums text-[var(--text)]">
              {owned}
            </span>
            <button
              type="button"
              aria-label="Add one copy"
              disabled={save.isPending}
              onClick={() => step(owned + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg font-bold text-[var(--text)] disabled:opacity-40"
            >
              +
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--dim)]">
            {owned === 0
              ? "Missing — shown ghosted in the set until you add a copy."
              : "In your collection."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GamePanel({
  game,
  onScan,
}: {
  game: GameKey;
  /** Opens the app's card scanner (the section top row's
      Scan pill, Nov 3, 2026). */
  onScan?: () => void;
}) {
  const queryClient = useQueryClient();
  // Grid density for this set page (shared per-user choice).
  const gridCols = useGridCols();
  const catalog = useQuery({
    queryKey: ["gameCatalog", game],
    queryFn: () => api.getGameCatalog({ game }),
  });
  const [sectionKey, setSectionKey] = useState<string | null>(null);
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
            `Catalog complete — ${r.cardsTotal.toLocaleString()} printings.`,
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
      <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
        {GAME_TITLES[game]}
      </h1>
      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
        {GAME_SOURCE_LINES[game]}
      </p>

      {/* Catalog download state — honest progress, always. */}
      {data && !data.complete ? (
        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">
            {data.started
              ? "Catalog download in progress"
              : "Catalog not downloaded yet"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            {data.cardsTotal > 0
              ? `${data.cardsTotal.toLocaleString()} printings cataloged so far${
                  data.setsTotal > 0
                    ? ` — ${data.setsDone.toLocaleString()} of ${data.setsTotal.toLocaleString()} ${
                        game === "starwars" ? "pages" : "sets"
                      }`
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
              ? "Downloading…"
              : data.started
                ? "Continue download"
                : "Download catalog"}
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
          {data.cardsTotal.toLocaleString()} printings cataloged ·{" "}
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
            <p className="text-sm text-[var(--dim)]">Searching…</p>
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
                        {r.sectionName} · #{r.printed}
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
            Loading sets…
          </p>
        ) : (data?.sections ?? []).length === 0 ? (
          <p className="mt-4 rounded-xl bg-[var(--surface)] px-3 py-3 text-sm leading-relaxed text-[var(--dim)]">
            No sets yet — the catalog download above brings them
            in, set by set.
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
                      {s.total.toLocaleString()} printings
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
            All sets
          </button>
          <div className="mt-3 flex items-center justify-between gap-2">
            <h2 className="font-album min-w-0 truncate text-lg text-[var(--text)]">
              {section.data?.sectionName ?? ""}
            </h2>
            <GridColsToggle />
          </div>
          {section.isPending ? (
            <p className="mt-3 text-sm text-[var(--dim)]">
              Loading cards…
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
