// EBAY SOLD SNAPSHOT (Nov 4, 2026) — Anthony's approved
// fallback metric, in his words: "eBay in my opinion is a
// true marketplace, so if eBay has recent sales then yeah
// use that as your metric." His price hierarchy (final,
// Nov 4, 2026): (1) TCGplayer is the #1 source; (2) eBay
// SOLD listings are #2 wherever TCGplayer has no price —
// exact printing, representative (median) figure, asking
// prices NEVER count; a stale sale must be labeled as the
// last recorded sale with its date.
//
// This snapshot covers the promo families no TCGplayer or
// Lorcast source prices at all. Method (Nov 4, 2026):
// recent completed eBay sales (Aug–Nov 2026 window, raw /
// ungraded copies only, shipping excluded), read from
// PriceCharting's per-card completed-sales tables (which
// list completed sales only, eBay rows used) after the
// live eBay sold search proved unreachable from the
// research browser; every figure below is a median of the
// listed sold prices.
//
// RESULTS BY FAMILY (the fresh pricing attempt the task
// asked for, family by family):
//   CC2 Curator's Collection: Beauty and the Beast —
//     PRICED NOW (5 of 6): the five entries below; recent
//     sales, Oct 16–30, 2026, so nothing here is stale.
//     Mrs. Potts - Enchanted Teapot 2/CC2 (cardId 3735):
//     ZERO recorded sales anywhere — only an asking
//     listing exists — stays honestly unpriced.
//     Beast sensitivity: the $60.00 median includes one
//     $39.99 sale whose listing title lacked the Curator
//     wording (PriceCharting classifies it to this card);
//     excluding it the median would be $65.00.
//   P4 Promo Set 4 — STILL UNPRICED: Donald Duck - Taxi
//     Driver 1/P4 has no recorded eBay sale; the tile's
//     "no tracked prices yet" stays honest.
//   RPH Ravensburger Play Hub — STILL UNPRICED: no
//     recorded eBay sales for Minnie Mouse - Urban
//     Visionary 4/RPH or either Honey Lemon - Testing
//     the Limits printing (6/RPH, 7/RPH).
//   C3 Challenge Series 3 — STILL UNPRICED: no recorded
//     eBay sales for any of the 17 printings. Context:
//     the C3 "Season of Villainy" prizes were barely
//     distributed by Nov 4, 2026 (first English-prize
//     stop Bangkok, Oct 31–Nov 1) and no sale had
//     surfaced; one Mother Knows Best sale is known to
//     have happened on eBay but its accepted price is
//     not publicly visible, so it cannot be priced.
//
// Keyed by BINDER CARD ID (not uid like promoPrices):
// these printings have no Lorcast record at all — that is
// precisely why they need the eBay fallback — so the
// binder's own card id is the stable key. `usd` is the
// median sold price (these promos exist as one pocket per
// printing, so one figure serves the pocket); `sales` is
// how many qualifying sold listings the median rests on.

export const EBAY_SOLD_SNAPSHOT_DATE = "Nov 4, 2026";

/** The window the recorded sales fall in, and its last
    day — the staleness rule (Anthony, Nov 4, 2026) keys
    off it: while the newest sale behind a price is inside
    ~90 days the price presents as a normal eBay-sold
    price with the source labeled; past that it must
    present as "Last sold at $X on eBay" with the date
    visible. Per-card sale dates were not published by the
    source tables — only the family window — so entries
    carry month precision (lastSoldMonth), never an
    invented exact day. */
export const EBAY_SOLD_WINDOW_LABEL = "Oct 16–30, 2026";
export const EBAY_SOLD_WINDOW_END = "2026-10-30";

export interface EbaySoldPrice {
  usd: number;
  sales: number;
  lastSoldMonth: string;
}

export const ebaySoldPrices: Record<number, EbaySoldPrice> = {
  // Be Our Guest — 1/CC2 — sales 34.99, 39.99, 39.99, 50.00
  3734: { usd: 39.99, sales: 4, lastSoldMonth: "Oct 2026" },
  // Belle - Hidden Archer — 3/CC2 — sales 59.99, 61.82,
  // 69.99, 69.99, 70.00
  3736: { usd: 69.99, sales: 5, lastSoldMonth: "Oct 2026" },
  // Lumiere - Fiery Friend — 4/CC2 — sales 21.99, 25.69,
  // 29.99, 34.99, 35.00
  3737: { usd: 29.99, sales: 5, lastSoldMonth: "Oct 2026" },
  // Gaston - Intellectual Powerhouse — 5/CC2 — sales
  // 25.99, 28.99, 29.00
  3738: { usd: 28.99, sales: 3, lastSoldMonth: "Oct 2026" },
  // Beast - Tragic Hero — 6/CC2 — sales 39.99, 49.99,
  // 50.00, 60.00, 69.99, 74.99, 84.69
  3739: { usd: 60.0, sales: 7, lastSoldMonth: "Oct 2026" },
};
