// FUNKO EBAY SOLD SNAPSHOT (Nov 4, 2026) — Funko market data
// the way the cards have it (Anthony, Nov 4, 2026): a Funko
// item's Financial view shows its value history built from
// SOLD listings, never asking prices. Per Anthony's standing
// price hierarchy, eBay SOLD listings are the authority for
// Funko. The funko-pop-data catalog carries no prices at all,
// so this snapshot is the recorded sold-data source, keyed by
// game_cards id, researched per item (owned items first).
//
// Method (Nov 4, 2026): PriceCharting's per-item pages, whose
// values are calculated from completed eBay sales only
// ("Historic sales data are completed sales with a buyer and
// a seller agreeing on a price. We do not factor unsold items
// into our prices."). Values below are PriceCharting's current
// market values by condition, read Nov 4, 2026. Where an item
// has no entry here, the app says plainly that no recent
// sales are recorded — a value is never invented.
//
// The representative value used for the daily history point
// and the catalog price is the IN BOX figure (a collector's
// figure on the shelf, in its box).

export const FUNKO_SOLD_SNAPSHOT_DATE = "Nov 4, 2026";

export type FunkoSoldSnapshot = {
  /** game_cards.id of the figure. */
  cardId: number;
  /** The figure's name, for cross-checking the id. */
  name: string;
  /** Source page the values were read from (verbatim). */
  sourceUrl: string;
  /** ISO date the values were read. */
  asOf: string;
  /** Current market values from completed eBay sales, USD. */
  outOfBox: number;
  inBox: number;
  newSealed: number;
  /** The box's UPC from the source's item details, where
      published — lets a scanned box barcode match this figure
      even before anyone links the barcode by hand. */
  upc: string | null;
};

export const FUNKO_SOLD_PRICES: FunkoSoldSnapshot[] = [
  {
    // Anthony's first Funko (added Nov 4, 2026). PriceCharting
    // "Han Solo in the Millennium Falcon #321", Funko POP Star
    // Wars (2019, Amazon Exclusive): Out of Box $14.90, In Box
    // $36.50, New $42.39; UPC 889698399166; PriceCharting ID
    // 7506527. Read Nov 4, 2026.
    cardId: 22002,
    name: "Han Solo in the Millennium Falcon",
    sourceUrl:
      "https://www.pricecharting.com/game/funko-pop-star-wars/han-solo-in-the-millennium-falcon-321",
    asOf: "2026-11-04",
    outOfBox: 14.9,
    inBox: 36.5,
    newSealed: 42.39,
    upc: "889698399166",
  },
];

export function funkoSoldSnapshotFor(
  cardId: number,
): FunkoSoldSnapshot | null {
  return FUNKO_SOLD_PRICES.find((s) => s.cardId === cardId) ?? null;
}

export function funkoSoldSnapshotByUpc(
  digits: string,
): FunkoSoldSnapshot | null {
  return FUNKO_SOLD_PRICES.find((s) => s.upc === digits) ?? null;
}
