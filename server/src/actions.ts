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
import { and, asc, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";
import { catalog } from "./data/catalog";
import { puzzleCatalog } from "./data/puzzleCatalog";
import { catalogExtras } from "./data/catalogExtras";
import type { CatalogEntry } from "./data/catalogTypes";
import { ownership } from "./data/ownership";
import { cardHistory } from "./data/cardHistory";
import { sealedHistory } from "./data/sealedHistory";
import { catalogPrices, PRICE_SNAPSHOT_DATE } from "./data/catalogPrices";
import { promoPrices } from "./data/promoPrices";
import {
  ebaySoldPrices,
  EBAY_SOLD_WINDOW_END,
  EBAY_SOLD_WINDOW_LABEL,
} from "./data/ebaySoldPrices";
import {
VILLAGE_AGGRO_DECK_NAME,
VILLAGE_AGGRO_LIST,
} from "./data/villageAggroDeck";
import { tcgplayerBackfill } from "./data/tcgplayerBackfill";
import {
exportBySet,
extraSealedItems,
historySeed,
nonBinderTotals,
sealedItems
} from "./data/exportFinance";

/** The full binder catalog: the LorcanaJSON snapshot plus the
    hand-authored puzzle/lore insert entries (data/puzzleCatalog.ts)
    and the audited promo additions (data/catalogExtras.ts), which
    the upstream catalog does not carry. Seeding and the catalog
    sync use this combined list; the binder, search, and scan
    matching all read the seeded rows from the database. */
const fullCatalog: CatalogEntry[] = [
  ...catalog,
  ...puzzleCatalog,
  ...catalogExtras,
];

/** Every sealed item the app knows: the Shiny-export items plus
    Anthony's hand-sourced additions (extraSealedItems — currently
    the Japanese-edition First Chapter pack, priced from SNKRDUNK
    rather than TCGplayer/Shiny). All sealed reads go through this
    merged list so the additions get the same shelf, detail, totals,
    and price-alert treatment as the export items. */
const allSealedItems = [...sealedItems, ...extraSealedItems];

/** Graded comics, mirrored from the client's COMICS catalog
    (client/src/comics.tsx) so price alerts can target a comic and
    resolve its current value server-side: the same 8 CGC slabs
    logged from Anthony's label photos on Oct 29, 2026, at the same
    Oct 29, 2026 checked values (eBay sold prices via PriceCharting,
    plus guide data — estimates, not live prices). Keep in step
    with the client catalog if a slab's checked value changes. */
const COMIC_ALERT_CATALOG: {
  id: string;
  title: string;
  publisher: string;
  value: number;
}[] = [
  { id: "aliens-1", title: "Aliens #1", publisher: "Dark Horse Comics", value: 1250 },
  { id: "batman-136", title: "Batman #136", publisher: "DC Comics", value: 400 },
  { id: "wolverine-154", title: "Wolverine #154", publisher: "Marvel Comics", value: 95 },
  {
    id: "mandalorian-4",
    title: "Star Wars: The Mandalorian #4",
    publisher: "Marvel Comics",
    value: 65,
  },
  { id: "venom-31-2021", title: "Venom #31 (2021)", publisher: "Marvel Comics", value: 50 },
  { id: "wolverine-21", title: "Wolverine #21", publisher: "Marvel Comics", value: 45 },
  { id: "venom-31-2024", title: "Venom #31 (2024)", publisher: "Marvel Comics", value: 35 },
  {
    id: "deadpool-wolverine-3",
    title: "Deadpool & Wolverine: WWIII #3",
    publisher: "Marvel Comics",
    value: 30,
  },
];

const PAGE_SIZE = 12; // 4 across x 3 down, like his Vault X binder pages

/** Artwork cache generation (Anthony, Nov 3, 2026 — the up-front
    artwork rule): the client keeps every card's browsing artwork
    saved on the device in a versioned Cache Storage cache and a
    background warm-up fills it (own collection first, then the
    wider catalog set by set). When artwork itself is replaced —
    a re-scan, a restyle pass like the sealed acrylic updates —
    bump BOTH this version and the client's CACHE_NAME in
    client/src/artCache.ts to the next generation: the client
    sees the new version, deletes the old cache, and re-warms, so
    nobody keeps stale art. Sealed / comic / set-logo artwork is
    bundled with the app build itself (content-hashed files), so
    an app update already replaces those bytes directly. */
const ARTWORK_VERSION = "art-v2";

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
  // Appended Nov 3, 2026 (catalog audit-and-fill): new families go
  // at the END so the group sorts of the families above — already
  // stored on seeded rows — never shift.
  "C3",
  "CC2",
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

/** A stored blob key whose bytes are missing from blob storage
    (a copied or restored database can reference a photo or art
    blob that is not in this store) must never take a whole
    action down with it: getUrl throws on a missing key, so read
    URLs through this — missing bytes read as "no image", and
    the UI falls back to its imageless state. */
async function safeBlobUrl(ctx: Ctx, key: string): Promise<string | null> {
  try {
    return await ctx.blobs.getUrl(key);
  } catch {
    return null;
  }
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
  /** Assembled-from-pieces artwork for a Full Puzzle Art
      entry that has no published assembled image: the piece
      cards' ids in reading order and the grid columns (2 or
      3), so the client can join the set's own piece scans
      into the completed artwork. Null everywhere else. */
  composite: z
    .object({ cols: z.number(), pieceIds: z.array(z.number()) })
    .nullable(),
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

/** Pocket labels that ARE finish keys (used by
    adjustPocketCount to name the finish of an unowned
    single pocket, whose finishes record is still empty). */
const POCKET_FINISH_LABELS = new Set([
  "Regular",
  "Promo",
  ...FOIL_FINISHES,
]);

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
        label:
          row.rarity === "Lore"
            ? "Lore"
            : row.rarity === "Counter"
              ? "Counter"
              : "Puzzle",
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

/** Full Puzzle Art assembly (Anthony, Nov 4, 2026): a set's
    Full entry whose assembled photo exists in a legitimate
    source keeps that photo. Where NO assembled image exists
    anywhere (Hyperia City — its "Set of 9" product has no
    image on TCGplayer's CDN) the entry is assembled from
    the set's own piece scans, joined in reading order.
    Only true puzzle sets qualify, and only with a complete
    imaged piece set (9 for a 3x3, 4 for a 2x2): lore-card
    sets are excluded because their pictures live on the
    card BACKS and only front scans exist, and Shimmering
    Skies' pieces have no scans at all — those Full entries
    stay honestly imageless rather than show a wrong grid. */
const FULL_PUZZLE_COMPOSITES = ((): Map<
  string,
  { cols: number; pieceUids: string[] }
> => {
  const map = new Map<string, { cols: number; pieceUids: string[] }>();
  const bySet = new Map<string, typeof puzzleCatalog>();
  for (const e of puzzleCatalog) {
    const arr = bySet.get(e.setCode) ?? [];
    arr.push(e);
    bySet.set(e.setCode, arr);
  }
  for (const [setCode, entries] of bySet) {
    const full = entries.find((e) => e.uid === `puzzle:${setCode}:full`);
    if (!full || full.image) continue;
    const pieces = entries
      .filter((e) => e.type === "Puzzle" && e.image != null)
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    const cols = pieces.length === 9 ? 3 : pieces.length === 4 ? 2 : 0;
    if (cols === 0) continue;
    map.set(full.uid, { cols, pieceUids: pieces.map((e) => e.uid) });
  }
  return map;
})();

function compositeForRow(
  row: typeof schema.cards.$inferSelect,
  siblings: (typeof schema.cards.$inferSelect)[],
): { cols: number; pieceIds: number[] } | null {
  if (row.imageUrl != null) return null;
  const spec = FULL_PUZZLE_COMPOSITES.get(row.uid);
  if (!spec) return null;
  const idByUid = new Map(siblings.map((r) => [r.uid, r.id]));
  const pieceIds = spec.pieceUids
    .map((u) => idByUid.get(u))
    .filter((id): id is number => id != null);
  if (pieceIds.length !== spec.pieceUids.length) return null;
  return { cols: spec.cols, pieceIds };
}

function toLite(
  row: typeof schema.cards.$inferSelect,
  pocket: Pocket,
  composite: CardLite["composite"] = null,
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
    composite,
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
    const composite = compositeForRow(row, rows);
    for (const pocket of pocketsOf(row)) {
      if (filter === "owned" && pocket.qty <= 0) continue;
      if (filter === "missing" && pocket.qty > 0) continue;
      out.push(toLite(row, pocket, composite));
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

/** Builds the cards-table row for one catalog entry at a given
    slot position — the exact shape seedBinder writes, shared by
    the catalog sync/save actions below so every insert path
    produces identical rows. Ownership comes from the Nov 1 2026
    export map (absent = starts unowned, ghosted). */
function catalogRowOf(
  entry: CatalogEntry,
  slotSort: number,
): typeof schema.cards.$inferInsert {
  const own = ownership[entry.uid];
  return {
    uid: entry.uid,
    grp: entry.grp,
    groupKey: groupKeyOf(entry),
    groupName: entry.setName,
    groupLabel: groupLabelOf(entry),
    groupSort: groupSortOf(entry),
    slotSort,
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
  };
}

/** Inserts every fullCatalog entry whose uid has no cards row
    yet, slotted exactly where a fresh seed would put it (group
    order by collector number, then name). Existing rows — and
    every ownership count and price on them — are never touched;
    new rows start unowned. Shared by seedBinder's additions path,
    syncCatalogAdditions, and saveCatalogAdditions (the daily
    catalog audit). Returns the inserted rows' group keys and
    counts. */
async function insertMissingCatalogEntries(
  ctx: Ctx,
  entries: CatalogEntry[],
): Promise<{ inserted: number; groups: { groupKey: string; count: number }[] }> {
  const db = ctx.db<typeof schema>();
  const existing = await db.select({ uid: schema.cards.uid }).from(schema.cards);
  const existingUids = new Set(existing.map((r) => r.uid));
  const fresh = entries.filter((e) => !existingUids.has(e.uid));
  if (fresh.length === 0) return { inserted: 0, groups: [] };
  // Slot positions are computed against the FULL catalog group
  // (bundled entries included), matching a fresh seed's order.
  const byGroup = new Map<string, CatalogEntry[]>();
  for (const entry of fullCatalog) {
    const key = groupKeyOf(entry);
    const list = byGroup.get(key) ?? [];
    list.push(entry);
    byGroup.set(key, list);
  }
  const freshUids = new Set(fresh.map((e) => e.uid));
  const rows: (typeof schema.cards.$inferInsert)[] = [];
  const groupCounts = new Map<string, number>();
  for (const list of byGroup.values()) {
    const sorted = [...list].sort((a, b) => {
      const na = a.number ?? 99999;
      const nb = b.number ?? 99999;
      if (na !== nb) return na - nb;
      return (a.fullName ?? "").localeCompare(b.fullName ?? "");
    });
    sorted.forEach((entry, idx) => {
      if (!freshUids.has(entry.uid)) return;
      rows.push(catalogRowOf(entry, idx));
      const key = groupKeyOf(entry);
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    });
  }
  // Entries the daily audit supplies that are not part of the
  // bundled fullCatalog still get in, appended at the end of
  // their group in the order supplied.
  const slotted = new Set(rows.map((r) => r.uid));
  const tailByGroup = new Map<string, number>();
  for (const entry of fresh) {
    if (slotted.has(entry.uid)) continue;
    const key = groupKeyOf(entry);
    const base = (byGroup.get(key) ?? []).length;
    const offset = tailByGroup.get(key) ?? 0;
    tailByGroup.set(key, offset + 1);
    rows.push(catalogRowOf(entry, base + offset));
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }
  for (let i = 0; i < rows.length; i += 250) {
    await db.insert(schema.cards).values(rows.slice(i, i + 250));
  }
  return {
    inserted: rows.length,
    groups: [...groupCounts.entries()].map(([groupKey, count]) => ({
      groupKey,
      count,
    })),
  };
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
  // Most promo printings carry no TCGplayer id in the catalog,
  // and the ones that do (CC1, some PD1) are absent from the
  // Lorcast-derived catalog snapshot above — so fall back to
  // the uid-keyed promo snapshot (data/promoPrices.ts: Lorcast
  // prices, plus a TCGplayer pricepoints pull for CC1/PD1).
  // This is what prices the promo tiles' Cost to complete;
  // printings absent there are genuinely untracked and stay
  // null. Most promos exist in a single finish (usually foil),
  // so when the pocket's own finish has no price the printing's
  // other finish price is the printing's market price.
  const promoSnap = promoPrices[row.uid];
  if (promoSnap) {
    const v = foil
      ? (promoSnap.usdFoil ?? promoSnap.usd)
      : (promoSnap.usd ?? promoSnap.usdFoil);
    if (v != null) return v;
  }
  // eBay SOLD fallback (Anthony, Nov 4, 2026 — his price
  // hierarchy: TCGplayer #1, eBay sold #2): printings no
  // TCGplayer-basis source prices at all take the median
  // of recent eBay sold listings (data/ebaySoldPrices.ts).
  // One pocket per such printing, so the single median
  // serves the pocket whatever its finish.
  const ebay = ebaySoldPrices[row.id];
  if (ebay) return ebay.usd;
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
  const promoSnap = promoPrices[row.uid];
  if (promoSnap) {
    const v = foil
      ? (promoSnap.usdFoil ?? promoSnap.usd)
      : (promoSnap.usd ?? promoSnap.usdFoil);
    if (v != null && v > 0) return v;
  }
  if (row.marketValue != null && row.marketValue > 0)
    return row.marketValue;
  // eBay SOLD median, last in the chain per Anthony's
  // hierarchy (Nov 4, 2026) — see pocketPrice.
  const ebay = ebaySoldPrices[row.id];
  if (ebay) return ebay.usd;
  return null;
}

/** Whether this pocket's price came from the eBay sold
    snapshot — true only when the snapshot holds the
    printing, the price pocketPrice returned IS the
    snapshot median, and no higher source in the hierarchy
    (TCGplayer-basis snapshots) priced this pocket's finish
    branch. Drives the per-item source line and Anthony's
    staleness rule (Nov 4, 2026): once the newest sale
    behind an eBay price is more than ~90 days old, the
    price must present as a last-sold figure with its date
    visible, never dressed up as current. */
function ebayAttribution(
  row: typeof schema.cards.$inferSelect,
  pocket: Pocket,
  price: number | null,
): { stale: boolean; lastSoldMonth: string } | null {
  const ebay = ebaySoldPrices[row.id];
  if (!ebay || price == null || price !== ebay.usd) return null;
  const foil = pocketIsFoil(row, pocket);
  const snap = catalogPrices[row.uid];
  if (snap) {
    const v = foil
      ? (snap.usdFoil ?? snap.usd)
      : (snap.usd ?? snap.usdFoil);
    if (v != null) return null;
  }
  const promoSnap = promoPrices[row.uid];
  if (promoSnap) {
    const v = foil
      ? (promoSnap.usdFoil ?? promoSnap.usd)
      : (promoSnap.usd ?? promoSnap.usdFoil);
    if (v != null) return null;
  }
  const ageDays =
    (Date.now() - Date.parse(EBAY_SOLD_WINDOW_END)) / 86_400_000;
  return { stale: ageDays > 90, lastSoldMonth: ebay.lastSoldMonth };
}

export interface MissingPocket {
  cardId: number;
  fullName: string;
  printed: string;
  rarity: string | null;
  finishLabel: string;
  price: number | null;
  tcgplayerId: string | null;
  /** "ebay-sold" when the price is the eBay sold median —
      the per-item source line renders from this. */
  priceSource: string | null;
  /** True when the eBay sale behind the price is over
      ~90 days old (the "Last sold at $X on eBay" form). */
  priceStale: boolean;
  /** The recorded sales window, e.g. "Oct 16–30, 2026". */
  priceWindow: string | null;
  /** Month of the last recorded sale, e.g. "Oct 2026". */
  priceLastSoldMonth: string | null;
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
      const price = pocketPrice(row, pocket);
      const attribution = ebayAttribution(row, pocket, price);
      missing.push({
        cardId: row.id,
        fullName: row.fullName,
        printed: row.printed,
        rarity: row.rarity,
        finishLabel: pocket.label,
        price,
        tcgplayerId: tcgIdOf(row),
        priceSource: attribution ? "ebay-sold" : null,
        priceStale: attribution?.stale ?? false,
        priceWindow: attribution ? EBAY_SOLD_WINDOW_LABEL : null,
        priceLastSoldMonth: attribution?.lastSoldMonth ?? null,
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
  /** Assembled-from-pieces artwork for a Full Puzzle Art
      entry with no published assembled image (see
      FULL_PUZZLE_COMPOSITES). Null everywhere else. */
  composite: z
    .object({ cols: z.number(), pieceIds: z.array(z.number()) })
    .nullable(),
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
  /** Sealed products on the shelf (live, current quantities). */
  sealedValue: z.number(),
  sealedQty: z.number(),
  sealedDistinct: z.number(),
  /** Portfolio ranges for the redesigned Portfolio page (Nov 3,
      2026): per range, the period change of the tracked Lorcana
      total (live value vs the snapshot on/before the range's
      start, or the FIRST tracked snapshot when the range reaches
      back past the start of tracked history — `clamped` says so,
      and baselineLabel names the day actually measured from) and
      the top movers among OWNED binder printings (per-printing
      price history vs live unit value, $ change across owned
      copies). Tracked history starts Oct 25, 2026, so until
      daily points accumulate the longer ranges share the
      Oct 25 baseline — labeled, never faked. */
  ranges: z.array(
    z.object({
      key: z.string(),
      days: z.number().nullable(),
      baselineDate: z.string(),
      baselineLabel: z.string(),
      clamped: z.boolean(),
      delta: z.number(),
      pct: z.number(),
      gainers: z.array(
        z.object({
          cardId: z.number(),
          name: z.string(),
          groupName: z.string(),
          printed: z.string().nullable(),
          rarity: z.string().nullable(),
          qty: z.number(),
          unitNow: z.number(),
          deltaTotal: z.number(),
          pct: z.number(),
        }),
      ),
      losers: z.array(
        z.object({
          cardId: z.number(),
          name: z.string(),
          groupName: z.string(),
          printed: z.string().nullable(),
          rarity: z.string().nullable(),
          qty: z.number(),
          unitNow: z.number(),
          deltaTotal: z.number(),
          pct: z.number(),
        }),
      ),
    }),
  ),
  /** Home snapshot movers (Nov 3, 2026, ~11:11 PM): the top
      three OWNED printings by absolute movement over the
      last 24 hours — live unit value vs the last tracked
      price point at least a day older than the newest one,
      same per-printing math as the range movers. A printing
      with no point at least a day old has no honest 24h
      movement and is left out. */
  movers24h: z.array(
    z.object({
      cardId: z.number(),
      name: z.string(),
      groupName: z.string(),
      printed: z.string().nullable(),
      rarity: z.string().nullable(),
      qty: z.number(),
      unitNow: z.number(),
      deltaTotal: z.number(),
      pct: z.number(),
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
    bio: null as string | null,
    theme: null as string | null,
    gridCols: null as number | null,
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
    museInviteLink: null as string | null,
    howTradesWorkHidden: 0,
    shareCollection: 1,
    hideCollectionValue: 0,
    welcomeSeen: 0,
    registeredAt: null as string | null,
    hiddenCollections: null as string | null,
    collectionOrder: null as string | null,
    usernameChangeUsed: 0,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(schema.collectorProfile).values(profile);
  return profile;
}

const collectorIdResponse = z.object({
  username: z.string(),
  collectorCode: z.string(),
  /** True only when this profile is Anthony's own (the owner).
      Answered from the local profile row alone — deliberately
      NOT from getAdminStats: the Home Admin badge gates on
      this, and getAdminStats is the app's slowest action (it
      pages the whole Supabase collection_items table, reads
      connections/trust in bulk, and estimates storage), so
      gating the badge on it made the badge take seconds to
      appear on first load (Anthony, Nov 3, 2026). The stats
      themselves stay withheld by getAdminStats as before. */
  isOwner: z.boolean(),
  photoUrl: z.string().nullable(),
  /** The optional profile banner image URL, or null when the user
      has not added one (banners are opt-in; default is none). */
  bannerUrl: z.string().nullable(),
  /** The profile bio line he saved from Edit profile, or null
      when he has never edited it. */
  bio: z.string().nullable(),
  /** The theme picked in Settings, or null when never picked (the
      default Vault Dark applies). */
  theme: z.string().nullable(),
  /** Whether the one-time TEST of the Home "Update available"
      indicator has already been tapped away. */
  updateTestSeen: z.boolean(),
  /** Whether connected friends can see this collector's
      collection (Settings > Sharing; ON by default). */
  shareCollection: z.boolean(),
  /** Whether the user's ONE username change (Settings) has
      already been used; once true the username is locked. */
  usernameChangeUsed: z.boolean(),
  /** Set-page grid density (2 or 4 across), or null when never
      picked (the default of 2 applies). */
  gridCols: z.number().nullable(),
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
    test friend (MC-JARVIS, trust 5), and a publishable-key upsert
    keyed on collector_id succeeded — so this wiring registers
    Anthony's own profile into that same live table and reads it
    back to prove it landed. (The dummy test friend that also
    lived there then was deleted Nov 3, 2026 — see
    TEST_COLLECTOR_CODES.) */
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

/** The one built-in test profile on the server — labeled as test
    data wherever the Admin stats show it, never dressed up as a
    real user. (The earlier dummy test friend, MC-TEST-DUMMY, was
    deleted outright Nov 3, 2026 at Anthony's direction — its
    registry row and its collection_items were removed from the
    server, and it is referenced nowhere in the app anymore: only
    Anthony and Jarvis remain.) */
const TEST_COLLECTOR_CODES: ReadonlySet<string> = new Set([
  JARVIS_REGISTRY_PROFILE.collector_id,
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
      /** Mean of the roster's Trust Scores, one decimal. */
      avgTrustScore: z.number(),
      /** Collectors who have at least one item logged on the
          server — the honest "active collectors" figure the
          data supports (no last-seen tracking exists). */
      collectorsWithItems: z.number(),
      roster: z.array(
        z.object({
          collectorId: z.string(),
          username: z.string(),
          trustScore: z.number(),
          /** Copies stored for this collector in collection_items. */
          itemsOwned: z.number(),
          /** This collector's CONFIRMED connections on the
              server (connections rows naming them on either
              side with status "confirmed") — shown on the
              Registered Collectors detail page. Null when the
              connections table couldn't be read, so the page
              labels the count unavailable instead of showing
              a made-up zero. */
          connections: z.number().nullable(),
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
    /** Cumulative registered collectors per day over the same
        14 days (the line graph): collectors registered before
        the window are the baseline, each day adds that day's
        new collectors. Derived from the same registry rows. */
    usersCumulative: z.array(
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
      /** Every trade ever proposed (all rows, any status). */
      tradesTotal: z.number(),
      cashPurchases: z.number(),
      cashCompleted: z.number(),
      listingsActive: z.number(),
      listingsTotal: z.number(),
      dealsCompleted: z.number(),
      pendingChangeRequests: z.number(),
      /** Change-request tickets by status (Anthony, Nov 3,
          2026 — the Admin rebuild): counted from the same
          ticket rows as pendingChangeRequests. */
      ticketsByStatus: z.object({
        open: z.number(),
        inProgress: z.number(),
        completed: z.number(),
      }),
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
  /** Admin change notifications (Anthony, Nov 3, 2026,
      1:51 PM): the metric keys whose current value differs
      from the value the owner last acknowledged by tapping
      the metric in the Admin page — the client highlights
      exactly these (translucent blue) and the Home Admin
      shield badges their count. Empty for non-owners and on
      the baseline first run. Keys: "users.total",
      "activity.totalCopies", "roster:<collectorId>",
      "mostOwned:<item name>", "tickets.status", etc. */
  changedKeys: z.array(z.string()),
  /** The same changes, made readable (Anthony, Nov 3, 2026,
      ~5:30 PM): the bare keys and the blue glow weren't
      enough — he couldn't find or read WHAT changed. One
      entry per changed key with a plain label and the
      acknowledged value -> current value, both formatted
      for reading ("12 items · trust 3"), so the badge count
      maps to exactly this many findable changes. `before`
      is null for a metric that only just appeared. */
  changes: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      before: z.string().nullable(),
      after: z.string(),
    }),
  ),
  /** Anthony's own collection, from this device's data — kept
      separate from the app-wide server numbers. */
  own: z.object({
    cardCopies: z.number(),
    distinctCards: z.number(),
    sealedQty: z.number(),
    lorcanaValue: z.number(),
  }),
  /** ISO instant this payload was computed (Admin speed fix,
      Nov 3, 2026): the Admin page labels its numbers with this
      as-of time — when it serves the stored snapshot first, this
      is the snapshot's computation time, and it updates the
      moment the live refresh lands. */
  computedAt: z.string(),
});

/** Response of getAdminStatsSnapshot — the Admin page's fast
    first paint (Nov 3, 2026): the last fully computed stats
    payload, read from ONE local row (admin_stats_cache), with
    the instant it was computed. `stats` is null when no full
    computation has ever completed on this device — the page
    then shows honest loading states, never invented numbers. */
const adminStatsSnapshotResponse = z.object({
  isOwner: z.boolean(),
  computedAt: z.string().nullable(),
  stats: adminStatsResponse.nullable(),
});

/** Plain labels for the Admin change readouts (Anthony,
    Nov 3, 2026, ~5:30 PM): what a metric key is called when
    a change is reported in words. */
function adminMetricLabel(
  key: string,
  rosterName: (code: string) => string | null,
): string {
  const fixed: Record<string, string> = {
    "users.total": "Registered users",
    "users.newThisWeek": "New collectors this week",
    "users.avgTrustScore": "Average Trust Score",
    "users.collectorsWithItems": "Collectors with items",
    "activity.totalCopies": "Total copies logged",
    "activity.totalRows": "Logged items",
    "activity.cardsLogged": "Cards logged",
    "activity.avgPerCollector": "Average items per collector",
    "activity.largest": "Largest collection",
    "social.connections": "Connections",
    "social.trustEvents": "Trust events",
    "social.confirmedTrades": "Confirmed trades",
    "deals.tradesCompleted": "Completed deals",
    "deals.tradesTotal": "Trades",
    "deals.cashPurchases": "Cash purchases",
    "deals.listingsActive": "Marketplace listings",
    "tickets.status": "Change tickets",
    "system.storedRows": "Stored rows (all collectors)",
    "own.items": "Your items",
    "own.value": "Your collection value",
  };
  if (fixed[key]) return fixed[key];
  if (key.startsWith("roster:")) {
    const code = key.slice("roster:".length);
    const name = rosterName(code);
    return name ? `@${name} — roster entry` : `Roster entry ${code}`;
  }
  if (key.startsWith("mostOwned:"))
    return `Most owned — ${key.slice("mostOwned:".length)}`;
  return key;
}

/** Formats a stored metric value for the change readout:
    the pipe-composites become readable phrases; plain
    numbers pass through as they are. */
function adminMetricValue(key: string, raw: string): string {
  const parts = raw.split("|");
  const p = (i: number) => parts[i] ?? "";
  switch (key.split(":")[0]) {
    case "roster":
      return `${p(0)} items · trust ${p(1)}`;
    case "mostOwned":
      return `${p(0)} copies · ${p(1)} owners`;
    default:
      break;
  }
  switch (key) {
    case "activity.largest":
      return `${p(0)} — ${p(1)} items`;
    case "social.connections":
      return `${p(0) || "—"} confirmed · ${p(1) || "—"} total`;
    case "deals.tradesCompleted":
      return `${p(0)} trades · ${p(1)} marketplace deals`;
    case "deals.tradesTotal":
      return `${p(0)} total · ${p(1)} proposed · ${p(2)} accepted`;
    case "deals.cashPurchases":
      return `${p(0)} total · ${p(1)} completed`;
    case "deals.listingsActive":
      return `${p(0)} active · ${p(1)} total`;
    case "tickets.status":
      return `${p(0)} open · ${p(1)} in progress · ${p(2)} completed`;
    case "own.items":
      return `${p(0)} card copies · ${p(1)} sealed`;
    case "own.value": {
      const n = Number(raw);
      return Number.isFinite(n)
        ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : raw;
    }
    default:
      return raw;
  }
}

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
    // The count request and the sample request are independent
    // (Admin speed fix, Nov 3, 2026) — they used to run one
    // after the other, doubling this phase for every table.
    const [countRes, sample] = await Promise.all([
      fetch(`${SUPABASE_PROJECT_URL}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      }),
      supabaseRest(`${table}?select=*&limit=100`),
    ]);
    const range = countRes.headers.get("content-range");
    const total = range
      ? Number.parseInt(range.split("/")[1] ?? "", 10)
      : Number.NaN;
    if (!Number.isFinite(total)) return null;
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
  // profiles table next to MC-JARVIS).
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

/** ----- Trade / cash auto-settlement (Anthony, Nov 3, 2026,
    ~5:17 PM) -----
    When a trade (or cash purchase) is FULLY complete — both
    sides confirmed AND both sides' feedback in, or the
    7-day neutral close has passed — the agreed card lists
    settle into the collections automatically: each side's
    given copies come out, their received copies go in, with
    no re-entry. Received copies get NO Where-it-lives row
    (unassigned is the default) and the deal row itself,
    with its stored settlement plan, is the record of where
    they came from. Given copies come out of the exact
    printing + finish the deal committed.

    Atomicity across the two stores (the local binder DB
    and the counterparty's cloud collection_items rows):
    the first attempt computes a PLAN of absolute targets —
    per-card finish maps for the local binder, absolute
    cloud rows for the counterparty — and stores it on the
    deal row. Applying writes the cloud targets first (they
    are absolute upserts/deletes, so a replay changes
    nothing twice), then the local card updates and the
    settled_at stamp land in ONE db.batch — the local side
    is atomic. If the cloud write fails, settled_at stays
    null and the next trigger (a later feedback, or the
    read-path sweep in getTrades / getCashPurchases, the
    same retry-on-read pattern the Trust ledger uses)
    replays the stored plan verbatim. */

type SettlementItem = { cardId: number; finish: string; qty: number };

type SettlementPlan = {
  v: 1;
  /** Human source note, e.g. "Trade #12" — the deal is the
      received cards' source record. */
  source: string;
  /** Absolute per-card finish targets for the LOCAL binder. */
  localCards: {
    cardId: number;
    finishes: Record<string, number>;
    ownedQty: number;
  }[];
  /** The counterparty's collector code (cloud side). */
  cloudOwner: string;
  cloudUpserts: CloudItemRow[];
  cloudDeletes: string[];
  /** What actually moved, after availability clamping, for
      the record: one line per item per side. */
  applied: {
    who: "me" | "them";
    move: "gave" | "received";
    name: string;
    finish: string;
    qty: number;
  }[];
};

function parseSettlementItems(raw: string): SettlementItem[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: SettlementItem[] = [];
    for (const it of v) {
      if (typeof it !== "object" || it === null) continue;
      const r = it as Record<string, unknown>;
      if (
        typeof r.cardId === "number" &&
        typeof r.finish === "string" &&
        typeof r.qty === "number" &&
        r.qty > 0
      ) {
        out.push({ cardId: r.cardId, finish: r.finish, qty: r.qty });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Computes (but does not apply) a settlement plan. Local
    targets come from the live binder rows; cloud targets
    from the counterparty's current cloud rows — both as
    absolute end states, so the stored plan can be replayed
    verbatim after any partial failure. Returns null when
    the counterparty's cloud rows can't be read (settlement
    waits for a later retry rather than guessing). */
async function buildSettlementPlan(
  ctx: Ctx,
  args: {
    source: string;
    myGive: SettlementItem[];
    myGet: SettlementItem[];
    otherCode: string;
    theirGive: SettlementItem[];
    theirGet: SettlementItem[];
  },
): Promise<SettlementPlan | null> {
  const db = ctx.db<typeof schema>();
  const cardRows = await db.select().from(schema.cards);
  const cardById = new Map(cardRows.map((c) => [c.id, c]));
  const applied: SettlementPlan["applied"] = [];
  // Local side: absolute finish targets per involved card.
  const localCards: SettlementPlan["localCards"] = [];
  const involvedLocal = new Set<number>([
    ...args.myGive.map((i) => i.cardId),
    ...args.myGet.map((i) => i.cardId),
  ]);
  for (const cardId of involvedLocal) {
    const card = cardById.get(cardId);
    if (!card) continue;
    const finishes = parseFinishes(card.finishes);
    const eff: Record<string, number> =
      Object.keys(finishes).length > 0
        ? { ...finishes }
        : card.ownedQty > 0
          ? { Regular: card.ownedQty }
          : {};
    for (const it of args.myGive.filter((i) => i.cardId === cardId)) {
      const avail = eff[it.finish] ?? 0;
      const moved = Math.min(avail, it.qty);
      eff[it.finish] = avail - moved;
      applied.push({
        who: "me",
        move: "gave",
        name: card.fullName,
        finish: it.finish,
        qty: moved,
      });
    }
    for (const it of args.myGet.filter((i) => i.cardId === cardId)) {
      eff[it.finish] = (eff[it.finish] ?? 0) + it.qty;
      applied.push({
        who: "me",
        move: "received",
        name: card.fullName,
        finish: it.finish,
        qty: it.qty,
      });
    }
    const clean: Record<string, number> = {};
    let total = 0;
    for (const [f, q] of Object.entries(eff)) {
      if (q > 0) {
        clean[f] = q;
        total += q;
      }
    }
    localCards.push({ cardId, finishes: clean, ownedQty: total });
  }
  // Cloud side: the counterparty's absolute row targets.
  const theirRows = await fetchCloudItems(args.otherCode);
  if (theirRows == null) return null;
  const theirQty = new Map<string, number>();
  for (const r of theirRows) theirQty.set(r.item_key, r.qty);
  const cloudDelta = new Map<string, { card: (typeof cardRows)[number]; finish: string; d: number }>();
  const bumpCloud = (items: SettlementItem[], sign: 1 | -1) => {
    for (const it of items) {
      const card = cardById.get(it.cardId);
      if (!card) continue;
      const key = cloudCardItemKey(card.uid, it.finish);
      const cur = cloudDelta.get(key) ?? { card, finish: it.finish, d: 0 };
      cur.d += sign * it.qty;
      cloudDelta.set(key, cur);
    }
  };
  bumpCloud(args.theirGive, -1);
  bumpCloud(args.theirGet, 1);
  const cloudUpserts: CloudItemRow[] = [];
  const cloudDeletes: string[] = [];
  for (const [key, { card, finish, d }] of cloudDelta) {
    if (d === 0) continue;
    const target = Math.max(0, (theirQty.get(key) ?? 0) + d);
    if (target > 0) {
      cloudUpserts.push({
        owner_collector_id: args.otherCode,
        item_key: key,
        display_name:
          finish === "Regular"
            ? card.fullName
            : `${card.fullName} (${finish})`,
        qty: target,
        kind: "card",
        meta: {
          uid: card.uid,
          finish,
          set: card.groupName,
          number: card.printed,
          rarity: card.rarity ?? null,
        },
      });
    } else if (theirQty.has(key)) {
      cloudDeletes.push(key);
    }
    applied.push({
      who: "them",
      move: d < 0 ? "gave" : "received",
      name: card.fullName,
      finish,
      qty: Math.abs(d),
    });
  }
  return {
    v: 1,
    source: args.source,
    localCards,
    cloudOwner: args.otherCode,
    cloudUpserts,
    cloudDeletes,
    applied,
  };
}

/** Applies a stored plan: cloud targets first (absolute —
    replay-safe), then the local card updates and the
    settled stamp in one atomic batch, then the local cloud
    backup mirror for the changed cards (best-effort, the
    established syncCardToCloud path). False = the cloud
    side didn't land; the caller leaves settled_at null and
    a later trigger replays the same plan. */
async function applySettlementPlan(
  ctx: Ctx,
  kind: "trade" | "cash",
  dealId: number,
  plan: SettlementPlan,
): Promise<boolean> {
  if (plan.cloudUpserts.length > 0) {
    if (!(await upsertCloudItems(plan.cloudUpserts))) return false;
  }
  if (plan.cloudDeletes.length > 0) {
    if (!(await deleteCloudItems(plan.cloudOwner, plan.cloudDeletes)))
      return false;
  }
  const db = ctx.db<typeof schema>();
  const now = new Date().toISOString();
  const cardUpdates = plan.localCards.map((t) =>
    db
      .update(schema.cards)
      .set({
        finishes: JSON.stringify(t.finishes),
        ownedQty: t.ownedQty,
      })
      .where(eq(schema.cards.id, t.cardId)),
  );
  const stamp =
    kind === "trade"
      ? db
          .update(schema.tradeOffers)
          .set({ settledAt: now, updatedAt: now })
          .where(eq(schema.tradeOffers.id, dealId))
      : db
          .update(schema.cashPurchases)
          .set({ settledAt: now, updatedAt: now })
          .where(eq(schema.cashPurchases.id, dealId));
  const stmts: unknown[] = [...cardUpdates, stamp];
  await db.batch(
    stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );
  for (const t of plan.localCards) {
    const rows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, t.cardId))
      .limit(1);
    if (rows[0]) await syncCardToCloud(ctx, rows[0]);
  }
  return true;
}

/** Settles one trade when its completion point has been
    reached: accepted, both sides confirmed (completedAt
    set), not yet settled, and the feedback step finished —
    both sides rated, or the 7-day neutral close passed.
    Best-effort by design: any failure leaves the deal
    unsettled for the next trigger to retry. */
async function settleTradeIfReady(
  ctx: Ctx,
  trade: typeof schema.tradeOffers.$inferSelect,
): Promise<void> {
  try {
    if (
      trade.status !== "accepted" ||
      !trade.completedAt ||
      trade.settledAt
    )
      return;
    const profile = await ensureCollectorProfile(ctx);
    const me = profile.collectorCode;
    if (trade.proposerCode !== me && trade.partnerCode !== me) return;
    const db = ctx.db<typeof schema>();
    const fbs = await db
      .select()
      .from(schema.tradeFeedback)
      .where(eq(schema.tradeFeedback.tradeId, trade.id));
    const bothRated =
      fbs.some((f) => f.fromCode === trade.proposerCode) &&
      fbs.some((f) => f.fromCode === trade.partnerCode);
    const neutralClosed =
      Date.now() - Date.parse(trade.completedAt) > FEEDBACK_WINDOW_MS;
    if (!bothRated && !neutralClosed) return;
    let plan: SettlementPlan | null = null;
    if (trade.settlementJson) {
      try {
        plan = JSON.parse(trade.settlementJson) as SettlementPlan;
      } catch {
        plan = null;
      }
    }
    if (!plan) {
      const give = parseSettlementItems(trade.giveJson);
      const get = parseSettlementItems(trade.getJson);
      const iAmProposer = trade.proposerCode === me;
      plan = await buildSettlementPlan(ctx, {
        source: `Trade #${trade.id}`,
        myGive: iAmProposer ? give : get,
        myGet: iAmProposer ? get : give,
        otherCode: iAmProposer ? trade.partnerCode : trade.proposerCode,
        theirGive: iAmProposer ? get : give,
        theirGet: iAmProposer ? give : get,
      });
      if (!plan) return;
      await db
        .update(schema.tradeOffers)
        .set({
          settlementJson: JSON.stringify(plan),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.tradeOffers.id, trade.id));
    }
    await applySettlementPlan(ctx, "trade", trade.id, plan);
  } catch {
    // Settlement retries on the next trigger; a hiccup here
    // must never break the read or feedback that called it.
  }
}

/** The cash-purchase twin of settleTradeIfReady: the bought
    copies move seller -> buyer at the same completion point. */
async function settleCashIfReady(
  ctx: Ctx,
  purchase: typeof schema.cashPurchases.$inferSelect,
): Promise<void> {
  try {
    if (
      purchase.status !== "accepted" ||
      !purchase.completedAt ||
      purchase.settledAt
    )
      return;
    const profile = await ensureCollectorProfile(ctx);
    const me = profile.collectorCode;
    if (purchase.buyerCode !== me && purchase.sellerCode !== me) return;
    const db = ctx.db<typeof schema>();
    const fbs = await db
      .select()
      .from(schema.cashFeedback)
      .where(eq(schema.cashFeedback.purchaseId, purchase.id));
    const bothRated =
      fbs.some((f) => f.fromCode === purchase.buyerCode) &&
      fbs.some((f) => f.fromCode === purchase.sellerCode);
    const neutralClosed =
      Date.now() - Date.parse(purchase.completedAt) > FEEDBACK_WINDOW_MS;
    if (!bothRated && !neutralClosed) return;
    let plan: SettlementPlan | null = null;
    if (purchase.settlementJson) {
      try {
        plan = JSON.parse(purchase.settlementJson) as SettlementPlan;
      } catch {
        plan = null;
      }
    }
    if (!plan) {
      const line: SettlementItem[] = [
        { cardId: purchase.cardId, finish: purchase.finish, qty: purchase.qty },
      ];
      const iAmBuyer = purchase.buyerCode === me;
      plan = await buildSettlementPlan(ctx, {
        source: `Cash purchase #${purchase.id}`,
        myGive: iAmBuyer ? [] : line,
        myGet: iAmBuyer ? line : [],
        otherCode: iAmBuyer ? purchase.sellerCode : purchase.buyerCode,
        theirGive: iAmBuyer ? line : [],
        theirGet: iAmBuyer ? [] : line,
      });
      if (!plan) return;
      await db
        .update(schema.cashPurchases)
        .set({
          settlementJson: JSON.stringify(plan),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.cashPurchases.id, purchase.id));
    }
    await applySettlementPlan(ctx, "cash", purchase.id, plan);
  } catch {
    // Same retry-on-next-trigger rule as trades.
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
  /** The deck box's body color id, null when never picked. */
  color: z.string().nullable(),
  /** The owner's picked featured card id for the box's
      front window, null when unpicked. */
  featuredCardId: z.number().nullable(),
  /** The card the box's front window actually shows: the
      owner's pick when it is in the deck, else the deck's
      signature card (highest market value). Null only for
      an empty deck (which cannot be saved, so in practice
      always present). */
  featured: z
    .object({ cardId: z.number(), fullName: z.string() })
    .nullable(),
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
  /** Copy attribution (Anthony, Nov 3, 2026 — copy-a-deck):
      who this deck was copied from, when it was. Nulls on
      decks the owner built themselves. */
  copiedFromCode: z.string().nullable(),
  copiedFromUsername: z.string().nullable(),
  sourceDeckName: z.string().nullable(),
  /** The deck's value drawn from the OWNER's own inventory
      (Anthony, Nov 3, 2026): each line priced at the value
      the owner's collection itself carries for that printing
      (the quantity-weighted per-copy market value of the
      copies they own), times the deck quantity — NOT a
      buy-it-new cost. Lines whose printing carries no
      tracked value are excluded and counted in
      unpricedCards. Only meaningful on the owner's own
      decks; the client shows it there only. */
  inventoryValue: z.number(),
  unpricedCards: z.number(),
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
  let inventoryValue = 0;
  let unpricedCards = 0;
  let signature: { cardId: number; fullName: string } | null = null;
  let signatureValue = -1;
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
    const v = card.marketValue ?? 0;
    if (v > signatureValue) {
      signatureValue = v;
      signature = { cardId: card.id, fullName: card.fullName };
    }
    // Inventory value (see the deckView field note): the
    // owner's own per-copy figure for this printing, times
    // the deck's quantity of it.
    const unit = card.marketValue ?? cardFinishMarketValue(card, "Regular");
    if (unit != null && unit > 0) {
      inventoryValue += unit * line.qty;
    } else {
      unpricedCards += line.qty;
    }
  }
  cards.sort((a, b) => a.fullName.localeCompare(b.fullName));
  const picked =
    row.featuredCardId != null
      ? cards.find((c) => c.cardId === row.featuredCardId)
      : undefined;
  return {
    id: row.id,
    name: row.name,
    displayed: row.displayed > 0,
    color: row.color ?? null,
    featuredCardId: row.featuredCardId ?? null,
    featured: picked
      ? { cardId: picked.cardId, fullName: picked.fullName }
      : signature,
    totalCards,
    inks: [...inks],
    cards,
    copiedFromCode: row.copiedFromCode ?? null,
    copiedFromUsername: row.copiedFromUsername ?? null,
    sourceDeckName: row.sourceDeckName ?? null,
    inventoryValue: Math.round(inventoryValue * 100) / 100,
    unpricedCards,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Current unit price for one printing as a deck line prices it
    (copy-a-deck check, Nov 3, 2026): deck lines name a printing,
    not a finish, so the price is the printing's tracked value —
    the Regular finish's tracked price when there is one, else
    any tracked finish price for the printing, else the Lorcast
    snapshot price for its TCGplayer id, else the stored
    weighted market value, else null (genuinely untracked —
    the check discloses those instead of guessing). Mirrors the
    fallback chain the completion views use. */
function printingUnitPrice(
  row: typeof schema.cards.$inferSelect,
): number | null {
  const prices = parseFinance(row.financeJson);
  const reg = prices["Regular"]?.value;
  if (reg != null && reg > 0) return reg;
  for (const p of Object.values(prices)) {
    if (p.value > 0) return p.value;
  }
  const tcgId = tcgIdOf(row);
  const snap = tcgId ? catalogPrices[tcgId] : undefined;
  if (snap?.usd != null && snap.usd > 0) return snap.usd;
  const promoSnap = promoPrices[row.uid];
  if (promoSnap?.usd != null && promoSnap.usd > 0) return promoSnap.usd;
  if (promoSnap?.usdFoil != null && promoSnap.usdFoil > 0)
    return promoSnap.usdFoil;
  if (row.marketValue != null && row.marketValue > 0)
    return row.marketValue;
  return null;
}

/** One line of a deck-vs-collection check (copy-a-deck,
    Nov 3, 2026): how many copies the deck needs, how many the
    checker owns (FULL owned quantities — the deck-building
    rule, never trade availability), and the shortfall. */
const deckCheckLine = z.object({
  cardId: z.number(),
  fullName: z.string(),
  printed: z.string(),
  groupName: z.string(),
  rarity: z.string().nullable(),
  needs: z.number(),
  owned: z.number(),
  shortfall: z.number(),
  /** Current price per missing copy, null when untracked. */
  unitPrice: z.number().nullable(),
  tcgplayerId: z.string().nullable(),
});

/** A deck checked against the checker's own collection:
    the headline totals, the per-card breakdown, the buy list
    (just the missing copies), and the estimated cost of those
    missing copies at current prices — the same honesty rule
    as the set tiles' "Cost to complete" (unpriced copies are
    counted and disclosed, never priced by guessing). */
const deckCheck = z.object({
  deckTotal: z.number(),
  haveTotal: z.number(),
  needTotal: z.number(),
  lines: z.array(deckCheckLine),
  buyList: z.array(deckCheckLine),
  /** Estimated cost of the missing copies at current prices. */
  estimatedCost: z.number(),
  /** Missing copies with no tracked price (excluded above). */
  unpricedMissing: z.number(),
});

type DeckCheck = z.infer<typeof deckCheck>;

/** Runs a deck list against the signed-in collector's OWN
    collection at full owned quantities. */
async function checkDeckLines(
  ctx: Ctx,
  lines: { cardId: number; qty: number }[],
): Promise<DeckCheck> {
  const db = ctx.db<typeof schema>();
  const out: z.infer<typeof deckCheckLine>[] = [];
  let deckTotal = 0;
  let haveTotal = 0;
  let estimatedCost = 0;
  let unpricedMissing = 0;
  for (const line of lines) {
    const rows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, line.cardId))
      .limit(1);
    const card = rows[0];
    if (!card) continue;
    const owned = card.ownedQty;
    const shortfall = Math.max(0, line.qty - owned);
    const unitPrice = shortfall > 0 ? printingUnitPrice(card) : null;
    if (shortfall > 0) {
      if (unitPrice != null) estimatedCost += unitPrice * shortfall;
      else unpricedMissing += shortfall;
    }
    deckTotal += line.qty;
    haveTotal += Math.min(line.qty, owned);
    out.push({
      cardId: card.id,
      fullName: card.fullName,
      printed: card.printed,
      groupName: card.groupName,
      rarity: card.rarity,
      needs: line.qty,
      owned,
      shortfall,
      unitPrice,
      tcgplayerId: tcgIdOf(card),
    });
  }
  out.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    deckTotal,
    haveTotal,
    needTotal: deckTotal - haveTotal,
    lines: out,
    buyList: out.filter((l) => l.shortfall > 0),
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    unpricedMissing,
  };
}

/** The built-in test friend's one displayed deck (copy-a-deck,
    Nov 3, 2026): Jarvis is the only other collector in the app,
    and his side of every social feature runs on his known stock
    (the same three printings as JARVIS_TRADE_STOCK server-side
    and JARVIS_FRIEND_CARDS client-side) — his displayed deck is
    built from exactly those copies, nothing invented beyond
    them, so another collector can open it, copy it, and check
    it against their own collection like any displayed deck.
    Its id is a stable negative sentinel (real deck ids are
    positive), so copyDeck can tell it apart from a stored row. */
const JARVIS_DECK_ID = -1;
/** Pinned to the same exact printings as JARVIS_TRADE_STOCK
    (Nov 3, 2026): resolving by name alone silently picked
    whichever printing the catalog returned first, which is
    how his deck and his collection could disagree with his
    actual stock. */
const JARVIS_DECK_LINES: { cardId: number; qty: number }[] = [
  { cardId: 115, qty: 1 },
  { cardId: 1996, qty: 1 },
  { cardId: 688, qty: 2 },
];
const JARVIS_DECK_NAME = "Jarvis Test Deck";
const JARVIS_DECK_COLOR = "royal";

/** Resolves the test friend's deck lines to catalog card ids
    (the lines are pinned by card id already — this just drops
    any whose printing has left the catalog). */
async function jarvisDeckCardLines(
  ctx: Ctx,
): Promise<{ cardId: number; qty: number }[]> {
  const db = ctx.db<typeof schema>();
  const out: { cardId: number; qty: number }[] = [];
  for (const want of JARVIS_DECK_LINES) {
    const rows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, want.cardId))
      .limit(1);
    const card = rows[0];
    if (card) out.push({ cardId: card.id, qty: want.qty });
  }
  return out;
}

/** The test friend's displayed deck as a deckView (built from
    its resolved lines, same shape as a stored deck's view). */
async function jarvisDeckView(
  ctx: Ctx,
): Promise<z.infer<typeof deckView> | null> {
  const lines = await jarvisDeckCardLines(ctx);
  if (lines.length === 0) return null;
  const db = ctx.db<typeof schema>();
  const cards = [];
  const inks = new Set<string>();
  let totalCards = 0;
  let signature: { cardId: number; fullName: string } | null = null;
  let signatureValue = -1;
  for (const line of lines) {
    const rows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, line.cardId))
      .limit(1);
    const card = rows[0];
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
    const v = card.marketValue ?? 0;
    if (v > signatureValue) {
      signatureValue = v;
      signature = { cardId: card.id, fullName: card.fullName };
    }
  }
  cards.sort((a, b) => a.fullName.localeCompare(b.fullName));
  const now = new Date().toISOString();
  return {
    id: JARVIS_DECK_ID,
    name: JARVIS_DECK_NAME,
    displayed: true,
    color: JARVIS_DECK_COLOR,
    featuredCardId: null,
    featured: signature,
    totalCards,
    inks: [...inks],
    cards,
    copiedFromCode: null,
    copiedFromUsername: null,
    sourceDeckName: null,
    inventoryValue: 0,
    unpricedCards: 0,
    createdAt: now,
    updatedAt: now,
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
  /** True once the completed trade's quantities have been
      auto-settled into both collections (Anthony, Nov 3,
      2026). */
  settled: z.boolean(),
  /** Auto-archive (Anthony, Nov 3, 2026, ~11:04 PM): true
      once the trade has reached an end state (or was
      archived by hand) and so belongs in the Trades History
      section instead of the active lists. */
  archived: z.boolean(),
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

/** The user's Home tile order resolved to the full tile list:
    their saved keys first (deduped, valid keys only), then any
    tile they never ordered — or that was added after they saved
    — in its default position. Null/empty saved order = the
    default order exactly. */
function resolveCollectionOrder(json: string | null): string[] {
  const valid = parseHiddenCollections(json);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of valid) {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of COLLECTION_TILE_KEYS) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
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
    of a trade can only offer what he actually has here. Pinned to
    EXACT printings by card id (Anthony, Nov 3, 2026, ~11:03 PM —
    the Trade Match bug): name-only matching hid his Elsa and
    Stitch from Trade Match because Anthony owns same-NAME cards —
    Anthony's Elsa is the Fabled #53 in Regular (Jarvis's is that
    printing in Cold Foil, a finish Anthony does not own) and his
    Stitch copies are The First Chapter and Fabled printings
    (Jarvis's is the Promo Set 1 printing). */
const JARVIS_TRADE_STOCK = [
  { cardId: 115, name: "Mickey Mouse - Brave Little Tailor", finish: "Regular", qty: 1 },
  { cardId: 1996, name: "Elsa - Snow Queen", finish: "Cold Foil", qty: 1 },
  { cardId: 688, name: "Stitch - Rock Star", finish: "Regular", qty: 2 },
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
        (s) => s.cardId === card.id && s.finish === input.finish,
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
  /** True once the completed purchase's copies have been
      auto-settled from the seller's collection into the
      buyer's (Anthony, Nov 3, 2026). */
  settled: z.boolean(),
  /** Auto-archive (Anthony, Nov 3, 2026, ~11:04 PM): true
      once the order has reached an end state (or was
      archived by hand) — it belongs in the Trades History
      section, not the active lists. */
  archived: z.boolean(),
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
    (s) => s.cardId === card.id && s.finish === finish,
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
  /** Top four most valuable owned card printings, ranked by
      per-unit market value of the exact printing + finish
      (Anthony, Nov 4, 2026: the profile Library picture's top
      four windows show these). Fewer than four when the
      collection holds fewer priced printings. */
  topValuable: z.array(
    z.object({
      cardId: z.number(),
      name: z.string(),
      finish: z.string(),
      unitValue: z.number(),
    }),
  ),
});


/** ---- Three-game catalogs (Anthony, Nov 3, 2026, late) ----
    Pokémon, Magic: The Gathering, and Star Wars: Unlimited are
    cataloged into game_cards from each game's canonical free
    source, in resumable chunks: Pokémon from the
    PokemonTCG/pokemon-tcg-data GitHub dataset (the community
    mirror of the official Pokémon TCG API data), Magic from
    Scryfall, Star Wars: Unlimited from Fantasy Flight's
    official card API. Catalog rows are text + image links
    only; artwork bytes are never stored. Prices are stored
    only where the source itself publishes one (Pokémon:
    TCGplayer prices carried in the dataset; Magic: Scryfall's
    USD prices; Star Wars' official API publishes no prices,
    so its rows honestly carry none). */

type GameKey = "pokemon" | "magic" | "starwars";

type GameRow = {
  game: string;
  uid: string;
  sectionKey: string;
  sectionName: string;
  sectionSort: number;
  slotSort: number;
  number: string | null;
  printed: string;
  name: string;
  rarity: string | null;
  finish: string | null;
  imageUrl: string | null;
  price: number | null;
};

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": "VaultX catalog import" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  return (await res.json()) as unknown;
}

const sleepMs = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

type ImportState = {
  sets?: { key: string; name: string; sort: number; total?: number }[];
  cursor?: number;
  page?: number;
  totalPages?: number;
  sectionSorts?: Record<string, number>;
};

async function readImportMeta(ctx: Ctx, game: GameKey) {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.gameImportMeta)
    .where(eq(schema.gameImportMeta.game, game));
  return rows[0] ?? null;
}

async function saveImportMeta(
  ctx: Ctx,
  game: GameKey,
  state: ImportState,
  setsTotal: number,
  setsDone: number,
  complete: boolean,
) {
  const db = ctx.db<typeof schema>();
  const countRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.gameCards)
    .where(eq(schema.gameCards.game, game));
  const cardsTotal = countRows[0]?.c ?? 0;
  const now = new Date().toISOString();
  const existing = await readImportMeta(ctx, game);
  if (existing) {
    await db
      .update(schema.gameImportMeta)
      .set({
        state: JSON.stringify(state),
        setsTotal,
        setsDone,
        cardsTotal,
        complete: complete ? 1 : 0,
        updatedAt: now,
      })
      .where(eq(schema.gameImportMeta.game, game));
  } else {
    await db.insert(schema.gameImportMeta).values({
      game,
      state: JSON.stringify(state),
      setsTotal,
      setsDone,
      cardsTotal,
      complete: complete ? 1 : 0,
      updatedAt: now,
    });
  }
  return cardsTotal;
}

async function insertGameRows(ctx: Ctx, rows: GameRow[]) {
  const db = ctx.db<typeof schema>();
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    if (slice.length === 0) continue;
    await db
      .insert(schema.gameCards)
      .values(slice)
      .onConflictDoNothing()
      .run();
  }
}

async function importPokemonChunk(
  ctx: Ctx,
  state: ImportState,
): Promise<{ state: ImportState; setsTotal: number; setsDone: number; complete: boolean }> {
  // Source: the official Pokémon TCG API (api.pokemontcg.io),
  // paged in release order. (The GitHub dataset mirror timed
  // out from the app's server, so the importer reads the API
  // the dataset itself mirrors.) 100 printings per page,
  // field-slimmed so the API answers fast.
  const pageSize = 100;
  let page = state.page ?? 1;
  state.sectionSorts = state.sectionSorts ?? {};
  let lastTotalPages = state.totalPages ?? 0;
  let pagesThisCall = 0;
  while (pagesThisCall < 3) {
    if (lastTotalPages > 0 && page > lastTotalPages) break;
    let data: Record<string, unknown>;
    try {
      data = asRec(
        await fetchJson(
          `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${pageSize}&orderBy=set.releaseDate,number&select=id,name,number,rarity,images,set,tcgplayer`,
        ),
      );
    } catch {
      if (pagesThisCall === 0) throw new Error("pokemon source unreachable");
      break;
    }
    const totalCount = asNum(data.totalCount) ?? 0;
    lastTotalPages =
      totalCount > 0 ? Math.ceil(totalCount / pageSize) : lastTotalPages;
    const rows: GameRow[] = [];
    for (const cRaw of asArr(data.data)) {
      const c = asRec(cRaw);
      const id = asStr(c.id);
      const name = asStr(c.name);
      if (!id || !name) continue;
      const set = asRec(c.set);
      const setId = asStr(set.id) ?? "unknown";
      const setName = asStr(set.name) ?? setId;
      if (state.sectionSorts[setId] == null) {
        state.sectionSorts[setId] =
          Object.keys(state.sectionSorts).length;
      }
      const number = asStr(c.number) ?? "";
      const setTotal = asNum(set.printedTotal) ?? asNum(set.total);
      const images = asRec(c.images);
      const prices = asRec(asRec(c.tcgplayer).prices);
      const finishOrder: [string, string][] = [
        ["normal", "Normal"],
        ["holofoil", "Holofoil"],
        ["reverseHolofoil", "Reverse Holofoil"],
        ["1stEditionHolofoil", "1st Edition Holofoil"],
        ["1stEditionNormal", "1st Edition"],
      ];
      let price: number | null = null;
      let finish: string | null = null;
      for (const [key, label] of finishOrder) {
        const pr = asRec(prices[key]);
        const v = asNum(pr.market) ?? asNum(pr.mid);
        if (v != null) {
          price = v;
          finish = label;
          break;
        }
      }
      const numInt = parseInt(number, 10);
      rows.push({
        game: "pokemon",
        uid: `pokemon:${id}`,
        sectionKey: setId,
        sectionName: setName,
        sectionSort: state.sectionSorts[setId] ?? 0,
        slotSort: Number.isFinite(numInt) ? numInt : rows.length + 1,
        number: number || null,
        printed: setTotal ? `${number}/${setTotal}` : number,
        name,
        rarity: asStr(c.rarity),
        finish,
        imageUrl: asStr(images.large) ?? asStr(images.small),
        price,
      });
    }
    await insertGameRows(ctx, rows);
    page += 1;
    pagesThisCall += 1;
  }
  state.page = page;
  state.totalPages = lastTotalPages;
  const complete = lastTotalPages > 0 && page > lastTotalPages;
  return {
    state,
    setsTotal: lastTotalPages,
    setsDone: Math.min(page - 1, lastTotalPages),
    complete,
  };
}

async function importMagicChunk(
  ctx: Ctx,
  state: ImportState,
): Promise<{ state: ImportState; setsTotal: number; setsDone: number; complete: boolean }> {
  if (!state.sets) {
    const data = asRec(await fetchJson("https://api.scryfall.com/sets"));
    const allowed = new Set([
      "core", "expansion", "masters", "draft_innovation", "commander",
      "planechase", "archenemy", "vanguard", "starter", "duel_deck",
      "premium_deck", "from_the_vault", "spellbook", "treasure_chest",
      "promo", "box", "funny",
    ]);
    const sets = asArr(data.data)
      .map((s) => asRec(s))
      .filter(
        (s) =>
          asStr(s.code) &&
          asStr(s.name) &&
          allowed.has(String(s.set_type ?? "")) &&
          (asNum(s.card_count) ?? 0) > 0,
      )
      .sort((a, b) =>
        String(a.released_at ?? "").localeCompare(
          String(b.released_at ?? ""),
        ),
      )
      .map((s, i) => ({
        key: String(s.code),
        name: String(s.name),
        sort: i,
      }));
    state.sets = sets;
    state.cursor = 0;
  }
  const sets = state.sets;
  const start = state.cursor ?? 0;
  const batch = sets.slice(start, start + 2);
  let doneSets = 0;
  for (const set of batch) {
    try {
    let url: string | null =
      `https://api.scryfall.com/cards/search?q=e%3A${encodeURIComponent(set.key)}&unique=prints&order=set&dir=asc`;
    const rows: GameRow[] = [];
    while (url) {
      const data = asRec(await fetchJson(url));
      for (const cRaw of asArr(data.data)) {
        const c = asRec(cRaw);
        const id = asStr(c.id);
        const name = asStr(c.name);
        if (!id || !name) continue;
        const cn = asStr(c.collector_number) ?? "";
        const prices = asRec(c.prices);
        const price = asNum(prices.usd) ?? asNum(prices.usd_foil);
        const imageUris = asRec(c.image_uris);
        let image = asStr(imageUris.normal) ?? asStr(imageUris.large);
        if (!image) {
          const faces = asArr(c.card_faces);
          if (faces.length > 0) {
            const f = asRec(asRec(faces[0]).image_uris);
            image = asStr(f.normal) ?? asStr(f.large);
          }
        }
        const finishes = asArr(c.finishes).map((f) => String(f));
        const numInt = parseInt(cn, 10);
        rows.push({
          game: "magic",
          uid: `magic:${id}`,
          sectionKey: set.key,
          sectionName: set.name,
          sectionSort: set.sort,
          slotSort: Number.isFinite(numInt) ? numInt : rows.length + 1,
          number: cn || null,
          printed: cn,
          name,
          rarity: asStr(c.rarity),
          finish: finishes.length > 0 ? finishes.join(", ") : null,
          imageUrl: image,
          price,
        });
      }
      url = data.has_more === true ? asStr(data.next_page) : null;
      if (url) await sleepMs(120);
    }
    await insertGameRows(ctx, rows);
    await sleepMs(120);
    doneSets += 1;
    } catch {
      break;
    }
  }
  const cursor = start + doneSets;
  state.cursor = cursor;
  return {
    state,
    setsTotal: sets.length,
    setsDone: cursor,
    complete: cursor >= sets.length,
  };
}

async function importStarwarsChunk(
  ctx: Ctx,
  state: ImportState,
): Promise<{ state: ImportState; setsTotal: number; setsDone: number; complete: boolean }> {
  const pageSize = 100;
  let page = state.page ?? 1;
  const totalPages = state.totalPages ?? 0;
  state.sectionSorts = state.sectionSorts ?? {};
  let pagesThisCall = 0;
  let lastTotalPages = totalPages;
  while (pagesThisCall < 2) {
    if (lastTotalPages > 0 && page > lastTotalPages) break;
    const data = asRec(
      await fetchJson(
        `https://admin.starwarsunlimited.com/api/cards?locale=en&pagination[pageSize]=${pageSize}&pagination[page]=${page}`,
      ),
    );
    const pagination = asRec(asRec(data.meta).pagination);
    lastTotalPages = asNum(pagination.pageCount) ?? lastTotalPages;
    const rows: GameRow[] = [];
    for (const eRaw of asArr(data.data)) {
      const e = asRec(eRaw);
      const a = asRec(e.attributes);
      const title = asStr(a.title);
      const cardId = asStr(a.cardId) ?? String(e.id ?? "");
      if (!title || !cardId) continue;
      const expansion = asRec(asRec(a.expansion).data);
      const expAttrs = asRec(expansion.attributes);
      const expCode = asStr(expAttrs.code) ?? "SWU";
      const expName = asStr(expAttrs.name) ?? expCode;
      if (state.sectionSorts[expCode] == null) {
        state.sectionSorts[expCode] =
          Object.keys(state.sectionSorts).length;
      }
      const rarityAttrs = asRec(asRec(a.rarity).data);
      const variantData = asArr(asRec(a.variantTypes).data);
      const variantName =
        variantData.length > 0
          ? asStr(asRec(asRec(variantData[0]).attributes).name)
          : null;
      const artAttrs = asRec(asRec(a.artFront).data);
      let image = asStr(asRec(artAttrs.attributes).url);
      if (image && image.startsWith("/")) {
        image = `https://admin.starwarsunlimited.com${image}`;
      }
      const subtitle = asStr(a.subtitle);
      const cardNumber = asNum(a.cardNumber);
      const cardCount = asNum(a.cardCount);
      rows.push({
        game: "starwars",
        uid: `starwars:${cardId}`,
        sectionKey: expCode,
        sectionName: expName,
        sectionSort: state.sectionSorts[expCode] ?? 0,
        slotSort: cardNumber ?? rows.length + 1,
        number: cardNumber != null ? String(cardNumber) : null,
        printed:
          cardNumber != null && cardCount != null
            ? `${cardNumber}/${cardCount}`
            : cardNumber != null
              ? String(cardNumber)
              : cardId,
        name: subtitle ? `${title} - ${subtitle}` : title,
        rarity: asStr(asRec(rarityAttrs.attributes).name),
        finish: variantName,
        imageUrl: image,
        price: null,
      });
    }
    await insertGameRows(ctx, rows);
    page += 1;
    pagesThisCall += 1;
  }
  state.page = page;
  state.totalPages = lastTotalPages;
  const complete = lastTotalPages > 0 && page > lastTotalPages;
  return {
    state,
    setsTotal: lastTotalPages,
    setsDone: Math.min(page - 1, lastTotalPages),
    complete,
  };
}


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
        //
        // Puzzle/lore insert rows are catalog-authored end to end
        // (Nov 4, 2026 all-sets puzzle audit): their descriptive
        // fields — names, printed numbers, slot order, artwork,
        // TCGplayer ids — re-sync from the bundled catalog in the
        // backfill loop below, so a corrected piece count (Azurite
        // Sea 6 -> 9, Winterspell's lore/puzzle split) or newly
        // found artwork reaches binders seeded earlier. Ownership
        // counts and prices are NOT part of that sync.
        const catalogByUid = new Map(
          fullCatalog.map((e) => [e.uid, e] as const),
        );
        const slotSortByUid = new Map<string, number>();
        {
          const byGroup = new Map<string, CatalogEntry[]>();
          for (const entry of fullCatalog) {
            const key = groupKeyOf(entry);
            const list = byGroup.get(key) ?? [];
            list.push(entry);
            byGroup.set(key, list);
          }
          for (const list of byGroup.values()) {
            [...list]
              .sort((a, b) => {
                const na = a.number ?? 99999;
                const nb = b.number ?? 99999;
                if (na !== nb) return na - nb;
                return (a.fullName ?? "").localeCompare(b.fullName ?? "");
              })
              .forEach((entry, idx) => slotSortByUid.set(entry.uid, idx));
          }
        }
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
          // Puzzle/lore descriptive sync (see the catalogByUid
          // note above): names, printed numbers, slot order,
          // artwork, and TCGplayer ids follow the bundled
          // catalog. When the artwork source changes, the cached
          // blob is dropped so the new image fetches fresh.
          // Ownership and prices are never touched here.
          if (row.grp === "puzzle") {
            const entry = catalogByUid.get(row.uid);
            if (entry) {
              const fullName = entry.fullName ?? entry.name ?? row.fullName;
              if (row.fullName !== fullName) set.fullName = fullName;
              if (row.name !== entry.name) set.name = entry.name;
              if (row.printed !== entry.printed) set.printed = entry.printed;
              if (row.number !== entry.number) set.number = entry.number;
              if (row.rarity !== entry.rarity) set.rarity = entry.rarity;
              if (row.cardType !== entry.type) set.cardType = entry.type;
              if (row.cardText !== entry.text) set.cardText = entry.text;
              const img = entry.image ?? null;
              if (row.imageUrl !== img) {
                set.imageUrl = img;
                set.imageBlobKey = null;
              }
              if (entry.tcg != null && row.tcgplayerId !== String(entry.tcg)) {
                set.tcgplayerId = String(entry.tcg);
              }
              const ss = slotSortByUid.get(row.uid);
              if (ss != null && row.slotSort !== ss) set.slotSort = ss;
            }
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

  syncCatalogAdditions: defineAction({
    description:
      "Inserts any bundled catalog printings that have no binder row yet (new sets, promo families, and audited additions like the Challenge C2 printings past #10), slotted where a fresh seed would put them. Existing rows, ownership counts, and prices are never touched; new rows start unowned.",
    request: z.object({}),
    response: z.object({
      inserted: z.number(),
      groups: z.array(
        z.object({ groupKey: z.string(), count: z.number() }),
      ),
    }),
    async handler(ctx) {
      const result = await insertMissingCatalogEntries(ctx, fullCatalog);
      if (result.inserted > 0) ctx.invalidateQueries();
      return result;
    },
  }),

  getCatalogIndex: defineAction({
    description:
      "Lists every printing currently in the binder catalog (uid, group, family, printed number, name) so the daily catalog audit can diff the catalog against the complete Lorcana card universe and find what is missing.",
    request: z.object({}),
    response: z.object({
      entries: z.array(
        z.object({
          uid: z.string(),
          grp: z.string(),
          family: z.string().nullable(),
          printed: z.string(),
          fullName: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({
          uid: schema.cards.uid,
          grp: schema.cards.grp,
          family: schema.cards.family,
          printed: schema.cards.printed,
          fullName: schema.cards.fullName,
        })
        .from(schema.cards)
        .orderBy(asc(schema.cards.id));
      return { entries: rows };
    },
  }),

  saveCatalogAdditions: defineAction({
    description:
      "Saves new catalog printings found by the daily catalog audit: inserts each supplied printing whose uid is not already in the catalog, with its real name, family, collector number, stats, and artwork URL. Existing printings are never modified — duplicates are skipped and counted.",
    request: z.object({
      entries: z
        .array(
          z.object({
            uid: z.string().min(1).max(80),
            grp: z.enum(["set", "promo", "quest"]),
            setCode: z.string().min(1).max(12),
            setName: z.string().min(1).max(120),
            family: z.string().max(12).nullable(),
            number: z.number().int().min(0).max(9999).nullable(),
            printed: z.string().min(1).max(24),
            fullName: z.string().min(1).max(160),
            name: z.string().max(120).nullable(),
            rarity: z.string().max(40).nullable(),
            ink: z.string().max(40).nullable(),
            cost: z.number().int().min(0).max(99).nullable(),
            inkwell: z.boolean(),
            type: z.string().max(40).nullable(),
            strength: z.number().int().min(0).max(99).nullable(),
            willpower: z.number().int().min(0).max(99).nullable(),
            lore: z.number().int().min(0).max(99).nullable(),
            text: z.string().max(2000).nullable(),
            subtypes: z.string().max(200).nullable(),
            image: z.string().url().max(500).nullable(),
            tcg: z.number().int().positive().nullable(),
          }),
        )
        .max(500),
    }),
    response: z.object({ inserted: z.number(), skipped: z.number() }),
    async handler(ctx, args) {
      const entries: CatalogEntry[] = args.entries.map((e) => ({
        ...e,
        grp: e.grp,
      }));
      const result = await insertMissingCatalogEntries(ctx, entries);
      if (result.inserted > 0) ctx.invalidateQueries();
      const skipped = args.entries.length - result.inserted;
      // Record the completed run (Anthony, Nov 3, 2026): the
      // Settings > Your data & backups line reads the newest of
      // these rows, and the daily audit task calls this action
      // exactly once per run — with an empty list when it found
      // nothing new — so every daily run leaves its mark,
      // additions or not.
      try {
        const db = ctx.db<typeof schema>();
        await db.insert(schema.catalogAuditLog).values({
          ranAt: new Date().toISOString(),
          added: result.inserted,
          skipped,
          source: "daily",
        });
      } catch {
        // The log is a reporting nicety; a failed log write
        // must never fail the audit's actual save.
      }
      return {
        inserted: result.inserted,
        skipped,
      };
    },
  }),

  getCatalogAuditStatus: defineAction({
    description:
      "Returns the most recent completed catalog audit run (when it ran and how many printings it added) for the Settings > Your data & backups line. The audit runs daily; a run is recorded when the audit task saves its findings, including a zero-additions save when nothing new was found.",
    request: z.object({}),
    response: z.object({
      lastRunAt: z.string().nullable(),
      lastAdded: z.number().nullable(),
      runsRecorded: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.catalogAuditLog)
        .orderBy(desc(schema.catalogAuditLog.id));
      const last = rows[0];
      return {
        lastRunAt: last?.ranAt ?? null,
        lastAdded: last?.added ?? null,
        runsRecorded: rows.length,
      };
    },
  }),

  refreshCatalogAudit: defineAction({
    description:
      "Starts the daily catalog audit: spawns an agent task that compares the binder catalog against the complete Lorcana card universe (LorcanaJSON, the Lorcast API, and the DL Promos reference) and saves any missing English printings via saveCatalogAdditions, so newly released cards and newly sourced promo printings land in the catalog without touching existing cards, ownership, or prices.",
    request: z.object({}),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
    }),
    async handler(
      ctx,
    ): Promise<{ started: boolean; taskId: string | null }> {
      const today = new Date().toISOString().slice(0, 10);
      const result = await ctx.agent.spawnTask(
        [
          "Audit the lorcana-binder web artifact's card catalog against the complete Disney Lorcana card universe and add every missing English printing.",
          "1. Call the artifact's syncCatalogAdditions action first — it inserts any bundled catalog additions that have no binder row yet.",
          "2. Call getCatalogIndex to list every printing already in the catalog (uid, family, printed number, name).",
          "3. Fetch https://lorcanajson.org/files/current/en/allCards.json (the full LorcanaJSON catalog). Every card there is a candidate: its binder uid is \"<setCode>:<id>\". Main-set cards group by setCode; cards whose fullIdentifier carries a promo family code (P1, P2, P3, P4, PD1, D23, C1, C2, CC1, DIS, RPH, or a newer family) are promo printings of that family; Q1/Q2/Q3 are Illumineer's Quest sets. Any candidate whose uid is not in the index is missing.",
          "4. LorcanaJSON is known to lag on promo families (its Challenge C2 stops at #10 and it has no C3/CC2), so also cross-check the promo families against https://dlpromos.ink/sets and its per-set pages (English variants only — skip printings that exist only in Japanese or Chinese) and the Lorcast API (https://api.lorcast.com/v0/sets, then /v0/cards/search?q=set:<code>). For a missing printing found only there, copy its game stats (ink, cost, inkwell, type, strength, willpower, lore, rules text, subtypes) from the same card's main-set printing in allCards.json — promo printings are reprints with identical game text — and take its artwork from the English card scan on its DL Promos card page. Its uid is \"x:<FAMILY>:<printed number>\" (for example x:C2:20).",
          "5. Call saveCatalogAdditions ONCE with every verified missing printing: { uid, grp ('promo' for promo families, 'set' for main sets, 'quest' for quests), setCode (the card's home set code), setName (the binder's existing name for that family or set), family (promo family code or null), number, printed (e.g. \"20/C2\"), fullName, name, rarity ('Special' for promos), ink, cost, inkwell, type, strength, willpower, lore, text, subtypes, image (artwork URL or null), tcg (TCGplayer id or null) }. Call it even when the verified-missing list is empty (entries: []) — that empty save is what records the run as completed in the app's catalog audit log.",
          "Never invent a printing, a stat, or an image URL: skip anything you cannot verify from one of those sources, and never send a printing whose uid is already in the index. Do not change prices or ownership, and do not edit any files, memory, or other artifacts.",
        ].join("\n"),
        {
          expectsAction: "saveCatalogAdditions",
          dedupeKey: `lorcana-catalog-audit-${today}`,
        },
      );
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
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
      "The signed-in collector's personal Inbox (Anthony, Nov 3, 2026): every cash purchase order and trade offer involving them, plus — for the owner — every change-request ticket, as one mail-style list. Each item carries its Subject (Purchase Order / Trade Offer / the ticket's type), who it's From, the latest activity date, a short preview, its status, how many messages in it are unread, and an item-level unread flag for the NEW badge: an item is unread when incoming activity the viewer has not opened yet exists — the other party creating the order/offer, or a message from the other party — judged against the viewer's persisted read marker, so a new reply in an already-read thread makes it unread again. totalUnread counts the unread ITEMS (the NEW-badged rows), matching the Home mail badge. Opening an order item opens that order; opening a ticket item opens that ticket.",
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
          unread: z.boolean(),
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
        let lastIncomingAt: string | null = null;
        for (const m of msgs) {
          if (m.fromCode === me) continue;
          lastIncomingAt = m.createdAt;
          if (marker && m.createdAt <= marker) continue;
          unread += 1;
        }
        const last = msgs[msgs.length - 1];
        return {
          unread,
          lastBody: last?.body ?? null,
          lastAt: last?.createdAt ?? null,
          lastIncomingAt,
          marker: marker ?? null,
        };
      };
      // Item-level unread for the NEW badge (Anthony, Nov 3,
      // 2026, ~2:21 PM): an item is unread when INCOMING
      // activity exists that the viewer has not opened yet —
      // the other party creating the order/offer counts, and
      // so does their latest message; the viewer's persisted
      // read marker (deal_thread_reads, written when they open
      // the thread) is what clears it, and any incoming
      // activity newer than the marker makes it unread again.
      // The viewer's own creations and messages never make
      // their own item unread. Status is separate: read or
      // not, "Pending" stays until the deal itself resolves.
      const itemUnread = (
        createdByOtherAt: string | null,
        info: ReturnType<typeof threadInfo>,
      ): boolean => {
        let incomingAt = createdByOtherAt;
        if (
          info.lastIncomingAt &&
          (incomingAt == null || info.lastIncomingAt > incomingAt)
        )
          incomingAt = info.lastIncomingAt;
        if (incomingAt == null) return false;
        return info.marker == null || incomingAt > info.marker;
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
        unread: boolean;
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
          // The buyer created the order: for the seller it is
          // incoming activity; for the buyer it is their own.
          unread: itemUnread(p.sellerCode === me ? p.createdAt : null, info),
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
          // The proposer created the offer: for the partner it
          // is incoming activity; for the proposer their own.
          unread: itemUnread(t.partnerCode === me ? t.createdAt : null, info),
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
            unread: !t.readAt,
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
        // The Home mail badge counts NEW-badged ITEMS (Anthony,
        // Nov 3, 2026, ~2:21 PM): the number beside the
        // envelope equals the number of rows carrying the NEW
        // badge, not the number of unread messages inside them.
        totalUnread: visible.filter((i) => i.unread).length,
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
        composite: compositeForRow(
          row,
          await db
            .select()
            .from(schema.cards)
            .where(eq(schema.cards.groupKey, row.groupKey)),
        ),
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
          priceSource: z.string().nullable(),
          priceStale: z.boolean(),
          priceWindow: z.string().nullable(),
          priceLastSoldMonth: z.string().nullable(),
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
        priceNote: `Prices follow the house hierarchy: TCGplayer market values first (daily re-pricing; the snapshot of ${PRICE_SNAPSHOT_DATE} where untracked); printings with no TCGplayer price use the median of recent eBay SOLD listings where sales exist (checked Nov 4, 2026). Anything left over has no tracked price anywhere and is disclosed, never guessed.`,
        missing,
      };
    },
  }),

  requestBuyList: defineAction({
    description:
      "Starts the TCGplayer buy handoff for one section's missing cards — only after the user's explicit per-run confirmation in the app naming the destination (TCGplayer, via Jarvis) and the payload (TCGplayer product IDs and quantities only, confirmed: true): spawns Jarvis's agent task with only those public product identifiers to prepare the cart on TCGplayer under Anthony's rules (Near Mint, no single-card package over $3 shipping, no checkout — final payment approval stays Anthony's).",
    request: z.object({
      groupKey: z.string().min(1),
      /** The per-run confirmation from the app: the user saw
          exactly what would be sent and where, and tapped
          Send. The handoff never starts without it. */
      confirmed: z.literal(true),
    }),
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
      const lines = completion.missing.flatMap((m) =>
        m.tcgplayerId
          ? [`- TCGplayer ID ${m.tcgplayerId} — quantity 1`]
          : [],
      );
      if (lines.length === 0) {
        return {
          started: false,
          taskId: null,
          missingCount: completion.missingCount,
          costToComplete: completion.costToComplete,
        };
      }
      const result = await ctx.agent.spawnTask(
        [
          `The user explicitly confirmed this individual buy handoff in Vault X. Prepare a TCGplayer cart for the ${lines.length} product entries below. Only public TCGplayer product identifiers and quantities are included; do not substitute products.`,
          "Rules (the user's standing TCGplayer rules): Near Mint copies only. Optimize sellers to keep packages few. NEVER keep a single-card package whose shipping is over $3 — swap that product to a Near Mint option with shipping of $3 or less, or leave the product out and report it. A multi-card package whose shipping runs a little over $3 is fine. Add only the listed product IDs to the cart on TCGplayer, but DO NOT check out and DO NOT pay — final payment approval always stays with the user. When the cart is prepared, report back in the main chat: the package count, the item total, the shipping total, the grand total before tax, and any product IDs left out (with why).",
          "Product IDs:",
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
      "Identifies Lorcana cards in a photo (a single card, a stack scanned one after another, or a whole binder page) using vision, and matches them against the binder catalog with ownership and finish information. Only corroborated reads come back as definite matches; reads the evidence cannot pin to one printing come back as ambiguous with candidate printings for the user to pick from, so a weak read is never presented as a definite wrong card. OPTION 2 (Nov 3, 2026): the caller may pass candidateIds — the on-device fingerprint matcher's ranked finalists for the same photo — and the read's verbatim collector-number line (e.g. \"3/P3\") is then resolved among those finalists first and against the full catalog by that exact printed line second, so a printing whose on-device fingerprint is not built yet is still findable by its line. V6 (same evening, final): Anthony's hard rule is that a scan never runs longer than 5 seconds, so the server budget is 4 seconds — a read that cannot finish inside it is cut and the client lands with its on-device candidates or search fallback instead of spinning (the vision read itself takes ~18–25 seconds, which is exactly why waiting for it failed). The client fires this call the moment the photo is taken, in parallel with the on-device match, so the check is already running inside the first second or two.",
    request: z.object({
      imageBase64: z.string().min(100).max(9_000_000),
      /** The scanner's on-device fingerprint finalists for this
          photo (best first, up to 40). Advisory corroboration
          only — never a hard filter: the full catalog is always
          searched too, because an incomplete on-device index is
          exactly how The Queen P3 #3 kept vanishing. */
      candidateIds: z
        .array(z.number().int().positive())
        .max(64)
        .optional(),
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
          /** What the vision read actually saw, so the result
              screen can show it and the user can spot a misread
              before adding. */
          readName: z.string(),
          readNumber: z.number().nullable(),
        }),
      ),
      /** Reads that matched more than one plausible printing:
          the user picks the right candidate instead of being
          handed a guessed (and possibly wrong) card. */
      ambiguous: z.array(
        z.object({
          readName: z.string(),
          readNumber: z.number().nullable(),
          candidates: z.array(
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
              readName: z.string(),
              readNumber: z.number().nullable(),
            }),
          ),
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
            /** The collector line VERBATIM as printed at the
                bottom-left of the card, e.g. "137/204" for a
                main-set card or "3/P3" for a promo — the token
                before "• EN •". Option 2's deciding signal: the
                full line, suffix included, names one printing. */
            collectorLine: z.string().nullable(),
            foil: z.boolean().nullable(),
            /** Ink color printed on the card (the colored ink
                drop / cost hex), e.g. "Amber" — a strong
                discriminator between same-name printings. */
            ink: z.string().nullable(),
            /** Ink cost printed in the top-left hex. */
            cost: z.number().int().nullable(),
          }),
        ),
        binderPage: z.boolean(),
      });
      // Server-side budget (V6, Nov 3, 2026, late — Anthony's
      // FINAL rule after the 32-second build failed live: a
      // scan NEVER runs longer than 5 seconds, period; his
      // earlier "even if it takes longer" approval for this
      // route is cancelled). The focused prompt below reads a
      // card correctly but takes ~18–25 seconds — far beyond
      // any budget Anthony will accept — so this race is now
      // 4 seconds, inside the client's 5-second whole-scan
      // ceiling: a read that can finish fast still lands, and
      // one that cannot is cut at 4 seconds so the client can
      // land with its on-device candidates/search fallback
      // instead of spinning. The on-device fingerprint index
      // (answers in about a second) is the primary path.
      const read = await Promise.race([
        ctx.inference.complete(
          "Identify every Disney Lorcana card in this photo. For each card report: name — the full title at the top, exactly as printed including any subtitle after a dash; setName — the set name printed on the card, or null; collectorLine — the line at the bottom-left copied character for character (\"137/204\" on a main-set card, \"3/P3\" / \"34/P2\" / \"20/C2\" on promo and Challenge printings — the letters after the slash are part of the line; never swap them for a set size); collectorNumber — the number before the slash in that line (the number after \"EN •\" at the very end of the bottom line is the SET number, never the collector number); foil — true if the copy is foil, false if not, null if unsure; ink — the ink color by the cost (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel) or null; cost — the ink cost in the top-left hex or null. If a field is not clearly readable, report null instead of guessing. Also list Counter cards (type line says \"Counter\", e.g. the gold INK DROP card) by title with all other fields null. binderPage is true when the photo shows a binder page grid of several cards. List only cards you can actually read.",
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
        ),
        new Promise<never>((_resolve, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  "Identification stopped at 4 seconds — a scan never runs longer than 5 seconds. Try again with the card closer, filling the frame, straight-on and out of glare — or search for the card by name instead.",
                ),
              ),
            4_000,
          );
        }),
      ]);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);

      const norm = (s: string): string =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .replace(/\s+/g, " ");
      /** How well a catalog row's name matches what was read:
          100 exact full title, 70 exact base name (title before
          the dash), 50 containment either way, 40 every read
          token present in the full title, 0 no relation. */
      const nameScoreOf = (
        row: (typeof rows)[number],
        needleNorm: string,
      ): number => {
        if (!needleNorm) return 0;
        const full = norm(row.fullName);
        const base = norm(row.name ?? "");
        if (full === needleNorm) return 100;
        if (base && base === needleNorm) return 70;
        if (full.includes(needleNorm) || needleNorm.includes(full)) return 50;
        const tokens = needleNorm.split(" ").filter(Boolean);
        if (
          tokens.length > 0 &&
          tokens.every((t) => full.split(" ").includes(t))
        )
          return 40;
        return 0;
      };
      type Found = (typeof read.cards)[number];
      /** Independent signals from the photo that agree with a
          catalog row: set name, ink color, ink cost. The
          collector number is handled as a hard filter, not a
          bonus (see below). */
      const corroborationOf = (
        row: (typeof rows)[number],
        found: Found,
      ): number => {
        let n = 0;
        if (found.setName && norm(row.groupName) === norm(found.setName))
          n += 2;
        if (found.ink && row.ink && norm(row.ink) === norm(found.ink)) n += 1;
        if (found.cost != null && row.cost === found.cost) n += 1;
        return n;
      };
      const toMatch = (row: (typeof rows)[number], found: Found) => {
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
        return {
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
          readName: found.name,
          readNumber: found.collectorNumber,
        };
      };
      type Match = ReturnType<typeof toMatch>;

      const matches: Match[] = [];
      const ambiguous: { readName: string; readNumber: number | null; candidates: Match[] }[] = [];
      const unmatched: string[] = [];
      // Option 2 finalists from the on-device fingerprint
      // matcher (advisory corroboration — a finalist breaks
      // ties, it never gates the catalog search).
      const candidateSet = new Set(args.candidateIds ?? []);
      for (const found of read.cards) {
        const needleNorm = norm(found.name);
        if (!needleNorm) continue;
        // Every catalog row whose name bears any relation to the
        // read, best name match first, fingerprint-finalist
        // status next, corroboration as the last tiebreak.
        const scored = rows
          .map((row) => ({
            row,
            nameScore: nameScoreOf(row, needleNorm),
            corr: corroborationOf(row, found),
            cand: candidateSet.has(row.id) ? 1 : 0,
          }))
          .filter((s) => s.nameScore > 0)
          .sort(
            (a, b) =>
              b.nameScore - a.nameScore || b.cand - a.cand || b.corr - a.corr,
          );
        if (scored.length === 0) {
          unmatched.push(found.name);
          continue;
        }
        // Counter cards (the Hyperia City Ink Drop counters,
        // Nov 3, 2026 — Anthony's live test: the camera did not
        // recognize an Ink Drop at all): a counter prints no
        // collector number, ink, or cost for the corroboration
        // logic below to work with, and the two Ink Drop designs
        // share one printed title, so a name read that points at
        // the counters is settled the option-1 way — both designs
        // go to the candidates picker and the user taps the one
        // in their hand; a lone counter design is definite. This
        // branch only fires when no ordinary printing out-scores
        // the counter (a full "Merlin - Ink Drop Tinkerer" read
        // still names Merlin, never the counter).
        const counterBest = scored.find((s) => s.row.rarity === "Counter");
        if (
          counterBest &&
          counterBest.nameScore >= 50 &&
          scored.every(
            (s) =>
              s.row.rarity === "Counter" ||
              s.nameScore <= counterBest.nameScore,
          )
        ) {
          const counters = scored.filter(
            (s) => s.row.rarity === "Counter" && s.nameScore >= 50,
          );
          const onlyCounter = counters[0];
          if (counters.length === 1 && onlyCounter) {
            matches.push(toMatch(onlyCounter.row, found));
          } else {
            ambiguous.push({
              readName: found.name,
              readNumber: null,
              candidates: counters
                .slice(0, 4)
                .map((s) => toMatch(s.row, found)),
            });
          }
          continue;
        }
        // A collector number that was actually read is a hard
        // filter (tightened Nov 2, 2026, after a live test
        // matched the wrong card): only printings carrying
        // that exact number can match. But a hard filter alone
        // is not confidence — a misread digit plus a partial
        // name used to produce a definite wrong card, so a
        // number-pool match is only definite when the name is
        // read exactly (full title or base name) and no other
        // printing in the pool ties with it, OR the name is a
        // partial read that the set name and one more signal
        // both corroborate. Anything weaker goes to the
        // pick-it-yourself candidates, never to matches.
        // V4 (Nov 3, 2026 — The Queen P3 #3 re-test): a number
        // the pool cannot corroborate no longer DISCARDS the
        // read. The Queen's bottom line reads "3/P3 • EN • 9"
        // and a reader that takes the trailing set number (9)
        // for the collector number produced an empty pool for
        // a perfectly good name read, and the card vanished
        // into "unmatched" even though her name was read fine.
        // An empty or nameless pool now falls through to the
        // name-only resolution below — which can still only
        // name a definite card on an exact-title read, and
        // otherwise offers candidates — instead of throwing
        // the read away.
        let resolved = false;
        // OPTION 2 — the collector-LINE resolution (Nov 3, 2026,
        // later still — Anthony's pre-approved internet route,
        // fired after The Queen P3 #3 failed yet again on the
        // on-device build): the fingerprint's finalists narrow
        // the field, and the server reads the one line that
        // names a printing exactly — the full collector line,
        // suffix included ("3/P3", not just "3"). That line is
        // resolved FIRST among the fingerprint finalists and
        // the name-matching catalog rows, then against the
        // whole catalog by the exact printed line, so a
        // printing whose fingerprint was never built on the
        // phone (her exact failure, three builds running) is
        // still found. The line alone never names a definite
        // card: it must be corroborated by the name read
        // (score >= 40 — a token-level relation) or by the
        // printing being one of the fingerprint finalists; an
        // uncorroborated line read falls through to the
        // number/name logic below untouched, and a corroborated
        // but contested line read becomes candidates, never a
        // guess. Her case, concretely: title "The Queen -
        // Conceited Ruler" is printed by Fabled (1/204), its
        // Epic (205/204), and Promo Set 3 (3/P3) — the name
        // cannot separate them, the line "3/P3" can, and only
        // card 2188 carries it.
        {
          const lineNorm = (found.collectorLine ?? "")
            .toUpperCase()
            .replace(/\s+/g, "");
          const lineOk = /^\d{1,3}\/[A-Z0-9]{1,4}$/.test(lineNorm);
          if (lineOk) {
            const byPrinted = new Map<
              number,
              {
                row: (typeof rows)[number];
                nameScore: number;
                corr: number;
                cand: number;
              }
            >();
            for (const s of scored) {
              if (s.row.printed.toUpperCase().replace(/\s+/g, "") === lineNorm)
                byPrinted.set(s.row.id, s);
            }
            for (const row of rows) {
              if (byPrinted.has(row.id)) continue;
              if (row.printed.toUpperCase().replace(/\s+/g, "") !== lineNorm)
                continue;
              byPrinted.set(row.id, {
                row,
                nameScore: nameScoreOf(row, needleNorm),
                corr: corroborationOf(row, found),
                cand: candidateSet.has(row.id) ? 1 : 0,
              });
            }
            const linePool = [...byPrinted.values()].sort(
              (a, b) =>
                b.nameScore - a.nameScore ||
                b.cand - a.cand ||
                b.corr - a.corr,
            );
            const lineBest = linePool[0];
            if (
              lineBest &&
              (lineBest.nameScore >= 40 || lineBest.cand === 1)
            ) {
              const lineSecond = linePool[1];
              const lineTied =
                lineSecond != null &&
                lineSecond.nameScore === lineBest.nameScore &&
                lineSecond.cand === lineBest.cand &&
                lineSecond.corr === lineBest.corr;
              if (!lineTied && lineBest.nameScore >= 50) {
                matches.push(toMatch(lineBest.row, found));
              } else {
                ambiguous.push({
                  readName: found.name,
                  readNumber:
                    found.collectorNumber ??
                    (lineBest.row.number || null),
                  candidates: linePool
                    .slice(0, 8)
                    .map((s) => toMatch(s.row, found)),
                });
              }
              resolved = true;
            }
          }
        }
        // The line's number is also a collector-number read:
        // when the reader gave the line but no bare number,
        // the number before its slash feeds the pool below.
        // Skipped entirely when the line resolution above
        // already settled this read (V5 catch, Nov 3, 2026:
        // the first end-to-end read that ever landed returned
        // The Queen TWICE — the line block matched her, then
        // this pool matched her again, because the pool never
        // checked `resolved`. The bug was invisible while every
        // read timed out; now that reads land, it must not
        // double-report).
        const effectiveNumber =
          found.collectorNumber ??
          (() => {
            const m = /^(\d{1,3})\//.exec(
              (found.collectorLine ?? "").replace(/\s+/g, ""),
            );
            return m ? Number(m[1]) : null;
          })();
        if (!resolved && effectiveNumber != null) {
          const pool = scored.filter(
            (s) => s.row.number === effectiveNumber,
          );
          if (pool.length > 0) {
            const best = pool[0] as (typeof pool)[number];
            const second = pool[1];
            const tied =
              second != null &&
              second.nameScore === best.nameScore &&
              second.cand === best.cand &&
              second.corr === best.corr;
            const definite =
              !tied &&
              (best.nameScore >= 70 ||
                (best.nameScore >= 50 && best.corr >= 3));
            if (definite) {
              matches.push(toMatch(best.row, found));
              resolved = true;
            } else if (best.nameScore >= 50) {
              ambiguous.push({
                readName: found.name,
                readNumber: effectiveNumber,
                candidates: pool
                  .slice(0, 8)
                  .map((s) => toMatch(s.row, found)),
              });
              resolved = true;
            }
          }
        }
        if (!resolved) {
          // No usable number (none read, or the read number
          // matched no printing of that name): an exact
          // full-title read that names exactly one printing is
          // definite. The same title printed in several sets
          // needs the set / ink / cost signals to single one
          // out, and a partial or base-name read is never
          // definite on its own (the Nov 2 Merlin failure: a
          // loose substring read presented as fact) — it
          // becomes candidates for the user to pick from.
          const exactFull = scored.filter((s) => s.nameScore === 100);
          const onlyExact = exactFull[0];
          if (exactFull.length === 1 && onlyExact) {
            matches.push(toMatch(onlyExact.row, found));
          } else if (exactFull.length > 1) {
            const best = exactFull[0] as (typeof exactFull)[number];
            const second = exactFull[1] as (typeof exactFull)[number];
            if (best.corr >= 2 && best.corr > second.corr) {
              matches.push(toMatch(best.row, found));
            } else {
              ambiguous.push({
                readName: found.name,
                readNumber: null,
                candidates: exactFull
                  .slice(0, 8)
                  .map((s) => toMatch(s.row, found)),
              });
            }
          } else {
            const strong = scored.filter((s) => s.nameScore >= 50);
            if (strong.length > 0) {
              ambiguous.push({
                readName: found.name,
                readNumber: null,
                candidates: strong
                  .slice(0, 8)
                  .map((s) => toMatch(s.row, found)),
              });
            } else {
              unmatched.push(found.name);
            }
          }
        }
      }
      return { binderPage: read.binderPage, matches, ambiguous, unmatched };
    },
  }),


  getScanCards: defineAction({
    description:
      "Returns full binder rows (printing, ownership, finishes, market value) for a short list of card ids chosen by the scanner's ON-DEVICE fingerprint match, so the scan result screen can render definite matches and candidates-picker finalists without any server-side identification. Pure database lookup — no inference, no photo leaves the device for this step.",
    request: z.object({
      cardIds: z.array(z.number().int().positive()).min(1).max(8),
    }),
    response: z.object({
      cards: z.array(
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
          readName: z.string(),
          readNumber: z.number().nullable(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(inArray(schema.cards.id, args.cardIds));
      const byId = new Map(rows.map((r) => [r.id, r]));
      const cards = args.cardIds
        .map((id) => byId.get(id))
        .filter((r): r is (typeof rows)[number] => r != null)
        .map((row) => {
          const pockets = pocketsOf(row);
          const suggestedFinish =
            pockets.find((p) => p.kind === "regular")?.label ??
            pockets[0]?.label ??
            "Regular";
          return {
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
            // The on-device match names the printing itself;
            // readName mirrors it and readNumber stays null so
            // the result screen shows no spurious "read as" note.
            readName: row.fullName,
            readNumber: null,
          };
        });
      return { cards };
    },
  }),

  getPriceAlerts: defineAction({
    description:
      "Lists this user's own price alerts — every card, sealed product, and graded comic they have set one on — with each target's current unit value, a display name and subtitle for the alerts management page, and whether the alert's threshold is met right now (triggered alerts are what Home shows in translucent red). Alerts live in this app's own database, so they are strictly per-user. Also reports whether the user has dismissed the example price-alert banner, so Home only teaches it once.",
    request: z.object({}),
    response: z.object({
      alerts: z.array(
        z.object({
          id: z.number(),
          targetKind: z.string(),
          cardId: z.number().nullable(),
          sealedName: z.string().nullable(),
          comicId: z.string().nullable(),
          label: z.string(),
          /** Clean item name for the management page row (the
              card's full name, the sealed product's name, or the
              comic's title). */
          displayName: z.string(),
          /** Set / kind line under the name on the management
              page, e.g. "Hyperia City #207/204", "Hyperia City ·
              Sealed", or "DC Comics · Graded comic". */
          subtitle: z.string(),
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
      const comicById = new Map(
        COMIC_ALERT_CATALOG.map((c) => [c.id, c]),
      );
      return {
        exampleDismissed: profile.exampleAlertDismissed > 0,
        alerts: alertRows.map((a) => {
          let currentValue: number | null = null;
          let displayName = a.label;
          let subtitle = "";
          if (a.targetKind === "card" && a.cardId != null) {
            const card = cardById.get(a.cardId);
            currentValue = card?.marketValue ?? null;
            if (card) {
              displayName = card.fullName;
              subtitle = `${card.groupName} #${card.printed}`;
            }
          } else if (a.targetKind === "sealed" && a.sealedName) {
            const item = sealedByName.get(a.sealedName);
            if (item) {
              currentValue = item.unitValue;
              displayName = a.sealedName;
              subtitle = `${item.setName} · Sealed`;
            } else {
              displayName = a.sealedName;
              subtitle = "Sealed";
            }
          } else if (a.targetKind === "comic" && a.comicId) {
            const comic = comicById.get(a.comicId);
            if (comic) {
              currentValue = comic.value;
              displayName = comic.title;
              subtitle = `${comic.publisher} · Graded comic`;
            } else {
              subtitle = "Graded comic";
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
            comicId: a.comicId ?? null,
            label: a.label,
            displayName,
            subtitle,
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
      "Sets a price alert on one card, sealed item, or graded comic from its detail view: Home shows the alert in translucent red when the item's unit value crosses the threshold.",
    request: z.object({
      targetKind: z.enum(["card", "sealed", "comic"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      comicId: z.string().min(1).nullable().optional(),
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
      } else if (args.targetKind === "sealed") {
        if (!args.sealedName) throw new Error("sealedName is required");
        const base = allSealedItems.find((i) => i.name === args.sealedName);
        if (!base) throw new Error(`Unknown sealed item: ${args.sealedName}`);
        label = base.name;
      } else {
        if (!args.comicId) throw new Error("comicId is required");
        const comic = COMIC_ALERT_CATALOG.find((c) => c.id === args.comicId);
        if (!comic) throw new Error(`Unknown comic: ${args.comicId}`);
        label = `${comic.title} (${comic.publisher})`;
      }
      const inserted = await db
        .insert(schema.priceAlerts)
        .values({
          targetKind: args.targetKind,
          cardId: args.targetKind === "card" ? args.cardId : null,
          sealedName: args.targetKind === "sealed" ? args.sealedName : null,
          comicId: args.targetKind === "comic" ? (args.comicId ?? null) : null,
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

  updatePriceAlert: defineAction({
    description:
      "Edits one of the user's own price alerts in place — its direction (at or below / at or above) and its threshold — from the Price alerts management page. The alert's item never changes; only the target it watches for.",
    request: z.object({
      id: z.number().int().positive(),
      direction: z.enum(["below", "above"]),
      threshold: z.number().positive().max(100000),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.priceAlerts)
        .where(eq(schema.priceAlerts.id, args.id))
        .limit(1);
      if (!rows[0]) throw new Error("Price alert not found");
      await db
        .update(schema.priceAlerts)
        .set({ direction: args.direction, threshold: args.threshold })
        .where(eq(schema.priceAlerts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
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

      // Portfolio ranges (Nov 3, 2026 redesign): period change +
      // movers per range, computed from the REAL tracked history
      // only — portfolio snapshots for the headline change,
      // per-printing price history for the movers. Tracked
      // history starts Oct 25, 2026, so a range reaching back
      // past it measures from the first tracked day and says so
      // (clamped + baselineLabel), never from an invented point.
      const priceHistRows = await db.select().from(schema.cardPriceHistory);
      const histByUid = new Map<string, { date: string; unitValue: number }[]>();
      for (const p of priceHistRows) {
        const arr = histByUid.get(p.uid) ?? [];
        arr.push({ date: p.date, unitValue: p.unitValue });
        histByUid.set(p.uid, arr);
      }
      for (const arr of histByUid.values()) {
        arr.sort((a, b) => (a.date < b.date ? -1 : 1));
      }
      const todayIso = new Date().toISOString().slice(0, 10);
      const RANGE_DEFS: { key: string; days: number | null }[] = [
        { key: "7d", days: 7 },
        { key: "30d", days: 30 },
        { key: "90d", days: 90 },
        { key: "1y", days: 365 },
        { key: "all", days: null },
      ];
      type Mover = z.infer<typeof financeResponse>["ranges"][number]["gainers"][number];
      const ranges = RANGE_DEFS.map((def) => {
        const target =
          def.days == null
            ? null
            : new Date(
                new Date(`${todayIso}T00:00:00Z`).getTime() -
                  def.days * 86400000,
              )
                .toISOString()
                .slice(0, 10);
        // Portfolio baseline snapshot: the last one on/before the
        // target date, else the first tracked snapshot (clamped).
        let baseSnap = history[0];
        let clamped = def.days != null;
        if (def.days == null) {
          clamped = false;
        } else {
          for (const s of history) {
            if (target != null && s.date <= target) {
              baseSnap = s;
              clamped = false;
            }
          }
        }
        const baseValue = baseSnap?.value ?? value;
        const delta = round2(value - baseValue);
        const pct =
          baseValue > 0 ? Math.round((delta / baseValue) * 10000) / 100 : 0;
        // Movers: owned printings with a tracked baseline point.
        const movers: Mover[] = [];
        for (const row of rows) {
          if (row.ownedQty <= 0) continue;
          const pts = histByUid.get(row.uid);
          if (!pts || pts.length === 0) continue;
          let base = pts[0];
          if (def.days != null && target != null) {
            for (const p of pts) {
              if (p.date <= target) base = p;
            }
          }
          if (base == null || base.unitValue <= 0) continue;
          const unitNow = cardMoney(row).value / row.ownedQty;
          if (unitNow <= 0) continue;
          const deltaTotal = round2((unitNow - base.unitValue) * row.ownedQty);
          if (deltaTotal === 0) continue;
          movers.push({
            cardId: row.id,
            name: row.fullName,
            groupName: row.groupName,
            printed: row.printed,
            rarity: row.rarity,
            qty: row.ownedQty,
            unitNow: round2(unitNow),
            deltaTotal,
            pct: Math.round(((unitNow - base.unitValue) / base.unitValue) * 10000) / 100,
          });
        }
        const gainers = movers
          .filter((m) => m.deltaTotal > 0)
          .sort((a, b) => b.deltaTotal - a.deltaTotal)
          .slice(0, 5);
        const losers = movers
          .filter((m) => m.deltaTotal < 0)
          .sort((a, b) => a.deltaTotal - b.deltaTotal)
          .slice(0, 5);
        return {
          key: def.key,
          days: def.days,
          baselineDate: baseSnap?.date ?? todayIso,
          baselineLabel: baseSnap?.label.replace(/ \(.*\)$/, "") ?? "",
          clamped,
          delta,
          pct,
          gainers,
          losers,
        };
      });

      // Home Top-3 movers, last 24 hours (Nov 3, 2026): the
      // same per-printing math as the range movers, with the
      // baseline at the last tracked point at least a day
      // older than that printing's newest point — the last
      // daily reprice step. Mixed gain/loss, ranked by the
      // size of the move across owned copies.
      const movers24hAll: Mover[] = [];
      for (const row of rows) {
        if (row.ownedQty <= 0) continue;
        const pts = histByUid.get(row.uid);
        if (!pts || pts.length === 0) continue;
        const latestDate = pts[pts.length - 1]?.date;
        if (!latestDate) continue;
        const cutoff = new Date(
          new Date(`${latestDate}T00:00:00Z`).getTime() - 86400000,
        )
          .toISOString()
          .slice(0, 10);
        let base: { date: string; unitValue: number } | undefined;
        for (const p of pts) {
          if (p.date <= cutoff) base = p;
        }
        if (!base || base.unitValue <= 0) continue;
        const unitNow = cardMoney(row).value / row.ownedQty;
        if (unitNow <= 0) continue;
        const deltaTotal = round2(
          (unitNow - base.unitValue) * row.ownedQty,
        );
        if (deltaTotal === 0) continue;
        movers24hAll.push({
          cardId: row.id,
          name: row.fullName,
          groupName: row.groupName,
          printed: row.printed,
          rarity: row.rarity,
          qty: row.ownedQty,
          unitNow: round2(unitNow),
          deltaTotal,
          pct:
            Math.round(((unitNow - base.unitValue) / base.unitValue) * 10000) /
            100,
        });
      }
      movers24hAll.sort(
        (a, b) => Math.abs(b.deltaTotal) - Math.abs(a.deltaTotal),
      );
      const movers24h = movers24hAll.slice(0, 3);

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
        sealedValue: round2(sealedTotals.value),
        sealedQty: sealedTotals.qty,
        sealedDistinct: sealedItems.filter((i) => i.qty > 0).length,
        ranges,
        movers24h,
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
      "Starts the daily re-pricing of the collection: spawns an agent task that fetches current market prices for the owned cards and saves them via saveRepricing (paid amounts stay as recorded). The normal run dedupes to one per day; force: true (the hero box's Reprice Force button) starts a fresh run anyway, under its own one-off key.",
    request: z.object({ force: z.boolean().optional() }),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ started: boolean; taskId: string | null }> {
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
          dedupeKey: args.force
            ? `lorcana-finance-refresh-${today}-force-${Date.now()}`
            : `lorcana-finance-refresh-${today}`,
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
        const stored = await safeBlobUrl(ctx, row.imageBlobKey);
        if (stored) return { url: stored };
        // Stored key but missing bytes: fall through and
        // re-fetch the scan into storage below.
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

  getArtworkWarmup: defineAction({
    description:
      "Returns the card ids for the on-device artwork warm-up in warm-up order — the collector's own cards first, then the rest of the catalog set by set — plus the total artwork count, the current artwork cache generation, and the priority ids (the imaged puzzle inserts, e.g. the Ink Drop counters, then every promo printing) the scanner's fingerprint index must build first, so the client can pre-download every card's browsing artwork in the background and report honest cache progress.",
    request: z.object({}),
    response: z.object({
      total: z.number(),
      ownedTotal: z.number(),
      artworkVersion: z.string(),
      ids: z.array(z.number()),
      priorityIds: z.array(z.number()),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({
          id: schema.cards.id,
          grp: schema.cards.grp,
          ownedQty: schema.cards.ownedQty,
          groupSort: schema.cards.groupSort,
          slotSort: schema.cards.slotSort,
          imageUrl: schema.cards.imageUrl,
        })
        .from(schema.cards);
      const withArt = rows.filter((r) => r.imageUrl != null);
      // Warm-up order (Anthony, Nov 3, 2026): the collector's own
      // collection first (in binder order), then the wider catalog
      // set by set (group order, then collector number).
      const ordered = [...withArt].sort((a, b) => {
        const aOwned = a.ownedQty > 0 ? 0 : 1;
        const bOwned = b.ownedQty > 0 ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
        if (a.groupSort !== b.groupSort) return a.groupSort - b.groupSort;
        return a.slotSort - b.slotSort;
      });
      // Scanner priority (Nov 3, 2026 — Anthony's Ink Drop test;
      // widened Nov 4, 2026): the imaged puzzle inserts are the
      // catalog's only imaged non-card items — the two Ink Drop
      // counters plus, since the all-sets puzzle audit, every
      // puzzle piece and lore card that has a TCGplayer scan and
      // the assembled-art photos. Their unowned, late-group order
      // otherwise leaves them at the very end of the fingerprint
      // build, unfingerprinted long after every ordinary card.
      // They are also the items the vision reader has the least
      // to work with (no collector number, ink, or cost printed),
      // so the on-device index builds them FIRST; the browsing
      // warm-up order above is unchanged.
      // Promo printings join the priority list (Nov 3, 2026,
      // later — Anthony's Queen test: The Queen - Conceited
      // Ruler, Promo Set 3 #3, scanned and was "not even on the
      // list at all"). She is in the catalog, but an unowned
      // promo's fingerprint sat behind every owned main-set
      // card in the build — thousands of downloads — so a scan
      // taken while the index was still building could never
      // return her, and the partial index's wrong candidates
      // were shown as if they were the whole catalog. The promo
      // families are only ~215 printings, so ALL of them now
      // build right after the puzzle inserts: every promo is
      // fingerprint-ready within the first stretch of any index
      // build. (The scanner also cross-checks the full catalog
      // while the index is incomplete — see ScanPanel.)
      const priorityIds = [
        ...ordered.filter((r) => r.grp === "puzzle").map((r) => r.id),
        ...ordered.filter((r) => r.grp === "promo").map((r) => r.id),
      ];
      return {
        total: withArt.length,
        ownedTotal: withArt.filter((r) => r.ownedQty > 0).length,
        artworkVersion: ARTWORK_VERSION,
        ids: ordered.map((r) => r.id),
        priorityIds,
      };
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

  adjustPocketCount: defineAction({
    description:
      "Adjusts one binder pocket's owned count from the set-page grid (Anthony, Nov 4, 2026 — two-across cataloging): the pocket (regular / foil / single) maps to its finish server-side using the same pocket rules as the binder views, the count moves by delta or is set outright, and the write matches updateOwnership (zero entries dropped, total derived, cloud sync). Returns the pocket's new count and the card's new total.",
    request: z.object({
      cardId: z.number().int().positive(),
      pocket: z.enum(["regular", "foil", "single"]),
      delta: z.number().int().min(-999).max(999).optional(),
      setQty: z.number().int().min(0).max(999).optional(),
    }),
    response: z.object({ qty: z.number(), ownedQty: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error(`Unknown card: ${args.cardId}`);
      const pockets = pocketsOf(row);
      const target =
        pockets.find((p) => p.kind === args.pocket) ?? pockets[0];
      if (!target) throw new Error(`Card ${args.cardId} has no pockets`);
      const full = parseFinishes(row.finishes);
      const finishKey =
        Object.keys(target.finishes)[0] ??
        (target.kind === "foil"
          ? row.grp === "promo"
            ? "Promo Foil"
            : "Cold Foil"
          : target.kind === "single" &&
              POCKET_FINISH_LABELS.has(target.label)
            ? target.label
            : "Regular");
      const current = full[finishKey] ?? 0;
      const nextQty = Math.max(
        0,
        Math.min(999, args.setQty ?? current + (args.delta ?? 0)),
      );
      const merged: Record<string, number> = {
        ...full,
        [finishKey]: nextQty,
      };
      const clean: Record<string, number> = {};
      let total = 0;
      for (const [finish, qty] of Object.entries(merged)) {
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
      const updated = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId));
      if (updated[0]) await syncCardToCloud(ctx, updated[0]);
      return { qty: nextQty, ownedQty: total };
    },
  }),

  getCollectorId: defineAction({
    description:
      "Returns Anthony's collector identity for the oval Collector ID card at the top of Home: his chosen username, his stable unique collector code, whether this profile is the app owner's (a fast local check the Home Admin badge gates on, so the badge never waits for the heavy Admin stats), and the URL of the photo he chose for the card. Creates the profile (with his ARUIKIS handle as the starting username) on first read.",
    request: z.object({}),
    response: collectorIdResponse,
    async handler(ctx): Promise<z.infer<typeof collectorIdResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      return {
        username: profile.username,
        collectorCode: profile.collectorCode,
        isOwner: profile.collectorCode === OWNER_COLLECTOR_CODE,
        photoUrl: profile.photoBlobKey
          ? await safeBlobUrl(ctx, profile.photoBlobKey)
          : null,
        bannerUrl: profile.bannerBlobKey
          ? await safeBlobUrl(ctx, profile.bannerBlobKey)
          : null,
        bio: profile.bio ?? null,
        theme: profile.theme ?? null,
        updateTestSeen: profile.updateTestSeen > 0,
        shareCollection: (profile.shareCollection ?? 1) > 0,
        usernameChangeUsed: (profile.usernameChangeUsed ?? 0) > 0,
        gridCols: profile.gridCols ?? null,
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
      "Changes the username shown on the Collector ID card (and encoded in its QR code) — the ONE username change a user gets after registration (Anthony, Nov 3, 2026, late): it lives in Settings, the change is consumed on first use, and after that the username is locked. Letters, numbers, and underscores, 3-20 characters. Registration (the Welcome flow) is the initial set and never goes through here.",
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
      username: z.string(),
      changeUsed: z.boolean(),
      error: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      ok: boolean;
      username: string;
      changeUsed: boolean;
      error: string | null;
    }> {
      const profile = await ensureCollectorProfile(ctx);
      const used = (profile.usernameChangeUsed ?? 0) > 0;
      if (args.username === profile.username) {
        return {
          ok: true,
          username: profile.username,
          changeUsed: used,
          error: null,
        };
      }
      if (used) {
        return {
          ok: false,
          username: profile.username,
          changeUsed: true,
          error:
            "Your username change has already been used — usernames can only be changed one time.",
        };
      }
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          username: args.username,
          usernameChangeUsed: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return {
        ok: true,
        username: args.username,
        changeUsed: true,
        error: null,
      };
    },
  }),

  setThemePreference: defineAction({
    description:
      "Saves the app theme the user picked in Settings (Vault Dark, Light, Midnight Purple, Crimson Ember, High Contrast, or Rainbow) on their collector profile, so the choice persists for them across devices. Presentation only — no collection data changes.",
    request: z.object({
      theme: z.enum([
        "vault",
        "light",
        "midnight",
        "crimson",
        "contrast",
        "rainbow",
      ]),
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

  setGridColsPreference: defineAction({
    description:
      "Saves the set-page grid density the user picked (2 or 4 cards across, Anthony, Nov 4, 2026) on their collector profile, so the one shared choice persists for them across devices and applies to every set/chapter grid in every collection. Presentation only — no collection data changes.",
    request: z.object({
      cols: z.union([z.literal(2), z.literal(4)]),
    }),
    response: z.object({ ok: z.literal(true), cols: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; cols: number }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          gridCols: args.cols,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, cols: args.cols };
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

  setProfileBio: defineAction({
    description:
      "Saves the one-line bio shown on his profile, edited from Edit profile on the profile itself (Anthony, Nov 3, 2026, late). An empty bio clears back to none. Username changes do NOT live here — they stay in Settings under the one-change-ever rule.",
    request: z.object({
      bio: z.string().trim().max(200),
    }),
    response: z.object({ ok: z.literal(true), bio: z.string().nullable() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; bio: string | null }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const bio = args.bio.length > 0 ? args.bio : null;
      await db
        .update(schema.collectorProfile)
        .set({ bio, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true as const, bio };
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
      "Trade Match, the 'You Have, They Need' direction: Anthony's owned cards (by printing and finish) whose EXACT printing (card + finish) the friend does NOT own — matching is per printing, never by card name, so a same-name different printing or a different finish still counts as needed (Anthony, Nov 3, 2026 bug fix) — filtered by search text and set, sorted by value, with the total count.",
    request: z.object({
      excludePrintings: z
        .array(
          z.object({
            cardId: z.number().int().positive(),
            finish: z.string().max(40),
          }),
        )
        .max(2000),
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
        args.excludePrintings.map((p) => `${p.cardId}:${p.finish}`),
      );
      const mine = all.filter(
        (i) =>
          i.cardId != null &&
          !excluded.has(`${i.cardId}:${i.finish}`),
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

  getTradeMatchSummary: defineAction({
    description:
      "Best Matches aggregate for one friend (Trades redesign, Anthony, Nov 3, 2026, late): over ALL of Anthony's printings, the count and total market value of the exact printings (card + finish) the friend does NOT own — the 'they can get' figure — valued on the copies actually available under Anthony's trade-availability settings (tradeableQty). Matching is per exact printing, never by name. The reverse figure (what he can get from the friend) is computed client-side from the friend's loaded items.",
    request: z.object({
      excludePrintings: z
        .array(
          z.object({
            cardId: z.number().int().positive(),
            finish: z.string().max(40),
          }),
        )
        .max(2000),
    }),
    response: z.object({ count: z.number(), value: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ count: number; value: number }> {
      const all = await buildProfileItems(ctx);
      const excluded = new Set(
        args.excludePrintings.map((p) => `${p.cardId}:${p.finish}`),
      );
      let count = 0;
      let value = 0;
      for (const i of all) {
        if (i.cardId == null) continue;
        if (excluded.has(`${i.cardId}:${i.finish}`)) continue;
        count += 1;
        const avail = i.tradeableQty ?? i.qty;
        value += (i.unitValue ?? 0) * avail;
      }
      return { count, value: Math.round(value * 100) / 100 };
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

      // Top four most valuable printings (per-unit value of
      // the exact printing + finish, from the same per-finish
      // prices cardMoney uses; an unpriced finish falls back
      // to the printing's market value, never invented).
      const topValuable: z.infer<
        typeof profileSummaryResponse
      >["topValuable"] = [];
      for (const row of rows) {
        if (row.ownedQty <= 0) continue;
        const finishes = parseFinishes(row.finishes);
        const prices = parseFinance(row.financeJson);
        for (const [finish, qty] of Object.entries(finishes)) {
          if (qty <= 0) continue;
          const unitValue = prices[finish]?.value ?? row.marketValue ?? null;
          if (unitValue == null || unitValue <= 0) continue;
          topValuable.push({
            cardId: row.id,
            name: row.fullName,
            finish,
            unitValue: Math.round(unitValue * 100) / 100,
          });
        }
      }
      topValuable.sort(
        (a, b) => b.unitValue - a.unitValue || a.name.localeCompare(b.name),
      );

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
        topValuable: topValuable.slice(0, 4),
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
        // Auto-settlement sweep (Anthony, Nov 3, 2026): a
        // fully complete trade whose settlement didn't land
        // at feedback time (cloud unreachable, app closed)
        // settles here on read — the stored plan makes the
        // retry exact. Runs after the trust retry so a trade
        // settled in this pass reads back with settledAt set.
        if (t.completedAt && !t.settledAt) {
          await settleTradeIfReady(ctx, t);
          if (t.settledAt == null) {
            const fresh = await db
              .select()
              .from(schema.tradeOffers)
              .where(eq(schema.tradeOffers.id, t.id))
              .limit(1);
            if (fresh[0]?.settledAt) t.settledAt = fresh[0].settledAt;
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
        // Auto-archive sweep (Anthony, Nov 3, 2026, ~11:04
        // PM — his approved rule): the moment a trade reaches
        // an end state — declined, cancelled/withdrawn, or
        // fully complete with feedback resolved (both sides
        // in, or the 7-day neutral close) — it leaves the
        // active Trades list for History. Stamped here on
        // read so it applies retroactively to every finished
        // deal already on the books; active and pending
        // trades, and completed ones still awaiting feedback,
        // are NEVER auto-archived. The record is kept —
        // archiving only files it away.
        const endState =
          t.status === "declined" ||
          t.status === "cancelled" ||
          (t.completedAt != null && feedbackClosed);
        if (endState && t.archivedAt == null) {
          const stamp = new Date().toISOString();
          await db
            .update(schema.tradeOffers)
            .set({ archivedAt: stamp, updatedAt: stamp })
            .where(eq(schema.tradeOffers.id, t.id));
          t.archivedAt = stamp;
        }
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
          settled: t.settledAt != null,
          archived: t.archivedAt != null,
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

  getMuseInviteLink: defineAction({
    description:
      "Returns the collector's own Muse invite link as pasted by them in Settings (Share Vault X), or null when none is saved. The link is the user's own, copied from the Muse app's Invite button — it is only ever read back to its owner and placed inside their own Share Vault X invite message.",
    request: z.object({}),
    response: z.object({ museInviteLink: z.string().nullable() }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      return { museInviteLink: profile.museInviteLink ?? null };
    },
  }),

  setMuseInviteLink: defineAction({
    description:
      "Saves (or, with an empty value, clears) the collector's own Muse invite link, pasted by the user in Settings from the Muse app's Invite button. The Share Vault X message includes this stored link so a new Muse sign-up is credited to the sharer. The value must be a web link; anything else is rejected with an explanation.",
    request: z.object({ link: z.string().max(600) }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      museInviteLink: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const value = args.link.trim();
      if (value !== "" && !/^https?:\/\/\S+$/i.test(value))
        return {
          ok: false,
          error:
            "That doesn't look like a link — paste the full invite link from the Muse app's Invite button.",
          museInviteLink: null,
        };
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const saved = value === "" ? null : value;
      await db
        .update(schema.collectorProfile)
        .set({ museInviteLink: saved, updatedAt: new Date().toISOString() })
        .where(eq(schema.collectorProfile.id, profile.id));
      return { ok: true, error: null, museInviteLink: saved };
    },
  }),

  getCollectionVisibility: defineAction({
    description:
      "Which of the six Home 'Your Collections' tiles this user has hidden in Settings, and the order they arranged the tiles in by long-hold drag on Home (Anthony, Nov 3, 2026): returns the hidden tile keys (everything not listed is shown) and the full resolved tile order (saved order first, unordered tiles in default position). Display-only — hiding or reordering deletes nothing and affects no totals.",
    request: z.object({}),
    response: z.object({
      hidden: z.array(z.string()),
      order: z.array(z.string()),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      return {
        hidden: parseHiddenCollections(profile.hiddenCollections),
        order: resolveCollectionOrder(profile.collectionOrder),
      };
    },
  }),

  setCollectionOrder: defineAction({
    description:
      "Saves the order of the Home 'Your Collections' tiles for this user (Anthony, Nov 3, 2026, late): set by long-holding a tile on Home and dragging it to a new spot; persists on their profile like the tile show/hide choices and the theme. Display-only.",
    request: z.object({
      order: z.array(
        z.enum([
          "lorcana",
          "pokemon",
          "magic",
          "lego",
          "comics",
          "starwars",
        ]),
      ),
    }),
    response: z.object({
      ok: z.literal(true),
      order: z.array(z.string()),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; order: string[] }> {
      const profile = await ensureCollectorProfile(ctx);
      const order = resolveCollectionOrder(JSON.stringify(args.order));
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          collectionOrder: JSON.stringify(order),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return { ok: true as const, order };
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

  getGameCatalog: defineAction({
    description:
      "One other game's catalog overview (Pokémon, Magic: The Gathering, or Star Wars: Unlimited): its sets with printing counts and owned counts, plus the catalog download progress (sets done of total, printings cataloged, complete) from the resumable importer.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars"]),
    }),
    response: z.object({
      sections: z.array(
        z.object({
          key: z.string(),
          name: z.string(),
          total: z.number(),
          owned: z.number(),
        }),
      ),
      cardsTotal: z.number(),
      ownedTotal: z.number(),
      setsTotal: z.number(),
      setsDone: z.number(),
      complete: z.boolean(),
      started: z.boolean(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({
          key: schema.gameCards.sectionKey,
          name: schema.gameCards.sectionName,
          sort: sql<number>`min(${schema.gameCards.sectionSort})`,
          total: sql<number>`count(*)`,
          owned: sql<number>`coalesce(sum(${schema.gameCards.ownedQty}), 0)`,
        })
        .from(schema.gameCards)
        .where(eq(schema.gameCards.game, args.game))
        .groupBy(schema.gameCards.sectionKey, schema.gameCards.sectionName)
        .orderBy(asc(sql`min(${schema.gameCards.sectionSort})`));
      const meta = await readImportMeta(ctx, args.game);
      const cardsTotal = rows.reduce((s, r) => s + r.total, 0);
      return {
        sections: rows.map((r) => ({
          key: r.key,
          name: r.name,
          total: r.total,
          owned: r.owned,
        })),
        cardsTotal,
        ownedTotal: rows.reduce((s, r) => s + r.owned, 0),
        setsTotal: meta?.setsTotal ?? 0,
        setsDone: meta?.setsDone ?? 0,
        complete: (meta?.complete ?? 0) > 0,
        started: meta != null,
      };
    },
  }),

  getGameSection: defineAction({
    description:
      "One set's printings inside a game catalog, in collector-number order, paged (150 at a time): name, number, rarity/finish, artwork link, price where the source publishes one, and the collector's owned count (0 = missing/ghosted).",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars"]),
      sectionKey: z.string().min(1).max(80),
      offset: z.number().int().min(0).max(200000).default(0),
    }),
    response: z.object({
      sectionName: z.string(),
      total: z.number(),
      cards: z.array(
        z.object({
          id: z.number(),
          uid: z.string(),
          number: z.string().nullable(),
          printed: z.string(),
          name: z.string(),
          rarity: z.string().nullable(),
          finish: z.string().nullable(),
          imageUrl: z.string().nullable(),
          price: z.number().nullable(),
          ownedQty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const countRows = await db
        .select({ c: sql<number>`count(*)` })
        .from(schema.gameCards)
        .where(
          and(
            eq(schema.gameCards.game, args.game),
            eq(schema.gameCards.sectionKey, args.sectionKey),
          ),
        );
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(
          and(
            eq(schema.gameCards.game, args.game),
            eq(schema.gameCards.sectionKey, args.sectionKey),
          ),
        )
        .orderBy(asc(schema.gameCards.slotSort), asc(schema.gameCards.id))
        .limit(150)
        .offset(args.offset);
      return {
        sectionName: rows[0]?.sectionName ?? args.sectionKey,
        total: countRows[0]?.c ?? 0,
        cards: rows.map((r) => ({
          id: r.id,
          uid: r.uid,
          number: r.number,
          printed: r.printed,
          name: r.name,
          rarity: r.rarity,
          finish: r.finish,
          imageUrl: r.imageUrl,
          price: r.price,
          ownedQty: r.ownedQty,
        })),
      };
    },
  }),

  searchGameCards: defineAction({
    description:
      "Searches one game catalog by card name (a trailing number narrows to that collector number, the same rule as the Lorcana search): up to 60 printings with their set, number, artwork link, price, and owned count — the add-by-search path for the new games.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars"]),
      query: z.string().trim().min(1).max(80),
    }),
    response: z.object({
      results: z.array(
        z.object({
          id: z.number(),
          sectionKey: z.string(),
          sectionName: z.string(),
          printed: z.string(),
          name: z.string(),
          rarity: z.string().nullable(),
          finish: z.string().nullable(),
          imageUrl: z.string().nullable(),
          price: z.number().nullable(),
          ownedQty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const q = args.query.trim();
      const numMatch = q.match(/^(.*?)\s+(\d{1,4})$/);
      const namePart = (numMatch ? numMatch[1]! : q).trim();
      const numPart = numMatch ? numMatch[2]! : null;
      const conds = [eq(schema.gameCards.game, args.game)];
      if (namePart) conds.push(like(schema.gameCards.name, `%${namePart}%`));
      if (numPart) conds.push(like(schema.gameCards.printed, `${numPart}/%`));
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(and(...conds))
        .orderBy(asc(schema.gameCards.sectionSort), asc(schema.gameCards.slotSort))
        .limit(60);
      return {
        results: rows.map((r) => ({
          id: r.id,
          sectionKey: r.sectionKey,
          sectionName: r.sectionName,
          printed: r.printed,
          name: r.name,
          rarity: r.rarity,
          finish: r.finish,
          imageUrl: r.imageUrl,
          price: r.price,
          ownedQty: r.ownedQty,
        })),
      };
    },
  }),

  setGameCardOwned: defineAction({
    description:
      "Sets how many copies of one Pokémon/Magic/Star Wars printing the collector owns (0 = missing, shown ghosted). Only the owned count changes; catalog data is untouched.",
    request: z.object({
      id: z.number().int(),
      ownedQty: z.number().int().min(0).max(999),
    }),
    response: z.object({ ok: z.literal(true), ownedQty: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; ownedQty: number }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.gameCards)
        .set({ ownedQty: args.ownedQty })
        .where(eq(schema.gameCards.id, args.id));
      ctx.invalidateQueries();
      return { ok: true as const, ownedQty: args.ownedQty };
    },
  }),

  importGameCatalog: defineAction({
    description:
      "Downloads the next chunk of one game's catalog from its canonical free source (Pokémon: PokemonTCG/pokemon-tcg-data; Magic: Scryfall; Star Wars: Unlimited: Fantasy Flight's official card API) into game_cards and returns the running progress. Resumable: each call continues where the last stopped until the catalog is complete; existing printings and owned counts are never overwritten.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars"]),
    }),
    response: z.object({
      ok: z.boolean(),
      setsTotal: z.number(),
      setsDone: z.number(),
      cardsTotal: z.number(),
      complete: z.boolean(),
      message: z.string(),
    }),
    async handler(ctx, args) {
      const meta = await readImportMeta(ctx, args.game);
      let state: ImportState = {};
      if (meta?.state) {
        try {
          state = JSON.parse(meta.state) as ImportState;
        } catch {
          state = {};
        }
      }
      try {
        const r =
          args.game === "pokemon"
            ? await importPokemonChunk(ctx, state)
            : args.game === "magic"
              ? await importMagicChunk(ctx, state)
              : await importStarwarsChunk(ctx, state);
        const cardsTotal = await saveImportMeta(
          ctx,
          args.game,
          r.state,
          r.setsTotal,
          r.setsDone,
          r.complete,
        );
        ctx.invalidateQueries();
        return {
          ok: true,
          setsTotal: r.setsTotal,
          setsDone: r.setsDone,
          cardsTotal,
          complete: r.complete,
          message: r.complete
            ? "Catalog complete."
            : "Chunk imported; more remains.",
        };
      } catch (e) {
        // Persist whatever the chunk managed to set up (the
        // set list / cursor live on the state object) so the
        // next call resumes instead of starting over.
        try {
          const setsTotal =
            state.sets?.length ?? state.totalPages ?? meta?.setsTotal ?? 0;
          const setsDone =
            state.cursor ??
            (state.page != null ? state.page - 1 : (meta?.setsDone ?? 0));
          await saveImportMeta(
            ctx,
            args.game,
            state,
            setsTotal,
            setsDone,
            false,
          );
        } catch {
          // Saving progress is best-effort; the error below stands.
        }
        return {
          ok: false,
          setsTotal: meta?.setsTotal ?? 0,
          setsDone: meta?.setsDone ?? 0,
          cardsTotal: meta?.cardsTotal ?? 0,
          complete: (meta?.complete ?? 0) > 0,
          message:
            e instanceof Error
              ? `Source unreachable this time (${e.message.slice(0, 120)}) — progress is saved; try again.`
              : "Source unreachable this time — progress is saved; try again.",
        };
      }
    },
  }),

  getValuePrivacy: defineAction({
    description:
      "Whether this collector hides their total collection value from other collectors on their profile (Anthony, Nov 3, 2026): one flag read by both controls — the Settings switch and the hide button above the value on their own profile — so the two always agree.",
    request: z.object({}),
    response: z.object({ hideValue: z.boolean() }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      return { hideValue: profile.hideCollectionValue === 1 };
    },
  }),

  setValuePrivacy: defineAction({
    description:
      "Sets whether this collector's total collection value is hidden from other collectors on their profile (Anthony, Nov 3, 2026): driven by the Settings switch and by the hide button above the value on their own profile — one flag, both controls. The owner always sees their own value either way.",
    request: z.object({ hideValue: z.boolean() }),
    response: z.object({
      ok: z.literal(true),
      hideValue: z.boolean(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; hideValue: boolean }> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          hideCollectionValue: args.hideValue ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return { ok: true as const, hideValue: args.hideValue };
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
      /** The deck box's body color id (Anthony, Nov 3, 2026,
          ~12:00 PM). Optional: omitted leaves the stored
          color untouched on update. */
      color: z.string().trim().max(24).nullable().optional(),
      /** The box window's featured card: must be one of the
          deck's own lines, else it is stored as unpicked.
          Optional like color. */
      featuredCardId: z
        .number()
        .int()
        .positive()
        .nullable()
        .optional(),
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
      // The featured card must be one of the deck's own
      // lines; anything else stores as unpicked (the box
      // falls back to the deck's signature card).
      const featuredCardId =
        args.featuredCardId != null &&
        lines.some((l) => l.cardId === args.featuredCardId)
          ? args.featuredCardId
          : null;
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
          .set({
            name: args.name,
            cardsJson,
            updatedAt: now,
            ...(args.color !== undefined
              ? { color: args.color }
              : {}),
            ...(args.featuredCardId !== undefined
              ? { featuredCardId }
              : {}),
          })
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
          color: args.color ?? null,
          featuredCardId,
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

  createVillageAggroDeck: defineAction({
    description:
      "Creates Anthony's locked 60-card Village Aggro deck (Amber/Emerald) in his My Decks, on display, from the exact list he approved Nov 3, 2026: each named card is resolved to a printing he owns enough copies of (an Amber/Emerald printing preferred, then the printing he owns most of), and each used quantity is assigned in 'Where it lives' to the 'Village Aggro' deck location, leaving other copies' locations untouched. Idempotent: if the deck already exists, it is reported and nothing is changed or duplicated.",
    request: z.object({}),
    response: z.object({
      ok: z.boolean(),
      created: z.boolean(),
      deckId: z.number().nullable(),
      totalCards: z.number(),
      inventoryValue: z.number(),
      error: z.string().nullable(),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const fail = (error: string) => ({
        ok: false,
        created: false,
        deckId: null,
        totalCards: 0,
        inventoryValue: 0,
        error,
      });
      const existing = await db
        .select()
        .from(schema.decks)
        .where(eq(schema.decks.ownerCode, profile.collectorCode));
      const already = existing.find(
        (d) => d.name === VILLAGE_AGGRO_DECK_NAME,
      );
      if (already) {
        const view = await deckViewOf(ctx, already);
        return {
          ok: true,
          created: false,
          deckId: already.id,
          totalCards: view.totalCards,
          inventoryValue: view.inventoryValue,
          error: null,
        };
      }
      // Resolve every name to an owned printing BEFORE
      // writing anything, so a list that cannot be built
      // from his collection fails whole and honest.
      const norm = (s: string) =>
        s.replace(/’/g, "'").toLowerCase().trim();
      const allRows = await db.select().from(schema.cards);
      const lines: { cardId: number; qty: number }[] = [];
      for (const want of VILLAGE_AGGRO_LIST) {
        const candidates = allRows
          .filter(
            (r) =>
              norm(r.fullName) === norm(want.fullName) &&
              r.ownedQty >= want.qty,
          )
          .sort((a, b) => {
            const aInk =
              a.ink === "Amber" || a.ink === "Emerald" ? 0 : 1;
            const bInk =
              b.ink === "Amber" || b.ink === "Emerald" ? 0 : 1;
            if (aInk !== bInk) return aInk - bInk;
            if (b.ownedQty !== a.ownedQty)
              return b.ownedQty - a.ownedQty;
            return a.id - b.id;
          });
        const pick = candidates[0];
        if (!pick) {
          return fail(
            `Not enough owned copies of ${want.fullName} to build the deck as locked — nothing was created.`,
          );
        }
        lines.push({ cardId: pick.id, qty: want.qty });
      }
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.decks)
        .values({
          ownerCode: profile.collectorCode,
          name: VILLAGE_AGGRO_DECK_NAME,
          cardsJson: JSON.stringify(lines),
          displayed: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.decks.id });
      const deckId = inserted[0]?.id ?? null;
      if (deckId == null) return fail("The deck could not be saved.");
      // Location assignment (Anthony, Nov 3, 2026): the used
      // quantity of each card lives in the "Village Aggro"
      // deck location; any existing row for that exact spot
      // is set to the deck quantity, and no other location
      // rows are touched.
      for (const line of lines) {
        const locs = await db
          .select()
          .from(schema.itemLocations)
          .where(eq(schema.itemLocations.cardId, line.cardId));
        const mine = locs.find(
          (l) =>
            l.targetKind === "card" &&
            l.locType === "deck_box" &&
            l.place === VILLAGE_AGGRO_DECK_NAME,
        );
        if (mine) {
          if (mine.qty !== line.qty) {
            await db
              .update(schema.itemLocations)
              .set({ qty: line.qty })
              .where(eq(schema.itemLocations.id, mine.id));
          }
        } else {
          await db.insert(schema.itemLocations).values({
            targetKind: "card",
            cardId: line.cardId,
            sealedName: null,
            comicId: null,
            locType: "deck_box",
            place: VILLAGE_AGGRO_DECK_NAME,
            spot: null,
            qty: line.qty,
            createdAt: now,
          });
        }
      }
      const view = await deckViewOf(ctx, {
        id: deckId,
        ownerCode: profile.collectorCode,
        name: VILLAGE_AGGRO_DECK_NAME,
        color: null,
        featuredCardId: null,
        cardsJson: JSON.stringify(lines),
        copiedFromCode: null,
        copiedFromUsername: null,
        sourceDeckName: null,
        displayed: 1,
        createdAt: now,
        updatedAt: now,
      });
      ctx.invalidateQueries();
      return {
        ok: true,
        created: true,
        deckId,
        totalCards: view.totalCards,
        inventoryValue: view.inventoryValue,
        error: null,
      };
    },
  }),

  getDisplayedDecks: defineAction({
    description:
      "The decks another collector has ON DISPLAY on their My Decks page (Anthony, Nov 3, 2026 — copy-a-deck): only displayed decks are ever returned, so only a displayed deck can be viewed or copied. The built-in test friend's displayed deck is built from his known stock; any other collector's displayed decks come from their stored decks under their collector code.",
    request: z.object({
      ownerCode: z.string().min(1).max(64),
    }),
    response: z.object({
      ownerCode: z.string(),
      decks: z.array(deckView),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (args.ownerCode === JARVIS_REGISTRY_PROFILE.collector_id) {
        const view = await jarvisDeckView(ctx);
        return {
          ownerCode: args.ownerCode,
          decks: view ? [view] : [],
        };
      }
      const rows = await db
        .select()
        .from(schema.decks)
        .where(eq(schema.decks.ownerCode, args.ownerCode))
        .orderBy(asc(schema.decks.createdAt));
      const decks = [];
      for (const row of rows) {
        if (row.displayed <= 0) continue;
        decks.push(await deckViewOf(ctx, row));
      }
      return { ownerCode: args.ownerCode, decks };
    },
  }),

  copyDeck: defineAction({
    description:
      "Copies another collector's DISPLAYED deck into the signed-in collector's My Decks (Anthony, Nov 3, 2026 — copy-a-deck): the copy keeps the source deck's name, card list, box color, and featured card, is attributed to its source (copied-from collector code, username, and deck name), starts off display, and is NOT validated against the copier's collection — copying a deck you don't fully own yet is the point, and the response carries the collection check (full owned quantities) so the copier sees exactly what they're missing. Copying your own deck, or a deck that is not on display, is refused.",
    request: z.object({
      ownerCode: z.string().min(1).max(64),
      ownerUsername: z.string().min(1).max(60),
      deckId: z.number().int(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      deckId: z.number().nullable(),
      deckName: z.string().nullable(),
      check: deckCheck.nullable(),
    }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (args.ownerCode === profile.collectorCode) {
        return {
          ok: false,
          error: "That's your own deck — it's already in your My Decks.",
          deckId: null,
          deckName: null,
          check: null,
        };
      }
      const db = ctx.db<typeof schema>();
      let name: string;
      let color: string | null;
      let featuredCardId: number | null;
      let lines: { cardId: number; qty: number }[];
      if (
        args.ownerCode === JARVIS_REGISTRY_PROFILE.collector_id &&
        args.deckId === JARVIS_DECK_ID
      ) {
        lines = await jarvisDeckCardLines(ctx);
        if (lines.length === 0) {
          return {
            ok: false,
            error: "That deck couldn't be read — try again.",
            deckId: null,
            deckName: null,
            check: null,
          };
        }
        name = JARVIS_DECK_NAME;
        color = JARVIS_DECK_COLOR;
        featuredCardId = null;
      } else {
        const rows = await db
          .select()
          .from(schema.decks)
          .where(eq(schema.decks.id, args.deckId))
          .limit(1);
        const source = rows[0];
        if (
          !source ||
          source.ownerCode !== args.ownerCode ||
          source.displayed <= 0
        ) {
          return {
            ok: false,
            error:
              "That deck isn't on display, so it can't be copied.",
            deckId: null,
            deckName: null,
            check: null,
          };
        }
        name = source.name;
        color = source.color ?? null;
        featuredCardId = source.featuredCardId ?? null;
        lines = parseDeckCards(source.cardsJson);
      }
      const now = new Date().toISOString();
      const inserted = await db
        .insert(schema.decks)
        .values({
          ownerCode: profile.collectorCode,
          name,
          cardsJson: JSON.stringify(lines),
          displayed: 0,
          color,
          featuredCardId:
            featuredCardId != null &&
            lines.some((l) => l.cardId === featuredCardId)
              ? featuredCardId
              : null,
          copiedFromCode: args.ownerCode,
          copiedFromUsername: args.ownerUsername,
          sourceDeckName: name,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schema.decks.id });
      const check = await checkDeckLines(ctx, lines);
      ctx.invalidateQueries();
      return {
        ok: true,
        error: null,
        deckId: inserted[0]?.id ?? null,
        deckName: name,
        check,
      };
    },
  }),

  checkDeck: defineAction({
    description:
      "Checks a deck list against the signed-in collector's own collection (Anthony, Nov 3, 2026 — copy-a-deck's collection check): full owned quantities (the deck-building rule, not trade availability) — headline totals (you have X of the deck, you need Y more), a per-card breakdown (deck needs N, you own M, shortfall), the buy list of just the missing copies, and their estimated cost at current prices with unpriced copies disclosed.",
    request: z.object({
      lines: z
        .array(
          z.object({
            cardId: z.number().int().positive(),
            qty: z.number().int().min(1).max(60),
          }),
        )
        .min(1)
        .max(240),
    }),
    response: z.object({ check: deckCheck }),
    async handler(ctx, args) {
      const merged = new Map<number, number>();
      for (const l of args.lines)
        merged.set(l.cardId, (merged.get(l.cardId) ?? 0) + l.qty);
      const lines = [...merged.entries()].map(([cardId, qty]) => ({
        cardId,
        qty,
      }));
      return { check: await checkDeckLines(ctx, lines) };
    },
  }),

  requestDeckBuyList: defineAction({
    description:
      "Sends a copied deck's buy list (the missing copies from its collection check) to the collector's own Muse (Anthony, Nov 3, 2026 — copy-a-deck extension) — only after the user's explicit per-run confirmation in the app naming the destination (TCGplayer, via their Muse) and the payload (TCGplayer product IDs and quantities only; confirmed: true): hands Jarvis only those public product identifiers to prepare a TCGplayer cart on the collector's own account. Vault X itself cannot reach TCGplayer or the collector's Muse account — this spawns the agent task the same way the set completion Buy button does; the receiving Muse does the TCGplayer work under the collector's own sign-in, Near Mint only, no single-card package over $3 shipping, and never checks out — final payment approval stays with the collector. Works for the whole buy list or a single card's missing copies.",
    request: z.object({
      deckName: z.string().trim().min(1).max(80),
      items: z
        .array(
          z.object({
            cardId: z.number().int().positive(),
            qty: z.number().int().min(1).max(60),
          }),
        )
        .min(1)
        .max(240),
      /** The per-run confirmation from the app: the user saw
          exactly what would be sent (the named cards and
          quantities, the deck's name, their username) and
          where (TCGplayer, via their Muse), and tapped
          Send. The handoff never starts without it. */
      confirmed: z.literal(true),
    }),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
      count: z.number(),
      estimatedCost: z.number(),
      unpricedMissing: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const merged = new Map<number, number>();
      for (const l of args.items)
        merged.set(l.cardId, (merged.get(l.cardId) ?? 0) + l.qty);
      const lines: {
        name: string;
        set: string;
        printed: string;
        qty: number;
        unitPrice: number | null;
        tcgplayerId: string | null;
      }[] = [];
      let copies = 0;
      let estimatedCost = 0;
      let unpricedMissing = 0;
      for (const [cardId, qty] of merged) {
        const rows = await db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, cardId))
          .limit(1);
        const card = rows[0];
        if (!card) continue;
        const unitPrice = printingUnitPrice(card);
        copies += qty;
        if (unitPrice != null) estimatedCost += unitPrice * qty;
        else unpricedMissing += qty;
        lines.push({
          name: card.fullName,
          set: card.groupName,
          printed: card.printed,
          qty,
          unitPrice,
          tcgplayerId: tcgIdOf(card),
        });
      }
      if (lines.length === 0) {
        return {
          started: false,
          taskId: null,
          count: 0,
          estimatedCost: 0,
          unpricedMissing: 0,
        };
      }
      estimatedCost = Math.round(estimatedCost * 100) / 100;
      const today = new Date().toISOString().slice(0, 10);
      const itemLines = lines.flatMap((l) =>
        l.tcgplayerId
          ? [`- TCGplayer ID ${l.tcgplayerId} — quantity ${l.qty}`]
          : [],
      );
      if (itemLines.length === 0) {
        return {
          started: false,
          taskId: null,
          count: copies,
          estimatedCost,
          unpricedMissing,
        };
      }
      const result = await ctx.agent.spawnTask(
        [
          `The user explicitly confirmed this individual buy handoff in Vault X. Prepare a TCGplayer cart for the ${itemLines.length} product entries below. Only public TCGplayer product identifiers and quantities are included; do not substitute products.`,
          "Rules (the collector's standing TCGplayer rules): Near Mint copies only. Optimize sellers to keep packages few. NEVER keep a single-card package whose shipping is over $3 — swap that product to a Near Mint option with shipping of $3 or less, or leave the product out and report it. A multi-card package whose shipping runs a little over $3 is fine. Add only the listed product IDs to the cart on TCGplayer under the collector's own sign-in, but DO NOT check out and DO NOT pay — final payment approval always stays with the collector. When the cart is prepared, report back in the main chat: the package count, the item total, the shipping total, the grand total before tax, and any product IDs left out (with why).",
          "Product IDs:",
          ...itemLines,
        ].join("\n"),
        {
          dedupeKey: `lorcana-deck-buy-${args.deckName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${[...merged.keys()].sort((a, b) => a - b).join(".")}-${today}`,
        },
      );
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
        count: copies,
        estimatedCost,
        unpricedMissing,
      };
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

  archiveDeal: defineAction({
    description:
      "Archives one FINISHED trade offer or cash purchase order by hand (Anthony, Nov 3, 2026, ~11:04 PM — the manual half of the auto-archive rule): either side of the deal may file it into the Trades History section sooner than the automatic end-state sweep. Only finished deals qualify — declined, cancelled/withdrawn, or completed (both sides confirmed). Active and pending deals can never be archived. The record is never deleted.",
    request: z.object({
      kind: z.enum(["trade", "cash"]),
      id: z.number().int().positive(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: boolean; error: string | null }> {
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const stamp = new Date().toISOString();
      if (args.kind === "trade") {
        const rows = await db
          .select()
          .from(schema.tradeOffers)
          .where(eq(schema.tradeOffers.id, args.id))
          .limit(1);
        const t = rows[0];
        if (!t) return { ok: false, error: "That trade is gone." };
        if (t.proposerCode !== me && t.partnerCode !== me)
          return { ok: false, error: "That trade isn't yours to archive." };
        const finished =
          t.status === "declined" ||
          t.status === "cancelled" ||
          t.completedAt != null;
        if (!finished)
          return {
            ok: false,
            error: "Only a finished trade can be archived — this one is still active.",
          };
        if (t.archivedAt == null) {
          await db
            .update(schema.tradeOffers)
            .set({ archivedAt: stamp, updatedAt: stamp })
            .where(eq(schema.tradeOffers.id, t.id));
        }
        return { ok: true, error: null };
      }
      const rows = await db
        .select()
        .from(schema.cashPurchases)
        .where(eq(schema.cashPurchases.id, args.id))
        .limit(1);
      const p = rows[0];
      if (!p) return { ok: false, error: "That purchase order is gone." };
      if (p.buyerCode !== me && p.sellerCode !== me)
        return { ok: false, error: "That order isn't yours to archive." };
      const finished =
        p.status === "declined" ||
        p.status === "cancelled" ||
        p.completedAt != null;
      if (!finished)
        return {
          ok: false,
          error: "Only a finished purchase order can be archived — this one is still active.",
        };
      if (p.archivedAt == null) {
        await db
          .update(schema.cashPurchases)
          .set({ archivedAt: stamp, updatedAt: stamp })
          .where(eq(schema.cashPurchases.id, p.id));
      }
      return { ok: true, error: null };
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
      // Auto-settlement trigger (Anthony, Nov 3, 2026): if
      // this was the second side's feedback, the trade is
      // fully complete — settle the agreed lists into both
      // collections now (best-effort; the read sweep retries
      // any failure).
      const freshTrade = await db
        .select()
        .from(schema.tradeOffers)
        .where(eq(schema.tradeOffers.id, trade.id))
        .limit(1);
      if (freshTrade[0]) await settleTradeIfReady(ctx, freshTrade[0]);
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
        // Auto-settlement sweep, the cash twin of the one in
        // getTrades: settle a fully complete purchase whose
        // settlement hasn't landed yet.
        if (p.completedAt && !p.settledAt) {
          await settleCashIfReady(ctx, p);
          if (p.settledAt == null) {
            const fresh = await db
              .select()
              .from(schema.cashPurchases)
              .where(eq(schema.cashPurchases.id, p.id))
              .limit(1);
            if (fresh[0]?.settledAt) p.settledAt = fresh[0].settledAt;
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
        // Auto-archive sweep, the cash twin of the one in
        // getTrades (Anthony, Nov 3, 2026, ~11:04 PM — his
        // approved rule): an order at an end state —
        // declined, cancelled/withdrawn, or fully complete
        // with feedback resolved — is stamped archived on
        // read (retroactive to every finished order) and so
        // leaves the active list for History. Pending and
        // in-progress orders, and completed ones still
        // awaiting feedback, never auto-archive.
        const endState =
          p.status === "declined" ||
          p.status === "cancelled" ||
          (p.completedAt != null && feedbackClosed);
        if (endState && p.archivedAt == null) {
          const stamp = new Date().toISOString();
          await db
            .update(schema.cashPurchases)
            .set({ archivedAt: stamp, updatedAt: stamp })
            .where(eq(schema.cashPurchases.id, p.id));
          p.archivedAt = stamp;
        }
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
          settled: p.settledAt != null,
          archived: p.archivedAt != null,
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
      // Auto-settlement trigger, same rule as trades: the
      // second side's feedback completes the purchase, and
      // the bought copies move seller -> buyer.
      const freshPurchase = await db
        .select()
        .from(schema.cashPurchases)
        .where(eq(schema.cashPurchases.id, purchase.id))
        .limit(1);
      if (freshPurchase[0]) await settleCashIfReady(ctx, freshPurchase[0]);
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
      // the fill only offers EXACT printings (card + finish)
      // he does not own (printing-level matching, Nov 3,
      // 2026: name-level exclusion hid Anthony's other
      // printings of the same-named cards from the fill).
      const friendPrintings: Set<string> = new Set(
        JARVIS_TRADE_STOCK.map((s) => `${s.cardId}:${s.finish}`),
      );
      const candidates: {
        card: typeof schema.cards.$inferSelect;
        finish: string;
        unit: number;
        avail: number;
      }[] = [];
      for (const card of cardRows) {
        const finishes = parseFinishes(card.finishes);
        const tradeable = tradeableForFinishes(
          finishes,
          availability,
          deckMap.get(card.id) ?? 0,
        );
        for (const [finish] of Object.entries(finishes)) {
          if (friendPrintings.has(`${card.id}:${finish}`)) continue;
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
          series: { usersByDay: [], tradesByDay: [], usersCumulative: [] },
          deals: null,
          system: { ...systemBase, storedRows: 0, storage: EMPTY_STORAGE },
          changedKeys: [],
          changes: [],
          own,
          computedAt: new Date().toISOString(),
        };
      }

      // Admin speed fix (Nov 3, 2026 — the ~10s Admin page):
      // the phases below used to run strictly one after another
      // (registry reads → local deal counts → storage estimates),
      // so the page paid the SUM of every phase. The local deal
      // counts and the storage estimates don't depend on the
      // registry reads at all, so their promises start NOW and
      // run while the network reads are in flight; they're only
      // awaited where their results are consumed, far below.
      const dealsPromise = Promise.all([
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
      const storagePromise = Promise.all([
        supabaseTableEstimate("profiles"),
        supabaseTableEstimate("collection_items"),
        supabaseTableEstimate("connections"),
        supabaseTableEstimate("trust_events"),
        supabaseFileStorage(),
      ]);

      const [profilesRes, itemsRes, connectionsRes, trustRes] =
        await Promise.all([
          supabaseRest(
            "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
          ),
          // Paged: the server caps one response at 1,000 rows, and
          // with full collection backups live there are thousands.
          // Pages used to be fetched strictly one at a time — the
          // single biggest slice of the old ~10s — so they now go
          // out four at a time and stop at the first short page.
          (async () => {
            const all: unknown[] = [];
            for (let base = 0; ; base += 4000) {
              const pages = await Promise.all(
                [0, 1000, 2000, 3000].map((step) =>
                  supabaseRest(
                    `collection_items?select=owner_collector_id,display_name,qty,kind&order=owner_collector_id.asc,item_key.asc&limit=1000&offset=${base + step}`,
                  ),
                ),
              );
              let shortSeen = false;
              for (const page of pages) {
                if (shortSeen) break;
                if (!page.ok || !Array.isArray(page.json)) {
                  // A failed page fails the whole read, as
                  // before — partial item counts are never
                  // presented as the real totals.
                  return { ok: false, status: page.status, json: all };
                }
                all.push(...page.json);
                if (page.json.length < 1000) shortSeen = true;
              }
              if (shortSeen) break;
            }
            return { ok: true, status: 200, json: all };
          })(),
          supabaseRest(
            "connections?select=collector_a,collector_b,status&limit=5000",
          ),
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

      // Connections, parsed once for the roster: each
      // collector's own CONFIRMED connection count (the
      // Registered Collectors detail page, Nov 3, 2026). A
      // connection counts for BOTH collectors on it, and
      // only "confirmed" rows count — the same rule the
      // profile stats use. The aggregate totals further
      // down keep reading connectionsRes directly.
      const confirmedByCollector = new Map<string, number>();
      if (connectionsRes.ok && Array.isArray(connectionsRes.json)) {
        for (const raw of connectionsRes.json) {
          if (typeof raw !== "object" || raw === null) continue;
          const r = raw as Record<string, unknown>;
          if (
            r.status === "confirmed" &&
            typeof r.collector_a === "string" &&
            typeof r.collector_b === "string"
          ) {
            confirmedByCollector.set(
              r.collector_a,
              (confirmedByCollector.get(r.collector_a) ?? 0) + 1,
            );
            if (r.collector_b !== r.collector_a) {
              confirmedByCollector.set(
                r.collector_b,
                (confirmedByCollector.get(r.collector_b) ?? 0) + 1,
              );
            }
          }
        }
      }

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const roster = profiles.map((p) => ({
        collectorId: p.collector_id,
        username: p.username,
        trustScore: p.trust_score,
        itemsOwned: itemsByOwner.get(p.collector_id) ?? 0,
        connections: connectionsRes.ok
          ? (confirmedByCollector.get(p.collector_id) ?? 0)
          : null,
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
            avgTrustScore:
              profiles.length > 0
                ? Math.round(
                    (profiles.reduce(
                      (sum, p) => sum + (p.trust_score || 0),
                      0,
                    ) /
                      profiles.length) *
                      10,
                  ) / 10
                : 0,
            collectorsWithItems: roster.filter(
              (r) => r.itemsOwned > 0,
            ).length,
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
      // Cumulative collectors line: everyone registered before
      // the 14-day window is the baseline; each day adds that
      // day's new registrations from usersByDay.
      const windowStart = last14[0]?.date ?? "";
      const baseline = profiles.filter(
        (p) =>
          typeof p.created_at === "string" &&
          p.created_at.slice(0, 10) < windowStart,
      ).length;
      let running = baseline;
      const usersCumulative = usersByDay.map((d) => {
        running += d.count;
        return { date: d.date, label: d.label, count: running };
      });

      // Deal flow from the app's own database: trades and cash
      // purchases by state, marketplace listings and completed
      // deals, and how many change requests are waiting. (The
      // queries themselves started at the top of this handler —
      // see dealsPromise — so this await is normally instant.)
      const [tradeRows, cashRows, listingRows, offerRows, requestRows] =
        await dealsPromise;
      const deals = {
        tradesProposed: tradeRows.filter((r) => r.status === "pending")
          .length,
        tradesAccepted: tradeRows.filter((r) => r.status === "accepted")
          .length,
        tradesCompleted: tradeRows.filter((r) => r.completedAt != null)
          .length,
        tradesTotal: tradeRows.length,
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
        ticketsByStatus: {
          open: requestRows.filter(
            (r) => (r.status ?? "open") === "open",
          ).length,
          inProgress: requestRows.filter(
            (r) => r.status === "in_progress",
          ).length,
          completed: requestRows.filter(
            (r) => r.status === "completed",
          ).length,
        },
      };

      // Storage panel figures: per-table estimates from live row
      // counts and sampled row sizes, plus the file-storage
      // listing — all measured from the project just now. (These
      // started at the top of the handler too — storagePromise —
      // so they overlapped the registry reads instead of adding
      // their own serial phase at the end.)
      const [estProfiles, estItems, estConnections, estTrust, fileStorage] =
        await storagePromise;
      const dbBytes =
        (estProfiles?.bytes ?? 0) +
        (estItems?.bytes ?? 0) +
        (estConnections?.bytes ?? 0) +
        (estTrust?.bytes ?? 0);

      const storedRowsTotal =
        profiles.length +
        items.length +
        (connections ?? 0) +
        (trustEvents ?? 0);

      // Admin change notifications (Anthony, Nov 3, 2026,
      // 1:51 PM): flatten the dashboard's metrics to
      // key -> stringified value and compare against the
      // owner's acknowledged values (admin_metric_seen).
      // Only metrics whose source data actually loaded take
      // part — an unreachable server never manufactures or
      // clears a change. The first-ever run writes the
      // baseline (seen = last) so nothing lights up until
      // something genuinely moves afterwards.
      const metrics = new Map<string, string>();
      if (users) {
        metrics.set("users.total", String(users.total));
        metrics.set("users.newThisWeek", String(users.newThisWeek));
        metrics.set("users.avgTrustScore", String(users.avgTrustScore));
        metrics.set(
          "users.collectorsWithItems",
          String(users.collectorsWithItems),
        );
        for (const m of users.roster) {
          metrics.set(
            `roster:${m.collectorId}`,
            `${m.itemsOwned}|${m.trustScore}`,
          );
        }
      }
      if (activity) {
        metrics.set("activity.totalCopies", String(activity.totalCopies));
        metrics.set("activity.totalRows", String(activity.totalRows));
        metrics.set("activity.cardsLogged", String(activity.cardsLogged));
        metrics.set(
          "activity.avgPerCollector",
          String(activity.avgPerCollector),
        );
        metrics.set(
          "activity.largest",
          activity.largest
            ? `${activity.largest.username}|${activity.largest.items}`
            : "",
        );
        for (const c of activity.mostOwned) {
          metrics.set(`mostOwned:${c.name}`, `${c.copies}|${c.owners}`);
        }
      }
      if (confirmedConnections != null || connections != null) {
        metrics.set(
          "social.connections",
          `${confirmedConnections ?? ""}|${connections ?? ""}`,
        );
      }
      if (trustEvents != null) {
        metrics.set("social.trustEvents", String(trustEvents));
      }
      if (confirmedTrades != null) {
        metrics.set("social.confirmedTrades", String(confirmedTrades));
      }
      metrics.set(
        "deals.tradesCompleted",
        `${deals.tradesCompleted}|${deals.dealsCompleted}`,
      );
      metrics.set(
        "deals.tradesTotal",
        `${deals.tradesTotal}|${deals.tradesProposed}|${deals.tradesAccepted}`,
      );
      metrics.set(
        "deals.cashPurchases",
        `${deals.cashPurchases}|${deals.cashCompleted}`,
      );
      metrics.set(
        "deals.listingsActive",
        `${deals.listingsActive}|${deals.listingsTotal}`,
      );
      metrics.set(
        "tickets.status",
        `${deals.ticketsByStatus.open}|${deals.ticketsByStatus.inProgress}|${deals.ticketsByStatus.completed}`,
      );
      metrics.set("system.storedRows", String(storedRowsTotal));
      metrics.set("own.items", `${own.cardCopies}|${own.sealedQty}`);
      metrics.set("own.value", String(own.lorcanaValue));

      const seenRows = await db.select().from(schema.adminMetricSeen);
      const firstRun = seenRows.length === 0;
      const seenByKey = new Map(seenRows.map((r) => [r.key, r]));
      const changedKeys: string[] = [];
      // Readable change entries alongside the keys (Anthony,
      // Nov 3, 2026, ~5:30 PM): label + acknowledged ->
      // current, formatted for reading.
      const changes: z.infer<typeof adminStatsResponse>["changes"] =
        [];
      const rosterName = (code: string): string | null =>
        users?.roster.find((m) => m.collectorId === code)?.username ??
        null;
      const recordChange = (
        key: string,
        beforeRaw: string | null,
        afterRaw: string,
      ) => {
        changedKeys.push(key);
        changes.push({
          key,
          label: adminMetricLabel(key, rosterName),
          before:
            beforeRaw == null
              ? null
              : adminMetricValue(key, beforeRaw),
          after: adminMetricValue(key, afterRaw),
        });
      };
      const nowIso = new Date().toISOString();
      // The per-metric writes used to be awaited one by one
      // (one round trip per metric — dozens per call); they're
      // collected and applied as ONE batch instead.
      const metricWrites: BatchItem<"sqlite">[] = [];
      for (const [key, value] of metrics) {
        const row = seenByKey.get(key);
        if (!row) {
          metricWrites.push(
            db.insert(schema.adminMetricSeen).values({
              key,
              // Baseline run: seen at once. Later arrivals
              // start unseen (null) so they flag as changed.
              seenValue: firstRun ? value : null,
              lastValue: value,
              updatedAt: nowIso,
            }),
          );
          if (!firstRun) recordChange(key, null, value);
          continue;
        }
        if (row.lastValue !== value) {
          metricWrites.push(
            db
              .update(schema.adminMetricSeen)
              .set({ lastValue: value, updatedAt: nowIso })
              .where(eq(schema.adminMetricSeen.key, key)),
          );
        }
        if (row.seenValue !== value)
          recordChange(key, row.seenValue, value);
      }
      if (metricWrites.length > 0) {
        await db.batch(
          metricWrites as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
        );
      }

      const result: z.infer<typeof adminStatsResponse> = {
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
        series: { usersByDay, tradesByDay, usersCumulative },
        deals,
        system: {
          ...systemBase,
          storedRows: storedRowsTotal,
          storage: {
            dbAllotmentMb: SUPABASE_DB_ALLOTMENT_MB,
            dbUsedMb: Math.round((dbBytes / 1_000_000) * 100) / 100,
            fileAllotmentMb: SUPABASE_FILE_ALLOTMENT_MB,
            fileUsedMb: fileStorage.mb,
            fileMeasured: fileStorage.measured,
          },
        },
        changedKeys,
        changes,
        own,
        computedAt: nowIso,
      };

      // Save this computation as the last-known snapshot the
      // Admin page serves instantly on its next open (see
      // getAdminStatsSnapshot). Best-effort: a failed snapshot
      // write never fails the stats themselves.
      try {
        await db
          .insert(schema.adminStatsCache)
          .values({
            id: 1,
            payload: JSON.stringify(result),
            computedAt: nowIso,
          })
          .onConflictDoUpdate({
            target: schema.adminStatsCache.id,
            set: { payload: JSON.stringify(result), computedAt: nowIso },
          });
      } catch {
        // The live numbers above still stand on their own.
      }

      return result;
    },
  }),

  getAdminStatsSnapshot: defineAction({
    description:
      "Owner-only fast first paint for the Admin page: returns the last fully computed Admin stats snapshot stored by getAdminStats (one local row, no Supabase reads), with the instant it was computed, so the page opens immediately with labeled last-known numbers while the live stats refresh behind it. Null stats when no computation has completed yet; withholds everything (isOwner=false) from any profile that isn't Anthony's own Collector ID.",
    request: z.object({}),
    response: adminStatsSnapshotResponse,
    async handler(
      ctx,
    ): Promise<z.infer<typeof adminStatsSnapshotResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE) {
        return { isOwner: false, computedAt: null, stats: null };
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.adminStatsCache)
        .where(eq(schema.adminStatsCache.id, 1));
      const row = rows[0];
      if (!row) return { isOwner: true, computedAt: null, stats: null };
      try {
        const parsed: unknown = JSON.parse(row.payload);
        const stats = adminStatsResponse.parse(parsed);
        return { isOwner: true, computedAt: row.computedAt, stats };
      } catch {
        // A stored payload that no longer matches the response
        // shape (e.g. written by an older build) is no snapshot
        // at all — the page falls back to its loading states
        // and the next full computation rewrites the row.
        return { isOwner: true, computedAt: null, stats: null };
      }
    },
  }),

  ackAdminMetric: defineAction({
    description:
      "Owner-only: acknowledges one Admin dashboard metric the owner tapped in the Admin page — copies its last-computed value into its seen value, clearing that metric's translucent-blue highlight and, when none remain, the Home Admin shield's change badge.",
    request: z.object({ key: z.string().min(1).max(200) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode === OWNER_COLLECTOR_CODE) {
        const db = ctx.db<typeof schema>();
        const rows = await db
          .select()
          .from(schema.adminMetricSeen)
          .where(eq(schema.adminMetricSeen.key, args.key));
        const row = rows[0];
        if (row && row.seenValue !== row.lastValue) {
          await db
            .update(schema.adminMetricSeen)
            .set({
              seenValue: row.lastValue,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.adminMetricSeen.key, args.key));
        }
      }
      return { ok: true as const };
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
