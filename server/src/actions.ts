// Actions for the Lorcana binder.
//
// Data flow: seedBinder loads the bundled catalog snapshot
// (server/src/data/catalog.ts — every printed Lorcana card: main sets 1-14,
// all promo families, Illumineer's Quest sets) joined with Anthony's
// ownership from his Nov 1 2026 Shiny export (server/src/data/ownership.ts,
// regenerated with per-finish value/paid — Regular and Cold Foil share one
// TCGplayer id in Shiny but carry different prices). On later loads the
// seed only backfills price fields from that export and seeds the finance
// history snapshots; it never overwrites ownership counts edited in the UI.
//
// Pockets: like Anthony's physical binders, a card number gets two adjacent
// pockets — regular first, foil next to it — each owned/ghosted on its own
// (getSection expands printings into pockets). Foil-only printings (Epics,
// Enchanteds, Iconics) and one-version promos/quests keep a single pocket.
//
// Finances: getFinance computes collection totals live from stored
// per-finish prices plus the sealed/token/puzzle items accounted in
// exportFinance.ts, so totals tie to the export (9,500 items, $4,418.05
// value, $4,854.70 paid at the Nov 1 2026 export). refreshFinance spawns a
// daily agent task that re-prices owned cards from current market prices
// and saves through saveRepricing, which also appends that day's point to
// the value-over-time history. Paid amounts are never re-priced.
//
// Card art is fetched lazily: cardImage pulls the official Ravensburger
// scan into blob storage the first time a pocket nears the viewport, then
// serves the owned copy. Missing cards use the same art, ghosted by the
// client. Sections render as one continuous scroll (getSection), 4 across.

import {
defineAction,
z,
type ActionsModule,
type Ctx,
} from "@hatch/space-sdk";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import * as schema from "./schema";
import { catalog } from "./data/catalog";
import { puzzleCatalog } from "./data/puzzleCatalog";
import type { CatalogEntry } from "./data/catalogTypes";
import { ownership } from "./data/ownership";
import { cardHistory } from "./data/cardHistory";
import { sealedHistory } from "./data/sealedHistory";
import { catalogPrices, PRICE_SNAPSHOT_DATE } from "./data/catalogPrices";
import { tcgplayerBackfill } from "./data/tcgplayerBackfill";
import {
exportBySet,
extraSealedItems,
historySeed,
nonBinderTotals,
sealedItems
} from "./data/exportFinance";

/** The full binder catalog: the LorcanaJSON snapshot plus the
    hand-authored puzzle/lore insert entries (data/puzzleCatalog.ts),
    which the upstream catalog does not carry. Seeding uses this
    combined list; scan matching keeps using the base catalog. */
const fullCatalog: CatalogEntry[] = [...catalog, ...puzzleCatalog];

/** Every sealed item the app knows: the Shiny-export items plus
    Anthony's hand-sourced additions (extraSealedItems — currently
    the Japanese-edition First Chapter pack, priced from SNKRDUNK
    rather than TCGplayer/Shiny). All sealed reads go through this
    merged list so the additions get the same shelf, detail, totals,
    and price-alert treatment as the export items. */
const allSealedItems = [...sealedItems, ...extraSealedItems];

const PAGE_SIZE = 12; // 4 across x 3 down, like his Vault X binder pages

/** Sealed items with Anthony's quantity overrides applied (the
    sealed_qty table; adjusted via the plus/minus controls on the
    Sealed shelf). The export list carries each item's value/paid as
    totals at the export quantity (1 each); effective items carry
    totals at the current quantity, so finance math that sums
    item.value / item.paid stays correct at any quantity. */
async function effectiveSealed(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const overrides = await db.select().from(schema.sealedQty);
  const byName = new Map(overrides.map((r) => [r.name, r.qty]));
  const dateByName = new Map(
    overrides.map((r) => [r.name, r.updatedAt ?? null]),
  );
  const items = allSealedItems.map((item) => {
    const qty = byName.get(item.name) ?? item.qty;
    const unitValue = item.qty > 0 ? item.value / item.qty : item.value;
    const unitPaid = item.qty > 0 ? item.paid / item.qty : item.paid;
    const unitJpy =
      item.jpyValue != null && item.qty > 0
        ? item.jpyValue / item.qty
        : (item.jpyValue ?? null);
    return {
      name: item.name,
      setName: item.setName,
      qty,
      /** Market value per single unit — what a qty-0 catalog
          item (selectable, not yet owned) shows on its tile,
          where the totals below are legitimately zero. */
      unitValue: Math.round(unitValue * 100) / 100,
      value: Math.round(unitValue * qty * 100) / 100,
      paid: Math.round(unitPaid * qty * 100) / 100,
      /** Total market value in yen for Japanese-edition items
          (null for everything else) — the shelf tile shows it
          alongside the USD value. */
      jpyValue: unitJpy != null ? Math.round(unitJpy * qty) : null,
      marketSourceLabel: item.marketSourceLabel ?? null,
      /** When this item's quantity was last set in the app —
          the honest "date acquired" for the Sealed date sort.
          Null when it never was (export items carry no date). */
      acquiredAt: dateByName.get(item.name) ?? null,
    };
  });
  return {
    items,
    totals: {
      qty: items.reduce((s, i) => s + i.qty, 0),
      value: Math.round(items.reduce((s, i) => s + i.value, 0) * 100) / 100,
      paid: Math.round(items.reduce((s, i) => s + i.paid, 0) * 100) / 100,
    },
  };
}

const FAMILY_ORDER = [
  "P1",
  "P2",
  "P3",
  "P4",
  "PD1",
  "D23",
  "C1",
  "C2",
  "CC1",
  "DIS",
  "RPH",
];

function groupSortOf(entry: CatalogEntry): number {
  if (entry.grp === "set") return Number.parseInt(entry.setCode, 10) || 99;
  // Puzzle sections sort right after their own set (41-54), before
  // the promo families (100+) and quests (200+). They never render
  // as picker tiles — the client appends them inside the set page.
  if (entry.grp === "puzzle")
    return 40 + (Number.parseInt(entry.setCode, 10) || 99);
  if (entry.grp === "quest")
    return 200 + (Number.parseInt(entry.setCode.slice(1), 10) || 9);
  const idx = FAMILY_ORDER.indexOf(entry.family ?? "");
  return 100 + (idx >= 0 ? idx : 50);
}

function groupKeyOf(entry: CatalogEntry): string {
  if (entry.grp === "set") return `set:${entry.setCode}`;
  if (entry.grp === "puzzle") return `puzzle:${entry.setCode}`;
  if (entry.grp === "quest") return `quest:${entry.setCode}`;
  return `promo:${entry.family ?? "P1"}`;
}

function groupLabelOf(entry: CatalogEntry): string {
  if (entry.grp === "set") return `Set ${entry.setCode}`;
  if (entry.grp === "puzzle") return "Puzzle";
  if (entry.grp === "quest") return `Quest ${entry.setCode}`;
  return entry.family ?? "Promo";
}

function parseFinishes(raw: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "number" && v > 0) out[k] = v;
      }
      return out;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

const cardLite = z.object({
  id: z.number(),
  fullName: z.string(),
  printed: z.string(),
  rarity: z.string().nullable(),
  ink: z.string().nullable(),
  ownedQty: z.number(),
  finishes: z.record(z.string(), z.number()),
  /** Which pocket of the card number this is: regular, foil, or single. */
  pocket: z.enum(["regular", "foil", "single"]),
  /** Pocket display label, e.g. "Regular", "Cold Foil", "Promo Foil". */
  pocketLabel: z.string(),
});

type CardLite = z.infer<typeof cardLite>;

const FOIL_FINISHES = [
  "Cold Foil",
  "Epic Foil",
  "Enchanted",
  "Enchanted Foil",
  "Promo Foil",
  "Promo Cold Foil",
  "Foil",
];

function isFoilFinish(finish: string): boolean {
  return FOIL_FINISHES.includes(finish);
}

interface Pocket {
  kind: "regular" | "foil" | "single";
  label: string;
  qty: number;
  finishes: Record<string, number>;
}

/** Splits one printing into binder pockets the way Anthony's physical
    binders work: regular pocket first, foil pocket right next to it, each
    owned/ghosted independently. Foil-only printings and printings he only
    has in one version family keep a single pocket. */
function pocketsOf(row: typeof schema.cards.$inferSelect): Pocket[] {
  const finishes = parseFinishes(row.finishes);
  // Puzzle / lore insert cards (Anthony, Nov 3, 2026): a single
  // pocket each — they are one-per-pack inserts with no regular /
  // foil split, owned and ghosted like any other slot.
  if (row.grp === "puzzle") {
    return [
      {
        kind: "single",
        label: row.rarity === "Lore" ? "Lore" : "Puzzle",
        qty: row.ownedQty,
        finishes,
      },
    ];
  }
  const regFinishes: Record<string, number> = {};
  const foilFinishes: Record<string, number> = {};
  let regQty = 0;
  let foilQty = 0;
  for (const [finish, qty] of Object.entries(finishes)) {
    if (isFoilFinish(finish)) {
      foilFinishes[finish] = qty;
      foilQty += qty;
    } else {
      regFinishes[finish] = qty;
      regQty += qty;
    }
  }
  const foilOnlyPrinting =
    row.rarity === "Epic" || row.rarity === "Enchanted" || row.rarity === "Iconic";
  const foilLabel =
    Object.keys(foilFinishes)[0] ??
    (row.grp === "promo" ? "Promo Foil" : "Cold Foil");
  const regLabel = Object.keys(regFinishes)[0] ?? "Regular";
  if (foilOnlyPrinting) {
    return [
      {
        kind: "single",
        label:
          Object.keys(foilFinishes)[0] ??
          (row.rarity === "Epic" ? "Epic Foil" : (row.rarity ?? "Foil")),
        qty: row.ownedQty,
        finishes,
      },
    ];
  }
  const baseSetCard = row.grp === "set";
  if (baseSetCard || (regQty > 0 && foilQty > 0)) {
    return [
      { kind: "regular", label: regLabel, qty: regQty, finishes: regFinishes },
      { kind: "foil", label: foilLabel, qty: foilQty, finishes: foilFinishes },
    ];
  }
  return [
    {
      kind: "single",
      label: foilQty > 0 ? foilLabel : regLabel,
      qty: row.ownedQty,
      finishes,
    },
  ];
}

function toLite(
  row: typeof schema.cards.$inferSelect,
  pocket: Pocket,
): CardLite {
  return {
    id: row.id,
    fullName: row.fullName,
    printed: row.printed,
    rarity: row.rarity,
    ink: row.ink,
    ownedQty: pocket.qty,
    finishes: pocket.finishes,
    pocket: pocket.kind,
    pocketLabel: pocket.label,
  };
}

/** Expands printings into pockets and applies the owned/missing filter
    per pocket. */
function toPockets(
  rows: (typeof schema.cards.$inferSelect)[],
  filter: "all" | "owned" | "missing",
): CardLite[] {
  const out: CardLite[] = [];
  for (const row of rows) {
    for (const pocket of pocketsOf(row)) {
      if (filter === "owned" && pocket.qty <= 0) continue;
      if (filter === "missing" && pocket.qty > 0) continue;
      out.push(toLite(row, pocket));
    }
  }
  return out;
}

interface FinishPrice {
  value: number;
  paid: number;
}

function parseFinance(raw: string | null): Record<string, FinishPrice> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, FinishPrice> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const rec = v as Record<string, unknown>;
          if (typeof rec.value === "number" && typeof rec.paid === "number") {
            out[k] = { value: rec.value, paid: rec.paid };
          }
        }
      }
      return out;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

function financeJsonOf(
  own: (typeof ownership)[string] | undefined,
): string | null {
  if (!own) return null;
  const out: Record<string, FinishPrice> = {};
  for (const [finish, fin] of Object.entries(own.byFinish)) {
    out[finish] = { value: fin.value, paid: fin.paid };
  }
  return JSON.stringify(out);
}

/** Exact value/paid for a card from its per-finish prices and current
    finish counts; falls back to the stored per-unit averages for any
    finish without a recorded price. */
function cardMoney(row: typeof schema.cards.$inferSelect): {
  value: number;
  paid: number;
} {
  if (row.ownedQty <= 0) return { value: 0, paid: 0 };
  const finishes = parseFinishes(row.finishes);
  const prices = parseFinance(row.financeJson);
  let value = 0;
  let paid = 0;
  let pricedQty = 0;
  for (const [finish, qty] of Object.entries(finishes)) {
    const price = prices[finish];
    if (price) {
      value += price.value * qty;
      paid += price.paid * qty;
      pricedQty += qty;
    }
  }
  const rest = row.ownedQty - pricedQty;
  if (rest > 0) {
    value += (row.marketValue ?? 0) * rest;
    paid += (row.paidValue ?? 0) * rest;
  }
  return { value, paid };
}

/** Snapshot seed rows shared by seedBinder (inserted once, when the
    finance_snapshots table is still empty). */
const HISTORY_ROWS = historySeed.map((h) => ({
  date: h.date,
  label: h.label,
  value: h.value,
  paid: h.paid,
  cards: h.cards,
  source: "export",
}));

/** Seed rows for card_price_history, flattened from the bundled per-card
    export history (inserted once, when the table is still empty). */
const CARD_HISTORY_ROWS = Object.entries(cardHistory).flatMap(([uid, points]) =>
  points.map((pt) => ({
    uid,
    date: pt.date,
    label: pt.label,
    unitValue: pt.value,
    source: "export",
  })),
);

/** Seed rows for sealed_price_history, flattened from the bundled
    per-item history (the getSealedItem action checks, since the
    binder seed only runs on a genuinely empty binder). */
const SEALED_HISTORY_ROWS = Object.entries(sealedHistory).flatMap(
  ([name, points]) =>
    points.map((pt) => ({
      name,
      date: pt.date,
      label: pt.label,
      unitValue: pt.value,
      source: pt.source ?? "export",
    })),
);

/** Insert any bundled sealed-history points the table doesn't have
    yet — the full seed on an empty table, and just the new points
    when a hand-sourced item (the Japanese-edition pack) is added
    after the table was already seeded. Existing rows are never
    touched or duplicated: a point is identified by name + date +
    label. */
async function ensureSealedHistory(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const existing = await db
    .select({
      name: schema.sealedPriceHistory.name,
      date: schema.sealedPriceHistory.date,
      label: schema.sealedPriceHistory.label,
    })
    .from(schema.sealedPriceHistory);
  const have = new Set(
    existing.map((r) => `${r.name}|${r.date}|${r.label}`),
  );
  const missing = SEALED_HISTORY_ROWS.filter(
    (r) => !have.has(`${r.name}|${r.date}|${r.label}`),
  );
  if (missing.length > 0) {
    await db.insert(schema.sealedPriceHistory).values(missing);
  }
}

/** Whether a pocket holds the foil version of its printing. */
function pocketIsFoil(
  row: typeof schema.cards.$inferSelect,
  pocket: Pocket,
): boolean {
  return (
    pocket.kind === "foil" ||
    isFoilFinish(pocket.label) ||
    row.rarity === "Epic" ||
    row.rarity === "Enchanted" ||
    row.rarity === "Iconic"
  );
}

/** A card's TCGplayer product ID: the stored column when set, else
    the ID recovered from Anthony's Shiny exports (see
    data/tcgplayerBackfill.ts — the catalog snapshot had no ID at all
    for Hyperia City). seedBinder's backfill persists these into the
    column; this fallback makes every read path see them immediately. */
function tcgIdOf(row: { uid: string; tcgplayerId: string | null }): string | null {
  return row.tcgplayerId ?? tcgplayerBackfill[row.uid] ?? null;
}

/** Current market price for one pocket (one finish of one printing):
    the database's per-finish price when tracked (his Shiny export for
    owned finishes; the daily re-pricing now prices the whole catalog),
    else the Lorcast snapshot price for the printing's TCGplayer id,
    else null — the price is not tracked anywhere, and the completion
    views disclose those pockets instead of guessing. */
function pocketPrice(
  row: typeof schema.cards.$inferSelect,
  pocket: Pocket,
): number | null {
  const prices = parseFinance(row.financeJson);
  const direct = prices[pocket.label];
  if (direct != null) return direct.value;
  const foil = pocketIsFoil(row, pocket);
  for (const [finish, price] of Object.entries(prices)) {
    if (isFoilFinish(finish) === foil) return price.value;
  }
  const tcgId = tcgIdOf(row);
  const snap = tcgId ? catalogPrices[tcgId] : undefined;
  if (snap) {
    const v = foil ? (snap.usdFoil ?? snap.usd) : snap.usd;
    if (v != null) return v;
  }
  return null;
}

/** Market value for one named finish of one printing, for the
    trade/cash pricing paths (Nov 3, 2026 — the Mickey Mouse -
    Brave Little Tailor fix): the same fallback chain pocketPrice
    uses. resolveCashPrice previously read ONLY the binder row's
    finance, so any printing the agent-driven daily re-pricing
    had not landed a database price for — Mickey, which Anthony
    does not own and whose repricing saves never arrived — priced
    as null in the cash checkout, on the friend's profile, and in
    trade totals, even though the Lorcast snapshot carries its
    real price. Chain: the finish's tracked database price, else
    a same-foil tracked price, else the Lorcast snapshot price
    for the printing's TCGplayer id, else the row's weighted
    market value, else null (genuinely untracked anywhere). */
function cardFinishMarketValue(
  row: typeof schema.cards.$inferSelect,
  finish: string,
): number | null {
  const prices = parseFinance(row.financeJson);
  const direct = prices[finish]?.value;
  if (direct != null && direct > 0) return direct;
  const foil = isFoilFinish(finish);
  for (const [f, p] of Object.entries(prices)) {
    if (isFoilFinish(f) === foil && p.value > 0) return p.value;
  }
  const tcgId = tcgIdOf(row);
  const snap = tcgId ? catalogPrices[tcgId] : undefined;
  if (snap) {
    const v = foil ? (snap.usdFoil ?? snap.usd) : snap.usd;
    if (v != null && v > 0) return v;
  }
  if (row.marketValue != null && row.marketValue > 0)
    return row.marketValue;
  return null;
}

export interface MissingPocket {
  cardId: number;
  fullName: string;
  printed: string;
  rarity: string | null;
  finishLabel: string;
  price: number | null;
  tcgplayerId: string | null;
}

/** Every missing pocket in the given rows, with its current price —
    completion here means the COMPLETE set: every printing and finish,
    Enchanteds and Iconics included (Anthony's correction: the app
    feature must not bake in his personal master-set rule). */
function missingPocketsOf(
  rows: (typeof schema.cards.$inferSelect)[],
): MissingPocket[] {
  const missing: MissingPocket[] = [];
  for (const row of rows) {
    for (const pocket of pocketsOf(row)) {
      if (pocket.qty > 0) continue;
      missing.push({
        cardId: row.id,
        fullName: row.fullName,
        printed: row.printed,
        rarity: row.rarity,
        finishLabel: pocket.label,
        price: pocketPrice(row, pocket),
        tcgplayerId: tcgIdOf(row),
      });
    }
  }
  return missing;
}

function completionOf(rows: (typeof schema.cards.$inferSelect)[]) {
  const missing = missingPocketsOf(rows);
  const cost = missing.reduce((sum, m) => sum + (m.price ?? 0), 0);
  return {
    missing,
    missingCount: missing.length,
    costToComplete: Math.round(cost * 100) / 100,
    unpricedMissing: missing.filter((m) => m.price == null).length,
  };
}


const seedResponse = z.object({
  seeded: z.boolean(),
  slots: z.number(),
  ownedSlots: z.number(),
  ownedQty: z.number(),
});

const binderResponse = z.object({
  groups: z.array(
    z.object({
      key: z.string(),
      kind: z.string(),
      name: z.string(),
      label: z.string(),
      total: z.number(),
      owned: z.number(),
      pages: z.number(),
      /** Pockets (printings × finishes) still missing in this section. */
      missingPockets: z.number(),
      /** Market cost to buy every missing pocket in this section —
          the complete set, Enchanteds and Iconics included. */
      costToComplete: z.number(),
      /** Missing pockets with no tracked price (excluded from the cost). */
      unpricedMissing: z.number(),
    }),
  ),
  totals: z.object({
    slots: z.number(),
    ownedSlots: z.number(),
    missingSlots: z.number(),
    ownedQty: z.number(),
  }),
});

const pageResponse = z.object({
  cards: z.array(cardLite),
  page: z.number(),
  pageCount: z.number(),
  total: z.number(),
});

const sectionResponse = z.object({
  cards: z.array(cardLite),
  total: z.number(),
});

const cardDetailResponse = z.object({
  id: z.number(),
  fullName: z.string(),
  groupName: z.string(),
  groupLabel: z.string(),
  printed: z.string(),
  rarity: z.string().nullable(),
  ink: z.string().nullable(),
  cost: z.number().nullable(),
  inkwell: z.boolean(),
  cardType: z.string().nullable(),
  subtypes: z.string().nullable(),
  strength: z.number().nullable(),
  willpower: z.number().nullable(),
  lore: z.number().nullable(),
  cardText: z.string().nullable(),
  ownedQty: z.number(),
  finishes: z.record(z.string(), z.number()),
  marketValue: z.number().nullable(),
  /** TCGplayer product id for the Best Offer link, when known. */
  tcgplayerId: z.string().nullable(),
  /** This card's own finances: per-finish value/paid and gain/loss. */
  finance: z.object({
    byFinish: z.array(
      z.object({
        finish: z.string(),
        qty: z.number(),
        valuePerUnit: z.number().nullable(),
        paidPerUnit: z.number().nullable(),
        valueTotal: z.number(),
        paidTotal: z.number(),
      }),
    ),
    valueTotal: z.number(),
    paidTotal: z.number(),
    net: z.number(),
    /** Most recent pricing snapshot label, e.g. "Nov 1 (latest)". */
    asOfLabel: z.string(),
  }),
  /** This printing's value per copy at each tracked snapshot, oldest first. */
  priceHistory: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      value: z.number(),
      source: z.string(),
    }),
  ),
});

const financeResponse = z.object({
  /** Label of the most recent pricing snapshot, e.g. "Nov 1 (latest)". */
  asOfLabel: z.string(),
  /** Export-scope totals (binder cards + sealed + tokens/puzzle), live. */
  cards: z.number(),
  value: z.number(),
  paid: z.number(),
  net: z.number(),
  avgPerCard: z.number(),
  /** Binder-cards-only totals, live. */
  binderCards: z.number(),
  binderValue: z.number(),
  binderPaid: z.number(),
  /** Value held in foil-family finishes, and its share of binder value. */
  foilValue: z.number(),
  foilSharePct: z.number(),
  distinctOwned: z.number(),
  avgPerDistinct: z.number(),
  unpricedOwnedQty: z.number(),
  spareCopies: z.number(),
  spareValue: z.number(),
  beyondPlaysetCopies: z.number(),
  beyondPlaysetValue: z.number(),
  top10SharePct: z.number(),
  /** Per-set figures from the Nov 1 2026 export itself (all sets). */
  bySet: z.array(
    z.object({
      name: z.string(),
      cards: z.number(),
      value: z.number(),
      paid: z.number(),
      net: z.number(),
      main: z.boolean(),
    }),
  ),
  /** Chart series: the 14 main sets (live value/paid, incl. their sealed
      items at export prices) plus one "Promos & quests" row. */
  setsChart: z.array(
    z.object({ name: z.string(), value: z.number(), paid: z.number() }),
  ),
  byRarity: z.array(
    z.object({
      rarity: z.string(),
      value: z.number(),
      ownedQty: z.number(),
      distinct: z.number(),
    }),
  ),
  tiers: z.array(
    z.object({ label: z.string(), copies: z.number(), value: z.number() }),
  ),
  /** Most valuable items owned, binder cards and sealed products merged. */
  topItems: z.array(
    z.object({
      id: z.number().nullable(),
      name: z.string(),
      groupName: z.string(),
      printed: z.string().nullable(),
      rarity: z.string().nullable(),
      qty: z.number(),
      unitValue: z.number(),
      totalValue: z.number(),
      paidTotal: z.number(),
      sealed: z.boolean(),
    }),
  ),
  /** Value-over-time points, oldest first; starts Oct 25, 2026. */
  history: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      value: z.number(),
      paid: z.number(),
      cards: z.number(),
      source: z.string(),
    }),
  ),
});

const imageResponse = z.object({ url: z.string().nullable() });

const updateResponse = z.object({ ownedQty: z.number() });

const searchResponse = z.object({
  results: z.array(
    z.object({
      cardId: z.number(),
      fullName: z.string(),
      groupKey: z.string(),
      groupName: z.string(),
      printed: z.string(),
      ownedQty: z.number(),
      position: z.number(),
      /** Extra fields so the scan screen's "wrong card" search
          can render a full result row (finish picker, value). */
      rarity: z.string().nullable(),
      finishes: z.record(z.string(), z.number()),
      marketValue: z.number().nullable(),
      suggestedFinish: z.string(),
    }),
  ),
});

/** Anthony's collector identity (the oval Collector ID card at the
    top of Home): one profile row, created on first read with his
    established handle ARUIKIS (his Shiny handle and gamer tag) as the
    starting username — fully editable in the UI — and a collector
    code generated once and never changed, so the QR code that
    encodes username + code is a stable unique identifier. */
const COLLECTOR_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCollectorCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map(
    (b) => COLLECTOR_CODE_ALPHABET[b % COLLECTOR_CODE_ALPHABET.length],
  );
  return `MC-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

async function ensureCollectorProfile(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.collectorProfile)
    .where(eq(schema.collectorProfile.id, 1))
    .limit(1);
  const existing = rows[0];
  if (existing) return existing;
  const profile = {
    id: 1,
    // His Vault X display styling (Nov 3, 2026): "ARuikis" —
    // capital A, capital R, then lowercase — in the app; his
    // cross-platform gamer tag stays ARUIKIS elsewhere.
    username: "ARuikis",
    collectorCode: newCollectorCode(),
    photoBlobKey: null as string | null,
    bannerBlobKey: null as string | null,
    theme: null as string | null,
    tradeMode: null as string | null,
    tradeAvailability: null as string | null,
    registrySyncedAt: null as string | null,
    exampleAlertDismissed: 0,
    updateTestSeen: 0,
    envelopeTestSeen: 0,
    sealedIntroHidden: 0,
    socialIntroHidden: 0,
    homeIntroHidden: 0,
    zelleHandle: null as string | null,
    howTradesWorkHidden: 0,
    shareCollection: 1,
    welcomeSeen: 0,
    registeredAt: null as string | null,
    hiddenCollections: null as string | null,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(schema.collectorProfile).values(profile);
  return profile;
}

const collectorIdResponse = z.object({
  username: z.string(),
  collectorCode: z.string(),
  photoUrl: z.string().nullable(),
  /** The optional profile banner image URL, or null when the user
      has not added one (banners are opt-in; default is none). */
  bannerUrl: z.string().nullable(),
  /** The theme picked in Settings, or null when never picked (the
      default Vault Dark applies). */
  theme: z.string().nullable(),
  /** Whether the one-time TEST of the Home "Update available"
      indicator has already been tapped away. */
  updateTestSeen: z.boolean(),
  /** Whether connected friends can see this collector's
      collection (Settings > Sharing; ON by default). */
  shareCollection: z.boolean(),
});

/** Central collector registry — the Vault X Supabase project
    (Anthony's central-server route, Nov 2, 2026): project
    "Vault X", East US (Ohio), verified Healthy that evening.
    Usernames and collector codes live server-side in its `profiles`
    table (columns: id, collector_id UNIQUE, username, photo_url,
    trust_score, created_at) so collectors on different phones can
    find each other by code. The project URL and publishable key
    below are the project's PUBLIC client credentials — Supabase
    publishable keys are designed to be embedded in client apps
    (collected read-only from the dashboard Nov 2, 2026 and saved
    for exactly this wiring); data protection is the table's Row
    Level Security job. The project's secret key is NOT here and
    must never be embedded. Verified live while wiring this up
    (Nov 2, 2026, ~7:02 PM CST): `profiles` already held the Jarvis
    test friend (MC-JARVIS, trust 5) and the earlier dummy test
    friend (MC-TEST-DUMMY, trust 12), `collection_items` held the
    dummy's 3 cards, and a publishable-key upsert keyed on
    collector_id succeeded — so this wiring registers Anthony's own
    profile into that same live table and reads it back to prove it
    landed. */
const SUPABASE_PROJECT_URL = "https://iilsbousebrgkmsimucq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Qi1YZXJNCbiDSTs0pn3fQA_MKai5qNX";

/** The Jarvis test friend's registry identity — the same constants
    the client renders (JARVIS_FRIEND in App.tsx). Registered and
    verified alongside Anthony's own profile so the test user he
    asked about is provably on the server, not just drawn in the
    app. */
const JARVIS_REGISTRY_PROFILE = {
  collector_id: "MC-JARVIS",
  username: "Jarvis",
  trust_score: 5,
} as const;

/** Anthony's own Collector ID — his stable, never-changed code.
    The Admin area in Settings (app-wide statistics) is gated on
    it twice: this action withholds the server stats from any
    profile whose code isn't his, and the client only renders the
    Admin section when this action confirms the owner. */
const OWNER_COLLECTOR_CODE = "MC-XFU8-Z5WD";

/** The two built-in test profiles on the server — labeled as test
    data wherever the Admin stats show them, never dressed up as
    real users. */
const TEST_COLLECTOR_CODES: ReadonlySet<string> = new Set([
  JARVIS_REGISTRY_PROFILE.collector_id,
  "MC-TEST-DUMMY",
]);

const adminStatsResponse = z.object({
  /** True only for Anthony's own profile; every other field is
      empty/null when false — the stats are withheld, not faked. */
  isOwner: z.boolean(),
  /** True when the Supabase registry answered. */
  reachable: z.boolean(),
  users: z
    .object({
      total: z.number(),
      newThisWeek: z.number(),
      roster: z.array(
        z.object({
          collectorId: z.string(),
          username: z.string(),
          trustScore: z.number(),
          /** Copies stored for this collector in collection_items. */
          itemsOwned: z.number(),
          joinedAt: z.string(),
          isTest: z.boolean(),
          isYou: z.boolean(),
        }),
      ),
    })
    .nullable(),
  activity: z
    .object({
      /** Total copies logged app-wide (sum of qty). */
      totalCopies: z.number(),
      /** Total collection_items rows. */
      totalRows: z.number(),
      byKind: z.array(
        z.object({ kind: z.string(), copies: z.number() }),
      ),
      cardsLogged: z.number(),
      avgPerCollector: z.number(),
      largest: z
        .object({ username: z.string(), items: z.number() })
        .nullable(),
      mostOwned: z.array(
        z.object({
          name: z.string(),
          copies: z.number(),
          owners: z.number(),
        }),
      ),
    })
    .nullable(),
  social: z.object({
    /** Null when that table couldn't be read. */
    connections: z.number().nullable(),
    confirmedConnections: z.number().nullable(),
    trustEvents: z.number().nullable(),
    confirmedTrades: z.number().nullable(),
  }),
  /** Daily counts for the Admin bar charts (refined Nov 3,
      2026): the last 14 days, oldest first, counted from the
      server registry itself — profiles by their created_at,
      trades by the trade trust events' created_at. Real rows
      only; a quiet day is an honest zero bar. */
  series: z.object({
    usersByDay: z.array(
      z.object({
        date: z.string(),
        label: z.string(),
        count: z.number(),
      }),
    ),
    tradesByDay: z.array(
      z.object({
        date: z.string(),
        label: z.string(),
        count: z.number(),
      }),
    ),
  }),
  /** Deal flow recorded in the app's own database (this
      device's trades, cash purchases, listings, and change
      requests) — kept separate from the app-wide registry
      numbers above and labeled as such in the panel. Null for
      non-owners (withheld with the rest). */
  deals: z
    .object({
      tradesProposed: z.number(),
      tradesAccepted: z.number(),
      tradesCompleted: z.number(),
      cashPurchases: z.number(),
      cashCompleted: z.number(),
      listingsActive: z.number(),
      listingsTotal: z.number(),
      dealsCompleted: z.number(),
      pendingChangeRequests: z.number(),
    })
    .nullable(),
  system: z.object({
    registrySyncedAt: z.string().nullable(),
    /** Latest finance snapshot (daily re-pricing / export point),
        e.g. "Nov 2 · 2026-11-02"; null before any snapshot. */
    lastPriceSnapshot: z.string().nullable(),
    /** Rows stored across the four registry tables — the honest
        size proxy: Supabase doesn't expose the database's byte
        size to the app's publishable key. */
    storedRows: z.number(),
    /** Supabase storage usage for the Admin panel (Nov 2, 2026):
        the free plan's allotments are fixed (500 MB database,
        1 GB file storage); used amounts are measured/estimated
        from the live project — the database figure is an estimate
        from real row counts and sampled row sizes, since the
        exact byte size isn't exposed to the app. */
    storage: z.object({
      dbAllotmentMb: z.number(),
      /** Estimated database size in MB from live row data. */
      dbUsedMb: z.number(),
      fileAllotmentMb: z.number(),
      /** File storage in MB, summed from the storage buckets'
          object sizes when they can be listed. */
      fileUsedMb: z.number(),
      /** False when the file-storage listing couldn't be read
          (fileUsedMb is then 0 because Vault X stores its files
          in the app's own storage, not on Supabase). */
      fileMeasured: z.boolean(),
    }),
  }),
  /** Anthony's own collection, from this device's data — kept
      separate from the app-wide server numbers. */
  own: z.object({
    cardCopies: z.number(),
    distinctCards: z.number(),
    sealedQty: z.number(),
    lorcanaValue: z.number(),
  }),
});

type RegistryProfileRow = {
  collector_id: string;
  username: string;
  trust_score: number;
  created_at: string;
};

async function supabaseRest(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: unknown }> {
  try {
    const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/${path}`, {
      method: init?.method ?? "GET",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        ...(init?.method === "POST"
          ? {
              Prefer: "resolution=merge-duplicates,return=representation",
            }
          : {}),
      },
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
    });
    const json: unknown = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

/** Supabase free-plan storage allotments (Admin storage panel). */
const SUPABASE_DB_ALLOTMENT_MB = 500;
const SUPABASE_FILE_ALLOTMENT_MB = 1024;

const EMPTY_STORAGE = {
  dbAllotmentMb: SUPABASE_DB_ALLOTMENT_MB,
  dbUsedMb: 0,
  fileAllotmentMb: SUPABASE_FILE_ALLOTMENT_MB,
  fileUsedMb: 0,
  fileMeasured: false,
};

/** Estimates one table's stored size: the exact row count comes
    from PostgREST's count header, and the average row size from
    a real sample of up to 100 rows (JSON bytes). An estimate —
    Supabase doesn't expose the true byte size to the app. */
