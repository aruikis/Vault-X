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
// Enchanteds, Iconics, and the Illumineer's Quest foil reprints numbered
// above each set's chase block — see FOIL_ONLY_QUEST_REPRINT_UIDS below)
// and one-version promos/quests keep a single pocket.
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
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "./schema";
import { catalog } from "./data/catalog";
import {
  puzzleCatalog,
  HUNNY_ENCOUNTER_FRONTS,
} from "./data/puzzleCatalog";
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
FUNKO_SOLD_PRICES,
FUNKO_SOLD_SNAPSHOT_DATE,
funkoSoldSnapshotByUpc,
funkoSoldSnapshotFor,
} from "./data/funkoSoldPrices";
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
import { extractPdfLines, parseChecklist } from "./data/pdfText";

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
// art-v6 (Nov 10, 2026): the compression pass (Anthony's
// standing rule — all saved artwork compressed, visual
// integrity the hard limit). Every device drops its cached
// art and re-saves it under the compressed scheme (right-sized
// high-quality copies per display tier; detail copies keep
// inspection resolution and are never stored degraded), so no
// uncompressed full-size browsing copy survives alongside the
// compressed ones. Client CACHE_NAME bumps in step.
const ARTWORK_VERSION = "art-v6";

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
  if (entry.grp === "puzzle")
    // The Great Hunny Rescue Encounter fronts (Nov 10, 2026)
    // ride the puzzle machinery but live in their OWN group, so
    // the Quest 3 page renders them as a separate "Encounter
    // Cards" subsection, apart from the Prize Pack Illustrations
    // in puzzle:Q3 and from the 37 set cards in quest:Q3.
    return entry.uid.startsWith("encounter:")
      ? `encounter:${entry.setCode}`
      : `puzzle:${entry.setCode}`;
  if (entry.grp === "quest") return `quest:${entry.setCode}`;
  return `promo:${entry.family ?? "P1"}`;
}

/** Display name for a catalog entry's binder group. The bundled
    catalog snapshot shortens Quest 3's product name to
    "Illumineer's Quest: Hunny Rescue", which reads like a
    different product next to the box's actual name — the full
    official name is used everywhere the group is displayed
    (Nov 10, 2026). */
const GROUP_NAME_OVERRIDES: Record<string, string> = {
  Q3: "Illumineer's Quest: The Great Hunny Rescue",
};
function groupNameOf(entry: CatalogEntry): string {
  return GROUP_NAME_OVERRIDES[entry.setCode] ?? entry.setName;
}

function groupLabelOf(entry: CatalogEntry): string {
  if (entry.grp === "set") return `Set ${entry.setCode}`;
  if (entry.grp === "puzzle")
    return entry.uid.startsWith("encounter:") ? "Encounters" : "Puzzle";
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

/** A card's joined-scene tally (Anthony, Nov 9, 2026): copies held
    as part of a connecting-art scene, counted SEPARATELY from the
    pocket finishes — its own record, starting at 0, written only
    by the scene steppers. */
function sceneFinishesOf(row: {
  sceneFinishes: string;
}): Record<string, number> {
  return parseFinishes(row.sceneFinishes);
}

function tallySum(finishes: Record<string, number>): number {
  return Object.values(finishes).reduce((s, q) => s + q, 0);
}

/** Total copies across both tallies: pocket count + scene count,
    each tally counted once (Anthony, Nov 9, 2026). */
function tallyTotal(row: {
  ownedQty: number;
  sceneFinishes: string;
}): number {
  return row.ownedQty + tallySum(sceneFinishesOf(row));
}

/** The Encounter front of a double-sided Great Hunny Rescue
    card (Anthony, Nov 10, 2026 — "number one is showing
    Mickey Mouse. Number one is not Mickey Mouse in this
    set"): cards 1/37–6/37 are double-sided, the Encounter
    front is the face that carries the card's number in hand,
    and the cataloged rescued glimmer is its back. The server
    attaches the front's verified data (HUNNY_ENCOUNTER_FRONTS
    in data/puzzleCatalog.ts) to the back's row so every
    surface presents the card front-first. Null for every
    ordinary card. */
const encounterFront = z.object({
  frontName: z.string(),
  journey: z.string(),
  encounter: z.number(),
  loreGoal: z.number(),
  rules: z.string(),
  artist: z.string().nullable(),
  backFullName: z.string(),
});

type EncounterFront = z.infer<typeof encounterFront>;

const ENCOUNTER_FRONT_BY_UID: ReadonlyMap<string, EncounterFront> =
  new Map(
    HUNNY_ENCOUNTER_FRONTS.map((f) => [
      f.backUid,
      {
        frontName: f.frontName,
        journey: f.journey,
        encounter: f.encounter,
        loreGoal: f.loreGoal,
        rules: f.rules,
        artist: f.artist,
        backFullName: "",
      },
    ]),
  );

function encounterFrontForRow(row: {
  uid: string;
  fullName: string;
}): EncounterFront | null {
  const front = ENCOUNTER_FRONT_BY_UID.get(row.uid);
  return front ? { ...front, backFullName: row.fullName } : null;
}

const cardLite = z.object({
  id: z.number(),
  fullName: z.string(),
  printed: z.string(),
  rarity: z.string().nullable(),
  ink: z.string().nullable(),
  ownedQty: z.number(),
  finishes: z.record(z.string(), z.number()),
  /** Copies of this pocket's finish family held in the joined
      connecting-art scene tally (Anthony, Nov 9, 2026): separate
      from ownedQty — the pocket counts as filled (not ghosted,
      not missing) when either tally has a copy, and total copies
      are ownedQty + sceneQty. 0 for ordinary cards. */
  sceneQty: z.number(),
  /** Which pocket of the card number this is: regular, foil, or single. */
  pocket: z.enum(["regular", "foil", "single"]),
  /** Pocket display label, e.g. "Regular", "Cold Foil", "Promo Foil". */
  pocketLabel: z.string(),
  /** Assembled-from-pieces artwork for a Full Puzzle Art
      entry: the piece cards' ids in reading order and the
      grid columns (2 or 3), so the client can join the set's
      own piece scans into the completed artwork — the main
      rendering where no assembled photo exists, and the
      fallback wherever a photo does. Null everywhere else. */
  composite: z
    .object({ cols: z.number(), pieceIds: z.array(z.number()) })
    .nullable(),
  /** Connecting-art marker (Nov 9, 2026): this printing's
      artwork joins a verified multi-card scene — the group
      size and this card's position in it (0-based, left to
      right). Null for ordinary cards. The client draws a
      small insignia on the pocket; it changes no layout. */
  artLink: z
    .object({ size: z.number(), position: z.number() })
    .nullable(),
  /** Owner-supplied bundled display art key (Nov 9, 2026):
      names an image shipped inside the client for an entry
      whose correct picture exists in no fetchable source
      (see BUNDLED_ART_BY_UID). Outranks the entry's own art
      and its composite. Null everywhere else. */
  bundledArt: z.string().nullable(),
  /** Encounter front data for the six double-sided Great
      Hunny Rescue cards (1/37–6/37); null everywhere else. */
  encounterFront: encounterFront.nullable(),
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

/** Illumineer's Quest foil reprints (Anthony, Nov 9, 2026 — his
    standing rule: a card must never be represented in a finish
    that does not exist). Each Illumineer's Quest box reprints a
    few cards from its companion sets in a unique frame, numbered
    ABOVE the set's chase block (past the Enchanteds, and past
    the Epics/Iconics in the newer sets), and those reprints were
    produced ONLY as Cold Foil — there is no Regular version of
    any of them. The catalog files them inside their companion
    sets, so the binder's default for a numbered set card (a
    Regular pocket + a Cold Foil pocket) invented a phantom
    Regular pocket for each. The full-catalog audit of Nov 9,
    2026 found exactly these thirteen — every other numbered set
    card sits inside its set's base range (1–204, or 1–207 for
    Attack of the Vine!) and exists in both finishes, and the
    chase rarities were already single-finish. Verified against
    the checklists and market records for each Quest set:
    Deep Trouble's checklist heads this group "Deep Trouble
    Foil" with a foil price and no regular price for every card
    (EchoMTG printable checklist, tradercracks checklist);
    Lorcast carries a foil price and NO non-foil price for the
    Palace Heist four it tracks (Bolt, Elsa, Goofy, Pinocchio);
    the Great Hunny Rescue four are listed everywhere only as
    "(Cold Foil)" and the box's own reviews describe them as the
    foil versions included in the box.
    - Deep Trouble (with Into the Inklands / Ursula's Return /
      Shimmering Skies): Piglet - Pooh Pirate Captain 223/204,
      Yen Sid - Powerful Sorcerer 223/204, Mulan - Elite Archer
      224/204, Mickey Mouse - Playful Sorcerer 225/204,
      Half Hexwell Crown 223/204.
    - Palace Heist (with Archazia's Island / Reign of Jafar):
      Bolt - Superdog 223/204, Elsa - Ice Maker 224/204,
      Goofy - Groundbreaking Chef 223/204,
      Pinocchio - Strings Attached 224/204.
    - The Great Hunny Rescue (with Winterspell / Wilds Unknown /
      Attack of the Vine!): Sven - Leaping Reindeer 243/204,
      Mr. Incredible - Super Strong 243/204,
      Christopher Robin - Hunny Sage 246/207,
      Violet Parr - Super Resilient 247/207.
    Keyed by catalog uid, the stable printing key. */
const FOIL_ONLY_QUEST_REPRINT_UIDS: ReadonlySet<string> = new Set([
  "3:945", // Piglet - Pooh Pirate Captain, 223/204, Into the Inklands
  "4:946", // Yen Sid - Powerful Sorcerer, 223/204, Ursula's Return
  "4:948", // Mulan - Elite Archer, 224/204, Ursula's Return
  "4:949", // Mickey Mouse - Playful Sorcerer, 225/204, Ursula's Return
  "5:1179", // Half Hexwell Crown, 223/204, Shimmering Skies
  "7:1931", // Bolt - Superdog, 223/204, Archazia's Island
  "7:1932", // Elsa - Ice Maker, 224/204, Archazia's Island
  "8:1933", // Goofy - Groundbreaking Chef, 223/204, Reign of Jafar
  "8:1934", // Pinocchio - Strings Attached, 224/204, Reign of Jafar
  "11:3570", // Sven - Leaping Reindeer, 243/204, Winterspell
  "12:3571", // Mr. Incredible - Super Strong, 243/204, Wilds Unknown
  "13:3572", // Christopher Robin - Hunny Sage, 246/207, Attack of the Vine!
  "13:3573", // Violet Parr - Super Resilient, 247/207, Attack of the Vine!
]);

/** The ONE finish a printing exists in, when it exists in
    exactly one: the chase rarities by rarity, the Illumineer's
    Quest foil reprints by uid. The returned name is the finish
    KEY the collection records use ("Epic Foil" for an Epic —
    the detail view displays it as "Epic"). Null for ordinary
    two-finish printings. */
function singleFinishOf(row: {
  uid: string;
  rarity: string | null;
}): string | null {
  if (row.rarity === "Epic") return "Epic Foil";
  if (row.rarity === "Enchanted") return "Enchanted";
  if (row.rarity === "Iconic") return "Iconic";
  if (FOIL_ONLY_QUEST_REPRINT_UIDS.has(row.uid)) return "Cold Foil";
  return null;
}

function isFoilOnlyPrinting(row: {
  uid: string;
  rarity: string | null;
}): boolean {
  return singleFinishOf(row) != null;
}

/** Folds a foil-only quest reprint's finish counts into its one
    real finish: any non-foil finish key (a "Regular" the export
    or an earlier pocket write recorded) moves into "Cold Foil".
    Quantities are preserved exactly — the copies are real, only
    the finish they were filed under does not exist. Foil-family
    keys already present are left as they are. */
function foldFinishesToColdFoil(
  finishes: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  let folded = 0;
  for (const [finish, qty] of Object.entries(finishes)) {
    if (!isFoilFinish(finish) && finish !== "Iconic") folded += qty;
    else out[finish] = (out[finish] ?? 0) + qty;
  }
  if (folded > 0) out["Cold Foil"] = (out["Cold Foil"] ?? 0) + folded;
  return out;
}

interface Pocket {
  kind: "regular" | "foil" | "single";
  label: string;
  qty: number;
  finishes: Record<string, number>;
  /** Scene-tally copies in this pocket's finish family (see the
      cardLite sceneQty note). */
  sceneQty: number;
}

/** Splits one printing into binder pockets the way Anthony's physical
    binders work: regular pocket first, foil pocket right next to it, each
    owned/ghosted independently. Foil-only printings and printings he only
    has in one version family keep a single pocket. */
function pocketsOf(row: typeof schema.cards.$inferSelect): Pocket[] {
  const finishes = parseFinishes(row.finishes);
  // The joined-scene tally splits into the same finish families
  // as the pocket finishes (Anthony, Nov 9, 2026): scene copies
  // of a non-foil finish ride the regular pocket, foil-family
  // scene copies the foil pocket, everything the single pocket
  // on one-pocket printings.
  const scene = sceneFinishesOf(row);
  let sceneRegQty = 0;
  let sceneFoilQty = 0;
  for (const [finish, qty] of Object.entries(scene)) {
    if (isFoilFinish(finish) || finish === "Iconic") sceneFoilQty += qty;
    else sceneRegQty += qty;
  }
  const sceneTotal = sceneRegQty + sceneFoilQty;
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
              : row.rarity === "Illustration"
                ? "Illustration"
                : row.rarity === "Encounter"
                  ? "Encounter"
                  : "Puzzle",
        qty: row.ownedQty,
        finishes,
        sceneQty: sceneTotal,
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
  const foilOnlyPrinting = isFoilOnlyPrinting(row);
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
          singleFinishOf(row) ??
          (row.rarity ?? "Foil"),
        qty: row.ownedQty,
        finishes,
        sceneQty: sceneTotal,
      },
    ];
  }
  const baseSetCard = row.grp === "set";
  if (baseSetCard || (regQty > 0 && foilQty > 0)) {
    return [
      {
        kind: "regular",
        label: regLabel,
        qty: regQty,
        finishes: regFinishes,
        sceneQty: sceneRegQty,
      },
      {
        kind: "foil",
        label: foilLabel,
        qty: foilQty,
        finishes: foilFinishes,
        sceneQty: sceneFoilQty,
      },
    ];
  }
  return [
    {
      kind: "single",
      label: foilQty > 0 ? foilLabel : regLabel,
      qty: row.ownedQty,
      finishes,
      sceneQty: sceneTotal,
    },
  ];
}

/** Full Puzzle Art assembly (Anthony, Nov 4, 2026): a set's
    Full entry whose assembled photo exists in a legitimate
    source keeps that photo. Where NO assembled image exists
    anywhere — or the only "assembled" photo on offer is the
    WRONG picture — the entry is assembled from the set's own
    piece scans, joined in reading order. (Hyperia City is
    the wrong-picture case, confirmed by Anthony on-device
    Nov 4, 2026: TCGplayer's photo for its "Set of 9" product
    723665 is a completely different picture, while its nine
    piece scans are correct — so Hyperia's Full entry carries
    no photo and this composite IS its assembled artwork.)
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
    if (!full) continue;
    // The composite is computed even when the Full entry HAS a
    // photo: it is the render fallback for the day the photo
    // fetch fails, so the entry can never sit on a name plate
    // while its own pieces carry the artwork (Nov 4, 2026 —
    // this fallback went missing for Hyperia the moment its
    // genuine Set of 9 photo was attached, because the spec
    // used to skip imaged entries entirely).
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
  // Sent alongside the photo when both exist: the client
  // prefers the entry's own art and falls back to this
  // assembled-from-pieces rendering when the art is missing
  // or fails to load, so a Full Puzzle Art entry never sits
  // on "Loading art" while its pieces are imaged.
  const spec = FULL_PUZZLE_COMPOSITES.get(row.uid);
  if (!spec) return null;
  const idByUid = new Map(siblings.map((r) => [r.uid, r.id]));
  const pieceIds = spec.pieceUids
    .map((u) => idByUid.get(u))
    .filter((id): id is number => id != null);
  if (pieceIds.length !== spec.pieceUids.length) return null;
  return { cols: spec.cols, pieceIds };
}

/** Owner-supplied display artwork bundled with the app, for
    the rare entry whose correct picture exists in NO fetchable
    source. The key names a client-side bundled image, which
    outranks the entry's own art and the assembled-from-pieces
    composite on every surface.
    puzzle:14:full — Hyperia City Full Puzzle Art (Anthony,
    Nov 9, 2026). DIAGNOSIS, verified in the rendered app that
    day: the entry carries no photo (TCGplayer's only "Set of
    9" picture is a different product's photo), so it rendered
    the from-pieces composite — but Hyperia's nine pieces are
    LANDSCAPE cards (their scans are 1000x716), and the
    composite squeezed each landscape scan into a PORTRAIT
    cell with object-cover, center-cropping every slice, so
    the joined picture never lined up and read as broken
    on-device through three fix attempts. Anthony supplied
    his own photo of the nine physical pieces laid out 3x3 —
    separate cards, thin gaps, rounded corners, clean light
    background, like cards in a book — and directed that
    exact presentation; his enhanced final file (workspace
    lorcana/hyperia-full-puzzle-art-final.png) is the bundled
    art, shipped as a webp in the client's puzzle assets. */
const BUNDLED_ART_BY_UID: ReadonlyMap<string, string> = new Map([
  ["puzzle:14:full", "hyperia-full"],
  // Great Hunny Rescue Prize Pack Illustrations (Anthony,
  // Nov 10, 2026): cleaned images from his own photos of the
  // physical cards (see the matching keys in the client's
  // BUNDLED_ART_IMAGES). The catalog entries keep image: null —
  // this bundled art is their picture on every surface, and no
  // ownership is touched: the rows' counts stay exactly as-is.
  ["puzzle:Q3:piglet", "hunny-piglet"],
  ["puzzle:Q3:vine", "hunny-vine"],
]);

function bundledArtForRow(row: { uid: string }): string | null {
  return BUNDLED_ART_BY_UID.get(row.uid) ?? null;
}

/** Connecting-art groups ("conjoined art" / panorama cards):
    printings whose artwork joins into one wider scene when the
    physical cards are placed side by side, in left-to-right
    order. Every group below was VERIFIED from the actual
    Ravensburger artwork on Nov 9, 2026 - the member scans were
    downloaded and joined edge-to-edge and the scene checked
    seam by seam (research spine: Mushu Report's Conjoined Art
    catalogue; full report in the lorcana-connecting-art-cards
    research notes of Nov 9, 2026). Candidates the research
    left UNVERIFIED (Inklands Flotsam/Jetsam "Riffraff", Reign
    of Jafar Chaca/Tipo, Wilds Unknown Ariel/Prince Eric) are
    deliberately NOT linked. The two chase-only scenes are
    keyed to their Enchanted / Iconic printings only - the
    regular printings carry different, non-connecting art and
    stay unlinked. The Mickey/Pete pair crosses sets (First
    Chapter + Shimmering Skies). Keyed by catalog uid, the
    stable printing key. */
const ART_GROUPS: readonly (readonly string[])[] = [
  ["2:217", "2:221", "2:222", "2:226", "2:227", "2:237", "2:238"], // S2 Dwarfs panorama
  ["3:650", "3:651"], // S3 Hook+Pan ENCHANTED
  ["4:734", "4:737"], // S4 Flotsam+Jetsam
  ["4:764", "4:768"], // S4 Gus+Jaq
  ["4:772", "4:773"], // S4 Pain+Panic
  ["4:869", "4:874", "4:885"], // S4 Imperial trio
  ["1:89", "5:1072"], // S5 Mickey(S1)+Pete
  ["5:960", "5:963"], // S5 Rutt+Tuke
  ["5:1031", "5:1032", "5:1034"], // S5 Fairies trio
  ["5:1007", "5:1045", "5:1097", "5:1140"], // S5 Rejected four
  ["7:1441", "7:1465"], // S7 Suzy+Perla
  ["7:1518", "7:1546"], // S7 Stepsisters
  ["7:1606", "7:1630"], // S7 Jasmine+Aladdin
  ["8:1665", "8:1666", "8:1667"], // S8 Nephews trio
  ["8:1789", "8:1729"], // S8 Brutus+Nero
  ["9:2177", "9:2178"], // S9 Minnie+Mickey ICONIC
  ["11:2576", "11:2577"], // S11 Iduna+Agnarr
  ["11:2600", "11:2601"], // S11 Roo+Kanga
  ["12:2752", "12:2753", "12:2754", "12:2755", "12:2756", "12:2757", "12:2758", "12:2759"], // S12 Dwarfs panorama 8
  ["12:2721", "12:2739"], // S12 Agustin+Julieta
  ["12:2796", "12:2821"], // S12 Pan+Pegasus
  ["12:2854", "12:2855", "12:2856"], // S12 Fairies trio
  ["12:2899", "12:2900"], // S12 Omnidroid+MrIncredible
  ["12:2786", "12:2793"], // S12 Brave MacGuffin
  ["12:2891", "12:2901"], // S12 Brave Dingwall
  ["12:2895", "12:2896"], // S12 Brave Macintosh
  ["13:3045", "13:3046"], // S13 Carl+Ellie
  ["13:3081", "13:3082"], // S13 Yzma+Kuzco
  ["13:3129", "13:3130"], // S13 Marian+Robin
];

interface ArtGroupInfo {
  size: number;
  position: number;
  members: readonly string[];
}

const ART_GROUP_BY_UID = ((): Map<string, ArtGroupInfo> => {
  const map = new Map<string, ArtGroupInfo>();
  for (const members of ART_GROUPS) {
    members.forEach((uid, position) => {
      map.set(uid, { size: members.length, position, members });
    });
  }
  return map;
})();

/** This printing's connecting-art marker for pocket payloads:
    the group's size and this card's position in the scene, or
    null when the printing is not part of a verified group. */
function artLinkForRow(row: { uid: string }): {
  size: number;
  position: number;
} | null {
  const g = ART_GROUP_BY_UID.get(row.uid);
  return g ? { size: g.size, position: g.position } : null;
}

type ArtGroupData = NonNullable<
  z.infer<typeof cardDetailResponse>["artGroup"]
>;

/** Resolves one verified connecting-art group from its member
    uids: every member printing in scene order with its pocket
    finishes AND its separate joined-scene tally, plus
    per-finish-family scene completion across the group. The
    completion lines are scored from the SCENE tallies alone
    (Anthony, Nov 9, 2026): a member counts toward Regular when
    its scene tally holds any non-foil finish and toward the
    foil family when its scene tally holds any foil-family
    finish (cold/epic/promo foil, Enchanted, Iconic) — pocket
    copies never inflate the scene lines. Foil-only printings
    (Enchanted / Iconic / Epic, and the quest foil reprints)
    have no Regular version, so
    the Regular line is scored only when at least one member
    could own one; the foil line is labeled Enchanted / Iconic
    for those chase-only scenes. A member's ownedQty here is
    the combined total (pocket + scene), so a scene-only copy
    still reads as owned wherever the group is listed. Shared
    by the card detail page and the set grid's joined-scene
    display cards. */
async function computeArtGroup(
  ctx: Ctx,
  memberUids: readonly string[],
  selfUid: string | null,
): Promise<ArtGroupData | null> {
  const db = ctx.db<typeof schema>();
  const memberRows = await db
    .select()
    .from(schema.cards)
    .where(inArray(schema.cards.uid, [...memberUids]));
  const byUid = new Map(memberRows.map((r) => [r.uid, r]));
  const members: ArtGroupData["members"] = [];
  let regOwned = 0;
  let foilOwned = 0;
  let anyRegularPossible = false;
  const memberRarities: (string | null)[] = [];
  for (const uid of memberUids) {
    const m = byUid.get(uid);
    if (!m) return null;
    memberRarities.push(m.rarity);
    const mFinishes = parseFinishes(m.finishes);
    const mScene = sceneFinishesOf(m);
    const sceneEntries = Object.entries(mScene).filter(([, q]) => q > 0);
    const foilOnlyPrinting = isFoilOnlyPrinting(m);
    if (!foilOnlyPrinting) anyRegularPossible = true;
    const hasRegular = sceneEntries.some(
      ([f]) => !isFoilFinish(f) && f !== "Iconic",
    );
    const hasFoil = sceneEntries.some(
      ([f]) => isFoilFinish(f) || f === "Iconic",
    );
    if (hasRegular) regOwned += 1;
    if (hasFoil) foilOwned += 1;
    members.push({
      id: m.id,
      fullName: m.fullName,
      printed: m.printed,
      groupName: m.groupName,
      ownedQty: tallyTotal(m),
      finishes: mFinishes,
      sceneFinishes: mScene,
      isSelf: selfUid != null && m.uid === selfUid,
    });
  }
  const total = memberUids.length;
  const foilLabel = memberRarities.every((r) => r === "Enchanted")
    ? "Enchanted"
    : memberRarities.every((r) => r === "Iconic")
      ? "Iconic"
      : "Foil";
  const finishStatus: ArtGroupData["finishStatus"] = [];
  if (anyRegularPossible) {
    finishStatus.push({
      key: "regular",
      label: "Regular",
      owned: regOwned,
      total,
      complete: regOwned === total,
    });
  }
  finishStatus.push({
    key: "foil",
    label: foilLabel,
    owned: foilOwned,
    total,
    complete: foilOwned === total,
  });
  const selfIndex = selfUid != null ? memberUids.indexOf(selfUid) : -1;
  return {
    size: total,
    myPosition: selfIndex >= 0 ? selfIndex : 0,
    members,
    finishStatus,
  };
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
    sceneQty: pocket.sceneQty,
    pocket: pocket.kind,
    pocketLabel: pocket.label,
    composite,
    artLink: artLinkForRow(row),
    bundledArt: bundledArtForRow(row),
    encounterFront: encounterFrontForRow(row),
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
      // Master-set owned/missing (Anthony, Nov 9, 2026): a
      // pocket is owned when EITHER tally — pocket or joined
      // scene — holds a copy of its finish family.
      const tally = pocket.qty + pocket.sceneQty;
      if (filter === "owned" && tally <= 0) continue;
      if (filter === "missing" && tally > 0) continue;
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

/** The finance twin of foldFinishesToColdFoil (Nov 9, 2026):
    re-keys a foil-only quest reprint's per-finish prices so a
    non-foil finish's value/paid move under "Cold Foil",
    quantity-weighted by the copies held in each finish. Totals
    are preserved exactly; a record with no non-foil entry comes
    back unchanged. */
function foldFinanceToColdFoil(
  prices: Record<string, FinishPrice>,
  qtyByFinish: Record<string, number>,
): Record<string, FinishPrice> {
  const keys = Object.keys(prices);
  if (keys.every((k) => isFoilFinish(k) || k === "Iconic")) return prices;
  const out: Record<string, FinishPrice> = {};
  let qtySum = 0;
  let valueSum = 0;
  let paidSum = 0;
  for (const [finish, price] of Object.entries(prices)) {
    if (!isFoilFinish(finish) && finish !== "Iconic") {
      const qty = qtyByFinish[finish] ?? 0;
      if (qty > 0) {
        qtySum += qty;
        valueSum += price.value * qty;
        paidSum += price.paid * qty;
      }
    } else {
      out[finish] = price;
    }
  }
  if (qtySum > 0) {
    const existing = out["Cold Foil"];
    if (existing) {
      const existingQty = qtyByFinish["Cold Foil"] ?? 0;
      const totalQty = existingQty + qtySum;
      out["Cold Foil"] = {
        value:
          totalQty > 0
            ? (existing.value * existingQty + valueSum) / totalQty
            : existing.value,
        paid:
          totalQty > 0
            ? (existing.paid * existingQty + paidSum) / totalQty
            : existing.paid,
      };
    } else {
      out["Cold Foil"] = {
        value: valueSum / qtySum,
        paid: paidSum / qtySum,
      };
    }
  }
  return out;
}

function foldFinanceJsonToColdFoil(
  raw: string | null,
  qtyByFinish: Record<string, number>,
): string | null {
  if (!raw) return raw;
  const folded = foldFinanceToColdFoil(parseFinance(raw), qtyByFinish);
  return JSON.stringify(folded);
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
  // Foil-only quest reprints (Nov 9, 2026): a fresh row starts
  // with the export's copy already filed under its one real
  // finish — the export filed Half Hexwell Crown's copy under
  // "Regular", a finish that printing does not exist in.
  const questFoilOnly = FOIL_ONLY_QUEST_REPRINT_UIDS.has(entry.uid);
  const ownFinishes = own?.finishes ?? {};
  const ownQtyByFinish: Record<string, number> = { ...ownFinishes };
  return {
    uid: entry.uid,
    grp: entry.grp,
    groupKey: groupKeyOf(entry),
    groupName: groupNameOf(entry),
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
    finishes: JSON.stringify(
      questFoilOnly
        ? foldFinishesToColdFoil(ownFinishes)
        : ownFinishes,
    ),
    marketValue: own && own.value > 0 ? own.value : null,
    paidValue: own ? own.paid : null,
    financeJson: questFoilOnly
      ? foldFinanceJsonToColdFoil(financeJsonOf(own), ownQtyByFinish)
      : financeJsonOf(own),
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
    finish without a recorded price. VALUE counts every tallied copy
    once — pocket copies plus joined-scene copies (Anthony, Nov 9,
    2026) — each at its finish's per-unit value. PAID stays
    pocket-only: scene copies carry no recorded purchase price, so
    they add nothing to what was paid. */
function cardMoney(row: typeof schema.cards.$inferSelect): {
  value: number;
  paid: number;
} {
  const total = tallyTotal(row);
  if (total <= 0) return { value: 0, paid: 0 };
  const finishes = parseFinishes(row.finishes);
  const scene = sceneFinishesOf(row);
  const prices = parseFinance(row.financeJson);
  let value = 0;
  let pricedQty = 0;
  const allFinishes = new Set([
    ...Object.keys(finishes),
    ...Object.keys(scene),
  ]);
  for (const finish of allFinishes) {
    const qty = (finishes[finish] ?? 0) + (scene[finish] ?? 0);
    const price = prices[finish];
    if (price && qty > 0) {
      value += price.value * qty;
      pricedQty += qty;
    }
  }
  const rest = total - pricedQty;
  if (rest > 0) {
    value += (row.marketValue ?? 0) * rest;
  }
  let paid = 0;
  let paidPricedQty = 0;
  for (const [finish, qty] of Object.entries(finishes)) {
    const price = prices[finish];
    if (price) {
      paid += price.paid * qty;
      paidPricedQty += qty;
    }
  }
  const paidRest = row.ownedQty - paidPricedQty;
  if (paidRest > 0) {
    paid += (row.paidValue ?? 0) * paidRest;
  }
  return { value, paid };
}

/** The price-jump test behind BOTH price defenses (Anthony,
    Nov 6, 2026 — the Promo Set 3 mispricing, where the daily
    re-pricing wrote wrong-printing prices onto eight owned
    cards: Lenny - Toy Binoculars $1.58 → $266.75, Woody -
    Jungle Guide $2.62 → $155.33 and $55.15 → $495.44, Zipper
    $0.83 → $131.48, and four more, 8×–176× in one day).
    A one-step move is implausible when it is at least 4× up
    or at least 4× down AND at least $5 in absolute terms —
    the ratio alone would false-flag penny cards wobbling by
    cents, and the dollar floor alone would miss a $2 card
    "jumping" to $130. Ordinary daily moves are cents; every
    one of the eight bad Nov 6 values trips both tests, and
    no sane point in the tracked history (Oct 25 – Nov 6)
    does. Used by saveRepricing (refuse the write) and by
    auditPrices (repair a bad point that already landed). */
function isImplausiblePriceJump(prev: number, next: number): boolean {
  if (!(prev > 0) || !(next >= 0)) return false;
  if (Math.abs(next - prev) < 5) return false;
  const ratio = next / prev;
  return ratio >= 4 || ratio <= 0.25;
}

/** Recently Added log (Nov 6, 2026): record an in-app ownership
    INCREASE so Home's Recently Added rail (New Vision 2.0 Beta) has a
    real source. Best-effort by design — a logging hiccup must never
    fail the ownership write itself. Only increases count: lowering a
    count is not an addition, and export-seeded ownership never passes
    through these actions, so nothing about the Nov 1 2026 export is
    backdated or invented. */
async function recordRecentAddition(
  ctx: Ctx,
  cardId: number,
  delta: number,
): Promise<void> {
  if (delta <= 0) return;
  try {
    const db = ctx.db<typeof schema>();
    await db.insert(schema.recentAdditions).values({
      cardId,
      addedAt: new Date().toISOString(),
      qty: delta,
    });
  } catch {
    // The rail simply misses this addition; the ownership write stands.
  }
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
      // A pocket filled by a joined-scene copy is not missing
      // (Anthony, Nov 9, 2026): either tally fills it.
      if (pocket.qty + pocket.sceneQty > 0) continue;
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
  /** Joined-scene display cards for this section (Nov 9,
      2026): one per verified connecting-art group represented
      in the section's (filtered) pockets, anchored to the
      LAST pocket of the group's latest member in this section
      — the client renders the display card immediately after
      that pocket. Display-only data: the scenes never count
      as pockets and never enter the section total. */
  scenes: z.array(
    z.object({
      anchorCardId: z.number(),
      anchorPocket: z.enum(["regular", "foil", "single"]),
      size: z.number(),
      members: z.array(
        z.object({
          id: z.number(),
          fullName: z.string(),
          printed: z.string(),
          groupName: z.string(),
          /** Total copies across both tallies (pocket + scene). */
          ownedQty: z.number(),
          finishes: z.record(z.string(), z.number()),
          /** The member's joined-scene tally alone — what the
              scene steppers read and write. */
          sceneFinishes: z.record(z.string(), z.number()),
          isSelf: z.boolean(),
          /** False for members that live in another section
              (the cross-set pair) — noted on the display. */
          inThisSection: z.boolean(),
        }),
      ),
      finishStatus: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          owned: z.number(),
          total: z.number(),
          complete: z.boolean(),
        }),
      ),
    }),
  ),
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
  /** The ONE finish this printing exists in, when it exists in
      exactly one (Nov 9, 2026): the chase rarities (Epic /
      Enchanted / Iconic) and the Illumineer's Quest foil
      reprints (see FOIL_ONLY_QUEST_REPRINT_UIDS). The detail
      editor offers exactly this one stepper line for such a
      card — never a Regular line for a printing that has no
      Regular version. Null for ordinary two-finish printings. */
  foilOnlyFinish: z.string().nullable(),
  /** This printing's joined-scene tally (Anthony, Nov 9, 2026):
      separate from the pocket finishes — the detail hero treats
      the card as owned when either tally holds a copy. */
  sceneFinishes: z.record(z.string(), z.number()),
  marketValue: z.number().nullable(),
  /** Assembled-from-pieces artwork for a Full Puzzle Art
      entry with no published assembled image (see
      FULL_PUZZLE_COMPOSITES). Null everywhere else. */
  composite: z
    .object({ cols: z.number(), pieceIds: z.array(z.number()) })
    .nullable(),
  /** Owner-supplied bundled display art key (Nov 9, 2026):
      see BUNDLED_ART_BY_UID. Null everywhere else. */
  bundledArt: z.string().nullable(),
  /** Encounter front data for the six double-sided Great
      Hunny Rescue cards (1/37–6/37); null everywhere else. */
  encounterFront: encounterFront.nullable(),
  /** Connecting-art group (Nov 9, 2026): when this printing's
      artwork joins a verified multi-card scene, every member
      in scene order with its owned finishes, plus per-finish-
      family completion across the whole group. Null for
      ordinary cards. */
  artGroup: z
    .object({
      size: z.number(),
      myPosition: z.number(),
      members: z.array(
        z.object({
          id: z.number(),
          fullName: z.string(),
          printed: z.string(),
          groupName: z.string(),
          /** Total copies across both tallies (pocket + scene). */
          ownedQty: z.number(),
          finishes: z.record(z.string(), z.number()),
          /** The member's joined-scene tally alone (Anthony,
              Nov 9, 2026): what the scene steppers read and
              write — separate from the pocket finishes. */
          sceneFinishes: z.record(z.string(), z.number()),
          isSelf: z.boolean(),
        }),
      ),
      finishStatus: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          owned: z.number(),
          total: z.number(),
          complete: z.boolean(),
        }),
      ),
    })
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
  /** Lego / Funko owned values (Nov 7, 2026 — Portfolio's
      Collection Distribution gained its own Legos and Funko
      rows at Anthony's direction): live sums over the game
      catalog of catalog price × owned copies (opened +
      sealed for Lego), the same valuation rule Money Tracker
      uses for game items. An owned item whose catalog price
      was never tracked contributes $0 — its copies still
      count in the qty fields, and no value is invented. */
  legoValue: z.number(),
  legoQty: z.number(),
  funkoValue: z.number(),
  funkoQty: z.number(),
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

// Money Tracker + Insurance & Estate report (Nov 5, 2026).
const gameCardCostResponse = z.object({
  ok: z.literal(true),
  paidValue: z.number().nullable(),
});

const moneyTrackerResponse = z.object({
  asOf: z.string(),
  /** Total current value across every tracked category. */
  value: z.number(),
  /** Total recorded cost over the copies whose cost is known. */
  costKnown: z.number(),
  /** Current value of exactly those known-cost copies — the
      honest base for unrealised P&L and ROI. */
  valueKnown: z.number(),
  unrealised: z.number(),
  roiPct: z.number().nullable(),
  copies: z.number(),
  knownCopies: z.number(),
  categories: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number(),
      costKnown: z.number(),
      valueKnown: z.number(),
      copies: z.number(),
      knownCopies: z.number(),
    }),
  ),
  sold: z.object({
    rows: z.array(
      z.object({
        kind: z.enum(["sale", "trade"]),
        date: z.string().nullable(),
        title: z.string(),
        detail: z.string(),
        counterparty: z.string(),
        qty: z.number(),
        proceeds: z.number().nullable(),
        cost: z.number().nullable(),
        realised: z.number().nullable(),
        gave: z.array(z.string()),
        got: z.array(z.string()),
      }),
    ),
    proceeds: z.number(),
    realisedKnown: z.number(),
    realisedCostKnown: z.number(),
    salesCount: z.number(),
    tradesCount: z.number(),
  }),
});

const insuranceReportResponse = z.object({
  generatedAt: z.string(),
  username: z.string(),
  collectorCode: z.string(),
  rows: z.array(
    z.object({
      category: z.string(),
      name: z.string(),
      idLine: z.string(),
      detail: z.string(),
      qty: z.number(),
      unitValue: z.number().nullable(),
      unitPaid: z.number().nullable(),
      location: z.string().nullable(),
      artCardId: z.number().nullable(),
      imageUrl: z.string().nullable(),
    }),
  ),
  comicLocations: z.record(z.string(), z.string()),
});

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
      foilOnlyFinish: z.string().nullable(),
      /** True when this printing's artwork joins a verified
          connecting-art scene (Nov 9, 2026), so search rows
          can carry the same link marker as the pockets. */
      artLinked: z.boolean(),
    }),
  ),
});

/** A collector's identity (the oval Collector ID card at the
    top of Home): one profile row per install, created on first
    read with a neutral placeholder username the Welcome
    registration immediately replaces with the user's own chosen
    name (it used to seed Anthony's handle ARUIKIS for every
    install — the Nov 9, 2026 duplicate-name bug), and a collector
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
    // Placeholder only (fixed Nov 9, 2026): a brand-new profile
    // used to seed with Anthony's own username "ARuikis" — a
    // default written when he was the only user — so every
    // fresh install started life carrying HIS name, and the
    // registry auto-sync published it under the new install's
    // own collector code before registration ever ran (two new
    // users landed in the network registry as "ARuikis" on
    // Nov 9, 2026). The seed is now a neutral placeholder; the
    // Welcome registration replaces it with the username the
    // user actually chooses, and an unregistered profile is
    // never published to the registry (see
    // publishOwnRegistryProfile). Anthony's own long-standing
    // profile row already exists and is untouched by this.
    username: "Collector",
    collectorCode: newCollectorCode(),
    photoBlobKey: null as string | null,
    bannerBlobKey: null as string | null,
    bio: null as string | null,
    theme: null as string | null,
    layout: null as string | null,
    language: null as string | null,
    gridCols: null as number | null,
    onlyMine: null as number | null,
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
    libraryComicDisplay: null as string | null,
    librarySlabCardDisplay: null as string | null,
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
  /** The layout picked in Settings ("classic" | "vision"), or
      null when never picked (the Classic layout applies). A
      choice separate from the theme: themes are colors,
      layouts are structure. */
  layout: z.string().nullable(),
  /** The UI language picked in Settings ("en" | "es" | "de" |
      "fr" | "ja"), or null when never picked (English applies). */
  language: z.string().nullable(),
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
  /** "Only mine" list filter (1 = on, 0/null = off, the
      default): long list pages hide entries he owns nothing
      from. One shared choice across every section. */
  onlyMine: z.number().nullable(),
  /** This user's own Vault X invite code (Anthony, Nov 4,
      2026 — invite lineage): carried by the Share Vault X
      invite they send; a newcomer's registration resolves it
      back to this collector server-side. Distinct from the
      Collector ID. */
  inviteCode: z.string(),
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
  // Renamed Nov 9, 2026 at Anthony's direction: Jarvis's own
  // username — NOT Anthony's — now carries "(Test)" in
  // parentheses so anyone who sees this profile (his buddy
  // included) can tell at a glance it is a test account.
  username: "Jarvis (Test)",
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
    "activity.avgPerCollector": "Average items per collector",
    "activity.largest": "Largest collection",
    "social.connections": "Connections",
    "social.trustEvents": "Trust events",
    "social.confirmedTrades": "Confirmed trades",
    "deals.tradesCompleted": "Completed deals",
    "deals.tradesTotal": "Trades",
    "deals.cashPurchases": "Cash purchases",
    "deals.listingsActive": "Marketplace listings",
    "marketplace.pendingPhotos": "Photos waiting for approval",
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
      // The stored value is still "copies|trust" (either
      // moving flags the row changed), but the readout
      // shows the one number the simplified roster shows
      // (Anthony, Nov 9, 2026).
      return `${p(0)} total copies`;
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

/** Is this username already held in the registry by a DIFFERENT
    collector code? Returns null when the registry cannot be
    read, so callers can fail closed instead of guessing. */
async function registryUsernameTakenByOther(
  collectorCode: string,
  username: string,
): Promise<boolean | null> {
  const list = await supabaseRest(
    "profiles?select=collector_id,username&order=created_at.asc",
  );
  if (!list.ok) return null;
  const rows = asRegistryRows(list.json);
  return rows.some(
    (r) =>
      r.username.toLowerCase() === username.toLowerCase() &&
      r.collector_id !== collectorCode,
  );
}

/** Publishes THIS install's own profile to the network registry
    — with the two guards the Nov 9, 2026 duplicate-name bug
    proved necessary:
    1. Registration gate: a profile that has neither completed
       registration (registeredAt) nor finished the one-time
       Welcome flow (welcomeSeen) is NEVER published. The Home
       auto-sync and the backup sync both run from the very
       first open, long before a new user picks a username in
       the Welcome flow — publishing then is exactly how fresh
       installs landed in the registry under a name that was
       not theirs.
    2. Uniqueness: a username another collector code already
       holds is never written under this code, so the registry
       can never gain a second profile sharing a name.
    Returns the registry row on success, null when gated,
    refused, or unreachable. */
async function publishOwnRegistryProfile(profile: {
  collectorCode: string;
  username: string;
  registeredAt: string | null;
  welcomeSeen: number;
}): Promise<RegistryProfileRow | null> {
  if (profile.registeredAt == null && profile.welcomeSeen === 0)
    return null;
  // Uniqueness, with the original-holder exception: refuse
  // when another code holds this name AND this code does not
  // already hold it too. (While the two Nov 9 duplicate rows
  // still carry the owner's name, the owner's own refresh of
  // his long-standing row — held since Nov 3 — must not be
  // blocked by the duplicates; a fresh code claiming a held
  // name still is.)
  const list = await supabaseRest(
    "profiles?select=collector_id,username&order=created_at.asc",
  );
  if (list.ok) {
    const rows = asRegistryRows(list.json);
    const lower = profile.username.toLowerCase();
    const heldByOther = rows.some(
      (r) =>
        r.username.toLowerCase() === lower &&
        r.collector_id !== profile.collectorCode,
    );
    const heldByMe = rows.some(
      (r) =>
        r.username.toLowerCase() === lower &&
        r.collector_id === profile.collectorCode,
    );
    if (heldByOther && !heldByMe) return null;
  }
  return upsertRegistryProfile({
    collector_id: profile.collectorCode,
    username: profile.username,
    trust_score: 0,
  });
}

/** ----- Cloud collection backup (Supabase `collection_items`) -----
    Anthony approved making Supabase the cloud backup for users'
    collections (Nov 2, 2026): every owned item — cards in every
    finish, sealed products, graded comics — is written to the
    project's collection_items table under the owner's collector
    code (rows: owner_collector_id, item_key, display_name, qty,
    kind, meta; unique on owner + item_key, owner-only RLS, written
    with the publishable key only). Kept current by the backup
    habit Anthony approved Nov 9, 2026: (1) an incremental push
    inside EVERY collection-changing editor the moment a change
    saves — Lorcana quantity editors, the sealed stepper, the
    other games' owned stepper, and the graded-slab writes;
    (2) a full sync the app runs about 30 seconds after he
    finishes making changes (debounced in the client) and again
    when the app is closed or backgrounded; (3) a daily safety
    check (dailyBackupCheck) that runs a full sync whenever a
    recorded change is newer than the last full sync or the last
    full sync is over a day old. A restore action loads the
    backup back when the local collection is empty. Every
    collection change stamps backup_meta.last_change_at and
    every completed full sync stamps last_full_sync_at, so
    Settings can show honestly when the last change and the
    last verified backup happened. */

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

/** Cloud key segment for a joined-scene tally entry (Anthony,
    Nov 9, 2026): the finish name rides behind a `__scene__`
    marker inside the same last key segment, so the restore
    parser (which splits at the last colon, the uid itself
    containing one) can route these rows to the scene tally
    instead of the pocket finishes. */
const CLOUD_SCENE_PREFIX = "__scene__";
function cloudSceneItemKey(uid: string, finish: string): string {
  return `card:${uid}:${CLOUD_SCENE_PREFIX}${finish}`;
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
    const scene = sceneFinishesOf(row);
    const sceneEntries = Object.entries(scene).filter(([, q]) => q > 0);
    // A scene-only card (no pocket copies) still backs up: its
    // scene rows below are its whole cloud record.
    if (row.ownedQty <= 0 && sceneEntries.length === 0) continue;
    if (row.ownedQty > 0) {
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
    for (const [finish, qty] of sceneEntries) {
      rows.push({
        owner_collector_id: owner,
        item_key: cloudSceneItemKey(row.uid, finish),
        display_name: `${row.fullName} (${finish} · joining scene)`,
        qty,
        kind: "card",
        meta: {
          uid: row.uid,
          finish,
          scene: true,
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
  // Every OTHER collection (Pokémon, Magic, Star Wars Unlimited,
  // Funko, Lego, the Topps families…): one row per owned catalog
  // item, plus a separate row for a Lego set's sealed copies —
  // sealed-vs-opened is a real distinction Lego value turns on,
  // so the two counts never merge into one number. The owned
  // filter is applied in the query itself: the game catalogs
  // hold hundreds of thousands of rows, and reading them all to
  // find the owned handful made every backup status / sync call
  // heavy enough to time out under load.
  const gameRows = await db
    .select()
    .from(schema.gameCards)
    .where(
      or(
        gt(schema.gameCards.ownedQty, 0),
        gt(schema.gameCards.ownedSealedQty, 0),
      ),
    );
  for (const row of gameRows) {
    if (row.ownedQty > 0) {
      rows.push({
        owner_collector_id: owner,
        item_key: `game:${row.id}`,
        display_name: row.name,
        qty: row.ownedQty,
        kind: "game",
        meta: {
          gameCardId: row.id,
          game: row.game,
          printed: row.printed,
          section: row.sectionName,
          sealed: false,
        },
      });
    }
    if (row.ownedSealedQty > 0) {
      rows.push({
        owner_collector_id: owner,
        item_key: `game:${row.id}:sealed`,
        display_name: `${row.name} (Sealed)`,
        qty: row.ownedSealedQty,
        kind: "game",
        meta: {
          gameCardId: row.id,
          game: row.game,
          printed: row.printed,
          section: row.sectionName,
          sealed: true,
        },
      });
    }
  }
  // Graded slabs: the slab record itself (company, cert, grade,
  // what was paid) is collection data the game row alone cannot
  // rebuild, so each slab backs up as its own row.
  const slabRows = await db.select().from(schema.gradedSlabs);
  const gameById = new Map(gameRows.map((r) => [r.id, r]));
  for (const slab of slabRows) {
    if (slab.qty <= 0) continue;
    const card = gameById.get(slab.gameCardId);
    rows.push({
      owner_collector_id: owner,
      item_key: `slab:${slab.company}:${slab.cert}`,
      display_name: card
        ? `${card.name} — ${slab.company} ${slab.grade}`
        : `${slab.company} ${slab.cert} — ${slab.grade}`,
      qty: slab.qty,
      kind: "slab",
      meta: {
        gameCardId: slab.gameCardId,
        company: slab.company,
        cert: slab.cert,
        grade: slab.grade,
        paid: slab.paid,
      },
    });
  }
  return rows;
}

/** Reads every collection_items row for one owner, paged (the
    server caps a single response, so loop until a short page). */
type CloudItemFetched = {
  item_key: string;
  qty: number;
  kind: string;
  display_name: string | null;
  meta: Record<string, unknown> | null;
};

async function fetchCloudItems(
  owner: string,
): Promise<CloudItemFetched[] | null> {
  const out: CloudItemFetched[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const res = await supabaseRest(
      `collection_items?select=item_key,qty,kind,display_name,meta&owner_collector_id=eq.${encodeURIComponent(owner)}&order=item_key.asc&limit=${PAGE}&offset=${offset}`,
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
          display_name:
            typeof r.display_name === "string" ? r.display_name : null,
          meta:
            typeof r.meta === "object" && r.meta !== null
              ? (r.meta as Record<string, unknown>)
              : null,
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

/** ----- Backup bookkeeping (backup_meta, single row id = 1) -----
    last_change_at is stamped by every collection-changing write
    (markBackupDirty); last_full_sync_at only by a full sync that
    completed and verified by read-back. The gap between the two
    is exactly "a full check is still owed" — the signal the
    daily check and the client's open-time catch-up act on. */

type BackupMetaRow = typeof schema.backupMeta.$inferSelect;

async function readBackupMeta(ctx: Ctx): Promise<BackupMetaRow | null> {
  try {
    const db = ctx.db<typeof schema>();
    const rows = await db
      .select()
      .from(schema.backupMeta)
      .where(eq(schema.backupMeta.id, 1));
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function writeBackupMeta(
  ctx: Ctx,
  patch: Partial<Omit<BackupMetaRow, "id">>,
): Promise<void> {
  try {
    const db = ctx.db<typeof schema>();
    await db
      .insert(schema.backupMeta)
      .values({ id: 1, ...patch })
      .onConflictDoUpdate({
        target: schema.backupMeta.id,
        set: patch,
      });
  } catch {
    // Bookkeeping is best-effort: a failed stamp never breaks
    // the collection write it rode along with. The next full
    // sync still reconciles the cloud itself.
  }
}

/** Stamps "a collection change just landed" (Anthony, Nov 9,
    2026 backup habit). Called by every collection-changing
    action alongside its incremental cloud push. */
async function markBackupDirty(ctx: Ctx): Promise<void> {
  await writeBackupMeta(ctx, {
    lastChangeAt: new Date().toISOString(),
  });
}

/** True when a full check is owed: a recorded change is newer
    than the last completed full sync (or no full sync has ever
    completed while changes exist). */
function backupNeedsFullCheck(meta: BackupMetaRow | null): boolean {
  if (!meta?.lastChangeAt) return false;
  if (!meta.lastFullSyncAt) return true;
  return meta.lastChangeAt > meta.lastFullSyncAt;
}

/** Full sync: upsert every local row, delete server rows that no
    longer exist locally, and confirm by reading the owner's rows
    back. Returns null when the server can't be reached/written. */
async function fullCloudSync(
  ctx: Ctx,
): Promise<{ owner: string; items: number; copies: number } | null> {
  const profile = await ensureCollectorProfile(ctx);
  const owner = profile.collectorCode;
  // Keep the owner's own registry row fresh in the same pass
  // (the longstanding acceptance check: his profile sits in the
  // server profiles table next to MC-JARVIS) — through the
  // guarded publisher, so a not-yet-registered install's backup
  // sync can never leak its placeholder name to the registry.
  await publishOwnRegistryProfile(profile).catch(() => null);
  const local = await buildLocalCloudItems(ctx, owner);
  if (!(await upsertCloudItems(local))) return null;
  const remote = await fetchCloudItems(owner);
  if (remote == null) return null;
  const localKeys = new Set(local.map((r) => r.item_key));
  const stale = remote
    .map((r) => r.item_key)
    // Usage-journal backup rows (kind "journal") are managed
    // by the journal's own incremental push below — the
    // collection reconcile never deletes them.
    .filter((k) => !localKeys.has(k) && !k.startsWith("journal:"));
  if (stale.length > 0) {
    if (!(await deleteCloudItems(owner, stale))) return null;
  }
  const after = await fetchCloudItems(owner);
  if (after == null) return null;
  // Journal rows ride the same table; the verified collection
  // counts exclude them so Settings' backup numbers stay about
  // the collection itself.
  const collectionAfter = after.filter((r) => r.kind !== "journal");
  const verified = {
    owner,
    items: collectionAfter.length,
    copies: collectionAfter.reduce((s, r) => s + r.qty, 0),
  };
  // The full check has landed and verified: stamp it, so the
  // daily check and Settings can tell a checked backup from a
  // merely-pushed one.
  await writeBackupMeta(ctx, {
    lastFullSyncAt: new Date().toISOString(),
    lastSyncItems: verified.items,
    lastSyncCopies: verified.copies,
  });
  // The private usage journal backs up in the same pass
  // (best-effort: a failed journal push never fails the
  // collection sync — the watermark simply doesn't advance
  // and the next sync retries the same rows).
  await pushUsageJournalToCloud(ctx, owner).catch(() => 0);
  return verified;
}

/** ----- Private usage journal (Anthony, Nov 9, 2026) -----
    The journal records how the signed-in collector moves
    through the app: screens in order, taps/actions, Back use,
    searches and their result counts, and step counts for
    common jobs. It is PRIVATE by construction: rows are keyed
    to the collector who owns this app copy, the only reader
    (getUsageJournal) always reads that same collector's rows
    and takes no parameter that could name anyone else, and no
    profile/friends/social surface reads the table at all.
    Content rule: navigation and actions ONLY — the client
    logger never sends passwords, payment details, or message
    text, and the sanitizer below drops any detail key that
    even looks like content (message/body/text/password/…)
    as a second line of defense. Retention: 90 days locally;
    older rows are pruned on write. Cloud backup: rows ride
    the collection backup as collection_items rows of kind
    "journal" (item_key journal:<id>), pushed incrementally
    behind a watermark by pushUsageJournalToCloud — every
    reader of that table (backup status, restore, Admin
    stats) excludes the journal kind, so the collection
    numbers never move because of it. */

const JOURNAL_KINDS: ReadonlySet<string> = new Set([
  "screen",
  "tap",
  "action",
  "back",
  "search",
  "job",
]);

/** Detail keys that must never be stored — anything that could
    carry message text, credentials, or payment data. */
const JOURNAL_FORBIDDEN_DETAIL_KEYS: ReadonlySet<string> = new Set([
  "message",
  "body",
  "text",
  "comment",
  "note",
  "password",
  "passcode",
  "pin",
  "card",
  "cardnumber",
  "zelle",
  "payment",
  "secret",
  "token",
]);

const JOURNAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const JOURNAL_SYNC_WATERMARK_KEY = "usage_journal_synced_through";

type JournalEventIn = {
  sessionId: string;
  kind: string;
  label: string;
  detail?: Record<string, unknown> | null;
  at: string;
};

/** Cleans one incoming event: known kinds only, labels capped,
    detail reduced to small scalar values under innocent keys. */
function sanitizeJournalEvent(
  raw: JournalEventIn,
): JournalEventIn | null {
  if (!JOURNAL_KINDS.has(raw.kind)) return null;
  const label = String(raw.label ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!label) return null;
  const sessionId = String(raw.sessionId ?? "")
    .trim()
    .slice(0, 64);
  if (!sessionId) return null;
  const atMs = Date.parse(raw.at);
  if (!Number.isFinite(atMs)) return null;
  // Device clocks can drift; keep the stamp within a sane
  // window around now rather than trusting it blindly.
  const now = Date.now();
  const at = new Date(
    Math.min(Math.max(atMs, now - 30 * 24 * 60 * 60 * 1000), now + 5 * 60 * 1000),
  ).toISOString();
  let detail: Record<string, unknown> | null = null;
  if (raw.detail && typeof raw.detail === "object") {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.detail).slice(0, 12)) {
      if (JOURNAL_FORBIDDEN_DETAIL_KEYS.has(k.toLowerCase())) continue;
      if (
        typeof v === "number" ||
        typeof v === "boolean" ||
        (typeof v === "string" && v.length <= 80)
      ) {
        clean[k.slice(0, 40)] = v;
      }
    }
    if (Object.keys(clean).length > 0) detail = clean;
  }
  return { sessionId, kind: raw.kind, label, detail, at };
}

async function readJournalWatermark(ctx: Ctx): Promise<number> {
  try {
    const db = ctx.db<typeof schema>();
    const rows = await db
      .select()
      .from(schema.marketplaceMeta)
      .where(eq(schema.marketplaceMeta.key, JOURNAL_SYNC_WATERMARK_KEY));
    const n = Number(rows[0]?.value ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function writeJournalWatermark(
  ctx: Ctx,
  throughId: number,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  await db
    .insert(schema.marketplaceMeta)
    .values({ key: JOURNAL_SYNC_WATERMARK_KEY, value: String(throughId) })
    .onConflictDoUpdate({
      target: schema.marketplaceMeta.key,
      set: { value: String(throughId) },
    });
}

/** Incremental cloud push of journal rows not yet backed up:
    upserts them as kind "journal" collection_items rows and
    advances the watermark only over rows that landed. Returns
    how many rows were pushed. Best-effort by contract — the
    caller swallows failures and the next sync retries. */
async function pushUsageJournalToCloud(
  ctx: Ctx,
  owner: string,
): Promise<number> {
  const db = ctx.db<typeof schema>();
  const through = await readJournalWatermark(ctx);
  const rows = await db
    .select()
    .from(schema.usageJournal)
    .where(
      and(
        eq(schema.usageJournal.collectorCode, owner),
        gt(schema.usageJournal.id, through),
      ),
    )
    .orderBy(asc(schema.usageJournal.id))
    .limit(2000);
  if (rows.length === 0) return 0;
  const cloudRows: CloudItemRow[] = rows.map((r) => {
    let detail: Record<string, unknown> | null = null;
    if (r.detailJson) {
      try {
        const parsed: unknown = JSON.parse(r.detailJson);
        if (parsed && typeof parsed === "object") {
          detail = parsed as Record<string, unknown>;
        }
      } catch {
        detail = null;
      }
    }
    return {
      owner_collector_id: owner,
      item_key: `journal:${r.id}`,
      display_name: `${r.kind}: ${r.label}`.slice(0, 200),
      qty: 1,
      kind: "journal",
      meta: {
        journalId: r.id,
        sessionId: r.sessionId,
        kind: r.kind,
        label: r.label,
        detail,
        at: r.at,
      },
    };
  });
  if (!(await upsertCloudItems(cloudRows))) return 0;
  const last = rows[rows.length - 1];
  if (last) await writeJournalWatermark(ctx, last.id);
  return rows.length;
}

/** Deletes this collector's cloud journal rows whose local
    rows were pruned past retention, so the backup doesn't
    keep what the journal itself let go. Best-effort. */
async function pruneUsageJournal(ctx: Ctx, owner: string): Promise<void> {
  try {
    const db = ctx.db<typeof schema>();
    const cutoff = new Date(
      Date.now() - JOURNAL_RETENTION_MS,
    ).toISOString();
    const old = await db
      .select({ id: schema.usageJournal.id })
      .from(schema.usageJournal)
      .where(
        and(
          eq(schema.usageJournal.collectorCode, owner),
          lt(schema.usageJournal.at, cutoff),
        ),
      )
      .limit(5000);
    if (old.length === 0) return;
    await db
      .delete(schema.usageJournal)
      .where(
        and(
          eq(schema.usageJournal.collectorCode, owner),
          lt(schema.usageJournal.at, cutoff),
        ),
      );
    await deleteCloudItems(
      owner,
      old.map((r) => `journal:${r.id}`),
    ).catch(() => false);
  } catch {
    // Pruning is housekeeping; a failure just retries on the
    // next journal write.
  }
}

const logUsageEventsResponse = z.object({
  ok: z.literal(true),
  /** How many of the submitted events were stored. */
  saved: z.number(),
});

const usageJournalEventOut = z.object({
  id: z.number(),
  sessionId: z.string(),
  /** "screen" | "tap" | "action" | "back" | "search" | "job" */
  kind: z.string(),
  label: z.string(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  /** ISO instant the step happened. */
  at: z.string(),
});

const usageJournalResponse = z.object({
  /** The collector this journal belongs to — always the
      signed-in owner of this app copy; the action takes no
      parameter that could name anyone else. */
  collectorCode: z.string(),
  username: z.string(),
  /** ISO instant the returned window starts / ends. */
  from: z.string(),
  to: z.string(),
  /** Events in the window, oldest first, capped at the most
      recent 2,000 (truncated says when the cap bit). */
  truncated: z.boolean(),
  events: z.array(usageJournalEventOut),
  summary: z.object({
    totalEvents: z.number(),
    sessions: z.number(),
    screensVisited: z.number(),
    /** Screens left within 4 seconds of opening them. */
    quickExits: z.array(
      z.object({ screen: z.string(), dwellMs: z.number(), at: z.string() }),
    ),
    /** Searches that returned nothing, newest first. */
    zeroResultSearches: z.array(
      z.object({ query: z.string(), at: z.string() }),
    ),
    /** Per-job step stats for the window. */
    jobs: z.array(
      z.object({
        job: z.string(),
        runs: z.number(),
        completed: z.number(),
        avgSteps: z.number(),
        avgMs: z.number(),
      }),
    ),
    /** Most-visited screens in the window. */
    topScreens: z.array(z.object({ screen: z.string(), visits: z.number() })),
    /** Back presses recorded in the window. */
    backs: z.number(),
  }),
});

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
    // The joined-scene tally rides the same per-card push under
    // its marked keys, so a scene edit backs up (and a stale
    // scene row deletes) exactly like a pocket finish.
    for (const [finish, qty] of Object.entries(
      sceneFinishesOf(cardRow),
    )) {
      if (qty <= 0) continue;
      desired.push({
        owner_collector_id: owner,
        item_key: cloudSceneItemKey(cardRow.uid, finish),
        display_name: `${cardRow.fullName} (${finish} · joining scene)`,
        qty,
        kind: "card",
        meta: {
          uid: cardRow.uid,
          finish,
          scene: true,
          set: cardRow.groupName,
          number: cardRow.printed,
          rarity: cardRow.rarity ?? null,
        },
      });
    }
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

/** Incremental push for one OTHER-games catalog item after its
    owned counts change — the item's opened row, its sealed row
    (Lego), and every graded slab recorded against it. Mirrors
    buildLocalCloudItems' game/slab row shapes exactly, and
    deletes cloud rows whose local count hit zero. Best-effort,
    same rule as syncCardToCloud. */
async function syncGameCardToCloud(
  ctx: Ctx,
  gameCardId: number,
): Promise<void> {
  try {
    const db = ctx.db<typeof schema>();
    const profile = await ensureCollectorProfile(ctx);
    const owner = profile.collectorCode;
    const cardRows = await db
      .select()
      .from(schema.gameCards)
      .where(eq(schema.gameCards.id, gameCardId));
    const card = cardRows[0];
    if (!card) return;
    const desired: CloudItemRow[] = [];
    if (card.ownedQty > 0) {
      desired.push({
        owner_collector_id: owner,
        item_key: `game:${card.id}`,
        display_name: card.name,
        qty: card.ownedQty,
        kind: "game",
        meta: {
          gameCardId: card.id,
          game: card.game,
          printed: card.printed,
          section: card.sectionName,
          sealed: false,
        },
      });
    }
    if (card.ownedSealedQty > 0) {
      desired.push({
        owner_collector_id: owner,
        item_key: `game:${card.id}:sealed`,
        display_name: `${card.name} (Sealed)`,
        qty: card.ownedSealedQty,
        kind: "game",
        meta: {
          gameCardId: card.id,
          game: card.game,
          printed: card.printed,
          section: card.sectionName,
          sealed: true,
        },
      });
    }
    const slabs = await db
      .select()
      .from(schema.gradedSlabs)
      .where(eq(schema.gradedSlabs.gameCardId, gameCardId));
    for (const slab of slabs) {
      if (slab.qty <= 0) continue;
      desired.push({
        owner_collector_id: owner,
        item_key: `slab:${slab.company}:${slab.cert}`,
        display_name: `${card.name} — ${slab.company} ${slab.grade}`,
        qty: slab.qty,
        kind: "slab",
        meta: {
          gameCardId: slab.gameCardId,
          company: slab.company,
          cert: slab.cert,
          grade: slab.grade,
          paid: slab.paid,
        },
      });
    }
    // Existing cloud rows for this item: its two game keys plus
    // any slab keys the server already holds for this card —
    // slab keys embed company+cert, so match them via meta.
    const remote = await fetchCloudItems(owner);
    const stale: string[] = [];
    if (remote != null) {
      const desiredKeys = new Set(desired.map((r) => r.item_key));
      for (const r of remote) {
        const mine =
          r.item_key === `game:${card.id}` ||
          r.item_key === `game:${card.id}:sealed` ||
          (r.kind === "slab" && r.meta?.gameCardId === card.id);
        if (mine && !desiredKeys.has(r.item_key)) stale.push(r.item_key);
      }
    }
    if (desired.length > 0) await upsertCloudItems(desired);
    if (stale.length > 0) await deleteCloudItems(owner, stale);
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
  kind: "trade" | "cash" | "marketplace",
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
      : kind === "cash"
        ? db
            .update(schema.cashPurchases)
            .set({ settledAt: now, updatedAt: now })
            .where(eq(schema.cashPurchases.id, dealId))
        : db
            .update(schema.marketplaceOffers)
            .set({ settledAt: now, updatedAt: now })
            .where(eq(schema.marketplaceOffers.id, dealId));
  const stmts: unknown[] = [...cardUpdates, stamp];
  await db.batch(
    stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
  );
  if (plan.localCards.length > 0) await markBackupDirty(ctx);
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
    // Verified badge (Anthony, Nov 4, 2026): a trade that
    // BOTH sides confirmed and BOTH sides rated is the one
    // moment the badge can change hands — conferred here,
    // server-side only, when the counterparty was already
    // verified (see maybeConferVerifiedBadges).
    if (bothRated && trade.completedAt) {
      await maybeConferVerifiedBadges(ctx, {
        kind: "trade",
        refId: trade.id,
        aCode: trade.proposerCode,
        bCode: trade.partnerCode,
        completedAt: trade.completedAt,
      });
    }
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
    // Verified badge: same rule as trades — both sides
    // confirmed and both rated, counterparty already
    // verified (see maybeConferVerifiedBadges).
    if (bothRated && purchase.completedAt) {
      await maybeConferVerifiedBadges(ctx, {
        kind: "cash",
        refId: purchase.id,
        aCode: purchase.buyerCode,
        bCode: purchase.sellerCode,
        completedAt: purchase.completedAt,
      });
    }
  } catch {
    // Same retry-on-next-trigger rule as trades.
  }
}

/** The Marketplace twin of settleCashIfReady (Anthony's
    approved Marketplace design, Nov 4, 2026): when a
    marketplace deal is FULLY complete — both sides confirmed
    AND both sides' feedback in, or the 7-day neutral close —
    the bought copies settle seller -> buyer automatically,
    through the same plan machinery trades and cash purchases
    use. Card listings only: the settlement system moves
    binder printings; sealed and comic listings carry no
    binder card row to move (their deals complete and feed
    Trust exactly as before). */
async function settleMarketplaceIfReady(
  ctx: Ctx,
  offer: typeof schema.marketplaceOffers.$inferSelect,
  listing: typeof schema.marketplaceListings.$inferSelect,
): Promise<void> {
  try {
    if (
      offer.status !== "accepted" ||
      !offer.completedAt ||
      offer.settledAt
    )
      return;
    if (listing.kind !== "card" || listing.cardId == null) {
      // Non-card listings never move binder inventory (sealed
      // and comics settle outside this path; accessory
      // listings are free-standing by design — Anthony,
      // Nov 4, 2026). A both-sides-confirmed, both-rated
      // completion still counts for the verified-badge chain,
      // exactly like a card deal.
      const db0 = ctx.db<typeof schema>();
      const fbs0 = await db0
        .select()
        .from(schema.marketplaceFeedback)
        .where(eq(schema.marketplaceFeedback.offerId, offer.id));
      const bothRated0 =
        fbs0.some((f) => f.fromCode === offer.buyerCode) &&
        fbs0.some((f) => f.fromCode === listing.sellerCode);
      if (bothRated0 && offer.completedAt) {
        await maybeConferVerifiedBadges(ctx, {
          kind: "marketplace",
          refId: offer.id,
          aCode: offer.buyerCode,
          bCode: listing.sellerCode,
          completedAt: offer.completedAt,
        });
      }
      return;
    }
    const profile = await ensureCollectorProfile(ctx);
    const me = profile.collectorCode;
    if (offer.buyerCode !== me && listing.sellerCode !== me) return;
    const db = ctx.db<typeof schema>();
    const fbs = await db
      .select()
      .from(schema.marketplaceFeedback)
      .where(eq(schema.marketplaceFeedback.offerId, offer.id));
    const bothRated =
      fbs.some((f) => f.fromCode === offer.buyerCode) &&
      fbs.some((f) => f.fromCode === listing.sellerCode);
    const neutralClosed =
      Date.now() - Date.parse(offer.completedAt) > FEEDBACK_WINDOW_MS;
    if (!bothRated && !neutralClosed) return;
    let plan: SettlementPlan | null = null;
    if (offer.settlementJson) {
      try {
        plan = JSON.parse(offer.settlementJson) as SettlementPlan;
      } catch {
        plan = null;
      }
    }
    if (!plan) {
      const line: SettlementItem[] = [
        {
          cardId: listing.cardId,
          finish: listing.finish,
          qty: listing.qty,
        },
      ];
      const iAmBuyer = offer.buyerCode === me;
      plan = await buildSettlementPlan(ctx, {
        source: `Marketplace sale #${offer.id}`,
        myGive: iAmBuyer ? [] : line,
        myGet: iAmBuyer ? line : [],
        otherCode: iAmBuyer ? listing.sellerCode : offer.buyerCode,
        theirGive: iAmBuyer ? line : [],
        theirGet: iAmBuyer ? [] : line,
      });
      if (!plan) return;
      await db
        .update(schema.marketplaceOffers)
        .set({
          settlementJson: JSON.stringify(plan),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.marketplaceOffers.id, offer.id));
    }
    await applySettlementPlan(ctx, "marketplace", offer.id, plan);
    // Verified badge: same rule as trades — both sides
    // confirmed and both rated, counterparty already
    // verified (see maybeConferVerifiedBadges).
    if (bothRated && offer.completedAt) {
      await maybeConferVerifiedBadges(ctx, {
        kind: "marketplace",
        refId: offer.id,
        aCode: offer.buyerCode,
        bCode: listing.sellerCode,
        completedAt: offer.completedAt,
      });
    }
  } catch {
    // Same retry-on-next-trigger rule as trades and cash.
  }
}

/* ------------------------------------------------------------------
   Verified badge (Anthony, Nov 4, 2026 — his design; spec at
   research_notes/verified-badge-spec-20261104/spec.md).

   The badge means exactly one thing: identity confirmed on
   the Vault X network. It is NEVER "safe to pay" — the
   in-person QR handshake at deal completion stays the safety
   step. It is earned ONLY two ways:
   (a) a completed trade/cash/marketplace deal where BOTH
       sides confirmed AND both sides left feedback, and the
       OTHER side was already verified at that time — the
       chain flows downhill from the owner as root, so two
       fresh sockpuppet accounts trading with each other earn
       nothing, and a given pair of accounts can confer only
       once, ever;
   (b) the owner's own manual grant from Admin (proof
       honestly reads "Verified by the owner").
   An invite NEVER confers it: vouched_by lineage is an
   Admin-only audit trail and is not read anywhere in this
   module. Revocation (owner, on a substantiated report) is
   recorded, stays visible, and a revoked badge does not
   silently re-earn itself through new trades — restoration
   is the owner's grant. Forum roles (when Forums launches)
   read this same ledger server-side: holding any forum role
   requires status "verified", and a revocation suspends the
   role with the badge.
   ------------------------------------------------------------------ */

const VERIFIED_ROOT_CODE = OWNER_COLLECTOR_CODE;
const VERIFIED_ROOT_USERNAME = "ARuikis";
/** A trade-earned granter must have real standing: their own
    registry account at least this old at conferral time.
    Root, built-in, and owner-granted badges carry standing
    by construction. */
const VERIFIED_STANDING_MS = 7 * 24 * 60 * 60 * 1000;

type BadgeRow = typeof schema.verifiedBadges.$inferSelect;

/** Seed the two launch-verified accounts exactly once
    (Anthony's direct instruction): the owner as root of the
    chain and Jarvis as the built-in friend. Insert-if-absent
    only — a later revocation or owner edit is never
    overwritten by this seed. */
async function ensureVerifiedRoots(ctx: Ctx): Promise<void> {
  const db = ctx.db<typeof schema>();
  const now = new Date().toISOString();
  const roots: {
    code: string;
    username: string;
    basis: "root" | "builtin";
    label: string;
  }[] = [
    {
      code: VERIFIED_ROOT_CODE,
      username: VERIFIED_ROOT_USERNAME,
      basis: "root",
      label: "Owner of Vault X — root of the verification chain",
    },
    {
      code: JARVIS_REGISTRY_PROFILE.collector_id,
      username: JARVIS_REGISTRY_PROFILE.username,
      basis: "builtin",
      label: "Built-in friend account, verified at launch",
    },
  ];
  for (const root of roots) {
    const existing = await db
      .select({
        code: schema.verifiedBadges.collectorCode,
        username: schema.verifiedBadges.username,
      })
      .from(schema.verifiedBadges)
      .where(eq(schema.verifiedBadges.collectorCode, root.code))
      .limit(1);
    // The built-in friend's badge follows his registry name
    // (renamed to "Jarvis (Test)" Nov 9, 2026): refresh the
    // stored label only — status, basis, and proof are never
    // touched here, and the owner's root row is left alone.
    if (
      existing.length > 0 &&
      root.basis === "builtin" &&
      existing[0] &&
      existing[0].username !== root.username
    ) {
      await db
        .update(schema.verifiedBadges)
        .set({ username: root.username, updatedAt: now })
        .where(eq(schema.verifiedBadges.collectorCode, root.code));
    }
    if (existing.length === 0) {
      await db.insert(schema.verifiedBadges).values({
        collectorCode: root.code,
        username: root.username,
        status: "verified",
        basis: root.basis,
        proofJson: JSON.stringify({ label: root.label }),
        grantedAt: now,
        revokedAt: null,
        revokedBy: null,
        updatedAt: now,
      });
    }
  }
}

async function badgeRowFor(
  ctx: Ctx,
  code: string,
): Promise<BadgeRow | null> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.verifiedBadges)
    .where(eq(schema.verifiedBadges.collectorCode, code))
    .limit(1);
  return rows[0] ?? null;
}

/** Registry join instant for one collector, or null when the
    registry can't tell us (unreachable / not registered). */
async function registryJoinedAt(
  code: string,
): Promise<string | null> {
  const list = await supabaseRest(
    "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
  );
  if (!list.ok) return null;
  const row = asRegistryRows(list.json).find(
    (r) => r.collector_id === code,
  );
  return row?.created_at ?? null;
}

/** Confer the badge on both directions of one fully completed
    deal, where earned. Called ONLY from the settlement paths
    once both sides' feedback is in (never on the 7-day
    neutral close: an unrated side resolved nothing). Every
    failure is swallowed — badge bookkeeping must never break
    a settlement that already landed. */
async function maybeConferVerifiedBadges(
  ctx: Ctx,
  deal: {
    kind: "trade" | "cash" | "marketplace";
    refId: number;
    aCode: string;
    bCode: string;
    completedAt: string;
  },
): Promise<void> {
  try {
    await ensureVerifiedRoots(ctx);
    const db = ctx.db<typeof schema>();
    const directions: { earner: string; granter: string }[] = [
      { earner: deal.aCode, granter: deal.bCode },
      { earner: deal.bCode, granter: deal.aCode },
    ];
    for (const { earner, granter } of directions) {
      if (earner === granter) continue;
      const granterRow = await badgeRowFor(ctx, granter);
      if (!granterRow || granterRow.status !== "verified") continue;
      // An earner who already holds (or once held and lost)
      // the badge is not re-conferred by a trade: a first
      // grant happens once, and a revoked badge is restored
      // only by the owner's own grant.
      const earnerRow = await badgeRowFor(ctx, earner);
      if (earnerRow) continue;
      // The pair rule: this pair can confer only once, ever.
      const prior = await db
        .select({ id: schema.badgeConferrals.id })
        .from(schema.badgeConferrals)
        .where(
          and(
            eq(schema.badgeConferrals.earnerCode, earner),
            eq(schema.badgeConferrals.granterCode, granter),
          ),
        )
        .limit(1);
      if (prior.length > 0) continue;
      // Standing: a trade-earned granter must not be a fresh
      // account — their registry account must be at least a
      // week old at conferral. Root / built-in / owner
      // grants carry standing by construction.
      if (granterRow.basis === "trade") {
        const joined = await registryJoinedAt(granter);
        if (
          !joined ||
          Date.parse(deal.completedAt) - Date.parse(joined) <
            VERIFIED_STANDING_MS
        )
          continue;
      }
      // Proof names the counterparty honestly: registry
      // username when the registry knows it, the badge
      // ledger's own record otherwise.
      const granterName =
        (await registryUsername(granter)) ?? granterRow.username;
      const earnerName =
        (await registryUsername(earner)) ?? earner;
      const now = new Date().toISOString();
      await db.insert(schema.badgeConferrals).values({
        earnerCode: earner,
        granterCode: granter,
        kind: deal.kind,
        refId: deal.refId,
        createdAt: now,
      });
      await db.insert(schema.verifiedBadges).values({
        collectorCode: earner,
        username: earnerName,
        status: "verified",
        basis: "trade",
        proofJson: JSON.stringify({
          kind: deal.kind,
          refId: deal.refId,
          withCode: granter,
          withUsername: granterName,
          completedAt: deal.completedAt,
        }),
        grantedAt: now,
        revokedAt: null,
        revokedBy: null,
        updatedAt: now,
      });
    }
  } catch {
    // Best-effort by design (see the module note above).
  }
}

async function registryUsername(
  code: string,
): Promise<string | null> {
  const list = await supabaseRest(
    "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
  );
  if (!list.ok) return null;
  const row = asRegistryRows(list.json).find(
    (r) => r.collector_id === code,
  );
  return row?.username ?? null;
}

/* ------------------------------------------------------------------
   Invite lineage (Anthony, Nov 4, 2026): every user's Share
   Vault X invite carries their OWN invite code — a value
   derived deterministically from their Collector ID, so it
   is distinct from the Collector ID in form and value, is
   the same on every device, and can be resolved back to the
   inviting collector by any Vault X server against the
   registry roster. A newcomer never types a NAME in — the
   code from the invite is what gets presented, so
   attribution can't be faked or used to frame someone.
   The record is OWNER-ONLY audit data (Admin), kept for
   abuse tracing; it never grants, implies, or feeds the
   verified badge above.
   ------------------------------------------------------------------ */

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The invite code for one collector: "VX-" + 6 characters
    derived from their Collector ID (FNV-1a over the code, so
    it is stable forever and resolvable roster-wide). */
function inviteCodeForCollector(collectorCode: string): string {
  let hash = 0x811c9dc5;
  const seed = `vaultx-invite:${collectorCode}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = "";
  let h = hash >>> 0;
  for (let i = 0; i < 6; i++) {
    out += INVITE_ALPHABET.charAt(h % INVITE_ALPHABET.length);
    // Keep h unsigned every round: a signed h makes the modulo
    // negative and the lookup undefined (the VX-…undefined bug).
    h = ((Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0) ^ (i + 1)) >>> 0;
  }
  return `VX-${out}`;
}

/** Resolve a presented invite code against the live registry
    roster: returns the inviting collector, or null when the
    code matches nobody (recorded honestly as no voucher on
    file — registration is never blocked by it). */
async function resolveInviteCode(
  presented: string,
): Promise<{ collectorId: string; username: string } | null> {
  const clean = presented.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^VX-[A-Z0-9]{6}$/.test(clean)) return null;
  const list = await supabaseRest(
    "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
  );
  if (!list.ok) return null;
  const rows = asRegistryRows(list.json);
  const hit = rows.find(
    (r) => inviteCodeForCollector(r.collector_id) === clean,
  );
  return hit
    ? { collectorId: hit.collector_id, username: hit.username }
    : null;
}

/** ---- Forums (Anthony, Nov 4, 2026 — Direction A, LIVE) ----
    Roles are forum-scoped and hang off the verified-badge
    ledger by Anthony's hard rule: NO forum role without a
    currently verified badge. The owner's Owner role is
    inherent. A granted role is EFFECTIVE only while its row
    is unsuspended AND the holder's badge is verified; a
    badge revocation suspends the row (see
    revokeVerifiedBadge), and only an owner re-grant clears
    the suspension. Invite lineage plays NO part here (the
    guardrail: vouched-by never feeds verification or
    roles). */
type ForumRole = "owner" | "admin" | "moderator";

async function forumRoleFor(
  ctx: Ctx,
  code: string,
): Promise<ForumRole | null> {
  if (code === OWNER_COLLECTOR_CODE) return "owner";
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.forumRoles)
    .where(eq(schema.forumRoles.collectorCode, code))
    .limit(1);
  const row = rows[0];
  if (!row || row.suspended === 1) return null;
  const badge = await badgeRowFor(ctx, code);
  if (!badge || badge.status !== "verified") return null;
  return row.role === "admin" ? "admin" : "moderator";
}

/** Confirmed trades behind an author's forum trust strip:
    deals in THIS app's ledgers where the collector was a
    party and both sides confirmed completion. */
async function forumConfirmedTrades(ctx: Ctx, code: string): Promise<number> {
  const db = ctx.db<typeof schema>();
  const [trades, cash, offers, listings] = await Promise.all([
    db.select().from(schema.tradeOffers),
    db.select().from(schema.cashPurchases),
    db.select().from(schema.marketplaceOffers),
    db.select().from(schema.marketplaceListings),
  ]);
  const listingSeller = new Map(listings.map((l) => [l.id, l.sellerCode]));
  let n = 0;
  for (const t of trades)
    if (t.completedAt && (t.proposerCode === code || t.partnerCode === code))
      n++;
  for (const c of cash)
    if (c.completedAt && (c.buyerCode === code || c.sellerCode === code)) n++;
  for (const o of offers)
    if (
      o.completedAt &&
      (o.buyerCode === code || listingSeller.get(o.listingId) === code)
    )
      n++;
  return n;
}

const FORUM_CATEGORIES = [
  "announcements",
  "general",
  "showoffs",
  "decktalk",
  "grading",
  "trading",
  "help",
] as const;

const forumThreadView = z.object({
  id: z.number(),
  category: z.string(),
  title: z.string(),
  authorCode: z.string(),
  authorUsername: z.string(),
  authorRole: z.enum(["owner", "admin", "moderator"]).nullable(),
  authorVerified: z.boolean(),
  pinned: z.boolean(),
  locked: z.boolean(),
  replyCount: z.number(),
  createdAt: z.number(),
  lastActivityAt: z.number(),
  lastPostBy: z.string().nullable(),
  unread: z.boolean(),
  mine: z.boolean(),
});

const forumPostView = z.object({
  id: z.number(),
  authorCode: z.string(),
  authorUsername: z.string(),
  authorRole: z.enum(["owner", "admin", "moderator"]).nullable(),
  authorVerified: z.boolean(),
  confirmedTrades: z.number(),
  body: z.string(),
  createdAt: z.number(),
  mine: z.boolean(),
});

/** Who is posting: Anthony himself, or the built-in test
    friend when he explicitly drives Jarvis's side (the same
    labeled test path the deal flows use). */
async function forumActor(
  ctx: Ctx,
  asTestFriend: boolean,
): Promise<{ code: string; username: string }> {
  const profile = await ensureCollectorProfile(ctx);
  if (asTestFriend)
    return {
      code: JARVIS_REGISTRY_PROFILE.collector_id,
      username: JARVIS_REGISTRY_PROFILE.username,
    };
  return { code: profile.collectorCode, username: profile.username };
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
  /** ISO instant of the most recent recorded collection change
      (Nov 9, 2026 backup habit); null = no change recorded yet. */
  lastChangeAt: z.string().nullable(),
  /** ISO instant of the most recent completed, verified full
      sync; null = no full sync has completed yet. */
  lastFullSyncAt: z.string().nullable(),
  /** ISO instant the daily backup check last ran; null = it
      has not run yet. */
  lastDailyCheckAt: z.string().nullable(),
  /** True when a recorded change is newer than the last full
      sync — a full check (debounced, on-close, or daily) is
      still owed even if the per-change pushes already landed. */
  needsFullCheck: z.boolean(),
});

const dailyBackupCheckResponse = z.object({
  /** ISO instant this check ran. */
  checkedAt: z.string(),
  /** True when the check ran a full sync (one was owed, or the
      last full sync was over a day old). */
  synced: z.boolean(),
  /** True when the cloud server answered during the check. */
  reachable: z.boolean(),
  items: z.number(),
  copies: z.number(),
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
  /** One of the two seeded EXAMPLE listings (Elsa / Stitch,
      listed by the built-in test friend to demonstrate the
      Marketplace): the client watermarks its photo
      "EXAMPLE SALE" so it can never be passed off as a real
      item for sale (Anthony, Nov 4, 2026). Only the seeded
      demo listings carry this — real collectors' listings
      never do. */
  isExample: z.boolean(),
  kind: z.enum(["card", "sealed", "comic", "other"]),
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
  /** The seller's per-listing "Allow offers" switch. False =
      fixed price only: Buy Now is the only way to buy it. */
  allowOffers: z.boolean(),
  /** Current market value per unit (cards/sealed resolved live;
      comics carry their logged value). ALWAYS null on
      accessory listings — there is no tracked market for
      accessories, so no comparison is ever shown for them. */
  marketValue: z.number().nullable(),
  /** Accessory listings only: the seller's description and
      preset category; null on catalog listings. */
  description: z.string().nullable(),
  category: z.string().nullable(),
  /** The seller's photo URL — resolved ONLY when the photo is
      approved, or when the viewer is the seller. Null while a
      photo is pending/rejected (the client renders the
      "Photo pending approval" placeholder instead). */
  photoUrl: z.string().nullable(),
  photoStatus: z
    .enum(["pending", "approved", "rejected"])
    .nullable(),
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

/** One seller's shop inside the Marketplace (Anthony's
    approved design, Nov 4, 2026): the seller's live listings
    plus their verified track record — confirmed sales count
    only ever counts deals both sides confirmed complete.
    Trust Score itself is read from the registry client-side,
    the same source the rest of the Marketplace uses. */
const marketplaceShopResponse = z.object({
  sellerCode: z.string(),
  sellerUsername: z.string(),
  sellerIsTest: z.boolean(),
  mine: z.boolean(),
  confirmedSales: z.number(),
  listingsLive: z.number(),
  listings: z.array(marketplaceListing),
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
  kind: z.enum(["card", "sealed", "comic", "other"]),
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
  kind: z.enum(["card", "sealed", "comic", "other"]),
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
  /** Accessory deals: the seller's photo (same visibility
      rule as listings — approved, or mine as the seller). */
  photoUrl: z.string().nullable(),
  photoStatus: z
    .enum(["pending", "approved", "rejected"])
    .nullable(),
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
    isExample:
      row.sellerCode === JARVIS_REGISTRY_PROFILE.collector_id &&
      JARVIS_SEED_LISTINGS.some(
        (s) => s.name === row.name && s.finish === row.finish,
      ),
    kind: row.kind as "card" | "sealed" | "comic" | "other",
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
    allowOffers: row.allowOffers === 1,
    marketValue: row.kind === "other" ? null : marketValue,
    description: row.description ?? null,
    category: row.category ?? null,
    photoUrl: null,
    photoStatus: (row.photoStatus as
      | "pending"
      | "approved"
      | "rejected"
      | null) ?? null,
    status: row.status as "available" | "pending" | "sold" | "removed",
    createdAt: row.createdAt,
    mine: row.sellerCode === myCode,
    pendingOffers: pendingByListing.get(row.id) ?? 0,
  };
}

/** Resolves listing views WITH their photo URLs (accessory
    listings): a photo resolves only when it is approved, or
    when the viewer is the seller (their own listings show
    their photo plus its review state). Everyone else gets
    photoUrl null and renders the themed placeholder — the
    listing itself is live from the moment it is posted
    (Anthony's corrected photo-gate flow, Nov 4, 2026). */
async function listingViewsWithPhotos(
  ctx: Ctx,
  rows: ListingRow[],
  myCode: string,
  view: Awaited<ReturnType<typeof listingViewContext>>,
): Promise<z.infer<typeof marketplaceListing>[]> {
  return Promise.all(
    rows.map(async (r) => {
      const v = toListingView(
        r,
        myCode,
        view.cardById,
        view.sealedUnitByName,
        view.pendingByListing,
      );
      if (
        r.kind === "other" &&
        r.photoBlobKey &&
        (r.photoStatus === "approved" || r.sellerCode === myCode)
      ) {
        try {
          v.photoUrl = await ctx.blobs.getUrl(r.photoBlobKey);
        } catch {
          v.photoUrl = null;
        }
      }
      return v;
    }),
  );
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

/** Result of a buy-list hand-off (restored Nov 4, 2026 at
    Anthony's explicit direction — see spawnBuyListHandoff). */
const buyListHandoffResponse = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  /** Distinct TCGplayer products handed over. */
  products: z.number(),
  /** Total copies across those products. */
  copies: z.number(),
  /** Missing copies with no TCGplayer product ID — they cannot
      ride the hand-off and are disclosed, never silently dropped. */
  skippedNoId: z.number(),
  taskId: z.string().nullable(),
});

type BuyListHandoffResult = z.infer<typeof buyListHandoffResponse>;

/** The TCGplayer buy-list hand-off, RESTORED Nov 4, 2026 at
    Anthony's explicit direction. History: the original Nov 3
    feature (requestBuyList / requestDeckBuyList) was removed in
    v1.82.3 because no user turn had authorized the artifact to
    send collection-derived lists to an agent that would cart on
    an external merchant. On Nov 4, 2026 (~6:06 PM CT voice
    call) Anthony was walked through exactly what the hand-off
    sends, confirmed it is only the missing cards — not his
    whole library — said he does not mind that sharing, and
    approved restoring it. Scope, exactly as he approved:
    - fires ONLY from the user's tap, behind the per-run
      confirmed:true gate the client drives;
    - the payload is ONLY the missing printings' public
      TCGplayer product IDs and quantities — no card names,
      sets, finishes, prices, totals, deck names, or usernames,
      and nothing about the rest of the collection;
    - cart preparation only — the receiving Muse builds the
      cart on TCGplayer under the user's own sign-in and NEVER
      checks out; final payment approval stays with the user.
    The list itself is recomputed server-side from live rows
    (never trusted from the client), so what is sent is exactly
    what the user is looking at. */
async function spawnBuyListHandoff(
  ctx: Ctx,
  items: { tcgplayerId: string | null; qty: number }[],
  scope: "set" | "deck",
): Promise<BuyListHandoffResult> {
  const byProduct = new Map<string, number>();
  let skippedNoId = 0;
  for (const item of items) {
    if (item.qty <= 0) continue;
    if (!item.tcgplayerId) {
      skippedNoId += item.qty;
      continue;
    }
    byProduct.set(
      item.tcgplayerId,
      (byProduct.get(item.tcgplayerId) ?? 0) + item.qty,
    );
  }
  const lines = [...byProduct.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const copies = lines.reduce((sum, [, qty]) => sum + qty, 0);
  if (lines.length === 0) {
    return {
      ok: false,
      error:
        skippedNoId > 0
          ? "None of the missing cards carry a TCGplayer product ID, so there is nothing your Muse can build a cart from. The cards stay listed here with everything the app knows about them."
          : "Nothing is missing — there is no buy list to send.",
      products: 0,
      copies: 0,
      skippedNoId,
      taskId: null,
    };
  }
  // Single-flight key: the same list re-sent is the same job;
  // a changed list is a new job. The key is internal — only the
  // message below reaches the agent.
  const payloadText = lines.map(([id, qty]) => `${id}x${qty}`).join(",");
  let hash = 5381;
  for (let i = 0; i < payloadText.length; i++)
    hash = ((hash * 33) ^ payloadText.charCodeAt(i)) >>> 0;
  const message = [
    "Your user tapped “Send buy list to my Muse” in Vault X, their collection app, and asked you to build this buy list into a cart on TCGplayer under their own account sign-in.",
    "The list is TCGplayer product IDs and quantities only — one line per product to add (each product page is https://www.tcgplayer.com/product/<id>):",
    ...lines.map(([id, qty]) => `- Product ${id} × ${qty}`),
    "Do this:",
    "1. On TCGplayer, signed in as the user, add each product above to the cart at the stated quantity, Near Mint condition.",
    "2. Follow the user's standing TCGplayer cart rules: Near Mint only; never keep a package that ships a SINGLE card for more than $3 shipping — swap that copy to a Near Mint listing at $3 shipping or under, or leave it out and say so in your report; when several cards ship together from one seller, a little over $3 for that package is fine; prefer fewer sellers where prices are close.",
    "3. Where a quantity covers more than one finish of the same product (for example a normal and a foil copy of one printing) and the product page offers finish variants, prefer one of each variant over duplicates of a single variant.",
    "4. NEVER check out, pay, or place an order. Cart preparation only — final payment approval is always the user's. Leave the cart ready on their account and report back to the user in chat: what went into the cart, anything left out and why, and the cart total before tax.",
  ].join("\n");
  // Guest access (platform v27): the hand-off spawns an
  // agent task — owner-only, and unavailable in the shared
  // runtime for every viewer. Nothing is sent.
  if (agentCapabilityBlocked(ctx)) {
    return {
      ok: false,
      error:
        "Buy-list hand-off isn't available here (shared_artifact_vm_capability_unavailable) — it runs from your own Vault X, where your Muse can take the list. Nothing was sent.",
      products: lines.length,
      copies,
      skippedNoId,
      taskId: null,
    };
  }
  const result = await ctx.agent.spawnTask(message, {
    dedupeKey: `vaultx-buylist-${scope}-${hash.toString(36)}`,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        "The hand-off didn't start — your Muse couldn't be reached to take the list. Nothing was sent; try again in a moment.",
      products: lines.length,
      copies,
      skippedNoId,
      taskId: null,
    };
  }
  return {
    ok: true,
    error: null,
    products: lines.length,
    copies,
    skippedNoId,
    taskId: result.taskId,
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

/* Every tile key the collection order/visibility system
   knows, in canonical default order (Anthony, Nov 4, 2026 —
   the TCG Universe condensation + Sports Cards): Home's
   main areas first (TCG Universe, Comics, Legos, Funko,
   Sports Cards), then the four TCG games that now live
   INSIDE the TCG Universe page (Lorcana, Pokémon, Star Wars
   Unlimited, Magic: The Gathering). One stored order and
   one hidden list serve both places: Home renders the main
   areas in their stored relative order, the TCG Universe
   page renders the games in theirs, and hiding works the
   same in both. */
const COLLECTION_TILE_KEYS = [
  "tcg",
  "comics",
  "lego",
  "funko",
  "sports",
  "toppsau",
  "lorcana",
  "pokemon",
  "starwars",
  "magic",
  "disneytopps",
  "starwarstopps",
  "gpk",
  "wwetopps",
] as const;

/** The four TCG game keys, for the condensation's
    slot-in rule in resolveCollectionOrder below. */
const TCG_GAME_TILE_KEYS = [
  "lorcana",
  "pokemon",
  "starwars",
  "magic",
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

/** The user's tile order resolved to the full tile list:
    their saved keys first (deduped, valid keys only), then
    any tile they never ordered — or that was added after
    they saved — in its default position. Null/empty saved
    order = the default order exactly. One condensation
    rule (Nov 4, 2026): "tcg" did not exist when existing
    orders were saved, so when it is missing it slots in
    where the games it now contains used to start — at the
    first saved TCG game key, or the front when none was
    saved — instead of trailing at the end; the games keep
    their saved relative order behind it for the TCG
    Universe page. */
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
  if (!seen.has("tcg")) {
    const firstGame = out.findIndex((k) =>
      (TCG_GAME_TILE_KEYS as readonly string[]).includes(k),
    );
    out.splice(firstGame >= 0 ? firstGame : 0, 0, "tcg");
    seen.add("tcg");
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

type GameKey =
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

/** Guest access (platform v27): actions that spend agent or
    model capability — spawning agent tasks or running
    inference — are owner-only operations, and the shared
    runtime cannot run them for ANY viewer, the signed-in
    owner included. They run only for a proven local owner:
    the owner's own browser, or the owner's agent / schedule
    delegates, which act as the owner. A missing viewer is not
    proof of ownership, and a shared-runtime (cloudflare)
    viewer never qualifies; blocked callers get each action's
    plain "not started / unavailable" result, with
    shared_artifact_vm_capability_unavailable named in the
    message-carrying shapes, while the daily schedules keep
    the same refreshes running locally. */
function agentCapabilityBlocked(ctx: Ctx): boolean {
  const v = ctx.viewer;
  if (!v) return true;
  if (v.source !== "local") return true;
  return !(v.isOwner === true || v.delegate != null);
}

/** Graded-slab cert rules for the top five grading
    companies (Anthony, Nov 5, 2026 — cert scanning for PSA,
    Beckett (BGS), SGC, CGC Cards, and TAG; every other
    company stays parked from Nov 3). Each company prints
    its cert in its own shape and grades on its own scale
    (researched from the companies' published label and
    lookup documentation when this was built):
    - PSA: digits only, leading zeros kept; half grades
      top out at 8.5 (there is no PSA 9.5); plus Authentic.
    - Beckett (BGS): digits (older certs as short as 6,
      modern 10); full half grades INCLUDING 9.5 Gem Mint;
      plus Authentic.
    - SGC: 7 digits on black labels, or 11 characters
      (XXXXXXX-XXX) on green/white labels; half grades
      including 9.5; plus Authentic.
    - CGC Cards: 10-digit certs; half grades including 9.5,
      plus Pristine 10 and Perfect 10 above Gem Mint 10,
      plus Authentic.
    - TAG: typically 1 letter + 7 numbers; NO 9.5 (TAG's
      published scale skips it); Pristine 10 above Gem
      Mint 10; no Authentic designation.
    Normalization never invents characters: it uppercases,
    drops spaces, and (for the digit companies) keeps only
    digits — SGC's 10 straight digits gain the printed
    hyphen of the 11-character format. */
const GRADING_COMPANIES = ["PSA", "BGS", "SGC", "CGC", "TAG"] as const;
type GradingCompanyKey = (typeof GRADING_COMPANIES)[number];

function normalizeGradedCert(
  company: GradingCompanyKey,
  raw: string,
): string {
  const cleaned = raw.toUpperCase().replace(/\s+/g, "");
  if (company === "TAG") return cleaned.replace(/[^A-Z0-9]/g, "");
  if (company === "SGC") {
    if (/^\d{7}$/.test(cleaned)) return cleaned;
    if (/^\d{7}-\d{3}$/.test(cleaned)) return cleaned;
    const digits = cleaned.replace(/\D/g, "");
    if (/^\d{10}$/.test(digits)) {
      return `${digits.slice(0, 7)}-${digits.slice(7)}`;
    }
    return cleaned;
  }
  return cleaned.replace(/\D/g, "");
}

function gradedCertValid(
  company: GradingCompanyKey,
  cert: string,
): boolean {
  switch (company) {
    case "PSA":
    case "BGS":
      return /^\d{5,12}$/.test(cert);
    case "CGC":
      return /^\d{7,12}$/.test(cert);
    case "SGC":
      return /^\d{7}$/.test(cert) || /^\d{7}-\d{3}$/.test(cert);
    case "TAG":
      return /^[A-Z0-9]{6,12}$/.test(cert) && /\d/.test(cert);
  }
}

function gradedGradeValid(
  company: GradingCompanyKey,
  grade: string,
): boolean {
  const halves = [
    "9.5", "8.5", "7.5", "6.5", "5.5", "4.5", "3.5", "2.5", "1.5",
  ];
  const whole = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1"];
  const withNineFive = new Set([...whole, ...halves, "Authentic"]);
  const noNineFive = new Set(
    [...whole, ...halves, "Authentic"].filter((g) => g !== "9.5"),
  );
  switch (company) {
    case "PSA":
      return noNineFive.has(grade);
    case "BGS":
    case "SGC":
      return withNineFive.has(grade);
    case "CGC":
      return withNineFive.has(grade) ||
        grade === "Pristine 10" ||
        grade === "Perfect 10";
    case "TAG":
      return (
        (noNineFive.has(grade) && grade !== "Authentic") ||
        grade === "Pristine 10"
      );
  }
}

/** The graded-slab shape every slab action returns (Nov 5,
    2026, Card / Slab View build): the v1.95 record plus the
    copy count under this company+cert, the imported slab
    photos (app-owned blob URLs — the company's hosted bytes
    are copied into blob storage at lookup time, never
    hotlinked), where the front photo came from ("company" |
    "user" | null), and the company's own online description
    line when a lookup read one. */
const gradedSlabZ = z.object({
  id: z.number(),
  company: z.string(),
  cert: z.string(),
  grade: z.string(),
  paid: z.number().nullable(),
  qty: z.number(),
  imageUrl: z.string().nullable(),
  imageBackUrl: z.string().nullable(),
  imageSource: z.string().nullable(),
  onlineLine: z.string().nullable(),
  createdAt: z.number(),
});

async function gradedSlabShape(
  ctx: Ctx,
  r: typeof schema.gradedSlabs.$inferSelect,
): Promise<z.infer<typeof gradedSlabZ>> {
  return {
    id: r.id,
    company: r.company,
    cert: r.cert,
    grade: r.grade,
    paid: r.paid,
    qty: r.qty,
    imageUrl: r.imageKey ? await safeBlobUrl(ctx, r.imageKey) : null,
    imageBackUrl: r.imageBackKey
      ? await safeBlobUrl(ctx, r.imageBackKey)
      : null,
    imageSource: r.imageSource,
    onlineLine: r.onlineLine,
    createdAt: r.createdAt,
  };
}

/** The public cert-page URL for a company + cert — the same
    destinations the client links out to, so the lookup and
    the UI never disagree about where a record lives. SGC
    publishes no cert-carrying URL (its lookup is a form), so
    it returns the form's page. */
function gradedCertPageUrl(
  company: GradingCompanyKey,
  cert: string,
): string {
  switch (company) {
    case "PSA":
      return `https://www.psacard.com/cert/${cert}/psa`;
    case "BGS":
      return `https://www.beckett.com/grading/card-lookup?flag=1&item_id=${cert}`;
    case "SGC":
      return "https://www.gosgc.com/cert-code-lookup";
    case "CGC":
      return `https://www.cgccards.uk/certlookup/${cert}/`;
    case "TAG":
      return `https://my.taggrading.com/card/${cert}`;
  }
}

const GRADED_LOOKUP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** PSA's cert page prints grades as words ("GEM MT 10",
    "MINT 9", "NM-MT 8"); map the printed text onto the
    app's grade values. Anything unrecognized comes back
    null — the collector's own label read then rules, the
    lookup never invents a grade. */
function psaGradeFromText(raw: string): string | null {
  const t = raw.toUpperCase().replace(/\s+/g, " ").trim();
  if (t.includes("AUTHENTIC")) return "Authentic";
  const map: [string, string][] = [
    ["GEM MT 10", "10"],
    ["GEM MINT 10", "10"],
    ["MINT 9", "9"],
    ["NM-MT 8", "8"],
    ["NM 7", "7"],
    ["EX-MT 6", "6"],
    ["EX 5", "5"],
    ["VG-EX 4", "4"],
    ["VG 3", "3"],
    ["GOOD 2", "2"],
    ["FAIR 1.5", "1.5"],
    ["FR 1.5", "1.5"],
    ["POOR 1", "1"],
    ["PR 1", "1"],
  ];
  for (const [needle, grade] of map) {
    if (t.startsWith(needle)) return grade;
  }
  const m = t.match(/\b(10|9|8|7|6|5|4|3|2|1)(\.5)?\b/);
  return m ? `${m[1]}${m[2] ?? ""}` : null;
}

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
  // Transient-source retry (Anthony, Nov 5, 2026 — the
  // Pokémon download that cancelled itself ~5 seconds in):
  // the Pokémon TCG API intermittently answers 500/502 for
  // a page it served fine seconds earlier (verified live
  // from this server: the importer's exact page URL failed
  // roughly half the time while small queries succeeded).
  // One such answer used to fail the whole chunk call, and
  // the client loop treated that single failure as the end
  // of the download. A failed fetch now retries twice with
  // a short backoff before giving up, so a one-off hiccup
  // never reaches the caller; a definitive client error
  // (4xx other than 429) is NOT retried — that answer is
  // real, not transient.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleepMs(attempt === 1 ? 700 : 1600);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "VaultX catalog import" },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        throw new Error(`fetch ${res.status} for ${url}`);
      }
      return (await res.json()) as unknown;
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : "";
      const status = msg.match(/^fetch (\d{3}) for /)?.[1];
      if (status) {
        const code = parseInt(status, 10);
        if (code >= 400 && code < 500 && code !== 429) break;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`fetch failed for ${url}`);
}

const sleepMs = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

type ImportState = {
  sets?: { key: string; name: string; sort: number; total?: number }[];
  cursor?: number;
  page?: number;
  totalPages?: number;
  sectionSorts?: Record<string, number>;
  sectionCounts?: Record<string, number>;
  /** Topps checklist files (one per product), discovered from
      Topps' own checklist index; cursor walks this list. */
  files?: { key: string; name: string; sort: number; url: string }[];
  /** Checklist files that failed to fetch or parse; skipped
      for this pass and named here so the gap is auditable. */
  failedFiles?: string[];
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


/* Funko Pop! (Anthony, Nov 4, 2026): the catalog source is
   the open-source funko-pop-data dataset (MIT) — scraped
   from Pop Price Guide / HobbyDB, the collector-tracked
   catalog — one entry per collectible figure, variants
   (Chase, exclusives) as their own entries with their own
   handles. Each entry carries a title, a photo link, and a
   series list: the Pop! line (Pop! Heroes, Pop! Movies,
   Pop! Animation…) becomes the section, and the remaining
   series tags (retailer/convention exclusives, Chase) ride
   as the variant info. Known gaps, stated honestly: the
   dataset's last update is January 3, 2021, so figures
   released after that are NOT in it yet, and the source
   carries no per-line figure numbers and no prices — rows
   honestly carry neither. The file is one ~7.4 MB JSON
   array, so a chunk call slices the next entries off the
   saved cursor; the download resumes exactly where it
   stopped, like the game catalogs. */
const FUNKO_SOURCE_URL =
  "https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json";

/** The dataset carries a few HTML-encoded names straight
    from its scrape ("Black &amp; White"); decode the common
    entities so figures display exactly as named. */
function funkoText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function funkoHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Toys only (Anthony, Nov 4, 2026): the Funko section is
    for collectible toys and figures — apparel, pins, Pez
    dispensers, books, home goods, the board game, and
    shirt / pint-glass bundles are NOT Funko Pop toys, so
    they never enter the catalog and rows imported earlier
    come out (purgeFunkoNonToys runs this same predicate
    over stored rows). PLUSH STAYS — Anthony decided that
    explicitly — and no pattern below touches a plush line:
    "Pint Size Heroes" are mini figures, not pins, and are
    not matched either (the pin pattern is the exact
    "Pop! Pins" line only). */
function funkoIsNonToy(tags: string[], title: string): boolean {
  const t = title.toLowerCase();
  if (
    t.includes("pint glass") ||
    t.includes("board game") ||
    t.includes("funkoverse")
  ) {
    return true;
  }
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase();
    if (tag.includes("tees & apparel")) return true;
    if (tag.startsWith("pop! pins")) return true;
    if (tag.includes("pez")) return true;
    if (tag === "pop! books") return true;
    if (tag === "pop! home") return true;
    // Board games hide under their section tag even when the
    // product name never says "board game" (the Five Nights
    // at Freddy's survival game is the case that proved it).
    if (tag.includes("board game")) return true;
    if (tag.includes("shirt pack") || tag.includes("tee pack")) {
      return true;
    }
  }
  return false;
}

async function importFunkoChunk(
  ctx: Ctx,
  state: ImportState,
): Promise<{ state: ImportState; setsTotal: number; setsDone: number; complete: boolean }> {
  // Unlike the paged card-game APIs, this source is ONE
  // static file, so a call processes everything remaining
  // from the saved cursor (the fetch + parse happen once
  // per call either way, and the row inserts batch). The
  // resumable contract is unchanged: the cursor persists
  // with the progress, inserts never overwrite, and a call
  // that dies mid-pass simply resumes on the next one.
  const CHUNK = 25000;
  const res = await fetch(FUNKO_SOURCE_URL, {
    headers: { "user-agent": "VaultX catalog import" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error("funko source unreachable");
  const data = asArr((await res.json()) as unknown);
  const total = data.length;
  const totalChunks = Math.max(1, Math.ceil(total / CHUNK));
  state.totalPages = totalChunks;
  state.sectionSorts = state.sectionSorts ?? {};
  state.sectionCounts = state.sectionCounts ?? {};
  const start = state.cursor ?? 0;
  const slice = data.slice(start, start + CHUNK);
  const rows: GameRow[] = [];
  for (const eRaw of slice) {
    const e = asRec(eRaw);
    const rawTitle = asStr(e.title);
    const handle = asStr(e.handle);
    if (!rawTitle || !handle) continue;
    const title = funkoText(rawTitle);
    const series = asArr(e.series)
      .map((s) => (typeof s === "string" ? funkoText(s) : ""))
      .filter((s) => s.length > 0);
    // Toys only (see funkoIsNonToy): non-toy products are
    // skipped before any section/slot bookkeeping, so they
    // never take a catalog slot.
    if (funkoIsNonToy(series, title)) continue;
    // The section is the figure's Pop! line. Entries whose
    // series list carries no Pop! line at all (only an
    // exclusive/franchise tag) land in the one honest
    // "Funko Pop!" bucket — never in a section named after
    // a retailer tag — and every tag still rides on the
    // row as variant info below.
    const line =
      series.find((s) => s.startsWith("Pop!")) ?? "Funko Pop!";
    if (state.sectionSorts[line] == null) {
      state.sectionSorts[line] = Object.keys(state.sectionSorts).length;
    }
    const slot = state.sectionCounts[line] ?? 0;
    state.sectionCounts[line] = slot + 1;
    const extras = series.filter((s) => s !== line);
    const image = asStr(e.imageName) ?? asStr(e.image);
    rows.push({
      game: "funko",
      uid: `funko:${handle}:${funkoHash(`${title}|${series.join(",")}|${image ?? ""}`)}`,
      sectionKey: line,
      sectionName: line,
      sectionSort: state.sectionSorts[line] ?? 0,
      slotSort: slot,
      number: null,
      printed: "",
      name: title,
      rarity: null,
      finish: extras.length > 0 ? extras.join(", ").slice(0, 160) : null,
      imageUrl: image,
      price: null,
    });
  }
  await insertGameRows(ctx, rows);
  const end = start + slice.length;
  state.cursor = end;
  const chunksDone = Math.min(totalChunks, Math.ceil(end / CHUNK));
  return {
    state,
    setsTotal: totalChunks,
    setsDone: chunksDone,
    complete: end >= total,
  };
}

/** Lego (Anthony, Nov 4, 2026, ~12:10 PM): the FULL Lego
    catalog, imported the same resumable way as the game
    catalogs. Source: Rebrickable's official bulk downloads
    (sets.csv.gz + themes.csv.gz — the standard open Lego
    catalog data, mirrored by BrickLink tooling). One row per
    set: set number, name, theme, year, piece count, and the
    set image Rebrickable hosts. Themes roll up to their ROOT
    theme (a set filed under "Ultimate Collector Series"
    shelves under Star Wars, the way collectors browse), with
    the leaf theme kept on the row's facts line. Known honest
    gaps: Rebrickable publishes no prices (rows carry none)
    and its bulk files carry no per-set minifigure counts
    (the Minifigures area stays an honest empty state until a
    source for those lands). */
const LEGO_SETS_URL =
  "https://cdn.rebrickable.com/media/downloads/sets.csv.gz";
const LEGO_THEMES_URL =
  "https://cdn.rebrickable.com/media/downloads/themes.csv.gz";

async function fetchGzipText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "VaultX catalog import" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  const stream = new Blob([buf])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/** Minimal quoted-CSV parser (Rebrickable names carry
    commas inside quotes). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function importLegoChunk(
  ctx: Ctx,
  state: ImportState,
): Promise<{ state: ImportState; setsTotal: number; setsDone: number; complete: boolean }> {
  // Like Funko, the source is static files: each call
  // re-reads them, rebuilds the same deterministic sorted
  // set list, and inserts the next slice off the saved
  // cursor — inserts never overwrite, so a died call simply
  // resumes.
  const CHUNK = 3000;
  const [themesText, setsText] = await Promise.all([
    fetchGzipText(LEGO_THEMES_URL),
    fetchGzipText(LEGO_SETS_URL),
  ]);
  const themeById = new Map<
    string,
    { name: string; parentId: string | null }
  >();
  for (const r of parseCsvRows(themesText).slice(1)) {
    const id = r[0];
    const name = r[1];
    if (!id || !name) continue;
    themeById.set(id, { name, parentId: r[2] ? r[2] : null });
  }
  const rootCache = new Map<string, { id: string; name: string }>();
  const rootThemeOf = (id: string): { id: string; name: string } => {
    const hit = rootCache.get(id);
    if (hit) return hit;
    let cur = themeById.get(id);
    let curId = id;
    const seen = new Set<string>();
    while (cur?.parentId && themeById.has(cur.parentId) && !seen.has(curId)) {
      seen.add(curId);
      curId = cur.parentId;
      cur = themeById.get(curId);
    }
    const root = { id: curId, name: cur?.name ?? `Theme ${id}` };
    rootCache.set(id, root);
    return root;
  };
  type LegoSet = {
    setNum: string;
    name: string;
    year: number | null;
    rootId: string;
    rootName: string;
    leafName: string;
    parts: number | null;
    img: string | null;
  };
  const sets: LegoSet[] = [];
  for (const r of parseCsvRows(setsText).slice(1)) {
    const setNum = r[0];
    const name = r[1];
    const themeId = r[3];
    if (!setNum || !name || !themeId) continue;
    const root = rootThemeOf(themeId);
    const yearRaw = parseInt(r[2] ?? "", 10);
    const partsRaw = parseInt(r[4] ?? "", 10);
    sets.push({
      setNum,
      name,
      year: Number.isFinite(yearRaw) ? yearRaw : null,
      rootId: root.id,
      rootName: root.name,
      leafName: themeById.get(themeId)?.name ?? root.name,
      parts: Number.isFinite(partsRaw) && partsRaw > 0 ? partsRaw : null,
      img: r[5] ? r[5] : null,
    });
  }
  sets.sort((a, b) => {
    const t = a.rootName.localeCompare(b.rootName);
    if (t !== 0) return t;
    const y = (a.year ?? 9999) - (b.year ?? 9999);
    if (y !== 0) return y;
    return a.setNum.localeCompare(b.setNum, undefined, { numeric: true });
  });
  const total = sets.length;
  const totalChunks = Math.max(1, Math.ceil(total / CHUNK));
  state.totalPages = totalChunks;
  const sectionSorts = (state.sectionSorts ??= {});
  const sectionCounts = (state.sectionCounts ??= {});
  const start = state.cursor ?? 0;
  const slice = sets.slice(start, start + CHUNK);
  const rows: GameRow[] = slice.map((s) => {
    if (sectionSorts[s.rootName] == null) {
      sectionSorts[s.rootName] = Object.keys(sectionSorts).length;
    }
    const slot = sectionCounts[s.rootName] ?? 0;
    sectionCounts[s.rootName] = slot + 1;
    const facts: string[] = [];
    if (s.year != null) facts.push(String(s.year));
    if (s.parts != null) {
      facts.push(`${s.parts.toLocaleString("en-US")} pieces`);
    }
    if (s.leafName !== s.rootName) facts.push(s.leafName);
    return {
      game: "lego",
      uid: `lego:${s.setNum}`,
      sectionKey: s.rootId,
      sectionName: s.rootName,
      sectionSort: sectionSorts[s.rootName] ?? 0,
      slotSort: slot,
      number: s.setNum,
      printed: s.setNum,
      name: s.name,
      rarity: facts.length > 0 ? facts.join(" · ") : null,
      finish: null,
      // Owned-UCS photo overrides (Anthony, Nov 5, 2026):
      // Rebrickable's main photos for these sets crop or hide
      // the display stand, information plaque, and minifigure
      // the sets ship with. Each pin is LEGO's own photography
      // of the complete display, chosen with Anthony:
      //  - 76240-1 Batmobile Tumbler: alt4 (via Brickset) —
      //    LEGO's white-background studio shot: the Tumbler
      //    on its rotating stand, information plaque leaning
      //    at the front. (First pinned to alt3 by migration
      //    0068, then alt17 by 0070 — a lifestyle shot whose
      //    room background Anthony directed cropped out on
      //    Nov 5, 2026; alt4's clean studio background is
      //    what the app's cutout matte removes, leaving the
      //    vehicle, stand, and plaque as a clean cutout
      //    everywhere it appears. Migration 0072.)
      //  - 75095-1 TIE Fighter: Rebrickable's own gallery shot
      //    37222 — the fighter on its display stand, plaque
      //    readable at the base, TIE Pilot minifigure beside
      //    it, on a clean white studio background (migration
      //    0071). Anthony confirmed the image itself is
      //    really good; its white background gets the same
      //    cutout matte treatment as the other two.
      //  - 75275-1 A-Wing Starfighter: alt2 (via Brickset) —
      //    LEGO's white-background studio shot: the ship on
      //    its stand, information plaque at the base, its
      //    pilot minifigure beside it. (alt19, pinned by
      //    migration 0071, was a lifestyle shot on a black
      //    table in a blue room — the background Anthony
      //    directed cropped out; migration 0072.)
      // Pins live here so a fresh import keeps the good
      // photos; imports never overwrite existing rows.
      imageUrl:
        s.setNum === "76240-1"
          ? "https://images.brickset.com/sets/AdditionalImages/76240-1/76240_alt4.jpg"
          : s.setNum === "75095-1"
            ? "https://cdn.rebrickable.com/media/sets/75095-1/37222.jpg"
            : s.setNum === "75275-1"
              ? "https://images.brickset.com/sets/AdditionalImages/75275-1/75275_alt2.jpg"
              : s.img,
      price: null,
    };
  });
  await insertGameRows(ctx, rows);
  const end = start + slice.length;
  state.cursor = end;
  const chunksDone = Math.min(totalChunks, Math.ceil(end / CHUNK));
  return {
    state,
    setsTotal: totalChunks,
    setsDone: chunksDone,
    complete: end >= total,
  };
}

/* Topps sports catalogs (Anthony, Nov 4, 2026, ~8:01 PM —
   the Topps tabs): Baseball gets a Topps tab and Basketball
   a Topps tab, each holding ALL of that sport's Topps
   catalog, DATA ONLY — no artwork is downloaded, linked, or
   stored (his explicit direction). Source: Topps' OWN
   official checklists — the index at
   https://www.topps.com/pages/checklists links one text PDF
   per product on Topps' Shopify CDN (2018–2026 for baseball,
   2021–2026-27 for basketball, flagship + Heritage + Chrome
   + Allen & Ginter + Bowman, which is a Topps brand, and
   every other Topps product line). Each PDF is parsed by
   data/pdfText.ts into card rows: number, player, team, flag
   (Rookie / Team Card / …), and the subset the card sits in.
   Rows carry no price (the checklists publish none) and no
   image. The catalogs TCDB and mycardchecklist were ruled
   out: both forbid scraping/bulk download in their terms.
   Panini basketball has no equivalent manufacturer file
   index (its checklist tool is a JavaScript app with no
   public downloads), so no Panini catalog is imported —
   stated plainly in the app and DATA-PLAN.md rather than
   filled from a prohibited source. */
const TOPPS_CHECKLIST_INDEX = "https://www.topps.com/pages/checklists";

function toppsSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toppsAnchorText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/\s+/g, " ")
    .trim();
}

/** Which Topps index products belong to which catalog
    (Anthony, Nov 4, 2026): Baseball splits by the name on
    the cards — Bowman is its own tab even though Topps owns
    it — and the Topps Alternate Universe areas (Disney,
    Star Wars, Garbage Pail Kids, WWE) each take their named
    products from the same official index. Filters run on
    the lowercased anchor text. */
type ToppsCatalogKey =
  | "topps"
  | "bowman"
  | "topps-basketball"
  | "disney-topps"
  | "starwars-topps"
  | "gpk"
  | "wwe-topps";

const TOPPS_CATALOG_FILTERS: Record<
  ToppsCatalogKey,
  (lowerName: string) => boolean
> = {
  topps: (n) => n.includes("baseball") && !n.includes("bowman"),
  bowman: (n) => n.includes("baseball") && n.includes("bowman"),
  "topps-basketball": (n) => n.includes("basketball"),
  "disney-topps": (n) => n.includes("disney"),
  "starwars-topps": (n) => n.includes("star wars"),
  gpk: (n) => n.includes("garbage pail"),
  "wwe-topps": (n) => /\bwwe\b/.test(n),
};

/** Discover one catalog's checklist files from Topps'
    index: anchor text names the product ("2024 Topps
    Series 1 Baseball"); only direct PDF links count (the
    handful of XLS and "[New Digital Checklist]" entries
    are skipped — no file, no rows). Sorted by year, then
    name, so sections land in release order. */
async function discoverToppsFiles(
  game: ToppsCatalogKey,
): Promise<{ key: string; name: string; sort: number; url: string }[]> {
  const res = await fetch(TOPPS_CHECKLIST_INDEX, {
    headers: { "user-agent": "VaultX catalog import" },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error("topps checklist index unreachable");
  const html = await res.text();
  const keep = TOPPS_CATALOG_FILTERS[game];
  const byKey = new Map<
    string,
    { key: string; name: string; sort: number; url: string }
  >();
  for (const a of html.matchAll(
    /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const href = (a[1] ?? "").split("?")[0]!;
    if (!href.toLowerCase().endsWith(".pdf")) continue;
    if (!href.includes("cdn.shopify.com/s/files/")) continue;
    let name = toppsAnchorText(a[2] ?? "");
    if (!keep(name.toLowerCase())) continue;
    name = name.replace(/\s+checklist$/i, "").trim();
    if (!name) continue;
    const key = toppsSlug(name);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, { key, name, sort: 0, url: href });
  }
  const files = [...byKey.values()].sort((x, y) => {
    const yx = parseInt(x.name.slice(0, 4), 10);
    const yy = parseInt(y.name.slice(0, 4), 10);
    const ax = Number.isFinite(yx) ? yx : 9999;
    const ay = Number.isFinite(yy) ? yy : 9999;
    if (ax !== ay) return ax - ay;
    return x.name.localeCompare(y.name);
  });
  files.forEach((f, i) => {
    f.sort = i;
  });
  return files;
}

async function importToppsChunk(
  ctx: Ctx,
  state: ImportState,
  game: ToppsCatalogKey,
): Promise<{ state: ImportState; setsTotal: number; setsDone: number; complete: boolean }> {
  if (!state.files) {
    state.files = await discoverToppsFiles(game);
    state.cursor = 0;
    state.failedFiles = [];
  }
  const files = state.files;
  const FILES_PER_CALL = 4;
  const start = state.cursor ?? 0;
  const slice = files.slice(start, start + FILES_PER_CALL);
  for (const file of slice) {
    try {
      const res = await fetch(file.url, {
        headers: { "user-agent": "VaultX catalog import" },
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error(`checklist fetch ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 12_000_000) throw new Error("checklist too large");
      const lines = await extractPdfLines(buf);
      const parsed = parseChecklist(lines);
      const rows: GameRow[] = parsed.map((r, i) => {
        const isBase =
          /^base( card)?( set)?$/i.test(r.subset) ||
          /^base cards$/i.test(r.subset);
        const finishParts: string[] = [];
        if (r.team) finishParts.push(r.team);
        if (!isBase && r.subset) finishParts.push(r.subset);
        return {
          game,
          uid: `${game}:${file.key}:${i}`,
          sectionKey: file.key,
          sectionName: file.name,
          sectionSort: file.sort,
          slotSort: i,
          number: r.number,
          printed: r.number,
          name: r.name,
          rarity: r.flag,
          finish: finishParts.length > 0 ? finishParts.join(" · ") : null,
          imageUrl: null,
          price: null,
        };
      });
      await insertGameRows(ctx, rows);
    } catch {
      // A file that fails is skipped for this pass and named
      // in the saved state; the download still completes and
      // the gap stays auditable instead of silent.
      state.failedFiles = [...(state.failedFiles ?? []), file.key];
    }
  }
  const end = start + slice.length;
  state.cursor = end;
  return {
    state,
    setsTotal: files.length,
    setsDone: end,
    complete: end >= files.length,
  };
}

/* Lego set detail shapes (Anthony, Nov 4, 2026 — the Lego
   detail build-out): one shape shared by the researched-detail
   response and the research save, so what the page renders is
   exactly what a research task may store. Every fact is
   nullable — null renders as "unavailable", never a guess. */
const legoMinifigShape = z.object({
  name: z.string(),
  code: z.string().nullable(),
  uniqueToSet: z.boolean(),
  valueUsd: z.number().nullable(),
});
const legoSoldListingShape = z.object({
  date: z.string(),
  priceUsd: z.number(),
  /** "sealed" | "used" */
  condition: z.string(),
  title: z.string().nullable(),
  source: z.string(),
  sourceUrl: z.string().nullable(),
});
const legoRetailerShape = z.object({
  name: z.string(),
  priceUsd: z.number(),
  url: z.string().nullable(),
});
const legoSourceShape = z.object({
  label: z.string(),
  url: z.string(),
});
const legoDetailsShape = z.object({
  setNum: z.string(),
  releaseDate: z.string().nullable(),
  retailPriceUsd: z.number().nullable(),
  ages: z.string().nullable(),
  upc: z.string().nullable(),
  ean: z.string().nullable(),
  dimensions: z.string().nullable(),
  weightGrams: z.number().nullable(),
  buildTime: z.string().nullable(),
  description: z.string().nullable(),
  availability: z.string().nullable(),
  retiredDate: z.string().nullable(),
  expectedRetirement: z.string().nullable(),
  minifigs: z.array(legoMinifigShape),
  minifigsValueUsd: z.number().nullable(),
  partsDistinct: z.number().nullable(),
  partsSpares: z.number().nullable(),
  partOutValueUsd: z.number().nullable(),
  marketSealedUsd: z.number().nullable(),
  marketUsedUsd: z.number().nullable(),
  usedRange: z.string().nullable(),
  annualGrowthPct: z.number().nullable(),
  forecast1yrUsd: z.number().nullable(),
  forecast5yrUsd: z.number().nullable(),
  soldListings: z.array(legoSoldListingShape),
  retailers: z.array(legoRetailerShape),
  sources: z.array(legoSourceShape),
  researchedAt: z.string(),
});
type LegoDetails = z.infer<typeof legoDetailsShape>;

function parseLegoDetailsJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function legoDetailsOf(
  row: typeof schema.legoSetDetails.$inferSelect,
): LegoDetails {
  return {
    setNum: row.setNum,
    releaseDate: row.releaseDate,
    retailPriceUsd: row.retailPriceUsd,
    ages: row.ages,
    upc: row.upc,
    ean: row.ean,
    dimensions: row.dimensions,
    weightGrams: row.weightGrams,
    buildTime: row.buildTime,
    description: row.description,
    availability: row.availability,
    retiredDate: row.retiredDate,
    expectedRetirement: row.expectedRetirement,
    minifigs: parseLegoDetailsJson(row.minifigsJson, []),
    minifigsValueUsd: row.minifigsValueUsd,
    partsDistinct: row.partsDistinct,
    partsSpares: row.partsSpares,
    partOutValueUsd: row.partOutValueUsd,
    marketSealedUsd: row.marketSealedUsd,
    marketUsedUsd: row.marketUsedUsd,
    usedRange: row.usedRange,
    annualGrowthPct: row.annualGrowthPct,
    forecast1yrUsd: row.forecast1yrUsd,
    forecast5yrUsd: row.forecast5yrUsd,
    soldListings: parseLegoDetailsJson(row.soldListingsJson, []),
    retailers: parseLegoDetailsJson(row.retailersJson, []),
    sources: parseLegoDetailsJson(row.sourcesJson, []),
    researchedAt: row.researchedAt,
  };
}

/** The catalog row's packed facts line ("2015 · 1,685 pieces ·
    Ultimate Collector Series") unpacked for the detail page:
    the import writes year, piece count, and leaf theme into
    game_cards.rarity in that order, joined with " · ". */
function legoCatalogFacts(row: typeof schema.gameCards.$inferSelect): {
  subtheme: string | null;
  year: number | null;
  pieces: number | null;
} {
  let subtheme: string | null = null;
  let year: number | null = null;
  let pieces: number | null = null;
  for (const part of (row.rarity ?? "").split(" · ")) {
    const p = part.trim();
    if (/^\d{4}$/.test(p)) {
      year = parseInt(p, 10);
    } else if (/^[\d,]+ pieces$/.test(p)) {
      pieces = parseInt(p.replace(/[^\d]/g, ""), 10);
    } else if (p && p !== row.sectionName) {
      subtheme = p;
    }
  }
  return { subtheme, year, pieces };
}

/** The price audit's working body, shared by the auditPrices
    action (the nightly cron and the Settings Run-now button)
    and applyDataRepairs (this build's post-publish repair),
    so every path runs the identical scan / repair / log
    logic. See auditPrices for the audit's full description. */
async function runPriceAuditImpl(
  ctx: Ctx,
  source: string,
): Promise<{
  scanned: number;
  flagged: number;
  repaired: number;
  snapshotFixed: boolean;
  ranAt: string;
}> {
  const db = ctx.db<typeof schema>();
  const ranAt = new Date().toISOString();
  const rows = await db.select().from(schema.cards);
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const allHistory = await db.select().from(schema.cardPriceHistory);
  const byHistoryUid = new Map<string, typeof allHistory>();
  for (const h of allHistory) {
    const list = byHistoryUid.get(h.uid) ?? [];
    list.push(h);
    byHistoryUid.set(h.uid, list);
  }
  let scanned = 0;
  let flagged = 0;
  let repaired = 0;
  const repairedDates = new Set<string>();
  for (const [uid, points] of byHistoryUid) {
    const row = byUid.get(uid);
    if (!row) continue;
    scanned += 1;
    const sorted = [...points].sort((a, b) =>
      a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
    );
    if (sorted.length < 2) continue;
    const finishes = parseFinishes(row.finishes);
    let livePrices = parseFinance(row.financeJson);
    let cardRepaired = false;
    // Roll back stacked bad points: while the LATEST point
    // is a daily point making an implausible jump from the
    // point before it, that point is a mispricing, not a
    // market move. Only daily points are ever removed —
    // the export-seeded history is Anthony's real record
    // and is never rewritten.
    while (sorted.length >= 2) {
      const bad = sorted[sorted.length - 1];
      const good = sorted[sorted.length - 2];
      if (!bad || !good) break;
      if (bad.source !== "daily") break;
      if (!isImplausiblePriceJump(good.unitValue, bad.unitValue)) break;
      const scale =
        bad.unitValue > 0 ? good.unitValue / bad.unitValue : 0;
      const next: Record<string, FinishPrice> = { ...livePrices };
      for (const finish of Object.keys(finishes)) {
        const p = livePrices[finish];
        if (p) {
          next[finish] = {
            value: Math.round(p.value * scale * 100) / 100,
            paid: p.paid,
          };
        }
      }
      await db
        .update(schema.cards)
        .set({
          financeJson: JSON.stringify(next),
          marketValue: good.unitValue,
        })
        .where(eq(schema.cards.id, row.id));
      await db
        .delete(schema.cardPriceHistory)
        .where(eq(schema.cardPriceHistory.id, bad.id));
      await db.insert(schema.priceAuditLog).values({
        ranAt,
        kind: "repair",
        uid,
        fullName: row.fullName,
        printed: row.printed,
        oldValue: bad.unitValue,
        newValue: good.unitValue,
        source,
      });
      livePrices = next;
      repairedDates.add(bad.date);
      sorted.pop();
      cardRepaired = true;
    }
    if (cardRepaired) {
      flagged += 1;
      repaired += 1;
    }
  }
  // If a repaired bad point fed that day's portfolio
  // snapshot, recompute the newest repaired date's daily
  // snapshot from the repaired card totals (the same
  // totals saveRepricing writes). Older repaired dates
  // keep their snapshots: recomputing them with today's
  // totals would invent history.
  let snapshotFixed = false;
  if (repairedDates.size > 0) {
    const newestDate = [...repairedDates].sort().pop();
    if (newestDate) {
      const sealedTotals = (await effectiveSealed(ctx)).totals;
      const fresh = await db.select().from(schema.cards);
      let bValue = 0;
      let bPaid = 0;
      let bCards = 0;
      for (const r of fresh) {
        if (r.ownedQty <= 0) continue;
        const money = cardMoney(r);
        bValue += money.value;
        bPaid += money.paid;
        bCards += r.ownedQty;
      }
      const value =
        Math.round(
          (bValue + sealedTotals.value + nonBinderTotals.value) * 100,
        ) / 100;
      const paid =
        Math.round(
          (bPaid + sealedTotals.paid + nonBinderTotals.paid) * 100,
        ) / 100;
      const cardsCount = bCards + sealedTotals.qty + nonBinderTotals.qty;
      const snaps = await db
        .select()
        .from(schema.financeSnapshots)
        .where(eq(schema.financeSnapshots.date, newestDate));
      for (const s of snaps) {
        if (s.source !== "daily") continue;
        await db
          .update(schema.financeSnapshots)
          .set({ value, paid, cards: cardsCount })
          .where(eq(schema.financeSnapshots.id, s.id));
        snapshotFixed = true;
      }
    }
  }
  await db.insert(schema.priceAuditLog).values({
    ranAt,
    kind: "run",
    scanned,
    flagged,
    repaired,
    source,
  });
  ctx.invalidateQueries();
  return { scanned, flagged, repaired, snapshotFixed, ranAt };
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
              // The shared row builder (catalogRowOf) — it also
              // files a foil-only quest reprint's export copy
              // under its one real finish (Nov 9, 2026).
              newRows.push(catalogRowOf(entry, idx));
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
        // Great Hunny Rescue artwork refresh (Nov 10, 2026 —
        // Anthony: the Hunny cards' artwork "is bad" on every
        // card but the two Prize Pack Illustrations, and #1
        // showed the wrong face): one time only, every stored
        // artwork blob for a Quest 3 row is dropped so
        // cardImage re-fetches the official scan fresh from the
        // row's catalog URL — no stale or mismatched stored
        // copy survives. Ownership, finishes, and prices are
        // never touched. Guarded by the "sync:q3-art-v1"
        // finance-snapshot marker (source "sync", filtered out
        // of every chart, the sync:v2 precedent).
        const q3ArtMarker = await db
          .select({ id: schema.financeSnapshots.id })
          .from(schema.financeSnapshots)
          .where(eq(schema.financeSnapshots.label, "sync:q3-art-v1"))
          .limit(1);
        const q3ArtRefreshPending = q3ArtMarker.length === 0;
        for (const row of existing) {
          const own = ownership[row.uid];
          // Foil-only quest reprints (Nov 9, 2026): the export
          // filed Half Hexwell Crown's copy under "Regular", a
          // finish that printing does not exist in — so wherever
          // this loop derives per-finish prices from the export,
          // they are re-keyed to the printing's one real finish,
          // Cold Foil, with value and paid unchanged.
          const questFoilOnly = FOIL_ONLY_QUEST_REPRINT_UIDS.has(row.uid);
          const financeJson = questFoilOnly
            ? foldFinanceJsonToColdFoil(
                financeJsonOf(own),
                own?.finishes ?? {},
              )
            : financeJsonOf(own);
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
          // One-finish repair (Nov 9, 2026): a stored finishes
          // record for a foil-only quest reprint that still
          // carries a non-foil finish is folded into Cold Foil —
          // the quantity is untouched, only the finish it was
          // filed under stops being represented, because that
          // finish does not exist for the printing. Idempotent:
          // once folded, the record no longer matches. In
          // practice this reaches exactly one stored record —
          // Half Hexwell Crown's Regular copy — since the other
          // twelve reprints were exported under Cold Foil (or
          // are unowned).
          if (questFoilOnly) {
            const effective = parseFinishes(
              typeof set.finishes === "string" ? set.finishes : row.finishes,
            );
            if (
              Object.keys(effective).some(
                (f) => !isFoilFinish(f) && f !== "Iconic",
              )
            ) {
              set.finishes = JSON.stringify(
                foldFinishesToColdFoil(effective),
              );
            }
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
          // Quest group-name sync (Nov 10, 2026): a stored quest
          // row's group name follows the catalog's display name
          // for the quest (GROUP_NAME_OVERRIDES gives Quest 3
          // its full official product name). Display string
          // only — ownership, prices, and counts never move.
          if (row.grp === "quest") {
            const entry = catalogByUid.get(row.uid);
            if (entry) {
              const groupName = groupNameOf(entry);
              if (row.groupName !== groupName) set.groupName = groupName;
              // Artwork source sync (Nov 10, 2026): a quest
              // row's scan URL follows the bundled catalog, and
              // a changed URL drops the stored blob so the new
              // scan fetches fresh — the puzzle sync's rule,
              // extended to quests by the Great Hunny Rescue
              // artwork report.
              const img = entry.image ?? null;
              if (row.imageUrl !== img) {
                set.imageUrl = img;
                set.imageBlobKey = null;
              }
            }
          }
          // One-time Quest 3 artwork refresh (see the marker
          // note above): drop the stored blob so the official
          // scan re-fetches on next view, whatever URL the row
          // already carried.
          if (
            q3ArtRefreshPending &&
            row.setCode === "Q3" &&
            row.imageBlobKey != null
          ) {
            set.imageBlobKey = null;
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
        if (q3ArtRefreshPending) {
          await db.insert(schema.financeSnapshots).values({
            date: "2026-11-10",
            label: "sync:q3-art-v1",
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
          // The shared row builder (catalogRowOf) — it also
          // files a foil-only quest reprint's export copy under
          // its one real finish (Nov 9, 2026).
          rows.push(catalogRowOf(entry, idx));
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
      // Guest access (platform v27): agent tasks are
      // owner-only and unavailable in the shared runtime;
      // the daily schedule runs this locally as the owner.
      if (agentCapabilityBlocked(ctx)) {
        return { started: false, taskId: null };
      }
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

  refreshSectionArt: defineAction({
    description:
      "Starts the daily Topps Alternate Universe section-art task: spawns an agent task that finds official publisher product artwork for every AU catalog section (Disney Topps, Star Wars Topps, Garbage Pail Kids, WWE Topps) whose set tile still shows the placeholder — and replaces AU art rows whose stored source the app can no longer fetch — saving each verified image via importSectionArt and confirming it ingests via getSectionArt. Sections with no official product image anywhere stay on the clean placeholder; no URL is ever guessed.",
    request: z.object({ force: z.boolean().optional() }),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ started: boolean; taskId: string | null }> {
      // Guest access (platform v27): agent tasks are
      // owner-only and unavailable in the shared runtime;
      // the daily schedule runs this locally as the owner.
      if (agentCapabilityBlocked(ctx)) {
        return { started: false, taskId: null };
      }
      const today = new Date().toISOString().slice(0, 10);
      const result = await ctx.agent.spawnTask(
        [
          "Source official product artwork for the Topps Alternate Universe set tiles in the lorcana-binder web artifact (Anthony, Nov 6, 2026: every set that has real publisher artwork should show it; sets with none anywhere keep the clean placeholder).",
          "1. For each of the four AU games — disney-topps, starwars-topps, gpk, wwe-topps — call the artifact's getGameCatalog action: its sections list carries hasArt per section. Sections with hasArt=false need art. ALSO re-check these sections whose stored artwork source is known-dead (ripped.topps.com blocks the app's server fetch — verified Nov 6, 2026, getSectionArt returns ok:false for them): disney-topps 2025-topps-disneyland-70th-anniversary, disney-topps 2026-topps-disney-neon, wwe-topps 2025-topps-exalted-wwe, wwe-topps 2025-topps-universe-wwe, wwe-topps 2026-topps-chrome-wwe. A working replacement for any of them counts as a save for that section.",
          "2. FIRST, record this already-verified pair exactly as given (2026 Topps Mint Disney — the NYCC EQL launch page's hero image, confirmed to depict that product's box): call importSectionArt with one item { game: \"disney-topps\", sectionKey: \"2026-topps-mint-disney\", imageUrl: \"https://cdn.eql.media/draw-api/0e47a410-4663-4d89-8066-815408914963/c620072e-9c42-4cd3-a02c-8cdc0bfd4ed7.png?auto=format%2Ccompress&ar=1%3A0.8041958041958043&fit=crop&ixlib=react-9.11.0&w=580\", pageUrl: \"https://nycc-topps.runfair.com/en-US/us/2026-topps-mint-disney-nycc-box-fri\" }, then confirm with getSectionArt (game disney-topps, sectionKey 2026-topps-mint-disney) that it returns ok:true.",
          "3. For every other section needing art: find the product's official launch/product page — Topps sells these through EQL launches (launches.topps.com and its runfair domains), whose pages carry the product's box photo on cdn.eql.media — open the page, and take the hero product image URL from the page you actually loaded. The image must depict THAT product's box or packaging. Save it with importSectionArt ({ game, sectionKey, imageUrl, pageUrl }) and then call getSectionArt for that section: only an ok:true result counts as filled. If getSectionArt cannot fetch the image, try the product's other official image (a different launch format's page for the same product); if none fetches, leave the section on its placeholder and move on.",
          "Never guess, construct, or shorten an image URL, never use a marketplace listing photo, a fan wiki image, or another product's box, and never touch card rows, prices, or ownership. Sports Cards catalogs (topps, bowman, topps-basketball) are out of scope: their set rows are text-only by design and Topps publishes those checklists as text with no per-card images. When every section is covered, finish — a run that finds nothing to do is a success.",
        ].join("\n"),
        {
          expectsAction: "importSectionArt",
          dedupeKey: args.force
            ? `lorcana-au-section-art-${today}-force-${Date.now()}`
            : `lorcana-au-section-art-${today}`,
        },
      );
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
      };
    },
  }),

  refreshCardArt: defineAction({
    description:
      "Starts the Topps card-art hunt: spawns an agent task that finds front photos of the exact card for Topps-family catalog cards still missing artwork. Unfocused (the daily run): Disney Topps first (Chrome Disney first inside it), then Star Wars Topps, Garbage Pail Kids, WWE Topps, and the Topps/Bowman sports catalogs. Focused on one set (game + sectionKey — Anthony, Nov 7, 2026: the 2025 Topps Chrome Disney fronts had only partly loaded, so a set's own page can send the hunt after that ONE set): the task works that single section in collector-number order until every card in it either carries a verified front or no permitted source carries one. Focused on one whole collection (game only — Anthony, Nov 7, 2026, expanded the same day: ALL Disney Topps cards in every Disney Topps set, and ALL Garbage Pail Kids cards in every GPK set, loaded wherever a lawful source exists): the task works that one game section by section in catalog order, completing each set before moving to the next. Pull source is COMC (the collector marketplace that photographs every card front; other marketplaces with standardized front photos when COMC lacks a card); the Trading Card Database is reference-only (it confirms a card's front exists — its terms bar image extraction, so its images are never taken); Collectr, the platform Anthony named, joins only via its API once his own approved key exists — it is not used until then. Each verified image is saved via importCardArt and confirmed via getGameImageProxy. Cards no permitted source carries keep the clean placeholder; no URL is ever guessed and a parallel row only ever takes that parallel's own front.",
    request: z.object({
      force: z.boolean().optional(),
      game: z
        .enum([
          "topps",
          "bowman",
          "topps-basketball",
          "disney-topps",
          "starwars-topps",
          "gpk",
          "wwe-topps",
        ])
        .optional(),
      sectionKey: z.string().min(1).max(80).optional(),
    }),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ started: boolean; taskId: string | null }> {
      // Guest access (platform v27): agent tasks are
      // owner-only and unavailable in the shared runtime;
      // the daily schedule runs this locally as the owner.
      if (agentCapabilityBlocked(ctx)) {
        return { started: false, taskId: null };
      }
      const today = new Date().toISOString().slice(0, 10);
      const sectionFocus = Boolean(args.game && args.sectionKey);
      const gameFocus = Boolean(args.game && !args.sectionKey);
      const gameLines =
        gameFocus && args.game
          ? [
              `FOCUSED RUN — ONE WHOLE COLLECTION (Anthony, Nov 7, 2026: after the 2025 Topps Chrome Disney report he expanded the ask to ALL of Disney Topps — every card in every Disney Topps set — and ALL of Garbage Pail Kids the same way). This run ignores every other game: its whole job is game "${args.game}", every section of it, completed set by set.`,
              "1. TARGETS. Call getGameCatalog (game) for the collection's sections, in the catalog order it returns. Work ONE section at a time and finish it before moving to the next: inside a section call getGameSection (game, sectionKey, offset) at offsets 0, 150, 300, … until every row has been seen; a card is a target only when its imageUrl is null. Inside a section do cards with ownedQty > 0 first, then the rest in collector-number order. KEEP GOING set after set until the whole collection is finished — do not stop after a first batch the way earlier general runs did; this run exists to complete this collection. If the run's budget ends mid-collection that is acceptable (targets are computed live from imageUrl, so the next focused or daily run resumes exactly where coverage stops), but completing the collection is the goal, not a sample of it.",
              "2. SOURCES. (a) PULL SOURCE — COMC (comc.com), the collector marketplace that photographs the front of every card it lists: the Disney Topps fronts already loaded came from img.comc.com image URLs taken off COMC pages actually loaded, and COMC's browse for a set walks its subsets (the [Base] listing in collector-number order, then each parallel/insert subset under its own listing). Take the front image URL from the COMC page you actually loaded and record that page as pageUrl with source 'COMC'. Another marketplace with standardized front photos of the actual card (e.g. Beckett Marketplace, Sportlots) is an acceptable pull source when COMC lacks the card. (b) REFERENCE ONLY — the Trading Card Database (tcdb.com): its set pages confirm which cards carry front scans and cross-check set/number/name, but its terms forbid robots, screen scraping, and bulk extraction — NEVER take, reuse, or hotlink its image files. (c) PENDING — Collectr (getcollectr.com): API-only, needs Anthony's own approved key, NOT yet granted — do not use Collectr at all; never ask anyone for the key and never accept one pasted anywhere.",
              "3. MATCH RULES — the image must depict THAT EXACT card: same set, same collector number, same name. The catalog row's finish label names its parallel/subset: a parallel row takes ONLY a front photo of that parallel — never dress a parallel row in the base card's photo; when only the base front exists, fill the base row and skip the parallel. Autograph, sketch, and serial-numbered chase rows likewise take only their own card's image. If you cannot confirm the match from the page, skip the card.",
              "4. SAVE + VERIFY. Save each confirmed image with importCardArt ({ game, id, imageUrl, pageUrl, source }) — id is the card's id from getGameSection. Then call getGameImageProxy ({ id }): only an ok:true result counts as filled (it proves the app's server can fetch and cache the image). If ok:false, try the same card's other image from the same source page (a larger or alternate-size URL the page itself offers) via a second importCardArt and re-verify; if none verifies, move on — the tile keeps its clean placeholder and a later run can retry.",
              "Never guess, construct, shorten, or pattern-build an image URL; never use a fan wiki image, a social-media photo, a graded-slab photo (the card inside a holder), or another card's front; never touch prices, ownership, or any other game. In your summary report PER SET: how many fronts the set now has of its total, and which cards (if any) no permitted source carried — the app shows the same counts live in Settings > Artwork coverage.",
            ]
          : null;
      const focusLines = sectionFocus
        ? [
            `FOCUSED RUN — ONE SET ONLY (Anthony, Nov 7, 2026: he opened the 2025 Topps Chrome Disney set in Disney Topps, saw the first base fronts loaded and the rest still placeholders, and asked for the rest of THAT set loaded in). This run ignores every other game and section: its whole job is the section "${args.sectionKey}" of game "${args.game}".`,
            "1. TARGETS. Call getGameSection (game, sectionKey, offset) at offsets 0, 150, 300, … until you have seen every row in the section. A card is a target only when its imageUrl is null. Work targets in collector-number order, starting from the first card still missing its front, and KEEP GOING until the section is finished — do not stop after a first batch the way earlier general runs did; this run exists to complete this one set. If the run's budget ends mid-section that is acceptable (targets are computed live from imageUrl, so the next focused or daily run resumes exactly where coverage stops), but finishing the section is the goal, not a sample of it.",
            "2. SOURCES. (a) PULL SOURCE — COMC (comc.com), the collector marketplace that photographs the front of every card it lists: this set's base fronts already loaded came from img.comc.com image URLs taken off COMC pages actually loaded, and COMC's browse for a set walks its subsets (the [Base] listing in collector-number order, then each parallel/insert subset under its own listing). Take the front image URL from the COMC page you actually loaded and record that page as pageUrl with source 'COMC'. Another marketplace with standardized front photos of the actual card (e.g. Beckett Marketplace, Sportlots) is an acceptable pull source when COMC lacks the card. (b) REFERENCE ONLY — the Trading Card Database (tcdb.com): its set pages confirm which cards carry front scans and cross-check set/number/name, but its terms forbid robots, screen scraping, and bulk extraction — NEVER take, reuse, or hotlink its image files. (c) PENDING — Collectr (getcollectr.com): API-only, needs Anthony's own approved key, NOT yet granted — do not use Collectr at all; never ask anyone for the key and never accept one pasted anywhere.",
            "3. MATCH RULES — the image must depict THAT EXACT card: same set, same collector number, same name. The catalog row's finish label names its parallel/subset: a parallel row takes ONLY a front photo of that parallel — never dress a parallel row in the base card's photo; when only the base front exists, fill the base row and skip the parallel. Autograph, sketch, and serial-numbered chase rows likewise take only their own card's image. If you cannot confirm the match from the page, skip the card.",
            "4. SAVE + VERIFY. Save each confirmed image with importCardArt ({ game, id, imageUrl, pageUrl, source }) — id is the card's id from getGameSection. Then call getGameImageProxy ({ id }): only an ok:true result counts as filled (it proves the app's server can fetch and cache the image). If ok:false, try the same card's other image from the same source page (a larger or alternate-size URL the page itself offers) via a second importCardArt and re-verify; if none verifies, move on — the tile keeps its clean placeholder and a later run can retry.",
            "Never guess, construct, shorten, or pattern-build an image URL; never use a fan wiki image, a social-media photo, a graded-slab photo (the card inside a holder), or another card's front; never touch prices, ownership, or any other section or game. In your summary say how many fronts this run filled in the section, how many the section now has of its total, and which cards (if any) no permitted source carried.",
          ]
        : null;
      const result = await ctx.agent.spawnTask(
        (focusLines ?? gameLines ?? [
          "Hunt per-card front artwork for the Topps-family catalogs in the lorcana-binder web artifact (Anthony, Nov 6, 2026: Topps' official checklists are text-only — no images exist at the publisher — so he directed this hunt to OTHER sites, collector sources in particular: 'Can we get the artwork anywhere else? … look for other areas, other ways to find the artwork from other sites. Maybe look at collector.').",
          "1. TARGETS. Work the seven Topps-family games in this priority order: disney-topps, starwars-topps, gpk, wwe-topps, topps, bowman, topps-basketball. For each game call the artifact's getGameCatalog action for its sections, then getGameSection (game, sectionKey, offset — 150 cards per page) for their cards. A card is a target only when its imageUrl is null. Inside disney-topps, start with the Chrome Disney section (its section name contains 'Chrome Disney'), then the other Disney sections in catalog order. Inside any section, do cards with ownedQty > 0 first, then the rest in collector-number order. Targets are computed live from imageUrl, so stopping mid-section is fine — the next daily run resumes exactly where coverage stops.",
          "2. SOURCES. (a) PULL SOURCE — COMC (comc.com), the collector marketplace that photographs the front of every card it lists, including 2025 Topps Chrome Disney base cards: take the front image URL from the card's COMC page you actually loaded, and record that page as pageUrl with source 'COMC'. Another marketplace with standardized front photos of the actual card (e.g. Beckett Marketplace, Sportlots) is an acceptable pull source when COMC lacks the card. (b) REFERENCE ONLY — the Trading Card Database (tcdb.com): its set pages show which cards carry front scans (near-complete for Chrome Disney) and are the cross-check for set/number/name, but its terms forbid robots, screen scraping, and bulk extraction — NEVER take, reuse, or hotlink its image files; it only tells you a front exists and what the exact card is. (c) PENDING — Collectr (getcollectr.com), the platform Anthony named: it joins this hunt only through its API, which needs Anthony's own approved Collectr Application Key — NOT yet granted. Do not use Collectr at all until the app has that API access; never ask anyone for the key and never accept one pasted anywhere.",
          "3. MATCH RULES — the image must depict THAT EXACT card: same set, same collector number, same name. The catalog row's finish label names its parallel/subset (e.g. 'Base · Refractor', a team + subset for sports rows): a parallel row takes ONLY a front photo of that parallel — never dress a parallel row in the base card's photo; when only the base front exists, fill the base row and skip the parallel. Autograph, sketch, and serial-numbered chase rows likewise take only their own card's image. If you cannot confirm the match from the page, skip the card.",
          "4. SAVE + VERIFY. Save each confirmed image with importCardArt ({ game, id, imageUrl, pageUrl, source }) — id is the card's id from getGameSection. Then call getGameImageProxy ({ id }): only an ok:true result counts as filled (it proves the app's server can fetch and cache the image). If ok:false, try the same card's other image from the same source page (a larger or alternate-size URL the page itself offers) via a second importCardArt and re-verify; if none verifies, move on — the tile keeps its clean placeholder and a later run can retry.",
          "Never guess, construct, shorten, or pattern-build an image URL; never use a fan wiki image, a social-media photo, a graded-slab photo (the card inside a holder), or another card's front; never touch prices, ownership, or non-Topps games. Work as far down the priority order as the run allows; a run that fills part of the list is a success — say in your summary how many cards you filled, per game, and which sources carried them.",
        ]).join("\n"),
        {
          expectsAction: "importCardArt",
          dedupeKey: sectionFocus
            ? args.force
              ? `lorcana-topps-card-art-focus-${args.game}-${args.sectionKey}-${today}-force-${Date.now()}`
              : `lorcana-topps-card-art-focus-${args.game}-${args.sectionKey}-${today}`
            : gameFocus
              ? args.force
                ? `lorcana-topps-card-art-game-${args.game}-${today}-force-${Date.now()}`
                : `lorcana-topps-card-art-game-${args.game}-${today}`
              : args.force
                ? `lorcana-topps-card-art-${today}-force-${Date.now()}`
                : `lorcana-topps-card-art-${today}`,
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
        // Total copies across both tallies (pocket + scene).
        ownedQty += tallyTotal(row);
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
          // A scene-only copy fills the pocket (Anthony,
          // Nov 9, 2026): owned when either tally has one.
          if (pocket.qty + pocket.sceneQty > 0) {
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
          kind: z.enum(["cash", "trade", "ticket", "mail"]),
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
        kind: "cash" | "trade" | "ticket" | "mail";
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
      // Plain mail (Anthony, Nov 4, 2026 — shared deck
      // lists): messages addressed to me, newest activity is
      // the send itself; unread until opened once.
      const mailRows = await db
        .select()
        .from(schema.mailMessages)
        .where(eq(schema.mailMessages.toCode, me));
      for (const m of mailRows) {
        items.push({
          key: `mail:${m.id}`,
          kind: "mail",
          refId: m.id,
          subject: m.subject,
          fromUsername: m.fromUsername,
          date: m.createdAt,
          preview: m.body.split("\n").slice(0, 3).join(" · ").slice(0, 140),
          status: "shared",
          unreadCount: m.readAt ? 0 : 1,
          unread: !m.readAt,
        });
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
      kind: z.enum(["cash", "trade", "ticket", "mail"]),
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
      } else if (args.kind === "mail") {
        const [row] = await db
          .select()
          .from(schema.mailMessages)
          .where(eq(schema.mailMessages.id, args.refId));
        if (!row || (row.toCode !== me && row.fromCode !== me)) {
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
      await markBackupDirty(ctx);
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
      // Joined-scene display cards (Nov 9, 2026): for every
      // verified connecting-art group with at least one pocket
      // in this (filtered) list, anchor the scene to the last
      // such pocket in list order — the latest member's final
      // pocket in this section. A group whose members are all
      // filtered out shows no display card in that view.
      const scenes: z.infer<typeof sectionResponse>["scenes"] = [];
      const seenGroups = new Set<string>();
      for (const row of rows) {
        const info = ART_GROUP_BY_UID.get(row.uid);
        if (!info) continue;
        const groupKey = info.members.join("|");
        if (seenGroups.has(groupKey)) continue;
        seenGroups.add(groupKey);
        const data = await computeArtGroup(ctx, info.members, null);
        if (!data) continue;
        const memberIds = new Set(data.members.map((m) => m.id));
        let anchor: CardLite | undefined;
        for (const pk of pockets) {
          if (memberIds.has(pk.id)) anchor = pk;
        }
        if (!anchor) continue;
        const sectionIds = new Set(rows.map((r) => r.id));
        scenes.push({
          anchorCardId: anchor.id,
          anchorPocket: anchor.pocket,
          size: data.size,
          members: data.members.map((m) => ({
            ...m,
            inThisSection: sectionIds.has(m.id),
          })),
          finishStatus: data.finishStatus,
        });
      }
      return {
        cards: pockets,
        total: pockets.length,
        scenes,
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
      // Foil-only quest reprints (Nov 9, 2026): the detail reads
      // the same folded record the seed repair writes — a copy
      // filed under a finish that does not exist for this
      // printing is presented under its one real finish,
      // Cold Foil, with its quantity, value and paid intact.
      const questFoilOnly = FOIL_ONLY_QUEST_REPRINT_UIDS.has(row.uid);
      const finishes = questFoilOnly
        ? foldFinishesToColdFoil(parseFinishes(row.finishes))
        : parseFinishes(row.finishes);
      // Connecting-art group (Nov 9, 2026): this printing's
      // verified joined scene, resolved and scored per finish
      // family by the shared helper.
      const artGroupInfo = ART_GROUP_BY_UID.get(row.uid);
      const artGroup = artGroupInfo
        ? await computeArtGroup(ctx, artGroupInfo.members, row.uid)
        : null;
      const prices = questFoilOnly
        ? foldFinanceToColdFoil(parseFinance(row.financeJson), finishes)
        : parseFinance(row.financeJson);
      const money = cardMoney(row);
      // Per-finish money rows tally BOTH counts (Anthony, Nov 9,
      // 2026): qty and valueTotal cover pocket + scene copies so
      // the rows sum to the cardMoney totals above; paidTotal
      // stays on pocket copies only, since scene copies carry
      // no recorded purchase price.
      const sceneFin = sceneFinishesOf(row);
      const byFinish = [
        ...new Set([
          ...Object.keys(finishes),
          ...Object.keys(sceneFin),
        ]),
      ].map((finish) => {
        const pocketQty = finishes[finish] ?? 0;
        const qty = pocketQty + (sceneFin[finish] ?? 0);
        const price = prices[finish];
        const unitValue = price?.value ?? row.marketValue ?? null;
        const unitPaid = price?.paid ?? row.paidValue ?? null;
        return {
          finish,
          qty,
          valuePerUnit: unitValue,
          paidPerUnit: unitPaid,
          valueTotal: Math.round((unitValue ?? 0) * qty * 100) / 100,
          paidTotal: Math.round((unitPaid ?? 0) * pocketQty * 100) / 100,
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
        foilOnlyFinish: singleFinishOf(row),
        sceneFinishes: sceneFinishesOf(row),
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
        bundledArt: bundledArtForRow(row),
        encounterFront: encounterFrontForRow(row),
        artGroup,
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
          if (pocket.qty + pocket.sceneQty > 0) ownedPockets += 1;
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
      "Hands one binder section's missing-cards buy list to the signed-in collector's own Muse (restored Nov 4, 2026 at Anthony's explicit direction after he reviewed exactly what it sends): recomputes the section's missing pockets server-side and spawns an agent task carrying ONLY the missing printings' public TCGplayer product IDs and quantities, instructing the Muse to build the cart on TCGplayer under the user's own sign-in (Near Mint, his standing shipping rules) and NEVER to check out — final payment approval stays with the user. Fires only behind the client's per-run confirmed:true gate; missing pockets without a TCGplayer product ID are counted and disclosed, never sent.",
    request: z.object({
      groupKey: z.string().min(1),
      confirmed: z.literal(true),
    }),
    response: buyListHandoffResponse,
    async handler(ctx, args): Promise<BuyListHandoffResult> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.groupKey, args.groupKey))
        .orderBy(asc(schema.cards.slotSort));
      if (rows.length === 0) {
        return {
          ok: false,
          error: "That section couldn't be found, so nothing was sent.",
          products: 0,
          copies: 0,
          skippedNoId: 0,
          taskId: null,
        };
      }
      const missing = missingPocketsOf(rows);
      return spawnBuyListHandoff(
        ctx,
        missing.map((m) => ({ tcgplayerId: m.tcgplayerId, qty: 1 })),
        "set",
      );
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
          foilOnlyFinish: z.string().nullable(),
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
              foilOnlyFinish: z.string().nullable(),
              readName: z.string(),
              readNumber: z.number().nullable(),
            }),
          ),
        }),
      ),
      unmatched: z.array(z.string()),
    }),
    async handler(ctx, args) {
      // Guest access (platform v27): the vision read is an
      // inference call — unavailable in the shared runtime
      // for every viewer. Return the plain no-read result;
      // the scanner lands on its on-device fingerprint match
      // and search fallback, exactly as it does when a read
      // times out.
      if (agentCapabilityBlocked(ctx)) {
        return {
          binderPage: false,
          matches: [],
          ambiguous: [],
          unmatched: [],
        };
      }
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
          foilOnlyFinish: singleFinishOf(row),
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
          foilOnlyFinish: z.string().nullable(),
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
            foilOnlyFinish: singleFinishOf(row),
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
          gameCardId: z.number().nullable(),
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
          /** The game item's catalog photo for the management
              page thumbnail (game-kind alerts only; null for
              every other kind). */
          imageUrl: z.string().nullable(),
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
      const gameAlertIds = alertRows
        .filter((a) => a.targetKind === "game" && a.gameCardId != null)
        .map((a) => a.gameCardId as number);
      const gameAlertRows =
        gameAlertIds.length > 0
          ? await db
              .select()
              .from(schema.gameCards)
              .where(inArray(schema.gameCards.id, gameAlertIds))
          : [];
      const gameAlertById = new Map(gameAlertRows.map((r) => [r.id, r]));
      const GAME_ALERT_LABELS: Record<string, string> = {
        pokemon: "Pokémon",
        magic: "Magic: The Gathering",
        starwars: "Star Wars Unlimited",
        funko: "Funko Pop!",
        lego: "Legos",
      };
      return {
        exampleDismissed: profile.exampleAlertDismissed > 0,
        alerts: alertRows.map((a) => {
          let currentValue: number | null = null;
          let displayName = a.label;
          let subtitle = "";
          let imageUrl: string | null = null;
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
          } else if (a.targetKind === "game" && a.gameCardId != null) {
            const g = gameAlertById.get(a.gameCardId);
            if (g) {
              currentValue = g.price;
              displayName = g.name;
              subtitle = `${GAME_ALERT_LABELS[g.game] ?? g.game} · ${g.sectionName}`;
              imageUrl = g.imageUrl;
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
            gameCardId: a.gameCardId ?? null,
            label: a.label,
            displayName,
            subtitle,
            direction: a.direction,
            threshold: a.threshold,
            currentValue,
            triggered,
            imageUrl,
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
      "Sets a price alert on one card, sealed item, graded comic, or game-catalog item from its detail view: Home shows the alert in translucent red when the item's unit value crosses the threshold. Game-catalog items can only be alerted when their catalog row carries a tracked price — the server refuses untracked items with a plain explanation instead of storing a dead alert.",
    request: z.object({
      targetKind: z.enum(["card", "sealed", "comic", "game"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      comicId: z.string().min(1).nullable().optional(),
      gameCardId: z.number().int().positive().nullable().optional(),
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
      } else if (args.targetKind === "game") {
        if (args.gameCardId == null) throw new Error("gameCardId is required");
        const rows = await db
          .select()
          .from(schema.gameCards)
          .where(eq(schema.gameCards.id, args.gameCardId))
          .limit(1);
        const row = rows[0];
        if (!row) throw new Error("Catalog item not found");
        if (row.price == null) {
          throw new Error(
            "Pricing isn't tracked for this item yet, so it can't be alerted. You can still add it to your Watchlist.",
          );
        }
        label = `${row.name} (${row.sectionName})`;
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
          gameCardId: args.targetKind === "game" ? (args.gameCardId ?? null) : null,
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

  getWatchlist: defineAction({
    description:
      "Lists the user's Portfolio watchlist — any cataloged item they are watching (Lorcana cards, sealed products, game-catalog items from Pokémon/Magic/Star Wars/Funko/Lego, graded comics), owned or not — each with its canonical current price where a price is tracked (the same value the alerts and detail pages use), its day change from the tracked price history, a short trend series for the quote-row sparkline, and how many copies they own. Items with no tracked price source carry a null price and the client says so plainly.",
    request: z.object({}),
    response: z.object({
      items: z.array(
        z.object({
          id: z.number(),
          targetKind: z.string(),
          cardId: z.number().nullable(),
          sealedName: z.string().nullable(),
          gameCardId: z.number().nullable(),
          comicId: z.string().nullable(),
          imageUrl: z.string().nullable(),
          displayName: z.string(),
          subtitle: z.string(),
          price: z.number().nullable(),
          dayChangePct: z.number().nullable(),
          trend: z.array(z.number()),
          ownedQty: z.number(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.watchlistItems)
        .orderBy(asc(schema.watchlistItems.id));
      const cardRows = await db.select().from(schema.cards);
      const cardById = new Map(cardRows.map((r) => [r.id, r]));
      const sealed = await effectiveSealed(ctx);
      const sealedByName = new Map(sealed.items.map((i) => [i.name, i]));
      const gameIds = rows
        .filter((w) => w.targetKind === "game" && w.gameCardId != null)
        .map((w) => w.gameCardId as number);
      const gameRows =
        gameIds.length > 0
          ? await db
              .select()
              .from(schema.gameCards)
              .where(inArray(schema.gameCards.id, gameIds))
          : [];
      const gameById = new Map(gameRows.map((r) => [r.id, r]));
      const GAME_LABELS: Record<string, string> = {
        pokemon: "Pokémon",
        magic: "Magic: The Gathering",
        starwars: "Star Wars Unlimited",
        funko: "Funko Pop!",
        lego: "Legos",
      };
      const items = [];
      for (const w of rows) {
        if (w.targetKind === "card" && w.cardId != null) {
          const card = cardById.get(w.cardId);
          if (!card) continue;
          const histRows = await db
            .select()
            .from(schema.cardPriceHistory)
            .where(eq(schema.cardPriceHistory.uid, card.uid))
            .orderBy(asc(schema.cardPriceHistory.id));
          const dated =
            histRows.length > 0
              ? histRows.map((h) => ({ date: h.date, value: h.unitValue }))
              : (cardHistory[card.uid] ?? []).map((pt) => ({
                  date: pt.date,
                  value: pt.value,
                }));
          const points = dated.map((p) => p.value);
          // Day change = the latest point vs the most recent
          // point from an EARLIER date (the history can hold
          // two same-day points — first export / latest — and
          // comparing those would fake a 0% day).
          const lastPt = dated[dated.length - 1];
          const prevPt = lastPt
            ? [...dated]
                .reverse()
                .find((p) => p.date < lastPt.date)
            : undefined;
          items.push({
            id: w.id,
            targetKind: "card",
            cardId: card.id,
            sealedName: null,
            gameCardId: null,
            comicId: null,
            imageUrl: null,
            displayName: card.fullName,
            subtitle: `${card.groupName} #${card.printed}`,
            price: card.marketValue,
            dayChangePct:
              lastPt != null && prevPt != null && prevPt.value > 0
                ? Math.round(
                    ((lastPt.value - prevPt.value) / prevPt.value) * 1000,
                  ) / 10
                : null,
            trend: points.slice(-14),
            ownedQty: card.ownedQty,
          });
        } else if (w.targetKind === "sealed" && w.sealedName) {
          const item = sealedByName.get(w.sealedName);
          const histRows = await db
            .select()
            .from(schema.sealedPriceHistory)
            .where(eq(schema.sealedPriceHistory.name, w.sealedName))
            .orderBy(asc(schema.sealedPriceHistory.id));
          const points = histRows.map((h) => h.unitValue);
          const lastRow = histRows[histRows.length - 1];
          const prevRow = lastRow
            ? [...histRows].reverse().find((h) => h.date < lastRow.date)
            : undefined;
          items.push({
            id: w.id,
            targetKind: "sealed",
            cardId: null,
            sealedName: w.sealedName,
            gameCardId: null,
            comicId: null,
            imageUrl: null,
            displayName: w.sealedName,
            subtitle: item ? `${item.setName} · Sealed` : "Sealed",
            price: item?.unitValue ?? null,
            dayChangePct:
              lastRow != null && prevRow != null && prevRow.unitValue > 0
                ? Math.round(
                    ((lastRow.unitValue - prevRow.unitValue) /
                      prevRow.unitValue) *
                      1000,
                  ) / 10
                : null,
            trend: points.slice(-14),
            ownedQty: item?.qty ?? 0,
          });
        } else if (w.targetKind === "game" && w.gameCardId != null) {
          // Any other catalog (migration 0058): Pokémon /
          // Magic rows carry a tracked price where their
          // source publishes one; Star Wars, Funko, and Lego
          // rows carry none today, so price stays null and
          // the client says plainly that pricing isn't
          // tracked for the item yet. No day-change history
          // exists for game rows, so the trend stays empty
          // rather than inventing one.
          const g = gameById.get(w.gameCardId);
          if (!g) continue;
          items.push({
            id: w.id,
            targetKind: "game",
            cardId: null,
            sealedName: null,
            gameCardId: g.id,
            comicId: null,
            imageUrl: g.imageUrl,
            displayName: g.name,
            subtitle: `${GAME_LABELS[g.game] ?? g.game} · ${g.sectionName}`,
            price: g.price,
            dayChangePct: null,
            trend: [],
            ownedQty: g.ownedQty + g.ownedSealedQty,
          });
        } else if (w.targetKind === "comic" && w.comicId) {
          const comic = COMIC_ALERT_CATALOG.find((c) => c.id === w.comicId);
          if (!comic) continue;
          items.push({
            id: w.id,
            targetKind: "comic",
            cardId: null,
            sealedName: null,
            gameCardId: null,
            comicId: comic.id,
            imageUrl: null,
            displayName: comic.title,
            subtitle: `${comic.publisher} · Graded comic`,
            price: comic.value,
            dayChangePct: null,
            trend: [],
            ownedQty: 1,
          });
        }
      }
      return { items };
    },
  }),

  addToWatchlist: defineAction({
    description:
      "Adds one cataloged item to the user's Portfolio watchlist (from the Watch action on its detail view): a Lorcana card, a sealed product, a game-catalog item (Pokémon/Magic/Star Wars/Funko/Lego), or a graded comic. Watching never requires a tracked price — items without one are watched with pricing untracked. Adding the same item twice keeps a single entry.",
    request: z.object({
      targetKind: z.enum(["card", "sealed", "game", "comic"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      gameCardId: z.number().int().positive().nullable().optional(),
      comicId: z.string().min(1).nullable().optional(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.watchlistItems);
      const dupe = existing.some((w) => {
        switch (args.targetKind) {
          case "card":
            return w.targetKind === "card" && w.cardId === args.cardId;
          case "sealed":
            return w.targetKind === "sealed" && w.sealedName === args.sealedName;
          case "game":
            return w.targetKind === "game" && w.gameCardId === args.gameCardId;
          case "comic":
            return w.targetKind === "comic" && w.comicId === args.comicId;
        }
      });
      if (!dupe) {
        await db.insert(schema.watchlistItems).values({
          targetKind: args.targetKind,
          cardId: args.targetKind === "card" ? args.cardId : null,
          sealedName: args.targetKind === "sealed" ? args.sealedName : null,
          gameCardId: args.targetKind === "game" ? (args.gameCardId ?? null) : null,
          comicId: args.targetKind === "comic" ? (args.comicId ?? null) : null,
          createdAt: new Date().toISOString(),
        });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  removeFromWatchlist: defineAction({
    description: "Removes one entry from the user's Portfolio watchlist by its watchlist id.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.watchlistItems)
        .where(eq(schema.watchlistItems.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getLibraryComicDisplay: defineAction({
    description:
      "The comic ids on display on the comics shelf of SLABS in the Library (max 5). When the user has never chosen, ids is null and the client shows Anthony's standing default: his two signed comics (Aliens #1 and Batman #136).",
    request: z.object({}),
    response: z.object({ ids: z.array(z.string()).nullable() }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      if (!profile.libraryComicDisplay) return { ids: null };
      try {
        const parsed = JSON.parse(profile.libraryComicDisplay) as unknown;
        return {
          ids: Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string").slice(0, 5)
            : null,
        };
      } catch {
        return { ids: null };
      }
    },
  }),

  setLibraryComicDisplay: defineAction({
    description:
      "Sets which of the user's graded comics are on display on the comics shelf of SLABS in their Library — up to five comic ids from their own comics; an empty list is a valid, empty shelf.",
    request: z.object({
      ids: z.array(z.string().min(1).max(60)).max(5),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const valid = new Set(COMIC_ALERT_CATALOG.map((c) => c.id));
      const ids = [...new Set(args.ids)].filter((id) => valid.has(id));
      await db
        .update(schema.collectorProfile)
        .set({
          libraryComicDisplay: JSON.stringify(ids),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getLibrarySlabCardDisplay: defineAction({
    description:
      "The graded slab ids on display on the small upper shelf of SLABS in the Library (max 4). When the user has never chosen, ids is null and the client shows the four most recently saved graded slabs.",
    request: z.object({}),
    response: z.object({ ids: z.array(z.number()).nullable() }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      if (!profile.librarySlabCardDisplay) return { ids: null };
      try {
        const parsed = JSON.parse(
          profile.librarySlabCardDisplay,
        ) as unknown;
        return {
          ids: Array.isArray(parsed)
            ? parsed
                .filter((x): x is number => typeof x === "number")
                .slice(0, 4)
            : null,
        };
      } catch {
        return { ids: null };
      }
    },
  }),

  setLibrarySlabCardDisplay: defineAction({
    description:
      "Sets which of the user's graded slabs are on display on the small upper shelf of SLABS in their Library — up to four graded slab ids from their own saved slabs; an empty list is a valid, empty shelf.",
    request: z.object({
      ids: z.array(z.number().int().positive()).max(4),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const rows = await db.select().from(schema.gradedSlabs);
      const valid = new Set(rows.map((r) => r.id));
      const ids = [...new Set(args.ids)].filter((id) => valid.has(id));
      await db
        .update(schema.collectorProfile)
        .set({
          librarySlabCardDisplay: JSON.stringify(ids),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, profile.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listAllGradedSlabs: defineAction({
    description:
      "Every graded slab saved in the vault, newest first, each with the catalog card it belongs to (game, name, set, number, catalog art, market price) — the source for the SLABS shelves and graded-cards list. Optionally filtered to one grading company (PSA, BGS, SGC, CGC, or TAG).",
    request: z.object({
      company: z
        .enum(["PSA", "BGS", "SGC", "CGC", "TAG"])
        .nullable()
        .optional(),
    }),
    response: z.object({
      slabs: z.array(
        gradedSlabZ.extend({
          cardId: z.number(),
          cardGame: z.string(),
          cardName: z.string(),
          cardPrinted: z.string(),
          cardSectionName: z.string(),
          cardImageUrl: z.string().nullable(),
          cardPrice: z.number().nullable(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = (
        await db
          .select()
          .from(schema.gradedSlabs)
          .orderBy(desc(schema.gradedSlabs.createdAt))
      ).filter((r) => !args.company || r.company === args.company);
      const out: {
        id: number;
        company: string;
        cert: string;
        grade: string;
        paid: number | null;
        qty: number;
        imageUrl: string | null;
        imageBackUrl: string | null;
        imageSource: string | null;
        onlineLine: string | null;
        createdAt: number;
        cardId: number;
        cardGame: string;
        cardName: string;
        cardPrinted: string;
        cardSectionName: string;
        cardImageUrl: string | null;
        cardPrice: number | null;
      }[] = [];
      for (const r of rows) {
        const base = await gradedSlabShape(ctx, r);
        const cardRows = await db
          .select()
          .from(schema.gameCards)
          .where(eq(schema.gameCards.id, r.gameCardId));
        const card = cardRows[0];
        out.push({
          ...base,
          cardId: r.gameCardId,
          cardGame: card?.game ?? "",
          cardName: card?.name ?? "Graded card",
          cardPrinted: card?.printed ?? "",
          cardSectionName: card?.sectionName ?? "",
          cardImageUrl: card?.imageUrl ?? null,
          cardPrice: card?.price ?? null,
        });
      }
      return { slabs: out };
    },
  }),

  getResearchCard: defineAction({
    description:
      "Returns the Portfolio Research homework for one binder card: its canonical current price and TCGplayer id, the full tracked price history, the recorded eBay sold figure with its sale window when one exists (TCGplayer is price source #1, eBay sold #2), the user's position (copies owned, total paid, average paid, gain/loss), every other printing of the same card with its price and owned count, and its set-completion context (pockets owned vs total and the cost to finish the set).",
    request: z.object({ cardId: z.number().int().positive() }),
    response: z.object({
      cardId: z.number(),
      fullName: z.string(),
      groupName: z.string(),
      printed: z.string(),
      price: z.number().nullable(),
      tcgplayerId: z.string().nullable(),
      ebay: z
        .object({
          usd: z.number(),
          lastSoldMonth: z.string(),
          windowLabel: z.string(),
          stale: z.boolean(),
        })
        .nullable(),
      priceHistory: z.array(
        z.object({
          date: z.string(),
          label: z.string(),
          value: z.number(),
          source: z.string(),
        }),
      ),
      position: z.object({
        ownedQty: z.number(),
        paidTotal: z.number(),
        avgPaid: z.number().nullable(),
        valueTotal: z.number(),
        net: z.number(),
      }),
      printings: z.array(
        z.object({
          id: z.number(),
          fullName: z.string(),
          printed: z.string(),
          groupName: z.string(),
          price: z.number().nullable(),
          ownedQty: z.number(),
        }),
      ),
      setContext: z
        .object({
          groupName: z.string(),
          ownedPockets: z.number(),
          totalPockets: z.number(),
          costToComplete: z.number(),
          unpricedMissing: z.number(),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("Card not found");
      const histRows = await db
        .select()
        .from(schema.cardPriceHistory)
        .where(eq(schema.cardPriceHistory.uid, row.uid))
        .orderBy(asc(schema.cardPriceHistory.id));
      const priceHistory = (
        histRows.length > 0
          ? histRows.map((h) => ({
              date: h.date,
              label: h.label,
              value: h.unitValue,
              source: h.source,
            }))
          : (cardHistory[row.uid] ?? []).map((pt) => ({
              date: pt.date,
              label: pt.label,
              value: pt.value,
              source: "export",
            }))
      );
      const money = cardMoney(row);
      const ebaySnap = ebaySoldPrices[row.id];
      const ebay = ebaySnap
        ? {
            usd: ebaySnap.usd,
            lastSoldMonth: ebaySnap.lastSoldMonth,
            windowLabel: EBAY_SOLD_WINDOW_LABEL,
            stale:
              (Date.now() - Date.parse(EBAY_SOLD_WINDOW_END)) / 86_400_000 >
              90,
          }
        : null;
      const allRows = await db.select().from(schema.cards);
      // Printings = the same card printed elsewhere. Puzzle /
      // lore inserts all share generic names ("Puzzle Piece"),
      // so they are excluded — they are not printings of each
      // other.
      const printings = (
        row.groupKey.startsWith("puzzle:")
          ? []
          : allRows.filter(
              (r) =>
                r.fullName === row.fullName &&
                r.id !== row.id &&
                !r.groupKey.startsWith("puzzle:"),
            )
      )
        .map((r) => ({
          id: r.id,
          fullName: r.fullName,
          printed: r.printed,
          groupName: r.groupName,
          price: r.marketValue,
          ownedQty: r.ownedQty,
        }))
        .sort(
          (a, b) =>
            a.groupName.localeCompare(b.groupName) ||
            a.printed.localeCompare(b.printed),
        );
      let setContext = null;
      if (row.groupKey.startsWith("set:")) {
        const siblings = allRows.filter((r) => r.groupKey === row.groupKey);
        let ownedPockets = 0;
        let totalPockets = 0;
        for (const s of siblings) {
          for (const p of pocketsOf(s)) {
            totalPockets += 1;
            if (p.qty > 0) ownedPockets += 1;
          }
        }
        const missing = missingPocketsOf(siblings);
        setContext = {
          groupName: row.groupName,
          ownedPockets,
          totalPockets,
          costToComplete:
            Math.round(
              missing.reduce((sum, m) => sum + (m.price ?? 0), 0) * 100,
            ) / 100,
          unpricedMissing: missing.filter((m) => m.price == null).length,
        };
      }
      return {
        cardId: row.id,
        fullName: row.fullName,
        groupName: row.groupName,
        printed: row.printed,
        price: row.marketValue,
        tcgplayerId: tcgIdOf(row),
        ebay,
        priceHistory,
        position: {
          ownedQty: row.ownedQty,
          paidTotal: Math.round(money.paid * 100) / 100,
          avgPaid:
            row.ownedQty > 0
              ? Math.round((money.paid / row.ownedQty) * 100) / 100
              : null,
          valueTotal: Math.round(money.value * 100) / 100,
          net: Math.round((money.value - money.paid) * 100) / 100,
        },
        printings,
        setContext,
      };
    },
  }),

  listItemLocations: defineAction({
    description:
      "Lists the storage locations the user has entered for one item (its 'Where it lives' rows on the detail view): each spot's type, place, page/pocket or row detail, and how many copies sit there. Empty until the user adds one — locations are never invented.",
    request: z.object({
      targetKind: z.enum(["card", "sealed", "comic", "game"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      comicId: z.string().min(1).nullable(),
      gameCardId: z.number().int().positive().nullable().optional(),
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
              : args.targetKind === "game"
                ? and(
                    eq(schema.itemLocations.targetKind, "game"),
                    eq(
                      schema.itemLocations.gameCardId,
                      args.gameCardId ?? -1,
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
      targetKind: z.enum(["card", "sealed", "comic", "game"]),
      cardId: z.number().int().positive().nullable(),
      sealedName: z.string().min(1).nullable(),
      comicId: z.string().min(1).nullable(),
      gameCardId: z.number().int().positive().nullable().optional(),
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
      if (args.targetKind === "game" && args.gameCardId == null) {
        throw new Error("gameCardId is required for a game location");
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
          gameCardId:
            args.targetKind === "game" ? (args.gameCardId ?? null) : null,
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
      "Computes the binder's financial metrics: export-scope totals (value, paid, net) from live per-finish prices plus sealed/token items, per-set export figures, live set chart data, value by rarity, price tiers, spare-copy value, the most valuable items owned, the value-over-time history starting Oct 25 2026, and the owned Lego and Funko values (catalog price × owned copies) behind Portfolio's Collection Distribution rows.",
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
          const tally = tallyTotal(row);
          if (tally <= 0) continue;
          const pts = histByUid.get(row.uid);
          if (!pts || pts.length === 0) continue;
          let base = pts[0];
          if (def.days != null && target != null) {
            for (const p of pts) {
              if (p.date <= target) base = p;
            }
          }
          if (base == null || base.unitValue <= 0) continue;
          const unitNow = cardMoney(row).value / tally;
          if (unitNow <= 0) continue;
          const deltaTotal = round2((unitNow - base.unitValue) * tally);
          if (deltaTotal === 0) continue;
          movers.push({
            cardId: row.id,
            name: row.fullName,
            groupName: row.groupName,
            printed: row.printed,
            rarity: row.rarity,
            qty: tally,
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
        const tally = tallyTotal(row);
        if (tally <= 0) continue;
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
        const unitNow = cardMoney(row).value / tally;
        if (unitNow <= 0) continue;
        const deltaTotal = round2((unitNow - base.unitValue) * tally);
        if (deltaTotal === 0) continue;
        movers24hAll.push({
          cardId: row.id,
          name: row.fullName,
          groupName: row.groupName,
          printed: row.printed,
          rarity: row.rarity,
          qty: tally,
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

      // Lego / Funko owned values for the Collection
      // Distribution rows (Nov 7, 2026): catalog price ×
      // owned copies over the game catalog — opened +
      // sealed copies for Lego (its sealed count is tracked
      // apart), the same rule Money Tracker applies to game
      // items. Untracked prices contribute $0, never a guess.
      let legoValue = 0;
      let legoQty = 0;
      let funkoValue = 0;
      let funkoQty = 0;
      const ownedGameRows = await db
        .select()
        .from(schema.gameCards)
        .where(
          or(
            gt(schema.gameCards.ownedQty, 0),
            gt(schema.gameCards.ownedSealedQty, 0),
          ),
        );
      for (const g of ownedGameRows) {
        const qty = g.ownedQty + g.ownedSealedQty;
        if (qty <= 0) continue;
        if (g.game === "lego") {
          legoQty += qty;
          if (g.price != null) legoValue += g.price * qty;
        } else if (g.game === "funko") {
          funkoQty += qty;
          if (g.price != null) funkoValue += g.price * qty;
        }
      }

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
        legoValue: round2(legoValue),
        legoQty,
        funkoValue: round2(funkoValue),
        funkoQty,
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
      "Saves current market prices fetched by the re-pricing task: updates per-finish values for the given cards (paid amounts untouched) and, when at least half the owned printings were priced, appends today's point to the value history. A price whose one-day jump versus the card's tracked value is implausible (≥4× or ≤¼ and ≥$5 — the Nov 6, 2026 wrong-printing class) is REFUSED, logged to the price audit log as a quarantine, and counted in the response's quarantined field; the card keeps its tracked price.",
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
      quarantined: z.number(),
    }),
    async handler(ctx, args): Promise<{
      updated: number;
      coveragePct: number;
      snapshotAdded: boolean;
      quarantined: number;
    }> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.cards);
      // Snapshot totals use Anthony's current sealed quantities too.
      const sealedTotals = (await effectiveSealed(ctx)).totals;
      const byUid = new Map(rows.map((r) => [r.uid, r]));
      let updated = 0;
      let quarantined = 0;
      // Quarantine writer (Nov 6, 2026 price guard): a refused
      // price is never silent — it lands in the price audit
      // log, where the Settings price-audit line surfaces it.
      const logQuarantine = async (
        row: typeof schema.cards.$inferSelect,
        keptValue: number,
        refusedValue: number,
      ) => {
        quarantined += 1;
        await db.insert(schema.priceAuditLog).values({
          ranAt: new Date().toISOString(),
          kind: "quarantine",
          uid: row.uid,
          fullName: row.fullName,
          printed: row.printed,
          oldValue: keptValue,
          newValue: refusedValue,
          source: "save-guard",
        });
      };
      for (const price of args.prices) {
        const row = byUid.get(price.uid);
        if (!row) continue;
        if (row.ownedQty <= 0) {
          // Price guard (Nov 6, 2026): an unowned printing's
          // stored market price is its only baseline, but the
          // same wrong-printing class applies — refuse an
          // implausible jump against it instead of writing it.
          if (
            row.marketValue != null &&
            isImplausiblePriceJump(row.marketValue, price.usd)
          ) {
            await logQuarantine(row, row.marketValue, price.usd);
            continue;
          }
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
        // Price guard (Nov 6, 2026): the card's tracked
        // history is the baseline — if the incoming unit value
        // is an implausible one-day jump from the latest
        // tracked point, the price almost certainly belongs
        // to a different printing (the Nov 6 Promo Set 3
        // failure). Refuse the write entirely: no finance
        // change, no history point, and a quarantine log row
        // the nightly audit and the Settings line surface.
        // A card with no tracked point yet has no baseline
        // and is priced normally — its first point establishes
        // one.
        const historyPoints = (
          await db
            .select()
            .from(schema.cardPriceHistory)
            .where(eq(schema.cardPriceHistory.uid, row.uid))
        ).sort((a, b) =>
          a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
        );
        const baselinePoint = historyPoints[historyPoints.length - 1];
        if (
          baselinePoint &&
          isImplausiblePriceJump(baselinePoint.unitValue, newUnit)
        ) {
          await logQuarantine(row, baselinePoint.unitValue, newUnit);
          continue;
        }
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
        const todaysPoint = historyPoints.find(
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
      return { updated, coveragePct, snapshotAdded, quarantined };
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
      // Guest access (platform v27): agent tasks are
      // owner-only and unavailable in the shared runtime;
      // the daily schedule runs this locally as the owner.
      if (agentCapabilityBlocked(ctx)) {
        return { started: false, taskId: null };
      }
      const today = new Date().toISOString().slice(0, 10);
      const result = await ctx.agent.spawnTask(
        [
          "Re-price Anthony's Lorcana collection in the lorcana-binder web artifact.",
          "1. Call the artifact's getRepricingTargets action to list every printing in the catalog (uid, name, set, printed number, TCGplayer id, owned flag). Price the not-yet-owned ones too — their prices keep the app's Cost to Complete figures current.",
          "2. For each target, find its CURRENT market price in USD for THAT EXACT PRINTING — a price from any other printing is worse than no price (Nov 6, 2026: eight Promo Set 3 cards were written with wrong prices 8×–176× too high this way). The Lorcast API is the practical source: https://api.lorcast.com/v0/cards/search?q=<url-encoded card name> returns printings with a prices object (usd for non-foil, usd_foil for foil) AND each printing's own tcgplayer_id. A Lorcast printing counts as a match ONLY when its tcgplayer_id equals the target's TCGplayer id (or, for a target with no TCGplayer id, when set code, collector number, and name all match exactly). Batch by searching per set where that is faster. Use the near-mint market price.",
          "2b. Promo printings (printed numbers like 49/P3) are mostly NOT in Lorcast at all — a name search returns only the main-set printing, which is a DIFFERENT product and must never be used for the promo. For a promo target that carries a TCGplayer id, price it from TCGplayer's own pricepoints for that exact product id (https://mpapi.tcgplayer.com/v2/product/<tcgplayer_id>/pricepoints — use the Foil marketPrice for foil finishes, Normal for non-foil). If neither Lorcast (exact id match) nor TCGplayer pricepoints (exact product id) prices a target, LEAVE IT OUT of the save entirely — its tracked price stays, which is correct. Never substitute another printing, another set's same-numbered card, a sealed product, or a listing median from a search results page.",
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

  auditPrices: defineAction({
    description:
      "Nightly price audit (Anthony, Nov 6, 2026): scans every card's tracked price history for a latest point that is an implausible one-day jump from the point before it (≥4× or ≤¼ and ≥$5 — the Nov 6, 2026 Promo Set 3 mispricing class). Each card found is repaired: its per-finish values are scaled back to the last good tracked value (paid amounts untouched), the bad history point is deleted, and a same-day daily portfolio snapshot the bad point fed is recomputed. Every repair and the run itself are logged to the price audit log. Idempotent — a clean collection scans and reports zero repairs.",
    request: z.object({ source: z.string().optional() }),
    response: z.object({
      scanned: z.number(),
      flagged: z.number(),
      repaired: z.number(),
      snapshotFixed: z.boolean(),
      ranAt: z.string(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      scanned: number;
      flagged: number;
      repaired: number;
      snapshotFixed: boolean;
      ranAt: string;
    }> {
      return runPriceAuditImpl(ctx, args.source ?? "nightly");
    },
  }),

  applyDataRepairs: defineAction({
    description:
      "This build's post-publish data repairs (Nov 6, 2026), run once against the live database at publish: (1) runs the price audit immediately, repairing the eight Promo Set 3 cards the Nov 6 re-pricing mispriced; (2) records the verified official product artwork for 2026 Topps Mint Disney — the one Disney Topps set with no art row — from its EQL launch page (image visually confirmed to depict that product's box and confirmed to ingest via getSectionArt before shipping). Idempotent: both halves no-op once applied.",
    request: z.object({}),
    response: z.object({
      scanned: z.number(),
      flagged: z.number(),
      repaired: z.number(),
      snapshotFixed: z.boolean(),
      artSeeded: z.number(),
    }),
    async handler(
      ctx,
    ): Promise<{
      scanned: number;
      flagged: number;
      repaired: number;
      snapshotFixed: boolean;
      artSeeded: number;
    }> {
      const audit = await runPriceAuditImpl(ctx, "post-submit");
      const db = ctx.db<typeof schema>();
      // Verified in-session Nov 6, 2026: the image URL is the
      // hero image of the product's own EQL launch page
      // (opened and read), the downloaded bytes were visually
      // confirmed to be the 2026 Topps Mint Disney box, and
      // getSectionArt ingested them successfully.
      const VERIFIED_SECTION_ART = [
        {
          game: "disney-topps",
          sectionKey: "2026-topps-mint-disney",
          imageUrl:
            "https://cdn.eql.media/draw-api/0e47a410-4663-4d89-8066-815408914963/c620072e-9c42-4cd3-a02c-8cdc0bfd4ed7.png?auto=format%2Ccompress&ar=1%3A0.8041958041958043&fit=crop&ixlib=react-9.11.0&w=580",
          pageUrl:
            "https://nycc-topps.runfair.com/en-US/us/2026-topps-mint-disney-nycc-box-fri",
        },
      ];
      let artSeeded = 0;
      for (const item of VERIFIED_SECTION_ART) {
        await db
          .insert(schema.gameSectionArt)
          .values(item)
          .onConflictDoUpdate({
            target: [
              schema.gameSectionArt.game,
              schema.gameSectionArt.sectionKey,
            ],
            set: { imageUrl: item.imageUrl, pageUrl: item.pageUrl },
          })
          .run();
        artSeeded += 1;
      }
      ctx.invalidateQueries();
      return {
        scanned: audit.scanned,
        flagged: audit.flagged,
        repaired: audit.repaired,
        snapshotFixed: audit.snapshotFixed,
        artSeeded,
      };
    },
  }),

  getPriceAuditStatus: defineAction({
    description:
      "Returns the price audit's latest completed run (when, how many card histories it scanned, how many it flagged and repaired) plus the most recent quarantine and repair events, for the Settings > Your data & backups price-audit line. Quarantines are prices the daily re-pricing tried to write that the saveRepricing guard refused; repairs are bad tracked points the nightly audit rolled back.",
    request: z.object({}),
    response: z.object({
      lastRunAt: z.string().nullable(),
      lastScanned: z.number().nullable(),
      lastFlagged: z.number().nullable(),
      lastRepaired: z.number().nullable(),
      runsRecorded: z.number(),
      events: z.array(
        z.object({
          kind: z.string(),
          fullName: z.string().nullable(),
          printed: z.string().nullable(),
          oldValue: z.number().nullable(),
          newValue: z.number().nullable(),
          ranAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.priceAuditLog)
        .orderBy(desc(schema.priceAuditLog.id));
      const runs = rows.filter((r) => r.kind === "run");
      const last = runs[0];
      return {
        lastRunAt: last?.ranAt ?? null,
        lastScanned: last?.scanned ?? null,
        lastFlagged: last?.flagged ?? null,
        lastRepaired: last?.repaired ?? null,
        runsRecorded: runs.length,
        events: rows
          .filter((r) => r.kind !== "run")
          .slice(0, 12)
          .map((r) => ({
            kind: r.kind,
            fullName: r.fullName ?? null,
            printed: r.printed ?? null,
            oldValue: r.oldValue ?? null,
            newValue: r.newValue ?? null,
            ranAt: r.ranAt,
          })),
      };
    },
  }),

  getArtworkCoverage: defineAction({
    description:
      "Artwork coverage report (Anthony, Nov 6, 2026 — the app-wide missing-artwork audit): for every collection area, how many sets/sections carry sourced artwork and how many individual items carry artwork, counted live from the catalog tables. sectionsWithArt is only counted for the four Topps Alternate Universe games (the areas whose set tiles render a product-art box) plus null elsewhere. Topps-family card catalogs are text-only at the source (official checklists carry no images), so their card-art counts start at zero and rise as the daily collector-source hunt (refreshCardArt → importCardArt) fills card fronts in from Collectr, the Trading Card Database, and COMC; cards still at zero render the clean placeholder.",
    request: z.object({}),
    response: z.object({
      areas: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          sections: z.number(),
          sectionsWithArt: z.number().nullable(),
          cards: z.number(),
          cardsWithArt: z.number(),
          /** Per-set accounting for the four AU areas (the
              Nov 6, 2026 request: report per set what was
              filled and what has no artwork sourced): every
              section with whether a product-art row exists
              for it, plus its card-front counts (cards /
              cardsWithArt — Nov 7, 2026: the per-set filled
              vs still-unsourced breakdown Anthony's Chrome
              Disney report asked for). Null for areas whose
              set rows render no art box. */
          sets: z
            .array(
              z.object({
                name: z.string(),
                hasArt: z.boolean(),
                cards: z.number(),
                cardsWithArt: z.number(),
              }),
            )
            .nullable(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const GAME_LABELS: Record<string, string> = {
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
      const AU_GAMES = new Set([
        "disney-topps",
        "starwars-topps",
        "gpk",
        "wwe-topps",
      ]);
      const grouped = await db
        .select({
          game: schema.gameCards.game,
          sections: sql<number>`count(distinct ${schema.gameCards.sectionKey})`,
          cards: sql<number>`count(*)`,
          cardsWithArt: sql<number>`sum(case when ${schema.gameCards.imageUrl} is not null and ${schema.gameCards.imageUrl} <> '' then 1 else 0 end)`,
        })
        .from(schema.gameCards)
        .groupBy(schema.gameCards.game);
      const artRows = await db
        .select({
          game: schema.gameSectionArt.game,
          n: sql<number>`count(*)`,
        })
        .from(schema.gameSectionArt)
        .groupBy(schema.gameSectionArt.game);
      const artByGame = new Map(artRows.map((r) => [r.game, r.n]));
      const artKeyRows = await db
        .select({
          game: schema.gameSectionArt.game,
          sectionKey: schema.gameSectionArt.sectionKey,
        })
        .from(schema.gameSectionArt);
      const artKeysByGame = new Map<string, Set<string>>();
      for (const r of artKeyRows) {
        const set = artKeysByGame.get(r.game) ?? new Set<string>();
        set.add(r.sectionKey);
        artKeysByGame.set(r.game, set);
      }
      const areas: {
        key: string;
        label: string;
        sections: number;
        sectionsWithArt: number | null;
        cards: number;
        cardsWithArt: number;
        sets:
          | {
              name: string;
              hasArt: boolean;
              cards: number;
              cardsWithArt: number;
            }[]
          | null;
      }[] = [];
      // Lorcana first — the flagship binder.
      const lorcana = await db
        .select({
          sections: sql<number>`count(distinct ${schema.cards.groupName})`,
          cards: sql<number>`count(*)`,
          cardsWithArt: sql<number>`sum(case when ${schema.cards.imageUrl} is not null and ${schema.cards.imageUrl} <> '' then 1 else 0 end)`,
        })
        .from(schema.cards);
      const lrow = lorcana[0];
      areas.push({
        key: "lorcana",
        label: "Disney Lorcana",
        sections: lrow?.sections ?? 0,
        sectionsWithArt: null,
        cards: lrow?.cards ?? 0,
        cardsWithArt: lrow?.cardsWithArt ?? 0,
        sets: null,
      });
      const order = Object.keys(GAME_LABELS);
      const sorted = [...grouped].sort(
        (a, b) => order.indexOf(a.game) - order.indexOf(b.game),
      );
      for (const g of sorted) {
        let sets:
          | {
              name: string;
              hasArt: boolean;
              cards: number;
              cardsWithArt: number;
            }[]
          | null = null;
        if (AU_GAMES.has(g.game)) {
          const sectionRows = await db
            .select({
              key: schema.gameCards.sectionKey,
              name: schema.gameCards.sectionName,
              cards: sql<number>`count(*)`,
              cardsWithArt: sql<number>`sum(case when ${schema.gameCards.imageUrl} is not null and ${schema.gameCards.imageUrl} <> '' then 1 else 0 end)`,
            })
            .from(schema.gameCards)
            .where(eq(schema.gameCards.game, g.game))
            .groupBy(
              schema.gameCards.sectionKey,
              schema.gameCards.sectionName,
            )
            .orderBy(asc(sql`min(${schema.gameCards.sectionSort})`));
          const keys = artKeysByGame.get(g.game) ?? new Set<string>();
          sets = sectionRows.map((s) => ({
            name: s.name,
            hasArt: keys.has(s.key),
            cards: s.cards,
            cardsWithArt: s.cardsWithArt ?? 0,
          }));
        }
        areas.push({
          key: g.game,
          label: GAME_LABELS[g.game] ?? g.game,
          sections: g.sections,
          sectionsWithArt: AU_GAMES.has(g.game)
            ? (artByGame.get(g.game) ?? 0)
            : null,
          cards: g.cards,
          cardsWithArt: g.cardsWithArt ?? 0,
          sets,
        });
      }
      return { areas };
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
      const before = await db
        .select({
          ownedQty: schema.cards.ownedQty,
          uid: schema.cards.uid,
        })
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const rawClean: Record<string, number> = {};
      for (const [finish, qty] of Object.entries(args.finishes)) {
        if (qty > 0) rawClean[finish] = qty;
      }
      // Foil-only quest reprints (Nov 9, 2026): whatever a
      // caller sends, the copies are filed under the printing's
      // one real finish — a Regular count for one of these
      // printings can never be written back into existence.
      const clean =
        before[0] && FOIL_ONLY_QUEST_REPRINT_UIDS.has(before[0].uid)
          ? foldFinishesToColdFoil(rawClean)
          : rawClean;
      let total = 0;
      for (const qty of Object.values(clean)) total += qty;
      await db
        .update(schema.cards)
        .set({ ownedQty: total, finishes: JSON.stringify(clean) })
        .where(eq(schema.cards.id, args.cardId));
      await recordRecentAddition(
        ctx,
        args.cardId,
        total - (before[0]?.ownedQty ?? 0),
      );
      ctx.invalidateQueries();
      // Cloud backup stays current on every quantity change
      // (best-effort push of just this card's rows), and the
      // change is stamped for the backup bookkeeping.
      await markBackupDirty(ctx);
      const updated = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId));
      if (updated[0]) await syncCardToCloud(ctx, updated[0]);
      return { ownedQty: total };
    },
  }),

  updateSceneOwnership: defineAction({
    description:
      "Updates how many copies of a connecting-art card Anthony holds in its joined scene, broken down by finish — a tally fully separate from the binder pocket finishes (Anthony, Nov 9, 2026): scene steppers write only here, pocket steppers only to finishes, and the scene tally starts at 0 for every card. Master-set owned/missing and portfolio value combine the two tallies server-side; this write touches nothing else.",
    request: z.object({
      cardId: z.number().int().positive(),
      finishes: z.record(z.string(), z.number().int().min(0).max(999)),
    }),
    response: z.object({ sceneQty: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ sceneQty: number }> {
      const db = ctx.db<typeof schema>();
      const clean: Record<string, number> = {};
      let total = 0;
      for (const [finish, qty] of Object.entries(args.finishes)) {
        if (qty > 0) {
          clean[finish] = qty;
          total += qty;
        }
      }
      const before = await db
        .select({ sceneFinishes: schema.cards.sceneFinishes })
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId))
        .limit(1);
      const beforeTotal = before[0]
        ? tallySum(parseFinishes(before[0].sceneFinishes))
        : 0;
      await db
        .update(schema.cards)
        .set({ sceneFinishes: JSON.stringify(clean) })
        .where(eq(schema.cards.id, args.cardId));
      await recordRecentAddition(ctx, args.cardId, total - beforeTotal);
      ctx.invalidateQueries();
      await markBackupDirty(ctx);
      const updated = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId));
      if (updated[0]) await syncCardToCloud(ctx, updated[0]);
      return { sceneQty: total };
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
      const finishKey = FOIL_ONLY_QUEST_REPRINT_UIDS.has(row.uid)
        ? // Foil-only quest reprints (Nov 9, 2026): the one
          // pocket's finish is Cold Foil by definition, whatever
          // a legacy stored record still carries.
          "Cold Foil"
        : (Object.keys(target.finishes)[0] ??
          (target.kind === "foil"
            ? row.grp === "promo"
              ? "Promo Foil"
              : "Cold Foil"
            : target.kind === "single" &&
                POCKET_FINISH_LABELS.has(target.label)
              ? target.label
              : "Regular"));
      const current = full[finishKey] ?? 0;
      const nextQty = Math.max(
        0,
        Math.min(999, args.setQty ?? current + (args.delta ?? 0)),
      );
      const merged: Record<string, number> = {
        ...full,
        [finishKey]: nextQty,
      };
      const rawClean: Record<string, number> = {};
      for (const [finish, qty] of Object.entries(merged)) {
        if (qty > 0) rawClean[finish] = qty;
      }
      // Same one-finish guard as updateOwnership (Nov 9, 2026):
      // a pocket write on a foil-only quest reprint folds any
      // legacy non-foil entry into Cold Foil instead of
      // preserving the phantom finish.
      const clean = FOIL_ONLY_QUEST_REPRINT_UIDS.has(row.uid)
        ? foldFinishesToColdFoil(rawClean)
        : rawClean;
      let total = 0;
      for (const qty of Object.values(clean)) total += qty;
      await db
        .update(schema.cards)
        .set({ ownedQty: total, finishes: JSON.stringify(clean) })
        .where(eq(schema.cards.id, args.cardId));
      await recordRecentAddition(ctx, args.cardId, total - row.ownedQty);
      ctx.invalidateQueries();
      await markBackupDirty(ctx);
      const updated = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, args.cardId));
      if (updated[0]) await syncCardToCloud(ctx, updated[0]);
      return { qty: nextQty, ownedQty: total };
    },
  }),

  getRecentlyAdded: defineAction({
    description:
      "Returns the cards most recently ADDED to the collection through the app itself (stepper, pocket, or scan adds recorded since the additions log began), newest first, one entry per card, for Home's Recently Added rail under the New Vision 2.0 Beta theme. Export-seeded ownership is never listed: those cards carry no recorded add date, and none is invented.",
    request: z.object({}),
    response: z.object({
      items: z.array(
        z.object({
          cardId: z.number(),
          name: z.string(),
          groupName: z.string(),
          printed: z.string().nullable(),
          unitValue: z.number().nullable(),
          qty: z.number(),
          addedAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.recentAdditions)
        .orderBy(desc(schema.recentAdditions.id))
        .limit(60);
      const seen = new Set<number>();
      const latest: typeof rows = [];
      for (const r of rows) {
        if (seen.has(r.cardId)) continue;
        seen.add(r.cardId);
        latest.push(r);
        if (latest.length >= 12) break;
      }
      if (latest.length === 0) return { items: [] };
      const cardRows = await db
        .select()
        .from(schema.cards)
        .where(
          inArray(
            schema.cards.id,
            latest.map((r) => r.cardId),
          ),
        );
      const byId = new Map(cardRows.map((c) => [c.id, c]));
      const items = latest.flatMap((r) => {
        const card = byId.get(r.cardId);
        if (!card) return [];
        const money = cardMoney(card);
        return [
          {
            cardId: card.id,
            name: card.fullName,
            groupName: card.groupName,
            printed: card.printed,
            unitValue:
              card.ownedQty > 0
                ? Math.round((money.value / card.ownedQty) * 100) / 100
                : (card.marketValue ?? null),
            qty: r.qty,
            addedAt: r.addedAt,
          },
        ];
      });
      return { items };
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
        layout: profile.layout ?? null,
        language: profile.language ?? null,
        updateTestSeen: profile.updateTestSeen > 0,
        shareCollection: (profile.shareCollection ?? 1) > 0,
        usernameChangeUsed: (profile.usernameChangeUsed ?? 0) > 0,
        gridCols: profile.gridCols ?? null,
        onlyMine: profile.onlyMine ?? null,
        inviteCode: inviteCodeForCollector(profile.collectorCode),
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
      if (
        args.username.toLowerCase() === profile.username.toLowerCase()
      ) {
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
      // Username uniqueness, enforced server-side (Nov 9,
      // 2026): a name another collector already holds is
      // refused, and an unreadable registry fails closed —
      // either way the refusal does NOT consume the one
      // change; it is spent only when a verified-free name is
      // actually saved below.
      const taken = await registryUsernameTakenByOther(
        profile.collectorCode,
        args.username,
      );
      if (taken === null) {
        return {
          ok: false,
          username: profile.username,
          changeUsed: used,
          error:
            "Couldn't check that username against the network just now — check your connection and try again.",
        };
      }
      if (taken) {
        return {
          ok: false,
          username: profile.username,
          changeUsed: used,
          error: "That username is already taken on the network.",
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
      "Saves the app theme the user picked in Settings (Vault Dark, Light, Midnight Purple, Crimson Ember, High Contrast, Rainbow, or New Vision 2.0 Beta) on their collector profile, so the choice persists for them across devices. Presentation only — no collection data changes.",
    request: z.object({
      theme: z.enum([
        "vault",
        "light",
        "midnight",
        "crimson",
        "contrast",
        "rainbow",
        "jarvis",
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

  setLayoutPreference: defineAction({
    description:
      "Saves the app layout the user picked in Settings (Classic or New Vision) on their collector profile, so the choice persists for them across devices. The layout is a choice separate from the theme: themes are colors, layouts are structure (navigation form, Home organization, iconography, spacing). Presentation only — no collection data or behavior changes; every function works identically under either layout.",
    request: z.object({
      layout: z.enum(["classic", "vision"]),
    }),
    response: z.object({ ok: z.literal(true), layout: z.string() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; layout: string }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          layout: args.layout,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, layout: args.layout };
    },
  }),

  setLanguagePreference: defineAction({
    description:
      "Saves the UI language the user picked in Settings (English, Spanish, German, French, or Japanese) on their collector profile, so the choice persists for them across devices. Presentation only — catalog names and user content are never translated.",
    request: z.object({
      language: z.enum(["en", "es", "de", "fr", "ja"]),
    }),
    response: z.object({ ok: z.literal(true), language: z.string() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; language: string }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          language: args.language,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, language: args.language };
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

  setOnlyMinePreference: defineAction({
    description:
      "Saves the user's one shared 'Only mine' list-filter choice (Anthony, Nov 5, 2026) on their collector profile: when on, every list page showing more than 15 entries hides the entries they own nothing from; off (the default) shows everything. Presentation only — no collection data changes.",
    request: z.object({
      on: z.boolean(),
    }),
    response: z.object({ ok: z.literal(true), on: z.boolean() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; on: boolean }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.collectorProfile)
        .set({
          onlyMine: args.on ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true, on: args.on };
    },
  }),

  getReorderPrefs: defineAction({
    description:
      "Returns the user's saved drag-reorder orders (Anthony, Nov 5, 2026): a map from a reorder surface's key (\"tcg-games\", \"au-areas\", \"sports\") to the saved tile-key order for that surface, from the app-wide long-press drag reorder. Empty when nothing has been arranged yet.",
    request: z.object({}),
    response: z.object({
      prefs: z.record(z.string(), z.array(z.string())),
    }),
    async handler(
      ctx,
    ): Promise<{ prefs: Record<string, string[]> }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ reorderPrefs: schema.collectorProfile.reorderPrefs })
        .from(schema.collectorProfile)
        .where(eq(schema.collectorProfile.id, 1));
      const raw = rows[0]?.reorderPrefs;
      if (!raw) return { prefs: {} };
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const prefs: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (Array.isArray(v)) {
            prefs[k] = v.filter(
              (x): x is string => typeof x === "string",
            );
          }
        }
        return { prefs };
      } catch {
        return { prefs: {} };
      }
    },
  }),

  setReorderPref: defineAction({
    description:
      "Saves one surface's drag-reorder order (Anthony, Nov 5, 2026) on the user's collector profile, merged with the other surfaces' orders, so a long-press drag arrangement persists for them across devices. Presentation only — no collection data changes.",
    request: z.object({
      key: z.string().min(1).max(64),
      order: z.array(z.string().min(1).max(128)).max(256),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true }> {
      await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ reorderPrefs: schema.collectorProfile.reorderPrefs })
        .from(schema.collectorProfile)
        .where(eq(schema.collectorProfile.id, 1));
      let prefs: Record<string, string[]> = {};
      const raw = rows[0]?.reorderPrefs;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          for (const [k, v] of Object.entries(parsed)) {
            if (Array.isArray(v)) {
              prefs[k] = v.filter(
                (x): x is string => typeof x === "string",
              );
            }
          }
        } catch {
          prefs = {};
        }
      }
      prefs[args.key] = args.order;
      await db
        .update(schema.collectorProfile)
        .set({
          reorderPrefs: JSON.stringify(prefs),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.collectorProfile.id, 1));
      ctx.invalidateQueries();
      return { ok: true as const };
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
      // Guarded publish (Nov 9, 2026): before registration this
      // returns null and stamps nothing, so the Home auto-sync
      // firing on a fresh install's first open can no longer
      // register the seeded placeholder name under the new
      // collector code — and a name held by another collector
      // is never written.
      const mine = await publishOwnRegistryProfile(profile);
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

  getVerifiedBadges: defineAction({
    description:
      "Every verified badge on record (Anthony, Nov 4, 2026): collector code, username, status (verified / revoked), basis (root / builtin / owner / trade), and when granted — the shared data behind the check badge beside usernames everywhere. The two launch-verified accounts (the owner as root, Jarvis as the built-in friend) are seeded on first read.",
    request: z.object({}),
    response: z.object({
      badges: z.array(
        z.object({
          collectorCode: z.string(),
          username: z.string(),
          status: z.string(),
          basis: z.string(),
          grantedAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      await ensureVerifiedRoots(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.verifiedBadges);
      return {
        badges: rows.map((r) => ({
          collectorCode: r.collectorCode,
          username: r.username,
          status: r.status,
          basis: r.basis,
          grantedAt: r.grantedAt,
        })),
      };
    },
  }),

  getVerifiedProof: defineAction({
    description:
      "The transparency record behind one collector's verified badge (Anthony, Nov 4, 2026): the honest basis — root of the chain, built-in friend, verified by the owner (with date), or the confirmed trade that earned it (with whom and when) — plus revocation state when the badge was revoked. Powers the badge explainer sheet.",
    request: z.object({ collectorCode: z.string().trim().min(1).max(60) }),
    response: z.object({
      found: z.boolean(),
      collectorCode: z.string(),
      username: z.string().nullable(),
      status: z.string().nullable(),
      basis: z.string().nullable(),
      grantedAt: z.string().nullable(),
      proofLabel: z.string().nullable(),
      proofTrade: z
        .object({
          kind: z.string(),
          refId: z.number(),
          withUsername: z.string(),
          withCode: z.string(),
          completedAt: z.string(),
        })
        .nullable(),
      revokedAt: z.string().nullable(),
    }),
    async handler(ctx, args) {
      await ensureVerifiedRoots(ctx);
      const row = await badgeRowFor(ctx, args.collectorCode);
      if (!row) {
        return {
          found: false,
          collectorCode: args.collectorCode,
          username: null,
          status: null,
          basis: null,
          grantedAt: null,
          proofLabel: null,
          proofTrade: null,
          revokedAt: null,
        };
      }
      let proofLabel: string | null = null;
      let proofTrade: {
        kind: string;
        refId: number;
        withUsername: string;
        withCode: string;
        completedAt: string;
      } | null = null;
      try {
        const proof = JSON.parse(row.proofJson ?? "{}") as {
          label?: string;
          kind?: string;
          refId?: number;
          withUsername?: string;
          withCode?: string;
          completedAt?: string;
        };
        if (row.basis === "owner") {
          proofLabel = "Verified by the owner";
        } else if (
          row.basis === "trade" &&
          proof.kind &&
          proof.withUsername &&
          proof.completedAt
        ) {
          proofTrade = {
            kind: proof.kind,
            refId: proof.refId ?? 0,
            withUsername: proof.withUsername,
            withCode: proof.withCode ?? "",
            completedAt: proof.completedAt,
          };
        } else if (proof.label) {
          proofLabel = proof.label;
        }
      } catch {
        proofLabel = null;
      }
      return {
        found: true,
        collectorCode: row.collectorCode,
        username: row.username,
        status: row.status,
        basis: row.basis,
        grantedAt: row.grantedAt,
        proofLabel,
        proofTrade,
        revokedAt: row.revokedAt ?? null,
      };
    },
  }),

  grantVerifiedBadge: defineAction({
    description:
      "OWNER-ONLY manual verified-badge grant (Anthony, Nov 4, 2026 — the owner override): Anthony alone can verify a collector without a confirmed trade, from Admin's Registered Users list. Recorded server-side with the honest basis 'Verified by the owner' plus the date — never dressed up as a trade. A manually verified collector is fully verified: their confirmed trades can confer the badge onward, and they qualify for forum roles.",
    request: z.object({
      collectorCode: z.string().trim().min(1).max(60),
      username: z.string().trim().min(1).max(40),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE) {
        return {
          ok: false,
          error: "Only the owner can grant the verified badge.",
        };
      }
      await ensureVerifiedRoots(ctx);
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      const existing = await badgeRowFor(ctx, args.collectorCode);
      const values = {
        collectorCode: args.collectorCode,
        username: args.username,
        status: "verified" as const,
        basis: "owner" as const,
        proofJson: JSON.stringify({ byUsername: profile.username }),
        grantedAt: now,
        revokedAt: null,
        revokedBy: null,
        updatedAt: now,
      };
      if (existing) {
        await db
          .update(schema.verifiedBadges)
          .set({
            ...values,
            // Re-granting after a revocation starts a fresh
            // grant date; refreshing a live badge keeps the
            // original one.
            grantedAt:
              existing.status === "revoked" ? now : existing.grantedAt,
          })
          .where(
            eq(schema.verifiedBadges.collectorCode, args.collectorCode),
          );
      } else {
        await db.insert(schema.verifiedBadges).values(values);
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  revokeVerifiedBadge: defineAction({
    description:
      "OWNER-ONLY verified-badge revocation (Anthony, Nov 4, 2026): on a substantiated report the owner can revoke a collector's badge; the revocation is recorded server-side and stays visible on their proof, and any forum role they hold is suspended with it (forum roles require a currently verified badge). The owner's own root badge cannot be revoked here.",
    request: z.object({
      collectorCode: z.string().trim().min(1).max(60),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE) {
        return {
          ok: false,
          error: "Only the owner can revoke the verified badge.",
        };
      }
      if (args.collectorCode === OWNER_COLLECTOR_CODE) {
        return {
          ok: false,
          error: "The owner's root badge can't be revoked.",
        };
      }
      const row = await badgeRowFor(ctx, args.collectorCode);
      if (!row || row.status !== "verified") {
        return { ok: false, error: "That collector isn't verified." };
      }
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      await db
        .update(schema.verifiedBadges)
        .set({
          status: "revoked",
          revokedAt: now,
          revokedBy: profile.username,
          updatedAt: now,
        })
        .where(
          eq(schema.verifiedBadges.collectorCode, args.collectorCode),
        );
      // Forum roles hang off the badge (Anthony's hard rule):
      // revoking the badge SUSPENDS any forum role the holder
      // has. It returns only when the badge is restored AND
      // the owner re-grants the role (grantForumRole clears
      // the suspension).
      await db
        .update(schema.forumRoles)
        .set({ suspended: 1 })
        .where(eq(schema.forumRoles.collectorCode, args.collectorCode));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  getAdminUserTrust: defineAction({
    description:
      "OWNER-ONLY Admin data (Anthony, Nov 4, 2026): for every registered collector, their verified-badge record and their invite lineage — who vouched them in (username, Collector ID, date) and everyone they have vouched in. Lineage is abuse-tracing audit data shown ONLY here in Admin, never on a public profile. Members who joined before invite codes existed and were invited by the owner are attributed to the owner and labeled as a backfill; root accounts (owner, Jarvis) show no voucher; anyone else unprovable shows no voucher on file.",
    request: z.object({}),
    response: z.object({
      isOwner: z.boolean(),
      users: z.array(
        z.object({
          collectorCode: z.string(),
          badgeStatus: z.string().nullable(),
          badgeBasis: z.string().nullable(),
          vouchedBy: z
            .object({
              username: z.string(),
              collectorCode: z.string(),
              at: z.string(),
              source: z.string(),
            })
            .nullable(),
          vouchedIn: z.array(
            z.object({
              username: z.string(),
              collectorCode: z.string(),
              at: z.string(),
              source: z.string(),
            }),
          ),
        }),
      ),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE) {
        return { isOwner: false, users: [] };
      }
      await ensureVerifiedRoots(ctx);
      const db = ctx.db<typeof schema>();
      const badgeRows = await db.select().from(schema.verifiedBadges);
      const badgeByCode = new Map(
        badgeRows.map((r) => [r.collectorCode, r]),
      );
      const lineage = await db.select().from(schema.inviteLineage);
      const list = await supabaseRest(
        "profiles?select=collector_id,username,trust_score,created_at&order=created_at.asc",
      );
      const roster = list.ok ? asRegistryRows(list.json) : [];
      const rosterCodes = new Set(roster.map((r) => r.collector_id));
      // Backfill (Anthony's direction): the existing testers
      // were invited by Anthony himself. Any roster member who
      // is neither a root account nor already carrying a
      // witnessed lineage row is attributed to the owner and
      // labeled "backfill" — honest about how we know.
      const witnessed = new Set(
        lineage.map((l) => l.newCollectorCode),
      );
      const ownerRow = roster.find(
        (r) => r.collector_id === OWNER_COLLECTOR_CODE,
      );
      const users = roster.map((r) => {
        const badge = badgeByCode.get(r.collector_id) ?? null;
        let vouchedBy: {
          username: string;
          collectorCode: string;
          at: string;
          source: string;
        } | null = null;
        const own = lineage.find(
          (l) => l.newCollectorCode === r.collector_id,
        );
        if (own) {
          vouchedBy = {
            username: own.vouchedByUsername,
            collectorCode: own.vouchedByCode,
            at: own.createdAt,
            source: own.source,
          };
        } else if (
          r.collector_id !== OWNER_COLLECTOR_CODE &&
          r.collector_id !== JARVIS_REGISTRY_PROFILE.collector_id &&
          ownerRow
        ) {
          vouchedBy = {
            username: ownerRow.username,
            collectorCode: OWNER_COLLECTOR_CODE,
            at: r.created_at,
            source: "backfill",
          };
        }
        const vouchedIn = lineage
          .filter((l) => l.vouchedByCode === r.collector_id)
          .map((l) => ({
            username: l.newUsername,
            collectorCode: l.newCollectorCode,
            at: l.createdAt,
            source: l.source,
          }));
        // Backfilled members count toward the owner's
        // vouched-in list, so a pre-code swarm is visible too.
        if (r.collector_id === OWNER_COLLECTOR_CODE) {
          for (const m of roster) {
            if (
              m.collector_id === OWNER_COLLECTOR_CODE ||
              m.collector_id === JARVIS_REGISTRY_PROFILE.collector_id ||
              witnessed.has(m.collector_id)
            )
              continue;
            vouchedIn.push({
              username: m.username,
              collectorCode: m.collector_id,
              at: m.created_at,
              source: "backfill",
            });
          }
        }
        void rosterCodes;
        return {
          collectorCode: r.collector_id,
          badgeStatus: badge?.status ?? null,
          badgeBasis: badge?.basis ?? null,
          vouchedBy,
          vouchedIn,
        };
      });
      // Collectors in the local ledger who are no longer on
      // the roster still get a row, so nothing witnessed is
      // hidden from the owner.
      for (const l of lineage) {
        if (!users.some((u) => u.collectorCode === l.newCollectorCode)) {
          const badge = badgeByCode.get(l.newCollectorCode) ?? null;
          users.push({
            collectorCode: l.newCollectorCode,
            badgeStatus: badge?.status ?? null,
            badgeBasis: badge?.basis ?? null,
            vouchedBy: {
              username: l.vouchedByUsername,
              collectorCode: l.vouchedByCode,
              at: l.createdAt,
              source: l.source,
            },
            vouchedIn: [],
          });
        }
      }
      return { isOwner: true, users };
    },
  }),

  getForumHome: defineAction({
    description:
      "Forums home (Direction A — Latest-first hybrid, LIVE): thread rows newest-activity first across all categories or within one, with reply counts, author role chips (forum-scoped, badge-gated), verified flags, the reader's unread state, and the pinned threads (at most two) listed separately. Sorts: latest activity, newest threads, top this week (most replies in 7 days). Search matches titles and authors. No view counts exist by design.",
    request: z.object({
      category: z.string().max(24),
      sort: z.enum(["latest", "new", "top"]),
      search: z.string().max(80),
      asTestFriend: z.boolean(),
    }),
    response: z.object({
      threads: z.array(forumThreadView),
      pinned: z.array(forumThreadView),
      myRole: z.enum(["owner", "admin", "moderator"]).nullable(),
      myCode: z.string(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{
      threads: z.infer<typeof forumThreadView>[];
      pinned: z.infer<typeof forumThreadView>[];
      myRole: ForumRole | null;
      myCode: string;
    }> {
      const me = await forumActor(ctx, args.asTestFriend);
      await ensureVerifiedRoots(ctx);
      const db = ctx.db<typeof schema>();
      const [threads, posts, reads, badges] = await Promise.all([
        db.select().from(schema.forumThreads),
        db.select().from(schema.forumPosts),
        db.select().from(schema.forumThreadReads),
        db.select().from(schema.verifiedBadges),
      ]);
      const badgeOk = new Set(
        badges.filter((b) => b.status === "verified").map((b) => b.collectorCode),
      );
      const livePosts = posts.filter((p) => p.deleted === 0);
      const repliesByThread = new Map<number, typeof livePosts>();
      for (const p of livePosts) {
        const list = repliesByThread.get(p.threadId) ?? [];
        list.push(p);
        repliesByThread.set(p.threadId, list);
      }
      const readByThread = new Map(
        reads
          .filter((r) => r.readerCode === me.code)
          .map((r) => [r.threadId, r.lastReadAt]),
      );
      const roleCache = new Map<string, ForumRole | null>();
      const roleOf = async (code: string) => {
        if (!roleCache.has(code))
          roleCache.set(code, await forumRoleFor(ctx, code));
        return roleCache.get(code) ?? null;
      };
      const toView = async (
        t: typeof threads[number],
      ): Promise<z.infer<typeof forumThreadView>> => {
        const replies = (repliesByThread.get(t.id) ?? []).sort(
          (a, b) => a.createdAt - b.createdAt,
        );
        const last = replies[replies.length - 1];
        const readAt = readByThread.get(t.id);
        return {
          id: t.id,
          category: t.category,
          title: t.title,
          authorCode: t.authorCode,
          authorUsername: t.authorUsername,
          authorRole: await roleOf(t.authorCode),
          authorVerified: badgeOk.has(t.authorCode),
          pinned: t.pinned === 1,
          locked: t.locked === 1,
          replyCount: Math.max(0, replies.length - 1),
          createdAt: t.createdAt,
          lastActivityAt: t.lastActivityAt,
          lastPostBy: last ? last.authorUsername : t.authorUsername,
          unread:
            t.authorCode !== me.code &&
            (readAt == null || t.lastActivityAt > readAt),
          mine: t.authorCode === me.code,
        };
      };
      const searching = args.search.trim().toLowerCase();
      let rows = threads.slice();
      if (args.category !== "all")
        rows = rows.filter((t) => t.category === args.category);
      if (searching)
        rows = rows.filter(
          (t) =>
            t.title.toLowerCase().includes(searching) ||
            t.authorUsername.toLowerCase().includes(searching),
        );
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekReplies = (t: typeof threads[number]) =>
        (repliesByThread.get(t.id) ?? []).filter(
          (p) => p.createdAt > weekAgo,
        ).length;
      if (args.sort === "new")
        rows.sort((a, b) => b.createdAt - a.createdAt);
      else if (args.sort === "top")
        rows.sort(
          (a, b) =>
            weekReplies(b) - weekReplies(a) ||
            b.lastActivityAt - a.lastActivityAt,
        );
      else rows.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
      const pinnedRows =
        args.category === "all" && !searching
          ? threads.filter((t) => t.pinned === 1)
          : [];
      const pinnedIds = new Set(pinnedRows.map((t) => t.id));
      return {
        threads: await Promise.all(
          rows.filter((t) => !pinnedIds.has(t.id)).map(toView),
        ),
        pinned: await Promise.all(pinnedRows.map(toView)),
        myRole: await roleOf(me.code),
        myCode: me.code,
      };
    },
  }),

  getForumThread: defineAction({
    description:
      "One forum thread with its flat post list: each post carries its author's forum role chip, verified flag, and confirmed-trades count for the trust strip. Reading a thread records the reader's read marker (their unread state clears).",
    request: z.object({
      threadId: z.number(),
      asTestFriend: z.boolean(),
    }),
    response: z.object({
      thread: forumThreadView.nullable(),
      posts: z.array(forumPostView),
      myRole: z.enum(["owner", "admin", "moderator"]).nullable(),
      myCode: z.string(),
    }),
    async handler(ctx, args) {
      const me = await forumActor(ctx, args.asTestFriend);
      await ensureVerifiedRoots(ctx);
      const db = ctx.db<typeof schema>();
      const tRows = await db
        .select()
        .from(schema.forumThreads)
        .where(eq(schema.forumThreads.id, args.threadId))
        .limit(1);
      const t = tRows[0];
      if (!t) return { thread: null, posts: [], myRole: null, myCode: me.code };
      const postRows = (
        await db
          .select()
          .from(schema.forumPosts)
          .where(eq(schema.forumPosts.threadId, args.threadId))
      )
        .filter((p) => p.deleted === 0)
        .sort((a, b) => a.createdAt - b.createdAt);
      const badges = await db.select().from(schema.verifiedBadges);
      const badgeOk = new Set(
        badges.filter((b) => b.status === "verified").map((b) => b.collectorCode),
      );
      const posts: z.infer<typeof forumPostView>[] = [];
      for (const p of postRows) {
        posts.push({
          id: p.id,
          authorCode: p.authorCode,
          authorUsername: p.authorUsername,
          authorRole: await forumRoleFor(ctx, p.authorCode),
          authorVerified: badgeOk.has(p.authorCode),
          confirmedTrades: await forumConfirmedTrades(ctx, p.authorCode),
          body: p.body,
          createdAt: p.createdAt,
          mine: p.authorCode === me.code,
        });
      }
      // Mark read for the reader.
      const now = Date.now();
      await db
        .insert(schema.forumThreadReads)
        .values({ threadId: t.id, readerCode: me.code, lastReadAt: now })
        .onConflictDoUpdate({
          target: [
            schema.forumThreadReads.threadId,
            schema.forumThreadReads.readerCode,
          ],
          set: { lastReadAt: now },
        });
      const last = postRows[postRows.length - 1];
      return {
        thread: {
          id: t.id,
          category: t.category,
          title: t.title,
          authorCode: t.authorCode,
          authorUsername: t.authorUsername,
          authorRole: await forumRoleFor(ctx, t.authorCode),
          authorVerified: badgeOk.has(t.authorCode),
          pinned: t.pinned === 1,
          locked: t.locked === 1,
          replyCount: Math.max(0, postRows.length - 1),
          createdAt: t.createdAt,
          lastActivityAt: t.lastActivityAt,
          lastPostBy: last ? last.authorUsername : t.authorUsername,
          unread: false,
          mine: t.authorCode === me.code,
        },
        posts,
        myRole: await forumRoleFor(ctx, me.code),
        myCode: me.code,
      };
    },
  }),

  createForumThread: defineAction({
    description:
      "Starts a forum thread in one of the seven categories with the opening post as its first post. Any registered collector can post (roles are only for moderation); locked categories don't exist — locking is per thread.",
    request: z.object({
      category: z.string().max(24),
      title: z.string().trim().min(1).max(140),
      body: z.string().trim().min(1).max(4000),
      asTestFriend: z.boolean(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      threadId: z.number().nullable(),
    }),
    async handler(ctx, args) {
      if (
        !(FORUM_CATEGORIES as readonly string[]).includes(args.category)
      )
        return { ok: false, error: "Pick a category.", threadId: null };
      const me = await forumActor(ctx, args.asTestFriend);
      const db = ctx.db<typeof schema>();
      const now = Date.now();
      const inserted = await db
        .insert(schema.forumThreads)
        .values({
          category: args.category,
          title: args.title,
          authorCode: me.code,
          authorUsername: me.username,
          pinned: 0,
          locked: 0,
          createdAt: now,
          lastActivityAt: now,
        })
        .returning({ id: schema.forumThreads.id });
      const threadId = inserted[0]?.id;
      if (threadId == null)
        return { ok: false, error: "Couldn't post — try again.", threadId: null };
      await db.insert(schema.forumPosts).values({
        threadId,
        authorCode: me.code,
        authorUsername: me.username,
        body: args.body,
        deleted: 0,
        createdAt: now,
      });
      ctx.invalidateQueries();
      return { ok: true, error: null, threadId };
    },
  }),

  createForumPost: defineAction({
    description:
      "Replies to a forum thread (flat posts, oldest first) and bumps the thread's last-activity time. Refused on locked threads (owner/admin excepted) and on threads that don't exist.",
    request: z.object({
      threadId: z.number(),
      body: z.string().trim().min(1).max(4000),
      asTestFriend: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const me = await forumActor(ctx, args.asTestFriend);
      const db = ctx.db<typeof schema>();
      const tRows = await db
        .select()
        .from(schema.forumThreads)
        .where(eq(schema.forumThreads.id, args.threadId))
        .limit(1);
      const t = tRows[0];
      if (!t) return { ok: false, error: "That thread is gone." };
      if (t.locked === 1) {
        const role = await forumRoleFor(ctx, me.code);
        if (role !== "owner" && role !== "admin")
          return { ok: false, error: "This thread is locked." };
      }
      const now = Date.now();
      await db.insert(schema.forumPosts).values({
        threadId: t.id,
        authorCode: me.code,
        authorUsername: me.username,
        body: args.body,
        deleted: 0,
        createdAt: now,
      });
      await db
        .update(schema.forumThreads)
        .set({ lastActivityAt: now })
        .where(eq(schema.forumThreads.id, t.id));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  moderateForumThread: defineAction({
    description:
      "Forum moderation on a thread: pin/unpin (at most TWO pinned threads at a time, enforced here; owner/admin/moderator) and lock/unlock (owner/admin). The moderator's effective role is computed server-side and requires a currently verified badge — an unverified or suspended holder cannot moderate.",
    request: z.object({
      threadId: z.number(),
      action: z.enum(["pin", "unpin", "lock", "unlock"]),
      asTestFriend: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const me = await forumActor(ctx, args.asTestFriend);
      const role = await forumRoleFor(ctx, me.code);
      if (!role)
        return { ok: false, error: "You don't hold a forum role." };
      if (
        (args.action === "lock" || args.action === "unlock") &&
        role !== "owner" &&
        role !== "admin"
      )
        return { ok: false, error: "Only owner/admin can lock a thread." };
      const db = ctx.db<typeof schema>();
      if (args.action === "pin") {
        const pinned = await db
          .select()
          .from(schema.forumThreads)
          .where(eq(schema.forumThreads.pinned, 1));
        if (pinned.length >= 2)
          return {
            ok: false,
            error: "Two threads are already pinned — unpin one first.",
          };
      }
      const set =
        args.action === "pin"
          ? { pinned: 1 }
          : args.action === "unpin"
            ? { pinned: 0 }
            : args.action === "lock"
              ? { locked: 1 }
              : { locked: 0 };
      await db
        .update(schema.forumThreads)
        .set(set)
        .where(eq(schema.forumThreads.id, args.threadId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  deleteForumPost: defineAction({
    description:
      "Removes a forum post: the author can remove their own post; owner/admin can remove any post (moderation). The opening post of a thread can't be removed here (it would orphan the thread). Removal is a soft delete — the row stays for audit, the post stops rendering.",
    request: z.object({ postId: z.number(), asTestFriend: z.boolean() }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const me = await forumActor(ctx, args.asTestFriend);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.id, args.postId))
        .limit(1);
      const post = rows[0];
      if (!post) return { ok: false, error: "That post is gone." };
      const threadPosts = await db
        .select()
        .from(schema.forumPosts)
        .where(eq(schema.forumPosts.threadId, post.threadId));
      const first = threadPosts
        .filter((p) => p.deleted === 0)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (first && first.id === post.id)
        return {
          ok: false,
          error: "The opening post can't be removed.",
        };
      const role = await forumRoleFor(ctx, me.code);
      if (
        post.authorCode !== me.code &&
        role !== "owner" &&
        role !== "admin"
      )
        return { ok: false, error: "That's not your post." };
      await db
        .update(schema.forumPosts)
        .set({ deleted: 1 })
        .where(eq(schema.forumPosts.id, post.id));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  getForumRoles: defineAction({
    description:
      "The forum role roster (Admin/Moderator grants), each with its holder's verified state and whether the role is currently effective (a suspended or unverified holder's role is shown as suspended — it confers nothing until the owner re-grants it against a verified badge).",
    request: z.object({}),
    response: z.object({
      roles: z.array(
        z.object({
          collectorCode: z.string(),
          role: z.string(),
          suspended: z.boolean(),
          verified: z.boolean(),
          effective: z.boolean(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const [rows, badges] = await Promise.all([
        db.select().from(schema.forumRoles),
        db.select().from(schema.verifiedBadges),
      ]);
      const badgeOk = new Set(
        badges.filter((b) => b.status === "verified").map((b) => b.collectorCode),
      );
      return {
        roles: rows.map((r) => ({
          collectorCode: r.collectorCode,
          role: r.role,
          suspended: r.suspended === 1,
          verified: badgeOk.has(r.collectorCode),
          effective: r.suspended !== 1 && badgeOk.has(r.collectorCode),
        })),
      };
    },
  }),

  grantForumRole: defineAction({
    description:
      "OWNER-ONLY forum role grant (Anthony's rule: he alone grants/revokes forum roles, and NO role without a currently verified badge — the grant refuses an unverified target outright). Granting re-activates a suspended role as well. The owner's own Owner role is inherent and never granted here.",
    request: z.object({
      collectorCode: z.string().trim().min(1).max(60),
      role: z.enum(["admin", "moderator"]),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false, error: "Only the owner grants forum roles." };
      if (args.collectorCode === OWNER_COLLECTOR_CODE)
        return {
          ok: false,
          error: "The owner already holds the Owner role.",
        };
      await ensureVerifiedRoots(ctx);
      const badge = await badgeRowFor(ctx, args.collectorCode);
      if (!badge || badge.status !== "verified")
        return {
          ok: false,
          error:
            "Forum roles require a verified badge — that collector isn't verified.",
        };
      const db = ctx.db<typeof schema>();
      await db
        .insert(schema.forumRoles)
        .values({
          collectorCode: args.collectorCode,
          role: args.role,
          grantedBy: profile.collectorCode,
          grantedAt: Date.now(),
          suspended: 0,
        })
        .onConflictDoUpdate({
          target: schema.forumRoles.collectorCode,
          set: {
            role: args.role,
            grantedBy: profile.collectorCode,
            grantedAt: Date.now(),
            suspended: 0,
          },
        });
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  revokeForumRole: defineAction({
    description:
      "OWNER-ONLY forum role revocation: removes the holder's forum role entirely (distinct from a badge-revocation suspension, which keeps the row dormant).",
    request: z.object({
      collectorCode: z.string().trim().min(1).max(60),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false, error: "Only the owner revokes forum roles." };
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.forumRoles)
        .where(eq(schema.forumRoles.collectorCode, args.collectorCode));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  getPendingListingPhotos: defineAction({
    description:
      "OWNER-ONLY photo review queue (Anthony, Nov 4, 2026): every accessory-listing photo still waiting on his approval, with the listing's title, category, price, and seller — the listings themselves are already live; only these photos are gated. Presented one by one in Admin's 'Photos needed for approval' review screen.",
    request: z.object({}),
    response: z.object({
      isOwner: z.boolean(),
      pending: z.array(
        z.object({
          listingId: z.number(),
          title: z.string(),
          category: z.string().nullable(),
          price: z.number(),
          sellerUsername: z.string(),
          sellerCode: z.string(),
          photoUrl: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { isOwner: false, pending: [] };
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.photoStatus, "pending"));
      const pending = await Promise.all(
        rows
          .filter((r) => r.kind === "other" && r.photoBlobKey)
          .map(async (r) => ({
            listingId: r.id,
            title: r.name,
            category: r.category,
            price: r.askingPrice,
            sellerUsername: r.sellerUsername,
            sellerCode: r.sellerCode,
            photoUrl: r.photoBlobKey
              ? await ctx.blobs.getUrl(r.photoBlobKey).catch(() => null)
              : null,
            createdAt: r.createdAt,
          })),
      );
      return { isOwner: true, pending };
    },
  }),

  reviewListingPhoto: defineAction({
    description:
      "OWNER-ONLY photo review decision for an accessory listing: approve makes the photo visible on the already-live listing; reject means the photo never displays (the seller sees it marked not approved and may upload a replacement, which re-enters the queue as pending).",
    request: z.object({
      listingId: z.number(),
      decision: z.enum(["approved", "rejected"]),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (profile.collectorCode !== OWNER_COLLECTOR_CODE)
        return { ok: false, error: "Only the owner reviews photos." };
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, args.listingId))
        .limit(1);
      const row = rows[0];
      if (!row || row.kind !== "other" || !row.photoBlobKey)
        return { ok: false, error: "That listing has no photo to review." };
      await db
        .update(schema.marketplaceListings)
        .set({ photoStatus: args.decision, updatedAt: new Date().toISOString() })
        .where(eq(schema.marketplaceListings.id, args.listingId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  replaceListingPhoto: defineAction({
    description:
      "Seller replaces the photo on their own accessory listing (after a rejection, or to fix a bad shot): the new photo goes back into the owner's review queue as pending — the listing stays live throughout, other users keep seeing the placeholder until the replacement is approved.",
    request: z.object({
      listingId: z.number(),
      photoBase64: z.string().min(100).max(9_000_000),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.marketplaceListings)
        .where(eq(schema.marketplaceListings.id, args.listingId))
        .limit(1);
      const row = rows[0];
      if (!row || row.kind !== "other")
        return { ok: false, error: "That listing takes no photo." };
      if (row.sellerCode !== profile.collectorCode)
        return { ok: false, error: "That's not your listing." };
      const key = `marketplace-photos/${profile.collectorCode}-${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(args.photoBase64), (c) =>
        c.charCodeAt(0),
      );
      await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
      await db
        .update(schema.marketplaceListings)
        .set({
          photoBlobKey: key,
          photoStatus: "pending",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.marketplaceListings.id, args.listingId));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  getArtworkDownloadQuote: defineAction({
    description:
      "Sizes the pending artwork download for the intro-screen download choice (Anthony, Nov 4, 2026): given the card ids this device still needs, samples up to 60 of them evenly and measures the server's stored artwork for the sample, returning the average bytes per image so the client can quote the pending total honestly (and count progress against that same figure). avgBytes is null when the server holds no measurable sample, so the client falls back to a count-only quote instead of inventing a size. Since the Nov 10, 2026 compression pass the measured average is the full SCAN's size: the client converts it into the compressed on-device total with its measured per-tier ratios (the copies actually stored are right-sized — about 0.15 of scan size for grid copies, 0.43 for two-across), so the quoted figure is what will sit on the device, not the scans' raw size (the pre-compression quote read 1,805 MB).",
    request: z.object({
      pendingIds: z.array(z.number().int().positive()).max(20000),
    }),
    response: z.object({
      avgBytes: z.number().nullable(),
      sampled: z.number(),
      measured: z.number(),
    }),
    async handler(ctx, args) {
      const ids = args.pendingIds;
      if (ids.length === 0) {
        return { avgBytes: null, sampled: 0, measured: 0 };
      }
      const SAMPLE = 60;
      const step = Math.max(1, Math.floor(ids.length / SAMPLE));
      const picks: number[] = [];
      for (let i = 0; i < ids.length && picks.length < SAMPLE; i += step) {
        const id = ids[i];
        if (id != null) picks.push(id);
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({
          id: schema.cards.id,
          imageBlobKey: schema.cards.imageBlobKey,
        })
        .from(schema.cards)
        .where(inArray(schema.cards.id, picks));
      let totalBytes = 0;
      let measured = 0;
      for (const row of rows) {
        if (!row.imageBlobKey) continue;
        const meta = await ctx.blobs.head(row.imageBlobKey);
        if (meta && meta.size > 0) {
          totalBytes += meta.size;
          measured += 1;
        }
      }
      return {
        avgBytes: measured > 0 ? Math.round(totalBytes / measured) : null,
        sampled: picks.length,
        measured,
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

  getGameCardCost: defineAction({
    description:
      "Returns the recorded per-copy cost (what the collector paid) for one game-catalog item, or null when no cost has been recorded for it.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ paidValue: z.number().nullable() }),
    handler: async (ctx, args) => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ paidValue: schema.gameCards.paidValue })
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id))
        .limit(1);
      return { paidValue: rows[0]?.paidValue ?? null };
    },
  }),

  setGameCardCost: defineAction({
    description:
      "Records (or clears, with null) the per-copy cost the collector paid for one game-catalog item — the Money Tracker's cost basis for Pokémon, Magic, Star Wars, Funko, Lego, and Topps items, editable from the item's own page.",
    request: z.object({
      id: z.number().int().positive(),
      paidValue: z.number().min(0).max(1000000).nullable(),
    }),
    response: gameCardCostResponse,
    handler: async (ctx, args): Promise<z.infer<typeof gameCardCostResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.gameCards)
        .set({ paidValue: args.paidValue })
        .where(eq(schema.gameCards.id, args.id));
      return { ok: true, paidValue: args.paidValue };
    },
  }),

  getMoneyTracker: defineAction({
    description:
      "Money Tracker (Nov 5, 2026): the collection's cost basis vs current value — totals and per-category value, known cost, unrealised profit/loss and ROI computed ONLY over copies whose cost is actually recorded (unknown cost stays unknown, never estimated) — plus the Sold ledger: settled cash sales and completed trades out of the owner's collection, fed by the trade/marketplace settlement records, with realised profit/loss where the cost basis is known.",
    request: z.object({}),
    response: moneyTrackerResponse,
    handler: async (ctx): Promise<z.infer<typeof moneyTrackerResponse>> => {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      type CatAcc = {
        key: string;
        label: string;
        value: number;
        costKnown: number;
        valueKnown: number;
        copies: number;
        knownCopies: number;
      };
      const cats = new Map<string, CatAcc>();
      const cat = (key: string, label: string): CatAcc => {
        let c = cats.get(key);
        if (!c) {
          c = { key, label, value: 0, costKnown: 0, valueKnown: 0, copies: 0, knownCopies: 0 };
          cats.set(key, c);
        }
        return c;
      };
      const addCopy = (
        c: CatAcc,
        qty: number,
        unitValue: number | null,
        unitPaid: number | null,
      ) => {
        if (qty <= 0) return;
        c.copies += qty;
        if (unitValue != null) c.value += unitValue * qty;
        if (unitPaid != null) {
          c.knownCopies += qty;
          c.costKnown += unitPaid * qty;
          if (unitValue != null) c.valueKnown += unitValue * qty;
        }
      };

      // Lorcana cards — per finish, from the recorded export
      // finance (paid stays as recorded, never re-priced).
      const lorcana = cat("lorcana", "Lorcana cards");
      const cardRows = await db.select().from(schema.cards);
      const cardById = new Map(cardRows.map((r) => [r.id, r]));
      for (const row of cardRows) {
        if (row.ownedQty <= 0) continue;
        const finishes = parseFinishes(row.finishes);
        const prices = parseFinance(row.financeJson);
        const entries = Object.entries(finishes).filter(([, q]) => q > 0);
        if (entries.length === 0) {
          addCopy(lorcana, row.ownedQty, row.marketValue, row.paidValue);
        } else {
          for (const [finish, qty] of entries) {
            addCopy(
              lorcana,
              qty,
              prices[finish]?.value ?? row.marketValue,
              prices[finish]?.paid ?? row.paidValue,
            );
          }
        }
      }

      // Sealed products — export paid per unit, as recorded.
      const sealedCat = cat("sealed", "Sealed products");
      const eff = await effectiveSealed(ctx);
      for (const item of eff.items) {
        if (item.qty <= 0) continue;
        addCopy(
          sealedCat,
          item.qty,
          item.unitValue,
          item.qty > 0 ? item.paid / item.qty : null,
        );
      }

      // Game catalogs (Pokémon, Magic, Star Wars, Funko, Lego,
      // Topps family) — value from the catalog price; cost only
      // where the collector recorded it on the item's page.
      // Lego exception: a set's cost basis already lives in
      // lego_ownership_notes (the Your copy record, Nov 4), so
      // that record wins where it exists — the tracker counts
      // what he actually logged there, never a second field.
      const gameCat = cat("games", "Pokémon, Magic, Star Wars, Funko, Lego & Topps");
      const legoNoteRows = await db
        .select()
        .from(schema.legoOwnershipNotes);
      const legoPaidById = new Map(
        legoNoteRows.map((n) => [n.gameCardId, n.paidPriceUsd]),
      );
      const gameRows = await db.select().from(schema.gameCards);
      for (const g of gameRows) {
        const qty = g.ownedQty + g.ownedSealedQty;
        if (qty <= 0) continue;
        addCopy(
          gameCat,
          qty,
          g.price,
          g.game === "lego"
            ? (legoPaidById.get(g.id) ?? g.paidValue)
            : g.paidValue,
        );
      }

      // Graded slabs from cert scans — paid where recorded;
      // slab market value is not tracked anywhere in the app,
      // so slabs add cost and copies but no value figure.
      const slabCat = cat("slabs", "Graded slabs (cert scans)");
      const slabRows = await db.select().from(schema.gradedSlabs);
      for (const s of slabRows) {
        if (s.qty <= 0) continue;
        slabCat.copies += s.qty;
        if (s.paid != null) {
          slabCat.knownCopies += s.qty;
          slabCat.costKnown += s.paid * s.qty;
        }
      }

      // Graded comics — checked values (Oct 29, 2026) from the
      // in-app catalog mirror; no paid amounts were ever
      // recorded for them, so their cost is honestly unknown.
      const comicCat = cat("comics", "Graded comics");
      for (const c of COMIC_ALERT_CATALOG) {
        comicCat.copies += 1;
        comicCat.value += c.value;
      }

      const categories = [...cats.values()]
        .filter((c) => c.copies > 0 || c.value > 0)
        .map((c) => ({
          key: c.key,
          label: c.label,
          value: r2(c.value),
          costKnown: r2(c.costKnown),
          valueKnown: r2(c.valueKnown),
          copies: c.copies,
          knownCopies: c.knownCopies,
        }));
      const value = r2(categories.reduce((s, c) => s + c.value, 0));
      const costKnown = r2(categories.reduce((s, c) => s + c.costKnown, 0));
      const valueKnown = r2(categories.reduce((s, c) => s + c.valueKnown, 0));
      const unrealised = r2(valueKnown - costKnown);

      // Sold ledger — settled cash sales where the owner was
      // the seller, and settled trades where the owner gave
      // items away. Both feed from the settlement records the
      // trade/marketplace flows already write on completion.
      const soldRows: z.infer<typeof moneyTrackerResponse>["sold"]["rows"] = [];
      let proceeds = 0;
      let realisedKnown = 0;
      let realisedCostKnown = 0;
      let salesCount = 0;
      const sales = await db
        .select()
        .from(schema.cashPurchases)
        .where(
          and(
            eq(schema.cashPurchases.sellerCode, me),
            isNotNull(schema.cashPurchases.settledAt),
          ),
        );
      for (const s of sales) {
        salesCount += 1;
        const total = r2(s.unitPrice * s.qty);
        proceeds += total;
        const card = cardById.get(s.cardId);
        let cost: number | null = null;
        if (card) {
          const prices = parseFinance(card.financeJson);
          const unit = prices[s.finish]?.paid ?? card.paidValue;
          if (unit != null) cost = r2(unit * s.qty);
        }
        if (cost != null) {
          realisedKnown += total - cost;
          realisedCostKnown += cost;
        }
        soldRows.push({
          kind: "sale",
          date: s.completedAt ?? s.settledAt,
          title: s.name,
          detail: `${s.groupName}${s.printed ? ` · #${s.printed}` : ""} · ${s.finish} · ×${s.qty}`,
          counterparty: s.buyerUsername,
          qty: s.qty,
          proceeds: total,
          cost,
          realised: cost != null ? r2(total - cost) : null,
          gave: [],
          got: [],
        });
      }
      let tradesCount = 0;
      const trades = await db
        .select()
        .from(schema.tradeOffers)
        .where(isNotNull(schema.tradeOffers.settledAt));
      const fmtTradeItem = (t: {
        name: string;
        printed?: string | null;
        finish: string;
        qty: number;
      }) =>
        `${t.name}${t.printed ? ` #${t.printed}` : ""} · ${t.finish} · ×${t.qty}`;
      for (const t of trades) {
        const iAmProposer = t.proposerCode === me;
        if (!iAmProposer && t.partnerCode !== me) continue;
        tradesCount += 1;
        const gave = parseTradeItems(iAmProposer ? t.giveJson : t.getJson);
        const got = parseTradeItems(iAmProposer ? t.getJson : t.giveJson);
        soldRows.push({
          kind: "trade",
          date: t.completedAt ?? t.settledAt,
          title:
            gave.length > 0
              ? `${gave[0]!.name}${gave.length > 1 ? ` +${gave.length - 1} more` : ""}`
              : "Trade",
          detail: `Traded with ${iAmProposer ? t.partnerUsername : t.proposerUsername}`,
          counterparty: iAmProposer ? t.partnerUsername : t.proposerUsername,
          qty: gave.reduce((s, g) => s + g.qty, 0),
          proceeds: null,
          cost: null,
          realised: null,
          gave: gave.map(fmtTradeItem),
          got: got.map(fmtTradeItem),
        });
      }
      soldRows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

      return {
        asOf: new Date().toISOString(),
        value,
        costKnown,
        valueKnown,
        unrealised,
        roiPct: costKnown > 0 ? r2((unrealised / costKnown) * 100) : null,
        copies: categories.reduce((s, c) => s + c.copies, 0),
        knownCopies: categories.reduce((s, c) => s + c.knownCopies, 0),
        categories,
        sold: {
          rows: soldRows,
          proceeds: r2(proceeds),
          realisedKnown: r2(realisedKnown),
          realisedCostKnown: r2(realisedCostKnown),
          salesCount,
          tradesCount,
        },
      };
    },
  }),

  getInsuranceReport: defineAction({
    description:
      "Insurance & Estate report data (Nov 5, 2026): every owned item across Lorcana cards (per finish), sealed products, all game catalogs, and graded slabs — with quantity, unit paid (null when never recorded), unit current value (null where no value is tracked), identification lines, and the item's Where-it-lives storage string — plus the owner's name/Collector ID for the cover and the graded-comics storage locations (comic rows themselves live in the client catalog). The client assembles the downloadable PDF from this.",
    request: z.object({}),
    response: insuranceReportResponse,
    handler: async (ctx): Promise<z.infer<typeof insuranceReportResponse>> => {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const locRows = await db.select().from(schema.itemLocations);
      const LOC_LABELS: Record<string, string> = {
        binder: "Binder",
        deck_box: "Deck box",
        trade_box: "Trade box",
        bulk_box: "Bulk box",
        other: "",
      };
      const locString = (
        rows: { locType: string; place: string; spot: string | null; qty: number }[],
      ): string | null => {
        if (rows.length === 0) return null;
        return rows
          .map((r) => {
            const label = LOC_LABELS[r.locType] ?? "";
            const head = label ? `${label} · ${r.place}` : r.place;
            const spot = r.spot ? ` · ${r.spot}` : "";
            const qty = r.qty !== 1 || rows.length > 1 ? ` (×${r.qty})` : "";
            return `${head}${spot}${qty}`;
          })
          .join("; ");
      };
      const byCard = new Map<number, typeof locRows>();
      const bySealed = new Map<string, typeof locRows>();
      const byGame = new Map<number, typeof locRows>();
      const comicLocations: Record<string, string> = {};
      for (const r of locRows) {
        if (r.targetKind === "card" && r.cardId != null) {
          byCard.set(r.cardId, [...(byCard.get(r.cardId) ?? []), r]);
        } else if (r.targetKind === "sealed" && r.sealedName != null) {
          bySealed.set(r.sealedName, [...(bySealed.get(r.sealedName) ?? []), r]);
        } else if (r.targetKind === "game" && r.gameCardId != null) {
          byGame.set(r.gameCardId, [...(byGame.get(r.gameCardId) ?? []), r]);
        } else if (r.targetKind === "comic" && r.comicId != null) {
          const prev = comicLocations[r.comicId];
          const s = locString([r]);
          if (s) comicLocations[r.comicId] = prev ? `${prev}; ${s}` : s;
        }
      }

      type Row = z.infer<typeof insuranceReportResponse>["rows"][number];
      const rows: Row[] = [];

      const cardRows = await db.select().from(schema.cards);
      for (const row of cardRows) {
        if (row.ownedQty <= 0) continue;
        const finishes = parseFinishes(row.finishes);
        const prices = parseFinance(row.financeJson);
        const entries = Object.entries(finishes).filter(([, q]) => q > 0);
        const loc = locString(byCard.get(row.id) ?? []);
        if (entries.length === 0) {
          rows.push({
            category: "Lorcana cards",
            name: row.fullName,
            idLine: `#${row.printed} · Regular`,
            detail: row.groupName,
            qty: row.ownedQty,
            unitValue: row.marketValue,
            unitPaid: row.paidValue,
            location: loc,
            artCardId: row.id,
            imageUrl: null,
          });
        } else {
          for (const [finish, qty] of entries) {
            rows.push({
              category: "Lorcana cards",
              name: row.fullName,
              idLine: `#${row.printed} · ${finish}`,
              detail: row.groupName,
              qty,
              unitValue: prices[finish]?.value ?? row.marketValue,
              unitPaid: prices[finish]?.paid ?? row.paidValue,
              location: loc,
              artCardId: row.id,
              imageUrl: null,
            });
          }
        }
      }

      const eff = await effectiveSealed(ctx);
      for (const item of eff.items) {
        if (item.qty <= 0) continue;
        rows.push({
          category: "Sealed products",
          name: item.name,
          idLine: "Sealed",
          detail: item.setName,
          qty: item.qty,
          unitValue: item.unitValue,
          unitPaid: item.qty > 0 ? Math.round((item.paid / item.qty) * 100) / 100 : null,
          location: locString(bySealed.get(item.name) ?? []),
          artCardId: null,
          imageUrl: null,
        });
      }

      const GAME_LABELS: Record<string, string> = {
        pokemon: "Pokémon",
        magic: "Magic: The Gathering",
        starwars: "Star Wars: Unlimited",
        funko: "Funko Pop!",
        lego: "Lego",
        topps: "Topps Baseball",
        "topps-basketball": "Topps Basketball",
        bowman: "Bowman Baseball",
        "disney-topps": "Disney Topps",
        "starwars-topps": "Star Wars Topps",
        gpk: "Garbage Pail Kids",
        "wwe-topps": "WWE Topps",
      };
      const legoNoteRows = await db
        .select()
        .from(schema.legoOwnershipNotes);
      const legoPaidById = new Map(
        legoNoteRows.map((n) => [n.gameCardId, n.paidPriceUsd]),
      );
      const gameRows = await db.select().from(schema.gameCards);
      const gameById = new Map(gameRows.map((g) => [g.id, g]));
      for (const g of gameRows) {
        const qty = g.ownedQty + g.ownedSealedQty;
        if (qty <= 0) continue;
        rows.push({
          category: GAME_LABELS[g.game] ?? g.game,
          name: g.name,
          idLine: `#${g.printed}${g.finish ? ` · ${g.finish}` : ""}${g.ownedSealedQty > 0 ? ` · ${g.ownedSealedQty} sealed` : ""}`,
          detail: g.sectionName,
          qty,
          unitValue: g.price,
          // Lego's cost basis is its Your copy record
          // (lego_ownership_notes) where one exists.
          unitPaid:
            g.game === "lego"
              ? (legoPaidById.get(g.id) ?? g.paidValue)
              : g.paidValue,
          location: locString(byGame.get(g.id) ?? []),
          artCardId: null,
          imageUrl: g.imageUrl,
        });
      }

      const slabRows = await db.select().from(schema.gradedSlabs);
      for (const s of slabRows) {
        if (s.qty <= 0) continue;
        const g = gameById.get(s.gameCardId);
        rows.push({
          category: "Graded slabs",
          name: g ? g.name : "Graded card",
          idLine: `${s.company} ${s.grade} · Cert ${s.cert}`,
          detail: g ? `${g.sectionName} · #${g.printed}` : "",
          qty: s.qty,
          unitValue: null,
          unitPaid: s.paid,
          location: locString(byGame.get(s.gameCardId) ?? []),
          artCardId: null,
          imageUrl: g?.imageUrl ?? null,
        });
      }

      const catOrder = (c: string) =>
        c === "Lorcana cards"
          ? 0
          : c === "Sealed products"
            ? 1
            : c === "Graded slabs"
              ? 98
              : 50;
      rows.sort(
        (a, b) =>
          catOrder(a.category) - catOrder(b.category) ||
          a.category.localeCompare(b.category) ||
          a.name.localeCompare(b.name) ||
          a.idLine.localeCompare(b.idLine),
      );
      return {
        generatedAt: new Date().toISOString(),
        username: profile.username,
        collectorCode: profile.collectorCode,
        rows,
        comicLocations,
      };
    },
  }),

  syncCollectionBackup: defineAction({
    description:
      "Full cloud backup sync: writes the signed-in collector's entire collection (Lorcana cards in every finish, sealed products, graded comics, every other game's owned items including Lego sealed copies, and graded slab records, with quantities) to the Vault X Supabase project's collection_items table under their collector code, removes server rows that no longer exist locally, and verifies by reading the rows back. Also refreshes the collector's own row in the server profiles registry. This is the full check the Nov 9, 2026 backup habit runs about 30 seconds after changes finish, when the app closes, and from the daily safety check.",
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
      "Compares the local collection against the cloud backup on Supabase (row counts and copy counts for the signed-in collector) so Settings can show whether the backup is in sync, and reports the backup bookkeeping: when the last collection change was recorded, when the last full sync completed, when the daily check last ran, and whether a full check is still owed.",
    request: z.object({}),
    response: backupStatusResponse,
    async handler(ctx): Promise<z.infer<typeof backupStatusResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const local = await buildLocalCloudItems(
        ctx,
        profile.collectorCode,
      );
      const localCopies = local.reduce((s, r) => s + r.qty, 0);
      const meta = await readBackupMeta(ctx);
      const stamps = {
        lastChangeAt: meta?.lastChangeAt ?? null,
        lastFullSyncAt: meta?.lastFullSyncAt ?? null,
        lastDailyCheckAt: meta?.lastDailyCheckAt ?? null,
        needsFullCheck: backupNeedsFullCheck(meta),
      };
      const remoteAll = await fetchCloudItems(profile.collectorCode);
      // Journal backup rows share the table but are not
      // collection items; the in-sync comparison is about the
      // collection only.
      const remote =
        remoteAll == null
          ? null
          : remoteAll.filter((r) => r.kind !== "journal");
      if (remote == null) {
        return {
          reachable: false,
          localItems: local.length,
          localCopies,
          cloudItems: 0,
          cloudCopies: 0,
          inSync: false,
          ...stamps,
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
        ...stamps,
      };
    },
  }),

  dailyBackupCheck: defineAction({
    description:
      "The daily safety check of the Nov 9, 2026 backup habit (Anthony approved: back up on every change, a batched full check ~30 seconds after changes finish, a sync when the app closes, and one daily check): records that the check ran, and runs a full cloud sync whenever a recorded collection change is newer than the last completed full sync or the last full sync is over a day old — so a per-change push that ever failed is healed within a day even if the app was never reopened. A check that finds nothing owed does not rewrite the cloud.",
    request: z.object({}),
    response: dailyBackupCheckResponse,
    async handler(
      ctx,
    ): Promise<z.infer<typeof dailyBackupCheckResponse>> {
      const checkedAt = new Date().toISOString();
      const meta = await readBackupMeta(ctx);
      const lastSyncMs = meta?.lastFullSyncAt
        ? Date.parse(meta.lastFullSyncAt)
        : NaN;
      const syncStale =
        !Number.isFinite(lastSyncMs) ||
        Date.now() - lastSyncMs > 23 * 60 * 60 * 1000;
      const owed = backupNeedsFullCheck(meta) || syncStale;
      await writeBackupMeta(ctx, { lastDailyCheckAt: checkedAt });
      if (!owed) {
        return {
          checkedAt,
          synced: false,
          reachable: true,
          items: meta?.lastSyncItems ?? 0,
          copies: meta?.lastSyncCopies ?? 0,
        };
      }
      const result = await fullCloudSync(ctx);
      if (result == null) {
        return {
          checkedAt,
          synced: false,
          reachable: false,
          items: 0,
          copies: 0,
        };
      }
      return {
        checkedAt,
        synced: true,
        reachable: true,
        items: result.items,
        copies: result.copies,
      };
    },
  }),

  restoreCollectionFromCloud: defineAction({
    description:
      "Restore direction of the cloud backup: when the local collection has no owned items (fresh device/sign-in), loads the collector's backed-up items from Supabase collection_items back into the local binder (Lorcana card finishes, sealed quantities, other games' owned/sealed counts, and graded slab records). Does nothing when local data already exists, so a restore can never overwrite a live collection.",
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
      const sceneByUid = new Map<string, Record<string, number>>();
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
          // Scene-tally rows carry the __scene__ marker in the
          // finish segment: they restore into scene_finishes,
          // never into the pocket finishes.
          if (finish.startsWith(CLOUD_SCENE_PREFIX)) {
            const sceneFinish = finish.slice(CLOUD_SCENE_PREFIX.length);
            if (!sceneFinish) continue;
            const entry = sceneByUid.get(uid) ?? {};
            entry[sceneFinish] = row.qty;
            sceneByUid.set(uid, entry);
            cardsApplied += 1;
            continue;
          }
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
        } else if (
          row.kind === "game" &&
          row.item_key.startsWith("game:")
        ) {
          // Other-games rows (Nov 9, 2026): key game:{id} for
          // opened copies, game:{id}:sealed for sealed copies.
          // Applied only onto a catalog row that owns nothing —
          // restore fills gaps, it never overwrites.
          const meta = row.meta ?? {};
          const gameCardId =
            typeof meta.gameCardId === "number" ? meta.gameCardId : null;
          if (gameCardId == null || row.qty <= 0) continue;
          const cardRows = await db
            .select()
            .from(schema.gameCards)
            .where(eq(schema.gameCards.id, gameCardId));
          const card = cardRows[0];
          if (!card) continue;
          if (row.item_key.endsWith(":sealed")) {
            if (card.ownedSealedQty > 0) continue;
            await db
              .update(schema.gameCards)
              .set({ ownedSealedQty: row.qty })
              .where(eq(schema.gameCards.id, gameCardId));
          } else {
            if (card.ownedQty > 0) continue;
            await db
              .update(schema.gameCards)
              .set({ ownedQty: row.qty })
              .where(eq(schema.gameCards.id, gameCardId));
          }
          cardsApplied += 1;
        } else if (
          row.kind === "slab" &&
          row.item_key.startsWith("slab:")
        ) {
          // Graded slab records (Nov 9, 2026): re-created from
          // their backed-up meta when no slab with that
          // company+cert exists locally. The slab's copies are
          // already counted in the item's game row above, so
          // ownedQty is NOT stepped again here.
          const meta = row.meta ?? {};
          const company =
            typeof meta.company === "string" ? meta.company : null;
          const cert = typeof meta.cert === "string" ? meta.cert : null;
          const grade =
            typeof meta.grade === "string" ? meta.grade : null;
          const gameCardId =
            typeof meta.gameCardId === "number" ? meta.gameCardId : null;
          if (!company || !cert || !grade || gameCardId == null) {
            continue;
          }
          const existing = await db
            .select()
            .from(schema.gradedSlabs)
            .where(
              and(
                eq(schema.gradedSlabs.company, company),
                eq(schema.gradedSlabs.cert, cert),
              ),
            );
          if (existing.length > 0) continue;
          await db.insert(schema.gradedSlabs).values({
            gameCardId,
            company,
            cert,
            grade,
            paid: typeof meta.paid === "number" ? meta.paid : null,
            qty: row.qty > 0 ? row.qty : 1,
            createdAt: Date.now(),
          });
          cardsApplied += 1;
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
      for (const [uid, scene] of sceneByUid) {
        await db
          .update(schema.cards)
          .set({ sceneFinishes: JSON.stringify(scene) })
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
      kind: z.enum(["all", "card", "sealed", "comic", "other"]),
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
      let listings = await listingViewsWithPhotos(
        ctx,
        rows.filter((r) => r.status === "available" || r.status === "pending"),
        profile.collectorCode,
        view,
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
      const listings = (
        await listingViewsWithPhotos(
          ctx,
          rows.filter(
            (r) =>
              r.sellerCode === profile.collectorCode && r.status !== "removed",
          ),
          profile.collectorCode,
          view,
        )
      ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      return {
        listings,
        groups: [...new Set(listings.map((l) => l.groupName))].sort(),
        gate,
      };
    },
  }),

  getSellerShop: defineAction({
    description:
      "One seller's shop inside the Marketplace: their live listings (available and sale pending, newest first) plus their confirmed-sales count — completed deals where both sides confirmed, the verified events their Trust Score is built from. Every collector has a shop automatically; no setup step exists.",
    request: z.object({ sellerCode: z.string().max(40) }),
    response: marketplaceShopResponse,
    async handler(
      ctx,
      args,
    ): Promise<z.infer<typeof marketplaceShopResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.marketplaceListings);
      const view = await listingViewContext(ctx);
      const sellerRows = rows.filter(
        (r) => r.sellerCode === args.sellerCode,
      );
      const username =
        sellerRows[0]?.sellerUsername ??
        (args.sellerCode === JARVIS_REGISTRY_PROFILE.collector_id
          ? JARVIS_REGISTRY_PROFILE.username
          : args.sellerCode === profile.collectorCode
            ? profile.username
            : args.sellerCode);
      const listings = (
        await listingViewsWithPhotos(
          ctx,
          sellerRows.filter(
            (r) => r.status === "available" || r.status === "pending",
          ),
          profile.collectorCode,
          view,
        )
      ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const offers = await db.select().from(schema.marketplaceOffers);
      const sellerListingIds = new Set(sellerRows.map((r) => r.id));
      const confirmedSales = offers.filter(
        (o) =>
          sellerListingIds.has(o.listingId) &&
          o.status === "accepted" &&
          o.completedAt != null,
      ).length;
      const gate = await marketplaceGateFor(ctx, profile.collectorCode);
      return {
        sellerCode: args.sellerCode,
        sellerUsername: username,
        sellerIsTest: TEST_COLLECTOR_CODES.has(args.sellerCode),
        mine: args.sellerCode === profile.collectorCode,
        confirmedSales,
        listingsLive: listings.length,
        listings,
        gate,
      };
    },
  }),

  createListing: defineAction({
    description:
      "Publishes a marketplace listing from Anthony's own collection: a binder card in a finish he owns (quantity checked against the binder, minus what he already has listed), a sealed product he owns, or one of his graded comics (display fields come from the comics catalog in the client). Blocked while a finished deal awaits his feedback.",
    request: z.object({
      kind: z.enum(["card", "sealed", "comic", "other"]),
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
      /** "Allow offers" opt-in; the client defaults it off —
          fixed price is the default way a listing sells. */
      allowOffers: z.boolean(),
      /** Accessory ("other") listings only: seller-written
          title/description, the preset category, and the
          REQUIRED photo of the actual item (JPEG base64 from
          the client file picker). The photo starts "pending"
          — the listing is live immediately, but other users
          see a placeholder until the owner approves the
          photo in Admin. */
      otherTitle: z.string().max(120),
      otherDescription: z.string().max(1200),
      otherCategory: z.string().max(60),
      photoBase64: z.string().max(9_000_000).nullable(),
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
      // Verified-only selling (Anthony's Marketplace rule,
      // Nov 4, 2026): only a collector holding the verified
      // badge may post a listing. Enforced here, server-side
      // — the badge ledger is the single source, the same one
      // forum roles will read.
      await ensureVerifiedRoots(ctx);
      const sellerBadge = await badgeRowFor(ctx, profile.collectorCode);
      if (!sellerBadge || sellerBadge.status !== "verified")
        return fail(
          "Selling on the Marketplace is for verified collectors — earn the verified badge first (a completed trade with a verified collector, both sides confirmed).",
        );
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
        description?: string | null;
        category?: string | null;
        photoBlobKey?: string | null;
        photoStatus?: string | null;
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
      } else if (args.kind === "other") {
        // Accessory listing (Anthony, Nov 4, 2026): free-form,
        // NOT tied to any collection inventory — no counts are
        // checked or changed, and there is NO market value
        // (nothing tracks these; a comp is never invented).
        // A photo of the actual item is required; it starts
        // pending the owner's approval while the listing
        // itself goes live immediately.
        const ACCESSORY_CATEGORIES = [
          "Oversized cards",
          "Playmats",
          "Lore counters",
          "Flags & banners",
          "Pins",
          "Deck boxes & storage",
          "Other accessories",
        ];
        const title = args.otherTitle.trim();
        if (!title) return fail("Give the item a title first.");
        if (!ACCESSORY_CATEGORIES.includes(args.otherCategory))
          return fail("Pick a category for the item.");
        if (!args.photoBase64 || args.photoBase64.length < 100)
          return fail(
            "Accessory listings need a photo of the actual item.",
          );
        const key = `marketplace-photos/${profile.collectorCode}-${Date.now()}.jpg`;
        const bytes = Uint8Array.from(atob(args.photoBase64), (c) =>
          c.charCodeAt(0),
        );
        await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
        fields = {
          cardId: null,
          sealedName: null,
          comicId: null,
          name: title,
          groupName: args.otherCategory,
          finish: "Accessory",
          marketValue: null,
          description: args.otherDescription.trim() || null,
          category: args.otherCategory,
          photoBlobKey: key,
          photoStatus: "pending",
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
          allowOffers: args.allowOffers ? 1 : 0,
          marketValue: fields.marketValue,
          description: fields.description ?? null,
          category: fields.category ?? null,
          photoBlobKey: fields.photoBlobKey ?? null,
          photoStatus: fields.photoStatus ?? null,
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
      "Manages one of Anthony's own listings: edit the asking price (only while it's available), flip the per-listing Allow offers switch (only while it's available), mark it sold outside a marketplace deal, relist a sold item, or remove it. A listing with a deal in progress can't be edited or removed — the deal owns its state.",
    request: z.object({
      listingId: z.number(),
      askingPrice: z.number().positive().max(1000000).nullable(),
      allowOffers: z.boolean().nullable(),
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
      if (args.allowOffers != null) {
        if (listing.status !== "available")
          return fail("Offers can only be changed while the listing is available.");
        await db
          .update(schema.marketplaceListings)
          .set({
            allowOffers: args.allowOffers ? 1 : 0,
            updatedAt: now,
          })
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
      if (listing.allowOffers !== 1)
        return fail(
          "This seller isn't taking offers on this listing — the asking price is the price. Buy Now claims it.",
        );
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
      // If this was the second side's rating, the deal is
      // fully complete — settle its copies now (best-effort;
      // the Inbox read sweep retries anything that misses).
      await settleMarketplaceIfReady(ctx, offer, listing);
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
      // Auto-settlement sweep (Nov 4, 2026): a fully complete
      // card deal whose settlement didn't land at feedback
      // time settles here on read — the same retry-on-read
      // pattern trades and cash purchases use.
      for (const o of offers) {
        if (o.completedAt && !o.settledAt) {
          const listing = listingById.get(o.listingId);
          if (listing) {
            await settleMarketplaceIfReady(ctx, o, listing);
            if (o.settledAt == null) {
              const fresh = await db
                .select()
                .from(schema.marketplaceOffers)
                .where(eq(schema.marketplaceOffers.id, o.id))
                .limit(1);
              if (fresh[0]?.settledAt) o.settledAt = fresh[0].settledAt;
            }
          }
        }
      }
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
            kind: listing.kind as "card" | "sealed" | "comic" | "other",
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
          kind: listing.kind as "card" | "sealed" | "comic" | "other",
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
          photoUrl: null,
          photoStatus: null,
        });
      }
      // Accessory deals carry the seller's photo under the
      // same visibility rule as the listings themselves.
      for (const d of deals) {
        const listing = listingById.get(d.listingId);
        if (listing && listing.kind === "other") {
          d.photoStatus = (listing.photoStatus as
            | "pending"
            | "approved"
            | "rejected"
            | null) ?? null;
          if (
            listing.photoBlobKey &&
            (listing.photoStatus === "approved" ||
              listing.sellerCode === me)
          ) {
            d.photoUrl = await ctx.blobs
              .getUrl(listing.photoBlobKey)
              .catch(() => null);
          }
        }
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
      "Which 'Your Collections' tiles this user has hidden, and the order they arranged the tiles in by long-hold drag on Home (Anthony, Nov 3, 2026): returns the hidden tile keys (everything not listed is shown) and the full resolved tile order (saved order first, unordered tiles in default position). Since Nov 4, 2026 the keys cover Home's main areas (tcg, comics, lego, funko, sports) and the games inside TCG Universe (lorcana, pokemon, starwars, magic) in one list. Display-only — hiding or reordering deletes nothing and affects no totals.",
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
      "Saves the order of the 'Your Collections' tiles for this user (Anthony, Nov 3, 2026, late): set by long-holding a tile on Home and dragging it to a new spot; persists on their profile like the tile show/hide choices and the theme. Display-only. Since the Nov 4, 2026 condensation the saved list carries Home's main areas and the TCG Universe games together (one order; each place renders its own keys).",
    request: z.object({
      order: z.array(
        z.enum([
          "tcg",
          "comics",
          "lego",
          "funko",
          "sports",
          "toppsau",
          "lorcana",
          "pokemon",
          "magic",
          "starwars",
          "disneytopps",
          "starwarstopps",
          "gpk",
          "wwetopps",
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
        "tcg",
        "comics",
        "lego",
        "funko",
        "sports",
        "toppsau",
        "lorcana",
        "pokemon",
        "magic",
        "starwars",
        "disneytopps",
        "starwarstopps",
        "gpk",
        "wwetopps",
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
      "One other collection's catalog overview (Pokémon, Magic: The Gathering, Star Wars: Unlimited, Funko Pop!, Legos, or a Topps sports catalog): its sets with printing counts and owned counts, plus the catalog download progress (sets done of total, printings cataloged, complete) from the resumable importer.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars", "funko", "lego", "topps", "bowman", "topps-basketball", "disney-topps", "starwars-topps", "gpk", "wwe-topps"]),
    }),
    response: z.object({
      sections: z.array(
        z.object({
          key: z.string(),
          name: z.string(),
          total: z.number(),
          owned: z.number(),
          hasArt: z.boolean(),
          /** How many of this set's cards carry artwork —
              the per-set front progress the set list and the
              collection-level artwork block render (Nov 7,
              2026: the all-Disney-Topps / all-GPK artwork
              completion ask). */
          withArt: z.number(),
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
          withArt: sql<number>`sum(case when ${schema.gameCards.imageUrl} is not null and ${schema.gameCards.imageUrl} <> '' then 1 else 0 end)`,
          owned: sql<number>`coalesce(sum(${schema.gameCards.ownedQty} + ${schema.gameCards.ownedSealedQty}), 0)`,
        })
        .from(schema.gameCards)
        .where(eq(schema.gameCards.game, args.game))
        .groupBy(schema.gameCards.sectionKey, schema.gameCards.sectionName)
        .orderBy(asc(sql`min(${schema.gameCards.sectionSort})`));
      const artRows = await db
        .select({ sectionKey: schema.gameSectionArt.sectionKey })
        .from(schema.gameSectionArt)
        .where(eq(schema.gameSectionArt.game, args.game));
      const artKeys = new Set(artRows.map((r) => r.sectionKey));
      const meta = await readImportMeta(ctx, args.game);
      const cardsTotal = rows.reduce((s, r) => s + r.total, 0);
      return {
        sections: rows.map((r) => ({
          key: r.key,
          name: r.name,
          total: r.total,
          owned: r.owned,
          hasArt: artKeys.has(r.key),
          withArt: r.withArt ?? 0,
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

  versionLiveStamp: defineAction({
    description:
      "Returns the recorded go-live instant for an app version, stamping it the first time the running copy confirms the server is serving that same version (Anthony, Nov 5, 2026 — the green 'Went live' line under the Settings up-to-date message). v1.97.0 predates the stamp table, so its moment is seeded from that build's recorded audit trail.",
    request: z.object({
      version: z.string().min(1).max(20),
      servedVersion: z.string().max(20).nullable(),
    }),
    response: z.object({
      wentLiveAt: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.versionLiveStamps)
        .where(eq(schema.versionLiveStamps.version, args.version));
      if (existing[0]) return { wentLiveAt: existing[0].wentLiveAt };
      // v1.97.0 shipped before this table existed. Its
      // go-live is recorded fact, not an estimate: that
      // build's verification session closed at
      // 2026-11-05T07:03:15Z and the platform captured the
      // live build minutes later.
      if (args.version === "1.97.0") {
        const seeded = "2026-11-05T07:03:15Z";
        await db
          .insert(schema.versionLiveStamps)
          .values({ version: args.version, wentLiveAt: seeded })
          .onConflictDoNothing()
          .run();
        return { wentLiveAt: seeded };
      }
      // A version stamps its own go-live only when the copy
      // asking is itself the version the server now serves —
      // i.e. this build has actually landed for this user.
      if (args.servedVersion != null && args.servedVersion === args.version) {
        const now = new Date().toISOString();
        await db
          .insert(schema.versionLiveStamps)
          .values({ version: args.version, wentLiveAt: now })
          .onConflictDoNothing()
          .run();
        const rows = await db
          .select()
          .from(schema.versionLiveStamps)
          .where(eq(schema.versionLiveStamps.version, args.version));
        return { wentLiveAt: rows[0]?.wentLiveAt ?? now };
      }
      return { wentLiveAt: null };
    },
  }),

  importSectionArt: defineAction({
    description:
      "Records official product artwork for catalog sections (sets) whose catalog source is text-only — one publisher product photo per section, stored as a source URL here and ingested into blob storage by getSectionArt (Anthony, Nov 5, 2026: set artwork for all four Topps Alternate Universe areas — Disney Topps, Star Wars Topps, Garbage Pail Kids, WWE Topps). Idempotent upsert; never touches card rows, ownership, or prices.",
    request: z.object({
      items: z
        .array(
          z.object({
            game: z.string().min(1).max(40),
            sectionKey: z.string().min(1).max(80),
            imageUrl: z.string().url().max(600),
            pageUrl: z.string().url().max(600).nullable(),
          }),
        )
        .min(1)
        .max(100),
    }),
    response: z.object({ ok: z.literal(true), saved: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; saved: number }> {
      const db = ctx.db<typeof schema>();
      let saved = 0;
      for (const item of args.items) {
        await db
          .insert(schema.gameSectionArt)
          .values({
            game: item.game,
            sectionKey: item.sectionKey,
            imageUrl: item.imageUrl,
            pageUrl: item.pageUrl,
          })
          .onConflictDoUpdate({
            target: [
              schema.gameSectionArt.game,
              schema.gameSectionArt.sectionKey,
            ],
            set: { imageUrl: item.imageUrl, pageUrl: item.pageUrl },
          })
          .run();
        saved += 1;
      }
      return { ok: true as const, saved };
    },
  }),

  importCardArt: defineAction({
    description:
      "Records collector-sourced front artwork for individual catalog cards whose own source is text-only (Anthony, Nov 6, 2026: Topps checklists carry no images, so card fronts are hunted where terms permit — COMC's photographed card fronts today; the Trading Card Database is an existence reference only, since its terms bar image extraction, and Collectr joins via its API once Anthony's own access is approved). Each item names one game_cards row by id; the image URL is written onto that row (what the grids and detail pages render) and kept here with its source page and site name as provenance. A row whose artwork came with its catalog is never overwritten; a row previously filled from a collector source may be re-filled (dead or wrong source replacement). Never touches ownership, prices, or any other field.",
    request: z.object({
      items: z
        .array(
          z.object({
            game: z.string().min(1).max(40),
            id: z.number().int(),
            imageUrl: z.string().url().max(900),
            pageUrl: z.string().url().max(900).nullable(),
            source: z.string().min(1).max(80),
          }),
        )
        .min(1)
        .max(100),
    }),
    response: z.object({
      ok: z.literal(true),
      saved: z.number(),
      skipped: z.number(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; saved: number; skipped: number }> {
      const db = ctx.db<typeof schema>();
      let saved = 0;
      let skipped = 0;
      for (const item of args.items) {
        const rows = await db
          .select()
          .from(schema.gameCards)
          .where(eq(schema.gameCards.id, item.id));
        const row = rows[0];
        if (!row || row.game !== item.game) {
          skipped += 1;
          continue;
        }
        const artRows = await db
          .select({ cardId: schema.gameCardArt.cardId })
          .from(schema.gameCardArt)
          .where(
            and(
              eq(schema.gameCardArt.game, item.game),
              eq(schema.gameCardArt.cardId, item.id),
            ),
          );
        // Artwork that arrived with the card's own catalog
        // (Pokémon, Scryfall, FFG, HobbyDB…) is authoritative
        // and never replaced by a collector scan. Only a row
        // this table already filled may be re-filled.
        if (row.imageUrl && artRows.length === 0) {
          skipped += 1;
          continue;
        }
        await db
          .insert(schema.gameCardArt)
          .values({
            game: item.game,
            cardId: item.id,
            imageUrl: item.imageUrl,
            pageUrl: item.pageUrl,
            source: item.source,
          })
          .onConflictDoUpdate({
            target: [schema.gameCardArt.game, schema.gameCardArt.cardId],
            set: {
              imageUrl: item.imageUrl,
              pageUrl: item.pageUrl,
              source: item.source,
            },
          })
          .run();
        await db
          .update(schema.gameCards)
          .set({ imageUrl: item.imageUrl })
          .where(eq(schema.gameCards.id, item.id))
          .run();
        saved += 1;
      }
      return { ok: true as const, saved, skipped };
    },
  }),

  getSectionArt: defineAction({
    description:
      "Returns a same-origin copy of one catalog section's official product artwork (fetched server-side once and cached in blob storage), so set tiles show the publisher's product photo without hotlinking. The URL fetched is always the section-art row stored for that section — never a caller-supplied address.",
    request: z.object({
      game: z.string().min(1).max(40),
      sectionKey: z.string().min(1).max(80),
    }),
    response: z.object({
      ok: z.boolean(),
      url: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: boolean; url: string | null }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameSectionArt)
        .where(
          and(
            eq(schema.gameSectionArt.game, args.game),
            eq(schema.gameSectionArt.sectionKey, args.sectionKey),
          ),
        );
      const row = rows[0];
      if (!row) return { ok: false, url: null };
      const key = `section-art/${row.game}/${row.sectionKey}-${funkoHash(row.imageUrl)}`;
      try {
        const existing = await ctx.blobs.head(key);
        if (existing) {
          return { ok: true, url: await ctx.blobs.getUrl(key) };
        }
        const res = await fetch(row.imageUrl, {
          // A hanging source fetch must not stall the set
          // row's thumbnail indefinitely (part of the Disney
          // Topps blank-thumbnail inconsistency, Nov 5,
          // 2026): 20 seconds, then the row falls back to
          // its placeholder and a later visit retries.
          signal: AbortSignal.timeout(20000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            Accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (!res.ok) return { ok: false, url: null };
        const contentType = (
          res.headers.get("content-type") ?? ""
        ).toLowerCase();
        if (!contentType.startsWith("image/")) {
          return { ok: false, url: null };
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length === 0 || bytes.length > 3_000_000) {
          return { ok: false, url: null };
        }
        await ctx.blobs.put(key, bytes, { contentType });
        return { ok: true, url: await ctx.blobs.getUrl(key) };
      } catch {
        return { ok: false, url: null };
      }
    },
  }),

  getGameSection: defineAction({
    description:
      "One set's printings inside a game catalog, in collector-number order, paged (150 at a time): name, number, rarity/finish, artwork link, price where the source publishes one, and the collector's owned count (0 = missing/ghosted). Also returns withArt — how many of the set's cards carry artwork across the whole section (not just this page) — so a set view can show its artwork progress and offer the focused card-art hunt for the cards still missing a front.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars", "funko", "lego", "topps", "bowman", "topps-basketball", "disney-topps", "starwars-topps", "gpk", "wwe-topps"]),
      sectionKey: z.string().min(1).max(80),
      offset: z.number().int().min(0).max(200000).default(0),
    }),
    response: z.object({
      sectionName: z.string(),
      total: z.number(),
      withArt: z.number(),
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
          ownedSealedQty: z.number(),
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
      const artRows = await db
        .select({ c: sql<number>`count(*)` })
        .from(schema.gameCards)
        .where(
          and(
            eq(schema.gameCards.game, args.game),
            eq(schema.gameCards.sectionKey, args.sectionKey),
            isNotNull(schema.gameCards.imageUrl),
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
        withArt: artRows[0]?.c ?? 0,
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
          ownedSealedQty: r.ownedSealedQty,
        })),
      };
    },
  }),

  getGameCard: defineAction({
    description:
      "One catalog item of a game by id, in the detail sheet's shape (name, number, set, rarity/finish, artwork link, price, owned counts) — the refresh-in-place restore for an open item page, so a reload on an item's page reopens that same item instead of bouncing back to the catalog.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars", "funko", "lego", "topps", "bowman", "topps-basketball", "disney-topps", "starwars-topps", "gpk", "wwe-topps"]),
      id: z.number().int().positive(),
    }),
    response: z.object({
      card: z
        .object({
          id: z.number(),
          name: z.string(),
          printed: z.string(),
          sectionName: z.string(),
          rarity: z.string().nullable(),
          finish: z.string().nullable(),
          imageUrl: z.string().nullable(),
          price: z.number().nullable(),
          ownedQty: z.number(),
          ownedSealedQty: z.number(),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(
          and(
            eq(schema.gameCards.game, args.game),
            eq(schema.gameCards.id, args.id),
          ),
        )
        .limit(1);
      const r = rows[0];
      return {
        card: r
          ? {
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
            }
          : null,
      };
    },
  }),

  searchGameCards: defineAction({
    description:
      "Searches one game catalog by card name (a trailing number narrows to that collector number, the same rule as the Lorcana search): up to 60 printings with their set, number, artwork link, price, and owned count — the add-by-search path for the new games.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars", "funko", "lego", "topps", "bowman", "topps-basketball", "disney-topps", "starwars-topps", "gpk", "wwe-topps"]),
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
          ownedSealedQty: z.number(),
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
          ownedSealedQty: r.ownedSealedQty,
        })),
      };
    },
  }),

  searchAllCollectibles: defineAction({
    description:
      "The Search tab's universal search (Anthony, Nov 4, 2026): one query across every catalog the server holds — all five game catalogs (Pokémon, Magic, Star Wars Unlimited, Funko, Legos), the two Topps sports catalogs (baseball and basketball, data-only), plus the sealed products — grouped by type for the overlay's 'More collectibles' section. Lorcana binder cards ride the existing searchCards and graded comics are matched client-side from the in-app comics list, so this action covers the rest. Name substring match from the first letter, same as the card typeahead.",
    request: z.object({ query: z.string().trim().min(1).max(80) }),
    response: z.object({
      games: z.array(
        z.object({
          game: z.enum([
            "pokemon",
            "magic",
            "starwars",
            "funko",
            "lego",
            "topps",
            "bowman",
            "topps-basketball",
            "disney-topps",
            "starwars-topps",
            "gpk",
            "wwe-topps",
          ]),
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
          ownedSealedQty: z.number(),
        }),
      ),
      sealed: z.array(
        z.object({
          name: z.string(),
          setName: z.string(),
          qty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const needle = `%${args.query.trim()}%`;
      const gameRows = await db
        .select()
        .from(schema.gameCards)
        .where(like(schema.gameCards.name, needle))
        .orderBy(
          desc(schema.gameCards.ownedQty),
          asc(schema.gameCards.game),
          asc(schema.gameCards.sectionSort),
          asc(schema.gameCards.slotSort),
        )
        .limit(400);
      // Cap per game so one huge catalog can't crowd out the
      // others (Funko alone holds ~24k rows).
      const perGame = new Map<string, number>();
      const games: Array<{
        game:
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
        id: number;
        sectionKey: string;
        sectionName: string;
        printed: string;
        name: string;
        rarity: string | null;
        finish: string | null;
        imageUrl: string | null;
        price: number | null;
        ownedQty: number;
        ownedSealedQty: number;
      }> = [];
      for (const r of gameRows) {
        const n = perGame.get(r.game) ?? 0;
        if (n >= 6) continue;
        perGame.set(r.game, n + 1);
        games.push({
          game: r.game as (typeof games)[number]["game"],
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
          ownedSealedQty: r.ownedSealedQty,
        });
      }
      const sealedEff = await effectiveSealed(ctx);
      const q = args.query.trim().toLowerCase();
      const sealed = sealedEff.items
        .filter((i) => i.name.toLowerCase().includes(q))
        .slice(0, 6)
        .map((i) => ({ name: i.name, setName: i.setName, qty: i.qty }));
      return { games, sealed };
    },
  }),

  getGameOwnedItems: defineAction({
    description:
      "Every catalog item of one game the collector owns at least one copy of (opened or sealed), in theme/set order — the Lego Sealed shelf reads its sealed rows from here.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars", "funko", "lego", "topps", "bowman", "topps-basketball", "disney-topps", "starwars-topps", "gpk", "wwe-topps"]),
    }),
    response: z.object({
      items: z.array(
        z.object({
          id: z.number(),
          sectionKey: z.string(),
          sectionName: z.string(),
          printed: z.string(),
          name: z.string(),
          rarity: z.string().nullable(),
          imageUrl: z.string().nullable(),
          ownedQty: z.number(),
          ownedSealedQty: z.number(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(
          and(
            eq(schema.gameCards.game, args.game),
            or(
              gt(schema.gameCards.ownedQty, 0),
              gt(schema.gameCards.ownedSealedQty, 0),
            ),
          ),
        )
        .orderBy(
          asc(schema.gameCards.sectionSort),
          asc(schema.gameCards.slotSort),
        )
        .limit(2000);
      return {
        items: rows.map((r) => ({
          id: r.id,
          sectionKey: r.sectionKey,
          sectionName: r.sectionName,
          printed: r.printed,
          name: r.name,
          rarity: r.rarity,
          imageUrl: r.imageUrl,
          ownedQty: r.ownedQty,
          ownedSealedQty: r.ownedSealedQty,
        })),
      };
    },
  }),

  getGameImageProxy: defineAction({
    description:
      "Returns a same-origin copy of one catalog item's artwork (fetched server-side once and cached in blob storage), so the client can cut the photo's studio background away on-device even when the source host sends no CORS headers or blocks hotlinking. The URL fetched is always the catalog row's own stored image URL — never a caller-supplied address.",
    request: z.object({
      id: z.number().int(),
    }),
    response: z.object({
      ok: z.boolean(),
      url: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: boolean; url: string | null }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const row = rows[0];
      const source = row?.imageUrl ?? null;
      if (!row || !source) return { ok: false, url: null };
      const key = `game-img/${row.id}-${funkoHash(source)}`;
      try {
        const existing = await ctx.blobs.head(key);
        if (existing) {
          return { ok: true, url: await ctx.blobs.getUrl(key) };
        }
        const res = await fetch(source, {
          headers: {
            // An ordinary browser header set: HobbyDB's bot
            // check 403s sparse scraper-style headers (a bare
            // "Accept: image/*" was refused; a full browser
            // set is served the photo).
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            Accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (!res.ok) return { ok: false, url: null };
        const contentType = (
          res.headers.get("content-type") ?? ""
        ).toLowerCase();
        if (!contentType.startsWith("image/")) {
          return { ok: false, url: null };
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        // Catalog photos are a few hundred KB; anything past
        // ~3 MB is not the product photo the row promises.
        if (bytes.length === 0 || bytes.length > 3_000_000) {
          return { ok: false, url: null };
        }
        await ctx.blobs.put(key, bytes, { contentType });
        return { ok: true, url: await ctx.blobs.getUrl(key) };
      } catch {
        return { ok: false, url: null };
      }
    },
  }),

  getStoredCutout: defineAction({
    description:
      "Returns the PRE-MADE cutout of one catalog item's photo (its studio background already removed, stored in app blob storage) when one exists. The Library shelf and item heroes render this stored copy immediately — no full-size original download, no live background-removal, and no white-background interim (Anthony, Nov 5, 2026: the Library was slow and one Lego set kept its white background because its live chain depended on a flaky source fetch). The key derives from the catalog row's own stored image URL, so a changed photo invalidates the old cutout automatically.",
    request: z.object({
      id: z.number().int(),
    }),
    response: z.object({
      ok: z.boolean(),
      url: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: boolean; url: string | null }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const row = rows[0];
      const source = row?.imageUrl ?? null;
      if (!row || !source) return { ok: false, url: null };
      const key = `game-cutout/${row.id}-${funkoHash(source)}`;
      try {
        const existing = await ctx.blobs.head(key);
        if (!existing) return { ok: false, url: null };
        return { ok: true, url: await ctx.blobs.getUrl(key) };
      } catch {
        return { ok: false, url: null };
      }
    },
  }),

  saveStoredCutout: defineAction({
    description:
      "Stores PRE-MADE cutouts (studio background already removed, PNG bytes as base64) for catalog items, keyed to each row's current photo URL. Used to seed the Library shelf items' finished cutouts and by the client to persist a cutout it computed once, so every later open serves the finished image straight from app storage. Items whose id has no catalog row or whose PNG payload is missing/oversized are skipped, never fatal.",
    request: z.object({
      items: z
        .array(
          z.object({
            id: z.number().int(),
            pngBase64: z.string().min(1).max(2_800_000),
          }),
        )
        .min(1)
        .max(50),
    }),
    response: z.object({ saved: z.number() }),
    async handler(ctx, args): Promise<{ saved: number }> {
      const db = ctx.db<typeof schema>();
      let saved = 0;
      for (const item of args.items) {
        const rows = await db
          .select()
          .from(schema.gameCards)
          .where(eq(schema.gameCards.id, item.id));
        const row = rows[0];
        const source = row?.imageUrl ?? null;
        if (!row || !source) continue;
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(
            Buffer.from(item.pngBase64, "base64"),
          );
        } catch {
          continue;
        }
        // A 560px cutout PNG is a few hundred KB; anything
        // past ~2 MB is not the cutout this row promises.
        if (bytes.length === 0 || bytes.length > 2_000_000) continue;
        // PNG magic bytes — never store a non-PNG payload.
        if (
          bytes[0] !== 0x89 ||
          bytes[1] !== 0x50 ||
          bytes[2] !== 0x4e ||
          bytes[3] !== 0x47
        ) {
          continue;
        }
        const key = `game-cutout/${row.id}-${funkoHash(source)}`;
        await ctx.blobs.put(key, bytes, {
          contentType: "image/png",
        });
        saved++;
      }
      return { saved };
    },
  }),

  setGameCardOwned: defineAction({
    description:
      "Sets how many copies of one catalog item the collector owns (0 = missing, shown ghosted). For Lego sets it can also set the SEALED copy count, which Lego tracks apart from opened copies because sealed-vs-opened drives Lego value. Only owned counts change; catalog data is untouched.",
    request: z.object({
      id: z.number().int(),
      ownedQty: z.number().int().min(0).max(999),
      sealedQty: z.number().int().min(0).max(999).optional(),
    }),
    response: z.object({
      ok: z.literal(true),
      ownedQty: z.number(),
      ownedSealedQty: z.number(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; ownedQty: number; ownedSealedQty: number }> {
      const db = ctx.db<typeof schema>();
      const before = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const beforeRow = before[0];
      const beforeTotal =
        (beforeRow?.ownedQty ?? 0) + (beforeRow?.ownedSealedQty ?? 0);
      await db
        .update(schema.gameCards)
        .set({
          ownedQty: args.ownedQty,
          ...(args.sealedQty != null
            ? { ownedSealedQty: args.sealedQty }
            : {}),
        })
        .where(eq(schema.gameCards.id, args.id));
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const afterRow = rows[0];
      // Lego date-added stamp (Anthony, Nov 4, 2026): the day
      // a Lego set first enters the collection is a real event
      // the detail page's Your copy block shows. Stamp it on
      // the 0-to-owned step only; an existing stamp never moves.
      if (
        afterRow?.game === "lego" &&
        beforeTotal === 0 &&
        afterRow.ownedQty + afterRow.ownedSealedQty > 0
      ) {
        const today = new Date().toISOString().slice(0, 10);
        const notes = await db
          .select()
          .from(schema.legoOwnershipNotes)
          .where(eq(schema.legoOwnershipNotes.gameCardId, args.id));
        if (notes.length === 0) {
          await db.insert(schema.legoOwnershipNotes).values({
            gameCardId: args.id,
            dateAdded: today,
          });
        } else if (notes[0] && notes[0].dateAdded == null) {
          await db
            .update(schema.legoOwnershipNotes)
            .set({ dateAdded: today })
            .where(eq(schema.legoOwnershipNotes.gameCardId, args.id));
        }
      }
      ctx.invalidateQueries();
      // Cloud backup on every change (Nov 9, 2026 habit): stamp
      // the change and push this item's rows (opened, sealed,
      // and its slabs) right away, best-effort.
      await markBackupDirty(ctx);
      await syncGameCardToCloud(ctx, args.id);
      return {
        ok: true as const,
        ownedQty: rows[0]?.ownedQty ?? args.ownedQty,
        ownedSealedQty: rows[0]?.ownedSealedQty ?? 0,
      };
    },
  }),

  findGameCardByUpc: defineAction({
    description:
      "Matches a scanned Funko box barcode (UPC/EAN digits) to the catalog figure whose record carries that barcode. The funko-pop-data catalog ships no barcodes, so a figure matches only after its barcode has been linked (setGameCardUpc) — a scan with no linked record returns match: null and the app says so plainly and falls back to search by name. Nothing is ever fuzzy-matched.",
    request: z.object({
      upc: z.string().trim().min(8).max(20),
    }),
    response: z.object({
      match: z
        .object({
          id: z.number(),
          name: z.string(),
          printed: z.string(),
          sectionName: z.string(),
          rarity: z.string().nullable(),
          finish: z.string().nullable(),
          imageUrl: z.string().nullable(),
          price: z.number().nullable(),
          ownedQty: z.number(),
          ownedSealedQty: z.number(),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const digits = args.upc.replace(/\D/g, "");
      // A UPC-A read as EAN-13 gains a leading 0; try both
      // forms so a linked 12-digit code matches either scan.
      const candidates = new Set<string>([digits]);
      if (digits.length === 13 && digits.startsWith("0")) {
        candidates.add(digits.slice(1));
      }
      if (digits.length === 12) {
        candidates.add(`0${digits}`);
      }
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.game, "funko"));
      let row = rows.find(
        (r) => r.upc != null && candidates.has(r.upc),
      );
      if (!row) {
        // Researched UPCs (data/funkoSoldPrices.ts) match too:
        // a published box barcode from the sold-data research
        // is a real barcode for that figure, not a guess.
        for (const c of candidates) {
          const snap = funkoSoldSnapshotByUpc(c);
          if (snap) {
            row = rows.find((r) => r.id === snap.cardId);
            if (row) break;
          }
        }
      }
      if (!row) return { match: null };
      return {
        match: {
          id: row.id,
          name: row.name,
          printed: row.printed,
          sectionName: row.sectionName,
          rarity: row.rarity,
          finish: row.finish,
          imageUrl: row.imageUrl,
          price: row.price,
          ownedQty: row.ownedQty,
          ownedSealedQty: row.ownedSealedQty,
        },
      };
    },
  }),

  setGameCardUpc: defineAction({
    description:
      "Links a scanned box barcode (UPC/EAN digits) to one Funko catalog figure, so future scans of that box match it. Set by the collector from the figure's own page after a no-match scan — the app never guesses which figure a barcode belongs to.",
    request: z.object({
      id: z.number().int(),
      upc: z.string().trim().min(8).max(20),
    }),
    response: z.object({ ok: z.literal(true), upc: z.string() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; upc: string }> {
      const db = ctx.db<typeof schema>();
      const digits = args.upc.replace(/\D/g, "");
      await db
        .update(schema.gameCards)
        .set({ upc: digits })
        .where(
          and(
            eq(schema.gameCards.id, args.id),
            eq(schema.gameCards.game, "funko"),
          ),
        );
      ctx.invalidateQueries();
      return { ok: true as const, upc: digits };
    },
  }),

  findGradedSlabByCert: defineAction({
    description:
      "Looks up a grading cert number for one of the top five companies (PSA, Beckett/BGS, SGC, CGC Cards, TAG) in the collector's own vault records — NOT against any company's database. Returns the slab already saved under that company + cert, with the catalog card it is attached to, or null when the cert is new here. The cert scanner checks this before saving so a cert is never entered twice: within one company, one cert number is one physical slab.",
    request: z.object({
      company: z.enum(["PSA", "BGS", "SGC", "CGC", "TAG"]),
      cert: z.string().trim().min(4).max(24),
    }),
    response: z.object({
      existing: z
        .object({
          slab: gradedSlabZ,
          card: z.object({
            id: z.number(),
            game: z.string(),
            name: z.string(),
            printed: z.string(),
            sectionName: z.string(),
            rarity: z.string().nullable(),
            finish: z.string().nullable(),
            imageUrl: z.string().nullable(),
            price: z.number().nullable(),
            ownedQty: z.number(),
            ownedSealedQty: z.number(),
          }),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const cert = normalizeGradedCert(args.company, args.cert);
      if (!cert) return { existing: null };
      const slabRows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(
          and(
            eq(schema.gradedSlabs.company, args.company),
            eq(schema.gradedSlabs.cert, cert),
          ),
        );
      const slab = slabRows[0];
      if (!slab) return { existing: null };
      const cardRows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, slab.gameCardId));
      const card = cardRows[0];
      if (!card) return { existing: null };
      return {
        existing: {
          slab: await gradedSlabShape(ctx, slab),
          card: {
            id: card.id,
            game: card.game,
            name: card.name,
            printed: card.printed,
            sectionName: card.sectionName,
            rarity: card.rarity,
            finish: card.finish,
            imageUrl: card.imageUrl,
            price: card.price,
            ownedQty: card.ownedQty,
            ownedSealedQty: card.ownedSealedQty,
          },
        },
      };
    },
  }),

  listGradedSlabs: defineAction({
    description:
      "Lists the graded slabs (cert copies from any of the top five companies) saved against one catalog card, newest first — the graded-copies section on the card's page. Each slab carries its company, cert number, grade, and what was paid for it when recorded.",
    request: z.object({ gameCardId: z.number().int() }),
    response: z.object({
      slabs: z.array(gradedSlabZ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(eq(schema.gradedSlabs.gameCardId, args.gameCardId))
        .orderBy(desc(schema.gradedSlabs.createdAt));
      const slabs: z.infer<typeof gradedSlabZ>[] = [];
      for (const r of rows) slabs.push(await gradedSlabShape(ctx, r));
      return { slabs };
    },
  }),

  addGradedSlab: defineAction({
    description:
      "Saves one graded slab (a cert copy from PSA, Beckett/BGS, SGC, CGC Cards, or TAG) against a catalog card: company, cert number, grade, and optionally what was paid. Cert format and grade are validated against the company's own published shapes (e.g. PSA has no 9.5, TAG certs carry a leading letter, SGC's long format is hyphenated). The slab counts as one owned copy of the card, so the card's owned quantity steps up by one. A cert already in the vault under the same company is refused as a duplicate — the existing slab comes back instead, because within a company one cert number is one physical slab. The cert is the collector's own record; nothing is checked against any company's database and no company pricing is attached.",
    request: z.object({
      gameCardId: z.number().int(),
      company: z.enum(["PSA", "BGS", "SGC", "CGC", "TAG"]),
      cert: z.string().trim().min(4).max(24),
      grade: z.string().trim().min(1).max(20),
      paid: z.number().min(0).max(100_000_000).nullable().optional(),
      /** Set when the online cert lookup imported this
          cert's slab photos from the grading company: the
          blob keys it stored, where the photo came from,
          and the company's own description line. Only keys
          under the graded-slab prefix are accepted — the
          client can only attach photos a lookup stored. */
      imageKey: z.string().max(200).nullable().optional(),
      imageBackKey: z.string().max(200).nullable().optional(),
      imageSource: z.enum(["company", "user"]).nullable().optional(),
      onlineLine: z.string().max(400).nullable().optional(),
    }),
    response: z.object({
      added: z.boolean(),
      duplicate: z.boolean(),
      error: z.string().nullable(),
      slab: gradedSlabZ.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const cert = normalizeGradedCert(args.company, args.cert);
      if (!gradedCertValid(args.company, cert)) {
        return {
          added: false,
          duplicate: false,
          error:
            "That cert number doesn't match the shape printed on this company's labels — check it against the slab and try again.",
          slab: null,
        };
      }
      const grade =
        args.grade.toLowerCase() === "authentic"
          ? "Authentic"
          : args.grade;
      if (!gradedGradeValid(args.company, grade)) {
        return {
          added: false,
          duplicate: false,
          error:
            "Pick the grade exactly as printed on the slab's label.",
          slab: null,
        };
      }
      const cardRows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.gameCardId));
      const card = cardRows[0];
      if (!card) {
        return {
          added: false,
          duplicate: false,
          error: "That catalog card no longer exists here.",
          slab: null,
        };
      }
      const existing = await db
        .select()
        .from(schema.gradedSlabs)
        .where(
          and(
            eq(schema.gradedSlabs.company, args.company),
            eq(schema.gradedSlabs.cert, cert),
          ),
        );
      const dup = existing[0];
      if (dup) {
        return {
          added: false,
          duplicate: true,
          error: null,
          slab: await gradedSlabShape(ctx, dup),
        };
      }
      const now = Date.now();
      const paid =
        args.paid != null && Number.isFinite(args.paid)
          ? args.paid
          : null;
      const imageKey =
        args.imageKey && args.imageKey.startsWith("graded-slab/")
          ? args.imageKey
          : null;
      const imageBackKey =
        args.imageBackKey &&
        args.imageBackKey.startsWith("graded-slab/")
          ? args.imageBackKey
          : null;
      const inserted = await db
        .insert(schema.gradedSlabs)
        .values({
          gameCardId: card.id,
          company: args.company,
          cert,
          grade,
          paid,
          qty: 1,
          imageKey,
          imageBackKey,
          imageSource: imageKey
            ? (args.imageSource ?? "company")
            : null,
          onlineLine: args.onlineLine ?? null,
          onlineCheckedAt:
            args.onlineLine != null || imageKey ? now : null,
          createdAt: now,
        })
        .returning();
      // A graded copy is one of the card's owned copies.
      await db
        .update(schema.gameCards)
        .set({
          ownedQty: sql`${schema.gameCards.ownedQty} + 1`,
        })
        .where(eq(schema.gameCards.id, card.id));
      ctx.invalidateQueries();
      await markBackupDirty(ctx);
      await syncGameCardToCloud(ctx, card.id);
      const row = inserted[0];
      return {
        added: true,
        duplicate: false,
        error: null,
        slab: row ? await gradedSlabShape(ctx, row) : null,
      };
    },
  }),

  removeGradedSlab: defineAction({
    description:
      "Removes one graded slab record from a catalog card (the slab was sold, traded, or entered by mistake). The card's owned quantity steps down by one with it, never below zero.",
    request: z.object({ id: z.number().int() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(eq(schema.gradedSlabs.id, args.id));
      const slab = rows[0];
      if (slab) {
        await db
          .delete(schema.gradedSlabs)
          .where(eq(schema.gradedSlabs.id, args.id));
        await db
          .update(schema.gameCards)
          .set({
            ownedQty: sql`max(0, ${schema.gameCards.ownedQty} - ${slab.qty})`,
          })
          .where(eq(schema.gameCards.id, slab.gameCardId));
        await markBackupDirty(ctx);
        await syncGameCardToCloud(ctx, slab.gameCardId);
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  lookupGradedCert: defineAction({
    description:
      "The online half of slab scanning (Anthony, Nov 5, 2026): after a cert is captured, read the grading company's own cert record for it and, when the company hosts a slab photo for THAT cert, import a copy of the photo into app storage (front, and back when the record has one) — never a hotlink, never another cert's photo. PSA's cert pages carry the full record and its hosted photos and are read directly; Beckett, CGC Cards, and TAG get one best-effort read each and honestly report when their sites cannot be read from here; SGC publishes no online cert record at all and says so. The result pre-fills the confirm screen — grade and the company's description line — only when a record was actually read; no company pricing is fetched or claimed, and a record the lookup could not reach changes nothing about the manual record.",
    request: z.object({
      company: z.enum(["PSA", "BGS", "SGC", "CGC", "TAG"]),
      cert: z.string().trim().min(4).max(24),
    }),
    response: z.object({
      status: z.enum([
        "found",
        "not-found",
        "unreachable",
        "no-online-record",
      ]),
      grade: z.string().nullable(),
      line: z.string().nullable(),
      imageKey: z.string().nullable(),
      imageBackKey: z.string().nullable(),
      imageUrl: z.string().nullable(),
      imageBackUrl: z.string().nullable(),
      sourceUrl: z.string(),
    }),
    async handler(ctx, args) {
      const cert = normalizeGradedCert(args.company, args.cert);
      const sourceUrl = gradedCertPageUrl(args.company, cert);
      const blank = {
        grade: null,
        line: null,
        imageKey: null,
        imageBackKey: null,
        imageUrl: null,
        imageBackUrl: null,
        sourceUrl,
      };
      if (!gradedCertValid(args.company, cert)) {
        return { status: "not-found" as const, ...blank };
      }
      // SGC publishes no online cert record — its lookup is a
      // form with no cert-carrying address — so there is
      // nothing honest to fetch; the record stays manual.
      if (args.company === "SGC") {
        return { status: "no-online-record" as const, ...blank };
      }
      const fetchText = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": GRADED_LOOKUP_UA },
            signal: AbortSignal.timeout(12_000),
          });
          if (!res.ok) return null;
          return await res.text();
        } catch {
          return null;
        }
      };
      const importImage = async (
        url: string,
        side: "front" | "back",
      ): Promise<{ key: string; url: string } | null> => {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": GRADED_LOOKUP_UA },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) return null;
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.length < 1_000 || bytes.length > 12_000_000) {
            return null;
          }
          const key = `graded-slab/${args.company.toLowerCase()}/${cert}/${side}.jpg`;
          await ctx.blobs.put(key, bytes, {
            contentType: "image/jpeg",
          });
          return { key, url: await ctx.blobs.getUrl(key) };
        } catch {
          return null;
        }
      };

      if (args.company === "PSA") {
        const html = await fetchText(sourceUrl);
        if (html == null) {
          return { status: "unreachable" as const, ...blank };
        }
        // PSA server-renders the record as a definition list;
        // a cert PSA has no record for renders the page shell
        // with no pairs at all — that absence is the not-found
        // signal, never a guessed record.
        const fields = new Map<string, string>();
        const pairRe =
          /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
        for (const pm of html.matchAll(pairRe)) {
          const k = (pm[1] ?? "")
            .replace(/<[^>]+>/g, "")
            .trim()
            .toLowerCase();
          const v = (pm[2] ?? "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (k && v) fields.set(k, v);
        }
        if (fields.size === 0) {
          return { status: "not-found" as const, ...blank };
        }
        const gradeText = fields.get("item grade") ?? "";
        const grade = gradeText ? psaGradeFromText(gradeText) : null;
        const lineParts = [
          fields.get("year"),
          fields.get("brand/title") ?? fields.get("brand"),
          fields.get("subject"),
          fields.get("card number")
            ? `#${fields.get("card number")}`
            : undefined,
          fields.get("variety/pedigree") ?? fields.get("variety"),
        ].filter((p): p is string => !!p && p.length > 0);
        const line =
          lineParts.length > 0 ? lineParts.join(" · ") : null;
        // The hosted slab photos ride the page payload as a
        // JSON images array (CloudFront URLs); PSA's gallery
        // order is front first, back second. Import the
        // medium variant of each — only images served for
        // THIS cert's page are ever imported.
        let imageKey: string | null = null;
        let imageBackKey: string | null = null;
        let imageUrl: string | null = null;
        let imageBackUrl: string | null = null;
        // The array may ride the page payload as escaped
        // JSON (\"images\":[...\"mediumPath\":\"https://…\"]),
        // so the extraction tolerates both quote forms and
        // stays inside THIS cert's images array — photos from
        // anywhere else on the page are never imported.
        const imgKeyIdx = Math.max(
          html.indexOf('"images"'),
          html.indexOf('\\"images\\"'),
        );
        if (imgKeyIdx >= 0) {
          const slice = html.slice(imgKeyIdx, imgKeyIdx + 8000);
          const end = slice.indexOf("]");
          const body = end >= 0 ? slice.slice(0, end) : slice;
          const mediums = [
            ...body.matchAll(
              /mediumPath\\?"\s*:\s*\\?"(https:[^"\\]+)/g,
            ),
          ]
            .map((m) => m[1] ?? "")
            .filter((u, i, arr) => u.length > 0 && arr.indexOf(u) === i)
            .slice(0, 2);
          const front = mediums[0];
          const back = mediums[1];
          if (front) {
            const got = await importImage(front, "front");
            if (got) {
              imageKey = got.key;
              imageUrl = got.url;
            }
          }
          if (back) {
            const got = await importImage(back, "back");
            if (got) {
              imageBackKey = got.key;
              imageBackUrl = got.url;
            }
          }
        }
        return {
          status: "found" as const,
          grade,
          line,
          imageKey,
          imageBackKey,
          imageUrl,
          imageBackUrl,
          sourceUrl,
        };
      }

      if (args.company === "TAG") {
        // TAG's public DIG API refuses anonymous reads (403),
        // so this is one honest attempt: a real record comes
        // back only if TAG serves it without an account.
        try {
          const res = await fetch(
            `https://api.taggrading.com/graded-cards/public/detail/${encodeURIComponent(cert)}`,
            {
              headers: {
                "User-Agent": GRADED_LOOKUP_UA,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(12_000),
            },
          );
          if (res.ok) {
            const data: unknown = await res.json();
            const rec = asRec(data);
            const gradeRaw =
              typeof rec.grade === "string"
                ? rec.grade
                : typeof rec.grade === "number"
                  ? String(rec.grade)
                  : null;
            const grade =
              gradeRaw != null &&
              gradedGradeValid("TAG", gradeRaw)
                ? gradeRaw
                : null;
            const line =
              typeof rec.cardName === "string" && rec.cardName
                ? rec.cardName
                : typeof rec.name === "string" && rec.name
                  ? rec.name
                  : null;
            if (grade != null || line != null) {
              return {
                status: "found" as const,
                grade,
                line,
                imageKey: null,
                imageBackKey: null,
                imageUrl: null,
                imageBackUrl: null,
                sourceUrl,
              };
            }
          }
        } catch {
          // fall through to unreachable
        }
        return { status: "unreachable" as const, ...blank };
      }

      if (args.company === "BGS") {
        // Beckett's card-lookup page: one attempt per scan.
        // Its platform has been rate-limiting automated reads
        // (HTTP 429 at build time), so unreachable is the
        // expected honest answer until Beckett serves it.
        const html = await fetchText(sourceUrl);
        if (html == null) {
          return { status: "unreachable" as const, ...blank };
        }
        const gradeMatch = html.match(
          /(?:final\s+grade|grade)["'>:\s]{0,12}(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)\b/i,
        );
        if (!gradeMatch) {
          return { status: "unreachable" as const, ...blank };
        }
        return {
          status: "found" as const,
          grade: gradeMatch[1] ?? null,
          line: null,
          imageKey: null,
          imageBackKey: null,
          imageUrl: null,
          imageBackUrl: null,
          sourceUrl,
        };
      }

      // CGC Cards: the cert-lookup page is a script-driven app
      // whose record data automated reads could not reach at
      // build time; try the page once and take a grade only if
      // the served HTML actually carries this cert beside one.
      const html = await fetchText(sourceUrl);
      if (html == null || !html.includes(cert)) {
        return { status: "unreachable" as const, ...blank };
      }
      const gradeMatch = html.match(
        /(?:grade)["'>:\s]{0,16}(Pristine 10|Perfect 10|10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1|Authentic)\b/i,
      );
      if (!gradeMatch) {
        return { status: "unreachable" as const, ...blank };
      }
      return {
        status: "found" as const,
        grade: gradeMatch[1] ?? null,
        line: null,
        imageKey: null,
        imageBackKey: null,
        imageUrl: null,
        imageBackUrl: null,
        sourceUrl,
      };
    },
  }),

  getGradedSlab: defineAction({
    description:
      "One saved graded slab with the full catalog card it belongs to — everything the Card / Slab View page shows: the slab record (company, cert, grade, paid, copy count, imported photos and where they came from, the company's online description line) and the card (game, name, set, number, rarity, catalog art, raw market price, total owned).",
    request: z.object({ id: z.number().int() }),
    response: z.object({
      slab: gradedSlabZ.nullable(),
      card: z
        .object({
          id: z.number(),
          game: z.string(),
          name: z.string(),
          printed: z.string(),
          sectionName: z.string(),
          rarity: z.string().nullable(),
          finish: z.string().nullable(),
          imageUrl: z.string().nullable(),
          price: z.number().nullable(),
          ownedQty: z.number(),
          ownedSealedQty: z.number(),
        })
        .nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(eq(schema.gradedSlabs.id, args.id));
      const slab = rows[0];
      if (!slab) return { slab: null, card: null };
      const cardRows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, slab.gameCardId));
      const card = cardRows[0];
      return {
        slab: await gradedSlabShape(ctx, slab),
        card: card
          ? {
              id: card.id,
              game: card.game,
              name: card.name,
              printed: card.printed,
              sectionName: card.sectionName,
              rarity: card.rarity,
              finish: card.finish,
              imageUrl: card.imageUrl,
              price: card.price,
              ownedQty: card.ownedQty,
              ownedSealedQty: card.ownedSealedQty,
            }
          : null,
      };
    },
  }),

  setGradedSlabQty: defineAction({
    description:
      "Sets how many copies are held under one graded slab's company+cert (the Card / Slab View stepper). The card's owned quantity moves by the same delta so the slab count and the card count never disagree; setting zero removes the slab record entirely. Saves immediately, like the card steppers.",
    request: z.object({
      id: z.number().int(),
      qty: z.number().int().min(0).max(999),
    }),
    response: z.object({
      ok: z.literal(true),
      qty: z.number(),
      removed: z.boolean(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; qty: number; removed: boolean }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(eq(schema.gradedSlabs.id, args.id));
      const slab = rows[0];
      if (!slab) return { ok: true as const, qty: 0, removed: true };
      const delta = args.qty - slab.qty;
      if (args.qty === 0) {
        await db
          .delete(schema.gradedSlabs)
          .where(eq(schema.gradedSlabs.id, args.id));
      } else if (delta !== 0) {
        await db
          .update(schema.gradedSlabs)
          .set({ qty: args.qty })
          .where(eq(schema.gradedSlabs.id, args.id));
      }
      if (delta !== 0) {
        await db
          .update(schema.gameCards)
          .set({
            ownedQty:
              delta > 0
                ? sql`${schema.gameCards.ownedQty} + ${delta}`
                : sql`max(0, ${schema.gameCards.ownedQty} - ${-delta})`,
          })
          .where(eq(schema.gameCards.id, slab.gameCardId));
      }
      if (delta !== 0 || args.qty === 0) {
        await markBackupDirty(ctx);
        await syncGameCardToCloud(ctx, slab.gameCardId);
      }
      ctx.invalidateQueries();
      return {
        ok: true as const,
        qty: args.qty,
        removed: args.qty === 0,
      };
    },
  }),

  updateGradedSlabPaid: defineAction({
    description:
      "Records (or clears) what was paid for one graded slab, from the Card / Slab View page. Per-copy price, exactly as the collector enters it — nothing is fetched or estimated.",
    request: z.object({
      id: z.number().int(),
      paid: z.number().min(0).max(100_000_000).nullable(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.gradedSlabs)
        .set({
          paid:
            args.paid != null && Number.isFinite(args.paid)
              ? args.paid
              : null,
        })
        .where(eq(schema.gradedSlabs.id, args.id));
      ctx.invalidateQueries();
      // Paid rides in the slab's cloud backup row — keep it
      // current like every other collection change.
      const slabRows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(eq(schema.gradedSlabs.id, args.id));
      if (slabRows[0]) {
        await markBackupDirty(ctx);
        await syncGameCardToCloud(ctx, slabRows[0].gameCardId);
      }
      return { ok: true as const };
    },
  }),

  saveGradedSlabPhoto: defineAction({
    description:
      "Saves the collector's own photo of a graded slab (front or back) over whatever photo the slab record currently shows — the honest replacement for a missing company photo or the catalog-art stand-in. The photo is stored in app storage and the slab's photo source becomes \"user\" so the UI always says whose photo it is.",
    request: z.object({
      id: z.number().int(),
      side: z.enum(["front", "back"]),
      imageBase64: z.string().min(100).max(9_000_000),
    }),
    response: z.object({
      ok: z.boolean(),
      imageUrl: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gradedSlabs)
        .where(eq(schema.gradedSlabs.id, args.id));
      const slab = rows[0];
      if (!slab) return { ok: false, imageUrl: null };
      let bytes: Uint8Array;
      try {
        const clean = args.imageBase64.replace(
          /^data:image\/[a-z+]+;base64,/i,
          "",
        );
        bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
      } catch {
        return { ok: false, imageUrl: null };
      }
      if (bytes.length < 100 || bytes.length > 9_000_000) {
        return { ok: false, imageUrl: null };
      }
      const key = `graded-slab/${slab.company.toLowerCase()}/${slab.cert}/user-${args.side}.jpg`;
      await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
      if (args.side === "front") {
        await db
          .update(schema.gradedSlabs)
          .set({ imageKey: key, imageSource: "user" })
          .where(eq(schema.gradedSlabs.id, args.id));
      } else {
        await db
          .update(schema.gradedSlabs)
          .set({ imageBackKey: key })
          .where(eq(schema.gradedSlabs.id, args.id));
      }
      ctx.invalidateQueries();
      return { ok: true, imageUrl: await safeBlobUrl(ctx, key) };
    },
  }),

  readGradedSlabPhoto: defineAction({
    description:
      "Reads a photo of a graded slab's label with vision and returns what is printed on it: the grading company the label belongs to, the certification number (copied character for character exactly as printed, leading zeros and TAG's leading letter kept), the grade, and the label's card description line. It reads THIS slab's label only — it does not look the cert up with any company and does not verify anything. Any field the photo does not show clearly comes back null so the collector can type it instead of the app guessing.",
    request: z.object({
      imageBase64: z.string().min(100).max(9_000_000),
      /** The company the collector picked before taking the
          photo; the read still reports the company it
          actually sees on the label. */
      company: z.enum(["PSA", "BGS", "SGC", "CGC", "TAG"]),
    }),
    response: z.object({
      company: z
        .enum(["PSA", "BGS", "SGC", "CGC", "TAG"])
        .nullable(),
      cert: z.string().nullable(),
      grade: z.string().nullable(),
      labelText: z.string().nullable(),
    }),
    async handler(ctx, args) {
      if (agentCapabilityBlocked(ctx)) {
        return {
          company: null,
          cert: null,
          grade: null,
          labelText: null,
        };
      }
      const readSchema = z.object({
        company: z.string().nullable(),
        certNumber: z.string().nullable(),
        grade: z.string().nullable(),
        cardDescription: z.string().nullable(),
      });
      const COMPANY_NAMES: Record<GradingCompanyKey, string> = {
        PSA: "PSA",
        BGS: "Beckett (BGS)",
        SGC: "SGC",
        CGC: "CGC Cards",
        TAG: "TAG",
      };
      try {
        const read = await Promise.race([
          ctx.inference.complete(
            `Read the grading label in this photo of a graded card slab. The collector believes it is a ${COMPANY_NAMES[args.company]} slab, but report what the label actually shows. The label is the printed band at the top of the slab (several companies also print a QR code and a barcode; TAG prints its text into the clear case itself). Report: company — the grading company named on the label, exactly one of PSA, BGS, SGC, CGC, TAG (Beckett labels say BECKETT and count as BGS), or null if no company name is readable; certNumber — the certification number printed on the label, copied character for character exactly as printed INCLUDING any leading zeros, any leading letter (TAG certs look like F6396638), and any hyphen (SGC's long format looks like 1234567-890); grade — the grade printed on the label: the number (for example 10, 9.5, 9, or 8.5), or Pristine 10 / Perfect 10 when the label prints those words beside a 10, or the word Authentic when the label says AUTHENTIC instead of a number; cardDescription — the card description lines printed on the label (year, brand or set, card number, player or subject, and any variety like Refractor or 1st Edition), as one line of text. If a field is not clearly readable in the photo, report null for it instead of guessing.`,
            {
              schema: readSchema,
              images: [
                {
                  dataBase64: args.imageBase64,
                  mimeType: "image/jpeg",
                  caption:
                    "Photo of a graded card slab label to read",
                },
              ],
            },
          ),
          new Promise<never>((_resolve, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Label read timed out — type the cert number instead.",
                  ),
                ),
              25_000,
            );
          }),
        ]);
        const seenCompany = (read.company ?? "")
          .trim()
          .toUpperCase();
        const company: GradingCompanyKey | null =
          seenCompany === "PSA" ||
          seenCompany === "BGS" ||
          seenCompany === "BECKETT"
            ? seenCompany === "PSA"
              ? "PSA"
              : "BGS"
            : seenCompany === "SGC" ||
                seenCompany === "CGC" ||
                seenCompany === "TAG"
              ? seenCompany
              : null;
        const effectiveCompany = company ?? args.company;
        const certRaw = normalizeGradedCert(
          effectiveCompany,
          read.certNumber ?? "",
        );
        const cert = gradedCertValid(effectiveCompany, certRaw)
          ? certRaw
          : null;
        const rawGrade = (read.grade ?? "").trim();
        let grade: string | null = null;
        if (/authentic/i.test(rawGrade)) {
          grade = "Authentic";
        } else if (/perfect/i.test(rawGrade)) {
          grade = "Perfect 10";
        } else if (/pristine/i.test(rawGrade)) {
          grade = "Pristine 10";
        } else {
          const m = rawGrade.match(
            /10(?:\.0)?|9\.5|9(?:\.0)?|8\.5|8(?:\.0)?|7\.5|7(?:\.0)?|6\.5|6(?:\.0)?|5\.5|5(?:\.0)?|4\.5|4(?:\.0)?|3\.5|3(?:\.0)?|2\.5|2(?:\.0)?|1\.5|1(?:\.0)?/,
          );
          if (m) grade = m[0].replace(/\.0$/, "");
        }
        if (
          grade != null &&
          !gradedGradeValid(effectiveCompany, grade)
        ) {
          grade = null;
        }
        return {
          company,
          cert,
          grade,
          labelText: read.cardDescription?.trim()
            ? read.cardDescription.trim()
            : null,
        };
      } catch {
        return {
          company: null,
          cert: null,
          grade: null,
          labelText: null,
        };
      }
    },
  }),

  getGameCardMarket: defineAction({
    description:
      "A Funko item's market view (Anthony, Nov 4, 2026): its value history over time plus the current sold-based values, from eBay SOLD data (the researched snapshot in data/funkoSoldPrices.ts, PriceCharting's completed-sales values) and the daily recorded points. Items with no sold data return snapshot: null and the app says no recent sales are recorded — values are never invented.",
    request: z.object({ id: z.number().int() }),
    response: z.object({
      snapshot: z
        .object({
          asOf: z.string(),
          snapshotDate: z.string(),
          sourceUrl: z.string(),
          outOfBox: z.number(),
          inBox: z.number(),
          newSealed: z.number(),
        })
        .nullable(),
      history: z.array(
        z.object({
          date: z.string(),
          label: z.string(),
          unitValue: z.number(),
          source: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const snap = funkoSoldSnapshotFor(args.id);
      const rows = await db
        .select()
        .from(schema.gameCardPriceHistory)
        .where(eq(schema.gameCardPriceHistory.gameCardId, args.id));
      const points = rows
        .map((r) => ({
          date: r.date,
          label: r.label,
          unitValue: r.unitValue,
          source: r.source,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      // Backfill (Anthony, Nov 4, 2026): the researched
      // snapshot is itself a real sold-data point at its
      // as-of date, so the history starts there even before
      // the first daily recording lands.
      if (snap && !points.some((p) => p.date === snap.asOf)) {
        points.unshift({
          date: snap.asOf,
          label: snap.asOf,
          unitValue: snap.inBox,
          source: "ebay-sold",
        });
        points.sort((a, b) => a.date.localeCompare(b.date));
      }
      return {
        snapshot: snap
          ? {
              asOf: snap.asOf,
              snapshotDate: FUNKO_SOLD_SNAPSHOT_DATE,
              sourceUrl: snap.sourceUrl,
              outOfBox: snap.outOfBox,
              inBox: snap.inBox,
              newSealed: snap.newSealed,
            }
          : null,
        history: points,
      };
    },
  }),

  recordFunkoDailyPoints: defineAction({
    description:
      "Daily Funko market recording (Anthony, Nov 4, 2026): for every Funko figure with researched eBay sold data, appends today's value point (the In Box sold-based value) to its value history and refreshes its catalog price, so Funko value history accumulates on the same daily cadence as the cards' re-pricing. Idempotent per day; figures with no sold data are untouched.",
    request: z.object({}),
    response: z.object({ recorded: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const today = new Date().toISOString().slice(0, 10);
      let recorded = 0;
      for (const snap of FUNKO_SOLD_PRICES) {
        const existing = await db
          .select()
          .from(schema.gameCardPriceHistory)
          .where(
            and(
              eq(schema.gameCardPriceHistory.gameCardId, snap.cardId),
              eq(schema.gameCardPriceHistory.date, today),
            ),
          );
        if (existing.length === 0) {
          await db.insert(schema.gameCardPriceHistory).values({
            gameCardId: snap.cardId,
            date: today,
            label: today,
            unitValue: snap.inBox,
            source: "daily",
          });
          recorded++;
        }
        await db
          .update(schema.gameCards)
          .set({ price: snap.inBox })
          .where(eq(schema.gameCards.id, snap.cardId));
      }
      if (recorded > 0) ctx.invalidateQueries();
      return { recorded };
    },
  }),

  getLegoSetDetail: defineAction({
    description:
      "Everything a Lego set's built-out detail page shows beyond the catalog row: the catalog facts unpacked (subtheme, year, pieces), the researched product facts and market data (Brickset/BrickLink/BrickEconomy/Rebrickable/Brickfact, saved by research tasks — null until researched, and the page says so), the collector's own ownership notes (paid, condition, completeness, date added), and the set's recorded value-history points.",
    request: z.object({ id: z.number().int() }),
    response: z.object({
      facts: z.object({
        subtheme: z.string().nullable(),
        year: z.number().nullable(),
        pieces: z.number().nullable(),
      }),
      details: legoDetailsShape.nullable(),
      notes: z
        .object({
          paidPriceUsd: z.number().nullable(),
          condition: z.string().nullable(),
          completeness: z.string().nullable(),
          missingPieces: z.number().nullable(),
          dateAdded: z.string().nullable(),
        })
        .nullable(),
      history: z.array(
        z.object({
          date: z.string(),
          label: z.string(),
          unitValue: z.number(),
          source: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const row = rows[0];
      const facts = row
        ? legoCatalogFacts(row)
        : { subtheme: null, year: null, pieces: null };
      const detailRows = await db
        .select()
        .from(schema.legoSetDetails)
        .where(eq(schema.legoSetDetails.gameCardId, args.id));
      const noteRows = await db
        .select()
        .from(schema.legoOwnershipNotes)
        .where(eq(schema.legoOwnershipNotes.gameCardId, args.id));
      const histRows = await db
        .select()
        .from(schema.gameCardPriceHistory)
        .where(eq(schema.gameCardPriceHistory.gameCardId, args.id));
      const note = noteRows[0];
      return {
        facts,
        details: detailRows[0] ? legoDetailsOf(detailRows[0]) : null,
        notes: note
          ? {
              paidPriceUsd: note.paidPriceUsd,
              condition: note.condition,
              completeness: note.completeness,
              missingPieces: note.missingPieces,
              dateAdded: note.dateAdded,
            }
          : null,
        history: histRows
          .map((r) => ({
            date: r.date,
            label: r.label,
            unitValue: r.unitValue,
            source: r.source,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
  }),

  saveLegoSetResearch: defineAction({
    description:
      "Saves one Lego set's researched product facts and market data (from Brickset, BrickLink, BrickEconomy, Rebrickable, and Brickfact) for its detail page: release/retirement dates, US retail price, ages, barcodes, dimensions, the official description, the minifigure list with exclusivity and values, the parts inventory summary, part-out value, sealed vs used market values, forecasts (stored as forecasts), recent real sold listings with dates and sources, current retailer prices, dated value-history points, and the source pages used. Any field without real published data is saved as null and shows as unavailable — never invented. Also refreshes the catalog row's market price and appends today's market point to the set's value history.",
    request: legoDetailsShape
      .omit({ researchedAt: true })
      .extend({
        historyPoints: z.array(
          z.object({
            date: z.string(),
            label: z.string(),
            unitValue: z.number(),
            source: z.string(),
          }),
        ),
      }),
    response: z.object({ ok: z.literal(true), gameCardId: z.number() }),
    async handler(
      ctx,
      args,
    ): Promise<{ ok: true; gameCardId: number }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(
          and(
            eq(schema.gameCards.game, "lego"),
            eq(schema.gameCards.uid, `lego:${args.setNum}`),
          ),
        );
      const row = rows[0];
      if (!row) {
        throw new Error(`No Lego catalog row for set ${args.setNum}`);
      }
      const today = new Date().toISOString().slice(0, 10);
      const values = {
        gameCardId: row.id,
        setNum: args.setNum,
        releaseDate: args.releaseDate,
        retailPriceUsd: args.retailPriceUsd,
        ages: args.ages,
        upc: args.upc,
        ean: args.ean,
        dimensions: args.dimensions,
        weightGrams: args.weightGrams,
        buildTime: args.buildTime,
        description: args.description,
        availability: args.availability,
        retiredDate: args.retiredDate,
        expectedRetirement: args.expectedRetirement,
        minifigsJson: JSON.stringify(args.minifigs),
        minifigsValueUsd: args.minifigsValueUsd,
        partsDistinct: args.partsDistinct,
        partsSpares: args.partsSpares,
        partOutValueUsd: args.partOutValueUsd,
        marketSealedUsd: args.marketSealedUsd,
        marketUsedUsd: args.marketUsedUsd,
        usedRange: args.usedRange,
        annualGrowthPct: args.annualGrowthPct,
        forecast1yrUsd: args.forecast1yrUsd,
        forecast5yrUsd: args.forecast5yrUsd,
        soldListingsJson: JSON.stringify(args.soldListings),
        retailersJson: JSON.stringify(args.retailers),
        sourcesJson: JSON.stringify(args.sources),
        researchedAt: today,
      };
      const existing = await db
        .select()
        .from(schema.legoSetDetails)
        .where(eq(schema.legoSetDetails.gameCardId, row.id));
      if (existing.length === 0) {
        await db.insert(schema.legoSetDetails).values(values);
      } else {
        await db
          .update(schema.legoSetDetails)
          .set(values)
          .where(eq(schema.legoSetDetails.gameCardId, row.id));
      }
      // Value history: the researcher's dated published points
      // plus today's point at the current market value (sealed
      // when published, else used). Deduped on date + source so
      // a re-research never double-plots a point.
      const points = [...args.historyPoints];
      const marketNow = args.marketSealedUsd ?? args.marketUsedUsd;
      if (marketNow != null) {
        points.push({
          date: today,
          label: today,
          unitValue: marketNow,
          source: "BrickEconomy",
        });
      }
      for (const p of points) {
        const dup = await db
          .select()
          .from(schema.gameCardPriceHistory)
          .where(
            and(
              eq(schema.gameCardPriceHistory.gameCardId, row.id),
              eq(schema.gameCardPriceHistory.date, p.date),
              eq(schema.gameCardPriceHistory.source, p.source),
            ),
          );
        if (dup.length === 0) {
          await db.insert(schema.gameCardPriceHistory).values({
            gameCardId: row.id,
            date: p.date,
            label: p.label,
            unitValue: p.unitValue,
            source: p.source,
          });
        }
      }
      if (marketNow != null) {
        await db
          .update(schema.gameCards)
          .set({ price: marketNow })
          .where(eq(schema.gameCards.id, row.id));
      }
      ctx.invalidateQueries();
      return { ok: true as const, gameCardId: row.id };
    },
  }),

  researchLegoSet: defineAction({
    description:
      "Starts a research task for one Lego set's detail page: the agent reads the set's pages on Brickset, BrickLink, BrickEconomy, Rebrickable, and Brickfact and saves the verified product facts and market data through saveLegoSetResearch. Fields no source publishes stay empty and show as unavailable; the task never invents a number.",
    request: z.object({ id: z.number().int() }),
    response: z.object({
      started: z.boolean(),
      taskId: z.string().nullable(),
    }),
    async handler(
      ctx,
      args,
    ): Promise<{ started: boolean; taskId: string | null }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const row = rows[0];
      if (!row || row.game !== "lego") {
        return { started: false, taskId: null };
      }
      // Guest access (platform v27): agent tasks are
      // owner-only and unavailable in the shared runtime.
      if (agentCapabilityBlocked(ctx)) {
        return { started: false, taskId: null };
      }
      const setNum = row.number ?? row.printed;
      const today = new Date().toISOString().slice(0, 10);
      const result = await ctx.agent.spawnTask(
        [
          `Research the LEGO set ${setNum} "${row.name}" (theme ${row.sectionName}) for the Vault X Lego detail page, and save what you verify through the artifact's saveLegoSetResearch action.`,
          "Read the set's pages on Brickset (brickset.com/sets/<set number>), BrickLink (catalog item page for the set), BrickEconomy (brickeconomy.com set page), Rebrickable (rebrickable.com set page), and Brickfact (brickfact.com set page). Use ONLY values those pages actually publish; if sources disagree, save the value from the most specific source for that field (BrickEconomy for market values and dates, BrickLink for inventory and part-out, Rebrickable for the parts inventory) and include every page you used in the sources list with its exact URL.",
          "Save these fields (leave any field null when no source publishes it — never estimate, round from memory, or invent): releaseDate (yyyy-mm-dd), retailPriceUsd (US RRP at release), ages, upc, ean, dimensions (built model, source wording), weightGrams, buildTime (label estimates as estimates in the text), description (the official LEGO description, verbatim), availability, retiredDate (yyyy-mm-dd) or expectedRetirement (labeled an estimate), minifigs (each: name, code, uniqueToSet, valueUsd), minifigsValueUsd, partsDistinct, partsSpares, partOutValueUsd (BrickLink part-out total only — labelled part-out, never a set value), marketSealedUsd and marketUsedUsd (current, with usedRange when published), annualGrowthPct, forecast1yrUsd and forecast5yrUsd (only a source's published forecasts), soldListings (real completed sales only: date, priceUsd, condition sealed or used, title, source, sourceUrl — asking prices never count as sales), retailers (current listings for a sealed copy: name, priceUsd, url — these are asking prices and the app labels them so), historyPoints (dated published value points only: date, label, unitValue, source — no interpolation), sources (label + exact URL for every page used).",
          `Call saveLegoSetResearch ONCE with setNum "${setNum}" and everything you verified. Do not change ownership, prices on any other item, or any files.`,
        ].join("\n"),
        {
          expectsAction: "saveLegoSetResearch",
          dedupeKey: `lego-research-${setNum}-${today}`,
        },
      );
      return {
        started: result.ok,
        taskId: result.ok ? result.taskId : null,
      };
    },
  }),

  setLegoOwnershipNotes: defineAction({
    description:
      "Saves the collector's own record for one Lego set: what they paid per copy, the copy's condition, its completeness and missing-pieces count. Saving notes for an already-owned set also stamps its date added (today) when none is recorded — the date is the day the record is made, never backdated or guessed.",
    request: z.object({
      id: z.number().int(),
      paidPriceUsd: z.number().min(0).max(1000000).nullable(),
      condition: z
        .enum([
          "new_sealed",
          "built_complete",
          "built_incomplete",
          "in_pieces",
        ])
        .nullable(),
      completeness: z
        .enum(["complete", "missing_pieces", "unknown"])
        .nullable(),
      missingPieces: z.number().int().min(0).max(100000).nullable(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.id, args.id));
      const row = rows[0];
      const existing = await db
        .select()
        .from(schema.legoOwnershipNotes)
        .where(eq(schema.legoOwnershipNotes.gameCardId, args.id));
      const owned =
        (row?.ownedQty ?? 0) + (row?.ownedSealedQty ?? 0) > 0;
      const today = new Date().toISOString().slice(0, 10);
      const dateAdded =
        existing[0]?.dateAdded ?? (owned ? today : null);
      const values = {
        gameCardId: args.id,
        paidPriceUsd: args.paidPriceUsd,
        condition: args.condition,
        completeness: args.completeness,
        missingPieces: args.missingPieces,
        dateAdded,
      };
      if (existing.length === 0) {
        await db.insert(schema.legoOwnershipNotes).values(values);
      } else {
        await db
          .update(schema.legoOwnershipNotes)
          .set(values)
          .where(eq(schema.legoOwnershipNotes.gameCardId, args.id));
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  purgeFunkoNonToys: defineAction({
    description:
      "Removes the Funko catalog's non-toy rows (apparel, pins, Pez, books, home goods, board games, shirt/glass bundles — Anthony's toys-only rule for the section; plush stays). Rows the collector owns are never deleted; they are counted and reported instead. Idempotent: a second run removes nothing.",
    request: z.object({}),
    response: z.object({
      removed: z.number(),
      keptOwned: z.number(),
      remaining: z.number(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.gameCards)
        .where(eq(schema.gameCards.game, "funko"));
      let removed = 0;
      let keptOwned = 0;
      for (const r of rows) {
        const tags = [
          r.sectionName,
          ...(r.finish ? r.finish.split(", ") : []),
        ];
        if (!funkoIsNonToy(tags, r.name)) continue;
        if (r.ownedQty > 0 || r.ownedSealedQty > 0) {
          keptOwned += 1;
          continue;
        }
        await db
          .delete(schema.gameCards)
          .where(eq(schema.gameCards.id, r.id));
        removed += 1;
      }
      const after = await db
        .select({ id: schema.gameCards.id })
        .from(schema.gameCards)
        .where(eq(schema.gameCards.game, "funko"));
      ctx.invalidateQueries();
      return { removed, keptOwned, remaining: after.length };
    },
  }),

  getLibraryOrder: defineAction({
    description:
      "The signed-in collector's saved Library arrangement (shelf order and spine order from their drag-to-reorder), or empty lists when they have never arranged it.",
    request: z.object({}),
    response: z.object({
      sections: z.array(z.string()),
      entries: z.array(z.string()),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const rows = await db
        .select()
        .from(schema.libraryOrders)
        .where(
          eq(schema.libraryOrders.collectorCode, profile.collectorCode),
        )
        .limit(1);
      let sections: string[] = [];
      let entries: string[] = [];
      try {
        const parsed = JSON.parse(rows[0]?.orderJson ?? "{}") as {
          sections?: unknown;
          entries?: unknown;
        };
        if (Array.isArray(parsed.sections)) {
          sections = parsed.sections.filter(
            (s): s is string => typeof s === "string",
          );
        }
        if (Array.isArray(parsed.entries)) {
          entries = parsed.entries.filter(
            (s): s is string => typeof s === "string",
          );
        }
      } catch {
        // A corrupt saved order falls back to natural order.
      }
      return { sections, entries };
    },
  }),

  saveLibraryOrder: defineAction({
    description:
      "Saves the collector's Library arrangement (shelf order and spine order) from the Library's drag-to-reorder, as their own per-user preference.",
    request: z.object({
      sections: z.array(z.string()).max(40),
      entries: z.array(z.string()).max(400),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const profile = await ensureCollectorProfile(ctx);
      const orderJson = JSON.stringify({
        sections: args.sections,
        entries: args.entries,
      });
      const existing = await db
        .select({ collectorCode: schema.libraryOrders.collectorCode })
        .from(schema.libraryOrders)
        .where(
          eq(schema.libraryOrders.collectorCode, profile.collectorCode),
        )
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(schema.libraryOrders)
          .set({ orderJson, updatedAt: Date.now() })
          .where(
            eq(
              schema.libraryOrders.collectorCode,
              profile.collectorCode,
            ),
          );
      } else {
        await db.insert(schema.libraryOrders).values({
          collectorCode: profile.collectorCode,
          orderJson,
          updatedAt: Date.now(),
        });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  importGameCatalog: defineAction({
    description:
      "Downloads the next chunk of one game's catalog from its canonical free source (Pokémon: PokemonTCG/pokemon-tcg-data; Magic: Scryfall; Star Wars: Unlimited: Fantasy Flight's official card API; Funko Pop!: the open-source funko-pop-data dataset scraped from Pop Price Guide / HobbyDB; Lego: Rebrickable's official bulk catalog downloads; Topps baseball, Bowman baseball, Topps basketball, Disney Topps, Star Wars Topps, Garbage Pail Kids, and WWE Topps: Topps' own official product checklists from topps.com/pages/checklists, text data only — no artwork) into game_cards and returns the running progress. Resumable: each call continues where the last stopped until the catalog is complete; existing printings and owned counts are never overwritten.",
    request: z.object({
      game: z.enum(["pokemon", "magic", "starwars", "funko", "lego", "topps", "bowman", "topps-basketball", "disney-topps", "starwars-topps", "gpk", "wwe-topps"]),
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
              : args.game === "funko"
                ? await importFunkoChunk(ctx, state)
                : args.game === "lego"
                  ? await importLegoChunk(ctx, state)
                  : args.game === "topps" ||
                      args.game === "bowman" ||
                      args.game === "topps-basketball" ||
                      args.game === "disney-topps" ||
                      args.game === "starwars-topps" ||
                      args.game === "gpk" ||
                      args.game === "wwe-topps"
                    ? await importToppsChunk(ctx, state, args.game)
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
            state.sets?.length ??
            state.files?.length ??
            state.totalPages ??
            meta?.setsTotal ??
            0;
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
      // Established means the user actually registered or set
      // up a photo — a registry sync stamp deliberately does
      // NOT count (Nov 9, 2026): the app's own auto-sync used
      // to stamp it on a fresh install's first open, which
      // flipped brand-new users into the dismissible
      // "returning" welcome so they never chose a username at
      // all and stayed on the seeded default name.
      const established =
        profile.registeredAt != null || profile.photoBlobKey != null;
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
      "Registers the username chosen on the Welcome page (Anthony, Nov 3, 2026): re-checks availability against the network registry and enforces uniqueness server-side (Nov 9, 2026) — a name held by another collector is refused, and an unreadable registry fails the registration closed rather than saving an unverified name. Saves the username on the profile and stamps registered_at — the profile's Collector ID (username + its stable code) is created from it. Registration never consumes the user's one later username change. The client follows with syncCollectorRegistry to write the row to the network registry.",
    request: z.object({
      username: z
        .string()
        .trim()
        .regex(
          /^[A-Za-z0-9_]{3,20}$/,
          "Use 3-20 letters, numbers, or underscores",
        ),
      /** Optional invite code from a Share Vault X invite
          (Anthony, Nov 4, 2026 — invite lineage): resolved
          server-side against the registry roster; a code that
          matches nobody is ignored (no voucher on file) and
          NEVER blocks registration. The newcomer presents a
          code from the invite itself — never a typed name. */
      inviteCode: z.string().trim().max(24).optional(),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
      username: z.string().nullable(),
      collectorCode: z.string().nullable(),
      /** The inviter's username when the presented invite
          code resolved, so the Welcome page can confirm whose
          invite it was; null when no code / no match. */
      vouchedByUsername: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const profile = await ensureCollectorProfile(ctx);
      if (
        args.username.toLowerCase() !== profile.username.toLowerCase()
      ) {
        // Username uniqueness is enforced here, server-side
        // (Nov 9, 2026): a name held by a different collector
        // code is refused, and if the registry cannot be read
        // the registration fails closed with an honest error
        // instead of saving an unverified name that could turn
        // out to be a duplicate.
        const taken = await registryUsernameTakenByOther(
          profile.collectorCode,
          args.username,
        );
        if (taken === null) {
          return {
            ok: false,
            error:
              "Couldn't check that username against the network just now — check your connection and try again.",
            username: null,
            collectorCode: null,
            vouchedByUsername: null,
          };
        }
        if (taken) {
          return {
            ok: false,
            error: "That username is already taken on the network.",
            username: null,
            collectorCode: null,
            vouchedByUsername: null,
          };
        }
      }
      const db = ctx.db<typeof schema>();
      const now = new Date().toISOString();
      // Invite lineage (Anthony, Nov 4, 2026): resolve the
      // presented invite code to the inviting collector and
      // record it on the new profile + the lineage ledger.
      // No valid code = "no voucher on file", recorded by
      // absence; a code naming the registrant themself is
      // ignored (nobody vouches themself in). Lineage is
      // provenance only — it never touches the badge.
      let voucher: { collectorId: string; username: string } | null =
        null;
      if (args.inviteCode) {
        const resolved = await resolveInviteCode(args.inviteCode);
        if (resolved && resolved.collectorId !== profile.collectorCode)
          voucher = resolved;
      }
      await db
        .update(schema.collectorProfile)
        .set({
          username: args.username,
          registeredAt: now,
          updatedAt: now,
          vouchedByCode: voucher?.collectorId ?? null,
          vouchedByUsername: voucher?.username ?? null,
          vouchedAt: voucher ? now : null,
        })
        .where(eq(schema.collectorProfile.id, 1));
      if (voucher) {
        await db
          .insert(schema.inviteLineage)
          .values({
            newCollectorCode: profile.collectorCode,
            newUsername: args.username,
            vouchedByCode: voucher.collectorId,
            vouchedByUsername: voucher.username,
            source: "registration",
            createdAt: now,
          })
          .onConflictDoNothing();
      }
      ctx.invalidateQueries();
      return {
        ok: true,
        error: null,
        username: args.username,
        collectorCode: profile.collectorCode,
        vouchedByUsername: voucher?.username ?? null,
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
      "Hands a deck's missing-cards buy list to the signed-in collector's own Muse (restored Nov 4, 2026 at Anthony's explicit direction after he reviewed exactly what it sends): re-runs the deck-vs-collection check server-side and spawns an agent task carrying ONLY the missing copies' public TCGplayer product IDs and quantities, instructing the Muse to build the cart on TCGplayer under the user's own sign-in (Near Mint, his standing shipping rules) and NEVER to check out — final payment approval stays with the user. Fires only behind the client's per-run confirmed:true gate; missing copies without a TCGplayer product ID are counted and disclosed, never sent.",
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
      confirmed: z.literal(true),
    }),
    response: buyListHandoffResponse,
    async handler(ctx, args): Promise<BuyListHandoffResult> {
      const merged = new Map<number, number>();
      for (const l of args.lines)
        merged.set(l.cardId, (merged.get(l.cardId) ?? 0) + l.qty);
      const lines = [...merged.entries()].map(([cardId, qty]) => ({
        cardId,
        qty,
      }));
      const check = await checkDeckLines(ctx, lines);
      return spawnBuyListHandoff(
        ctx,
        check.buyList.map((l) => ({
          tcgplayerId: l.tcgplayerId,
          qty: l.shortfall,
        })),
        "deck",
      );
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
      "Opens a change-request TICKET for the developer (Anthony, Nov 3, 2026 — the ticket system that replaced the email model): a type (change request, bug, or idea) plus a text message from the Settings form, with an optional screenshot (Anthony, Nov 4, 2026 — bug-form photo upload; JPEG bytes as base64, stored in blob storage so the photo travels with the ticket for the admin and the sender). Stamped server-side with the sender's username, Collector ID, and date; the ticket starts Open and unassigned, the sender can follow it under Your tickets in Settings, and Anthony works it from his ticket list. Returns the new ticket's number.",
    request: z.object({
      kind: z.enum(["change", "bug", "idea"]),
      message: z.string().min(1).max(1000),
      imageBase64: z.string().min(100).max(9_000_000).optional(),
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
      const ticketId = inserted[0]?.id ?? null;
      if (ticketId != null && args.imageBase64) {
        const key = `ticket-photos/${ticketId}.jpg`;
        const bytes = Uint8Array.from(
          atob(args.imageBase64),
          (c) => c.charCodeAt(0),
        );
        await ctx.blobs.put(key, bytes, { contentType: "image/jpeg" });
        await db
          .update(schema.changeRequests)
          .set({ photoBlobKey: key })
          .where(eq(schema.changeRequests.id, ticketId));
      }
      return { ok: true, error: null, ticketId };
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
          photoUrl: z.string().nullable(),
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
        requests: await Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            senderCode: r.senderCode,
            senderUsername: r.senderUsername,
            kind: r.kind,
            message: r.message,
            createdAt: r.createdAt,
            readAt: r.readAt ?? null,
            status: r.status ?? "open",
            assignee: r.assignee ?? null,
            photoUrl: r.photoBlobKey
              ? await ctx.blobs.getUrl(r.photoBlobKey)
              : null,
          })),
        ),
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
          completedAt: z.string().nullable(),
          assignee: z.string().nullable(),
          photoUrl: z.string().nullable(),
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
        tickets: await Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            kind: r.kind,
            message: r.message,
            createdAt: r.createdAt,
            status: r.status ?? "open",
            completedAt: r.completedAt ?? null,
            assignee: r.assignee ?? null,
            photoUrl: r.photoBlobKey
              ? await ctx.blobs.getUrl(r.photoBlobKey)
              : null,
          })),
        ),
      };
    },
  }),

  sendDeckByMail: defineAction({
    description:
      "Shares one of the sender's decks with a connected collector as plain-text mail (Anthony, Nov 4, 2026 — deck sharing, simplified at his direction): the deck renders server-side to a plain-text list — deck name and inks at the top, then one line per card (quantity, card name, collector number, set) — and lands in the recipient's Inbox as a mail message they can read and use. No shared-deck object is created and the sender's deck is untouched. The recipient must be on the Collector ID registry.",
    request: z.object({
      deckId: z.number().int().positive(),
      toCode: z.string().min(1).max(40),
    }),
    response: z.object({
      ok: z.boolean(),
      error: z.string().nullable(),
    }),
    async handler(ctx, args) {
      const fail = (error: string) => ({ ok: false, error });
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      if (args.toCode === me)
        return fail("Pick someone other than yourself.");
      const db = ctx.db<typeof schema>();
      const deckRows = await db
        .select()
        .from(schema.decks)
        .where(eq(schema.decks.id, args.deckId));
      const deck = deckRows[0];
      if (!deck || deck.ownerCode !== me)
        return fail("That deck isn't yours to share.");
      const list = await supabaseRest(
        "profiles?select=collector_id,username&order=created_at.asc",
      );
      const registryRows = list.ok ? asRegistryRows(list.json) : [];
      const recipient = registryRows.find(
        (r) => r.collector_id === args.toCode,
      );
      if (!recipient)
        return fail("That collector isn't on the network anymore.");
      const lines = parseDeckCards(deck.cardsJson);
      if (lines.length === 0)
        return fail("That deck has no cards to share yet.");
      const cardRows = await db
        .select()
        .from(schema.cards)
        .where(
          inArray(
            schema.cards.id,
            lines.map((l) => l.cardId),
          ),
        );
      const byId = new Map(cardRows.map((r) => [r.id, r]));
      const inks = [
        ...new Set(
          cardRows.map((r) => r.ink).filter((i): i is string => Boolean(i)),
        ),
      ];
      const total = lines.reduce((sum, l) => sum + l.qty, 0);
      const bodyLines = [
        deck.name,
        inks.length > 0 ? `Inks: ${inks.join(" / ")}` : null,
        `${total} cards`,
        "",
        ...lines.map((l) => {
          const c = byId.get(l.cardId);
          if (!c) return `${l.qty} × (unknown card)`;
          const num = c.number != null ? ` #${c.number}` : "";
          return `${l.qty} × ${c.fullName}${num} · ${c.groupName}`;
        }),
      ].filter((l): l is string => l != null);
      await db.insert(schema.mailMessages).values({
        fromCode: me,
        fromUsername: profile.username,
        toCode: recipient.collector_id,
        toUsername: recipient.username,
        subject: `Deck list: ${deck.name}`,
        body: bodyLines.join("\n"),
        createdAt: new Date().toISOString(),
      });
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  getMailMessage: defineAction({
    description:
      "One mail message for its recipient (or its sender): subject, from, date, and the full body text. Opening it as the recipient stamps it read, which clears its NEW badge in the Inbox. Anyone else gets found=false.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({
      found: z.boolean(),
      subject: z.string(),
      fromUsername: z.string(),
      toUsername: z.string(),
      date: z.string(),
      body: z.string(),
    }),
    async handler(ctx, args) {
      const empty = {
        found: false,
        subject: "",
        fromUsername: "",
        toUsername: "",
        date: "",
        body: "",
      };
      const profile = await ensureCollectorProfile(ctx);
      const me = profile.collectorCode;
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.mailMessages)
        .where(eq(schema.mailMessages.id, args.id));
      const msg = rows[0];
      if (!msg || (msg.toCode !== me && msg.fromCode !== me)) return empty;
      if (msg.toCode === me && !msg.readAt) {
        await db
          .update(schema.mailMessages)
          .set({ readAt: new Date().toISOString() })
          .where(eq(schema.mailMessages.id, msg.id));
        ctx.invalidateQueries();
      }
      return {
        found: true,
        subject: msg.subject,
        fromUsername: msg.fromUsername,
        toUsername: msg.toUsername,
        date: msg.createdAt,
        body: msg.body,
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
        .set({
          status: args.status,
          // The completion stamp drives the sender's
          // one-week rule (Nov 5, 2026): entering Completed
          // stamps the moment; leaving it clears the stamp.
          completedAt:
            args.status === "completed"
              ? new Date().toISOString()
              : null,
        })
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
          .select({
            status: schema.marketplaceListings.status,
            photoStatus: schema.marketplaceListings.photoStatus,
          })
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
        // Usage-journal backup rows (kind "journal") ride the
        // same table but are not collection items: they never
        // count toward copies, kinds, rosters, or most-owned.
        if (item.kind === "journal") continue;
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
        // "Logged items" (totalRows) and "Cards logged"
        // (cardsLogged) are no longer tracked or shown
        // (Anthony, Nov 9, 2026): they overlapped the one
        // total-copies stat, so the redundant counters
        // were deleted entirely.
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
      // Photo review queue (Anthony, Nov 4, 2026): a rising
      // pending count lights the Admin shield like any other
      // change, so a photo waiting on his approval is noticed
      // the same way as everything else in Admin.
      metrics.set(
        "marketplace.pendingPhotos",
        String(
          listingRows.filter((r) => r.photoStatus === "pending").length,
        ),
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
    request: z.object({ query: z.string().trim().min(1).max(80) }),
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
          // Total copies across both tallies (pocket + scene).
          ownedQty: tallyTotal(row),
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
          foilOnlyFinish: singleFinishOf(row),
          artLinked: ART_GROUP_BY_UID.has(row.uid),
        })),
      };
    },
  }),
  logUsageEvents: defineAction({
    description:
      "Appends a batch of usage-journal events for the signed-in collector (screens visited, taps/actions, Back use, searches with result counts, job step counts — navigation and actions only, never message text, passwords, or payment details). Events are sanitized server-side, stored in the private usage_journal table under the collector's own code, pruned past 90 days, and backed up to the cloud with the collection sync. Fire-and-forget from the client logger; a failed batch never affects the app.",
    request: z.object({
      events: z
        .array(
          z.object({
            sessionId: z.string().min(1).max(64),
            kind: z.string().min(1).max(16),
            label: z.string().min(1).max(200),
            detail: z
              .record(z.string(), z.unknown())
              .nullable()
              .optional(),
            at: z.string().min(1).max(40),
          }),
        )
        .min(1)
        .max(100),
    }),
    response: logUsageEventsResponse,
    async handler(ctx, args): Promise<z.infer<typeof logUsageEventsResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const db = ctx.db<typeof schema>();
      const clean: (typeof schema.usageJournal.$inferInsert)[] = [];
      for (const raw of args.events) {
        const e = sanitizeJournalEvent(raw);
        if (!e) continue;
        clean.push({
          collectorCode: profile.collectorCode,
          sessionId: e.sessionId,
          kind: e.kind,
          label: e.label,
          detailJson: e.detail ? JSON.stringify(e.detail) : null,
          at: e.at,
        });
      }
      if (clean.length > 0) {
        await db.insert(schema.usageJournal).values(clean);
      }
      // Retention housekeeping rides the write path so no
      // separate schedule is needed.
      await pruneUsageJournal(ctx, profile.collectorCode);
      return { ok: true as const, saved: clean.length };
    },
  }),

  getUsageJournal: defineAction({
    description:
      "Fetches the signed-in collector's OWN private usage journal for the last N days (default 1, max 31): the ordered events (screens, taps/actions, Back use, searches, job runs) plus a friction summary — sessions, quick exits (screens left within 4 seconds), zero-result searches, per-job step/duration averages, top screens, and Back counts. There is deliberately no parameter for whose journal: it always returns the journal of the collector who owns this app copy, so Jarvis's daily audit reads Anthony's trail and no one can ever read another user's. Never exposed on any profile or social surface.",
    request: z.object({
      days: z.number().int().min(1).max(31).optional(),
    }),
    response: usageJournalResponse,
    async handler(ctx, args): Promise<z.infer<typeof usageJournalResponse>> {
      const profile = await ensureCollectorProfile(ctx);
      const days = args.days ?? 1;
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.usageJournal)
        .where(
          and(
            eq(schema.usageJournal.collectorCode, profile.collectorCode),
            gte(schema.usageJournal.at, from.toISOString()),
          ),
        )
        .orderBy(desc(schema.usageJournal.at))
        .limit(2001);
      const truncated = rows.length > 2000;
      const kept = (truncated ? rows.slice(0, 2000) : rows).reverse();
      const events = kept.map((r) => {
        let detail: Record<string, unknown> | null = null;
        if (r.detailJson) {
          try {
            const parsed: unknown = JSON.parse(r.detailJson);
            if (parsed && typeof parsed === "object") {
              detail = parsed as Record<string, unknown>;
            }
          } catch {
            detail = null;
          }
        }
        return {
          id: r.id,
          sessionId: r.sessionId,
          kind: r.kind,
          label: r.label,
          detail,
          at: r.at,
        };
      });
      // Friction summary, computed from the same window.
      const sessions = new Set(events.map((e) => e.sessionId));
      const screenCounts = new Map<string, number>();
      const quickExits: { screen: string; dwellMs: number; at: string }[] =
        [];
      let screensVisited = 0;
      let backs = 0;
      // Dwell of a screen = gap to the NEXT screen event in
      // the same session (or to a Back that left it).
      const lastScreenBySession = new Map<
        string,
        { label: string; atMs: number; at: string }
      >();
      for (const e of events) {
        if (e.kind === "back") backs += 1;
        if (e.kind !== "screen") continue;
        screensVisited += 1;
        screenCounts.set(e.label, (screenCounts.get(e.label) ?? 0) + 1);
        const prev = lastScreenBySession.get(e.sessionId);
        const atMs = Date.parse(e.at);
        if (prev && Number.isFinite(atMs)) {
          const dwell = atMs - prev.atMs;
          if (dwell >= 0 && dwell < 4000) {
            quickExits.push({
              screen: prev.label,
              dwellMs: dwell,
              at: prev.at,
            });
          }
        }
        if (Number.isFinite(atMs)) {
          lastScreenBySession.set(e.sessionId, {
            label: e.label,
            atMs,
            at: e.at,
          });
        }
      }
      const zeroResultSearches = events
        .filter(
          (e) =>
            e.kind === "search" &&
            typeof e.detail?.results === "number" &&
            e.detail.results === 0,
        )
        .map((e) => ({ query: e.label, at: e.at }))
        .reverse()
        .slice(0, 50);
      const jobAgg = new Map<
        string,
        { runs: number; completed: number; steps: number; ms: number }
      >();
      for (const e of events) {
        if (e.kind !== "job") continue;
        const agg =
          jobAgg.get(e.label) ?? { runs: 0, completed: 0, steps: 0, ms: 0 };
        agg.runs += 1;
        if (e.detail?.completed === true) agg.completed += 1;
        if (typeof e.detail?.steps === "number") agg.steps += e.detail.steps;
        if (typeof e.detail?.ms === "number") agg.ms += e.detail.ms;
        jobAgg.set(e.label, agg);
      }
      const jobs = [...jobAgg.entries()].map(([job, a]) => ({
        job,
        runs: a.runs,
        completed: a.completed,
        avgSteps: a.runs > 0 ? Math.round((a.steps / a.runs) * 10) / 10 : 0,
        avgMs: a.runs > 0 ? Math.round(a.ms / a.runs) : 0,
      }));
      const topScreens = [...screenCounts.entries()]
        .map(([screen, visits]) => ({ screen, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 12);
      return {
        collectorCode: profile.collectorCode,
        username: profile.username,
        from: from.toISOString(),
        to: to.toISOString(),
        truncated,
        events,
        summary: {
          totalEvents: events.length,
          sessions: sessions.size,
          screensVisited,
          quickExits: quickExits.slice(-50).reverse(),
          zeroResultSearches,
          jobs,
          topScreens,
          backs,
        },
      };
    },
  }),

  syncUsageJournal: defineAction({
    description:
      "Pushes any usage-journal rows not yet backed up to the cloud backup (Supabase collection_items, kind \"journal\", under the signed-in collector's own code) and advances the sync watermark. The same push also rides every full collection sync; this standalone action lets the app flush the journal to the cloud when it closes or backgrounds without waiting for a collection change. Best-effort: unreachable cloud returns pushed 0 and the rows retry next time.",
    request: z.object({}),
    response: z.object({
      ok: z.boolean(),
      /** Journal rows pushed to the cloud by this call. */
      pushed: z.number(),
    }),
    async handler(ctx): Promise<{ ok: boolean; pushed: number }> {
      const profile = await ensureCollectorProfile(ctx);
      try {
        const pushed = await pushUsageJournalToCloud(
          ctx,
          profile.collectorCode,
        );
        return { ok: true, pushed };
      } catch {
        return { ok: false, pushed: 0 };
      }
    },
  }),
} satisfies ActionsModule;
