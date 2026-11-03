// Per-item price history for the sealed products, generated from
// Anthony's five real Shiny exports (Oct 25, Oct 27, Oct 29, and both
// Nov 1, 2026 exports — each file's totals verified against the
// recorded snapshot totals). One point per export: the item's market
// value per unit that day, USD, keyed by the item's exact export
// name. Seeded into sealed_price_history; a new Shiny export is what
// moves these values (sealed products are not part of the daily card
// re-pricing). No earlier history exists.

export interface SealedPricePoint {
  date: string;
  label: string;
  value: number;
  /** Where this point came from: "export" for the Shiny exports
      (the default), or the market source for hand-sourced items
      (e.g. "snkrdunk" for the Japanese-edition pack). */
  source?: string;
}

export const sealedHistory: Record<string, SealedPricePoint[]> = {
  "Disney Lorcana: Hyperia City Booster Box": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 152.82
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 151.46
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 138.91
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 138.13
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 138.13
    }
  ],
  "Disney Lorcana: Hyperia City Prerelease Box": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 42.82
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 44.34
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 43.51
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 44.17
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 44.17
    }
  ],
  "Fabled Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 29.66
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 29.74
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 29.82
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 30.04
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 30.04
    }
  ],
  "The First Chapter Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 17.57
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 17.57
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 17.57
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 17.77
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 17.77
    }
  ],
  "Disney Lorcana: Winterspell Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 10.61
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 10.61
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 10.66
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 10.73
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 10.73
    }
  ],
  "Disney Lorcana: Wilds Unknown Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 9.42
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 9.42
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 9.26
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 8.92
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 8.92
    }
  ],
  "Disney Lorcana: Attack of the Vine! Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 8.94
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 8.94
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 8.85
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 8.88
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 8.88
    }
  ],
  "Ursula's Return Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 7.79
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 7.79
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 7.79
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 8.11
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 8.11
    }
  ],
  "Reign of Jafar Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 8.1
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 8.13
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 8.13
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 8.02
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 8.02
    }
  ],
  "Disney Lorcana: Shimmering Skies Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 7.27
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 7.27
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 7.41
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 7.62
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 7.62
    }
  ],
  "Disney Lorcana: Hyperia City Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 10.41
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 10.41
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 9.07
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 7.61
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 7.61
    }
  ],
  "Rise of the Floodborn Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 6.21
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 6.21
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 6.21
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 6.21
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 6.21
    }
  ],
  "Into the Inklands Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 5.15
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 5.2
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 5.24
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 5.32
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 5.32
    }
  ],
  "Azurite Sea Booster Pack": [
    {
      "date": "2026-10-25",
      "label": "Oct 25",
      "value": 4.99
    },
    {
      "date": "2026-10-27",
      "label": "Oct 27",
      "value": 4.99
    },
    {
      "date": "2026-10-29",
      "label": "Oct 29",
      "value": 4.9
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (first export)",
      "value": 4.72
    },
    {
      "date": "2026-11-01",
      "label": "Nov 1 (latest)",
      "value": 4.72
    }
  ],
  // Hand-sourced item (see extraSealedItems in exportFinance.ts):
  // tracking starts the day Anthony added it, with SNKRDUNK (Japan)'s
  // ¥1,000 price converted at ¥157.90 = $1 → $6.33. No earlier points
  // exist — it was never in a Shiny export.
  "Disney Lorcana: The First Chapter Booster Pack (Japanese)": [
    {
      "date": "2026-11-02",
      "label": "Nov 2",
      "value": 6.33,
      "source": "snkrdunk"
    }
  ],
  // Hand-sourced item (see extraSealedItems in exportFinance.ts):
  // a native catalog addition, never in a Shiny export — tracking
  // starts the day it was added, at TCGplayer's market price for
  // the sealed box (product 701135), $34.24 on Nov 2, 2026. No
  // earlier points exist.
  "Illumineer's Quest: The Great Hunny Rescue": [
    {
      "date": "2026-11-02",
      "label": "Nov 2",
      "value": 34.24,
      "source": "tcgplayer"
    }
  ],
  // Illumineer's Troves (native catalog additions, Nov 3, 2026 —
  // see extraSealedItems in exportFinance.ts): tracking starts
  // the day they were added, at TCGplayer's market price that
  // day (Nov 2, 2026, via tcgrate/TCGCSV). No earlier points
  // exist — they were never in a Shiny export.
  "Disney Lorcana: The First Chapter Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 369.42, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Rise of the Floodborn Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 83.17, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Into the Inklands Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 61.16, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Ursula's Return Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 61.70, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Shimmering Skies Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 63.64, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Azurite Sea Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 58.91, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Archazia's Island Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 47.34, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Reign of Jafar Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 47.93, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Fabled Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 293.58, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Whispers in the Well Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 111.83, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Winterspell Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 99.10, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Wilds Unknown Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 101.35, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Attack of the Vine! Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 76.31, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Hyperia City Illumineer's Trove": [
    { "date": "2026-11-02", "label": "Nov 2", "value": 66.94, "source": "tcgplayer" }
  ],
  // Gift Sets, Starter Decks, and Gateway (native catalog
  // additions, Nov 3, 2026 — see extraSealedItems in
  // exportFinance.ts): tracking starts the day they were
  // added, at TCGplayer's market price that day (Nov 3,
  // 2026, via TCGCSV). No earlier points exist.
  "Disney Lorcana: The First Chapter Gift Set": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 84.42, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Into the Inklands Gift Set": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 27.66, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Stitch Collector's Gift Set": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 32.08, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Archazia's Island Gift Box": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 36.33, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Fabled Gift Set": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 38.36, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Winterspell Gift Box - Scrooge McDuck": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 24.61, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Hyperia City Gift Box - Beast": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 69.17, "source": "tcgplayer" }
  ],
  "Disney Lorcana: The First Chapter Starter Deck (Amber & Amethyst)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 25.67, "source": "tcgplayer" }
  ],
  "Disney Lorcana: The First Chapter Starter Deck (Emerald & Ruby)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 19.59, "source": "tcgplayer" }
  ],
  "Disney Lorcana: The First Chapter Starter Deck (Sapphire & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 21.26, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Rise of the Floodborn Starter Deck (Amber & Sapphire)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 7.04, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Rise of the Floodborn Starter Deck (Amethyst & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 7.71, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Into the Inklands Starter Deck (Amber & Emerald)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 7.58, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Into the Inklands Starter Deck (Ruby & Sapphire)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 7.31, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Ursula's Return Starter Deck (Amber & Amethyst)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 9.32, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Ursula's Return Starter Deck (Sapphire & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 12.93, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Shimmering Skies Starter Deck (Amethyst & Ruby)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 16.32, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Shimmering Skies Starter Deck (Emerald & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 11.63, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Azurite Sea Starter Deck (Amber & Ruby)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 13.20, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Azurite Sea Starter Deck (Emerald & Sapphire)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 9.68, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Archazia's Island Starter Deck (Ruby & Sapphire)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 11.22, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Archazia's Island Starter Deck (Amethyst & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 9.91, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Reign of Jafar Starter Deck (Amber & Amethyst)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 8.77, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Reign of Jafar Starter Deck (Ruby & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 16.91, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Fabled Starter Deck (Emerald & Ruby)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 52.75, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Fabled Starter Deck (Amber & Sapphire)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 39.27, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Whispers in the Well Starter Deck (Sapphire & Steel)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 15.34, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Whispers in the Well Starter Deck (Amber & Emerald)": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 12.86, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Wilds Unknown 2-Player Starter Set": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 18.58, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Hyperia City 2-Player Starter Set": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 25.49, "source": "tcgplayer" }
  ],
  "Disney Lorcana: Gateway": [
    { "date": "2026-11-03", "label": "Nov 3", "value": 18.55, "source": "tcgplayer" }
  ]
};
