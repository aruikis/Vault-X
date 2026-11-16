// Export-level finance data — INTENTIONALLY EMPTY.
//
// The binder's card rows exclude sealed products, Ink Drop tokens,
// and Floodborn puzzle pieces; those items are accounted for here so
// collection totals include them. In this shared source every value
// starts at zero: a fresh Vault X install has no sealed products and
// no finance history until the collector adds their own.
//
// (This file previously carried the original owner's Nov 1, 2026
// export finance — his sealed items, per-set totals, and history
// snapshots. That was removed in v1.127.0 so shared installs start
// clean; see AGENTS.md, "Privacy: personal data files".)

export interface SealedItem {
  name: string;
  setName: string;
  qty: number;
  value: number;
  paid: number;
  /** TCGplayer product ID from the owner's collection export (every
      sealed row carries one) — powers the Best Offer link in the
      item detail. Absent for items TCGplayer doesn't track (such as
      Japanese-edition items in extraSealedItems below). */
  tcgplayerId?: string;
  /** Market value per unit in Japanese yen, for Japanese-edition
      items priced from a Japanese source. `value` is then the USD
      conversion of this figure at fxJpyPerUsd, and the UI shows both
      currencies side by side. Any future Japanese-edition sealed
      item gets the same treatment by setting these fields. */
  jpyValue?: number;
  /** Yen per 1 USD used to convert jpyValue into `value`. */
  fxJpyPerUsd?: number;
  /** Human-readable conversion note (rate, source, date), shown in
      the item detail next to the dual-currency price. */
  fxNote?: string;
  /** Short label of the market source for non-export items, e.g.
      "SNKRDUNK (Japan)" — shown on the tile and in the detail. */
  marketSourceLabel?: string;
  /** The source's product page for this item — powers its Best
      Offer link in place of TCGplayer. */
  marketUrl?: string;
}

export interface ExportSetFinance {
  name: string;
  cards: number;
  value: number;
  paid: number;
  /** True for the 14 main sets; false for promo families and quests. */
  main: boolean;
}

/** Sealed products from the owner's collection export. Empty in the
    shared source — a fresh install starts with no sealed products. */
export const sealedItems: SealedItem[] = [];

/** Export totals for the sealed items above. Zero in the shared
    source. (Runtime sealed totals come from effectiveSealed, which
    merges this seed with in-app quantity overrides.) */
export const sealedTotals = { qty: 0, value: 0, paid: 0 };

/** Hand-sourced sealed additions (items no export carries). Empty
    in the shared source. */
export const extraSealedItems: SealedItem[] = [];

/** Totals for the non-binder items (Ink Drop tokens, Floodborn
    puzzle pieces) accounted outside the binder rows. Zero in the
    shared source. */
export const nonBinderTotals = { qty: 0, value: 0, paid: 0 };

/** Per-set finance from the owner's collection export. Empty in the
    shared source — a fresh install computes its own finances from
    its own collection. */
export const exportBySet: ExportSetFinance[] = [];

/** Finance history snapshots that start the tracked collection
    history, seeded into the finance_snapshots table on first load.
    Empty in the shared source: each collector's history starts with
    their own first day and grows from there. */
export const historySeed: {
  date: string;
  label: string;
  value: number;
  paid: number;
  cards: number;
}[] = [];
