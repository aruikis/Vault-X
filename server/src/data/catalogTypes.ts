// Shared shapes for the bundled binder data modules.
//
// catalog.ts is a slimmed snapshot of the LorcanaJSON card catalog
// (https://lorcanajson.org/files/current/en/allCards.json, fetched at build
// time): one entry per printed card — main sets 1-14, every promo family
// (rarity "Special" in the source, grouped by the family code in its
// fullIdentifier), and the Illumineer's Quest sets Q1-Q3.
//
// ownership.ts was generated at build time from Anthony's own Shiny export
// (ShinyExport, Nov 1 2026): rows joined to catalog cards by TCGplayer id,
// with a (set, collector number, name) fallback. Sealed products, unnumbered
// Ink Drop tokens, and Floodborn puzzle pieces are not binder cards and are
// not in either file.

export interface CatalogEntry {
  uid: string;
  grp: "set" | "promo" | "quest" | "puzzle";
  setCode: string;
  setName: string;
  family: string | null;
  number: number | null;
  printed: string;
  fullName: string | null;
  name: string | null;
  rarity: string | null;
  ink: string | null;
  cost: number | null;
  inkwell: boolean;
  type: string | null;
  strength: number | null;
  willpower: number | null;
  lore: number | null;
  text: string | null;
  subtypes: string | null;
  image: string | null;
  tcg: number | null;
}

export interface FinishFinance {
  qty: number;
  /** Market value per unit for this finish, USD (Nov 1 2026 Shiny export). */
  value: number;
  /** What Anthony paid per unit for this finish, USD (same export). */
  paid: number;
}

export interface OwnershipEntry {
  qty: number;
  finishes: Record<string, number>;
  /** Quantity-weighted average market value per unit, USD. */
  value: number;
  /** Quantity-weighted average amount paid per unit, USD. */
  paid: number;
  /** Per-finish quantities and per-unit value/paid — Regular and Cold Foil
      share one TCGplayer id in Shiny but carry different prices. */
  byFinish: Record<string, FinishFinance>;
}