async function supabaseTableEstimate(
  table: string,
): Promise<{ rows: number; bytes: number } | null> {
  try {
    const countRes = await fetch(
      `${SUPABASE_PROJECT_URL}/rest/v1/${table}?select=*&limit=1`,
      {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    const range = countRes.headers.get("content-range");
    const total = range
      ? Number.parseInt(range.split("/")[1] ?? "", 10)
      : Number.NaN;
    if (!Number.isFinite(total)) return null;
    const sample = await supabaseRest(`${table}?select=*&limit=100`);
    let avgBytes = 0;
    if (sample.ok && Array.isArray(sample.json) && sample.json.length > 0) {
      avgBytes =
        sample.json.reduce(
          (s, r) => s + JSON.stringify(r).length,
          0,
        ) / sample.json.length;
    }
    return { rows: total, bytes: Math.round(total * avgBytes) };
  } catch {
    return null;
  }
}

/** Measures file storage on Supabase by listing its buckets and
    summing object sizes. Vault X keeps its photos and files in
    the app's own storage, so the honest expected result is no
    buckets and 0 MB; measured=false when the listing can't be
    read at all. */
async function supabaseFileStorage(): Promise<{
  mb: number;
  measured: boolean;
}> {
  try {
    const headers = {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    };
    const res = await fetch(`${SUPABASE_PROJECT_URL}/storage/v1/bucket`, {
      headers,
    });
    if (!res.ok) return { mb: 0, measured: false };
    const buckets: unknown = await res.json().catch(() => null);
    if (!Array.isArray(buckets)) return { mb: 0, measured: false };
    let bytes = 0;
    for (const bucket of buckets) {
      if (typeof bucket !== "object" || bucket === null) continue;
      const id = (bucket as Record<string, unknown>).id;
      if (typeof id !== "string") continue;
      const list = await fetch(
        `${SUPABASE_PROJECT_URL}/storage/v1/object/list/${encodeURIComponent(id)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ limit: 1000, offset: 0, prefix: "" }),
        },
      );
      if (!list.ok) continue;
      const objects: unknown = await list.json().catch(() => null);
      if (!Array.isArray(objects)) continue;
      for (const obj of objects) {
        if (typeof obj !== "object" || obj === null) continue;
        const meta = (obj as Record<string, unknown>).metadata;
        if (typeof meta === "object" && meta !== null) {
          const size = (meta as Record<string, unknown>).size;
          if (typeof size === "number") bytes += size;
        }
      }
    }
    return { mb: Math.round((bytes / 1_000_000) * 100) / 100, measured: true };
  } catch {
    return { mb: 0, measured: false };
  }
}

function asRegistryRows(json: unknown): RegistryProfileRow[] {
  if (!Array.isArray(json)) return [];
  const rows: RegistryProfileRow[] = [];
  for (const raw of json) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.collector_id === "string" &&
      typeof r.username === "string"
    ) {
      rows.push({
        collector_id: r.collector_id,
        username: r.username,
        trust_score:
          typeof r.trust_score === "number" ? r.trust_score : 0,
        created_at:
          typeof r.created_at === "string" ? r.created_at : "",
      });
    }
  }
  return rows;
}

/** Upserts one profile into the Supabase `profiles` table, keyed on
    the unique collector_id, then reads the row back — a profile
    only counts as registered when the read-back shows it. */
async function upsertRegistryProfile(profile: {
  collector_id: string;
  username: string;
  trust_score: number;
}): Promise<RegistryProfileRow | null> {
  const post = await supabaseRest("profiles?on_conflict=collector_id", {
    method: "POST",
    body: profile,
  });
  if (!post.ok) return null;
  const read = await supabaseRest(
    `profiles?select=collector_id,username,trust_score,created_at&collector_id=eq.${encodeURIComponent(profile.collector_id)}`,
  );
  if (!read.ok) return null;
  return asRegistryRows(read.json)[0] ?? null;
}

/** ----- Cloud collection backup (Supabase `collection_items`) -----
    Anthony approved making Supabase the cloud backup for users'
    collections (Nov 2, 2026): every owned item — cards in every
    finish, sealed products, graded comics — is written to the
    project's collection_items table under the owner's collector
    code (rows: owner_collector_id, item_key, display_name, qty,
    kind, meta; unique on owner + item_key, owner-only RLS, written
    with the publishable key only). Kept current three ways: a full
    sync action (also the initial upload and the post-publish run),
    an incremental push inside the two quantity editors
    (updateOwnership / setSealedQty), and a restore action that
    loads the backup back when the local collection is empty. */

/** The graded comics, mirrored from the client catalog
    (client/src/comics.tsx COMICS) so the server sync can include
    them — the comics are a static logged set of 8 slabs, qty 1
    each, and never change in the app. */
const GRADED_COMICS_CLOUD: ReadonlyArray<{
  id: string;
  title: string;
  label: string;
  cert: string;
}> = [
  { id: "aliens-1", title: "Aliens #1", label: "Signature Series", cert: "0969448092" },
  { id: "batman-136", title: "Batman #136", label: "Signature Series", cert: "2765929003" },
  { id: "wolverine-154", title: "Wolverine #154", label: "Universal", cert: "3996202002" },
  { id: "mandalorian-4", title: "Star Wars: The Mandalorian #4", label: "Universal", cert: "4299854012" },
  { id: "venom-31-2021", title: "Venom #31 (2021)", label: "Universal", cert: "4508151021" },
  { id: "wolverine-21", title: "Wolverine #21", label: "Universal", cert: "4647611024" },
  { id: "venom-31-2024", title: "Venom #31 (2024)", label: "Universal", cert: "4468576022" },
  { id: "deadpool-wolverine-3", title: "Deadpool & Wolverine: WWIII #3", label: "Universal", cert: "4654697025" },
];

type CloudItemRow = {
  owner_collector_id: string;
  item_key: string;
  display_name: string;
  qty: number;
  kind: string;
  meta: Record<string, unknown>;
};

function cloudCardItemKey(uid: string, finish: string): string {
  return `card:${uid}:${finish}`;
}

/** Builds the full cloud-backup row set for the local collection:
    one row per owned card printing + finish, per sealed product
    at its effective quantity, and per graded comic. */
async function buildLocalCloudItems(
  ctx: Ctx,
  owner: string,
): Promise<CloudItemRow[]> {
  const db = ctx.db<typeof schema>();
  const rows: CloudItemRow[] = [];
  const cardRows = await db.select().from(schema.cards);
  for (const row of cardRows) {
    if (row.ownedQty <= 0) continue;
    const finishes = parseFinishes(row.finishes);
    const entries =
      Object.keys(finishes).length > 0
        ? Object.entries(finishes)
        : [["Regular", row.ownedQty] as [string, number]];
    for (const [finish, qty] of entries) {
      if (qty <= 0) continue;
      rows.push({
        owner_collector_id: owner,
        item_key: cloudCardItemKey(row.uid, finish),
        display_name:
          finish === "Regular"
            ? row.fullName
            : `${row.fullName} (${finish})`,
        qty,
        kind: "card",
        meta: {
          uid: row.uid,
          finish,
          set: row.groupName,
          number: row.printed,
          rarity: row.rarity ?? null,
        },
      });
    }
  }
  const eff = await effectiveSealed(ctx);
  for (const item of eff.items) {
    if (item.qty <= 0) continue;
    rows.push({
      owner_collector_id: owner,
      item_key: `sealed:${item.name}`,
      display_name: item.name,
      qty: item.qty,
      kind: "sealed",
      meta: { set: item.setName },
    });
  }
  for (const comic of GRADED_COMICS_CLOUD) {
    rows.push({
      owner_collector_id: owner,
      item_key: `comic:${comic.id}`,
      display_name: `${comic.title} — CGC ${comic.label} 9.8`,
      qty: 1,
      kind: "comic",
      meta: { cert: comic.cert, label: comic.label },
    });
  }
  return rows;
}

/** Reads every collection_items row for one owner, paged (the
    server caps a single response, so loop until a short page). */
async function fetchCloudItems(
  owner: string,
): Promise<Array<{ item_key: string; qty: number; kind: string }> | null> {
  const out: Array<{ item_key: string; qty: number; kind: string }> =
    [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const res = await supabaseRest(
      `collection_items?select=item_key,qty,kind&owner_collector_id=eq.${encodeURIComponent(owner)}&order=item_key.asc&limit=${PAGE}&offset=${offset}`,
    );
    if (!res.ok || !Array.isArray(res.json)) return null;
    for (const raw of res.json) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.item_key === "string") {
        out.push({
          item_key: r.item_key,
          qty: typeof r.qty === "number" ? r.qty : 0,
          kind: typeof r.kind === "string" ? r.kind : "card",
        });
      }
    }
    if (res.json.length < PAGE) break;
  }
  return out;
}

async function upsertCloudItems(rows: CloudItemRow[]): Promise<boolean> {
  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await supabaseRest(
      "collection_items?on_conflict=owner_collector_id,item_key",
      { method: "POST", body: rows.slice(i, i + CHUNK) },
    );
    if (!res.ok) return false;
  }
  return true;
}

async function deleteCloudItems(
  owner: string,
  keys: string[],
): Promise<boolean> {
  const CHUNK = 100;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const list = keys
      .slice(i, i + CHUNK)
      .map((k) => encodeURIComponent(`"${k}"`))
      .join(",");
    const res = await supabaseRest(
      `collection_items?owner_collector_id=eq.${encodeURIComponent(owner)}&item_key=in.(${list})`,
      { method: "DELETE" },
    );
    if (!res.ok) return false;
  }
  return true;
}

/** Full sync: upsert every local row, delete server rows that no
    longer exist locally, and confirm by reading the owner's rows
    back. Returns null when the server can't be reached/written. */
async function fullCloudSync(
  ctx: Ctx,
): Promise<{ owner: string; items: number; copies: number } | null> {
  const profile = await ensureCollectorProfile(ctx);
  const owner = profile.collectorCode;
  // Keep Anthony's own registry row fresh in the same pass (the
  // longstanding acceptance check: his profile sits in the server
  // profiles table next to MC-JARVIS and MC-TEST-DUMMY).
  await upsertRegistryProfile({
    collector_id: owner,
    username: profile.username,
    trust_score: 0,
  }).catch(() => null);
  const local = await buildLocalCloudItems(ctx, owner);
  if (!(await upsertCloudItems(local))) return null;
  const remote = await fetchCloudItems(owner);
  if (remote == null) return null;
  const localKeys = new Set(local.map((r) => r.item_key));
  const stale = remote
    .map((r) => r.item_key)
    .filter((k) => !localKeys.has(k));
  if (stale.length > 0) {
    if (!(await deleteCloudItems(owner, stale))) return null;
  }
  const after = await fetchCloudItems(owner);
  if (after == null) return null;
  return {
    owner,
    items: after.length,
    copies: after.reduce((s, r) => s + r.qty, 0),
  };
}

/** Incremental push for one card after its ownership changes:
    upsert its current finish rows and delete finishes that are
    gone. Best-effort — failures are swallowed so a quantity edit
    never breaks on a server hiccup; the next full sync heals it. */
async function syncCardToCloud(
  ctx: Ctx,
  cardRow: typeof schema.cards.$inferSelect,
): Promise<void> {
  try {
    const profile = await ensureCollectorProfile(ctx);
    const owner = profile.collectorCode;
    const prefix = `card:${cardRow.uid}:`;
    const finishes = parseFinishes(cardRow.finishes);
    const entries =
      Object.keys(finishes).length > 0
        ? Object.entries(finishes)
        : cardRow.ownedQty > 0
          ? [["Regular", cardRow.ownedQty] as [string, number]]
          : [];
    const desired: CloudItemRow[] = entries
      .filter(([, qty]) => qty > 0)
      .map(([finish, qty]) => ({
        owner_collector_id: owner,
        item_key: cloudCardItemKey(cardRow.uid, finish),
        display_name:
          finish === "Regular"
            ? cardRow.fullName
            : `${cardRow.fullName} (${finish})`,
        qty,
        kind: "card",
        meta: {
          uid: cardRow.uid,
          finish,
          set: cardRow.groupName,
          number: cardRow.printed,
          rarity: cardRow.rarity ?? null,
        },
      }));
    const existing = await supabaseRest(
      `collection_items?select=item_key&owner_collector_id=eq.${encodeURIComponent(owner)}&item_key=like.${encodeURIComponent(`${prefix}*`)}`,
    );
    if (desired.length > 0) {
      await upsertCloudItems(desired);
    }
    if (existing.ok && Array.isArray(existing.json)) {
      const desiredKeys = new Set(desired.map((r) => r.item_key));
      const stale: string[] = [];
      for (const raw of existing.json) {
        if (typeof raw !== "object" || raw === null) continue;
        const k = (raw as Record<string, unknown>).item_key;
        if (typeof k === "string" && !desiredKeys.has(k)) {
          stale.push(k);
        }
      }
      if (stale.length > 0) await deleteCloudItems(owner, stale);
    }
  } catch {
    // Backup push is best-effort; the edit itself already saved.
  }
}

/** Incremental push for one sealed product after its quantity
    changes. Best-effort, same rule as syncCardToCloud. */
async function syncSealedToCloud(
  ctx: Ctx,
  name: string,
  qty: number,
): Promise<void> {
  try {
    const profile = await ensureCollectorProfile(ctx);
    const owner = profile.collectorCode;
    const key = `sealed:${name}`;
    if (qty <= 0) {
      await deleteCloudItems(owner, [key]);
      return;
    }
    const eff = await effectiveSealed(ctx);
    const item = eff.items.find((i) => i.name === name);
    if (item && item.qty > 0) {
      await upsertCloudItems([
        {
          owner_collector_id: owner,
          item_key: key,
          display_name: item.name,
          qty: item.qty,
          kind: "sealed",
          meta: { set: item.setName },
        },
      ]);
    }
  } catch {
    // Backup push is best-effort; the edit itself already saved.
  }
}

const cloudSyncResponse = z.object({
  /** True when the server answered and the read-back matched. */
  ok: z.boolean(),
  items: z.number(),
  copies: z.number(),
  syncedAt: z.string().nullable(),
});

const backupStatusResponse = z.object({
  reachable: z.boolean(),
  localItems: z.number(),
  localCopies: z.number(),
  cloudItems: z.number(),
  cloudCopies: z.number(),
  inSync: z.boolean(),
});

const restoreResponse = z.object({
  restored: z.boolean(),
  cardsApplied: z.number(),
  sealedApplied: z.number(),
  /** Why nothing was restored, when restored is false. */
  note: z.string().nullable(),
});

const registryMember = z.object({
  collectorId: z.string(),
  username: z.string(),
  trustScore: z.number(),
  createdAt: z.string(),
});

const registrySyncResponse = z.object({
  /** True only when Anthony's row was read back from Supabase. */
  registered: z.boolean(),
  username: z.string(),
  collectorCode: z.string(),
  /** True when the MC-JARVIS row was read back from Supabase. */
  jarvisRegistered: z.boolean(),
  /** ISO instant of the successful verification, null when the
      registry could not be reached or the row did not land. */
  syncedAt: z.string().nullable(),
  members: z.array(registryMember),
});

const registryLookupResponse = z.object({
  reachable: z.boolean(),
  found: z.boolean(),
  isSelf: z.boolean(),
  member: registryMember.nullable(),
});

/** One item row on a collector profile page (the Shiny-style
    profile grid): a card printing in one finish, or a sealed
    product. Built from Anthony's own data — his binder cards by
    finish plus his sealed shelf. */
const profileItem = z.object({
  key: z.string(),
  cardId: z.number().nullable(),
  sealedName: z.string().nullable(),
  name: z.string(),
  groupName: z.string(),
  printed: z.string().nullable(),
  finish: z.string(),
  rarity: z.string().nullable(),
  qty: z.number(),
  unitValue: z.number().nullable(),
  /** Tradeable copies of this finish under the owner's hybrid
      trade availability (cards only; null for sealed). */
  tradeableQty: z.number().nullable(),
});

const profileItemsRequest = z.object({
  query: z.string().max(80),
  group: z.string().max(120),
  sort: z.enum(["value", "name", "qty"]),
  filter: z.enum(["all", "cards", "sealed", "foils", "enchanteds"]),
});

const profileItemsResponse = z.object({
  /** Matches after search/filter/group, before the display cap. */
  total: z.number(),
  /** Group names present after search + filter (for the Viewing
      selector), before the group selection itself is applied. */
  groups: z.array(z.string()),
  items: z.array(profileItem),
});

/** Profiles show the top slice of a result set; the total count
    always reports the full number honestly. */
const PROFILE_ITEMS_CAP = 240;

type ProfileItemRow = z.infer<typeof profileItem>;

async function buildProfileItems(ctx: Ctx): Promise<ProfileItemRow[]> {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.cards);
  const profile = await ensureCollectorProfile(ctx);
  const availability = effectiveAvailability(profile);
  const deckMap = availabilityHas(availability, "decks")
    ? await deckCopiesByCard(ctx)
    : new Map<number, number>();
  const items: ProfileItemRow[] = [];
  for (const row of rows) {
    if (row.ownedQty <= 0) continue;
    const finishes = parseFinishes(row.finishes);
    const prices = parseFinance(row.financeJson);
    const tradeable = tradeableForFinishes(
      Object.keys(finishes).length > 0
        ? finishes
        : { Regular: row.ownedQty },
      availability,
      deckMap.get(row.id) ?? 0,
    );
    const entries = Object.entries(finishes).filter(([, q]) => q > 0);
    if (entries.length === 0) {
      items.push({
        key: `card:${row.id}:owned`,
        cardId: row.id,
        sealedName: null,
        name: row.fullName,
        groupName: row.groupName,
        printed: row.printed,
        finish: "Regular",
        rarity: row.rarity,
        qty: row.ownedQty,
        unitValue: row.marketValue,
        tradeableQty: tradeable.get("Regular") ?? 0,
      });
    } else {
      for (const [finish, qty] of entries) {
        items.push({
          key: `card:${row.id}:${finish}`,
          cardId: row.id,
          sealedName: null,
          name: row.fullName,
          groupName: row.groupName,
          printed: row.printed,
          finish,
          rarity: row.rarity,
          qty,
          unitValue: prices[finish]?.value ?? row.marketValue,
          tradeableQty: tradeable.get(finish) ?? 0,
        });
      }
    }
  }
  const eff = await effectiveSealed(ctx);
  for (const item of eff.items) {
    if (item.qty <= 0) continue;
    items.push({
      key: `sealed:${item.name}`,
      cardId: null,
      sealedName: item.name,
      name: item.name,
      groupName: item.setName,
      printed: null,
      finish: "Sealed",
      rarity: "Sealed",
      qty: item.qty,
      unitValue:
        item.qty > 0
          ? Math.round((item.value / item.qty) * 100) / 100
          : item.value,
      tradeableQty: null,
    });
  }
  return items;
}

/** Profile search: name tokens as substrings plus an optional
    collector-number token matched against the printed number —
    the same name + number rule as the main Search. */
function filterProfileItems(
  items: ProfileItemRow[],
  query: string,
  filter: z.infer<typeof profileItemsRequest>["filter"],
): ProfileItemRow[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const numberToken = tokens.find((t) => /^\d+$/.test(t.replace(/^#/, "")));
  const nameNeedle = tokens
    .filter((t) => t !== numberToken)
    .join(" ");
  return items.filter((item) => {
    if (filter === "cards" && item.cardId == null) return false;
    if (filter === "sealed" && item.sealedName == null) return false;
    if (
      filter === "foils" &&
      (item.cardId == null || !isFoilFinish(item.finish))
    )
      return false;
    if (filter === "enchanteds" && item.rarity !== "Enchanted")
      return false;
    if (nameNeedle && !item.name.toLowerCase().includes(nameNeedle))
      return false;
    if (numberToken) {
      const want = numberToken.replace(/^#/, "");
      const got = (item.printed ?? "").split("/")[0]?.trim() ?? "";
      if (got !== want) return false;
    }
    return true;
  });
}

function sortProfileItems(
  items: ProfileItemRow[],
  sort: z.infer<typeof profileItemsRequest>["sort"],
): ProfileItemRow[] {
  const sorted = [...items];
  if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "qty") {
    sorted.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  } else {
    sorted.sort(
      (a, b) =>
        (b.unitValue ?? 0) * b.qty - (a.unitValue ?? 0) * a.qty ||
        a.name.localeCompare(b.name),
    );
  }
  return sorted;
}

/** ---- Marketplace (phase 1, Nov 2, 2026) ----
    Listings + claims/offers + both-sides-confirmed deals +
    mandatory blind feedback, stored locally (see the schema
    comment); completed deals are written to the server's
    trust_events ledger. No payments in this phase: Buy Now
    CLAIMS an item at the asking price and notifies the seller —
    it never charges anything. */

const marketplaceListing = z.object({
  id: z.number(),
  sellerCode: z.string(),
  sellerUsername: z.string(),
  /** Built-in test profiles are labeled, never dressed up. */
  sellerIsTest: z.boolean(),
  kind: z.enum(["card", "sealed", "comic"]),
  cardId: z.number().nullable(),
  sealedName: z.string().nullable(),
  comicId: z.string().nullable(),
  name: z.string(),
  groupName: z.string(),
  printed: z.string().nullable(),
  finish: z.string(),
  condition: z.string(),
  qty: z.number(),
  askingPrice: z.number(),
  /** Current market value per unit (cards/sealed resolved live;
      comics carry their logged value). */
  marketValue: z.number().nullable(),
  status: z.enum(["available", "pending", "sold", "removed"]),
  createdAt: z.string(),
  mine: z.boolean(),
  /** Pending claims/offers waiting on this listing. */
  pendingOffers: z.number(),
});

const marketplaceGate = z.object({
  /** True while a completed deal is waiting on MY feedback —
      new marketplace actions are blocked until it's given. */
  blocked: z.boolean(),
  awaitingCount: z.number(),
});

const marketplaceBrowseResponse = z.object({
  listings: z.array(marketplaceListing),
  groups: z.array(z.string()),
  gate: marketplaceGate,
});

const marketMutationResponse = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  offerId: z.number().nullable(),
  listingId: z.number().nullable(),
});

/** One pending claim/offer shown in the Inbox (either direction). */
const marketplaceOfferView = z.object({
  offerId: z.number(),
  listingId: z.number(),
  itemName: z.string(),
  kind: z.enum(["card", "sealed", "comic"]),
  cardId: z.number().nullable(),
  sealedName: z.string().nullable(),
  comicId: z.string().nullable(),
  finish: z.string(),
  type: z.enum(["claim", "offer"]),
  amount: z.number(),
  askingPrice: z.number(),
  /** "incoming" = someone wants MY item; "outgoing" = I want theirs. */
  direction: z.enum(["incoming", "outgoing"]),
  otherUsername: z.string(),
  otherCode: z.string(),
  otherIsTest: z.boolean(),
  createdAt: z.string(),
});

/** A deal (an accepted claim/offer) with its completion and
    feedback state. The other side's feedback stays null until
    BOTH sides have rated or the 7-day neutral close passes —
    blind both ways, no revenge or copycat ratings. */
const marketplaceDeal = z.object({
  offerId: z.number(),
  listingId: z.number(),
  itemName: z.string(),
  kind: z.enum(["card", "sealed", "comic"]),
  cardId: z.number().nullable(),
  sealedName: z.string().nullable(),
  comicId: z.string().nullable(),
  finish: z.string(),
  amount: z.number(),
  type: z.enum(["claim", "offer"]),
  role: z.enum(["buyer", "seller"]),
  otherUsername: z.string(),
  otherCode: z.string(),
  otherIsTest: z.boolean(),
  myConfirmed: z.boolean(),
  theirConfirmed: z.boolean(),
  completedAt: z.string().nullable(),
  myRating: z.enum(["positive", "negative"]).nullable(),
  theirRating: z.enum(["positive", "negative"]).nullable(),
  myTags: z.array(z.string()),
  theirTags: z.array(z.string()),
  myComment: z.string().nullable(),
  theirComment: z.string().nullable(),
  /** Completed and still waiting on MY rating (and the 7-day
      neutral close hasn't passed). */
  awaitingMyFeedback: z.boolean(),
  /** Both ratings are in, or the neutral close ended it. */
  feedbackClosed: z.boolean(),
  createdAt: z.string(),
});

const marketplaceActivityResponse = z.object({
  incoming: z.array(marketplaceOfferView),
  outgoing: z.array(marketplaceOfferView),
  deals: z.array(marketplaceDeal),
  gate: marketplaceGate,
});

type ListingRow = typeof schema.marketplaceListings.$inferSelect;
type OfferRow = typeof schema.marketplaceOffers.$inferSelect;

/** The built-in test friend's listings — his own little
    collection from the Friends area, at market value, seeded
    exactly once. Labeled test data wherever they show. */
const JARVIS_SEED_LISTINGS = [
  {
    name: "Elsa - Snow Queen",
    groupHint: "The First Chapter",
    finish: "Cold Foil",
    qty: 1,
  },
  {
    name: "Stitch - Rock Star",
    groupHint: "The First Chapter",
    finish: "Regular",
    qty: 2,
  },
] as const;
// Jarvis's third card (Mickey Mouse - Brave Little Tailor) is NOT
// seeded: Anthony has never owned that printing, so it carries no
// price anywhere in his data — listing it would mean inventing an
// asking price. It joins the seed if a real price ever lands.

const FEEDBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Who is acting on a deal step: Anthony himself, or — only for
    steps that belong to the built-in test friend (MC-JARVIS) and
    only when the caller explicitly asks — the test friend. The
    test-friend path exists so Anthony can walk a whole deal
    end-to-end against his test user; it can never act for any
    other collector. */
function resolveActor(
  myCode: string,
  partyCode: string,
  asTestFriend: boolean,
): string | null {
  // Acting as the test friend means the actor IS the test friend —
  // Anthony's own side must not match in that mode (an earlier
  // version matched his own code first, so a test-side confirm
  // re-set his flag instead of the seller's).
  if (asTestFriend)
    return partyCode === JARVIS_REGISTRY_PROFILE.collector_id
      ? partyCode
      : null;
  return partyCode === myCode ? myCode : null;
}

const FEEDBACK_GATE_MESSAGE =
  "You have a finished deal still waiting on your feedback — leave the thumbs up or down on it first, then you can keep trading.";

/** Gate check covering both roles (buyer deals are on the
    offer row; seller deals resolve through their listings). */
async function marketplaceGateFor(
  ctx: Ctx,
  myCode: string,
): Promise<{ blocked: boolean; awaitingCount: number }> {
  const db = ctx.db<typeof schema>();
  const [offers, listings, feedback] = await Promise.all([
    db.select().from(schema.marketplaceOffers),
    db.select().from(schema.marketplaceListings),
    db.select().from(schema.marketplaceFeedback),
  ]);
  const myListingIds = new Set(
    listings.filter((l) => l.sellerCode === myCode).map((l) => l.id),
  );
  const ratedByMe = new Set(
    feedback.filter((f) => f.fromCode === myCode).map((f) => f.offerId),
  );
  const now = Date.now();
  let awaiting = 0;
  for (const o of offers) {
    if (o.status !== "accepted" || !o.completedAt) continue;
    const involvesMe =
      o.buyerCode === myCode || myListingIds.has(o.listingId);
    if (!involvesMe) continue;
    if (ratedByMe.has(o.id)) continue;
    if (now - Date.parse(o.completedAt) > FEEDBACK_WINDOW_MS) continue;
    awaiting += 1;
  }
  return { blocked: awaiting > 0, awaitingCount: awaiting };
}

/** Write a completed deal to the server trust ledger (one row per
    side, the other as counterparty). Best-effort: returns false
    when the server can't be reached so the caller can retry on a
    later read. */
async function recordDealTrust(offer: OfferRow, sellerCode: string) {
  const res = await supabaseRest("trust_events", {
    method: "POST",
    body: [
      {
        collector_id: offer.buyerCode,
        event_type: "marketplace_sale_confirmed",
        points: 2,
        counterparty: sellerCode,
      },
      {
        collector_id: sellerCode,
        event_type: "marketplace_sale_confirmed",
        points: 2,
        counterparty: offer.buyerCode,
      },
    ],
  });
  return res.ok;
}

/** Map a listing row to its API shape, resolving live market
    value and the printed number for cards. */
function toListingView(
  row: ListingRow,
  myCode: string,
  cardById: Map<number, typeof schema.cards.$inferSelect>,
  sealedUnitByName: Map<string, number>,
  pendingByListing: Map<number, number>,
): z.infer<typeof marketplaceListing> {
  const card = row.cardId != null ? cardById.get(row.cardId) : undefined;
  let marketValue = row.marketValue;
  if (row.kind === "card" && card) {
    const prices = parseFinance(card.financeJson);
    marketValue = prices[row.finish]?.value ?? card.marketValue;
  } else if (row.kind === "sealed" && row.sealedName) {
    marketValue = sealedUnitByName.get(row.sealedName) ?? marketValue;
  }
  return {
    id: row.id,
    sellerCode: row.sellerCode,
    sellerUsername: row.sellerUsername,
    sellerIsTest: TEST_COLLECTOR_CODES.has(row.sellerCode),
    kind: row.kind as "card" | "sealed" | "comic",
    cardId: row.cardId,
    sealedName: row.sealedName,
    comicId: row.comicId,
    name: row.name,
    groupName: row.groupName,
    printed: card?.printed ?? null,
    finish: row.finish,
    condition: row.condition,
    qty: row.qty,
    askingPrice: row.askingPrice,
    marketValue,
    status: row.status as "available" | "pending" | "sold" | "removed",
    createdAt: row.createdAt,
    mine: row.sellerCode === myCode,
    pendingOffers: pendingByListing.get(row.id) ?? 0,
  };
}

async function listingViewContext(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const [cardRows, eff, offers] = await Promise.all([
    db.select().from(schema.cards),
    effectiveSealed(ctx),
    db.select().from(schema.marketplaceOffers),
  ]);
  const cardById = new Map(cardRows.map((c) => [c.id, c]));
  const sealedUnitByName = new Map(
    eff.items.map((i) => [
      i.name,
      i.qty > 0 ? Math.round((i.value / i.qty) * 100) / 100 : i.value,
    ]),
  );
  const pendingByListing = new Map<number, number>();
  for (const o of offers) {
    if (o.status === "pending")
      pendingByListing.set(
        o.listingId,
        (pendingByListing.get(o.listingId) ?? 0) + 1,
      );
  }
  return { cardById, sealedUnitByName, pendingByListing };
}

/** ---- Trades (Nov 2, 2026, late) ----
    Card swaps between collectors, operational at release at
    Anthony's direction (the Marketplace and Forums are the held
    ones — Trades is not). Same deal discipline as the
    Marketplace: propose → accept/decline → both sides confirm in
    person → completion writes to the server trust ledger →
    mandatory blind feedback, which gates new proposals until
    given. The only friend in the app today is the built-in test
    friend Jarvis, so he is the one partner a trade can name; his
    side can be driven from the same screen (labeled test steps,
    exactly like marketplace deals) so Anthony can walk a whole
    trade end to end. */

const tradeItem = z.object({
  cardId: z.number(),
  name: z.string(),
  groupName: z.string(),
  printed: z.string().nullable(),
  finish: z.string(),
  qty: z.number(),
});

const tradeItemInput = z.object({
  cardId: z.number(),
  finish: z.string().min(1).max(60),
  qty: z.number().int().min(1).max(4),
});

/** One saved deck as the client renders it (deck builder,
    Nov 3, 2026): resolved card lines plus totals. */
const deckView = z.object({
  id: z.number(),
  name: z.string(),
  displayed: z.boolean(),
  totalCards: z.number(),
  inks: z.array(z.string()),
  cards: z.array(
    z.object({
      cardId: z.number(),
      qty: z.number(),
      fullName: z.string(),
      printed: z.string(),
      groupName: z.string(),
      ink: z.string().nullable(),
      rarity: z.string().nullable(),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type DeckRow = typeof schema.decks.$inferSelect;

async function deckViewOf(
  ctx: Ctx,
  row: DeckRow,
): Promise<z.infer<typeof deckView>> {
  const db = ctx.db<typeof schema>();
  const lines = parseDeckCards(row.cardsJson);
  const cards = [];
  const inks = new Set<string>();
  let totalCards = 0;
  for (const line of lines) {
    const cardRows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, line.cardId))
      .limit(1);
    const card = cardRows[0];
    if (!card) continue;
    totalCards += line.qty;
    if (card.ink) inks.add(card.ink);
    cards.push({
      cardId: card.id,
      qty: line.qty,
      fullName: card.fullName,
      printed: card.printed,
      groupName: card.groupName,
      ink: card.ink,
      rarity: card.rarity,
    });
  }
  cards.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    id: row.id,
    name: row.name,
    displayed: row.displayed > 0,
    totalCards,
    inks: [...inks],
    cards,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const tradeView = z.object({
  tradeId: z.number(),
  /** "outgoing" = I proposed it; "incoming" = it was proposed to me. */
  direction: z.enum(["incoming", "outgoing"]),
  /** Who sent the offer — the "From:" of the mail-style header on
      the opened trade view (Anthony, Nov 3, 2026). */
  proposerUsername: z.string(),
  otherUsername: z.string(),
  otherCode: z.string(),
  otherIsTest: z.boolean(),
  /** What I would hand over / receive, from MY point of view. */
  myGive: z.array(tradeItem),
  myGet: z.array(tradeItem),
  note: z.string().nullable(),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]),
  myConfirmed: z.boolean(),
  theirConfirmed: z.boolean(),
  completedAt: z.string().nullable(),
  myRating: z.enum(["positive", "negative"]).nullable(),
  theirRating: z.enum(["positive", "negative"]).nullable(),
  myTags: z.array(z.string()),
  theirTags: z.array(z.string()),
  myComment: z.string().nullable(),
  theirComment: z.string().nullable(),
  awaitingMyFeedback: z.boolean(),
  feedbackClosed: z.boolean(),
  createdAt: z.string(),
});

/** Hybrid trade availability (Anthony, Nov 2, 2026, late —
    supersedes the single-pick mode): "all" and "none" are
    EXCLUSIVE picks (every copy tradeable / nothing tradeable);
    "master" (keep one of each printing back for the master
    sets) and "decks" (copies allocated to decks in Where it
    lives are held back) are stackable hold-backs, stored
    comma-joined when both are on. */
const tradeAvailabilityEnum = z.enum([
  "all",
  "none",
  "master",
  "decks",
  "master,decks",
]);

type TradeAvailability = z.infer<typeof tradeAvailabilityEnum>;

const tradesResponse = z.object({
  trades: z.array(tradeView),
  gate: marketplaceGate,
  /** The owner's hybrid trade-availability setting (see
      tradeAvailabilityEnum). */
  tradeAvailability: tradeAvailabilityEnum,
  /** Whether the owner has hidden the "How trading works"
      explainer in Trades (it collapses to its title row). */
  howTradesWorkHidden: z.boolean(),
});

/** Effective availability: the hybrid column wins; a legacy
    single-pick trade_mode maps over (keep_one = the master
    hold-back); never picked reads as "master", Anthony's
    stated personal default. */
function effectiveAvailability(profile: {
  tradeAvailability: string | null;
  tradeMode: string | null;
}): TradeAvailability {
  const v = profile.tradeAvailability;
  if (
    v === "all" ||
    v === "none" ||
    v === "master" ||
    v === "decks" ||
    v === "master,decks"
  )
    return v;
  if (profile.tradeMode === "all") return "all";
  if (profile.tradeMode === "none") return "none";
  return "master";
}

function availabilityHas(
  availability: TradeAvailability,
  holdback: "master" | "decks",
): boolean {
  if (availability === "all" || availability === "none") return false;
  return availability.split(",").includes(holdback);
}

/** Copies of each card a collector has allocated to their
    decks — Where it lives rows of type deck_box PLUS the
    card lists of their saved decks (the deck builder,
    Nov 3, 2026), summed per card. Deck allocations carry no
    finish, so they count against a card's finishes as a pool
    (see below). */
async function deckCopiesByCard(ctx: Ctx): Promise<Map<number, number>> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.itemLocations)
    .where(eq(schema.itemLocations.locType, "deck_box"));
  const map = new Map<number, number>();
  for (const r of rows) {
    if (r.targetKind !== "card" || r.cardId == null) continue;
    map.set(r.cardId, (map.get(r.cardId) ?? 0) + r.qty);
  }
  const profile = await ensureCollectorProfile(ctx);
  const deckRows = await db
    .select()
    .from(schema.decks)
    .where(eq(schema.decks.ownerCode, profile.collectorCode));
  for (const d of deckRows) {
    for (const line of parseDeckCards(d.cardsJson)) {
      map.set(line.cardId, (map.get(line.cardId) ?? 0) + line.qty);
    }
  }
  return map;
}

/** A saved deck's card list, parsed defensively. */
function parseDeckCards(
  json: string,
): { cardId: number; qty: number }[] {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    const out: { cardId: number; qty: number }[] = [];
    for (const e of raw) {
      if (
        e != null &&
        typeof e === "object" &&
        typeof (e as { cardId?: unknown }).cardId === "number" &&
        typeof (e as { qty?: unknown }).qty === "number"
      ) {
        out.push({
          cardId: (e as { cardId: number }).cardId,
          qty: Math.max(0, Math.floor((e as { qty: number }).qty)),
        });
      }
    }
    return out.filter((l) => l.qty > 0);
  } catch {
    return [];
  }
}

const COLLECTION_TILE_KEYS = [
  "lorcana",
  "pokemon",
  "magic",
  "lego",
  "comics",
  "starwars",
] as const;

function parseHiddenCollections(json: string | null): string[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (k): k is string =>
        typeof k === "string" &&
        (COLLECTION_TILE_KEYS as readonly string[]).includes(k),
    );
  } catch {
    return [];
  }
}

/** Tradeable copies per finish for one card under an
    availability setting — tradeable is separate from owned:
    start from owned, hold back one copy per printing when
    the master-set hold-back is on, then hold back the card's
    deck-dedicated copies when the decks hold-back is on
    (deck copies count against the Regular finish first, then
    the other finishes alphabetically), never below zero. */
function tradeableForFinishes(
  finishes: Record<string, number>,
  availability: TradeAvailability,
  deckCopies: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (availability === "none") {
    for (const f of Object.keys(finishes)) out.set(f, 0);
    return out;
  }
  const keepBack = availabilityHas(availability, "master") ? 1 : 0;
  for (const [finish, owned] of Object.entries(finishes)) {
    out.set(finish, Math.max(0, owned - keepBack));
  }
  if (availabilityHas(availability, "decks") && deckCopies > 0) {
    let remaining = deckCopies;
    const order = Object.keys(finishes).sort((a, b) =>
      a === "Regular" ? -1 : b === "Regular" ? 1 : a.localeCompare(b),
    );
    for (const finish of order) {
      if (remaining <= 0) break;
      const cur = out.get(finish) ?? 0;
      const take = Math.min(cur, remaining);
      out.set(finish, cur - take);
      remaining -= take;
    }
  }
  return out;
}

const tradeMutationResponse = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  tradeId: z.number().nullable(),
});

type TradeRow = typeof schema.tradeOffers.$inferSelect;

/** The test friend's trade stock — the same three printings the
    client shows as his collection (JARVIS_FRIEND_CARDS). His side
    of a trade can only offer what he actually has here. */
const JARVIS_TRADE_STOCK = [
  { name: "Mickey Mouse - Brave Little Tailor", finish: "Regular", qty: 1 },
  { name: "Elsa - Snow Queen", finish: "Cold Foil", qty: 1 },
  { name: "Stitch - Rock Star", finish: "Regular", qty: 2 },
] as const;

const TRADE_GATE_MESSAGE =
  "You have a finished trade still waiting on your feedback — leave the thumbs up or down on it first, then you can propose new trades.";

/** Validate one side of a proposed trade against its owner's
    real stock and resolve the display fields from the catalog.
    Returns the resolved items, or an error string. */
async function validateTradeItems(
  ctx: Ctx,
  ownerCode: string,
  myCode: string,
  inputs: z.infer<typeof tradeItemInput>[],
): Promise<
  | { ok: true; items: z.infer<typeof tradeItem>[] }
  | { ok: false; error: string }
> {
  if (inputs.length === 0)
    return { ok: false, error: "Pick at least one card for each side of the trade." };
  if (inputs.length > 8)
    return { ok: false, error: "A trade can list up to 8 different cards per side." };
  const db = ctx.db<typeof schema>();
  const cardRows = await db.select().from(schema.cards);
  const cardById = new Map(cardRows.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const items: z.infer<typeof tradeItem>[] = [];
  for (const input of inputs) {
    const key = `${input.cardId}:${input.finish}`;
    if (seen.has(key))
      return { ok: false, error: "The same card and finish is listed twice — combine the copies into one line." };
    seen.add(key);
    const card = cardById.get(input.cardId);
    if (!card) return { ok: false, error: "One of those cards is no longer in the catalog." };
    let stock = 0;
    if (ownerCode === myCode) {
      // Tradeable copies only — the owner's hybrid
      // trade-availability setting holds copies back from what
      // they own (master-set keep-back and deck-dedicated
      // copies, per the boxes they have checked).
      const profile = await ensureCollectorProfile(ctx);
      const availability = effectiveAvailability(profile);
      const deckMap = availabilityHas(availability, "decks")
        ? await deckCopiesByCard(ctx)
        : new Map<number, number>();
      stock =
        tradeableForFinishes(
          parseFinishes(card.finishes),
          availability,
          deckMap.get(card.id) ?? 0,
        ).get(input.finish) ?? 0;
    } else if (ownerCode === JARVIS_REGISTRY_PROFILE.collector_id) {
      const hit = JARVIS_TRADE_STOCK.find(
        (s) => s.name === card.fullName && s.finish === input.finish,
      );
      stock = hit?.qty ?? 0;
    }
    if (stock <= 0)
      return {
        ok: false,
        error: `${card.fullName} (${input.finish}) isn't in that collector's trade stock.`,
      };
    if (input.qty > stock)
      return {
        ok: false,
        error:
          ownerCode === myCode
            ? `Only ${stock} ${stock === 1 ? "copy" : "copies"} of ${card.fullName} (${input.finish}) ${stock === 1 ? "is" : "are"} up for trade under your trade availability setting — you keep the rest back.`
            : `Only ${stock} ${stock === 1 ? "copy" : "copies"} of ${card.fullName} (${input.finish}) can go in — that's all that side has.`,
      };
    items.push({
      cardId: card.id,
      name: card.fullName,
      groupName: card.groupName,
      printed: card.printed,
      finish: input.finish,
      qty: input.qty,
    });
  }
  return { ok: true, items };
}

function parseTradeItems(raw: string): z.infer<typeof tradeItem>[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (t): t is z.infer<typeof tradeItem> =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as { cardId?: unknown }).cardId === "number" &&
        typeof (t as { name?: unknown }).name === "string",
    );
  } catch {
    return [];
  }
}

