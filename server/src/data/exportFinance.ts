// Export-level finance data from Anthony's Shiny exports, generated at
// build time from the same Nov 1, 2026 (11:27 PM) export that produced
// ownership.ts. The binder's card rows exclude sealed products, Ink Drop
// tokens, and Floodborn puzzle pieces; those items are accounted for here
// so collection totals tie exactly to the export: 9,500 cards,
// $4,418.05 value, $4,854.70 paid.

export interface SealedItem {
  name: string;
  setName: string;
  qty: number;
  value: number;
  paid: number;
  /** TCGplayer product ID from Anthony's Shiny export (every sealed row
      carries one) — powers the Best Offer link in the item detail.
      Absent for items TCGplayer doesn't track (the Japanese-edition
      items in extraSealedItems below). */
  tcgplayerId?: string;
  /** Market value per unit in Japanese yen, for Japanese-edition
      items priced from a Japanese source. `value` is then the USD
      conversion of this figure at fxJpyPerUsd, and the UI shows both
      currencies side by side. Any future Japanese-edition sealed item
      gets the same treatment by setting these fields. */
  jpyValue?: number;
  /** Yen per 1 USD used to convert jpyValue into `value`. */
  fxJpyPerUsd?: number;
  /** Human-readable conversion note (rate, source, date), shown in
      the item detail next to the dual-currency price. */
  fxNote?: string;
  /** Short label of the market source for non-Shiny items, e.g.
      "SNKRDUNK (Japan)" — shown on the tile and in the detail. */
  marketSourceLabel?: string;
  /** The source's product page for this item — powers its Best Offer
      link in place of TCGplayer. */
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

export const sealedItems: SealedItem[] = [
  {
    "name": "Disney Lorcana: Hyperia City Booster Box",
    "setName": "Hyperia City",
    "qty": 1,
    "value": 138.13,
    "paid": 143.25,
    "tcgplayerId": "706239"
  },
  {
    "name": "Disney Lorcana: Hyperia City Prerelease Box",
    "setName": "Hyperia City",
    "qty": 1,
    "value": 44.17,
    "paid": 30.0,
    "tcgplayerId": "706245"
  },
  {
    "name": "Fabled Booster Pack",
    "setName": "Fabled",
    "qty": 1,
    "value": 30.04,
    "paid": 0.0,
    "tcgplayerId": "649927"
  },
  {
    "name": "The First Chapter Booster Pack",
    "setName": "The First Chapter",
    "qty": 1,
    "value": 17.77,
    "paid": 14.77,
    "tcgplayerId": "482406"
  },
  {
    "name": "Disney Lorcana: Winterspell Booster Pack",
    "setName": "Winterspell",
    "qty": 1,
    "value": 10.73,
    "paid": 9.61,
    "tcgplayerId": "664821"
  },
  {
    "name": "Disney Lorcana: Wilds Unknown Booster Pack",
    "setName": "Wilds Unknown",
    "qty": 1,
    "value": 8.92,
    "paid": 9.34,
    "tcgplayerId": "678167"
  },
  {
    "name": "Disney Lorcana: Attack of the Vine! Booster Pack",
    "setName": "Attack of the Vine!",
    "qty": 1,
    "value": 8.88,
    "paid": 9.09,
    "tcgplayerId": "690386"
  },
  {
    "name": "Ursula's Return Booster Pack",
    "setName": "Ursula's Return",
    "qty": 1,
    "value": 8.11,
    "paid": 7.3,
    "tcgplayerId": "543860"
  },
  {
    "name": "Reign of Jafar Booster Pack",
    "setName": "Reign of Jafar",
    "qty": 1,
    "value": 8.02,
    "paid": 8.05,
    "tcgplayerId": "623063"
  },
  {
    "name": "Disney Lorcana: Shimmering Skies Booster Pack",
    "setName": "Shimmering Skies",
    "qty": 1,
    "value": 7.62,
    "paid": 6.74,
    "tcgplayerId": "555142"
  },
  {
    "name": "Disney Lorcana: Hyperia City Booster Pack",
    "setName": "Hyperia City",
    "qty": 1,
    "value": 7.61,
    "paid": 13.27,
    "tcgplayerId": "706241"
  },
  {
    "name": "Rise of the Floodborn Booster Pack",
    "setName": "Rise of the Floodborn",
    "qty": 1,
    "value": 6.21,
    "paid": 5.92,
    "tcgplayerId": "516297"
  },
  {
    "name": "Into the Inklands Booster Pack",
    "setName": "Into The Inklands",
    "qty": 1,
    "value": 5.32,
    "paid": 5.67,
    "tcgplayerId": "531523"
  },
  {
    "name": "Azurite Sea Booster Pack",
    "setName": "Azurite Sea",
    "qty": 1,
    "value": 4.72,
    "paid": 5.69,
    "tcgplayerId": "578095"
  }
];

export const sealedTotals = {"qty": 14, "value": 306.25, "paid": 268.7};

/** Sealed items Anthony owns that are NOT in the Shiny export above —
    hand-sourced additions, kept apart so the export data stays exactly
    as exported. Merged with sealedItems by the server actions
    (allSealedItems in actions.ts), so these get the full sealed
    treatment: shelf tile, qty plus/minus, item detail with chart and
    Best Offer, and a place in the sealed totals / collection
    distribution.

    The Japanese First Chapter pack (added Nov 2, 2026 at Anthony's
    request): 1 unopened Takara Tomy Japanese-edition pack. It is not
    tracked by TCGplayer or Shiny; its market price is SNKRDUNK
    (Japan)'s ¥1,000 for the single Mickey-art pack
    (https://snkrdunk.com/apparels/371698, checked Nov 2, 2026;
    corroborated by eBay sold listings for the same pack at $7.95).
    USD value is the conversion at the ECB reference rate for
    Nov 2, 2026, ¥157.90 = $1 (via YCharts): ¥1,000 → $6.33.
    Paid is 0 — Anthony didn't record what he paid, the same
    "not recorded" the export itself uses (e.g. the Fabled pack). */
export const extraSealedItems: SealedItem[] = [
  {
    name: "Disney Lorcana: The First Chapter Booster Pack (Japanese)",
    setName: "The First Chapter",
    qty: 1,
    value: 6.33,
    paid: 0,
    jpyValue: 1000,
    fxJpyPerUsd: 157.9,
    fxNote:
      "Converted at ¥157.90 = $1 — the ECB reference rate for Nov 2, 2026 (via YCharts). eBay sold listings for this pack (~$7.95) sit in the same range.",
    marketSourceLabel: "SNKRDUNK (Japan)",
    marketUrl: "https://snkrdunk.com/apparels/371698",
  },
  // Illumineer's Quest: The Great Hunny Rescue (added Nov 2, 2026 at
  // Anthony's direction — "We need it to be. A selectable item."):
  // the third Illumineer's Quest box (Attack of the Vine! era,
  // released Oct 2, 2026; MSRP $59.99), added to the sealed catalog
  // NATIVELY — it was never in a Shiny export — so any user can find
  // it on the Sealed shelf and set their own quantity with the
  // plus/minus steppers. Base quantity is 0 on purpose: it is NOT
  // added to Anthony's owned count (he adds his sealed copy
  // himself; his second box is being opened). Pricing is the app's
  // normal source for sealed items, TCGplayer: product 701135,
  // market price $34.24 observed Nov 2, 2026 (via TCGplayer's
  // catalog data on TCGCSV, snapshot Nov 2, 2026). Paid is 0 —
  // nothing recorded, the same "not recorded" the export itself
  // uses (e.g. the Fabled pack).
  {
    name: "Illumineer's Quest: The Great Hunny Rescue",
    setName: "Attack of the Vine!",
    qty: 0,
    value: 34.24,
    paid: 0,
    tcgplayerId: "701135",
  },
  // The first two Illumineer's Quest boxes (added Nov 3, 2026 at
  // Anthony's direction — the same selectable pattern as the
  // Great Hunny Rescue, for every Quest box): native catalog
  // entries, never in a Shiny export, quantity 0 so nothing is
  // added to anyone's owned count until they add a copy
  // themselves. Pricing is TCGplayer via TCGCSV (snapshot
  // Nov 2, 2026): Deep Trouble product 543862, market $50.28;
  // Palace Heist product 623065, market $26.31. Paid is 0 —
  // "not recorded", as the export itself uses.
  {
    name: "Illumineer's Quest: Deep Trouble",
    setName: "Ursula's Return",
    qty: 0,
    value: 50.28,
    paid: 0,
    tcgplayerId: "543862",
  },
  {
    name: "Illumineer's Quest: Palace Heist",
    setName: "Reign of Jafar",
    qty: 0,
    value: 26.31,
    paid: 0,
    tcgplayerId: "623065",
  },
  // Illumineer's Troves, one per set (added Nov 3, 2026 at
  // Anthony's direction — forty years of sets had booster packs
  // and Quest boxes in the catalog but no Troves): native
  // catalog entries, never in a Shiny export, quantity 0 so
  // nothing is added to anyone's owned count until they add a
  // copy themselves from the Sealed shelf. Pricing is
  // TCGplayer market, Nov 2, 2026 (via tcgrate/TCGCSV):
  // product IDs for sets 1-11 are TCGplayer's own (via
  // PriceCharting's TCGPlayer ID fields, checked Nov 3, 2026);
  // set 12's ID (678168) and set 13's (690388) were read from
  // tcgrate's product-image keying, and set 14's (706243) from
  // its tcgrate og:image — all three pattern-verified against
  // the confirmed IDs. Paid is 0 — "not recorded", as the
  // export itself uses.
  {
    name: "Disney Lorcana: The First Chapter Illumineer's Trove",
    setName: "The First Chapter",
    qty: 0,
    value: 369.42,
    paid: 0,
    tcgplayerId: "482411",
  },
  {
    name: "Disney Lorcana: Rise of the Floodborn Illumineer's Trove",
    setName: "Rise of the Floodborn",
    qty: 0,
    value: 83.17,
    paid: 0,
    tcgplayerId: "516277",
  },
  {
    name: "Disney Lorcana: Into the Inklands Illumineer's Trove",
    setName: "Into the Inklands",
    qty: 0,
    value: 61.16,
    paid: 0,
    tcgplayerId: "531524",
  },
  {
    name: "Disney Lorcana: Ursula's Return Illumineer's Trove",
    setName: "Ursula's Return",
    qty: 0,
    value: 61.70,
    paid: 0,
    tcgplayerId: "543861",
  },
  {
    name: "Disney Lorcana: Shimmering Skies Illumineer's Trove",
    setName: "Shimmering Skies",
    qty: 0,
    value: 63.64,
    paid: 0,
    tcgplayerId: "555148",
  },
  {
    name: "Disney Lorcana: Azurite Sea Illumineer's Trove",
    setName: "Azurite Sea",
    qty: 0,
    value: 58.91,
    paid: 0,
    tcgplayerId: "578121",
  },
  {
    name: "Disney Lorcana: Archazia's Island Illumineer's Trove",
    setName: "Archazia's Island",
    qty: 0,
    value: 47.34,
    paid: 0,
    tcgplayerId: "607761",
  },
  {
    name: "Disney Lorcana: Reign of Jafar Illumineer's Trove",
    setName: "Reign of Jafar",
    qty: 0,
    value: 47.93,
    paid: 0,
    tcgplayerId: "623061",
  },
  {
    name: "Disney Lorcana: Fabled Illumineer's Trove",
    setName: "Fabled",
    qty: 0,
    value: 293.58,
    paid: 0,
    tcgplayerId: "645299",
  },
  {
    name: "Disney Lorcana: Whispers in the Well Illumineer's Trove",
    setName: "Whispers in the Well",
    qty: 0,
    value: 111.83,
    paid: 0,
    tcgplayerId: "652709",
  },
  {
    name: "Disney Lorcana: Winterspell Illumineer's Trove",
    setName: "Winterspell",
    qty: 0,
    value: 99.10,
    paid: 0,
    tcgplayerId: "664826",
  },
  {
    name: "Disney Lorcana: Wilds Unknown Illumineer's Trove",
    setName: "Wilds Unknown",
    qty: 0,
    value: 101.35,
    paid: 0,
    tcgplayerId: "678168",
  },
  {
    name: "Disney Lorcana: Attack of the Vine! Illumineer's Trove",
    setName: "Attack of the Vine!",
    qty: 0,
    value: 76.31,
    paid: 0,
    tcgplayerId: "690388",
  },
  {
    name: "Disney Lorcana: Hyperia City Illumineer's Trove",
    setName: "Hyperia City",
    qty: 0,
    value: 66.94,
    paid: 0,
    tcgplayerId: "706243",
  },
  // Gift Sets, Starter Decks, and the Lorcana Gateway box
  // (added Nov 3, 2026 at Anthony's direction — the remaining
  // sealed product types, so the catalog covers every sealed
  // product family): native catalog entries, never in a Shiny
  // export, quantity 0 so nothing is added to anyone's owned
  // count until they add a copy themselves. The list was
  // verified complete against TCGplayer's full Lorcana catalog
  // (via TCGCSV, Nov 3, 2026) cross-checked with the Mushu
  // Report wiki: 7 gift sets/boxes (TCGplayer calls the newer
  // ones Gift Box; the Hyperia City Beast box is a presale,
  // releasing Nov 13, 2026, priced at its presale market),
  // 21 starter decks for sets 1-10 (three for The First
  // Chapter, two each after) plus the 2-Player Starter Sets
  // for Wilds Unknown and Hyperia City — Winterspell and
  // Attack of the Vine! released NO starter decks — and the
  // Gateway learn-to-play box. Prices are TCGplayer market,
  // Nov 3, 2026 (via TCGCSV). Paid is 0 — "not recorded", as
  // the export itself uses. They sit at the END of the
  // catalog, below the Troves, per Anthony's placement.
  {
    name: "Disney Lorcana: The First Chapter Gift Set",
    setName: "The First Chapter",
    qty: 0,
    value: 84.42,
    paid: 0,
    tcgplayerId: "482407",
  },
  {
    name: "Disney Lorcana: Into the Inklands Gift Set",
    setName: "Into the Inklands",
    qty: 0,
    value: 27.66,
    paid: 0,
    tcgplayerId: "531528",
  },
  {
    name: "Disney Lorcana: Stitch Collector's Gift Set",
    setName: "Azurite Sea",
    qty: 0,
    value: 32.08,
    paid: 0,
    tcgplayerId: "578122",
  },
  {
    name: "Disney Lorcana: Archazia's Island Gift Box",
    setName: "Archazia's Island",
    qty: 0,
    value: 36.33,
    paid: 0,
    tcgplayerId: "607765",
  },
  {
    name: "Disney Lorcana: Fabled Gift Set",
    setName: "Fabled",
    qty: 0,
    value: 38.36,
    paid: 0,
    tcgplayerId: "645308",
  },
  {
    name: "Disney Lorcana: Winterspell Gift Box - Scrooge McDuck",
    setName: "Winterspell",
    qty: 0,
    value: 24.61,
    paid: 0,
    tcgplayerId: "668328",
  },
  {
    name: "Disney Lorcana: Hyperia City Gift Box - Beast",
    setName: "Hyperia City",
    qty: 0,
    value: 69.17,
    paid: 0,
    tcgplayerId: "719729",
  },
  {
    name: "Disney Lorcana: The First Chapter Starter Deck (Amber & Amethyst)",
    setName: "The First Chapter",
    qty: 0,
    value: 25.67,
    paid: 0,
    tcgplayerId: "482417",
  },
  {
    name: "Disney Lorcana: The First Chapter Starter Deck (Emerald & Ruby)",
    setName: "The First Chapter",
    qty: 0,
    value: 19.59,
    paid: 0,
    tcgplayerId: "482418",
  },
  {
    name: "Disney Lorcana: The First Chapter Starter Deck (Sapphire & Steel)",
    setName: "The First Chapter",
    qty: 0,
    value: 21.26,
    paid: 0,
    tcgplayerId: "482419",
  },
  {
    name: "Disney Lorcana: Rise of the Floodborn Starter Deck (Amber & Sapphire)",
    setName: "Rise of the Floodborn",
    qty: 0,
    value: 7.04,
    paid: 0,
    tcgplayerId: "516290",
  },
  {
    name: "Disney Lorcana: Rise of the Floodborn Starter Deck (Amethyst & Steel)",
    setName: "Rise of the Floodborn",
    qty: 0,
    value: 7.71,
    paid: 0,
    tcgplayerId: "516293",
  },
  {
    name: "Disney Lorcana: Into the Inklands Starter Deck (Amber & Emerald)",
    setName: "Into the Inklands",
    qty: 0,
    value: 7.58,
    paid: 0,
    tcgplayerId: "531526",
  },
  {
    name: "Disney Lorcana: Into the Inklands Starter Deck (Ruby & Sapphire)",
    setName: "Into the Inklands",
    qty: 0,
    value: 7.31,
    paid: 0,
    tcgplayerId: "531527",
  },
  {
    name: "Disney Lorcana: Ursula's Return Starter Deck (Amber & Amethyst)",
    setName: "Ursula's Return",
    qty: 0,
    value: 9.32,
    paid: 0,
    tcgplayerId: "543863",
  },
  {
    name: "Disney Lorcana: Ursula's Return Starter Deck (Sapphire & Steel)",
    setName: "Ursula's Return",
    qty: 0,
    value: 12.93,
    paid: 0,
    tcgplayerId: "543864",
  },
  {
    name: "Disney Lorcana: Shimmering Skies Starter Deck (Amethyst & Ruby)",
    setName: "Shimmering Skies",
    qty: 0,
    value: 16.32,
    paid: 0,
    tcgplayerId: "555144",
  },
  {
    name: "Disney Lorcana: Shimmering Skies Starter Deck (Emerald & Steel)",
    setName: "Shimmering Skies",
    qty: 0,
    value: 11.63,
    paid: 0,
    tcgplayerId: "555145",
  },
  {
    name: "Disney Lorcana: Azurite Sea Starter Deck (Amber & Ruby)",
    setName: "Azurite Sea",
    qty: 0,
    value: 13.20,
    paid: 0,
    tcgplayerId: "578123",
  },
  {
    name: "Disney Lorcana: Azurite Sea Starter Deck (Emerald & Sapphire)",
    setName: "Azurite Sea",
    qty: 0,
    value: 9.68,
    paid: 0,
    tcgplayerId: "578124",
  },
  {
    name: "Disney Lorcana: Archazia's Island Starter Deck (Ruby & Sapphire)",
    setName: "Archazia's Island",
    qty: 0,
    value: 11.22,
    paid: 0,
    tcgplayerId: "607802",
  },
  {
    name: "Disney Lorcana: Archazia's Island Starter Deck (Amethyst & Steel)",
    setName: "Archazia's Island",
    qty: 0,
    value: 9.91,
    paid: 0,
    tcgplayerId: "607803",
  },
  {
    name: "Disney Lorcana: Reign of Jafar Starter Deck (Amber & Amethyst)",
    setName: "Reign of Jafar",
    qty: 0,
    value: 8.77,
    paid: 0,
    tcgplayerId: "623058",
  },
  {
    name: "Disney Lorcana: Reign of Jafar Starter Deck (Ruby & Steel)",
    setName: "Reign of Jafar",
    qty: 0,
    value: 16.91,
    paid: 0,
    tcgplayerId: "623059",
  },
  {
    name: "Disney Lorcana: Fabled Starter Deck (Emerald & Ruby)",
    setName: "Fabled",
    qty: 0,
    value: 52.75,
    paid: 0,
    tcgplayerId: "645305",
  },
  {
    name: "Disney Lorcana: Fabled Starter Deck (Amber & Sapphire)",
    setName: "Fabled",
    qty: 0,
    value: 39.27,
    paid: 0,
    tcgplayerId: "645306",
  },
  {
    name: "Disney Lorcana: Whispers in the Well Starter Deck (Sapphire & Steel)",
    setName: "Whispers in the Well",
    qty: 0,
    value: 15.34,
    paid: 0,
    tcgplayerId: "652706",
  },
  {
    name: "Disney Lorcana: Whispers in the Well Starter Deck (Amber & Emerald)",
    setName: "Whispers in the Well",
    qty: 0,
    value: 12.86,
    paid: 0,
    tcgplayerId: "652707",
  },
  {
    name: "Disney Lorcana: Wilds Unknown 2-Player Starter Set",
    setName: "Wilds Unknown",
    qty: 0,
    value: 18.58,
    paid: 0,
    tcgplayerId: "682038",
  },
  {
    name: "Disney Lorcana: Hyperia City 2-Player Starter Set",
    setName: "Hyperia City",
    qty: 0,
    value: 25.49,
    paid: 0,
    tcgplayerId: "717854",
  },
  {
    name: "Disney Lorcana: Gateway",
    setName: "Shimmering Skies",
    qty: 0,
    value: 18.55,
    paid: 0,
    tcgplayerId: "555143",
  },
];

/** Ink Drop tokens + Floodborn puzzle pieces: counted in the export, not binder cards. */
export const nonBinderTotals = {"qty": 118, "value": 11.09, "paid": 32.99};

export const exportBySet: ExportSetFinance[] = [
  {
    "name": "Hyperia City",
    "cards": 2087,
    "value": 790.95,
    "paid": 1213.79,
    "main": true
  },
  {
    "name": "Attack of the Vine!",
    "cards": 1021,
    "value": 496.58,
    "paid": 615.37,
    "main": true
  },
  {
    "name": "Whispers in the Well",
    "cards": 510,
    "value": 431.23,
    "paid": 277.49,
    "main": true
  },
  {
    "name": "Disney Lorcana Promos",
    "cards": 105,
    "value": 424.07,
    "paid": 495.86,
    "main": false
  },
  {
    "name": "Winterspell",
    "cards": 432,
    "value": 326.73,
    "paid": 335.03,
    "main": true
  },
  {
    "name": "Fabled",
    "cards": 739,
    "value": 322.37,
    "paid": 241.41,
    "main": true
  },
  {
    "name": "Wilds Unknown",
    "cards": 464,
    "value": 213.17,
    "paid": 242.08,
    "main": true
  },
  {
    "name": "Shimmering Skies",
    "cards": 427,
    "value": 193.85,
    "paid": 212.85,
    "main": true
  },
  {
    "name": "Azurite Sea",
    "cards": 622,
    "value": 186.48,
    "paid": 182.13,
    "main": true
  },
  {
    "name": "Ursula's Return",
    "cards": 361,
    "value": 178.52,
    "paid": 185.87,
    "main": true
  },
  {
    "name": "Archazia's Island",
    "cards": 824,
    "value": 171.66,
    "paid": 172.17,
    "main": true
  },
  {
    "name": "D23 Promos",
    "cards": 4,
    "value": 155.11,
    "paid": 140.26,
    "main": false
  },
  {
    "name": "Into The Inklands",
    "cards": 692,
    "value": 134.48,
    "paid": 136.72,
    "main": true
  },
  {
    "name": "Rise of the Floodborn",
    "cards": 419,
    "value": 120.45,
    "paid": 133.56,
    "main": true
  },
  {
    "name": "The First Chapter",
    "cards": 244,
    "value": 118.5,
    "paid": 116.4,
    "main": true
  },
  {
    "name": "Reign of Jafar",
    "cards": 453,
    "value": 83.22,
    "paid": 86.02,
    "main": true
  },
  {
    "name": "Illumineer's Quest: Deep Trouble",
    "cards": 55,
    "value": 41.8,
    "paid": 41.88,
    "main": false
  },
  {
    "name": "Illumineer's Quest: Palace Heist",
    "cards": 41,
    "value": 28.88,
    "paid": 25.81,
    "main": false
  }
];

/** Real Shiny export snapshots — the start of tracked collection history.
    Seeded into the finance_snapshots table; each new export or daily
    re-pricing appends another point. No earlier history exists. */
export const historySeed = [
  {
    "date": "2026-10-25",
    "label": "Oct 25",
    "value": 4419.58,
    "paid": 4685.34,
    "cards": 9336
  },
  {
    "date": "2026-10-27",
    "label": "Oct 27",
    "value": 4419.98,
    "paid": 4731.2,
    "cards": 9437
  },
  {
    "date": "2026-10-29",
    "label": "Oct 29",
    "value": 4485.73,
    "paid": 4855.63,
    "cards": 9446
  },
  {
    "date": "2026-11-01",
    "label": "Nov 1 (first export)",
    "value": 4413.98,
    "paid": 4850.63,
    "cards": 9498
  },
  {
    "date": "2026-11-01",
    "label": "Nov 1 (latest)",
    "value": 4418.05,
    "paid": 4854.7,
    "cards": 9500
  }
];
