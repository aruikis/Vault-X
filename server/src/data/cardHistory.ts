// Per-card price history seed — INTENTIONALLY EMPTY.
//
// A fresh Vault X install has no price history: this seed previously
// carried the original owner's per-card export history and was
// emptied in v1.127.0 so shared installs start clean (see AGENTS.md,
// "Privacy: personal data files"). The daily re-pricing builds each
// collector's own history from their first day forward.

export interface CardPricePoint {
  date: string;
  label: string;
  value: number;
}

export const cardHistory: Record<string, CardPricePoint[]> = {};