/** The trade feedback gate, mirroring the marketplace one:
    completed trades waiting on MY rating block new proposals. */
async function tradesGateFor(
  ctx: Ctx,
  myCode: string,
): Promise<{ blocked: boolean; awaitingCount: number }> {
  const db = ctx.db<typeof schema>();
  const [trades, feedback] = await Promise.all([
    db.select().from(schema.tradeOffers),
    db.select().from(schema.tradeFeedback),
  ]);
  const ratedByMe = new Set(
    feedback.filter((f) => f.fromCode === myCode).map((f) => f.tradeId),
  );
  const now = Date.now();
  let awaiting = 0;
  for (const t of trades) {
    if (t.status !== "accepted" || !t.completedAt) continue;
    if (t.proposerCode !== myCode && t.partnerCode !== myCode) continue;
    if (ratedByMe.has(t.id)) continue;
    if (now - Date.parse(t.completedAt) > FEEDBACK_WINDOW_MS) continue;
    awaiting += 1;
  }
  return { blocked: awaiting > 0, awaitingCount: awaiting };
}

/** Write a completed trade to the server trust ledger (one row
    per side). Best-effort like the marketplace writer; retried
    on later reads when the server was unreachable. */
async function recordTradeTrust(trade: TradeRow) {
  const res = await supabaseRest("trust_events", {
    method: "POST",
    body: [
      {
        collector_id: trade.proposerCode,
        event_type: "trade_confirmed",
        points: 2,
        counterparty: trade.partnerCode,
      },
      {
        collector_id: trade.partnerCode,
        event_type: "trade_confirmed",
        points: 2,
        counterparty: trade.proposerCode,
      },
    ],
  });
  return res.ok;
}

/** ---- Cash purchases (Anthony's split-button direction,
    Nov 2, 2026, late) ----
    The green cash third of the split "I want this" button: a
    cash purchase request to the card's owner, following the
    same deal lifecycle as trades (answer, both-sides confirm,
    trust ledger, mandatory blind feedback). The seller today
    is the built-in test friend Jarvis — the only friend whose
    stock lives server-side, exactly as with trades. */

const cashPurchaseView = z.object({
  purchaseId: z.number(),
  sellerUsername: z.string(),
  buyerUsername: z.string(),
  sellerCode: z.string(),
  sellerIsTest: z.boolean(),
  cardId: z.number(),
  name: z.string(),
  groupName: z.string(),
  printed: z.string().nullable(),
  finish: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  /** The TCG suggested market price for this row (per copy
      and total) at request time — the receiver price-checks
      the offered total against it. Null on pre-column rows,
      where the offered price IS the suggested price. */
  suggestedUnitPrice: z.number().nullable(),
  suggestedTotal: z.number().nullable(),
  /** "ask" | "market" */
  priceSource: z.string(),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]),
  buyerConfirmed: z.boolean(),
  sellerConfirmed: z.boolean(),
  completedAt: z.string().nullable(),
  myRating: z.enum(["positive", "negative"]).nullable(),
  theirRating: z.enum(["positive", "negative"]).nullable(),
  myTags: z.array(z.string()),
  theirTags: z.array(z.string()),
  myComment: z.string().nullable(),
  theirComment: z.string().nullable(),
  awaitingMyFeedback: z.boolean(),
  feedbackClosed: z.boolean(),
  createdAt: z.string(),
  /** The buyer's message that traveled WITH this purchase
      order (Anthony, Nov 3, 2026): written in the cash
      checkout before sending, seeded as the opening message
      of the purchase's thread, and surfaced here so the
      receiving side sees it alongside the invoice line
      without opening the thread. Null when the buyer sent
      no message. */
  orderMessage: z.string().nullable(),
  /** True when the viewer is this order's SELLER (the card
      otherwise reads from the buyer's side). */
  iAmSeller: z.boolean(),
  /** The seller's saved Zelle handle, for the order's "Pay
      the seller" line (Anthony, Nov 3, 2026): resolved only
      when the seller's handle is known to this app — i.e.
      the seller is this device's collector, whose handle
      lives on their profile. Shown only inside the order,
      never on a public profile. Null = no handle saved (or
      not resolvable here), and the line simply doesn't
      render for the buyer. */
  sellerZelleHandle: z.string().nullable(),
});

const cashPurchasesResponse = z.object({
  purchases: z.array(cashPurchaseView),
  gate: marketplaceGate,
});

const cashMutationResponse = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  purchaseId: z.number().nullable(),
});

type CashRow = typeof schema.cashPurchases.$inferSelect;

const CASH_GATE_MESSAGE =
  "You have a finished cash purchase still waiting on your feedback — leave the thumbs up or down on it first, then you can send new cash requests.";

/** The price a cash request for this card goes out at: the
    seller's own asking price when they have a live listing for
    the same printing and finish, otherwise the card's current
    market value for that finish. Null when neither exists —
    some cards carry no tracked price anywhere (the test
    friend's Mickey Mouse - Brave Little Tailor is the standing
    example), and a cash request is never priced by inventing
    a number. */
async function resolveCashPrice(
  ctx: Ctx,
  sellerCode: string,
  card: typeof schema.cards.$inferSelect,
  finish: string,
): Promise<{ price: number; source: "ask" | "market" } | null> {
  // Anthony's pricing rule (Nov 2, 2026, late): a cash price
  // is the card's current-day TCGplayer value — the app's
  // daily-repriced per-finish market figure — times quantity.
  // (The seller's marketplace ask no longer overrides it; the
  // buyer may still adjust the total at checkout, and the
  // receiver then sees the offer next to this suggested
  // price.) sellerCode is kept for the call sites' symmetry.
  void sellerCode;
  void ctx;
  const value = cardFinishMarketValue(card, finish);
  if (value != null && value > 0)
    return { price: Math.round(value * 100) / 100, source: "market" };
  return null;
}

/** How many copies of a printing + finish the test friend can
    sell — the same known stock his trades validate against. */
function jarvisStockQty(card: typeof schema.cards.$inferSelect, finish: string): number {
  const hit = JARVIS_TRADE_STOCK.find(
    (s) => s.name === card.fullName && s.finish === finish,
  );
  return hit?.qty ?? 0;
}

/** Trade-message link detection (Anthony's no-hyperlinks rule
    for trade threads): http(s) URLs, www. hosts, and bare
    domains on common TLDs are refused at send time. */
const DEAL_LINK_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|gg|me|tv|shop|store|xyz|info|biz|us|uk|de|jp|au|ca|fr|it|es|nl|se|no|fi|dk|br|mx|in|kr|tw|hk|sg|nz|za|pl|be|ch|at|ie|pt|gr)\b)/i;

/** Resolve a deal (a trade or a cash purchase) I am a party
    to, for its message thread. Returns null when the deal
    does not exist or I am not on it — a thread is only ever
    visible to the deal's two collectors. The thread is open
    while the deal is pending or accepted-and-uncompleted,
    and closed forever once it completes, is declined, or is
    cancelled. */
async function resolveDealForThread(
  ctx: Ctx,
  kind: "trade" | "cash",
  dealId: number,
): Promise<{
  otherCode: string;
  otherUsername: string;
  threadOpen: boolean;
} | null> {
  const profile = await ensureCollectorProfile(ctx);
  const me = profile.collectorCode;
  const db = ctx.db<typeof schema>();
  if (kind === "trade") {
    const rows = await db
      .select()
      .from(schema.tradeOffers)
      .where(eq(schema.tradeOffers.id, dealId))
      .limit(1);
    const t = rows[0];
    if (!t) return null;
    if (t.proposerCode !== me && t.partnerCode !== me) return null;
    const iAmProposer = t.proposerCode === me;
    return {
      otherCode: iAmProposer ? t.partnerCode : t.proposerCode,
      otherUsername: iAmProposer ? t.partnerUsername : t.proposerUsername,
      threadOpen:
        t.status === "pending" ||
        (t.status === "accepted" && !t.completedAt),
    };
  }
  const rows = await db
    .select()
    .from(schema.cashPurchases)
    .where(eq(schema.cashPurchases.id, dealId))
    .limit(1);
  const p = rows[0];
  if (!p) return null;
  if (p.buyerCode !== me && p.sellerCode !== me) return null;
  const iAmBuyer = p.buyerCode === me;
  return {
    otherCode: iAmBuyer ? p.sellerCode : p.buyerCode,
    otherUsername: iAmBuyer ? p.sellerUsername : p.buyerUsername,
    threadOpen:
      p.status === "pending" ||
      (p.status === "accepted" && !p.completedAt),
  };
}

const dealMessageView = z.object({
  id: z.number(),
  fromCode: z.string(),
  fromUsername: z.string(),
  mine: z.boolean(),
  body: z.string(),
  createdAt: z.string(),
});

const dealThreadResponse = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  threadOpen: z.boolean(),
  otherUsername: z.string().nullable(),
  messages: z.array(dealMessageView),
});

/** The cash feedback gate, mirroring the trade one: completed
    purchases waiting on MY rating block new cash requests. */
async function cashGateFor(
  ctx: Ctx,
  myCode: string,
): Promise<{ blocked: boolean; awaitingCount: number }> {
  const db = ctx.db<typeof schema>();
  const [purchases, feedback] = await Promise.all([
    db.select().from(schema.cashPurchases),
    db.select().from(schema.cashFeedback),
  ]);
  const ratedByMe = new Set(
    feedback.filter((f) => f.fromCode === myCode).map((f) => f.purchaseId),
  );
  const now = Date.now();
  let awaiting = 0;
  for (const p of purchases) {
    if (p.status !== "accepted" || !p.completedAt) continue;
    if (p.buyerCode !== myCode && p.sellerCode !== myCode) continue;
    if (ratedByMe.has(p.id)) continue;
    if (now - Date.parse(p.completedAt) > FEEDBACK_WINDOW_MS) continue;
    awaiting += 1;
  }
  return { blocked: awaiting > 0, awaitingCount: awaiting };
}

/** Write a completed cash purchase to the server trust ledger
    as a confirmed sale (one row per side, +2 each — the same
    event the marketplace deals record). Best-effort; retried
    on later reads when the server was unreachable. */
async function recordCashTrust(purchase: CashRow) {
  const res = await supabaseRest("trust_events", {
    method: "POST",
    body: [
      {
        collector_id: purchase.buyerCode,
        event_type: "marketplace_sale_confirmed",
        points: 2,
        counterparty: purchase.sellerCode,
      },
      {
        collector_id: purchase.sellerCode,
        event_type: "marketplace_sale_confirmed",
        points: 2,
        counterparty: purchase.buyerCode,
      },
    ],
  });
  return res.ok;
}

const profileSummaryResponse = z.object({
  joinedAt: z.string().nullable(),
  founder: z.boolean(),
  trustScore: z.number(),
  confirmedConnections: z.number(),
  confirmedTrades: z.number(),
  totalItems: z.number(),
  completedSets: z.array(z.string()),
  ownsEnchanted: z.boolean(),
  ownsIconic: z.boolean(),
  sealedCount: z.number(),
  registryReachable: z.boolean(),
});

