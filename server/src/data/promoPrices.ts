// PROMO FAMILY COST-TO-COMPLETE SWEEP — OUTCOME (Nov 3, 2026,
// verified per family against binder finance, the Lorcast API
// live, and TCGplayer pricepoints; live getBinder totals read
// before and after):
//   FIXED (prices existed, tile read $0, now reads them):
//     CC1 Curator's Collection: Heroines — $492.60, 0 unpriced
//     PD1 Promos — $22.24 (4 of 9 missing priced; 5 have no
//       TCGplayer product and no Lorcast price, still unpriced)
//   GENUINELY UNPRICED (checked, no tracked price exists —
//   the tiles' "no tracked prices yet" is honest and stays):
//     P4 (1 missing), RPH (3), C3 (17), CC2 (6)
//   ALREADY CORRECT, UNTOUCHED (verified identical):
//     P1 $13,044.05 · P2 $545.17 · P3 $2,526.88 · D23 $488.35
//     C1 $7,710.53 · C2 $8,236.29 · DIS $131.23
//
// Market price snapshot for PROMO printings, keyed by binder uid:
// { usd: non-foil price, usdFoil: foil price } from the Lorcast
// API (api.lorcast.com/v0/cards/search?q=set:<family>), pulled
// Nov 3, 2026. Lorcast aggregates TCGplayer market prices, the
// same basis as the main catalogPrices snapshot.
//
// Why this file exists: promo printings in the binder catalog
// carry no TCGplayer id and no export finance (Anthony does not
// own most of them), so the normal price chain priced EVERY
// missing promo pocket as untracked and every promo tile showed
// "Cost to complete $0" (Anthony's bug report, Nov 3, 2026).
// Matching: binder uid -> Lorcast record by family + collector
// number + card name; where Lorcast dedupes a Tempest-foil/plain
// printing pair into one record (Challenge families), both
// printings share that record's prices. Printings Lorcast
// tracks without a price (most event/store promos — they are
// not sold on TCGplayer) and families Lorcast does not carry
// at all (C3, CC2, RPH) are absent here and stay honestly
// unpriced: the completion views disclose them as "no tracked
// price" instead of guessing. Coverage of the 255 catalog promo
// printings: 131 priced (P1 39/39, P2 36/38, P3 32/59, C1 8/10,
// C2 7/20, D23 6/16, DIS 3/9).
//
// Nov 3, 2026 (late) — the CC1 / PD1 gap: those two families are
// the ones Lorcast carries WITHOUT prices (every record's prices
// object is empty and it links no TCGplayer id), yet the cards
// ARE sold as TCGplayer singles and the binder catalog carries
// their product ids. TCGplayer's own pricepoints for those ids
// carry real foil market prices, so the ten printings below were
// pulled straight from TCGplayer (mpapi pricepoints, Nov 3,
// 2026) and keyed by binder uid like the rest: all six CC1
// printings, plus the four PD1 printings Anthony is missing
// that have a TCGplayer product (the other missing PD1
// printings — Beast 1/PD1, Above the Crowd, Pegasus, With a Few
// Good Friends, The Beanstalk — have no TCGplayer product and
// no Lorcast price, and stay honestly unpriced, as do P4's one
// missing printing, C3, CC2, and RPH, which no source prices).
// Every one of the ten is foil-only on TCGplayer (Normal market
// price null), matching how these promos were issued.

export const PROMO_PRICE_SNAPSHOT_DATE = "Nov 3, 2026";

export interface PromoPrice {
  usd: number | null;
  usdFoil: number | null;
}

