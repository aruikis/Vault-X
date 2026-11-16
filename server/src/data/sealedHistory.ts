// Per-item price history for sealed products — INTENTIONALLY EMPTY.
//
// A fresh Vault X install has no sealed-product price history: this
// seed previously carried the original owner's export history and
// was emptied in v1.127.0 so shared installs start clean (see
// AGENTS.md, "Privacy: personal data files"). History builds from
// each collector's own sealed items from their first day forward.

export interface SealedPricePoint {
  date: string;
  label: string;
  value: number;
  /** Where this point came from: "export" for collection exports
      (the default), or the market source for hand-sourced items
      (e.g. "snkrdunk" for Japanese-edition packs). */
  source?: string;
}

export const sealedHistory: Record<string, SealedPricePoint[]> = {};