export const Actions = {
  seedBinder: defineAction({
    description:
      "Seeds the binder once with the full Lorcana card catalog and Anthony's ownership from his Nov 1 2026 Shiny export; on later loads it only backfills per-finish price data and the finance history snapshots, never overwriting ownership counts.",
    request: z.object({}),
    response: seedResponse,
    async handler(ctx): Promise<z.infer<typeof seedResponse>> {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.cards);
      if (existing.length > 0) {
        // Catalog additions since the binder was first seeded
        // (the puzzle/lore insert sections, Nov 3, 2026): insert
        // any catalog entry whose uid has no row yet, slotted
        // exactly where a fresh seed would put it. Existing rows
        // — and every ownership count on them — are never touched
        // by this; new rows start unowned (ghosted).
        const existingUids = new Set(existing.map((r) => r.uid));
        if (fullCatalog.some((e) => !existingUids.has(e.uid))) {
          const byGroup = new Map<string, CatalogEntry[]>();
          for (const entry of fullCatalog) {
            const key = groupKeyOf(entry);
            const list = byGroup.get(key) ?? [];
            list.push(entry);
            byGroup.set(key, list);
          }
          const newRows: (typeof schema.cards.$inferInsert)[] = [];
          for (const list of byGroup.values()) {
            const sorted = [...list].sort((a, b) => {
              const na = a.number ?? 99999;
              const nb = b.number ?? 99999;
              if (na !== nb) return na - nb;
              return (a.fullName ?? "").localeCompare(b.fullName ?? "");
            });
            sorted.forEach((entry, idx) => {
              if (existingUids.has(entry.uid)) return;
              const own = ownership[entry.uid];
              newRows.push({
                uid: entry.uid,
                grp: entry.grp,
                groupKey: groupKeyOf(entry),
                groupName: entry.setName,
                groupLabel: groupLabelOf(entry),
                groupSort: groupSortOf(entry),
                slotSort: idx,
                setCode: entry.setCode,
                family: entry.family,
                number: entry.number,
                printed: entry.printed,
                fullName: entry.fullName ?? entry.name ?? "Unknown card",
                name: entry.name,
                rarity: entry.rarity,
                ink: entry.ink,
                cost: entry.cost,
                inkwell: entry.inkwell ? 1 : 0,
                cardType: entry.type,
                strength: entry.strength,
                willpower: entry.willpower,
                lore: entry.lore,
                cardText: entry.text,
                subtypes: entry.subtypes,
                imageUrl: entry.image,
                imageBlobKey: null,
                tcgplayerId:
                  entry.tcg != null
                    ? String(entry.tcg)
                    : (tcgplayerBackfill[entry.uid] ?? null),
                ownedQty: own?.qty ?? 0,
                finishes: JSON.stringify(own?.finishes ?? {}),
                marketValue: own && own.value > 0 ? own.value : null,
                paidValue: own ? own.paid : null,
                financeJson: financeJsonOf(own),
              });
            });
          }
          for (let i = 0; i < newRows.length; i += 250) {
            await db.insert(schema.cards).values(newRows.slice(i, i + 250));
          }
          existing.push(
            ...(newRows as unknown as (typeof schema.cards.$inferSelect)[]),
          );
        }
        // Already seeded: backfill price fields (per-finish value/paid,
        // average paid) from the Nov 1 2026 export data and seed the
        // finance history once. Ownership counts are not touched — edits
        // made in the UI are the live record — EXCEPT on the one-time
        // sync marked "sync:v2": binders seeded by the first build had a
        // handful of promo printings matched to the wrong catalog card,
        // so counts are reset to the export exactly once, when the
        // corrected data first syncs.
        const marker = await db
          .select({ id: schema.financeSnapshots.id })
          .from(schema.financeSnapshots)
          .where(eq(schema.financeSnapshots.label, "sync:v2"))
          .limit(1);
        const firstCorrectedSync = marker.length === 0;
        for (const row of existing) {
          const own = ownership[row.uid];
          const financeJson = financeJsonOf(own);
          const marketValue = own && own.value > 0 ? own.value : null;
          const set: Partial<typeof schema.cards.$inferInsert> = {};
          if (row.financeJson !== financeJson) set.financeJson = financeJson;
          // TCGplayer IDs recovered from his Shiny exports (Hyperia
          // City above all) persist where the catalog had none; an
          // ID already stored is never overwritten.
          const backfilledTcg = tcgIdOf(row);
          if (row.tcgplayerId !== backfilledTcg) {
            set.tcgplayerId = backfilledTcg;
          }
          if (row.marketValue !== marketValue) set.marketValue = marketValue;
          if (row.paidValue !== (own ? own.paid : null)) {
            set.paidValue = own ? own.paid : null;
          }
          if (firstCorrectedSync) {
            const qty = own?.qty ?? 0;
            const finishesJson = JSON.stringify(own?.finishes ?? {});
            if (row.ownedQty !== qty) set.ownedQty = qty;
            if (row.finishes !== finishesJson) set.finishes = finishesJson;
          }
          if (Object.keys(set).length > 0) {
            await db
              .update(schema.cards)
              .set(set)
              .where(eq(schema.cards.id, row.id));
          }
        }
        const snaps = await db
          .select({ id: schema.financeSnapshots.id })
          .from(schema.financeSnapshots)
          .limit(1);
        if (snaps.length === 0) {
          await db.insert(schema.financeSnapshots).values(HISTORY_ROWS);
        }
        if (firstCorrectedSync) {
          await db.insert(schema.financeSnapshots).values({
            date: "2026-11-01",
            label: "sync:v2",
            value: 0,
            paid: 0,
            cards: 0,
            source: "sync",
          });
        }
        const histCount = await db
          .select({ id: schema.cardPriceHistory.id })
          .from(schema.cardPriceHistory)
          .limit(1);
        if (histCount.length === 0) {
          for (let i = 0; i < CARD_HISTORY_ROWS.length; i += 250) {
            await db
              .insert(schema.cardPriceHistory)
              .values(CARD_HISTORY_ROWS.slice(i, i + 250));
          }
        }
        ctx.invalidateQueries();
        return {
          seeded: false,
          slots: existing.length,
          ownedSlots: existing.filter((r) => r.ownedQty > 0).length,
          ownedQty: existing.reduce((sum, r) => sum + r.ownedQty, 0),
        };
      }

      // Order entries into binder sections and slots.
      const byGroup = new Map<string, CatalogEntry[]>();
      for (const entry of fullCatalog) {
        const key = groupKeyOf(entry);
        const list = byGroup.get(key) ?? [];
        list.push(entry);
        byGroup.set(key, list);
      }
      const rows: (typeof schema.cards.$inferInsert)[] = [];
      for (const list of byGroup.values()) {
        const sorted = [...list].sort((a, b) => {
          const na = a.number ?? 99999;
          const nb = b.number ?? 99999;
          if (na !== nb) return na - nb;
          return (a.fullName ?? "").localeCompare(b.fullName ?? "");
        });
        sorted.forEach((entry, idx) => {
          const own = ownership[entry.uid];
          rows.push({
            uid: entry.uid,
            grp: entry.grp,
            groupKey: groupKeyOf(entry),
            groupName: entry.setName,
            groupLabel: groupLabelOf(entry),
            groupSort: groupSortOf(entry),
            slotSort: idx,
            setCode: entry.setCode,
            family: entry.family,
            number: entry.number,
            printed: entry.printed,
            fullName: entry.fullName ?? entry.name ?? "Unknown card",
            name: entry.name,
            rarity: entry.rarity,
            ink: entry.ink,
            cost: entry.cost,
            inkwell: entry.inkwell ? 1 : 0,
            cardType: entry.type,
            strength: entry.strength,
            willpower: entry.willpower,
            lore: entry.lore,
            cardText: entry.text,
            subtypes: entry.subtypes,
            imageUrl: entry.image,
            imageBlobKey: null,
            tcgplayerId:
              entry.tcg != null
                ? String(entry.tcg)
                : (tcgplayerBackfill[entry.uid] ?? null),
            ownedQty: own?.qty ?? 0,
            finishes: JSON.stringify(own?.finishes ?? {}),
            marketValue: own && own.value > 0 ? own.value : null,
            paidValue: own ? own.paid : null,
            financeJson: financeJsonOf(own),
          });
        });
      }

      const CHUNK = 250;
      for (let i = 0; i < rows.length; i += CHUNK) {
        await db.insert(schema.cards).values(rows.slice(i, i + CHUNK));
      }
      const snaps = await db
        .select({ id: schema.financeSnapshots.id })
        .from(schema.financeSnapshots)
        .limit(1);
      if (snaps.length === 0) {
        await db.insert(schema.financeSnapshots).values(HISTORY_ROWS);
      }
      await db.insert(schema.financeSnapshots).values({
        date: "2026-11-01",
        label: "sync:v2",
        value: 0,
        paid: 0,
        cards: 0,
        source: "sync",
      });
      for (let i = 0; i < CARD_HISTORY_ROWS.length; i += 250) {
        await db
          .insert(schema.cardPriceHistory)
          .values(CARD_HISTORY_ROWS.slice(i, i + 250));
      }
      ctx.invalidateQueries();
      return {
        seeded: true,
        slots: rows.length,
        ownedSlots: rows.filter((r) => (r.ownedQty ?? 0) > 0).length,
        ownedQty: rows.reduce((sum, r) => sum + (r.ownedQty ?? 0), 0),
      };
    },
  }),

  getBinder: defineAction({
    description:
      "Returns the binder's sections (sets, promo families, quests) with slot counts and overall collection totals.",
    request: z.object({}),
    response: binderResponse,
    async handler(ctx): Promise<z.infer<typeof binderResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .orderBy(asc(schema.cards.groupSort));
      const groupsMap = new Map<
        string,
        z.infer<typeof binderResponse>["groups"][number]
      >();
      let ownedSlots = 0;
      let ownedQty = 0;
      let totalPockets = 0;
      for (const row of rows) {
        ownedQty += row.ownedQty;
        const pockets = pocketsOf(row);
        totalPockets += pockets.length;
        const group = groupsMap.get(row.groupKey) ?? {
          key: row.groupKey,
          kind: row.grp,
          name: row.groupName,
          label: row.groupLabel,
          total: 0,
          owned: 0,
          pages: 0,
          missingPockets: 0,
          costToComplete: 0,
          unpricedMissing: 0,
        };
        for (const pocket of pockets) {
          group.total += 1;
          if (pocket.qty > 0) {
            group.owned += 1;
            ownedSlots += 1;
          } else {
            group.missingPockets += 1;
            const price = pocketPrice(row, pocket);
            if (price != null) {
              group.costToComplete += price;
            } else {
              group.unpricedMissing += 1;
            }
          }
        }
        groupsMap.set(row.groupKey, group);
      }
      const groups = [...groupsMap.values()];
      for (const group of groups) {
        group.pages = Math.max(1, Math.ceil(group.total / PAGE_SIZE));
        group.costToComplete = Math.round(group.costToComplete * 100) / 100;
      }
      return {
        groups,
        totals: {
          slots: totalPockets,
          ownedSlots,
          missingSlots: totalPockets - ownedSlots,
          ownedQty,
        },
      };
    },
  }),

  getDealMessages: defineAction({
    description:
      "Returns the message thread that lives inside one trade or cash purchase — only ever to one of that deal's two collectors — with whether the thread is still open. Threads open with the deal and close to new messages when it completes, is declined, or is cancelled; the history stays readable on the deal's record. There is no other messaging in the app: no DMs, no friends-list chat, no groups.",
    request: z.object({
      kind: z.enum(["trade", "cash"]),
      dealId: z.number(),
    }),
    response: dealThreadResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof dealThreadResponse>> {
      const deal = await resolveDealForThread(ctx, args.kind, args.dealId);
      if (!deal)
        return {
          ok: false,
          error: "That conversation isn't available.",
          threadOpen: false,
          otherUsername: null,
          messages: [],
        };
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.dealMessages)
        .where(
          and(
            eq(schema.dealMessages.kind, args.kind),
            eq(schema.dealMessages.dealId, args.dealId),
          ),
        )
        .orderBy(asc(schema.dealMessages.id));
      return {
        ok: true,
        error: null,
        threadOpen: deal.threadOpen,
        otherUsername: deal.otherUsername,
        messages: rows.map((m) => ({
          id: m.id,
          fromCode: m.fromCode,
          fromUsername: m.fromUsername,
          mine: m.fromCode === profile.collectorCode,
          body: m.body,
          createdAt: m.createdAt,
        })),
      };
    },
  }),

  sendDealMessage: defineAction({
    description:
      "Sends a text message inside a trade's or cash purchase's own thread. Text only — no photos or attachments exist in trade messages. Refused when the sender is not one of the deal's two collectors, when the deal is finished (the thread is closed), or when the message contains a link: links are not allowed in trade messages. asTestSide sends AS the built-in test friend Jarvis so Anthony can walk both sides of the thread; only possible on a deal with him.",
    request: z.object({
      kind: z.enum(["trade", "cash"]),
      dealId: z.number(),
      body: z.string().min(1).max(500),
      asTestSide: z.boolean(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: boolean; error: string | null }> {
      const fail = (error: string) => ({ ok: false, error });
      const deal = await resolveDealForThread(ctx, args.kind, args.dealId);
      if (!deal) return fail("That conversation isn't available.");
      if (!deal.threadOpen)
        return fail(
          "This conversation is closed — the deal is finished. The messages stay on the deal's record.",
        );
      const body = args.body.trim();
      if (!body) return fail("Write a message first.");
      if (DEAL_LINK_PATTERN.test(body))
        return fail(
          "Links aren't allowed in trade messages — remove the link and send again.",
        );
      const profile = await ensureCollectorProfile(ctx);
      let fromCode = profile.collectorCode;
      let fromUsername = profile.username;
      if (args.asTestSide) {
        if (deal.otherCode !== JARVIS_REGISTRY_PROFILE.collector_id)
          return fail(
            "That reply is only possible on a deal with the test friend.",
          );
        fromCode = JARVIS_REGISTRY_PROFILE.collector_id;
        fromUsername = JARVIS_REGISTRY_PROFILE.username;
      }
      const db = ctx.db<typeof schema>();
      await db.insert(schema.dealMessages).values({
        kind: args.kind,
        dealId: args.dealId,
        fromCode,
        fromUsername,
        body,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, error: null };
    },
  }),

  getOrderMailStatus: defineAction({
    description:
      "Unread order-mail counts for the signed-in collector (Anthony, Nov 3, 2026, ~2:02 AM: a reply inside an order must never land silently). For every trade and cash purchase the collector is part of, counts messages from the OTHER party newer than the collector's read marker for that thread (no marker = all of them). Returns the total plus the per-order breakdown that drives the mail indicators on Home, on the Trades entry, and on each order.",
    request: z.object({}),
    response: z.object({
      totalUnread: z.number(),
      deals: z.array(
        z.object({
          kind: z.enum(["trade", "cash"]),
          dealId: z.number(),
          unread: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const [cashRows, tradeRows, readRows, messages] = await Promise.all([
        db.select().from(schema.cashPurchases),
        db.select().from(schema.tradeOffers),
        db
          .select()
          .from(schema.dealThreadReads)
          .where(eq(schema.dealThreadReads.viewerCode, me)),
        db.select().from(schema.dealMessages),
      ]);
      const readAt = new Map<string, string>();
      for (const r of readRows)
        readAt.set(`${r.kind}:${r.dealId}`, r.lastReadAt);
      const mine: { kind: "trade" | "cash"; dealId: number }[] = [];
      for (const p of cashRows)
        if (p.buyerCode === me || p.sellerCode === me)
          mine.push({ kind: "cash", dealId: p.id });
      for (const t of tradeRows)
        if (t.proposerCode === me || t.partnerCode === me)
          mine.push({ kind: "trade", dealId: t.id });
      const mineKeys = new Set(mine.map((d) => `${d.kind}:${d.dealId}`));
      const unreadByDeal = new Map<string, number>();
      for (const m of messages) {
        const key = `${m.kind}:${m.dealId}`;
        if (!mineKeys.has(key)) continue;
        if (m.fromCode === me) continue;
        const marker = readAt.get(key);
        if (marker && m.createdAt <= marker) continue;
        unreadByDeal.set(key, (unreadByDeal.get(key) ?? 0) + 1);
      }
      const deals = mine
        .map((d) => ({
          kind: d.kind,
          dealId: d.dealId,
          unread: unreadByDeal.get(`${d.kind}:${d.dealId}`) ?? 0,
        }))
        .filter((d) => d.unread > 0);
      return {
        totalUnread: deals.reduce((sum, d) => sum + d.unread, 0),
        deals,
      };
    },
  }),

  markDealThreadRead: defineAction({
    description:
      "Marks one order message thread as read by the signed-in collector — called when they open the thread — so its unread mail indicators clear. Refused when the collector is not one of the deal's two parties.",
    request: z.object({
      kind: z.enum(["trade", "cash"]),
      dealId: z.number(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const deal = await resolveDealForThread(ctx, args.kind, args.dealId);
      if (!deal) return { ok: false };
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      const existing = await db
        .select()
        .from(schema.dealThreadReads)
        .where(
          and(
            eq(schema.dealThreadReads.viewerCode, profile.collectorCode),
            eq(schema.dealThreadReads.kind, args.kind),
            eq(schema.dealThreadReads.dealId, args.dealId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await db
          .update(schema.dealThreadReads)
          .set({ lastReadAt: now })
          .where(eq(schema.dealThreadReads.id, existing[0].id));
      } else {
        await db.insert(schema.dealThreadReads).values({
          viewerCode: profile.collectorCode,
          kind: args.kind,
          dealId: args.dealId,
          lastReadAt: now,
        });
      }
      return { ok: true };
    },
  }),

  getInbox: defineAction({
    description:
      "The signed-in collector's personal Inbox (Anthony, Nov 3, 2026): every cash purchase order and trade offer involving them, plus — for the owner — every change-request ticket, as one mail-style list. Each item carries its Subject (Purchase Order / Trade Offer / the ticket's type), who it's From, the latest activity date, a short preview, its status, and how many messages in it are unread. Opening an order item opens that order; opening a ticket item opens that ticket.",
    request: z.object({}),
    response: z.object({
      items: z.array(
        z.object({
          key: z.string(),
          kind: z.enum(["cash", "trade", "ticket"]),
          refId: z.number(),
          subject: z.string(),
          fromUsername: z.string(),
          date: z.string(),
          preview: z.string(),
          status: z.string(),
          unreadCount: z.number(),
        }),
      ),
      totalUnread: z.number(),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const [cashRows, tradeRows, readRows, messages] = await Promise.all([
        db.select().from(schema.cashPurchases),
        db.select().from(schema.tradeOffers),
        db
          .select()
          .from(schema.dealThreadReads)
          .where(eq(schema.dealThreadReads.viewerCode, me)),
        db.select().from(schema.dealMessages),
      ]);
      const readAt = new Map<string, string>();
      for (const r of readRows)
        readAt.set(`${r.kind}:${r.dealId}`, r.lastReadAt);
      const lastMsg = new Map<
        string,
        (typeof schema.dealMessages.$inferSelect)[]
      >();
      for (const m of messages) {
        const key = `${m.kind}:${m.dealId}`;
        const list = lastMsg.get(key) ?? [];
        list.push(m);
        lastMsg.set(key, list);
      }
      const threadInfo = (kind: "cash" | "trade", dealId: number) => {
        const key = `${kind}:${dealId}`;
        const msgs = (lastMsg.get(key) ?? []).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        );
        const marker = readAt.get(key);
        let unread = 0;
        for (const m of msgs) {
          if (m.fromCode === me) continue;
          if (marker && m.createdAt <= marker) continue;
          unread += 1;
        }
        const last = msgs[msgs.length - 1];
        return {
          unread,
          lastBody: last?.body ?? null,
          lastAt: last?.createdAt ?? null,
        };
      };
      type InboxItem = {
        key: string;
        kind: "cash" | "trade" | "ticket";
        refId: number;
        subject: string;
        fromUsername: string;
        date: string;
        preview: string;
        status: string;
        unreadCount: number;
      };
      const items: InboxItem[] = [];
      for (const p of cashRows) {
        if (p.buyerCode !== me && p.sellerCode !== me) continue;
        const info = threadInfo("cash", p.id);
        items.push({
          key: `cash:${p.id}`,
          kind: "cash",
          refId: p.id,
          subject: "Purchase Order",
          fromUsername: p.buyerUsername,
          date: info.lastAt ?? p.createdAt,
          preview:
            info.lastBody ??
            `${p.name} · ${p.qty} × $${(p.unitPrice * p.qty).toFixed(2)} total`,
          status: p.status,
          unreadCount: info.unread,
        });
      }
      for (const t of tradeRows) {
        if (t.proposerCode !== me && t.partnerCode !== me) continue;
        const info = threadInfo("trade", t.id);
        let giveCount = 0;
        let getCount = 0;
        try {
          const g: unknown = JSON.parse(t.giveJson);
          const r: unknown = JSON.parse(t.getJson);
          if (Array.isArray(g)) giveCount = g.length;
          if (Array.isArray(r)) getCount = r.length;
        } catch {
          // Counts stay 0; the preview falls back to the note.
        }
        items.push({
          key: `trade:${t.id}`,
          kind: "trade",
          refId: t.id,
          subject: "Trade Offer",
          fromUsername: t.proposerUsername,
          date: info.lastAt ?? t.createdAt,
          preview:
            info.lastBody ??
            t.note ??
            `Offers ${giveCount} item${giveCount === 1 ? "" : "s"}, asks ${getCount} item${getCount === 1 ? "" : "s"}`,
          status: t.status,
          unreadCount: info.unread,
        });
      }
      if (me === OWNER_COLLECTOR_CODE) {
        const tickets = await db.select().from(schema.changeRequests);
        const subjectOf = (kind: string) =>
          kind === "bug" ? "Bug" : kind === "idea" ? "Idea" : "Change Request";
        for (const t of tickets) {
          items.push({
            key: `ticket:${t.id}`,
            kind: "ticket",
            refId: t.id,
            subject: subjectOf(t.kind),
            fromUsername: t.senderUsername,
            date: t.createdAt,
            preview: t.message.slice(0, 140),
            status: t.status,
            unreadCount: t.readAt ? 0 : 1,
          });
        }
      }
      // Per-user Inbox deletions (Anthony, Nov 3, 2026): an
      // item the viewer deleted stays out of THEIR Inbox
      // until newer activity lands after the deletion — the
      // item's date IS its latest activity, so a new message
      // in the thread brings it back with that message.
      const deletions = await db
        .select()
        .from(schema.inboxDeletions)
        .where(eq(schema.inboxDeletions.viewerCode, me));
      const deletedAt = new Map<string, string>();
      for (const d of deletions)
        deletedAt.set(`${d.kind}:${d.refId}`, d.deletedAt);
      const visible = items.filter((i) => {
        const gone = deletedAt.get(`${i.kind}:${i.refId}`);
        return gone == null || i.date > gone;
      });
      visible.sort((a, b) => b.date.localeCompare(a.date));
      return {
        items: visible,
        totalUnread: visible.reduce((sum, i) => sum + i.unreadCount, 0),
      };
    },
  }),

  deleteInboxItem: defineAction({
    description:
      "Deletes one item from the signed-in collector's own Inbox (Anthony, Nov 3, 2026): per-user, like deleting an email — the underlying purchase order, trade, or ticket is not cancelled or altered, and the other party keeps their copy. If the other side later posts a new message in that thread, the item reappears in this Inbox with it. Only a party to the order (or the owner, for tickets) can delete it.",
    request: z.object({
      kind: z.enum(["cash", "trade", "ticket"]),
      refId: z.number().int().positive(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      // Party check: you can only delete mail that is yours.
      if (args.kind === "cash") {
        const [row] = await db
          .select()
          .from(schema.cashPurchases)
          .where(eq(schema.cashPurchases.id, args.refId));
        if (!row || (row.buyerCode !== me && row.sellerCode !== me)) {
          return { ok: false, error: "That message isn't in your Inbox." };
        }
      } else if (args.kind === "trade") {
        const [row] = await db
          .select()
          .from(schema.tradeOffers)
          .where(eq(schema.tradeOffers.id, args.refId));
        if (!row || (row.proposerCode !== me && row.partnerCode !== me)) {
          return { ok: false, error: "That message isn't in your Inbox." };
        }
      } else {
        if (me !== OWNER_COLLECTOR_CODE) {
          return { ok: false, error: "That message isn't in your Inbox." };
        }
        const [row] = await db
          .select()
          .from(schema.changeRequests)
          .where(eq(schema.changeRequests.id, args.refId));
        if (!row) {
          return { ok: false, error: "That message isn't in your Inbox." };
        }
      }
      const now = new Date().toISOString();
      const existing = await db
        .select()
        .from(schema.inboxDeletions)
        .where(eq(schema.inboxDeletions.viewerCode, me));
      const mine = existing.find(
        (d) => d.kind === args.kind && d.refId === args.refId,
      );
      if (mine) {
        await db
          .update(schema.inboxDeletions)
          .set({ deletedAt: now })
          .where(eq(schema.inboxDeletions.id, mine.id));
      } else {
        await db.insert(schema.inboxDeletions).values({
          viewerCode: me,
          kind: args.kind,
          refId: args.refId,
          deletedAt: now,
        });
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  getSealed: defineAction({
    description:
      "Returns Anthony's sealed products from his latest Shiny export (booster boxes, prerelease box, booster packs) with quantity, market value, and amount paid per item, plus sealed totals.",
    request: z.object({}),
    response: z.object({
      items: z.array(
        z.object({
          name: z.string(),
          setName: z.string(),
          qty: z.number(),
          unitValue: z.number(),
          value: z.number(),
          paid: z.number(),
          /** Total value in yen for Japanese-edition items, else null. */
          jpyValue: z.number().nullable(),
          /** Market source label for non-Shiny items, else null. */
          marketSourceLabel: z.string().nullable(),
          /** ISO instant the quantity was last set in the app,
              else null — the Sealed date sort's honest input. */
          acquiredAt: z.string().nullable(),
        }),
      ),
      totals: z.object({
        qty: z.number(),
        value: z.number(),
        paid: z.number(),
      }),
    }),
    async handler(ctx) {
      return effectiveSealed(ctx);
    },
  }),

  getSealedItem: defineAction({
    description:
      "Returns full details for one sealed product — the same attributes a card gets: set, type, quantity owned, value and paid per unit and in total, gain/loss, and its value-per-unit history from the Shiny exports — for the item's own detail view.",
    request: z.object({ name: z.string().min(1) }),
    response: z.object({
      name: z.string(),
      setName: z.string(),
      qty: z.number(),
      valuePerUnit: z.number(),
      paidPerUnit: z.number(),
      valueTotal: z.number(),
      paidTotal: z.number(),
      net: z.number(),
      /** TCGplayer product ID from the Shiny export, for the Best
          Offer link in the item's performance section. Null for the
          Japanese-edition items TCGplayer doesn't track — those
          carry marketUrl/marketSourceLabel instead. */
      tcgplayerId: z.string().nullable(),
      /** Per-unit value in yen for Japanese-edition items, else null. */
      jpyValuePerUnit: z.number().nullable(),
      /** Yen-conversion note (rate, source, date), else null. */
      fxNote: z.string().nullable(),
      /** Market source label for non-Shiny items, else null. */
      marketSourceLabel: z.string().nullable(),
      /** The market source's product page (Best Offer link), else null. */
      marketUrl: z.string().nullable(),
      asOfLabel: z.string(),
      priceHistory: z.array(
        z.object({
          date: z.string(),
          label: z.string(),
          value: z.number(),
          source: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const base = allSealedItems.find((i) => i.name === args.name);
      if (!base) throw new Error(`Unknown sealed item: ${args.name}`);
      await ensureSealedHistory(ctx);
      const db = ctx.db<typeof schema>();
      const eff = await effectiveSealed(ctx);
      const item = eff.items.find((i) => i.name === args.name) ?? {
        name: base.name,
        setName: base.setName,
        qty: base.qty,
        value: base.value,
        paid: base.paid,
      };
      const unitValue = base.qty > 0 ? base.value / base.qty : base.value;
      const unitPaid = base.qty > 0 ? base.paid / base.qty : base.paid;
      const histRows = await db
        .select()
        .from(schema.sealedPriceHistory)
        .where(eq(schema.sealedPriceHistory.name, args.name))
        .orderBy(asc(schema.sealedPriceHistory.id));
      const snaps = (
        await db
          .select()
          .from(schema.financeSnapshots)
          .orderBy(asc(schema.financeSnapshots.id))
      ).filter((s) => s.source !== "sync");
      const asOfLabel =
        snaps.length > 0
          ? (snaps[snaps.length - 1]?.label ?? "Nov 1 (latest)")
          : "Nov 1 (latest)";
      return {
        name: item.name,
        setName: item.setName,
        qty: item.qty,
        valuePerUnit: Math.round(unitValue * 100) / 100,
        paidPerUnit: Math.round(unitPaid * 100) / 100,
        valueTotal: item.value,
        paidTotal: item.paid,
        net: Math.round((item.value - item.paid) * 100) / 100,
        tcgplayerId: base.tcgplayerId ?? null,
        jpyValuePerUnit:
          base.jpyValue != null && base.qty > 0
            ? Math.round(base.jpyValue / base.qty)
            : (base.jpyValue ?? null),
        fxNote: base.fxNote ?? null,
        marketSourceLabel: base.marketSourceLabel ?? null,
        marketUrl: base.marketUrl ?? null,
        asOfLabel,
        priceHistory: histRows.map((h) => ({
          date: h.date,
          label: h.label,
          value: h.unitValue,
          source: h.source,
        })),
      };
    },
  }),

  setSealedQty: defineAction({
    description:
      "Sets how many copies of a sealed product Anthony owns, from the plus/minus controls on the Sealed shelf; persists as an override over the export quantity and flows into the collection totals.",
    request: z.object({
      name: z.string().min(1),
      qty: z.number().int().min(0).max(999),
    }),
    response: z.object({ ok: z.literal(true), qty: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; qty: number }> {
      if (!allSealedItems.some((i) => i.name === args.name)) {
        throw new Error(`Unknown sealed item: ${args.name}`);
      }
      const db = ctx.db<typeof schema>();
      const nowIso = new Date().toISOString();
      await db
        .insert(schema.sealedQty)
        .values({ name: args.name, qty: args.qty, updatedAt: nowIso })
        .onConflictDoUpdate({
          target: schema.sealedQty.name,
          set: { qty: args.qty, updatedAt: nowIso },
        });
      // Cloud backup stays current on every quantity change
      // (best-effort push of just this item's row).
      await syncSealedToCloud(ctx, args.name, args.qty);
      return { ok: true, qty: args.qty };
    },
  }),

  getPage: defineAction({
    description:
      "Returns one 12-pocket binder page (4x3) for a section, optionally filtered to owned or missing cards only.",
    request: z.object({
      groupKey: z.string().min(1),
      page: z.number().int().min(0).default(0),
      filter: z.enum(["all", "owned", "missing"]).default("all"),
    }),
    response: pageResponse,
    async handler(ctx, args): Promise<z.infer<typeof pageResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.groupKey, args.groupKey))
        .orderBy(asc(schema.cards.slotSort));
      const pockets = toPockets(rows, args.filter);
      const pageCount = Math.max(1, Math.ceil(pockets.length / PAGE_SIZE));
      const page = Math.min(args.page, pageCount - 1);
      const pageRows = pockets.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
      return {
        cards: pageRows,
        page,
        pageCount,
        total: pockets.length,
      };
    },
  }),

  getSection: defineAction({
    description:
      "Returns every card in one binder section as a single continuous list (4 across, scrolling down), optionally filtered to owned or missing cards only.",
    request: z.object({
      groupKey: z.string().min(1),
      filter: z.enum(["all", "owned", "missing"]).default("all"),
    }),
    response: sectionResponse,
    async handler(ctx, args): Promise<z.infer<typeof sectionResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.groupKey, args.groupKey))
        .orderBy(asc(schema.cards.slotSort));
      const pockets = toPockets(rows, args.filter);
      return {
        cards: pockets,
        total: pockets.length,
      };
    },
  }),

  getCard: defineAction({
    description:
      "Returns full details for one binder card: stats, rules text, finishes owned, and its market value from the Nov 1 2026 export.",
    request: z.object({ cardId: z.number().int().positive() }),
    response: cardDetailResponse,
    async handler(ctx, args): Promise<z.infer<typeof cardDetailResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("Card not found");
      const finishes = parseFinishes(row.finishes);
      const prices = parseFinance(row.financeJson);
      const money = cardMoney(row);
      const byFinish = Object.entries(finishes).map(([finish, qty]) => {
        const price = prices[finish];
        const unitValue = price?.value ?? row.marketValue ?? null;
        const unitPaid = price?.paid ?? row.paidValue ?? null;
        return {
          finish,
          qty,
          valuePerUnit: unitValue,
          paidPerUnit: unitPaid,
          valueTotal: Math.round((unitValue ?? 0) * qty * 100) / 100,
          paidTotal: Math.round((unitPaid ?? 0) * qty * 100) / 100,
        };
      });
      const histRows = await db
        .select()
        .from(schema.cardPriceHistory)
        .where(eq(schema.cardPriceHistory.uid, row.uid))
        .orderBy(asc(schema.cardPriceHistory.id));
      // Bundled-history fallback (Fru Fru - VIP Guest #1, Hyperia
      // City, re-reported Nov 2, 2026): card_price_history is seeded
      // exactly once, when the table is empty — a binder seeded by
      // an earlier build can therefore be missing points the bundled
      // export history (the same real five exports) has carried all
      // along, and the seed never runs again to backfill them. When
      // the table has no rows for this printing, serve the bundled
      // points directly so every owned printing shows its real
      // chart; daily re-pricing points live only in the table, so
      // a non-empty table always wins.
      const bundledHist =
        histRows.length === 0
          ? (cardHistory[row.uid] ?? []).map((pt) => ({
              date: pt.date,
              label: pt.label,
              unitValue: pt.value,
              source: "export",
            }))
          : [];
      const snaps = (await db
        .select()
        .from(schema.financeSnapshots)
        .orderBy(asc(schema.financeSnapshots.id))).filter((s) => s.source !== "sync");
      const asOfLabel =
        snaps.length > 0
          ? (snaps[snaps.length - 1]?.label ?? "Nov 1 (latest)")
          : "Nov 1 (latest)";
      return {
        id: row.id,
        fullName: row.fullName,
        groupName: row.groupName,
        groupLabel: row.groupLabel,
        printed: row.printed,
        rarity: row.rarity,
        ink: row.ink,
        cost: row.cost,
        inkwell: row.inkwell === 1,
        cardType: row.cardType,
        subtypes: row.subtypes,
        strength: row.strength,
        willpower: row.willpower,
        lore: row.lore,
        cardText: row.cardText,
        ownedQty: row.ownedQty,
        finishes,
        // Fall back to the Lorcast snapshot (via the shared
        // chain) when the database carries no price for this
        // printing — a friend's profile prices his cards
        // through this field, and an unpriced-in-database card
        // like Mickey Mouse - Brave Little Tailor showed no
        // price at all (Nov 3, 2026).
        marketValue:
          row.marketValue ?? cardFinishMarketValue(row, "Regular"),
        tcgplayerId: tcgIdOf(row),
        finance: {
          byFinish,
          valueTotal: Math.round(money.value * 100) / 100,
          paidTotal: Math.round(money.paid * 100) / 100,
          net: Math.round((money.value - money.paid) * 100) / 100,
          asOfLabel,
        },
        priceHistory: (histRows.length > 0 ? histRows : bundledHist).map(
          (h) => ({
            date: h.date,
            label: h.label,
            value: h.unitValue,
            source: h.source,
          }),
        ),
      };
    },
  }),

  getSetCompletion: defineAction({
    description:
      "Returns one binder section's completion figures: pockets owned vs total, the cost to complete the COMPLETE set (every missing printing and finish, Enchanteds and Iconics included), and the full missing list with current prices and TCGplayer ids.",
    request: z.object({ groupKey: z.string().min(1) }),
    response: z.object({
      groupKey: z.string(),
      groupName: z.string(),
      groupLabel: z.string(),
      totalPockets: z.number(),
      ownedPockets: z.number(),
      missingCount: z.number(),
      costToComplete: z.number(),
      unpricedMissing: z.number(),
      priceNote: z.string(),
      missing: z.array(
        z.object({
          cardId: z.number(),
          fullName: z.string(),
          printed: z.string(),
          rarity: z.string().nullable(),
          finishLabel: z.string(),
          price: z.number().nullable(),
          tcgplayerId: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.groupKey, args.groupKey))
        .orderBy(asc(schema.cards.slotSort));
      const first = rows[0];
      if (!first) throw new Error(`Unknown section: ${args.groupKey}`);
      let totalPockets = 0;
      let ownedPockets = 0;
      for (const row of rows) {
        for (const pocket of pocketsOf(row)) {
          totalPockets += 1;
          if (pocket.qty > 0) ownedPockets += 1;
        }
      }
      const completion = completionOf(rows);
      const missing = [...completion.missing].sort(
        (a, b) => (b.price ?? -1) - (a.price ?? -1),
      );
      return {
        groupKey: args.groupKey,
        groupName: first.groupName,
        groupLabel: first.groupLabel,
        totalPockets,
        ownedPockets,
        missingCount: completion.missingCount,
        costToComplete: completion.costToComplete,
        unpricedMissing: completion.unpricedMissing,
        priceNote: `Prices are the latest tracked market values (daily re-pricing); anything not yet tracked uses the Lorcast snapshot of ${PRICE_SNAPSHOT_DATE}.`,
        missing,
      };
    },
  }),

  requestBuyList: defineAction({
    description:
      "Starts the TCGplayer buy handoff for one section's missing cards: spawns Jarvis's agent task with the full missing list to build the cart on TCGplayer under Anthony's rules (Near Mint, no single-card package over $3 shipping, no checkout — final payment approval stays Anthony's).",
    request: z.object({ groupKey: z.string().min(1) }),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
      missingCount: z.number(),
      costToComplete: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.groupKey, args.groupKey))
        .orderBy(asc(schema.cards.slotSort));
      const first = rows[0];
      if (!first) throw new Error(`Unknown section: ${args.groupKey}`);
      const completion = completionOf(rows);
      if (completion.missingCount === 0) {
        return {
          started: false,
          taskId: null,
          missingCount: 0,
          costToComplete: 0,
        };
      }
      const today = new Date().toISOString().slice(0, 10);
      const lines = completion.missing.map(
        (m) =>
          `- 1 x ${m.finishLabel} — ${m.fullName} #${m.printed} (${first.groupName}) — TCGplayer ID ${m.tcgplayerId ?? "unknown"} — market ${m.price != null ? `$${m.price.toFixed(2)}` : "not tracked"}`,
      );
      const result = await ctx.agent.spawnTask(
        [
          `Anthony tapped "Buy missing cards" in Vault X (his collections app) for the set "${first.groupName}". Build his TCGplayer cart for the ${completion.missingCount} missing printings below (estimated market total $${completion.costToComplete.toFixed(2)}). This is the complete-set list — every printing and finish he is missing, Enchanteds and Iconics included, exactly as listed.`,
          "Rules (Anthony's standing TCGplayer rules): Near Mint copies only. Optimize sellers to keep packages few. NEVER keep a single-card package whose shipping is over $3 — swap that card to a Near Mint option with shipping of $3 or less, or leave the card out and report it. A multi-card package whose shipping runs a little over $3 is fine. Add everything you can to the cart on TCGplayer, but DO NOT check out and DO NOT pay — final payment approval always stays Anthony's. When the cart is built, report back in the main chat: the package count, the item total, the shipping total, the grand total before tax, and any cards left out (with why).",
          "Missing cards:",
          ...lines,
        ].join("\n"),
        {
          dedupeKey: `lorcana-buy-${args.groupKey}-${today}`,
        },
      );
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
        missingCount: completion.missingCount,
        costToComplete: completion.costToComplete,
      };
    },
  }),

  identifyCard: defineAction({
    description:
      "Identifies Lorcana cards in a photo (a single card, a stack scanned one after another, or a whole binder page) using vision, and matches them against the binder catalog with ownership and finish information.",
    request: z.object({
      imageBase64: z.string().min(100).max(9_000_000),
    }),
    response: z.object({
      binderPage: z.boolean(),
      matches: z.array(
        z.object({
          cardId: z.number(),
          fullName: z.string(),
          groupName: z.string(),
          groupKey: z.string(),
          printed: z.string(),
          rarity: z.string().nullable(),
          ownedQty: z.number(),
          finishes: z.record(z.string(), z.number()),
          marketValue: z.number().nullable(),
          suggestedFinish: z.string(),
        }),
      ),
      unmatched: z.array(z.string()),
    }),
    async handler(ctx, args) {
      const readSchema = z.object({
        cards: z.array(
          z.object({
            name: z.string(),
            setName: z.string().nullable(),
            collectorNumber: z.number().int().nullable(),
            foil: z.boolean().nullable(),
          }),
        ),
        binderPage: z.boolean(),
      });
      const read = await ctx.inference.complete(
        "Identify every Disney Lorcana trading card visible in this photo. For each card, read: the full card title printed at the top (e.g. \"Ariel - Whoseit Collector\"), the set name printed on the card, the collector number (the number before the slash at the bottom, e.g. 137 in \"137/204\"), and whether that copy is a foil (rainbow/holographic sheen) or not — null if you cannot tell. If the photo shows a binder page with several cards in a grid, set binderPage to true and list every card you can read; otherwise set binderPage to false. Only list cards you can actually read; do not guess at cards that are cut off or unreadable. Read the full title exactly as printed, and the collector number exactly as printed — if the number is not clearly readable, report it as null rather than guessing, and never substitute a similar-looking card for the one in the photo.",
        {
          schema: readSchema,
          images: [
            {
              dataBase64: args.imageBase64,
              mimeType: "image/jpeg",
              caption: "Photo of one or more Disney Lorcana cards to identify",
            },
          ],
        },
      );
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);
      const matches: {
        cardId: number;
        fullName: string;
        groupName: string;
        groupKey: string;
        printed: string;
        rarity: string | null;
        ownedQty: number;
        finishes: Record<string, number>;
        marketValue: number | null;
        suggestedFinish: string;
      }[] = [];
      const unmatched: string[] = [];
      for (const found of read.cards) {
        const needle = found.name.trim().toLowerCase();
        if (!needle) continue;
        // A collector number that was actually read is a hard
        // filter (tightened Nov 2, 2026, after a live test
        // matched the wrong card): only printings carrying that
        // exact number can match — a name-alike with a different
        // number is a different printing, and when no printing
        // carries the number the read goes to unmatched, where
        // the result screen's search takes over.
        const pool =
          found.collectorNumber != null
            ? rows.filter((r) => r.number === found.collectorNumber)
            : rows;
        if (found.collectorNumber != null && pool.length === 0) {
          unmatched.push(found.name);
          continue;
        }
        const scored: { row: (typeof rows)[number]; score: number }[] = [];
        for (const row of pool) {
          let score = 0;
          const full = row.fullName.toLowerCase();
          const base = (row.name ?? "").toLowerCase();
          if (full === needle) score = 100;
          else if (base && base === needle) score = 80;
          else if (full.includes(needle) || needle.includes(full)) score = 60;
          else if (base && (needle.includes(base) || base.includes(needle)))
            score = 45;
          if (score === 0) continue;
          if (
            found.collectorNumber != null &&
            row.number === found.collectorNumber
          ) {
            score += 40;
          } else if (found.collectorNumber != null) {
            score -= 25;
          }
          if (
            found.setName &&
            row.groupName.toLowerCase() === found.setName.toLowerCase()
          ) {
            score += 15;
          }
          scored.push({ row, score });
        }
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (!best || best.score < 45) {
          unmatched.push(found.name);
          continue;
        }
        const row = best.row;
        const pockets = pocketsOf(row);
        let suggestedFinish: string;
        if (pockets.length === 1) {
          suggestedFinish = pockets[0]?.label ?? "Regular";
        } else if (found.foil === true) {
          suggestedFinish =
            pockets.find((p) => p.kind === "foil")?.label ?? "Cold Foil";
        } else {
          suggestedFinish =
            pockets.find((p) => p.kind === "regular")?.label ?? "Regular";
        }
        matches.push({
          cardId: row.id,
          fullName: row.fullName,
          groupName: row.groupName,
          groupKey: row.groupKey,
          printed: row.printed,
          rarity: row.rarity,
          ownedQty: row.ownedQty,
          finishes: parseFinishes(row.finishes),
          marketValue: row.marketValue,
          suggestedFinish,
        });
      }
      return { binderPage: read.binderPage, matches, unmatched };
    },
  }),

  getPriceAlerts: defineAction({
    description:
      "Lists Anthony's price alerts with each target's current unit value and whether the alert's threshold is met right now (triggered alerts are what Home shows in translucent red). Also reports whether the user has dismissed the example price-alert banner, so Home only teaches it once.",
    request: z.object({}),
    response: z.object({
      alerts: z.array(
        z.object({
          id: z.number(),
          targetKind: z.string(),
          cardId: z.number().nullable(),
          sealedName: z.string().nullable(),
          label: z.string(),
          direction: z.string(),
          threshold: z.number(),
          currentValue: z.number().nullable(),
          triggered: z.boolean(),
        }),
      ),
      /** True once the example price-alert banner's explanation
          has been read and dismissed by this user. */
      exampleDismissed: z.boolean(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const alertRows = await db
        .select()
        .from(schema.priceAlerts)
        .orderBy(asc(schema.priceAlerts.id));
      const cardRows = await db.select().from(schema.cards);
      const cardById = new Map(cardRows.map((r) => [r.id, r]));
      const sealed = await effectiveSealed(ctx);
      const sealedByName = new Map(sealed.items.map((i) => [i.name, i]));
      return {
        exampleDismissed: profile.exampleAlertDismissed > 0,
        alerts: alertRows.map((a) => {
          let currentValue: number | null = null;
          if (a.targetKind === "card" && a.cardId != null) {
            currentValue = cardById.get(a.cardId)?.marketValue ?? null;
          } else if (a.targetKind === "sealed" && a.sealedName) {
            const item = sealedByName.get(a.sealedName);
            if (item) {
              const base = allSealedItems.find((i) => i.name === a.sealedName);
              currentValue = base
                ? Math.round((base.value / Math.max(base.qty, 1)) * 100) / 100
                : null;
            }
          }
          const triggered =
            currentValue != null &&
            (a.direction === "below"
              ? currentValue <= a.threshold
              : currentValue >= a.threshold);
          return {
            id: a.id,
            targetKind: a.targetKind,
            cardId: a.cardId,
            sealedName: a.sealedName,
            label: a.label,
            direction: a.direction,
            threshold: a.threshold,
            currentValue,
            triggered,
          };
        }),
      };
    },
  }),

  dismissExampleAlert: defineAction({
    description:
      "Records that the user read the example price-alert explanation on Home and dismissed it, so the example banner never shows for them again (real alerts they create later are unaffected).",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      await db
        .update(schema.collectorProfile)
        .set({
          exampleAlertDismissed: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setPriceAlert: defineAction({
    description:
      "Sets a price alert on one card or sealed item from its detail view: Home shows the alert in translucent red when the item's unit value crosses the threshold.",
    request: z.object({
      targetKind: z.enum(["card", "sealed"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      direction: z.enum(["below", "above"]),
      threshold: z.number().positive().max(100000),
    }),
    response: z.object({ ok: z.literal(true), id: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; id: number }> {
      const db = ctx.db<typeof schema>();
      let label: string;
      if (args.targetKind === "card") {
        if (args.cardId == null) throw new Error("cardId is required");
        const rows = await db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, args.cardId))
          .limit(1);
        const row = rows[0];
        if (!row) throw new Error("Card not found");
        label = `${row.fullName} (${row.groupName} #${row.printed})`;
      } else {
        if (!args.sealedName) throw new Error("sealedName is required");
        const base = allSealedItems.find((i) => i.name === args.sealedName);
        if (!base) throw new Error(`Unknown sealed item: ${args.sealedName}`);
        label = base.name;
      }
      const inserted = await db
        .insert(schema.priceAlerts)
        .values({
          targetKind: args.targetKind,
          cardId: args.targetKind === "card" ? args.cardId : null,
          sealedName: args.targetKind === "sealed" ? args.sealedName : null,
          label,
          direction: args.direction,
          threshold: args.threshold,
          createdAt: new Date().toISOString(),
        })
        .returning({ id: schema.priceAlerts.id });
      ctx.invalidateQueries();
      return { ok: true, id: inserted[0]?.id ?? 0 };
    },
  }),

  deletePriceAlert: defineAction({
    description: "Deletes one price alert by id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.priceAlerts)
        .where(eq(schema.priceAlerts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listItemLocations: defineAction({
    description:
      "Lists the storage locations the user has entered for one item (its 'Where it lives' rows on the detail view): each spot's type, place, page/pocket or row detail, and how many copies sit there. Empty until the user adds one — locations are never invented.",
    request: z.object({
      targetKind: z.enum(["card", "sealed", "comic"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      comicId: z.string().min(1).nullable(),
    }),
    response: z.object({
      locations: z.array(
        z.object({
          id: z.number(),
          locType: z.string(),
          place: z.string(),
          spot: z.string().nullable(),
          qty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.itemLocations)
        .where(
          args.targetKind === "card"
            ? and(
                eq(schema.itemLocations.targetKind, "card"),
                eq(schema.itemLocations.cardId, args.cardId ?? -1),
              )
            : args.targetKind === "sealed"
              ? and(
                  eq(schema.itemLocations.targetKind, "sealed"),
                  eq(
                    schema.itemLocations.sealedName,
                    args.sealedName ?? "",
                  ),
                )
              : and(
                  eq(schema.itemLocations.targetKind, "comic"),
                  eq(schema.itemLocations.comicId, args.comicId ?? ""),
                ),
        )
        .orderBy(asc(schema.itemLocations.id));
      return {
        locations: rows.map((r) => ({
          id: r.id,
          locType: r.locType,
          place: r.place,
          spot: r.spot,
          qty: r.qty,
        })),
      };
    },
  }),

  listKnownLocations: defineAction({
    description:
      "Lists the distinct storage places the user has already entered on ANY item (type, place, and spot), so a custom location they created once is offered again in every item's 'Where it lives' dropdown. Derived live from the user's own saved location rows — nothing is invented or pre-filled.",
    request: z.object({}),
    response: z.object({
      locations: z.array(
        z.object({
          locType: z.string(),
          place: z.string(),
          spot: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.itemLocations)
        .orderBy(asc(schema.itemLocations.id));
      const seen = new Set<string>();
      const locations: {
        locType: string;
        place: string;
        spot: string | null;
      }[] = [];
      for (const r of rows) {
        const key = `${r.locType}|${r.place}|${r.spot ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        locations.push({
          locType: r.locType,
          place: r.place,
          spot: r.spot,
        });
        if (locations.length >= 60) break;
      }
      return { locations };
    },
  }),

  addItemLocation: defineAction({
    description:
      "Adds one storage location ('Where it lives') to an item: a binder (name plus page/pocket), deck box, trade box, bulk box (name plus row/section), or a free-text spot, with how many copies live there.",
    request: z.object({
      targetKind: z.enum(["card", "sealed", "comic"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      comicId: z.string().min(1).nullable(),
      locType: z.enum([
        "binder",
        "deck_box",
        "trade_box",
        "bulk_box",
        "other",
      ]),
      place: z.string().trim().min(1).max(120),
      spot: z.string().trim().max(120).nullable(),
      qty: z.number().int().min(1).max(999),
    }),
    response: z.object({ ok: z.literal(true), id: z.number() }),
    async handler(ctx, args): Promise<{ ok: true; id: number }> {
      if (args.targetKind === "card" && args.cardId == null) {
        throw new Error("cardId is required for a card location");
      }
      if (args.targetKind === "sealed" && !args.sealedName) {
        throw new Error("sealedName is required for a sealed location");
      }
      if (args.targetKind === "comic" && !args.comicId) {
        throw new Error("comicId is required for a comic location");
      }
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.itemLocations)
        .values({
          targetKind: args.targetKind,
          cardId: args.targetKind === "card" ? args.cardId : null,
          sealedName:
            args.targetKind === "sealed" ? args.sealedName : null,
          comicId: args.targetKind === "comic" ? args.comicId : null,
          locType: args.locType,
          place: args.place,
          spot: args.spot && args.spot.length > 0 ? args.spot : null,
          qty: args.qty,
          createdAt: new Date().toISOString(),
        })
        .returning({ id: schema.itemLocations.id });
      ctx.invalidateQueries();
      return { ok: true, id: inserted[0]?.id ?? 0 };
    },
  }),

  setItemLocationQty: defineAction({
    description:
      "Sets how many copies of an item sit at one of its stored locations (the plus/minus on a 'Where it lives' row).",
    request: z.object({
      id: z.number().int().positive(),
      qty: z.number().int().min(1).max(999),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.itemLocations)
        .set({ qty: args.qty })
        .where(eq(schema.itemLocations.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteItemLocation: defineAction({
    description:
      "Removes one stored location from an item's 'Where it lives' list.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.itemLocations)
        .where(eq(schema.itemLocations.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getFinance: defineAction({
    description:
      "Computes the binder's financial metrics: export-scope totals (value, paid, net) from live per-finish prices plus sealed/token items, per-set export figures, live set chart data, value by rarity, price tiers, spare-copy value, the most valuable items owned, and the value-over-time history starting Oct 25 2026.",
    request: z.object({}),
    response: financeResponse,
    async handler(ctx): Promise<z.infer<typeof financeResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);
      // Sealed figures use Anthony's current quantities (Sealed shelf
      // overrides), shadowing the export constants for this handler.
      const effSealed = await effectiveSealed(ctx);
      const sealedItems = effSealed.items;
      const sealedTotals = effSealed.totals;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const round1 = (n: number) => Math.round(n * 10) / 10;

      const TIER_DEFS = [
        { label: "Under $1", min: 0, max: 1 },
        { label: "$1–$4.99", min: 1, max: 5 },
        { label: "$5–$9.99", min: 5, max: 10 },
        { label: "$10–$24.99", min: 10, max: 25 },
        { label: "$25–$49.99", min: 25, max: 50 },
        { label: "$50 and up", min: 50, max: Number.POSITIVE_INFINITY },
      ];
      const tiers = TIER_DEFS.map((t) => ({ ...t, copies: 0, value: 0 }));
      const FOIL_SET = new Set(FOIL_FINISHES);

      let binderValue = 0;
      let binderPaid = 0;
      let binderCards = 0;
      let distinctOwned = 0;
      let unpricedOwnedQty = 0;
      let spareCopies = 0;
      let spareValue = 0;
      let beyondPlaysetCopies = 0;
      let beyondPlaysetValue = 0;
      let foilValue = 0;

      const rarityMap = new Map<
        string,
        z.infer<typeof financeResponse>["byRarity"][number] & { raw: number }
      >();
      const setLive = new Map<string, { value: number; paid: number }>();
      const valued: z.infer<typeof financeResponse>["topItems"] = [];

      for (const row of rows) {
        if (row.ownedQty <= 0) continue;
        binderCards += row.ownedQty;
        distinctOwned += 1;
        const money = cardMoney(row);
        binderValue += money.value;
        binderPaid += money.paid;
        if (row.marketValue == null && !row.financeJson) {
          unpricedOwnedQty += row.ownedQty;
        }

        if (row.grp === "set") {
          const live = setLive.get(row.setCode) ?? { value: 0, paid: 0 };
          live.value += money.value;
          live.paid += money.paid;
          setLive.set(row.setCode, live);
        }

        const rarityKey = row.rarity ?? "Unknown";
        const rarity = rarityMap.get(rarityKey) ?? {
          rarity: rarityKey,
          value: 0,
          ownedQty: 0,
          distinct: 0,
          raw: 0,
        };
        rarity.raw += money.value;
        rarity.ownedQty += row.ownedQty;
        rarity.distinct += 1;
        rarityMap.set(rarityKey, rarity);

        const unitAvg =
          row.ownedQty > 0 ? money.value / row.ownedQty : 0;
        const tier = tiers.find((t) => unitAvg >= t.min && unitAvg < t.max);
        if (tier) {
          tier.copies += row.ownedQty;
          tier.value += money.value;
        }

        const finishes = parseFinishes(row.finishes);
        const prices = parseFinance(row.financeJson);
        for (const [finish, qty] of Object.entries(finishes)) {
          if (FOIL_SET.has(finish)) {
            const unit = prices[finish]?.value ?? row.marketValue ?? 0;
            foilValue += unit * qty;
          }
        }
        // Spare-copy value at the card's average unit price.
        if (row.ownedQty > 1) {
          spareCopies += row.ownedQty - 1;
          spareValue += unitAvg * (row.ownedQty - 1);
        }
        if (row.ownedQty > 4) {
          beyondPlaysetCopies += row.ownedQty - 4;
          beyondPlaysetValue += unitAvg * (row.ownedQty - 4);
        }

        if (money.value > 0) {
          valued.push({
            id: row.id,
            name: row.fullName,
            groupName: row.groupName,
            printed: row.printed,
            rarity: row.rarity,
            qty: row.ownedQty,
            unitValue: round2(unitAvg),
            totalValue: round2(money.value),
            paidTotal: round2(money.paid),
            sealed: false,
          });
        }
      }

      const byRarity = [...rarityMap.values()]
        .map(({ raw, ...r }) => ({ ...r, value: round2(raw) }))
        .sort((a, b) => b.value - a.value);

      // Sets chart: main sets live (their sealed items added at export
      // prices), plus one aggregate row for promos and quests.
      const sealedBySetName = new Map<string, { value: number; paid: number }>();
      for (const item of sealedItems) {
        const agg = sealedBySetName.get(item.setName) ?? { value: 0, paid: 0 };
        agg.value += item.value;
        agg.paid += item.paid;
        sealedBySetName.set(item.setName, agg);
      }
      const mainSetNames = new Map<string, string>();
      for (const entry of catalog) {
        if (entry.grp === "set" && !mainSetNames.has(entry.setCode)) {
          mainSetNames.set(entry.setCode, entry.setName);
        }
      }
      const sealedByCode = new Map<string, { value: number; paid: number }>();
      for (const [name, agg] of sealedBySetName) {
        for (const [code, setName] of mainSetNames) {
          if (setName.toLowerCase() === name.toLowerCase()) {
            sealedByCode.set(code, agg);
          }
        }
      }
      const setsChart: z.infer<typeof financeResponse>["setsChart"] = [];
      const sortedCodes = [...mainSetNames.keys()].sort(
        (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
      );
      for (const code of sortedCodes) {
        const live = setLive.get(code) ?? { value: 0, paid: 0 };
        const sealed = sealedByCode.get(code) ?? { value: 0, paid: 0 };
        setsChart.push({
          name: mainSetNames.get(code) ?? `Set ${code}`,
          value: round2(live.value + sealed.value),
          paid: round2(live.paid + sealed.paid),
        });
      }
      setsChart.sort((a, b) => b.value - a.value);
      let otherValue = 0;
      let otherPaid = 0;
      for (const row of rows) {
        if (row.grp === "set" || row.ownedQty <= 0) continue;
        const money = cardMoney(row);
        otherValue += money.value;
        otherPaid += money.paid;
      }
      setsChart.push({
        name: "Promos & quests",
        value: round2(otherValue),
        paid: round2(otherPaid),
      });
      setsChart.sort((a, b) => b.value - a.value);

      // Most valuable items: binder cards merged with sealed products.
      for (const item of sealedItems) {
        valued.push({
          id: null,
          name: item.name,
          groupName: item.setName,
          printed: null,
          rarity: "Sealed",
          qty: item.qty,
          unitValue: round2(item.qty > 0 ? item.value / item.qty : item.value),
          totalValue: round2(item.value),
          paidTotal: round2(item.paid),
          sealed: true,
        });
      }
      valued.sort(
        (a, b) => b.totalValue - a.totalValue || b.unitValue - a.unitValue,
      );
      const topItems = valued.slice(0, 12);
      const top10Value = valued
        .slice(0, 10)
        .reduce((sum, c) => sum + c.totalValue, 0);

      const value = binderValue + sealedTotals.value + nonBinderTotals.value;
      const paid = binderPaid + sealedTotals.paid + nonBinderTotals.paid;
      const cards = binderCards + sealedTotals.qty + nonBinderTotals.qty;

      const snaps = (await db
        .select()
        .from(schema.financeSnapshots)
        .orderBy(asc(schema.financeSnapshots.id))).filter((s) => s.source !== "sync");
      const history =
        snaps.length > 0
          ? snaps.map((s) => ({
              date: s.date,
              label: s.label,
              value: s.value,
              paid: s.paid,
              cards: s.cards,
              source: s.source,
            }))
          : HISTORY_ROWS.map((h) => ({ ...h }));

      return {
        asOfLabel:
          history.length > 0
            ? (history[history.length - 1]?.label ?? "Nov 1 (latest)")
            : "Nov 1 (latest)",
        cards,
        value: round2(value),
        paid: round2(paid),
        net: round2(value - paid),
        avgPerCard: cards > 0 ? round2(value / cards) : 0,
        binderCards,
        binderValue: round2(binderValue),
        binderPaid: round2(binderPaid),
        foilValue: round2(foilValue),
        foilSharePct:
          binderValue > 0 ? round1((foilValue / binderValue) * 100) : 0,
        distinctOwned,
        avgPerDistinct:
          distinctOwned > 0 ? round2(binderValue / distinctOwned) : 0,
        unpricedOwnedQty,
        spareCopies,
        spareValue: round2(spareValue),
        beyondPlaysetCopies,
        beyondPlaysetValue: round2(beyondPlaysetValue),
        top10SharePct: value > 0 ? round1((top10Value / value) * 100) : 0,
        bySet: exportBySet.map((s) => ({
          name: s.name,
          cards: s.cards,
          value: s.value,
          paid: s.paid,
          net: round2(s.value - s.paid),
          main: s.main,
        })),
        setsChart,
        byRarity,
        tiers: tiers.map((t) => ({
          label: t.label,
          copies: t.copies,
          value: round2(t.value),
        })),
        topItems,
        history,
      };
    },
  }),

  getRepricingTargets: defineAction({
    description:
      "Lists every binder card (owned and not yet owned) with its catalog uid and TCGplayer id so the daily re-pricing task knows what to price; pricing the whole catalog keeps the Cost to Complete figures current too.",
    request: z.object({}),
    response: z.object({
      targets: z.array(
        z.object({
          uid: z.string(),
          fullName: z.string(),
          groupName: z.string(),
          printed: z.string(),
          tcgplayerId: z.string().nullable(),
          owned: z.boolean(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .orderBy(asc(schema.cards.id));
      return {
        targets: rows.map((r) => ({
          uid: r.uid,
          fullName: r.fullName,
          groupName: r.groupName,
          printed: r.printed,
          tcgplayerId: tcgIdOf(r),
          owned: r.ownedQty > 0,
        })),
      };
    },
  }),

  saveRepricing: defineAction({
    description:
      "Saves current market prices fetched by the re-pricing task: updates per-finish values for the given cards (paid amounts untouched) and, when at least half the owned printings were priced, appends today's point to the value history.",
    request: z.object({
      prices: z
        .array(
          z.object({
            uid: z.string(),
            usd: z.number().min(0),
            usdFoil: z.number().min(0).nullable(),
          }),
        )
        .max(6000),
    }),
    response: z.object({
      updated: z.number(),
      coveragePct: z.number(),
      snapshotAdded: z.boolean(),
    }),
    async handler(ctx, args): Promise<{
      updated: number;
      coveragePct: number;
      snapshotAdded: boolean;
    }> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);
      // Snapshot totals use Anthony's current sealed quantities too.
      const sealedTotals = (await effectiveSealed(ctx)).totals;
      const byUid = new Map(rows.map((r) => [r.uid, r]));
      let updated = 0;
      for (const price of args.prices) {
        const row = byUid.get(price.uid);
        if (!row) continue;
        if (row.ownedQty <= 0) {
          // Not owned yet: still store the market prices (paid stays
          // 0) so the Cost to Complete / missing-cards figures update
          // with the daily re-pricing. No history points for cards he
          // doesn't own.
          await db
            .update(schema.cards)
            .set({
              financeJson: JSON.stringify({
                Regular: { value: price.usd, paid: 0 },
                "Cold Foil": { value: price.usdFoil ?? price.usd, paid: 0 },
              }),
              marketValue: price.usd,
            })
            .where(eq(schema.cards.id, row.id));
          continue;
        }
        const finishes = parseFinishes(row.finishes);
        const prices = parseFinance(row.financeJson);
        const next: Record<string, FinishPrice> = { ...prices };
        for (const finish of Object.keys(finishes)) {
          const paid = prices[finish]?.paid ?? row.paidValue ?? 0;
          if (isFoilFinish(finish)) {
            next[finish] = { value: price.usdFoil ?? price.usd, paid };
          } else {
            next[finish] = { value: price.usd, paid };
          }
        }
        // Recompute the weighted average unit value from finish counts.
        let total = 0;
        let qtyTotal = 0;
        for (const [finish, qty] of Object.entries(finishes)) {
          const p = next[finish];
          if (p) {
            total += p.value * qty;
            qtyTotal += qty;
          }
        }
        const newUnit = qtyTotal > 0 ? total / qtyTotal : price.usd;
        await db
          .update(schema.cards)
          .set({
            financeJson: JSON.stringify(next),
            marketValue: newUnit,
          })
          .where(eq(schema.cards.id, row.id));
        // Append (or refresh) today's point on this card's price history.
        const now = new Date();
        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        const dayLabel = `${months[now.getUTCMonth()] ?? "Jan"} ${now.getUTCDate()}`;
        const existingPoint = await db
          .select()
          .from(schema.cardPriceHistory)
          .where(eq(schema.cardPriceHistory.uid, row.uid));
        const todaysPoint = existingPoint.find(
          (h) => h.source === "daily" && h.label === dayLabel,
        );
        if (todaysPoint) {
          await db
            .update(schema.cardPriceHistory)
            .set({ unitValue: newUnit, date: now.toISOString().slice(0, 10) })
            .where(eq(schema.cardPriceHistory.id, todaysPoint.id));
        } else {
          await db.insert(schema.cardPriceHistory).values({
            uid: row.uid,
            date: now.toISOString().slice(0, 10),
            label: dayLabel,
            unitValue: newUnit,
            source: "daily",
          });
        }
        updated += 1;
      }

      const ownedDistinct = rows.filter((r) => r.ownedQty > 0).length;
      const coveragePct =
        ownedDistinct > 0 ? Math.round((updated / ownedDistinct) * 100) : 0;
      let snapshotAdded = false;
      if (updated > 0 && coveragePct >= 50) {
        const fresh = await db.select().from(schema.cards);
        let bValue = 0;
        let bPaid = 0;
        let bCards = 0;
        for (const row of fresh) {
          if (row.ownedQty <= 0) continue;
          const money = cardMoney(row);
          bValue += money.value;
          bPaid += money.paid;
          bCards += row.ownedQty;
        }
        const now = new Date();
        const iso = now.toISOString().slice(0, 10);
        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        const label = `${months[now.getUTCMonth()] ?? "Jan"} ${now.getUTCDate()}`;
        const value = Math.round(
          (bValue + sealedTotals.value + nonBinderTotals.value) * 100,
        ) / 100;
        const paid = Math.round(
          (bPaid + sealedTotals.paid + nonBinderTotals.paid) * 100,
        ) / 100;
        const cards = bCards + sealedTotals.qty + nonBinderTotals.qty;
        const existing = await db
          .select()
          .from(schema.financeSnapshots)
          .where(eq(schema.financeSnapshots.label, label));
        const todays = existing.find((s) => s.source === "daily");
        if (todays) {
          await db
            .update(schema.financeSnapshots)
            .set({ date: iso, value, paid, cards })
            .where(eq(schema.financeSnapshots.id, todays.id));
        } else if (existing.length === 0) {
          await db.insert(schema.financeSnapshots).values({
            date: iso,
            label,
            value,
            paid,
            cards,
            source: "daily",
          });
        }
        snapshotAdded = true;
      }
      ctx.invalidateQueries();
      return { updated, coveragePct, snapshotAdded };
    },
  }),

  refreshFinance: defineAction({
    description:
      "Starts the daily re-pricing of the collection: spawns an agent task that fetches current market prices for the owned cards and saves them via saveRepricing (paid amounts stay as recorded).",
    request: z.object({}),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
    }),
    async handler(ctx): Promise<{ started: boolean; taskId: string | null }> {
      const today = new Date().toISOString().slice(0, 10);
      const result = await ctx.agent.spawnTask(
        [
          "Re-price Anthony's Lorcana collection in the lorcana-binder web artifact.",
          "1. Call the artifact's getRepricingTargets action to list every printing in the catalog (uid, name, set, printed number, TCGplayer id, owned flag). Price the not-yet-owned ones too — their prices keep the app's Cost to Complete figures current.",
          "2. For each target, find its CURRENT market price in USD. The Lorcast API is the practical source: https://api.lorcast.com/v0/cards/search?q=<url-encoded card name> returns printings with a prices object (usd for non-foil, usd_foil for foil); match the printing by set and collector number. Batch by searching per set where that is faster. Use the near-mint market price.",
          "3. Call the saveRepricing action ONCE with the full prices array: one entry per uid — { uid, usd: <non-foil price>, usdFoil: <foil price or null> }. Include every target you could price; do not invent prices for cards you could not find — leave those out.",
          "Paid amounts are stored separately and must not be sent or changed. Do not edit any files, memory, or other artifacts.",
        ].join("\n"),
        {
          expectsAction: "saveRepricing",
          dedupeKey: `lorcana-finance-refresh-${today}`,
        },
      );
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
      };
    },
  }),

  cardImage: defineAction({
    description:
      "Returns the card's official artwork image URL, fetching the Ravensburger scan into owned blob storage on first view and serving the stored copy after that.",
    request: z.object({ cardId: z.number().int().positive() }),
    response: imageResponse,
    async handler(ctx, args): Promise<z.infer<typeof imageResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const row = rows[0];
      if (!row) return { url: null };
      if (row.imageBlobKey) {
        return { url: await ctx.blobs.getUrl(row.imageBlobKey) };
      }
      if (!row.imageUrl) return { url: null };
      try {
        const res = await fetch(row.imageUrl);
        if (!res.ok) return { url: null };
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length === 0) return { url: null };
        const key = `card-art/${row.uid.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
        await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
        await db
          .update(schema.cards)
          .set({ imageBlobKey: key })
          .where(eq(schema.cards.id, row.id));
        return { url: await ctx.blobs.getUrl(key) };
      } catch {
        return { url: null };
      }
    },
  }),

  updateOwnership: defineAction({
    description:
      "Updates how many copies of a card Anthony owns, broken down by finish (e.g. Regular, Cold Foil); the total is derived from the finishes.",
    request: z.object({
      cardId: z.number().int().positive(),
      finishes: z.record(z.string(), z.number().int().min(0).max(999)),
    }),
    response: updateResponse,
    async handler(ctx, args): Promise<z.infer<typeof updateResponse>> {
      const db = ctx.db<typeof schema>();
      const clean: Record<string, number> = {};
      let total = 0;
      for (const [finish, qty] of Object.entries(args.finishes)) {
        if (qty > 0) {
          clean[finish] = qty;
          total += qty;
        }
      }
      await db
        .update(schema.cards)
        .set({ ownedQty: total, finishes: JSON.stringify(clean) })
        .where(eq(schema.cards.id, args.cardId));
      ctx.invalidateQueries();
      // Cloud backup stays current on every quantity change
      // (best-effort push of just this card's rows).
      const updated = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId));
      if (updated[0]) await syncCardToCloud(ctx, updated[0]);
      return { ownedQty: total };
    },
  }),

  getCollectorId: defineAction({
    description:
      "Returns Anthony's collector identity for the oval Collector ID card at the top of Home: his chosen username, his stable unique collector code, and the URL of the photo he chose for the card. Creates the profile (with his ARUIKIS handle as the starting username) on first read.",
    request: z.object({}),
    response: collectorIdResponse,
    async handler(ctx): Promise<z.infer<typeof collectorIdResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      return {
        username: profile.username,
        collectorCode: profile.collectorCode,
        photoUrl: profile.photoBlobKey
          ? await ctx.blobs.getUrl(profile.photoBlobKey)
          : null,
        bannerUrl: profile.bannerBlobKey
          ? await ctx.blobs.getUrl(profile.bannerBlobKey)
          : null,
        theme: profile.theme ?? null,
        updateTestSeen: profile.updateTestSeen > 0,
        shareCollection: (profile.shareCollection ?? 1) > 0,
      };
    },
  }),

  dismissUpdateTest: defineAction({
    description:
      "Marks the one-time TEST of the Home 'Update available' indicator as completed — called when he finishes the test walkthrough in Settings, which is the only way the flag is consumed (backing out mid-way leaves the test armed). Real update indicators are driven by the app's automatic check on open and are not affected by this flag.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({ updateTestSeen: 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true as const };
    },
  }),

  resetUpdateTest: defineAction({
    description:
      "Re-arms the one-time TEST of the Home 'Update available' indicator (sets its seen flag back to 0). Used once by the v1.24.0 publish: the first test burned on the early tap-to-dismiss behavior before the walkthrough version shipped, so his one-time test is restored — from v1.24.0 on, the flag is consumed only when he completes the walkthrough in Settings.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({ updateTestSeen: 0, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true as const };
    },
  }),

  setShareCollection: defineAction({
    description:
      "Sets whether connected friends can see the collector's collection (Settings > Sharing). Sharing is ON by default; turning it off hides the collection from friends until it is turned back on.",
    request: z.object({ share: z.boolean() }),
    response: z.object({ ok: z.literal(true), shareCollection: z.boolean() }),
    handler: async (ctx, args): Promise<{ ok: true; shareCollection: boolean }> => {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          shareCollection: args.share ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1))
        .run();
      return { ok: true as const, shareCollection: args.share };
    },
  }),

  setCollectorUsername: defineAction({
    description:
      "Sets the username shown on Anthony's Collector ID card (and encoded in its QR code). Letters, numbers, and underscores, 3-20 characters.",
    request: z.object({
      username: z
        .string()
        .trim()
        .regex(
          /^[A-Za-z0-9_]{3,20}$/,
          "Use 3-20 letters, numbers, or underscores",
        ),
    }),
    response: z.object({ ok: z.literal(true), username: z.string() }),
    async handler(ctx, args): Promise<{ ok: true; username: string }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          username: args.username,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, username: args.username };
    },
  }),

  setThemePreference: defineAction({
    description:
      "Saves the app theme the user picked in Settings (Vault Dark, Light, Midnight Purple, Crimson Ember, or High Contrast) on their collector profile, so the choice persists for them across devices. Presentation only — no collection data changes.",
    request: z.object({
      theme: z.enum(["vault", "light", "midnight", "crimson", "contrast"]),
    }),
    response: z.object({ ok: z.literal(true), theme: z.string() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; theme: string }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          theme: args.theme,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, theme: args.theme };
    },
  }),

  setCollectorPhoto: defineAction({
    description:
      "Stores the photo Anthony chose for his Collector ID card (JPEG bytes as base64 from the client file picker) in blob storage and points the profile at it.",
    request: z.object({
      imageBase64: z.string().min(100).max(9_000_000),
    }),
    response: z.object({ ok: z.literal(true), photoUrl: z.string() }),
    async handler(ctx, args): Promise<{ ok: true; photoUrl: string }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const key = "collector-photo/profile.jpg";
      const bytes = Uint8Array.from(
        atob(args.imageBase64),
        (c) => c.charCodeAt(0),
      );
      await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
      await db
        .update(schema.collectorProfile)
        .set({
          photoBlobKey: key,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, photoUrl: await ctx.blobs.getUrl(key) };
    },
  }),

  removeCollectorPhoto: defineAction({
    description:
      "Removes the chosen photo from Anthony's Collector ID card, back to the plain initial-letter avatar.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          photoBlobKey: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setProfileBanner: defineAction({
    description:
      "Stores the optional banner image the user chose for their profile (JPEG bytes as base64 from the client file picker) in blob storage and points the profile at it. Banners are opt-in; the profile has none until this is called.",
    request: z.object({
      imageBase64: z.string().min(100).max(9_000_000),
    }),
    response: z.object({ ok: z.literal(true), bannerUrl: z.string() }),
    async handler(ctx, args): Promise<{ ok: true; bannerUrl: string }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const key = "collector-photo/banner.jpg";
      const bytes = Uint8Array.from(
        atob(args.imageBase64),
        (c) => c.charCodeAt(0),
      );
      await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
      await db
        .update(schema.collectorProfile)
        .set({
          bannerBlobKey: key,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, bannerUrl: await ctx.blobs.getUrl(key) };
    },
  }),

  removeProfileBanner: defineAction({
    description:
      "Removes the profile banner image, returning the profile to the plain banner-free header.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          bannerBlobKey: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  syncCollectorRegistry: defineAction({
    description:
      "Registers Anthony's Collector ID (username + collector code) in the central Vault X registry on Supabase — and re-registers/verifies the Jarvis test friend (MC-JARVIS) alongside it — then reads both rows back from the server to prove they live there. Records the verification time on the local profile. Returns the live registry member list.",
    request: z.object({}),
    response: registrySyncResponse,
    async handler(
      ctx,
    ): Promise<z.infer<typeof registrySyncResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const mine = await upsertRegistryProfile({
        collector_id: profile.collectorCode,
        username: profile.username,
        trust_score: 0,
      });
      const jarvis = await upsertRegistryProfile({
        ...JARVIS_REGISTRY_PROFILE,
      });
      let members: z.infer<typeof registryMember>[] = [];
      let syncedAt: string | null = null;
      if (mine) {
        syncedAt = new Date().toISOString();
        const db = ctx.db<typeof schema>();
        await db
          .update(schema.collectorProfile)
          .set({ registrySyncedAt: syncedAt })
          .where(eq(schema.collectorProfile.id, 1));
        ctx.invalidateQueries();
        const list = await supabaseRest(
          "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
        );
        if (list.ok) {
          members = asRegistryRows(list.json).map((r) => ({
            collectorId: r.collector_id,
            username: r.username,
            trustScore: r.trust_score,
            createdAt: r.created_at,
          }));
        }
      }
      return {
        registered: mine != null,
        username: profile.username,
        collectorCode: profile.collectorCode,
        jarvisRegistered: jarvis != null,
        syncedAt,
        members,
      };
    },
  }),

  getRegistryMembers: defineAction({
    description:
      "Reads the live member list from the central Vault X registry on Supabase (profiles table) and flags which rows are Anthony's own Collector ID and the Jarvis test friend, so the app can show who actually lives on the server. Reports reachable=false honestly when the registry cannot be read.",
    request: z.object({}),
    response: z.object({
      reachable: z.boolean(),
      members: z.array(registryMember),
      myCollectorCode: z.string(),
      iAmRegistered: z.boolean(),
      jarvisRegistered: z.boolean(),
      registrySyncedAt: z.string().nullable(),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const list = await supabaseRest(
        "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
      );
      const rows = list.ok ? asRegistryRows(list.json) : [];
      return {
        reachable: list.ok,
        members: rows.map((r) => ({
          collectorId: r.collector_id,
          username: r.username,
          trustScore: r.trust_score,
          createdAt: r.created_at,
        })),
        myCollectorCode: profile.collectorCode,
        iAmRegistered: rows.some(
          (r) => r.collector_id === profile.collectorCode,
        ),
        jarvisRegistered: rows.some(
          (r) => r.collector_id === JARVIS_REGISTRY_PROFILE.collector_id,
        ),
        registrySyncedAt: profile.registrySyncedAt ?? null,
      };
    },
  }),

  lookupCollector: defineAction({
    description:
      "Looks a collector up in the central Vault X registry on Supabase by collector code or username (case-insensitive) — the live server lookup behind Add a Friend by code. Flags when the match is Anthony himself.",
    request: z.object({ code: z.string().trim().min(1).max(60) }),
    response: registryLookupResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof registryLookupResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const needle = args.code.trim();
      const read = await supabaseRest(
        "profiles?select=collector_id,username,trust_score,created_at",
      );
      if (!read.ok) {
        return {
          reachable: false,
          found: false,
          isSelf: false,
          member: null,
        };
      }
      const rows = asRegistryRows(read.json);
      const lower = needle.toLowerCase();
      const hit =
        rows.find((r) => r.collector_id.toLowerCase() === lower) ??
        rows.find((r) => r.username.toLowerCase() === lower) ??
        rows.find(
          (r) => r.username.toLowerCase() === lower.replace(/^@/, ""),
        ) ??
        null;
      return {
        reachable: true,
        found: hit != null,
        isSelf: hit != null && hit.collector_id === profile.collectorCode,
        member: hit
          ? {
              collectorId: hit.collector_id,
              username: hit.username,
              trustScore: hit.trust_score,
              createdAt: hit.created_at,
            }
          : null,
      };
    },
  }),

  getProfileItems: defineAction({
    description:
      "Returns Anthony's owned items for his collector profile page — every owned card printing by finish plus his sealed items — filtered by search text (name, or name + collector number), collection group, and item filter, sorted as asked, with the total count and the group list for the profile's Viewing selector.",
    request: profileItemsRequest,
    response: profileItemsResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof profileItemsResponse>> {
      const all = await buildProfileItems(ctx);
      const searched = filterProfileItems(all, args.query, args.filter);
      const groups = [...new Set(searched.map((i) => i.groupName))].sort();
      const grouped =
        args.group === "all"
          ? searched
          : searched.filter((i) => i.groupName === args.group);
      const sorted = sortProfileItems(grouped, args.sort);
      return {
        total: sorted.length,
        groups,
        items: sorted.slice(0, PROFILE_ITEMS_CAP),
      };
    },
  }),

  exportCollection: defineAction({
    description:
      "Returns every owned card (by printing and finish, with quantity, unit market value, and unit paid) and every sealed product on the shelf (with quantity, unit value, and unit paid), uncapped — the data behind the Settings collection export (CSV / XLSX / JSON). Graded comics live in the client catalog, so the client appends those rows itself when it builds the file.",
    request: z.object({}),
    response: z.object({
      exportedAt: z.string(),
      rows: z.array(
        z.object({
          type: z.string(),
          name: z.string(),
          setOrPublisher: z.string(),
          number: z.string(),
          finishOrLabel: z.string(),
          rarity: z.string(),
          qty: z.number(),
          unitValue: z.number().nullable(),
          unitPaid: z.number().nullable(),
          cert: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const cardRows = await db.select().from(schema.cards);
      const rows: {
        type: string;
        name: string;
        setOrPublisher: string;
        number: string;
        finishOrLabel: string;
        rarity: string;
        qty: number;
        unitValue: number | null;
        unitPaid: number | null;
        cert: string;
      }[] = [];
      for (const row of cardRows) {
        if (row.ownedQty <= 0) continue;
        const finishes = parseFinishes(row.finishes);
        const prices = parseFinance(row.financeJson);
        const entries = Object.entries(finishes).filter(([, q]) => q > 0);
        if (entries.length === 0) {
          rows.push({
            type: "Card",
            name: row.fullName,
            setOrPublisher: row.groupName,
            number: row.printed,
            finishOrLabel: "Regular",
            rarity: row.rarity ?? "",
            qty: row.ownedQty,
            unitValue: row.marketValue,
            unitPaid: row.paidValue,
            cert: "",
          });
        } else {
          for (const [finish, qty] of entries) {
            rows.push({
              type: "Card",
              name: row.fullName,
              setOrPublisher: row.groupName,
              number: row.printed,
              finishOrLabel: finish,
              rarity: row.rarity ?? "",
              qty,
              unitValue: prices[finish]?.value ?? row.marketValue,
              unitPaid: prices[finish]?.paid ?? row.paidValue,
              cert: "",
            });
          }
        }
      }
      const eff = await effectiveSealed(ctx);
      for (const item of eff.items) {
        if (item.qty <= 0) continue;
        rows.push({
          type: "Sealed",
          name: item.name,
          setOrPublisher: item.setName,
          number: "",
          finishOrLabel: "Sealed",
          rarity: "Sealed",
          qty: item.qty,
          unitValue: Math.round((item.value / item.qty) * 100) / 100,
          unitPaid: Math.round((item.paid / item.qty) * 100) / 100,
          cert: "",
        });
      }
      rows.sort(
        (a, b) =>
          a.type.localeCompare(b.type) ||
          a.setOrPublisher.localeCompare(b.setOrPublisher) ||
          a.name.localeCompare(b.name) ||
          a.finishOrLabel.localeCompare(b.finishOrLabel),
      );
      return { exportedAt: new Date().toISOString(), rows };
    },
  }),

  syncCollectionBackup: defineAction({
    description:
      "Full cloud backup sync: writes the signed-in collector's entire collection (cards in every finish, sealed products, graded comics, with quantities) to the Vault X Supabase project's collection_items table under their collector code, removes server rows that no longer exist locally, and verifies by reading the rows back. Also refreshes the collector's own row in the server profiles registry.",
    request: z.object({}),
    response: cloudSyncResponse,
    async handler(ctx): Promise<z.infer<typeof cloudSyncResponse>> {
      const result = await fullCloudSync(ctx);
      if (result == null) {
        return { ok: false, items: 0, copies: 0, syncedAt: null };
      }
      return {
        ok: true,
        items: result.items,
        copies: result.copies,
        syncedAt: new Date().toISOString(),
      };
    },
  }),

  getBackupStatus: defineAction({
    description:
      "Compares the local collection against the cloud backup on Supabase (row counts and copy counts for the signed-in collector) so Settings can show whether the backup is in sync.",
    request: z.object({}),
    response: backupStatusResponse,
    async handler(ctx): Promise<z.infer<typeof backupStatusResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const local = await buildLocalCloudItems(
        ctx,
        profile.collectorCode,
      );
      const localCopies = local.reduce((s, r) => s + r.qty, 0);
      const remote = await fetchCloudItems(profile.collectorCode);
      if (remote == null) {
        return {
          reachable: false,
          localItems: local.length,
          localCopies,
          cloudItems: 0,
          cloudCopies: 0,
          inSync: false,
        };
      }
      const cloudCopies = remote.reduce((s, r) => s + r.qty, 0);
      const localByKey = new Map(
        local.map((r) => [r.item_key, r.qty]),
      );
      let inSync = remote.length === local.length;
      if (inSync) {
        for (const r of remote) {
          if (localByKey.get(r.item_key) !== r.qty) {
            inSync = false;
            break;
          }
        }
      }
      return {
        reachable: true,
        localItems: local.length,
        localCopies,
        cloudItems: remote.length,
        cloudCopies,
        inSync,
      };
    },
  }),

  restoreCollectionFromCloud: defineAction({
    description:
      "Restore direction of the cloud backup: when the local collection has no owned items (fresh device/sign-in), loads the collector's backed-up items from Supabase collection_items back into the local binder (card finishes and sealed quantities). Does nothing when local data already exists, so a restore can never overwrite a live collection.",
    request: z.object({}),
    response: restoreResponse,
    async handler(ctx): Promise<z.infer<typeof restoreResponse>> {
      const db = ctx.db<typeof schema>();
      const cardRows = await db.select().from(schema.cards);
      if (cardRows.length === 0) {
        return {
          restored: false,
          cardsApplied: 0,
          sealedApplied: 0,
          note: "The card catalog isn't loaded yet — seed first, then restore.",
        };
      }
      const localOwned = cardRows.reduce(
        (s, r) => s + r.ownedQty,
        0,
      );
      if (localOwned > 0) {
        return {
          restored: false,
          cardsApplied: 0,
          sealedApplied: 0,
          note: "Local collection already has items — restore only fills an empty collection.",
        };
      }
      const profile = await ensureCollectorProfile(ctx);
      const remote = await fetchCloudItems(profile.collectorCode);
      if (remote == null) {
        return {
          restored: false,
          cardsApplied: 0,
          sealedApplied: 0,
          note: "The cloud backup couldn't be reached.",
        };
      }
      if (remote.length === 0) {
        return {
          restored: false,
          cardsApplied: 0,
          sealedApplied: 0,
          note: "No cloud backup found for this collector yet.",
        };
      }
      const byUid = new Map(cardRows.map((r) => [r.uid, r]));
      const finishesByUid = new Map<string, Record<string, number>>();
      let cardsApplied = 0;
      let sealedApplied = 0;
      for (const row of remote) {
        if (row.kind === "card" && row.item_key.startsWith("card:")) {
          // Key shape: card:{uid}:{finish} — the uid itself
          // contains a colon, so split at the LAST colon.
          const rest = row.item_key.slice("card:".length);
          const cut = rest.lastIndexOf(":");
          if (cut <= 0) continue;
          const uid = rest.slice(0, cut);
          const finish = rest.slice(cut + 1);
          if (!byUid.has(uid) || row.qty <= 0) continue;
          const entry = finishesByUid.get(uid) ?? {};
          entry[finish] = row.qty;
          finishesByUid.set(uid, entry);
          cardsApplied += 1;
        } else if (
          row.kind === "sealed" &&
          row.item_key.startsWith("sealed:")
        ) {
          const name = row.item_key.slice("sealed:".length);
          if (!allSealedItems.some((i) => i.name === name)) continue;
          await db
            .insert(schema.sealedQty)
            .values({ name, qty: row.qty })
            .onConflictDoUpdate({
              target: schema.sealedQty.name,
              set: { qty: row.qty },
            });
          sealedApplied += 1;
        }
        // kind "comic": the graded comics are a static catalog in
        // the app itself — nothing local to restore into.
      }
      for (const [uid, finishes] of finishesByUid) {
        const total = Object.values(finishes).reduce(
          (s, q) => s + q,
          0,
        );
        await db
          .update(schema.cards)
          .set({
            ownedQty: total,
            finishes: JSON.stringify(finishes),
          })
          .where(eq(schema.cards.uid, uid));
      }
      ctx.invalidateQueries();
      return {
        restored: cardsApplied > 0 || sealedApplied > 0,
        cardsApplied,
        sealedApplied,
        note: null,
      };
    },
  }),

  getTradeMatchItems: defineAction({
    description:
      "Trade Match, the 'You Have, They Need' direction: Anthony's owned cards (by printing and finish) whose card name is NOT in the friend's collection — the cards he has that they need — filtered by search text and set, sorted by value, with the total count.",
    request: z.object({
      excludeNames: z.array(z.string().max(120)).max(60),
      query: z.string().max(80),
      group: z.string().max(120),
    }),
    response: profileItemsResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof profileItemsResponse>> {
      const all = await buildProfileItems(ctx);
      const excluded = new Set(
        args.excludeNames.map((n) => n.trim().toLowerCase()),
      );
      const mine = all.filter(
        (i) =>
          i.cardId != null &&
          !excluded.has(i.name.trim().toLowerCase()),
      );
      const searched = filterProfileItems(mine, args.query, "all");
      const groups = [...new Set(searched.map((i) => i.groupName))].sort();
      const grouped =
        args.group === "all"
          ? searched
          : searched.filter((i) => i.groupName === args.group);
      const sorted = sortProfileItems(grouped, "value");
      return {
        total: sorted.length,
        groups,
        items: sorted.slice(0, PROFILE_ITEMS_CAP),
      };
    },
  }),

  getProfileSummary: defineAction({
    description:
      "The measured inputs behind Anthony's collector profile header and his achievement badges: registry join date and first-wave (Founder) status, Trust Score, confirmed connections and trades from the server, total items, master sets completed under his regular + cold foil + Epics rule, Enchanted/Iconic ownership, and sealed count. Badges are evaluated from these numbers only — nothing is granted by hand.",
    request: z.object({
      comicsOwned: z.number().int().min(0).max(1000),
    }),
    response: profileSummaryResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof profileSummaryResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);

      let cardCopies = 0;
      let ownsEnchanted = false;
      let ownsIconic = false;
      for (const row of rows) {
        cardCopies += row.ownedQty;
        if (row.ownedQty > 0 && row.rarity === "Enchanted")
          ownsEnchanted = true;
        if (row.ownedQty > 0 && row.rarity === "Iconic")
          ownsIconic = true;
      }

      // Master-set completion, in the app's own pocket model:
      // every pocket of every main-set printing must be filled,
      // except Enchanted- and Iconic-rarity printings, which sit
      // outside Anthony's master-set definition (regular + cold
      // foil + Epics). Promos and quests are not master sets.
      const byGroup = new Map<string, typeof rows>();
      for (const row of rows) {
        if (row.grp !== "set") continue;
        const list = byGroup.get(row.groupKey) ?? [];
        list.push(row);
        byGroup.set(row.groupKey, list);
      }
      const completedSets: string[] = [];
      for (const list of byGroup.values()) {
        let complete = list.length > 0;
        for (const row of list) {
          if (row.rarity === "Enchanted" || row.rarity === "Iconic")
            continue;
          if (pocketsOf(row).some((p) => p.qty < 1)) {
            complete = false;
            break;
          }
        }
        if (complete) {
          const first = list[0];
          if (first) completedSets.push(first.groupName);
        }
      }

      const effSealed = await effectiveSealed(ctx);

      const [profilesRes, connectionsRes, trustRes] =
        await Promise.all([
          supabaseRest(
            "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
          ),
          supabaseRest(
            "connections?select=collector_a,collector_b,status&limit=5000",
          ),
          supabaseRest(
            "trust_events?select=collector_id,event_type&limit=5000",
          ),
        ]);
      const profiles = profilesRes.ok
        ? asRegistryRows(profilesRes.json)
        : [];
      const mine =
        profiles.find((p) => p.collector_id === profile.collectorCode) ??
        null;
      let founder = false;
      if (mine && profiles.length > 0) {
        const earliest = Math.min(
          ...profiles.map((p) => Date.parse(p.created_at) || Infinity),
        );
        const mineTime = Date.parse(mine.created_at);
        founder =
          Number.isFinite(mineTime) &&
          Number.isFinite(earliest) &&
          mineTime - earliest <= 45 * 24 * 60 * 60 * 1000;
      }
      let confirmedConnections = 0;
      if (connectionsRes.ok && Array.isArray(connectionsRes.json)) {
        for (const raw of connectionsRes.json) {
          if (typeof raw !== "object" || raw === null) continue;
          const r = raw as Record<string, unknown>;
          if (
            r.status === "confirmed" &&
            (r.collector_a === profile.collectorCode ||
              r.collector_b === profile.collectorCode)
          ) {
            confirmedConnections += 1;
          }
        }
      }
      let confirmedTrades = 0;
      if (trustRes.ok && Array.isArray(trustRes.json)) {
        for (const raw of trustRes.json) {
          if (typeof raw !== "object" || raw === null) continue;
          const r = raw as Record<string, unknown>;
          if (
            r.collector_id === profile.collectorCode &&
            typeof r.event_type === "string" &&
            r.event_type.toLowerCase().includes("trade")
          ) {
            confirmedTrades += 1;
          }
        }
      }

      return {
        joinedAt: mine?.created_at ?? null,
        founder,
        trustScore: mine?.trust_score ?? 0,
        confirmedConnections,
        confirmedTrades,
        totalItems: cardCopies + effSealed.totals.qty + args.comicsOwned,
        completedSets,
        ownsEnchanted,
        ownsIconic,
        sealedCount: effSealed.totals.qty,
        registryReachable: profilesRes.ok,
      };
    },
  }),

  seedMarketplace: defineAction({
    description:
      "Seeds the Marketplace exactly once with the built-in test friend Jarvis's listings (his priced Friends-area cards at market value, Near Mint) so the browse/claim/offer flows have real test data from a labeled test profile. Anthony's own listings are only ever created by him in the Sell flow.",
    request: z.object({}),
    response: z.object({ seeded: z.boolean(), count: z.number() }),
    async handler(ctx): Promise<{ seeded: boolean; count: number }> {
      const db = ctx.db<typeof schema>();
      const marker = await db
        .select()
        .from(schema.marketplaceMeta)
        .where(eq(schema.marketplaceMeta.key, "seeded_v1"))
        .limit(1);
      if (marker[0]) return { seeded: false, count: 0 };
      const cardRows = await db.select().from(schema.cards);
      const now = new Date().toISOString();
      let count = 0;
      for (const seed of JARVIS_SEED_LISTINGS) {
        const candidates = cardRows.filter((c) => c.fullName === seed.name);
        const row =
          candidates.find((c) => c.groupName === seed.groupHint) ??
          candidates[0];
        if (!row) continue;
        const prices = parseFinance(row.financeJson);
        const value = prices[seed.finish]?.value ?? row.marketValue;
        if (value == null) continue;
        await db.insert(schema.marketplaceListings).values({
          sellerCode: JARVIS_REGISTRY_PROFILE.collector_id,
          sellerUsername: JARVIS_REGISTRY_PROFILE.username,
          kind: "card",
          cardId: row.id,
          sealedName: null,
          comicId: null,
          name: row.fullName,
          groupName: row.groupName,
          finish: seed.finish,
          condition: "Near Mint",
          qty: seed.qty,
          askingPrice: Math.round(value * 100) / 100,
          marketValue: Math.round(value * 100) / 100,
          status: "available",
          createdAt: now,
          updatedAt: now,
        });
        count += 1;
      }
      await db.insert(schema.marketplaceMeta).values({
        key: "seeded_v1",
        value: now,
      });
      return { seeded: true, count };
    },
  }),

  getMarketplace: defineAction({
    description:
      "Marketplace browse: every available or sale-pending listing (sold and removed are hidden), searchable by name or name + collector number, filterable by item type and set/collection, sortable by price or newest. Market values are resolved live for cards and sealed items so the asking-vs-market comparison is current. Also returns Anthony's feedback gate state.",
    request: z.object({
      query: z.string().max(80),
      kind: z.enum(["all", "card", "sealed", "comic"]),
      group: z.string().max(120),
      sort: z.enum(["price-asc", "price-desc", "newest"]),
    }),
    response: marketplaceBrowseResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketplaceBrowseResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.marketplaceListings);
      const view = await listingViewContext(ctx);
      let listings = rows
        .filter((r) => r.status === "available" || r.status === "pending")
        .map((r) =>
          toListingView(
            r,
            profile.collectorCode,
            view.cardById,
            view.sealedUnitByName,
            view.pendingByListing,
          ),
        );
      if (args.kind !== "all")
        listings = listings.filter((l) => l.kind === args.kind);
      // Search: name tokens as substrings + optional collector
      // number token — the main Search rule.
      const tokens = args.query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const numberToken = tokens.find((t) =>
        /^\d+$/.test(t.replace(/^#/, "")),
      );
      const nameNeedle = tokens.filter((t) => t !== numberToken).join(" ");
      if (nameNeedle || numberToken) {
        listings = listings.filter((l) => {
          if (nameNeedle && !l.name.toLowerCase().includes(nameNeedle))
            return false;
          if (numberToken) {
            const want = numberToken.replace(/^#/, "");
            const got = (l.printed ?? "").split("/")[0]?.trim() ?? "";
            if (got !== want) return false;
          }
          return true;
        });
      }
      const groups = [...new Set(listings.map((l) => l.groupName))].sort();
      if (args.group !== "all")
        listings = listings.filter((l) => l.groupName === args.group);
      if (args.sort === "price-asc")
        listings.sort((a, b) => a.askingPrice - b.askingPrice);
      else if (args.sort === "price-desc")
        listings.sort((a, b) => b.askingPrice - a.askingPrice);
      else
        listings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      return { listings, groups, gate };
    },
  }),

  getMyListings: defineAction({
    description:
      "Anthony's own marketplace listings in every live state (available, sale pending, sold — removed ones are gone), with pending claim/offer counts and his feedback gate state.",
    request: z.object({}),
    response: marketplaceBrowseResponse,
    async handler(
      ctx,
    ): Promise<z.infer<typeof marketplaceBrowseResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.marketplaceListings);
      const view = await listingViewContext(ctx);
      const listings = rows
        .filter(
          (r) =>
            r.sellerCode === profile.collectorCode && r.status !== "removed",
        )
        .map((r) =>
          toListingView(
            r,
            profile.collectorCode,
            view.cardById,
            view.sealedUnitByName,
            view.pendingByListing,
          ),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      return {
        listings,
        groups: [...new Set(listings.map((l) => l.groupName))].sort(),
        gate,
      };
    },
  }),

  createListing: defineAction({
    description:
      "Publishes a marketplace listing from Anthony's own collection: a binder card in a finish he owns (quantity checked against the binder, minus what he already has listed), a sealed product he owns, or one of his graded comics (display fields come from the comics catalog in the client). Blocked while a finished deal awaits his feedback.",
    request: z.object({
      kind: z.enum(["card", "sealed", "comic"]),
      cardId: z.number().nullable(),
      sealedName: z.string().nullable(),
      comicId: z.string().nullable(),
      comicName: z.string().max(160),
      comicGroup: z.string().max(120),
      comicFinish: z.string().max(80),
      comicValue: z.number().nullable(),
      finish: z.string().max(80),
      condition: z.string().max(40),
      qty: z.number().int().min(1).max(99),
      askingPrice: z.number().positive().max(1000000),
    }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: null,
        listingId: null,
      });
      const profile = await ensureCollectorProfile(ctx);
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      if (gate.blocked) return fail(FEEDBACK_GATE_MESSAGE);
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      const existing = await db.select().from(schema.marketplaceListings);
      const activeMine = existing.filter(
        (l) =>
          l.sellerCode === profile.collectorCode &&
          (l.status === "available" || l.status === "pending"),
      );
      let fields: {
        cardId: number | null;
        sealedName: string | null;
        comicId: string | null;
        name: string;
        groupName: string;
        finish: string;
        marketValue: number | null;
      } | null = null;
      if (args.kind === "card") {
        if (args.cardId == null) return fail("Pick a card first.");
        const rows = await db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, args.cardId))
          .limit(1);
        const card = rows[0];
        if (!card) return fail("That card isn't in the binder.");
        const finishes = parseFinishes(card.finishes);
        const owned = finishes[args.finish] ?? 0;
        const alreadyListed = activeMine
          .filter((l) => l.cardId === card.id && l.finish === args.finish)
          .reduce((s, l) => s + l.qty, 0);
        if (owned - alreadyListed < args.qty)
          return fail(
            `You only have ${Math.max(0, owned - alreadyListed)} unlisted cop${owned - alreadyListed === 1 ? "y" : "ies"} of that finish to sell.`,
          );
        const prices = parseFinance(card.financeJson);
        fields = {
          cardId: card.id,
          sealedName: null,
          comicId: null,
          name: card.fullName,
          groupName: card.groupName,
          finish: args.finish,
          marketValue: prices[args.finish]?.value ?? card.marketValue,
        };
      } else if (args.kind === "sealed") {
        if (!args.sealedName) return fail("Pick a sealed item first.");
        const eff = await effectiveSealed(ctx);
        const item = eff.items.find((i) => i.name === args.sealedName);
        if (!item) return fail("That sealed item isn't on your shelf.");
        const alreadyListed = activeMine
          .filter((l) => l.sealedName === item.name)
          .reduce((s, l) => s + l.qty, 0);
        if (item.qty - alreadyListed < args.qty)
          return fail(
            `You only have ${Math.max(0, item.qty - alreadyListed)} unlisted cop${item.qty - alreadyListed === 1 ? "y" : "ies"} to sell.`,
          );
        fields = {
          cardId: null,
          sealedName: item.name,
          comicId: null,
          name: item.name,
          groupName: item.setName,
          finish: "Sealed",
          marketValue:
            item.qty > 0
              ? Math.round((item.value / item.qty) * 100) / 100
              : item.value,
        };
      } else {
        if (!args.comicId || !args.comicName)
          return fail("Pick a comic first.");
        fields = {
          cardId: null,
          sealedName: null,
          comicId: args.comicId,
          name: args.comicName,
          groupName: args.comicGroup,
          finish: args.comicFinish,
          marketValue: args.comicValue,
        };
      }
      const inserted = await db
        .insert(schema.marketplaceListings)
        .values({
          sellerCode: profile.collectorCode,
          sellerUsername: profile.username,
          kind: args.kind,
          cardId: fields.cardId,
          sealedName: fields.sealedName,
          comicId: fields.comicId,
          name: fields.name,
          groupName: fields.groupName,
          finish: fields.finish,
          condition: args.condition,
          qty: args.qty,
          askingPrice: Math.round(args.askingPrice * 100) / 100,
          marketValue: fields.marketValue,
          status: "available",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.marketplaceListings.id });
      return {
        ok: true,
        error: null,
        offerId: null,
        listingId: inserted[0]?.id ?? null,
      };
    },
  }),

  updateListing: defineAction({
    description:
      "Manages one of Anthony's own listings: edit the asking price (only while it's available), mark it sold outside a marketplace deal, relist a sold item, or remove it. A listing with a deal in progress can't be edited or removed — the deal owns its state.",
    request: z.object({
      listingId: z.number(),
      askingPrice: z.number().positive().max(1000000).nullable(),
      action: z.enum(["none", "remove", "mark_sold", "relist"]),
    }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: null,
        listingId: args.listingId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, args.listingId))
        .limit(1);
      const listing = rows[0];
      if (!listing || listing.sellerCode !== profile.collectorCode)
        return fail("That listing isn't yours.");
      if (listing.status === "removed")
        return fail("That listing is already removed.");
      const offers = await db
        .select()
        .from(schema.marketplaceOffers)
        .where(eq(schema.marketplaceOffers.listingId, listing.id));
      const dealInProgress = offers.some((o) => o.status === "accepted");
      const now = new Date().toISOString();
      if (args.action === "remove") {
        if (dealInProgress)
          return fail(
            "A deal is in progress on this item — finish or unwind the deal first.",
          );
        await db
          .update(schema.marketplaceListings)
          .set({ status: "removed", updatedAt: now })
          .where(eq(schema.marketplaceListings.id, listing.id));
        // Any pending claims/offers die with the listing.
        for (const o of offers) {
          if (o.status === "pending") {
            await db
              .update(schema.marketplaceOffers)
              .set({ status: "declined", updatedAt: now })
              .where(eq(schema.marketplaceOffers.id, o.id));
          }
        }
        return { ok: true, error: null, offerId: null, listingId: listing.id };
      }
      if (args.action === "mark_sold") {
        if (listing.status !== "available")
          return fail("Only an available listing can be marked sold.");
        await db
          .update(schema.marketplaceListings)
          .set({ status: "sold", updatedAt: now })
          .where(eq(schema.marketplaceListings.id, listing.id));
        return { ok: true, error: null, offerId: null, listingId: listing.id };
      }
      if (args.action === "relist") {
        if (listing.status !== "sold")
          return fail("Only a sold listing can be relisted.");
        await db
          .update(schema.marketplaceListings)
          .set({ status: "available", updatedAt: now })
          .where(eq(schema.marketplaceListings.id, listing.id));
        return { ok: true, error: null, offerId: null, listingId: listing.id };
      }
      if (args.askingPrice != null) {
        if (listing.status !== "available")
          return fail("The price can only change while the listing is available.");
        await db
          .update(schema.marketplaceListings)
          .set({
            askingPrice: Math.round(args.askingPrice * 100) / 100,
            updatedAt: now,
          })
          .where(eq(schema.marketplaceListings.id, listing.id));
        return { ok: true, error: null, offerId: null, listingId: listing.id };
      }
      return fail("Nothing to change.");
    },
  }),

  placeClaim: defineAction({
    description:
      "Buy Now: claims a listing at its full asking price. No payment happens — the claim reserves the item (listing flips to Sale pending) and lands in the seller's Inbox to accept or decline. Blocked while a finished deal awaits Anthony's feedback, on his own listings, and on listings that aren't available.",
    request: z.object({ listingId: z.number() }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: null,
        listingId: args.listingId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      if (gate.blocked) return fail(FEEDBACK_GATE_MESSAGE);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, args.listingId))
        .limit(1);
      const listing = rows[0];
      if (!listing) return fail("That listing is gone.");
      if (listing.sellerCode === profile.collectorCode)
        return fail("That's your own listing.");
      if (listing.status !== "available")
        return fail("That item is already claimed or sold.");
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.marketplaceOffers)
        .values({
          listingId: listing.id,
          buyerCode: profile.collectorCode,
          buyerUsername: profile.username,
          type: "claim",
          amount: listing.askingPrice,
          status: "pending",
          sellerConfirmed: 0,
          buyerConfirmed: 0,
          completedAt: null,
          trustRecorded: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.marketplaceOffers.id });
      await db
        .update(schema.marketplaceListings)
        .set({ status: "pending", updatedAt: now })
        .where(eq(schema.marketplaceListings.id, listing.id));
      return {
        ok: true,
        error: null,
        offerId: inserted[0]?.id ?? null,
        listingId: listing.id,
      };
    },
  }),

  placeOffer: defineAction({
    description:
      "Makes an offer below (or at) a listing's asking price. The listing stays available until the seller accepts; accepting any claim/offer starts the deal and declines the rest. Blocked while a finished deal awaits Anthony's feedback and on his own listings.",
    request: z.object({
      listingId: z.number(),
      amount: z.number().positive().max(1000000),
    }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: null,
        listingId: args.listingId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      if (gate.blocked) return fail(FEEDBACK_GATE_MESSAGE);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, args.listingId))
        .limit(1);
      const listing = rows[0];
      if (!listing) return fail("That listing is gone.");
      if (listing.sellerCode === profile.collectorCode)
        return fail("That's your own listing.");
      if (listing.status === "sold" || listing.status === "removed")
        return fail("That item is no longer for sale.");
      const mine = await db
        .select()
        .from(schema.marketplaceOffers)
        .where(eq(schema.marketplaceOffers.listingId, listing.id));
      if (
        mine.some(
          (o) => o.buyerCode === profile.collectorCode && o.status === "pending",
        )
      )
        return fail("You already have a claim or offer in on this item.");
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.marketplaceOffers)
        .values({
          listingId: listing.id,
          buyerCode: profile.collectorCode,
          buyerUsername: profile.username,
          type: "offer",
          amount: Math.round(args.amount * 100) / 100,
          status: "pending",
          sellerConfirmed: 0,
          buyerConfirmed: 0,
          completedAt: null,
          trustRecorded: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.marketplaceOffers.id });
      return {
        ok: true,
        error: null,
        offerId: inserted[0]?.id ?? null,
        listingId: listing.id,
      };
    },
  }),

  cancelOffer: defineAction({
    description:
      "Withdraws Anthony's own pending claim or offer. Withdrawing a claim frees the listing back to available (unless a deal already started on it).",
    request: z.object({ offerId: z.number() }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: args.offerId,
        listingId: null,
      });
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceOffers)
        .where(eq(schema.marketplaceOffers.id, args.offerId))
        .limit(1);
      const offer = rows[0];
      if (!offer || offer.buyerCode !== profile.collectorCode)
        return fail("That claim or offer isn't yours.");
      if (offer.status !== "pending")
        return fail("Only a pending claim or offer can be withdrawn.");
      const now = new Date().toISOString();
      await db
        .update(schema.marketplaceOffers)
        .set({ status: "cancelled", updatedAt: now })
        .where(eq(schema.marketplaceOffers.id, offer.id));
      if (offer.type === "claim") {
        const siblings = await db
          .select()
          .from(schema.marketplaceOffers)
          .where(eq(schema.marketplaceOffers.listingId, offer.listingId));
        const dealStarted = siblings.some((o) => o.status === "accepted");
        if (!dealStarted) {
          await db
            .update(schema.marketplaceListings)
            .set({ status: "available", updatedAt: now })
            .where(eq(schema.marketplaceListings.id, offer.listingId));
        }
      }
      return { ok: true, error: null, offerId: offer.id, listingId: offer.listingId };
    },
  }),

  respondOffer: defineAction({
    description:
      "The seller answers a pending claim or offer. Accept starts the deal (listing locks to Sale pending, every other pending claim/offer on it is declined); decline frees a claimed listing back to available. Anthony's accepts are blocked while a finished deal awaits his feedback. asTestFriend lets Anthony drive the built-in test friend's side when the test friend is the seller — no other collector can be acted for.",
    request: z.object({
      offerId: z.number(),
      accept: z.boolean(),
      asTestFriend: z.boolean(),
    }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: args.offerId,
        listingId: null,
      });
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const offerRows = await db
        .select()
        .from(schema.marketplaceOffers)
        .where(eq(schema.marketplaceOffers.id, args.offerId))
        .limit(1);
      const offer = offerRows[0];
      if (!offer) return fail("That claim or offer is gone.");
      const listingRows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, offer.listingId))
        .limit(1);
      const listing = listingRows[0];
      if (!listing) return fail("That listing is gone.");
      const actor = resolveActor(
        profile.collectorCode,
        listing.sellerCode,
        args.asTestFriend,
      );
      if (!actor) return fail("Only the seller can answer this.");
      if (offer.status !== "pending")
        return fail("This was already answered.");
      if (args.accept && actor === profile.collectorCode) {
        const gate = await marketplaceGateFor(ctx, profile.collectorCode);
        if (gate.blocked) return fail(FEEDBACK_GATE_MESSAGE);
      }
      const now = new Date().toISOString();
      if (args.accept) {
        await db
          .update(schema.marketplaceOffers)
          .set({ status: "accepted", updatedAt: now })
          .where(eq(schema.marketplaceOffers.id, offer.id));
        await db
          .update(schema.marketplaceListings)
          .set({ status: "pending", updatedAt: now })
          .where(eq(schema.marketplaceListings.id, listing.id));
        const siblings = await db
          .select()
          .from(schema.marketplaceOffers)
          .where(eq(schema.marketplaceOffers.listingId, listing.id));
        for (const s of siblings) {
          if (s.id !== offer.id && s.status === "pending") {
            await db
              .update(schema.marketplaceOffers)
              .set({ status: "declined", updatedAt: now })
              .where(eq(schema.marketplaceOffers.id, s.id));
          }
        }
      } else {
        await db
          .update(schema.marketplaceOffers)
          .set({ status: "declined", updatedAt: now })
          .where(eq(schema.marketplaceOffers.id, offer.id));
        if (offer.type === "claim") {
          await db
            .update(schema.marketplaceListings)
            .set({ status: "available", updatedAt: now })
            .where(eq(schema.marketplaceListings.id, listing.id));
        }
      }
      return { ok: true, error: null, offerId: offer.id, listingId: listing.id };
    },
  }),

  confirmDealSide: defineAction({
    description:
      "One side's completion confirmation on an accepted deal — the in-person step (the two collectors scan each other's Collector ID and each confirms). When BOTH sides have confirmed, the deal completes: the listing becomes Sold and the deal is written to the server trust ledger (retried on later reads if the server was unreachable).",
    request: z.object({
      offerId: z.number(),
      asTestFriend: z.boolean(),
    }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: args.offerId,
        listingId: null,
      });
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const offerRows = await db
        .select()
        .from(schema.marketplaceOffers)
        .where(eq(schema.marketplaceOffers.id, args.offerId))
        .limit(1);
      const offer = offerRows[0];
      if (!offer) return fail("That deal is gone.");
      const listingRows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, offer.listingId))
        .limit(1);
      const listing = listingRows[0];
      if (!listing) return fail("That listing is gone.");
      if (offer.status !== "accepted")
        return fail("This deal isn't in progress.");
      if (offer.completedAt)
        return fail("This deal is already complete.");
      const asBuyer = resolveActor(
        profile.collectorCode,
        offer.buyerCode,
        args.asTestFriend,
      );
      const asSeller = resolveActor(
        profile.collectorCode,
        listing.sellerCode,
        args.asTestFriend,
      );
      const now = new Date().toISOString();
      let sellerConfirmed = offer.sellerConfirmed;
      let buyerConfirmed = offer.buyerConfirmed;
      if (asBuyer) buyerConfirmed = 1;
      else if (asSeller) sellerConfirmed = 1;
      else return fail("You're not part of this deal.");
      const both = sellerConfirmed === 1 && buyerConfirmed === 1;
      await db
        .update(schema.marketplaceOffers)
        .set({
          sellerConfirmed,
          buyerConfirmed,
          completedAt: both ? now : offer.completedAt,
          updatedAt: now,
        })
        .where(eq(schema.marketplaceOffers.id, offer.id));
      if (both) {
        await db
          .update(schema.marketplaceListings)
          .set({ status: "sold", updatedAt: now })
          .where(eq(schema.marketplaceListings.id, listing.id));
        const recorded = await recordDealTrust(offer, listing.sellerCode);
        if (recorded) {
          await db
            .update(schema.marketplaceOffers)
            .set({ trustRecorded: 1, updatedAt: now })
            .where(eq(schema.marketplaceOffers.id, offer.id));
        }
      }
      return { ok: true, error: null, offerId: offer.id, listingId: listing.id };
    },
  }),

  submitFeedback: defineAction({
    description:
      "The mandatory final step of a completed deal: thumbs up or down for the other side, with optional one-tap tags and an optional comment. No skipping — an unrated completed deal blocks new marketplace actions until rated (or the 7-day neutral close passes). Blind both ways: neither side's rating is revealed until both are in. Each side rates exactly once.",
    request: z.object({
      offerId: z.number(),
      rating: z.enum(["positive", "negative"]),
      tags: z.array(z.string().max(30)).max(6),
      comment: z.string().max(280).nullable(),
      asTestFriend: z.boolean(),
    }),
    response: marketMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        offerId: args.offerId,
        listingId: null,
      });
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const offerRows = await db
        .select()
        .from(schema.marketplaceOffers)
        .where(eq(schema.marketplaceOffers.id, args.offerId))
        .limit(1);
      const offer = offerRows[0];
      if (!offer) return fail("That deal is gone.");
      if (offer.status !== "accepted" || !offer.completedAt)
        return fail("Feedback opens once the deal is complete.");
      const listingRows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, offer.listingId))
        .limit(1);
      const listing = listingRows[0];
      if (!listing) return fail("That listing is gone.");
      const asBuyer = resolveActor(
        profile.collectorCode,
        offer.buyerCode,
        args.asTestFriend,
      );
      const asSeller = resolveActor(
        profile.collectorCode,
        listing.sellerCode,
        args.asTestFriend,
      );
      const fromCode = asBuyer ?? asSeller;
      if (!fromCode) return fail("You're not part of this deal.");
      const toCode =
        fromCode === offer.buyerCode ? listing.sellerCode : offer.buyerCode;
      const existing = await db
        .select()
        .from(schema.marketplaceFeedback)
        .where(eq(schema.marketplaceFeedback.offerId, offer.id));
      if (existing.some((f) => f.fromCode === fromCode))
        return fail("That side has already rated this deal.");
      await db.insert(schema.marketplaceFeedback).values({
        offerId: offer.id,
        fromCode,
        toCode,
        rating: args.rating,
        tags: JSON.stringify(args.tags),
        comment: args.comment,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, error: null, offerId: offer.id, listingId: listing.id };
    },
  }),

  getMarketplaceActivity: defineAction({
    description:
      "The Marketplace Inbox: pending claims and offers on Anthony's listings (incoming) and his own pending claims/offers (outgoing), plus every deal in progress or completed with its both-sides confirmation state and blind feedback state, and his feedback gate. Completed deals whose trust-ledger write failed earlier are retried here.",
    request: z.object({}),
    response: marketplaceActivityResponse,
    async handler(
      ctx,
    ): Promise<z.infer<typeof marketplaceActivityResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const [listings, offers, feedback] = await Promise.all([
        db.select().from(schema.marketplaceListings),
        db.select().from(schema.marketplaceOffers),
        db.select().from(schema.marketplaceFeedback),
      ]);
      const listingById = new Map(listings.map((l) => [l.id, l]));
      // Retry trust-ledger writes for completed deals involving me.
      for (const o of offers) {
        if (
          o.status === "accepted" &&
          o.completedAt &&
          o.trustRecorded === 0
        ) {
          const listing = listingById.get(o.listingId);
          if (!listing) continue;
          if (o.buyerCode !== me && listing.sellerCode !== me) continue;
          const recorded = await recordDealTrust(o, listing.sellerCode);
          if (recorded) {
            await db
              .update(schema.marketplaceOffers)
              .set({ trustRecorded: 1, updatedAt: new Date().toISOString() })
              .where(eq(schema.marketplaceOffers.id, o.id));
          }
        }
      }
      const fbByOffer = new Map<number, typeof feedback>();
      for (const f of feedback) {
        const list = fbByOffer.get(f.offerId) ?? [];
        list.push(f);
        fbByOffer.set(f.offerId, list);
      }
      const incoming: z.infer<typeof marketplaceOfferView>[] = [];
      const outgoing: z.infer<typeof marketplaceOfferView>[] = [];
      const deals: z.infer<typeof marketplaceDeal>[] = [];
      const now = Date.now();
      for (const o of offers) {
        const listing = listingById.get(o.listingId);
        if (!listing) continue;
        const iAmBuyer = o.buyerCode === me;
        const iAmSeller = listing.sellerCode === me;
        if (!iAmBuyer && !iAmSeller) continue;
        if (o.status === "pending") {
          const view: z.infer<typeof marketplaceOfferView> = {
            offerId: o.id,
            listingId: listing.id,
            itemName: listing.name,
            kind: listing.kind as "card" | "sealed" | "comic",
            cardId: listing.cardId,
            sealedName: listing.sealedName,
            comicId: listing.comicId,
            finish: listing.finish,
            type: o.type as "claim" | "offer",
            amount: o.amount,
            askingPrice: listing.askingPrice,
            direction: iAmSeller ? "incoming" : "outgoing",
            otherUsername: iAmSeller ? o.buyerUsername : listing.sellerUsername,
            otherCode: iAmSeller ? o.buyerCode : listing.sellerCode,
            otherIsTest: TEST_COLLECTOR_CODES.has(
              iAmSeller ? o.buyerCode : listing.sellerCode,
            ),
            createdAt: o.createdAt,
          };
          if (iAmSeller) incoming.push(view);
          else outgoing.push(view);
          continue;
        }
        if (o.status !== "accepted") continue;
        const fbs = fbByOffer.get(o.id) ?? [];
        const otherCode = iAmBuyer ? listing.sellerCode : o.buyerCode;
        const myFb = fbs.find((f) => f.fromCode === me);
        const theirFb = fbs.find((f) => f.fromCode === otherCode);
        const neutralClosed =
          o.completedAt != null &&
          now - Date.parse(o.completedAt) > FEEDBACK_WINDOW_MS;
        const feedbackClosed = Boolean((myFb && theirFb) || neutralClosed);
        const parseTags = (raw: string): string[] => {
          try {
            const v: unknown = JSON.parse(raw);
            return Array.isArray(v)
              ? v.filter((t): t is string => typeof t === "string")
              : [];
          } catch {
            return [];
          }
        };
        deals.push({
          offerId: o.id,
          listingId: listing.id,
          itemName: listing.name,
          kind: listing.kind as "card" | "sealed" | "comic",
          cardId: listing.cardId,
          sealedName: listing.sealedName,
          comicId: listing.comicId,
          finish: listing.finish,
          amount: o.amount,
          type: o.type as "claim" | "offer",
          role: iAmBuyer ? "buyer" : "seller",
          otherUsername: iAmBuyer ? listing.sellerUsername : o.buyerUsername,
          otherCode,
          otherIsTest: TEST_COLLECTOR_CODES.has(otherCode),
          myConfirmed: iAmBuyer
            ? o.buyerConfirmed === 1
            : o.sellerConfirmed === 1,
          theirConfirmed: iAmBuyer
            ? o.sellerConfirmed === 1
            : o.buyerConfirmed === 1,
          completedAt: o.completedAt,
          myRating: (myFb?.rating as "positive" | "negative") ?? null,
          theirRating: feedbackClosed
            ? ((theirFb?.rating as "positive" | "negative") ?? null)
            : null,
          myTags: myFb ? parseTags(myFb.tags) : [],
          theirTags:
            feedbackClosed && theirFb ? parseTags(theirFb.tags) : [],
          myComment: myFb?.comment ?? null,
          theirComment: feedbackClosed ? (theirFb?.comment ?? null) : null,
          awaitingMyFeedback: Boolean(
            o.completedAt && !myFb && !neutralClosed,
          ),
          feedbackClosed,
          createdAt: o.createdAt,
        });
      }
      incoming.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      outgoing.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const gate = await marketplaceGateFor(ctx, me);
      return { incoming, outgoing, deals, gate };
    },
  }),

  getTrades: defineAction({
    description:
      "Every trade involving Anthony — proposals in and out, accepted trades in progress, and completed trades with both-sides confirmation and blind feedback state — plus his trade feedback gate. Completed trades whose trust-ledger write failed earlier are retried here. Give/get are returned from Anthony's point of view.",
    request: z.object({}),
    response: tradesResponse,
    async handler(ctx): Promise<z.infer<typeof tradesResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const [trades, feedback] = await Promise.all([
        db.select().from(schema.tradeOffers),
        db.select().from(schema.tradeFeedback),
      ]);
      for (const t of trades) {
        if (
          t.status === "accepted" &&
          t.completedAt &&
          t.trustRecorded === 0 &&
          (t.proposerCode === me || t.partnerCode === me)
        ) {
          const recorded = await recordTradeTrust(t);
          if (recorded) {
            await db
              .update(schema.tradeOffers)
              .set({ trustRecorded: 1, updatedAt: new Date().toISOString() })
              .where(eq(schema.tradeOffers.id, t.id));
          }
        }
      }
      const fbByTrade = new Map<number, typeof feedback>();
      for (const f of feedback) {
        const list = fbByTrade.get(f.tradeId) ?? [];
        list.push(f);
        fbByTrade.set(f.tradeId, list);
      }
      const parseTags = (raw: string): string[] => {
        try {
          const v: unknown = JSON.parse(raw);
          return Array.isArray(v)
            ? v.filter((x): x is string => typeof x === "string")
            : [];
        } catch {
          return [];
        }
      };
      const now = Date.now();
      const views: z.infer<typeof tradeView>[] = [];
      for (const t of trades) {
        const iAmProposer = t.proposerCode === me;
        const iAmPartner = t.partnerCode === me;
        if (!iAmProposer && !iAmPartner) continue;
        const give = parseTradeItems(t.giveJson);
        const get = parseTradeItems(t.getJson);
        const otherCode = iAmProposer ? t.partnerCode : t.proposerCode;
        const fbs = fbByTrade.get(t.id) ?? [];
        const myFb = fbs.find((f) => f.fromCode === me);
        const theirFb = fbs.find((f) => f.fromCode === otherCode);
        const neutralClosed =
          t.completedAt != null &&
          now - Date.parse(t.completedAt) > FEEDBACK_WINDOW_MS;
        const feedbackClosed = Boolean((myFb && theirFb) || neutralClosed);
        views.push({
          tradeId: t.id,
          direction: iAmProposer ? "outgoing" : "incoming",
          proposerUsername: t.proposerUsername,
          otherUsername: iAmProposer ? t.partnerUsername : t.proposerUsername,
          otherCode,
          otherIsTest: TEST_COLLECTOR_CODES.has(otherCode),
          myGive: iAmProposer ? give : get,
          myGet: iAmProposer ? get : give,
          note: t.note,
          status: t.status as
            | "pending"
            | "accepted"
            | "declined"
            | "cancelled",
          myConfirmed: iAmProposer
            ? t.proposerConfirmed === 1
            : t.partnerConfirmed === 1,
          theirConfirmed: iAmProposer
            ? t.partnerConfirmed === 1
            : t.proposerConfirmed === 1,
          completedAt: t.completedAt,
          myRating: (myFb?.rating as "positive" | "negative") ?? null,
          theirRating: feedbackClosed
            ? ((theirFb?.rating as "positive" | "negative") ?? null)
            : null,
          myTags: myFb ? parseTags(myFb.tags) : [],
          theirTags: feedbackClosed && theirFb ? parseTags(theirFb.tags) : [],
          myComment: myFb?.comment ?? null,
          theirComment: feedbackClosed ? (theirFb?.comment ?? null) : null,
          awaitingMyFeedback: Boolean(
            t.completedAt && !myFb && !neutralClosed,
          ),
          feedbackClosed,
          createdAt: t.createdAt,
        });
      }
      views.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const gate = await tradesGateFor(ctx, me);
      return {
        trades: views,
        gate,
        tradeAvailability: effectiveAvailability(profile),
        howTradesWorkHidden: profile.howTradesWorkHidden > 0,
      };
    },
  }),

  setTradeAvailability: defineAction({
    description:
      "Sets the owner's hybrid trade availability: 'all' (every owned copy tradeable — exclusive) or 'none' (nothing tradeable — exclusive), or the stackable hold-backs 'master' (one copy of each printing stays back for the master sets), 'decks' (copies allocated to decks in Where it lives are held back), or 'master,decks' for both. Tradeable quantity is separate from owned quantity and is enforced when trade proposals are validated.",
    request: z.object({ availability: tradeAvailabilityEnum }),
    response: z.object({
      ok: z.boolean(),
      tradeAvailability: tradeAvailabilityEnum,
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      ok: boolean;
      tradeAvailability: z.infer<typeof tradeAvailabilityEnum>;
    }> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      // Mirror the legacy single-pick column for any older
      // reader: any hold-back stack reads as keep_one there.
      const legacy =
        args.availability === "all"
          ? "all"
          : args.availability === "none"
            ? "none"
            : "keep_one";
      await db
        .update(schema.collectorProfile)
        .set({
          tradeAvailability: args.availability,
          tradeMode: legacy,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true, tradeAvailability: args.availability };
    },
  }),

  setHowTradesWorkHidden: defineAction({
    description:
      "Remembers whether the owner has hidden the 'How trading works' explainer in Trades (Anthony, Nov 3, 2026: it collapses to its title row with a Show control; the choice persists per user).",
    request: z.object({ hidden: z.boolean() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          howTradesWorkHidden: args.hidden ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true };
    },
  }),

  getSectionIntros: defineAction({
    description:
      "Whether the user has hidden the Sealed intro window and the Social intro window (Anthony, Nov 3, 2026): both intros sit in bordered windows like 'How trading works', collapse to a title row with a Show control, and the choices persist on the collector profile.",
    request: z.object({}),
    response: z.object({
      sealedIntroHidden: z.boolean(),
      socialIntroHidden: z.boolean(),
      homeIntroHidden: z.boolean(),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      return {
        sealedIntroHidden: (profile.sealedIntroHidden ?? 0) > 0,
        socialIntroHidden: (profile.socialIntroHidden ?? 0) > 0,
        homeIntroHidden: (profile.homeIntroHidden ?? 0) > 0,
      };
    },
  }),

  setSectionIntroHidden: defineAction({
    description:
      "Remembers whether the user has hidden one section intro window — the Sealed intro or the Social intro (Anthony, Nov 3, 2026: the windows collapse to their title rows with a Show control, and the choice is remembered).",
    request: z.object({
      section: z.enum(["sealed", "social", "home"]),
      hidden: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          ...(args.section === "sealed"
            ? { sealedIntroHidden: args.hidden ? 1 : 0 }
            : args.section === "social"
              ? { socialIntroHidden: args.hidden ? 1 : 0 }
              : { homeIntroHidden: args.hidden ? 1 : 0 }),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true };
    },
  }),

  getPaymentInfo: defineAction({
    description:
      "Returns the signed-in collector's own saved Zelle handle (Settings > Payment info), or null when none is saved. The handle is the user's own payment info — it is only ever returned to its owner here; a buyer sees a seller's handle solely through the purchase order it belongs to.",
    request: z.object({}),
    response: z.object({ zelleHandle: z.string().nullable() }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      return { zelleHandle: profile.zelleHandle ?? null };
    },
  }),

  setZelleHandle: defineAction({
    description:
      "Saves (or, with an empty value, clears) the collector's own Zelle handle — the email or phone number their Zelle is registered under — entered by the user in Settings > Payment info. It is stored on their profile and shown only to the other party inside a cash purchase order where they are the seller.",
    request: z.object({ handle: z.string().max(200) }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      zelleHandle: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const value = args.handle.trim();
      if (value.length > 120)
        return {
          ok: false,
          error: "That looks too long for a Zelle email or phone number.",
          zelleHandle: null,
        };
      if (/https?:\/\//i.test(value))
        return {
          ok: false,
          error:
            "Enter the email or phone number your Zelle is registered under — not a link.",
          zelleHandle: null,
        };
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const saved = value === "" ? null : value;
      await db
        .update(schema.collectorProfile)
        .set({ zelleHandle: saved, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true, error: null, zelleHandle: saved };
    },
  }),

  getCollectionVisibility: defineAction({
    description:
      "Which of the six Home 'Your Collections' tiles this user has hidden in Settings (Anthony, Nov 3, 2026): returns the hidden tile keys; everything not listed is shown. Display-only — hiding deletes nothing and affects no totals.",
    request: z.object({}),
    response: z.object({ hidden: z.array(z.string()) }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      return { hidden: parseHiddenCollections(profile.hiddenCollections) };
    },
  }),

  setCollectionHidden: defineAction({
    description:
      "Shows or hides one Home 'Your Collections' tile for this user (Anthony, Nov 3, 2026): the choice persists on their profile like the theme choice and can be undone in Settings at any time. Display-only.",
    request: z.object({
      collection: z.enum([
        "lorcana",
        "pokemon",
        "magic",
        "lego",
        "comics",
        "starwars",
      ]),
      hidden: z.boolean(),
    }),
    response: z.object({
      ok: z.literal(true),
      hidden: z.array(z.string()),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; hidden: string[] }> {
      const profile = await ensureCollectorProfile(ctx);
      const current = new Set(
        parseHiddenCollections(profile.hiddenCollections),
      );
      if (args.hidden) current.add(args.collection);
      else current.delete(args.collection);
      const hidden = [...current];
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          hiddenCollections: JSON.stringify(hidden),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return { ok: true as const, hidden };
    },
  }),

  getWelcomeState: defineAction({
    description:
      "Whether this profile still owes the one-time Welcome flow (Anthony, Nov 3, 2026): needsWelcome is true until the flow is completed once. Mode is 'register' for a fresh profile (no registration, no registry sync, no photo — a brand-new user who must choose a username and take the forced tour) and 'returning' for an established profile (Anthony's own: the welcome shows once, dismissible, no registration, no forced tour).",
    request: z.object({}),
    response: z.object({
      needsWelcome: z.boolean(),
      mode: z.enum(["register", "returning"]),
      username: z.string(),
      collectorCode: z.string(),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const established =
        profile.registeredAt != null ||
        profile.registrySyncedAt != null ||
        profile.photoBlobKey != null;
      return {
        needsWelcome: profile.welcomeSeen === 0,
        mode: established ? ("returning" as const) : ("register" as const),
        username: profile.username,
        collectorCode: profile.collectorCode,
      };
    },
  }),

  checkUsername: defineAction({
    description:
      "Checks a username for the Welcome registration: format (3-20 letters, numbers, underscores) and availability against the network registry's profiles — a name held by a DIFFERENT collector code is taken; the caller's own current name is available. reachable=false means the registry could not be read, so availability is unconfirmed.",
    request: z.object({ username: z.string().trim().max(40) }),
    response: z.object({
      valid: z.boolean(),
      available: z.boolean(),
      reachable: z.boolean(),
    }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const valid = /^[A-Za-z0-9_]{3,20}$/.test(args.username);
      if (!valid) return { valid: false, available: false, reachable: true };
      if (
        args.username.toLowerCase() === profile.username.toLowerCase()
      ) {
        return { valid: true, available: true, reachable: true };
      }
      const list = await supabaseRest(
        "profiles?select=collector_id,username&order=created_at.asc",
      );
      if (!list.ok) return { valid: true, available: true, reachable: false };
      const rows = asRegistryRows(list.json);
      const taken = rows.some(
        (r) =>
          r.username.toLowerCase() === args.username.toLowerCase() &&
          r.collector_id !== profile.collectorCode,
      );
      return { valid: true, available: !taken, reachable: true };
    },
  }),

  registerCollector: defineAction({
    description:
      "Registers the username chosen on the Welcome page (Anthony, Nov 3, 2026): re-checks availability against the network registry (a name held by another collector is refused when the registry answers), saves the username on the profile, and stamps registered_at — the profile's Collector ID (username + its stable code) is created from it. The client follows with syncCollectorRegistry to write the row to the network registry.",
    request: z.object({
      username: z
        .string()
        .trim()
        .regex(
          /^[A-Za-z0-9_]{3,20}$/,
          "Use 3-20 letters, numbers, or underscores",
        ),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      username: z.string().nullable(),
      collectorCode: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (
        args.username.toLowerCase() !== profile.username.toLowerCase()
      ) {
        const list = await supabaseRest(
          "profiles?select=collector_id,username&order=created_at.asc",
        );
        if (list.ok) {
          const rows = asRegistryRows(list.json);
          const taken = rows.some(
            (r) =>
              r.username.toLowerCase() ===
                args.username.toLowerCase() &&
              r.collector_id !== profile.collectorCode,
          );
          if (taken) {
            return {
              ok: false,
              error: "That username is already taken on the network.",
              username: null,
              collectorCode: null,
            };
          }
        }
      }
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      await db
        .update(schema.collectorProfile)
        .set({ username: args.username, registeredAt: now, updatedAt: now })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return {
        ok: true,
        error: null,
        username: args.username,
        collectorCode: profile.collectorCode,
      };
    },
  }),

  completeWelcome: defineAction({
    description:
      "Marks the one-time Welcome flow completed for this profile (registration done or returning welcome dismissed, tour finished) so it never shows again on later opens. It can still be re-opened voluntarily from Settings > About this app, which does not touch this flag.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({ welcomeSeen: 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getMyDecks: defineAction({
    description:
      "The signed-in collector's saved decks (the deck builder, Anthony, Nov 3, 2026): every deck with its resolved card lines (name, printing, set, ink), total card count, ink colors, and whether it is on display on their My Decks page.",
    request: z.object({}),
    response: z.object({
      decks: z.array(deckView),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.decks)
        .where(eq(schema.decks.ownerCode, profile.collectorCode))
        .orderBy(asc(schema.decks.createdAt));
      const decks = [];
      for (const row of rows) decks.push(await deckViewOf(ctx, row));
      return { decks };
    },
  }),

  getDeckCandidates: defineAction({
    description:
      "Owned printings the deck builder can add (Anthony, Nov 3, 2026): every binder printing the collector owns at least one copy of, filtered by a name search (a trailing number narrows to that collector number), with the owned quantity. Capped at 80 rows.",
    request: z.object({ search: z.string().trim().max(80) }),
    response: z.object({
      candidates: z.array(
        z.object({
          cardId: z.number(),
          fullName: z.string(),
          printed: z.string(),
          groupName: z.string(),
          ink: z.string().nullable(),
          rarity: z.string().nullable(),
          ownedQty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);
      const q = args.search.toLowerCase();
      const numMatch = q.match(/^(.*?)\s+(\d{1,3})$/);
      const namePart = numMatch ? numMatch[1]! : q;
      const numPart = numMatch ? parseInt(numMatch[2]!, 10) : null;
      const out = [];
      for (const row of rows) {
        if (row.ownedQty <= 0) continue;
        if (
          namePart &&
          !row.fullName.toLowerCase().includes(namePart)
        ) {
          continue;
        }
        if (numPart != null && row.number !== numPart) continue;
        out.push({
          cardId: row.id,
          fullName: row.fullName,
          printed: row.printed,
          groupName: row.groupName,
          ink: row.ink,
          rarity: row.rarity,
          ownedQty: row.ownedQty,
        });
        if (out.length >= 80) break;
      }
      return { candidates: out };
    },
  }),

  saveDeck: defineAction({
    description:
      "Creates or updates one of the collector's decks (Anthony, Nov 3, 2026): the name plus card lines, validated against the collection — every line's quantity no more than the copies owned of that printing, no more than 4 copies of any one card name across printings, no more than 60 cards total, at least 1 card. Deck building uses full owned quantities (trade hold-backs do not limit it).",
    request: z.object({
      id: z.number().int().positive().nullable(),
      name: z.string().trim().min(1).max(60),
      cards: z
        .array(
          z.object({
            cardId: z.number().int().positive(),
            qty: z.number().int().min(1).max(60),
          }),
        )
        .max(240),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      deckId: z.number().nullable(),
    }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      // Merge duplicate printings.
      const merged = new Map<number, number>();
      for (const l of args.cards)
        merged.set(l.cardId, (merged.get(l.cardId) ?? 0) + l.qty);
      const lines = [...merged.entries()].map(([cardId, qty]) => ({
        cardId,
        qty,
      }));
      if (lines.length === 0) {
        return {
          ok: false,
          error: "Add at least one card to the deck.",
          deckId: null,
        };
      }
      const total = lines.reduce((s, l) => s + l.qty, 0);
      if (total > 60) {
        return {
          ok: false,
          error: `A deck holds at most 60 cards — this one has ${total}.`,
          deckId: null,
        };
      }
      const byName = new Map<string, number>();
      for (const l of lines) {
        const cardRows = await db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, l.cardId))
          .limit(1);
        const card = cardRows[0];
        if (!card) {
          return {
            ok: false,
            error: "One of those cards is no longer in the catalog.",
            deckId: null,
          };
        }
        if (l.qty > card.ownedQty) {
          return {
            ok: false,
            error: `You own ${card.ownedQty} cop${card.ownedQty === 1 ? "y" : "ies"} of ${card.fullName} — the deck asks for ${l.qty}.`,
            deckId: null,
          };
        }
        byName.set(
          card.fullName,
          (byName.get(card.fullName) ?? 0) + l.qty,
        );
      }
      for (const [name, n] of byName) {
        if (n > 4) {
          return {
            ok: false,
            error: `A deck can hold at most 4 copies of ${name} — this one has ${n}.`,
            deckId: null,
          };
        }
      }
      const now = new Date().toISOString();
      const cardsJson = JSON.stringify(lines);
      if (args.id != null) {
        const existing = await db
          .select()
          .from(schema.decks)
          .where(eq(schema.decks.id, args.id))
          .limit(1);
        if (
          !existing[0] ||
          existing[0].ownerCode !== profile.collectorCode
        ) {
          return { ok: false, error: "That deck was not found.", deckId: null };
        }
        await db
          .update(schema.decks)
          .set({ name: args.name, cardsJson, updatedAt: now })
          .where(eq(schema.decks.id, args.id));
        ctx.invalidateQueries();
        return { ok: true, error: null, deckId: args.id };
      }
      const inserted = await db
        .insert(schema.decks)
        .values({
          ownerCode: profile.collectorCode,
          name: args.name,
          cardsJson,
          displayed: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.decks.id });
      ctx.invalidateQueries();
      return { ok: true, error: null, deckId: inserted[0]?.id ?? null };
    },
  }),

  setDeckDisplayed: defineAction({
    description:
      "Puts one of the collector's decks on display (or takes it off) on their My Decks page (Anthony, Nov 3, 2026).",
    request: z.object({
      id: z.number().int().positive(),
      displayed: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.decks)
        .where(eq(schema.decks.id, args.id))
        .limit(1);
      if (!rows[0] || rows[0].ownerCode !== profile.collectorCode)
        return { ok: false };
      await db
        .update(schema.decks)
        .set({
          displayed: args.displayed ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.decks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteDeck: defineAction({
    description:
      "Deletes one of the collector's saved decks (Anthony, Nov 3, 2026). The cards themselves stay in the collection — only the deck list goes.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.decks)
        .where(eq(schema.decks.id, args.id))
        .limit(1);
      if (!rows[0] || rows[0].ownerCode !== profile.collectorCode)
        return { ok: false };
      await db.delete(schema.decks).where(eq(schema.decks.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getSharingSettings: defineAction({
    description:
      "The Settings sharing controls (Anthony, Nov 3, 2026): one switch per connected friend deciding whether that friend can see the owner's collection. Every friend defaults to ON — no friend_sharing row means sharing is on for them. The friend list is the central registry's members (minus the owner) with the built-in test friend always present.",
    request: z.object({}),
    response: z.object({
      friends: z.array(
        z.object({
          code: z.string(),
          username: z.string(),
          isTest: z.boolean(),
          share: z.boolean(),
        }),
      ),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const list = await supabaseRest(
        "profiles?select=collector_id,username&order=created_at.asc",
      );
      const rows = list.ok ? asRegistryRows(list.json) : [];
      const byCode = new Map<string, string>();
      for (const r of rows) {
        if (r.collector_id !== profile.collectorCode)
          byCode.set(r.collector_id, r.username);
      }
      if (!byCode.has(JARVIS_REGISTRY_PROFILE.collector_id))
        byCode.set(
          JARVIS_REGISTRY_PROFILE.collector_id,
          JARVIS_REGISTRY_PROFILE.username,
        );
      const saved = await db.select().from(schema.friendSharing);
      const shareByCode = new Map(
        saved.map((s) => [s.friendCode, s.share > 0]),
      );
      return {
        friends: [...byCode.entries()].map(([code, username]) => ({
          code,
          username,
          isTest: TEST_COLLECTOR_CODES.has(code),
          share: shareByCode.get(code) ?? true,
        })),
      };
    },
  }),

  setFriendSharing: defineAction({
    description:
      "Sets whether one connected friend (by collector code) can see the owner's collection — the per-friend switch in Settings > Sharing. Default is ON for every friend.",
    request: z.object({
      friendCode: z.string().min(1).max(64),
      share: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      await db
        .insert(schema.friendSharing)
        .values({
          friendCode: args.friendCode,
          share: args.share ? 1 : 0,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.friendSharing.friendCode,
          set: { share: args.share ? 1 : 0, updatedAt: now },
        });
      return { ok: true };
    },
  }),

  submitChangeRequest: defineAction({
    description:
      "Opens a change-request TICKET for the developer (Anthony, Nov 3, 2026 — the ticket system that replaced the email model): a type (change request, bug, or idea) plus a text message from the Settings form. Stamped server-side with the sender's username, Collector ID, and date; the ticket starts Open and unassigned, the sender can follow it under Your tickets in Settings, and Anthony works it from his ticket list. Returns the new ticket's number.",
    request: z.object({
      kind: z.enum(["change", "bug", "idea"]),
      message: z.string().min(1).max(1000),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      ticketId: z.number().nullable(),
    }),
    async handler(ctx, args) {
      const message = args.message.trim();
      if (message.length === 0)
        return { ok: false, error: "Write a message first.", ticketId: null };
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const inserted = await db
        .insert(schema.changeRequests)
        .values({
          senderCode: profile.collectorCode,
          senderUsername: profile.username,
          kind: args.kind,
          message,
          createdAt: new Date().toISOString(),
          status: "open",
          assignee: null,
        })
        .returning({ id: schema.changeRequests.id });
      return { ok: true, error: null, ticketId: inserted[0]?.id ?? null };
    },
  }),

  getChangeRequests: defineAction({
    description:
      "The developer's change-request TICKET list (Anthony, Nov 3, 2026 — ticket system replacing the email inbox): every ticket with its status and assignee, for the owner's ticket window and Admin section. Withheld from every profile but Anthony's own (MC-XFU8-Z5WD): anyone else gets isOwner=false and an empty list. Also reports whether the owner has completed the one-time TEST of the Home red envelope, so the envelope and ticket list can show their clearly-labeled test versions until he tries them.",
    request: z.object({}),
    response: z.object({
      isOwner: z.boolean(),
      envelopeTestSeen: z.boolean(),
      requests: z.array(
        z.object({
          id: z.number(),
          senderCode: z.string(),
          senderUsername: z.string(),
          kind: z.string(),
          message: z.string(),
          createdAt: z.string(),
          readAt: z.string().nullable(),
          status: z.string(),
          assignee: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { isOwner: false, envelopeTestSeen: true, requests: [] };
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.changeRequests)
        .orderBy(desc(schema.changeRequests.id))
        .limit(100);
      return {
        isOwner: true,
        envelopeTestSeen: (profile.envelopeTestSeen ?? 0) > 0,
        requests: rows.map((r) => ({
          id: r.id,
          senderCode: r.senderCode,
          senderUsername: r.senderUsername,
          kind: r.kind,
          message: r.message,
          createdAt: r.createdAt,
          readAt: r.readAt ?? null,
          status: r.status ?? "open",
          assignee: r.assignee ?? null,
        })),
      };
    },
  }),

  getMyTickets: defineAction({
    description:
      "The signed-in collector's own change-request tickets (Anthony, Nov 3, 2026, ticket system): every ticket they submitted, newest first, with its status and assignee, so a submitter can follow their tickets from Settings. Only the caller's own tickets are returned.",
    request: z.object({}),
    response: z.object({
      tickets: z.array(
        z.object({
          id: z.number(),
          kind: z.string(),
          message: z.string(),
          createdAt: z.string(),
          status: z.string(),
          assignee: z.string().nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.changeRequests)
        .where(eq(schema.changeRequests.senderCode, profile.collectorCode))
        .orderBy(desc(schema.changeRequests.id))
        .limit(50);
      return {
        tickets: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          message: r.message,
          createdAt: r.createdAt,
          status: r.status ?? "open",
          assignee: r.assignee ?? null,
        })),
      };
    },
  }),

  setTicketStatus: defineAction({
    description:
      "Sets a change-request ticket's status — Open, In Progress, or Completed (Anthony, Nov 3, 2026, ticket system). Owner-only: any other profile gets ok=false and nothing changes.",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["open", "in_progress", "completed"]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false };
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.changeRequests)
        .set({ status: args.status })
        .where(eq(schema.changeRequests.id, args.id));
      return { ok: true };
    },
  }),

  setTicketAssignee: defineAction({
    description:
      "Assigns a change-request ticket to a display name (e.g. Anthony or Jarvis), or clears the assignment with null (Anthony, Nov 3, 2026, ticket system). Owner-only: any other profile gets ok=false and nothing changes.",
    request: z.object({
      id: z.number().int().positive(),
      assignee: z.string().trim().min(1).max(40).nullable(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false };
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.changeRequests)
        .set({ assignee: args.assignee })
        .where(eq(schema.changeRequests.id, args.id));
      return { ok: true };
    },
  }),

  markChangeRequestRead: defineAction({
    description:
      "Marks one change request as read in the owner's email-style Admin inbox (Anthony, Nov 3, 2026). Owner-only: any other profile gets ok=false and nothing changes.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false };
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.changeRequests)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(schema.changeRequests.id, args.id),
            isNull(schema.changeRequests.readAt),
          ),
        );
      return { ok: true };
    },
  }),

  dismissEnvelopeTest: defineAction({
    description:
      "Marks the one-time TEST of the Home red envelope as completed — called when the owner finishes the test from the test message in his Admin inbox. Owner-only: any other profile gets ok=false and nothing changes. Real change requests are unaffected.",
    request: z.object({}),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false };
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          envelopeTestSeen: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true };
    },
  }),

  resetEnvelopeTest: defineAction({
    description:
      "Re-arms the one-time TEST of the Home red envelope (sets its seen flag back to 0), mirroring resetUpdateTest — so the test envelope and its inbox test message can be shown again, e.g. to verify the envelope → inbox flow after it was completed once in a test database.",
    request: z.object({}),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx): Promise<{ ok: true }> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({ envelopeTestSeen: 0, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true as const };
    },
  }),

  proposeTrade: defineAction({
    description:
      "Proposes a card trade: the proposer's cards (give) against the partner's cards (get), each side validated against that collector's real stock — Anthony's binder finishes, or the test friend's known cards. The only partner today is the built-in test friend Jarvis. Blocked while a finished trade awaits the proposer's feedback. asTestFriend proposes AS Jarvis (his stock as give) so Anthony can walk the flow from both sides.",
    request: z.object({
      give: z.array(tradeItemInput).min(1).max(8),
      get: z.array(tradeItemInput).min(1).max(8),
      note: z.string().max(280).nullable(),
      asTestFriend: z.boolean(),
    }),
    response: tradeMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof tradeMutationResponse>> {
      const fail = (error: string) => ({ ok: false, error, tradeId: null });
      // The composer's message travels with the proposal as
      // the opening message of the trade's thread (Anthony,
      // Nov 3, 2026), so it follows the message rules: no
      // links.
      const noteText = args.note?.trim() ?? "";
      if (noteText && DEAL_LINK_PATTERN.test(noteText))
        return fail(
          "Links aren't allowed in trade messages — remove the link and send again.",
        );
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const gate = await tradesGateFor(ctx, me);
      if (gate.blocked && !args.asTestFriend) return fail(TRADE_GATE_MESSAGE);
      const proposerCode = args.asTestFriend
        ? JARVIS_REGISTRY_PROFILE.collector_id
        : me;
      const proposerUsername = args.asTestFriend
        ? JARVIS_REGISTRY_PROFILE.username
        : profile.username;
      const partnerCode = args.asTestFriend
        ? me
        : JARVIS_REGISTRY_PROFILE.collector_id;
      const partnerUsername = args.asTestFriend
        ? profile.username
        : JARVIS_REGISTRY_PROFILE.username;
      const giveCheck = await validateTradeItems(
        ctx,
        proposerCode,
        me,
        args.give,
      );
      if (!giveCheck.ok) return fail(giveCheck.error);
      const getCheck = await validateTradeItems(
        ctx,
        partnerCode,
        me,
        args.get,
      );
      if (!getCheck.ok) return fail(getCheck.error);
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.tradeOffers)
        .values({
          proposerCode,
          proposerUsername,
          partnerCode,
          partnerUsername,
          giveJson: JSON.stringify(giveCheck.items),
          getJson: JSON.stringify(getCheck.items),
          note: args.note,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.tradeOffers.id });
      const tradeId = inserted[0]?.id ?? null;
      // The message also opens the trade's message thread, so
      // the partner sees it with the proposal and can answer
      // in the same thread (the note still shows on the card
      // as the proposal's message).
      if (tradeId != null && noteText) {
        await db.insert(schema.dealMessages).values({
          kind: "trade",
          dealId: tradeId,
          fromCode: proposerCode,
          fromUsername: proposerUsername,
          body: noteText,
          createdAt: now,
        });
      }
      return { ok: true, error: null, tradeId };
    },
  }),

  respondTrade: defineAction({
    description:
      "The partner answers a pending trade proposal: accept makes it a live deal (both sides then confirm in person); decline closes it. asTestFriend answers as the test friend when the proposal is his to answer.",
    request: z.object({
      tradeId: z.number(),
      accept: z.boolean(),
      asTestFriend: z.boolean(),
    }),
    response: tradeMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof tradeMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        tradeId: args.tradeId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.tradeOffers)
        .where(eq(schema.tradeOffers.id, args.tradeId))
        .limit(1);
      const trade = rows[0];
      if (!trade) return fail("That trade is gone.");
      if (trade.status !== "pending")
        return fail("This proposal has already been answered.");
      const actor = resolveActor(me, trade.partnerCode, args.asTestFriend);
      if (!actor) return fail("This proposal isn't yours to answer.");
      if (args.accept && actor === me) {
        const gate = await tradesGateFor(ctx, me);
        if (gate.blocked) return fail(TRADE_GATE_MESSAGE);
      }
      const now = new Date().toISOString();
      await db
        .update(schema.tradeOffers)
        .set({
          status: args.accept ? "accepted" : "declined",
          updatedAt: now,
        })
        .where(eq(schema.tradeOffers.id, trade.id));
      return { ok: true, error: null, tradeId: trade.id };
    },
  }),

  cancelTrade: defineAction({
    description:
      "The proposer withdraws a pending trade proposal. Accepted trades can't be cancelled here — they complete by both-sides confirmation. asTestFriend withdraws as the test friend for a proposal he made.",
    request: z.object({
      tradeId: z.number(),
      asTestFriend: z.boolean(),
    }),
    response: tradeMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof tradeMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        tradeId: args.tradeId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.tradeOffers)
        .where(eq(schema.tradeOffers.id, args.tradeId))
        .limit(1);
      const trade = rows[0];
      if (!trade) return fail("That trade is gone.");
      if (trade.status !== "pending")
        return fail("Only a pending proposal can be withdrawn.");
      const actor = resolveActor(me, trade.proposerCode, args.asTestFriend);
      if (!actor) return fail("This proposal isn't yours to withdraw.");
      await db
        .update(schema.tradeOffers)
        .set({ status: "cancelled", updatedAt: new Date().toISOString() })
        .where(eq(schema.tradeOffers.id, trade.id));
      return { ok: true, error: null, tradeId: trade.id };
    },
  }),

  confirmTradeSide: defineAction({
    description:
      "One side's in-person completion confirmation on an accepted trade. When BOTH sides have confirmed, the trade completes and is written to the server trust ledger as trade_confirmed (retried on later reads if the server was unreachable). asTestFriend confirms the test friend's side.",
    request: z.object({
      tradeId: z.number(),
      asTestFriend: z.boolean(),
    }),
    response: tradeMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof tradeMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        tradeId: args.tradeId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.tradeOffers)
        .where(eq(schema.tradeOffers.id, args.tradeId))
        .limit(1);
      const trade = rows[0];
      if (!trade) return fail("That trade is gone.");
      if (trade.status !== "accepted")
        return fail("This trade isn't in progress.");
      if (trade.completedAt)
        return fail("This trade is already complete.");
      const asProposer = resolveActor(
        me,
        trade.proposerCode,
        args.asTestFriend,
      );
      const asPartner = resolveActor(
        me,
        trade.partnerCode,
        args.asTestFriend,
      );
      let proposerConfirmed = trade.proposerConfirmed;
      let partnerConfirmed = trade.partnerConfirmed;
      if (asProposer) proposerConfirmed = 1;
      else if (asPartner) partnerConfirmed = 1;
      else return fail("You're not part of this trade.");
      const both = proposerConfirmed === 1 && partnerConfirmed === 1;
      const now = new Date().toISOString();
      await db
        .update(schema.tradeOffers)
        .set({
          proposerConfirmed,
          partnerConfirmed,
          completedAt: both ? now : trade.completedAt,
          updatedAt: now,
        })
        .where(eq(schema.tradeOffers.id, trade.id));
      if (both) {
        const recorded = await recordTradeTrust(trade);
        if (recorded) {
          await db
            .update(schema.tradeOffers)
            .set({ trustRecorded: 1, updatedAt: now })
            .where(eq(schema.tradeOffers.id, trade.id));
        }
      }
      return { ok: true, error: null, tradeId: trade.id };
    },
  }),

  submitTradeFeedback: defineAction({
    description:
      "The mandatory final step of a completed trade: thumbs up or down for the other side, with optional tags and comment. Blind both ways — revealed only once both sides have rated (or the 7-day neutral close passes). An unrated completed trade blocks new trade proposals until rated. Each side rates exactly once.",
    request: z.object({
      tradeId: z.number(),
      rating: z.enum(["positive", "negative"]),
      tags: z.array(z.string().max(30)).max(6),
      comment: z.string().max(280).nullable(),
      asTestFriend: z.boolean(),
    }),
    response: tradeMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof tradeMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        tradeId: args.tradeId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.tradeOffers)
        .where(eq(schema.tradeOffers.id, args.tradeId))
        .limit(1);
      const trade = rows[0];
      if (!trade) return fail("That trade is gone.");
      if (trade.status !== "accepted" || !trade.completedAt)
        return fail("Feedback opens once the trade is complete.");
      const asProposer = resolveActor(
        me,
        trade.proposerCode,
        args.asTestFriend,
      );
      const asPartner = resolveActor(
        me,
        trade.partnerCode,
        args.asTestFriend,
      );
      const fromCode = asProposer ?? asPartner;
      if (!fromCode) return fail("You're not part of this trade.");
      const toCode =
        fromCode === trade.proposerCode
          ? trade.partnerCode
          : trade.proposerCode;
      const existing = await db
        .select()
        .from(schema.tradeFeedback)
        .where(eq(schema.tradeFeedback.tradeId, trade.id));
      if (existing.some((f) => f.fromCode === fromCode))
        return fail("That side has already rated this trade.");
      await db.insert(schema.tradeFeedback).values({
        tradeId: trade.id,
        fromCode,
        toCode,
        rating: args.rating,
        tags: JSON.stringify(args.tags),
        comment: args.comment,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, error: null, tradeId: trade.id };
    },
  }),

  getCashQuote: defineAction({
    description:
      "The price and availability behind the green cash side of the split I want this button on the test friend's card: the card's current-day TCGplayer value for the finish (Anthony's cash pricing rule), plus how many copies he can sell. price is null when no price is tracked for the card anywhere.",
    request: z.object({
      cardId: z.number(),
      finish: z.string().max(40),
    }),
    response: z.object({
      price: z.number().nullable(),
      priceSource: z.enum(["ask", "market"]).nullable(),
      sellerQty: z.number(),
      sellerUsername: z.string(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      price: number | null;
      priceSource: "ask" | "market" | null;
      sellerQty: number;
      sellerUsername: string;
    }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const card = rows[0];
      if (!card)
        return {
          price: null,
          priceSource: null,
          sellerQty: 0,
          sellerUsername: JARVIS_REGISTRY_PROFILE.username,
        };
      const resolved = await resolveCashPrice(
        ctx,
        JARVIS_REGISTRY_PROFILE.collector_id,
        card,
        args.finish,
      );
      return {
        price: resolved?.price ?? null,
        priceSource: resolved?.source ?? null,
        sellerQty: jarvisStockQty(card, args.finish),
        sellerUsername: JARVIS_REGISTRY_PROFILE.username,
      };
    },
  }),

  createCashPurchase: defineAction({
    description:
      "Creates a cash purchase request for the test friend's card at the card's current-day TCGplayer value, frozen on the request (also stored as the TCG suggested price). Validated against the friend's known stock and blocked while a finished cash purchase awaits Anthony's feedback. No payment moves in the app — the request starts the accept/confirm/feedback buy flow.",
    request: z.object({
      cardId: z.number(),
      finish: z.string().max(40),
      qty: z.number().int().min(1).max(99),
    }),
    response: cashMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof cashMutationResponse>> {
      const fail = (error: string) => ({ ok: false, error, purchaseId: null });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const gate = await cashGateFor(ctx, me);
      if (gate.blocked) return fail(CASH_GATE_MESSAGE);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const card = rows[0];
      if (!card) return fail("That card is no longer in the catalog.");
      const stock = jarvisStockQty(card, args.finish);
      if (stock <= 0)
        return fail(
          `${card.fullName} (${args.finish}) isn't in ${JARVIS_REGISTRY_PROFILE.username}'s stock to sell.`,
        );
      if (args.qty > stock)
        return fail(
          `Only ${stock} ${stock === 1 ? "copy" : "copies"} of ${card.fullName} (${args.finish}) can be bought — that's all that side has.`,
        );
      const resolved = await resolveCashPrice(
        ctx,
        JARVIS_REGISTRY_PROFILE.collector_id,
        card,
        args.finish,
      );
      if (!resolved)
        return fail(
          `No price is tracked for ${card.fullName} yet, so a cash request can't be priced for it.`,
        );
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.cashPurchases)
        .values({
          buyerCode: me,
          buyerUsername: profile.username,
          sellerCode: JARVIS_REGISTRY_PROFILE.collector_id,
          sellerUsername: JARVIS_REGISTRY_PROFILE.username,
          cardId: card.id,
          name: card.fullName,
          groupName: card.groupName,
          printed: card.printed,
          finish: args.finish,
          qty: args.qty,
          unitPrice: resolved.price,
          suggestedUnitPrice: resolved.price,
          priceSource: resolved.source,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.cashPurchases.id });
      return { ok: true, error: null, purchaseId: inserted[0]?.id ?? null };
    },
  }),

  getCashPurchases: defineAction({
    description:
      "Cash purchases involving Anthony (as buyer from the test friend), newest first, with both-sides confirmation state and blind-feedback state, plus his cash feedback gate. Completed purchases not yet in the server trust ledger are written there on this read when the server answers.",
    request: z.object({}),
    response: cashPurchasesResponse,
    async handler(ctx): Promise<z.infer<typeof cashPurchasesResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const [purchases, feedback, cashMessages] = await Promise.all([
        db.select().from(schema.cashPurchases),
        db.select().from(schema.cashFeedback),
        db
          .select()
          .from(schema.dealMessages)
          .where(eq(schema.dealMessages.kind, "cash"))
          .orderBy(asc(schema.dealMessages.id)),
      ]);
      // The buyer's order message per purchase: the earliest
      // thread message the buyer wrote (the one seeded from
      // the checkout travels first).
      const orderMessageByPurchase = new Map<number, string>();
      for (const m of cashMessages) {
        const p = purchases.find((x) => x.id === m.dealId);
        if (
          p &&
          m.fromCode === p.buyerCode &&
          !orderMessageByPurchase.has(m.dealId)
        ) {
          orderMessageByPurchase.set(m.dealId, m.body);
        }
      }
      for (const p of purchases) {
        if (
          p.status === "accepted" &&
          p.completedAt &&
          p.trustRecorded === 0 &&
          (p.buyerCode === me || p.sellerCode === me)
        ) {
          const recorded = await recordCashTrust(p);
          if (recorded) {
            await db
              .update(schema.cashPurchases)
              .set({ trustRecorded: 1, updatedAt: new Date().toISOString() })
              .where(eq(schema.cashPurchases.id, p.id));
          }
        }
      }
      const fbByPurchase = new Map<number, typeof feedback>();
      for (const f of feedback) {
        const list = fbByPurchase.get(f.purchaseId) ?? [];
        list.push(f);
        fbByPurchase.set(f.purchaseId, list);
      }
      const parseTags = (raw: string): string[] => {
        try {
          const v: unknown = JSON.parse(raw);
          return Array.isArray(v)
            ? v.filter((x): x is string => typeof x === "string")
            : [];
        } catch {
          return [];
        }
      };
      const now = Date.now();
      const views: z.infer<typeof cashPurchaseView>[] = [];
      for (const p of purchases) {
        if (p.buyerCode !== me && p.sellerCode !== me) continue;
        const fbs = fbByPurchase.get(p.id) ?? [];
        const myFb = fbs.find((f) => f.fromCode === me);
        const theirFb = fbs.find((f) => f.fromCode !== me);
        const neutralClosed =
          p.completedAt != null &&
          now - Date.parse(p.completedAt) > FEEDBACK_WINDOW_MS;
        const feedbackClosed = Boolean((myFb && theirFb) || neutralClosed);
        views.push({
          purchaseId: p.id,
          sellerUsername: p.sellerUsername,
          buyerUsername: p.buyerUsername,
          sellerCode: p.sellerCode,
          sellerIsTest: TEST_COLLECTOR_CODES.has(p.sellerCode),
          cardId: p.cardId,
          name: p.name,
          groupName: p.groupName,
          printed: p.printed,
          finish: p.finish,
          qty: p.qty,
          unitPrice: p.unitPrice,
          totalPrice: Math.round(p.unitPrice * p.qty * 100) / 100,
          suggestedUnitPrice: p.suggestedUnitPrice,
          suggestedTotal:
            p.suggestedUnitPrice != null
              ? Math.round(p.suggestedUnitPrice * p.qty * 100) / 100
              : null,
          priceSource: p.priceSource,
          status: p.status as
            | "pending"
            | "accepted"
            | "declined"
            | "cancelled",
          buyerConfirmed: p.buyerConfirmed === 1,
          sellerConfirmed: p.sellerConfirmed === 1,
          completedAt: p.completedAt,
          myRating: (myFb?.rating as "positive" | "negative") ?? null,
          theirRating: feedbackClosed
            ? ((theirFb?.rating as "positive" | "negative") ?? null)
            : null,
          myTags: myFb ? parseTags(myFb.tags) : [],
          theirTags: feedbackClosed && theirFb ? parseTags(theirFb.tags) : [],
          myComment: myFb?.comment ?? null,
          theirComment: feedbackClosed ? (theirFb?.comment ?? null) : null,
          awaitingMyFeedback: Boolean(
            p.completedAt && !myFb && !neutralClosed,
          ),
          feedbackClosed,
          createdAt: p.createdAt,
          orderMessage: orderMessageByPurchase.get(p.id) ?? null,
          iAmSeller: p.sellerCode === me,
          sellerZelleHandle:
            p.sellerCode === me ? (profile.zelleHandle ?? null) : null,
        });
      }
      views.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const gate = await cashGateFor(ctx, me);
      return { purchases: views, gate };
    },
  }),

  respondCashPurchase: defineAction({
    description:
      "The seller answers a pending cash purchase request: accept makes it a live purchase (both sides then confirm once it is done in person); decline closes it. asTestSeller answers as the test friend, whose requests these are.",
    request: z.object({
      purchaseId: z.number(),
      accept: z.boolean(),
      asTestSeller: z.boolean(),
    }),
    response: cashMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof cashMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        purchaseId: args.purchaseId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cashPurchases)
        .where(eq(schema.cashPurchases.id, args.purchaseId))
        .limit(1);
      const purchase = rows[0];
      if (!purchase) return fail("That purchase request is gone.");
      if (purchase.status !== "pending")
        return fail("This request has already been answered.");
      const actor = resolveActor(me, purchase.sellerCode, args.asTestSeller);
      if (!actor) return fail("This request isn't yours to answer.");
      await db
        .update(schema.cashPurchases)
        .set({
          status: args.accept ? "accepted" : "declined",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.cashPurchases.id, purchase.id));
      return { ok: true, error: null, purchaseId: purchase.id };
    },
  }),

  cancelCashPurchase: defineAction({
    description:
      "The buyer withdraws a pending cash purchase request. Accepted purchases can't be cancelled here — they complete by both-sides confirmation.",
    request: z.object({ purchaseId: z.number() }),
    response: cashMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof cashMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        purchaseId: args.purchaseId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cashPurchases)
        .where(eq(schema.cashPurchases.id, args.purchaseId))
        .limit(1);
      const purchase = rows[0];
      if (!purchase) return fail("That purchase request is gone.");
      if (purchase.status !== "pending")
        return fail("Only a pending request can be withdrawn.");
      if (purchase.buyerCode !== me)
        return fail("This request isn't yours to withdraw.");
      await db
        .update(schema.cashPurchases)
        .set({ status: "cancelled", updatedAt: new Date().toISOString() })
        .where(eq(schema.cashPurchases.id, purchase.id));
      return { ok: true, error: null, purchaseId: purchase.id };
    },
  }),

  confirmCashPurchase: defineAction({
    description:
      "One side's in-person completion confirmation on an accepted cash purchase. When BOTH sides have confirmed, the purchase completes and is written to the server trust ledger as a confirmed sale (retried on later reads if the server was unreachable). asTestSeller confirms the test friend's side.",
    request: z.object({
      purchaseId: z.number(),
      asTestSeller: z.boolean(),
    }),
    response: cashMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof cashMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        purchaseId: args.purchaseId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cashPurchases)
        .where(eq(schema.cashPurchases.id, args.purchaseId))
        .limit(1);
      const purchase = rows[0];
      if (!purchase) return fail("That purchase request is gone.");
      if (purchase.status !== "accepted")
        return fail("This purchase isn't in progress.");
      if (purchase.completedAt)
        return fail("This purchase is already complete.");
      const asBuyer = resolveActor(me, purchase.buyerCode, false);
      const asSeller = resolveActor(
        me,
        purchase.sellerCode,
        args.asTestSeller,
      );
      let buyerConfirmed = purchase.buyerConfirmed;
      let sellerConfirmed = purchase.sellerConfirmed;
      if (args.asTestSeller) {
        if (!asSeller) return fail("You're not part of this purchase.");
        sellerConfirmed = 1;
      } else if (asBuyer) {
        buyerConfirmed = 1;
      } else if (asSeller) {
        sellerConfirmed = 1;
      } else {
        return fail("You're not part of this purchase.");
      }
      const both = buyerConfirmed === 1 && sellerConfirmed === 1;
      const now = new Date().toISOString();
      await db
        .update(schema.cashPurchases)
        .set({
          buyerConfirmed,
          sellerConfirmed,
          completedAt: both ? now : purchase.completedAt,
          updatedAt: now,
        })
        .where(eq(schema.cashPurchases.id, purchase.id));
      if (both) {
        const recorded = await recordCashTrust({
          ...purchase,
          buyerConfirmed,
          sellerConfirmed,
          completedAt: now,
        });
        if (recorded) {
          await db
            .update(schema.cashPurchases)
            .set({ trustRecorded: 1, updatedAt: now })
            .where(eq(schema.cashPurchases.id, purchase.id));
        }
      }
      return { ok: true, error: null, purchaseId: purchase.id };
    },
  }),

  submitCashFeedback: defineAction({
    description:
      "The mandatory final step of a completed cash purchase: thumbs up or down for the other side, with optional tags and comment. Blind both ways — revealed only once both sides have rated (or the 7-day neutral close passes). An unrated completed purchase blocks new cash requests until rated. Each side rates exactly once.",
    request: z.object({
      purchaseId: z.number(),
      rating: z.enum(["positive", "negative"]),
      tags: z.array(z.string().max(30)).max(6),
      comment: z.string().max(280).nullable(),
      asTestSeller: z.boolean(),
    }),
    response: cashMutationResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof cashMutationResponse>> {
      const fail = (error: string) => ({
        ok: false,
        error,
        purchaseId: args.purchaseId,
      });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cashPurchases)
        .where(eq(schema.cashPurchases.id, args.purchaseId))
        .limit(1);
      const purchase = rows[0];
      if (!purchase) return fail("That purchase request is gone.");
      if (purchase.status !== "accepted" || !purchase.completedAt)
        return fail("Feedback opens once the purchase is complete.");
      const asBuyer = resolveActor(me, purchase.buyerCode, false);
      const asSeller = resolveActor(
        me,
        purchase.sellerCode,
        args.asTestSeller,
      );
      const fromCode = args.asTestSeller ? asSeller : (asBuyer ?? asSeller);
      if (!fromCode) return fail("You're not part of this purchase.");
      const toCode =
        fromCode === purchase.buyerCode
          ? purchase.sellerCode
          : purchase.buyerCode;
      const existing = await db
        .select()
        .from(schema.cashFeedback)
        .where(eq(schema.cashFeedback.purchaseId, purchase.id));
      if (existing.some((f) => f.fromCode === fromCode))
        return fail("That side has already rated this purchase.");
      await db.insert(schema.cashFeedback).values({
        purchaseId: purchase.id,
        fromCode,
        toCode,
        rating: args.rating,
        tags: JSON.stringify(args.tags),
        comment: args.comment,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, error: null, purchaseId: purchase.id };
    },
  }),

  fillTradeOrder: defineAction({
    description:
      "The trade checkout's Fill my order: given the cards Anthony wants from the test friend (the get side), automatically builds his give side from cards he owns that the friend does NOT have (Trade Match direction), under his trade-availability setting, chosen by value — highest value first, adding copies only while the give total stays at or under the get total, so his side totals equal or less and the friend is never shorted on value. Returns the filled give side plus both totals for review and amending before anything is sent.",
    request: z.object({
      get: z.array(tradeItemInput).min(1).max(30),
    }),
    response: z.object({
      give: z.array(tradeItem),
      getTotal: z.number(),
      giveTotal: z.number(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      give: z.infer<typeof tradeItem>[];
      getTotal: number;
      giveTotal: number;
    }> {
      const db = ctx.db<typeof schema>();
      const cardRows = await db.select().from(schema.cards);
      const cardById = new Map(cardRows.map((c) => [c.id, c]));
      const valueOf = (
        card: typeof schema.cards.$inferSelect,
        finish: string,
      ): number => cardFinishMarketValue(card, finish) ?? 0;
      let getTotal = 0;
      const getKeys = new Set<string>();
      for (const g of args.get) {
        const card = cardById.get(g.cardId);
        if (!card) continue;
        getTotal += valueOf(card, g.finish) * g.qty;
        getKeys.add(`${g.cardId}:${g.finish}`);
      }
      getTotal = Math.round(getTotal * 100) / 100;
      const profile = await ensureCollectorProfile(ctx);
      const availability = effectiveAvailability(profile);
      const deckMap = availabilityHas(availability, "decks")
        ? await deckCopiesByCard(ctx)
        : new Map<number, number>();
      // What the friend already has is his whole known stock —
      // the fill only offers cards he does not own.
      const friendNames: Set<string> = new Set(
        JARVIS_TRADE_STOCK.map((s) => s.name),
      );
      const candidates: {
        card: typeof schema.cards.$inferSelect;
        finish: string;
        unit: number;
        avail: number;
      }[] = [];
      for (const card of cardRows) {
        if (friendNames.has(card.fullName)) continue;
        const finishes = parseFinishes(card.finishes);
        const tradeable = tradeableForFinishes(
          finishes,
          availability,
          deckMap.get(card.id) ?? 0,
        );
        for (const [finish] of Object.entries(finishes)) {
          const avail = tradeable.get(finish) ?? 0;
          if (avail <= 0) continue;
          if (getKeys.has(`${card.id}:${finish}`)) continue;
          const unit = valueOf(card, finish);
          if (unit <= 0) continue;
          candidates.push({ card, finish, unit, avail });
        }
      }
      candidates.sort(
        (a, b) =>
          b.unit - a.unit || a.card.fullName.localeCompare(b.card.fullName),
      );
      let giveTotal = 0;
      const give: z.infer<typeof tradeItem>[] = [];
      for (const cand of candidates) {
        let copies = 0;
        while (
          copies < cand.avail &&
          giveTotal + cand.unit <= getTotal + 1e-9
        ) {
          giveTotal += cand.unit;
          copies += 1;
        }
        if (copies > 0) {
          give.push({
            cardId: cand.card.id,
            name: cand.card.fullName,
            groupName: cand.card.groupName,
            printed: cand.card.printed,
            finish: cand.finish,
            qty: copies,
          });
        }
        if (giveTotal >= getTotal - 1e-9) break;
      }
      return {
        give,
        getTotal,
        giveTotal: Math.round(giveTotal * 100) / 100,
      };
    },
  }),

  priceCashCart: defineAction({
    description:
      "Prices a cash cart against the test friend's cards: per line, the card's current-day TCGplayer value for the finish (null when no price is tracked), plus the cart total over priced lines — the TCG suggested total at checkout. Sending the order re-resolves and freezes the prices.",
    request: z.object({
      items: z
        .array(
          z.object({
            cardId: z.number(),
            finish: z.string().max(40),
            qty: z.number().int().min(1).max(99),
          }),
        )
        .min(1)
        .max(30),
    }),
    response: z.object({
      lines: z.array(
        z.object({
          cardId: z.number(),
          finish: z.string(),
          qty: z.number(),
          price: z.number().nullable(),
          priceSource: z.enum(["ask", "market"]).nullable(),
          sellerQty: z.number(),
        }),
      ),
      total: z.number(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      lines: {
        cardId: number;
        finish: string;
        qty: number;
        price: number | null;
        priceSource: "ask" | "market" | null;
        sellerQty: number;
      }[];
      total: number;
    }> {
      const db = ctx.db<typeof schema>();
      const lines: {
        cardId: number;
        finish: string;
        qty: number;
        price: number | null;
        priceSource: "ask" | "market" | null;
        sellerQty: number;
      }[] = [];
      let total = 0;
      for (const item of args.items) {
        const rows = await db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, item.cardId))
          .limit(1);
        const card = rows[0];
        if (!card) {
          lines.push({
            cardId: item.cardId,
            finish: item.finish,
            qty: item.qty,
            price: null,
            priceSource: null,
            sellerQty: 0,
          });
          continue;
        }
        const resolved = await resolveCashPrice(
          ctx,
          JARVIS_REGISTRY_PROFILE.collector_id,
          card,
          item.finish,
        );
        if (resolved) total += resolved.price * item.qty;
        lines.push({
          cardId: item.cardId,
          finish: item.finish,
          qty: item.qty,
          price: resolved?.price ?? null,
          priceSource: resolved?.source ?? null,
          sellerQty: jarvisStockQty(card, item.finish),
        });
      }
      return { lines, total: Math.round(total * 100) / 100 };
    },
  }),

  createCashOrder: defineAction({
    description:
      "Sends a whole cash cart as a purchase order to the test friend: every line is validated against his known stock and priced at the card's current-day TCGplayer value (frozen on the row as the TCG suggested price), and each line becomes its own cash purchase request in the Cash purchases flow — so the owner can accept or decline card by card. A line with no tracked price never blocks the order: it sends with a null suggested price (the buyer can also remove it at checkout and send the rest). The buyer may pass offerTotal to change the total before sending: each priced line's offered price is the suggested price scaled to that total, and the receiver sees the offer next to the TCG suggested market price. The buyer may also pass a message written in the checkout: it travels with the order and opens the message thread inside each resulting purchase (links refused). Blocked while a finished cash purchase awaits Anthony's feedback. No payment moves in the app.",
    request: z.object({
      items: z
        .array(
          z.object({
            cardId: z.number(),
            finish: z.string().max(40),
            qty: z.number().int().min(1).max(99),
          }),
        )
        .min(1)
        .max(30),
      /** The buyer's adjusted total for the whole order, when
          they changed it at checkout; omitted = the TCG
          suggested total stands as the offer. */
      offerTotal: z.number().min(0).max(1000000).optional(),
      /** The buyer's message written in the checkout to go
          WITH the order (Anthony, Nov 3, 2026): it travels
          with the purchase order and opens the message thread
          inside each resulting purchase, so the seller sees
          it alongside the invoice and can reply in the same
          thread. Text only; links are refused like every
          trade message. */
      message: z.string().max(500).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      purchaseIds: z.array(z.number()),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      ok: boolean;
      error: string | null;
      purchaseIds: number[];
    }> {
      const fail = (error: string) => ({ ok: false, error, purchaseIds: [] });
      const orderMessage = args.message?.trim() ?? "";
      if (orderMessage && DEAL_LINK_PATTERN.test(orderMessage))
        return fail(
          "Links aren't allowed in order messages — remove the link and send again.",
        );
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const gate = await cashGateFor(ctx, me);
      if (gate.blocked) return fail(CASH_GATE_MESSAGE);
      const db = ctx.db<typeof schema>();
      const resolvedLines: {
        card: typeof schema.cards.$inferSelect;
        finish: string;
        qty: number;
        /** Current-day TCGplayer value, or null when no price
            is tracked for the card — an unpriced line NEVER
            blocks the order (Anthony's rule, Nov 3, 2026): it
            sends with no TCG reference and a $0 offered share
            unless it is the line absorbing the buyer's total. */
        price: number | null;
        source: "ask" | "market";
      }[] = [];
      for (const item of args.items) {
        const rows = await db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, item.cardId))
          .limit(1);
        const card = rows[0];
        if (!card) return fail("One of those cards is no longer in the catalog.");
        const stock = jarvisStockQty(card, item.finish);
        if (stock <= 0)
          return fail(
            `${card.fullName} (${item.finish}) isn't in ${JARVIS_REGISTRY_PROFILE.username}'s stock to sell.`,
          );
        if (item.qty > stock)
          return fail(
            `Only ${stock} ${stock === 1 ? "copy" : "copies"} of ${card.fullName} (${item.finish}) can be bought — that's all that side has.`,
          );
        const resolved = await resolveCashPrice(
          ctx,
          JARVIS_REGISTRY_PROFILE.collector_id,
          card,
          item.finish,
        );
        resolvedLines.push({
          card,
          finish: item.finish,
          qty: item.qty,
          price: resolved?.price ?? null,
          source: resolved?.source ?? "market",
        });
      }
      const now = new Date().toISOString();
      // The buyer's offer: the TCG suggested total, or their
      // adjusted total scaled across the lines (the last line
      // absorbs the rounding so the offered total is exact).
      const suggestedTotal =
        Math.round(
          resolvedLines.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0) *
            100,
        ) / 100;
      const offerTotal =
        args.offerTotal != null
          ? Math.round(args.offerTotal * 100) / 100
          : suggestedTotal;
      const scale =
        suggestedTotal > 0 ? offerTotal / suggestedTotal : 1;
      // The scaling remainder lands on the last PRICED line —
      // never dumped onto an unpriced one. When nothing in the
      // order is priced at all, the first line carries the
      // buyer's total (a $0 gift order stays exactly $0).
      const lastPricedIdx = resolvedLines.reduce(
        (acc, l, i) => (l.price != null ? i : acc),
        -1,
      );
      const absorberIdx = lastPricedIdx >= 0 ? lastPricedIdx : 0;
      const purchaseIds: number[] = [];
      let offeredSoFar = 0;
      for (const [idx, line] of resolvedLines.entries()) {
        let offeredUnit: number;
        if (idx === absorberIdx) {
          // The absorbing line takes the scaling remainder at
          // 3-decimal precision so the offered total sums
          // exactly to what the buyer typed.
          offeredUnit =
            Math.round(
              ((offerTotal - offeredSoFar) / line.qty) * 1000,
            ) / 1000;
        } else if (line.price == null) {
          offeredUnit = 0;
        } else {
          offeredUnit = Math.round(line.price * scale * 100) / 100;
          offeredSoFar += offeredUnit * line.qty;
        }
        const inserted = await db
          .insert(schema.cashPurchases)
          .values({
            buyerCode: me,
            buyerUsername: profile.username,
            sellerCode: JARVIS_REGISTRY_PROFILE.collector_id,
            sellerUsername: JARVIS_REGISTRY_PROFILE.username,
            cardId: line.card.id,
            name: line.card.fullName,
            groupName: line.card.groupName,
            printed: line.card.printed,
            finish: line.finish,
            qty: line.qty,
            unitPrice: offeredUnit,
            suggestedUnitPrice: line.price,
            priceSource: line.source,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: schema.cashPurchases.id });
        if (inserted[0]) purchaseIds.push(inserted[0].id);
      }
      // The buyer's checkout message travels with the order:
      // it opens the message thread inside EVERY purchase the
      // order created, so whichever line the seller opens,
      // the message is there alongside it, and the thread
      // continues in that purchase from there.
      if (orderMessage) {
        for (const purchaseId of purchaseIds) {
          await db.insert(schema.dealMessages).values({
            kind: "cash",
            dealId: purchaseId,
            fromCode: me,
            fromUsername: profile.username,
            body: orderMessage,
            createdAt: now,
          });
        }
      }
      return { ok: true, error: null, purchaseIds };
    },
  }),

  getAdminStats: defineAction({
    description:
      "Owner-only app statistics for the Admin area in Settings: registered collectors and roster, app-wide logged items (split by kind, most-owned cards), social counts, and system status — all read live from the Supabase registry. Withholds the stats (isOwner=false) from any profile that isn't Anthony's own Collector ID.",
    request: z.object({}),
    response: adminStatsResponse,
    async handler(
      ctx,
    ): Promise<z.infer<typeof adminStatsResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();

      // Anthony's own collection totals from this device's data —
      // computed for every caller (it's the caller's own binder)
      // and shown separately from the app-wide server numbers.
      const cardRows = await db
        .select({
          ownedQty: schema.cards.ownedQty,
          marketValue: schema.cards.marketValue,
        })
        .from(schema.cards);
      let cardCopies = 0;
      let distinctCards = 0;
      let cardsValue = 0;
      for (const row of cardRows) {
        cardCopies += row.ownedQty;
        if (row.ownedQty > 0) {
          distinctCards += 1;
          cardsValue += (row.marketValue ?? 0) * row.ownedQty;
        }
      }
      const effSealed = await effectiveSealed(ctx);
      const own = {
        cardCopies,
        distinctCards,
        sealedQty: effSealed.totals.qty,
        lorcanaValue:
          Math.round((cardsValue + effSealed.totals.value) * 100) /
          100,
      };

      // The "sync" source rows are internal one-time markers, not
      // price points — the finance history filters them out too.
      const snapshots = (
        await db.select().from(schema.financeSnapshots)
      ).filter((s) => s.source !== "sync");
      const lastSnap =
        snapshots.length > 0
          ? snapshots.reduce((a, b) => (b.id > a.id ? b : a))
          : null;
      const systemBase = {
        registrySyncedAt: profile.registrySyncedAt ?? null,
        lastPriceSnapshot: lastSnap
          ? `${lastSnap.label} · ${lastSnap.date}`
          : null,
      };

      const emptySocial = {
        connections: null,
        confirmedConnections: null,
        trustEvents: null,
        confirmedTrades: null,
      };

      if (profile.collectorCode !== OWNER_COLLECTOR_CODE) {
        return {
          isOwner: false,
          reachable: false,
          users: null,
          activity: null,
          social: emptySocial,
          series: { usersByDay: [], tradesByDay: [] },
          deals: null,
          system: { ...systemBase, storedRows: 0, storage: EMPTY_STORAGE },
          own,
        };
      }

      const [profilesRes, itemsRes, connectionsRes, trustRes] =
        await Promise.all([
          supabaseRest(
            "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
          ),
          // Paged: the server caps one response at 1,000 rows, and
          // with full collection backups live there are thousands.
          (async () => {
            const all: unknown[] = [];
            for (let offset = 0; ; offset += 1000) {
              const page = await supabaseRest(
                `collection_items?select=owner_collector_id,display_name,qty,kind&order=owner_collector_id.asc,item_key.asc&limit=1000&offset=${offset}`,
              );
              if (!page.ok || !Array.isArray(page.json)) {
                return { ok: false, status: page.status, json: all };
              }
              all.push(...page.json);
              if (page.json.length < 1000) break;
            }
            return { ok: true, status: 200, json: all };
          })(),
          supabaseRest("connections?select=status&limit=5000"),
          supabaseRest("trust_events?select=event_type,created_at&limit=5000"),
        ]);

      const reachable = profilesRes.ok;
      const profiles = profilesRes.ok
        ? asRegistryRows(profilesRes.json)
        : [];

      type ItemRow = {
        owner: string;
        name: string;
        qty: number;
        kind: string;
      };
      const items: ItemRow[] = [];
      if (itemsRes.ok && Array.isArray(itemsRes.json)) {
        for (const raw of itemsRes.json) {
          if (typeof raw !== "object" || raw === null) continue;
          const r = raw as Record<string, unknown>;
          if (
            typeof r.owner_collector_id === "string" &&
            typeof r.display_name === "string"
          ) {
            items.push({
              owner: r.owner_collector_id,
              name: r.display_name,
              qty: typeof r.qty === "number" ? r.qty : 0,
              kind: typeof r.kind === "string" ? r.kind : "card",
            });
          }
        }
      }

      const itemsByOwner = new Map<string, number>();
      const copiesByKind = new Map<string, number>();
      const byName = new Map<
        string,
        { copies: number; owners: Set<string> }
      >();
      let totalCopies = 0;
      for (const item of items) {
        totalCopies += item.qty;
        itemsByOwner.set(
          item.owner,
          (itemsByOwner.get(item.owner) ?? 0) + item.qty,
        );
        copiesByKind.set(
          item.kind,
          (copiesByKind.get(item.kind) ?? 0) + item.qty,
        );
        const entry = byName.get(item.name) ?? {
          copies: 0,
          owners: new Set<string>(),
        };
        entry.copies += item.qty;
        entry.owners.add(item.owner);
        byName.set(item.name, entry);
      }

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const roster = profiles.map((p) => ({
        collectorId: p.collector_id,
        username: p.username,
        trustScore: p.trust_score,
        itemsOwned: itemsByOwner.get(p.collector_id) ?? 0,
        joinedAt: p.created_at,
        isTest: TEST_COLLECTOR_CODES.has(p.collector_id),
        isYou: p.collector_id === profile.collectorCode,
      }));
      const largestEntry = roster.reduce<
        { username: string; items: number } | null
      >(
        (best, r) =>
          best == null || r.itemsOwned > best.items
            ? { username: r.username, items: r.itemsOwned }
            : best,
        null,
      );

      const users = reachable
        ? {
            total: profiles.length,
            newThisWeek: profiles.filter((p) => {
              const t = Date.parse(p.created_at);
              return Number.isFinite(t) && t >= weekAgo;
            }).length,
            roster,
          }
        : null;

      const activity =
        reachable && itemsRes.ok
          ? {
              totalCopies,
              totalRows: items.length,
              byKind: [...copiesByKind.entries()]
                .map(([kind, copies]) => ({ kind, copies }))
                .sort((a, b) => b.copies - a.copies),
              cardsLogged: copiesByKind.get("card") ?? 0,
              avgPerCollector:
                profiles.length > 0
                  ? Math.round((totalCopies / profiles.length) * 10) /
                    10
                  : 0,
              largest: largestEntry,
              mostOwned: [...byName.entries()]
                .map(([name, e]) => ({
                  name,
                  copies: e.copies,
                  owners: e.owners.size,
                }))
                .sort((a, b) => b.copies - a.copies)
                .slice(0, 10),
            }
          : null;

      const countRows = (json: unknown): number | null =>
        Array.isArray(json) ? json.length : null;
      const connections = connectionsRes.ok
        ? countRows(connectionsRes.json)
        : null;
      const confirmedConnections =
        connectionsRes.ok && Array.isArray(connectionsRes.json)
          ? connectionsRes.json.filter(
              (raw) =>
                typeof raw === "object" &&
                raw !== null &&
                (raw as Record<string, unknown>).status ===
                  "confirmed",
            ).length
          : null;
      const trustEvents = trustRes.ok
        ? countRows(trustRes.json)
        : null;
      const confirmedTrades =
        trustRes.ok && Array.isArray(trustRes.json)
          ? trustRes.json.filter(
              (raw) =>
                typeof raw === "object" &&
                raw !== null &&
                typeof (raw as Record<string, unknown>)
                  .event_type === "string" &&
                (
                  (raw as Record<string, unknown>)
                    .event_type as string
                )
                  .toLowerCase()
                  .includes("trade"),
            ).length
          : null;

      // Admin bar charts (Nov 3, 2026): the last 14 days of
      // new collectors and new trades, bucketed from the
      // registry rows just fetched — no invented points.
      const MONTHS = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const dayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const last14: { date: string; label: string }[] = [];
      {
        const now = new Date();
        for (let i = 13; i >= 0; i--) {
          const d = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - i,
          );
          last14.push({
            date: dayKey(d),
            label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
          });
        }
      }
      const bucketize = (
        stamps: (string | null)[],
      ): { date: string; label: string; count: number }[] => {
        const counts = new Map<string, number>();
        for (const s of stamps) {
          if (!s) continue;
          const key = s.slice(0, 10);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return last14.map((d) => ({
          ...d,
          count: counts.get(d.date) ?? 0,
        }));
      };
      const usersByDay = bucketize(
        profiles.map((p) => p.created_at),
      );
      const tradeEventStamps: (string | null)[] = [];
      if (trustRes.ok && Array.isArray(trustRes.json)) {
        for (const raw of trustRes.json) {
          if (typeof raw !== "object" || raw === null) continue;
          const r = raw as Record<string, unknown>;
          if (
            typeof r.event_type === "string" &&
            r.event_type.toLowerCase().includes("trade")
          ) {
            tradeEventStamps.push(
              typeof r.created_at === "string" ? r.created_at : null,
            );
          }
        }
      }
      const tradesByDay = bucketize(tradeEventStamps);

      // Deal flow from the app's own database: trades and cash
      // purchases by state, marketplace listings and completed
      // deals, and how many change requests are waiting.
      const [tradeRows, cashRows, listingRows, offerRows, requestRows] =
        await Promise.all([
          db
            .select({
              status: schema.tradeOffers.status,
              completedAt: schema.tradeOffers.completedAt,
            })
            .from(schema.tradeOffers),
          db
            .select({
              status: schema.cashPurchases.status,
              completedAt: schema.cashPurchases.completedAt,
            })
            .from(schema.cashPurchases),
          db
            .select({ status: schema.marketplaceListings.status })
            .from(schema.marketplaceListings),
          db
            .select({ completedAt: schema.marketplaceOffers.completedAt })
            .from(schema.marketplaceOffers),
          db
            .select({
              id: schema.changeRequests.id,
              readAt: schema.changeRequests.readAt,
              status: schema.changeRequests.status,
            })
            .from(schema.changeRequests),
        ]);
      const deals = {
        tradesProposed: tradeRows.filter((r) => r.status === "pending")
          .length,
        tradesAccepted: tradeRows.filter((r) => r.status === "accepted")
          .length,
        tradesCompleted: tradeRows.filter((r) => r.completedAt != null)
          .length,
        cashPurchases: cashRows.length,
        cashCompleted: cashRows.filter((r) => r.completedAt != null)
          .length,
        listingsActive: listingRows.filter(
          (r) => r.status === "available",
        ).length,
        listingsTotal: listingRows.length,
        dealsCompleted: offerRows.filter((r) => r.completedAt != null)
          .length,
        pendingChangeRequests: requestRows.filter(
          (r) => (r.status ?? "open") === "open",
        ).length,
      };

      // Storage panel figures: per-table estimates from live row
      // counts and sampled row sizes, plus the file-storage
      // listing — all measured from the project just now.
      const [estProfiles, estItems, estConnections, estTrust, fileStorage] =
        await Promise.all([
          supabaseTableEstimate("profiles"),
          supabaseTableEstimate("collection_items"),
          supabaseTableEstimate("connections"),
          supabaseTableEstimate("trust_events"),
          supabaseFileStorage(),
        ]);
      const dbBytes =
        (estProfiles?.bytes ?? 0) +
        (estItems?.bytes ?? 0) +
        (estConnections?.bytes ?? 0) +
        (estTrust?.bytes ?? 0);

      return {
        isOwner: true,
        reachable,
        users,
        activity,
        social: {
          connections,
          confirmedConnections,
          trustEvents,
          confirmedTrades,
        },
        series: { usersByDay, tradesByDay },
        deals,
        system: {
          ...systemBase,
          storedRows:
            profiles.length +
            items.length +
            (connections ?? 0) +
            (trustEvents ?? 0),
          storage: {
            dbAllotmentMb: SUPABASE_DB_ALLOTMENT_MB,
            dbUsedMb: Math.round((dbBytes / 1_000_000) * 100) / 100,
            fileAllotmentMb: SUPABASE_FILE_ALLOTMENT_MB,
            fileUsedMb: fileStorage.mb,
            fileMeasured: fileStorage.measured,
          },
        },
        own,
      };
    },
  }),

  searchCards: defineAction({
    description:
      "Searches all binder cards by name — optionally with a collector number too (e.g. \"Ariel 137\" finds Ariel #137) — and returns each match with its section and position so the UI can jump straight to it.",
    request: z.object({ query: z.string().trim().min(2).max(80) }),
    response: searchResponse,
    async handler(ctx, args): Promise<z.infer<typeof searchResponse>> {
      const db = ctx.db<typeof schema>();
      const needle = args.query.toLowerCase();
      // Name + number: a standalone number token in the query (with an
      // optional leading "#") is a collector-number filter, so "Ariel
      // 137" hones in on Ariel #137 instead of matching nothing; the
      // remaining words stay a name substring match. A bare number on
      // its own searches by collector number alone.
      const tokens = needle
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.replace(/^#/, ""));
      const numberTokens = tokens.filter((t) => /^\d+$/.test(t));
      const nameNeedle = tokens
        .filter((t) => !/^\d+$/.test(t))
        .join(" ");
      const numberFilter =
        numberTokens.length > 0
          ? parseInt(numberTokens[numberTokens.length - 1] as string, 10)
          : null;
      const rows = await db
        .select()
        .from(schema.cards)
        .orderBy(asc(schema.cards.groupSort), asc(schema.cards.slotSort));
      const matches = rows
        .filter((row) => {
          if (nameNeedle && !row.fullName.toLowerCase().includes(nameNeedle))
            return false;
          if (numberFilter != null && row.number !== numberFilter)
            return false;
          return true;
        })
        .slice(0, 40);
      const positionByGroup = new Map<string, number>();
      const positionOf = new Map<number, number>();
      for (const row of rows) {
        const pos = positionByGroup.get(row.groupKey) ?? 0;
        positionOf.set(row.id, pos);
        positionByGroup.set(row.groupKey, pos + 1);
      }
      return {
        results: matches.map((row) => ({
          cardId: row.id,
          fullName: row.fullName,
          groupKey: row.groupKey,
          groupName: row.groupName,
          printed: row.printed,
          ownedQty: row.ownedQty,
          position: positionOf.get(row.id) ?? 0,
          rarity: row.rarity,
          finishes: parseFinishes(row.finishes),
          marketValue: row.marketValue,
          suggestedFinish: (() => {
            const pockets = pocketsOf(row);
            if (pockets.length === 1) return pockets[0]?.label ?? "Regular";
            return (
              pockets.find((pk) => pk.kind === "regular")?.label ?? "Regular"
            );
          })(),
        })),
      };
    },
  }),
} satisfies ActionsModule;