export const promoPrices: Record<string, PromoPrice> = {
  "10:2439": { usd: null, usdFoil: 1.03 },
  "10:2440": { usd: null, usdFoil: 0.47 },
  "10:2441": { usd: null, usdFoil: 1.94 },
  "10:2442": { usd: null, usdFoil: 1.69 },
  "10:2443": { usd: null, usdFoil: 1.24 },
  "10:2444": { usd: 1.81, usdFoil: null },
  "10:2445": { usd: 1.81, usdFoil: null },
  "10:2446": { usd: null, usdFoil: 17.1 },
  "10:2447": { usd: null, usdFoil: 27.47 },
  "10:2463": { usd: null, usdFoil: 7.14 },
  "11:2706": { usd: null, usdFoil: 0.52 },
  "11:2707": { usd: null, usdFoil: 1.4 },
  "11:2708": { usd: null, usdFoil: 0.97 },
  "11:2709": { usd: null, usdFoil: 0.91 },
  "11:2710": { usd: null, usdFoil: 0.82 },
  "1:1187": { usd: null, usdFoil: 50.1 },
  "1:1188": { usd: null, usdFoil: 1456.86 },
  "1:1190": { usd: 121.22, usdFoil: 6000 },
  "1:1191": { usd: null, usdFoil: 218.58 },
  "1:1198": { usd: 50.76, usdFoil: 3000 },
  "1:2432": { usd: null, usdFoil: 1500 },
  "1:2460": { usd: 109.01, usdFoil: null },
  "1:3595": { usd: 114.41, usdFoil: null },
  "1:659": { usd: 1192, usdFoil: null },
  "1:660": { usd: null, usdFoil: 1250 },
  "1:661": { usd: null, usdFoil: 5999.99 },
  "1:662": { usd: null, usdFoil: 0.25 },
  "1:663": { usd: null, usdFoil: 840 },
  "1:664": { usd: null, usdFoil: 1000 },
  "1:665": { usd: null, usdFoil: 976.49 },
  "1:666": { usd: null, usdFoil: 11.73 },
  "1:667": { usd: null, usdFoil: 4.99 },
  "1:668": { usd: null, usdFoil: 1.34 },
  "1:669": { usd: 108.18, usdFoil: null },
  "1:670": { usd: 95.23, usdFoil: null },
  "1:671": { usd: 81.38, usdFoil: null },
  "1:678": { usd: null, usdFoil: 9.85 },
  "1:679": { usd: null, usdFoil: 23.24 },
  "1:680": { usd: null, usdFoil: 10.45 },
  "1:681": { usd: null, usdFoil: 9.29 },
  "1:682": { usd: null, usdFoil: 31.02 },
  "2:1189": { usd: 115.94, usdFoil: 950.97 },
  "2:1192": { usd: null, usdFoil: 61.23 },
  "2:672": { usd: null, usdFoil: 1.39 },
  "2:673": { usd: null, usdFoil: 1.72 },
  "2:674": { usd: null, usdFoil: 2.29 },
  "2:675": { usd: null, usdFoil: 1.43 },
  "2:676": { usd: null, usdFoil: 37.12 },
  "2:677": { usd: null, usdFoil: 32.43 },
  "2:689": { usd: null, usdFoil: 20.08 },
  "2:690": { usd: null, usdFoil: 18.71 },
  "2:691": { usd: null, usdFoil: 12.38 },
  "3:1193": { usd: null, usdFoil: 49.08 },
  "3:684": { usd: null, usdFoil: 0.79 },
  "3:685": { usd: null, usdFoil: 0.46 },
  "3:686": { usd: null, usdFoil: 1.16 },
  "3:687": { usd: null, usdFoil: 0.98 },
  "3:688": { usd: null, usdFoil: 1250 },
  "3:955": { usd: null, usdFoil: 10.83 },
  "4:1194": { usd: null, usdFoil: 27.67 },
  "4:2436": { usd: null, usdFoil: 162.67 },
  "4:3243": { usd: null, usdFoil: 19.89 },
  "4:950": { usd: null, usdFoil: 6.71 },
  "4:951": { usd: null, usdFoil: 0.58 },
  "4:952": { usd: null, usdFoil: 0.44 },
  "4:953": { usd: null, usdFoil: 0.95 },
  "4:954": { usd: null, usdFoil: 114.08 },
  "4:956": { usd: null, usdFoil: 6.35 },
  "5:1180": { usd: null, usdFoil: 14.26 },
  "5:1181": { usd: null, usdFoil: 10.57 },
  "5:1182": { usd: null, usdFoil: 0.57 },
  "5:1183": { usd: null, usdFoil: 1.23 },
  "5:1184": { usd: null, usdFoil: 0.62 },
  "5:1185": { usd: null, usdFoil: 1.85 },
  "5:1186": { usd: null, usdFoil: 28.25 },
  "5:1195": { usd: null, usdFoil: 45.4 },
  "5:1196": { usd: null, usdFoil: 1850 },
  "5:1197": { usd: null, usdFoil: 3999.99 },
  "5:2184": { usd: null, usdFoil: 10.58 },
  "5:3244": { usd: null, usdFoil: 13.58 },
  "6:1422": { usd: null, usdFoil: 86.39 },
  "6:1423": { usd: null, usdFoil: 3.28 },
  "6:1424": { usd: null, usdFoil: 7.57 },
  "6:1425": { usd: null, usdFoil: 0.54 },
  "6:1426": { usd: null, usdFoil: 0.69 },
  "6:1427": { usd: null, usdFoil: 1.77 },
  "6:1428": { usd: null, usdFoil: 0.55 },
  "6:1429": { usd: null, usdFoil: 33.57 },
  "6:1430": { usd: null, usdFoil: 12.59 },
  "6:1431": { usd: null, usdFoil: 3.87 },
  "6:1664": { usd: 65.66, usdFoil: 10000 },
  "6:2434": { usd: null, usdFoil: 176.42 },
  "6:2435": { usd: null, usdFoil: 197.01 },
  "6:2437": { usd: null, usdFoil: 160.78 },
  "6:2438": { usd: null, usdFoil: 217.51 },
  "7:1433": { usd: null, usdFoil: 2.61 },
  "7:1656": { usd: null, usdFoil: 10.5 },
  "7:1657": { usd: null, usdFoil: 0.73 },
  "7:1658": { usd: null, usdFoil: 0.9 },
  "7:1659": { usd: null, usdFoil: 0.67 },
  "7:1660": { usd: null, usdFoil: 1.11 },
  "7:1661": { usd: null, usdFoil: 21.12 },
  "7:1662": { usd: null, usdFoil: 21.12 },
  "7:2452": { usd: null, usdFoil: 3979 },
  "7:2456": { usd: null, usdFoil: 3979 },
  "8:1887": { usd: null, usdFoil: 11.86 },
  "8:1888": { usd: null, usdFoil: 1.2 },
  "8:1889": { usd: null, usdFoil: 0.68 },
  "8:1890": { usd: null, usdFoil: 0.78 },
  "8:1891": { usd: null, usdFoil: 0.43 },
  "8:1892": { usd: 1.29, usdFoil: null },
  "8:1893": { usd: 1.29, usdFoil: null },
  "8:1894": { usd: null, usdFoil: 1.97 },
  "8:1935": { usd: null, usdFoil: 4.3 },
  "8:2453": { usd: null, usdFoil: 40.59 },
  "8:2457": { usd: null, usdFoil: 40.59 },
  "9:2179": { usd: null, usdFoil: 34 },
  "9:2180": { usd: null, usdFoil: 2.22 },
  "9:2181": { usd: null, usdFoil: 0.84 },
  "9:2182": { usd: 1.31, usdFoil: null },
  "9:2183": { usd: 1.31, usdFoil: null },
  "9:2185": { usd: null, usdFoil: 1.03 },
  "9:2186": { usd: null, usdFoil: 4.93 },
  "9:2187": { usd: null, usdFoil: 0.89 },
  "9:2188": { usd: null, usdFoil: 7.01 },
  "9:2433": { usd: null, usdFoil: 5.41 },
  "9:2451": { usd: 44.05, usdFoil: 74.61 },
  "9:2455": { usd: 44.05, usdFoil: 74.61 },
  "9:3245": { usd: null, usdFoil: 97.76 },
  "x:P2:15": { usd: 114.41, usdFoil: null },
  "x:P2:17": { usd: 132.56, usdFoil: null },
  // CC1 — Curator's Collection: Heroines (TCGplayer pricepoints,
  // Nov 3, 2026; product ids 702517-702521, 702603).
  "1:3237": { usd: null, usdFoil: 135.34 },
  "7:3238": { usd: null, usdFoil: 93.53 },
  "6:3239": { usd: null, usdFoil: 56.86 },
  "9:3240": { usd: null, usdFoil: 62.83 },
  "8:3241": { usd: null, usdFoil: 70.11 },
  "9:3242": { usd: null, usdFoil: 73.93 },
  // PD1 printings Anthony is missing that carry a TCGplayer
  // product (ids 705068, 702706, 705074, 702707).
  "13:3227": { usd: null, usdFoil: 8.94 },
  "13:3230": { usd: null, usdFoil: 6.37 },
  "13:3231": { usd: null, usdFoil: 3.32 },
  "13:3232": { usd: null, usdFoil: 3.61 },
};
