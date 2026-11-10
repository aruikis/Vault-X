// Puzzle / Lore insert cards. Nearly every Lorcana set's booster
// packs include one insert card per pack — a puzzle piece whose
// art assembles into the set's full puzzle artwork, or (in the
// later sets) a story Lore card whose backs form pictures. These
// inserts are NOT part of the sets' 204-card lists and are not in
// the LorcanaJSON catalog the main catalog was slimmed from, so
// they are hand-authored here.
//
// ALL-SETS AUDIT (Nov 4, 2026 — Anthony: "make sure that all
// chapters are checked for all puzzle work"). Every set 1–14 was
// re-checked against TCGplayer's own product catalog (its search
// API lists each insert as a named product — "<Set> Puzzle
// Insert (Top Left)" etc. — which settles both the piece count
// and each piece's position), the Mushu Report wiki's Insert
// page, and Zatu's set reviews. Findings per set:
//
//   Set 1  The First Chapter — 4 puzzle pieces, Mickey Mouse -
//          Brave Little Tailor art (TCGplayer 512520/21/22/23;
//          wiki Insert page agrees).
//   Set 2  Rise of the Floodborn — 4 pieces, Minnie Mouse -
//          Wide-Eyed Diver (TCGplayer 528652/54/48/49; wiki).
//   Set 3  Into the Inklands — NO puzzle: its packs carried two
//          rules inserts instead (wiki Insert page; TCGplayer
//          lists no Inklands insert products), so it gets no
//          Puzzle section.
//   Set 4  Ursula's Return — 9 pieces, Ursula - Sea Witch Queen
//          art (TCGplayer 706207–706215; wiki: nine-card puzzle).
//   Set 5  Shimmering Skies — UNRESOLVED: TCGplayer lists no
//          Shimmering Skies insert products at all and the wiki
//          does not cover the set; one eBay listing ("Insert Card
//          set of 4") is the only source for the 4 entries kept
//          here, and a set overview says the packs carried a
//          Gateway art card instead. The 4 entries stay as-is
//          (no images) until a source settles it — removing
//          possibly-real pockets would be worse than keeping
//          them.
//   Set 6  Azurite Sea — 9 pieces (CORRECTED from 6: TCGplayer
//          lists nine named pieces, 706228–706236, plus a "Set
//          of 9" product, 596419; the artwork is the Stitch /
//          Jim Hawkins sailing art).
//   Set 7  Archazia's Island — 20 Lore cards (TCGplayer carries
//          only #1, 710941, and #20, 710942, as products, so only
//          those two pockets have scans; the other 18 stay name
//          plates — no verified scan source exists for them).
//          Their backs form two 9-piece pictures (Mushu Report
//          wiki, Lore Card).
//   Set 8  Reign of Jafar — 19 Lore cards (TCGplayer names every
//          one "Lore Card (N of 19)" and sells a "Set of 19" —
//          the 19 count is settled; all 19 carry scans). Two
//          9-piece pictures on the backs.
//   Set 9  Fabled — 9 pieces, Powerline - World's Greatest Rock
//          Star art (TCGplayer 706218–706226).
//   Set 10 Whispers in the Well — 18 Lore cards, Judy Hopps art
//          (wiki transcribes 18 story cards; TCGplayer carries
//          NO Whispers lore products, so no scans — name plates).
//   Set 11 Winterspell — BOTH series (CORRECTED from "18 Lore"):
//          9 Lore cards (TCGplayer 706606, 706900, 706917,
//          706935–706939, 706944) AND a 9-piece "Snowball Fight"
//          puzzle (TCGplayer 682934–682944) — packs contain one
//          insert, either a lore card or a puzzle piece, which
//          is where the "18" figure came from. The lore cards
//          keep uids/numbers 1–9; the puzzle pieces reuse
//          uids/numbers 10–18, relabeled by seedBinder's puzzle
//          descriptive sync.
//   Set 12 Wilds Unknown — 9 pieces (kind CORRECTED from lore
//          to puzzle: TCGplayer names them "Wilds Unknown
//          Puzzle Insert", 693590–693598).
//   Set 13 Attack of the Vine! — 9 pieces (ADDED by this audit;
//          it was skipped before for lack of a verified count).
//          Zatu's booster-box review: "a new 9-card Puzzle art
//          ... the artwork shows the new Hunny characters in
//          all their glory with Winnie at the centre"; its Trove
//          review: "each pack includes one card of the new
//          nine-piece puzzle art ... themed around the new
//          Winnie the Pooh and the Hunny Characters". TCGplayer
//          707325–707333 plus a "Set of 9" product (707324).
//   Set 14 Hyperia City — 9 pieces (TCGplayer 724311–724319).
//          Its packs can also put an Ink Drop counter in the
//          insert slot — see INK_DROP_ENTRIES below.
//
// ARTWORK: each piece/lore entry's image is that product's real
// scan on TCGplayer's own CDN, using the same
// product/<id>_in_1000x1000.jpg pattern the Ink Drop counters
// verified on Nov 3, 2026; every id wired here was fetched and
// confirmed a real JPEG on Nov 4, 2026. Each set's "Full Puzzle
// Art" entry uses the TCGplayer "Set of N" product's image (a
// photo of the complete assembled set) where that product HAS
// an image: sets 1, 4, 6, 9, 11, 12, 13. The Hyperia City
// (723665) and Reign of Jafar (711002) set products have NO
// image on the CDN (both sizes return 403), so those two Full
// entries stay imageless rather than borrow a wrong picture.
// Rise of the Floodborn's Full entry keeps the WDWNT assembled-
// puzzle photo wired on Nov 3, 2026. Images flow through the
// existing cardImage pipeline into owned blob storage on first
// view — no remote URL is rendered directly. Piece names carry
// their grid position (Top Left, Middle Center, ...) exactly as
// TCGplayer names the products, in reading order.

import type { CatalogEntry } from "./catalogTypes";

const tcgImage = (id: number): string =>
  `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`;

/** Grid positions in reading order, matching how TCGplayer names
    the piece products and how the wiki lists the parts. */
const POSITIONS_9 = [
  "Top Left",
  "Top Middle",
  "Top Right",
  "Middle Left",
  "Middle Center",
  "Middle Right",
  "Bottom Left",
  "Bottom Middle",
  "Bottom Right",
];
const POSITIONS_4 = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"];

interface PuzzleSetSpec {
  setCode: string;
  setName: string;
  /** Number of pieces / lore cards in the series. */
  count: number;
  /** "puzzle" for the classic art-piece inserts, "lore" for the
      story Lore cards of the later sets. */
  kind: "puzzle" | "lore";
  /** The character/subject the assembled artwork shows, when a
      listing names one. */
  subject: string | null;
  /** TCGplayer product id per piece, in binder piece order
      (reading order for puzzle grids; card number for lore
      cards); null where TCGplayer carries no such product. */
  pieceTcg?: (number | null)[];
  /** TCGplayer "Set of N" product id — its image is the
      assembled-set photo used by the Full Puzzle Art entry. */
  fullArtTcg?: number;
  /** Verified assembled-artwork image URL (Full Puzzle Art only)
      when it comes from a non-TCGplayer source. */
  fullArtImage?: string;
  /** Binder number for the Full Puzzle Art entry when it is not
      count + 1 (Winterspell: its puzzle pieces sit at 10–18
      after the 9 lore cards, so Full is 19). */
  fullNumber?: number;
  /** Replacement text for the Full Puzzle Art entry. */
  fullText?: string;
}

const PUZZLE_SETS: PuzzleSetSpec[] = [
  {
    setCode: "1",
    setName: "The First Chapter",
    count: 4,
    kind: "puzzle",
    subject: "Mickey Mouse - Brave Little Tailor",
    pieceTcg: [512520, 512521, 512522, 512523],
    fullArtTcg: 512519,
  },
  {
    setCode: "2",
    setName: "Rise of the Floodborn",
    count: 4,
    kind: "puzzle",
    subject: "Minnie Mouse - Wide-Eyed Diver",
    pieceTcg: [528652, 528654, 528648, 528649],
    fullArtImage:
      "https://r2-media.wdwnt.com/2023/11/lorcana-rise-of-the-floodborn-puzzle-3570.jpg",
  },
  {
    setCode: "4",
    setName: "Ursula's Return",
    count: 9,
    kind: "puzzle",
    subject: "Ursula - Sea Witch Queen",
    pieceTcg: [
      706207, 706208, 706209, 706210, 706211, 706212, 706213, 706214, 706215,
    ],
    fullArtTcg: 552251,
  },
  { setCode: "5", setName: "Shimmering Skies", count: 4, kind: "puzzle", subject: null },
  {
    setCode: "6",
    setName: "Azurite Sea",
    count: 9,
    kind: "puzzle",
    subject: "Stitch",
    pieceTcg: [
      706228, 706229, 706230, 706231, 706232, 706233, 706234, 706235, 706236,
    ],
    fullArtTcg: 596419,
  },
  {
    setCode: "7",
    setName: "Archazia's Island",
    count: 20,
    kind: "lore",
    subject: null,
    // Only lore cards #1 and #20 are TCGplayer products; the
    // other 18 have no verified scan source and stay name plates.
    pieceTcg: [
      710941,
      null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null,
      710942,
    ],
  },
  {
    setCode: "8",
    setName: "Reign of Jafar",
    count: 19,
    kind: "lore",
    subject: null,
    pieceTcg: [
      711212, 711215, 711216, 711217, 711218, 711219, 711220, 711221, 711226,
      711227, 711228, 711229, 711230, 711231, 711232, 711233, 711234, 711235,
      711236,
    ],
    // The "Set of 19" product (711002) has no image on
    // TCGplayer's CDN, so the Full entry stays imageless.
  },
  {
    setCode: "9",
    setName: "Fabled",
    count: 9,
    kind: "puzzle",
    subject: "Powerline - World's Greatest Rock Star",
    pieceTcg: [
      706218, 706219, 706220, 706221, 706222, 706223, 706224, 706225, 706226,
    ],
    fullArtTcg: 706217,
  },
  { setCode: "10", setName: "Whispers in the Well", count: 18, kind: "lore", subject: "Judy Hopps" },
  {
    setCode: "11",
    setName: "Winterspell",
    count: 9,
    kind: "lore",
    subject: null,
    pieceTcg: [
      706606, 706900, 706917, 706935, 706936, 706937, 706938, 706939, 706944,
    ],
    // The Full entry shows the set's Snowball Fight puzzle,
    // assembled (the "Set of 9" product photo, 682933) — the
    // puzzle half of Winterspell's two insert series.
    fullArtTcg: 682933,
    fullNumber: 19,
    fullText:
      "The complete assembled Snowball Fight puzzle artwork from Winterspell, put together from all 9 puzzle pieces. Winterspell packs put one insert in the slot: a lore card or a puzzle piece.",
  },
  {
    setCode: "12",
    setName: "Wilds Unknown",
    count: 9,
    kind: "puzzle",
    subject: null,
    pieceTcg: [
      693598, 693597, 693596, 693595, 693594, 693593, 693592, 693591, 693590,
    ],
    fullArtTcg: 693588,
  },
  {
    setCode: "13",
    setName: "Attack of the Vine!",
    count: 9,
    kind: "puzzle",
    subject: "Winnie the Pooh",
    pieceTcg: [
      707325, 707326, 707327, 707328, 707329, 707330, 707331, 707332, 707333,
    ],
    fullArtTcg: 707324,
  },
  {
    setCode: "14",
    setName: "Hyperia City",
    count: 9,
    kind: "puzzle",
    subject: null,
    pieceTcg: [
      724311, 724312, 724313, 724314, 724315, 724316, 724317, 724318, 724319,
    ],
    // NO assembled photo for Hyperia City (Anthony, Nov 4,
    // 2026, live on-device): TCGplayer's photo for the "Set
    // of 9" product (723665) is a completely different
    // picture — not the assembled Hyperia City artwork at
    // all — while the nine piece scans below are correct.
    // The Full Puzzle Art entry therefore carries NO photo
    // and renders the assembled-from-pieces composite (the
    // set's own nine piece scans joined in reading order),
    // which is the genuine assembled artwork by construction.
    // Piece order verified Nov 4, 2026 against Hoard's
    // per-piece pages: 724311 Top Left, 724312 Top Middle,
    // 724313 Top Right, 724314 Middle Left, 724315 Middle
    // Center — ascending ids are reading order.
  },
];

function puzzleEntry(partial: Partial<CatalogEntry> & { uid: string; setCode: string; setName: string }): CatalogEntry {
  return {
    grp: "puzzle",
    family: null,
    number: null,
    printed: "",
    fullName: null,
    name: null,
    rarity: null,
    ink: null,
    cost: null,
    inkwell: false,
    type: null,
    strength: null,
    willpower: null,
    lore: null,
    text: null,
    subtypes: null,
    image: null,
    tcg: null,
    ...partial,
  };
}

// Ink Drop counter cards (Anthony, Nov 3, 2026): Hyperia City
// introduced the ink drop mechanic, and its booster packs can put
// a printed Ink Drop counter card in the same last slot the
// puzzle pieces live in (Laughing Place's prerelease-box review:
// Ink Drop cards "randomly appear in the last slot where different
// puzzle cards/advertisements/etc. have lived"). There are exactly
// TWO designs, confirmed by TCGplayer's catalog via Anthony's own
// Shiny exports (every export Oct 25 – Nov 1, 2026 lists both):
// "Ink Drop" (TCGplayer 722932) and "Ink Drop (Blue)" (TCGplayer
// 722933). Neither is in LorcanaJSON's allCards.json (checked
// Nov 3, 2026 — counters aren't cards there), which is why they
// were missing entirely. Each entry's image is that product's real
// card scan on TCGplayer's own CDN (fetched and visually verified
// Nov 3, 2026: both are the genuine printed Counter cards, art by
// Matthew Eng, "EN • 14", rules text "(This counter doesn't count
// as a card.) You may remove this counter to pay 1 ⬡."). They ride
// the puzzle group for set 14 (grp "puzzle"), so they sit in the
// Hyperia City set page right alongside its puzzle pieces as
// single pockets, ghosted until owned; Anthony sets his counts
// with the steppers, exactly like the puzzle pieces (his export
// counts for the tokens — 44 and 45 — live in the export's
// non-binder totals and were never binder ownership).
const INK_DROP_ENTRIES: CatalogEntry[] = [
  puzzleEntry({
    uid: "puzzle:14:inkdrop",
    setCode: "14",
    setName: "Hyperia City",
    number: 11,
    printed: "Counter",
    fullName: "Ink Drop",
    name: "Ink Drop",
    rarity: "Counter",
    type: "Counter",
    text: "(This counter doesn\u2019t count as a card.) You may remove this counter to pay 1 \u2b21.",
    image:
      "https://tcgplayer-cdn.tcgplayer.com/product/722932_in_1000x1000.jpg",
    tcg: 722932,
  }),
  puzzleEntry({
    uid: "puzzle:14:inkdrop-blue",
    setCode: "14",
    setName: "Hyperia City",
    number: 12,
    printed: "Counter",
    fullName: "Ink Drop (Blue)",
    name: "Ink Drop",
    rarity: "Counter",
    type: "Counter",
    text: "(This counter doesn\u2019t count as a card.) You may remove this counter to pay 1 \u2b21.",
    image:
      "https://tcgplayer-cdn.tcgplayer.com/product/722933_in_1000x1000.jpg",
    tcg: 722933,
  }),
];

// Winterspell's puzzle half (Nov 4, 2026 audit): the set's packs
// carry EITHER a lore card (the 9 in PUZZLE_SETS above) OR one of
// these 9 "Snowball Fight" puzzle pieces (TCGplayer 682934–
// 682944). They reuse the uids/numbers 10–18 that the earlier
// "18 Lore cards" model put in this group, so binders seeded
// with that model keep their rows — seedBinder's puzzle
// descriptive sync relabels them in place.
const WINTERSPELL_PUZZLE_TCG = [
  682934, 682935, 682936, 682937, 682938, 682941, 682942, 682943, 682944,
];
const WINTERSPELL_PUZZLE_ENTRIES: CatalogEntry[] = WINTERSPELL_PUZZLE_TCG.map(
  (tcg, i) => {
    const k = i + 1;
    const pos = POSITIONS_9[i] ?? "";
    return puzzleEntry({
      uid: `puzzle:11:${9 + k}`,
      setCode: "11",
      setName: "Winterspell",
      number: 9 + k,
      printed: `${k}/9`,
      fullName: `Snowball Fight — Puzzle Piece ${k} of 9 (${pos})`,
      name: "Snowball Fight",
      rarity: "Puzzle",
      type: "Puzzle",
      text: `Puzzle piece ${k} of 9 from Winterspell — the Snowball Fight artwork. Winterspell packs put one insert in the slot: a lore card or a puzzle piece.`,
      image: tcgImage(tcg),
      tcg,
    });
  },
);

// Great Hunny Rescue prize-pack illustration cards (Anthony,
// Nov 9, 2026): Illumineer's Quest: The Great Hunny Rescue's box
// carries two prize packs — The Search for Piglet and The Heart
// of the Vine — and each pack holds two cards: one playable foil
// (With a Few Good Friends; The Beanstalk — both regular Quest
// catalog cards) plus ONE full-art illustration card: no gameplay
// text, no collector number, just the artwork and the artist's
// signature (the Heart of the Vine piece is art by Sam Burley —
// a wizard facing the glowing Vine, per Anthony's own photo of
// his copy). Anthony's direction: "We can treat them like the
// puzzle cards." So they live here as puzzle-group entries under
// the Quest's own code (group puzzle:Q3, rendered as an insert
// section inside the Great Hunny Rescue Quest page): single
// pockets with their own steppers, ghosted when missing, NOT
// regular cards and NOT counted in any set's pocket totals or
// master-set counts. No artwork is wired: no verified scan
// source exists for either piece, so both render the clean
// imageless pocket like the unscanned lore cards rather than
// borrow a wrong picture. Anthony opened both packs and owns
// both cards, but ownership is NOT pre-set — the entries start
// unowned and he adds his copies with the steppers himself.
const HUNNY_PRIZE_ENTRIES: CatalogEntry[] = [
  puzzleEntry({
    uid: "puzzle:Q3:piglet",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 1,
    printed: "Illustration",
    fullName: "Prize Pack Illustration — The Search for Piglet",
    name: "Prize Pack Illustration",
    rarity: "Illustration",
    type: "Illustration",
    text: "Full-art illustration card from The Search for Piglet prize pack in Illumineer's Quest: The Great Hunny Rescue — the pack's other card is the playable foil With a Few Good Friends. Art by Alex Accorsi (from Anthony's own photo of his copy): Tigger watches Piglet float up on a balloon toward Pooh the Hunny Archmage. No gameplay text and no collector number: a collectible art piece, tracked like the puzzle inserts.",
    image: null,
    tcg: null,
  }),
  puzzleEntry({
    uid: "puzzle:Q3:vine",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 2,
    printed: "Illustration",
    fullName: "Prize Pack Illustration — The Heart of the Vine",
    name: "Prize Pack Illustration",
    rarity: "Illustration",
    type: "Illustration",
    text: "Full-art illustration card from The Heart of the Vine prize pack in Illumineer's Quest: The Great Hunny Rescue — the pack's other card is the playable foil The Beanstalk. Art by Sam Burley: a wizard facing the glowing Vine. No gameplay text and no collector number: a collectible art piece, tracked like the puzzle inserts.",
    image: null,
    tcg: null,
  }),
];

// Great Hunny Rescue ENCOUNTER cards (Anthony, Nov 10, 2026 —
// the "cards don't match what's in my hand" report): Quest 3's
// cards 1/37 through 6/37 are DOUBLE-SIDED. The playable face
// the catalogs list (Mickey Mouse - Rescued from the Entrance
// at 1/37, Rapunzel at 2/37, and so on) is the BACK; the FRONT
// of each is a landscape Encounter card — a chamber of the Vine
// with a lore goal and a special rule, flipped over when the
// Illumineers clear it to reveal the rescued glimmer. Anthony's
// first physical card, Entrance Tunnel "1 of 37", is the front
// of 1/37 — the app showed only its back, so the Quest looked
// wrong from the first card. No card database (official gallery,
// Lorcast, LorcanaJSON — all re-checked live Nov 10, 2026)
// lists the fronts separately: gallery/Lorcast numbering for
// the 37 was verified card-by-card and already matches the
// binder exactly, so the 37 stay untouched and the six fronts
// live here as their own insert group (group encounter:Q3,
// rendered as an "Encounter Cards" subsection inside the Quest
// 3 page — separate from the set cards, exactly like the Prize
// Pack Illustrations). Single pockets with their own steppers,
// ghosted when missing, starting unowned like the illustration
// cards. No artwork is wired: the fronts are landscape game
// components with no verified scan source, so they render the
// clean imageless pocket rather than borrow a wrong picture.
//
// The six fronts, in order (two journeys of three encounters;
// numbering is continuous 1–6 across both journeys; lore goals
// repeat 5 / 12 / 20 per journey). Verified Nov 10, 2026 from
// the Inkborn Heroes unboxing walkthrough of the physical
// cards (youtube.com/watch?v=qysIQ3svBKY, ~11:20–14:10),
// corroborated by the BoardGameQuest review photos (Vine Pod
// Chamber front + its Chamber Guardian back) and Zatu's review
// (two journeys × three encounters, 5/12/20 lore goals):
//   1/37 Entrance Tunnel — The Search for Piglet, Encounter 1,
//        lore 5, GROWING THREAT; back: Mickey Mouse - Rescued
//        from the Entrance. Art by Douglas De La Hoz.
//   2/37 Room of Darkness — Encounter 2, lore 12, TWIST AWAY
//        (Vine Tendrils gain Evasive); back: Rapunzel -
//        Rescued from the Darkness. Art by Gabe Ramos.
//   3/37 Vine Pod Chamber — Encounter 3, lore 20, RESURGENCE +
//        RISING THREAT; back: Chamber Guardian - Vine
//        Protector (clearing it wins the journey and opens
//        The Search for Piglet prize pack). Art by Rubin
//        Chung / Leonardo Giammichele.
//   4/37 Garden of Hungry Vegetables — The Heart of the Vine,
//        Encounter 4, lore 5, NEW GROWTH (the Vine makes a
//        Vine Tendril); back: Sulley - Rescued from the Garden.
//   5/37 Staircase of Thorns — Encounter 5, lore 12, BRIARS
//        EVERYWHERE (a questing character takes 1 damage,
//        not reduced by Resist); back: Maleficent - Rescued
//        from the Staircase.
//   6/37 Story Star Chamber — Encounter 6, lore 20, FALTERING
//        HOPE + INK RESERVES + RISING THREAT; back: The Vine
//        Maw - Final Foe (clearing it wins the journey and
//        opens The Heart of the Vine prize pack). Art by
//        Alyssa Lee.
const HUNNY_ENCOUNTER_ENTRIES: CatalogEntry[] = [
  puzzleEntry({
    uid: "encounter:Q3:1",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 1,
    printed: "1/37",
    fullName: "Entrance Tunnel — Encounter 1 (The Search for Piglet)",
    name: "Entrance Tunnel",
    rarity: "Encounter",
    type: "Encounter",
    text: "Encounter 1 of The Search for Piglet in Illumineer's Quest: The Great Hunny Rescue — the front of card 1/37. Lore goal 5. GROWING THREAT: at the start of the Vine's turn, it gains 1 lore. When the Illumineers complete this encounter, they rescue the character on the back of this card: Mickey Mouse - Rescued from the Entrance (1/37 in the set above). Art by Douglas De La Hoz.",
    image: null,
    tcg: null,
  }),
  puzzleEntry({
    uid: "encounter:Q3:2",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 2,
    printed: "2/37",
    fullName: "Room of Darkness — Encounter 2 (The Search for Piglet)",
    name: "Room of Darkness",
    rarity: "Encounter",
    type: "Encounter",
    text: "Encounter 2 of The Search for Piglet in Illumineer's Quest: The Great Hunny Rescue — the front of card 2/37. Lore goal 12. TWIST AWAY: Vine Tendril characters gain Evasive. When the Illumineers complete this encounter, they rescue the character on the back of this card: Rapunzel - Rescued from the Darkness (2/37 in the set above). Art by Gabe Ramos.",
    image: null,
    tcg: null,
  }),
  puzzleEntry({
    uid: "encounter:Q3:3",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 3,
    printed: "3/37",
    fullName: "Vine Pod Chamber — Encounter 3 (The Search for Piglet)",
    name: "Vine Pod Chamber",
    rarity: "Encounter",
    type: "Encounter",
    text: "Encounter 3 of The Search for Piglet in Illumineer's Quest: The Great Hunny Rescue — the front of card 3/37, and the journey's final encounter. Lore goal 20. RESURGENCE and RISING THREAT. When the Illumineers complete this encounter, they rescue the character on the back of this card: Chamber Guardian - Vine Protector (3/37 in the set above) — clearing it wins the journey and opens The Search for Piglet prize pack. Art by Rubin Chung and Leonardo Giammichele.",
    image: null,
    tcg: null,
  }),
  puzzleEntry({
    uid: "encounter:Q3:4",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 4,
    printed: "4/37",
    fullName: "Garden of Hungry Vegetables — Encounter 4 (The Heart of the Vine)",
    name: "Garden of Hungry Vegetables",
    rarity: "Encounter",
    type: "Encounter",
    text: "Encounter 4 — the first encounter of the second journey, The Heart of the Vine, in Illumineer's Quest: The Great Hunny Rescue — the front of card 4/37. Lore goal 5. NEW GROWTH: the Vine makes a Vine Tendril. When the Illumineers complete this encounter, they rescue the character on the back of this card: Sulley - Rescued from the Garden (4/37 in the set above).",
    image: null,
    tcg: null,
  }),
  puzzleEntry({
    uid: "encounter:Q3:5",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 5,
    printed: "5/37",
    fullName: "Staircase of Thorns — Encounter 5 (The Heart of the Vine)",
    name: "Staircase of Thorns",
    rarity: "Encounter",
    type: "Encounter",
    text: "Encounter 5 of The Heart of the Vine in Illumineer's Quest: The Great Hunny Rescue — the front of card 5/37. Lore goal 12. BRIARS EVERYWHERE: a questing character takes 1 damage, which can't be reduced by Resist. When the Illumineers complete this encounter, they rescue the character on the back of this card: Maleficent - Rescued from the Staircase (5/37 in the set above).",
    image: null,
    tcg: null,
  }),
  puzzleEntry({
    uid: "encounter:Q3:6",
    setCode: "Q3",
    setName: "Illumineer's Quest: The Great Hunny Rescue",
    number: 6,
    printed: "6/37",
    fullName: "Story Star Chamber — Encounter 6 (The Heart of the Vine)",
    name: "Story Star Chamber",
    rarity: "Encounter",
    type: "Encounter",
    text: "Encounter 6 of The Heart of the Vine in Illumineer's Quest: The Great Hunny Rescue — the front of card 6/37, and the journey's final encounter. Lore goal 20. FALTERING HOPE, INK RESERVES, and RISING THREAT. When the Illumineers complete this encounter, they rescue the character on the back of this card: The Vine Maw - Final Foe (6/37 in the set above) — clearing it wins the journey and opens The Heart of the Vine prize pack. Art by Alyssa Lee.",
    image: null,
    tcg: null,
  }),
];

export const puzzleCatalog: CatalogEntry[] = [
  ...PUZZLE_SETS.flatMap((spec) => {
  const entries: CatalogEntry[] = [];
  const pieceWord = spec.kind === "lore" ? "Lore Card" : "Puzzle Piece";
  const positions =
    spec.kind === "puzzle"
      ? spec.count === 9
        ? POSITIONS_9
        : spec.count === 4
          ? POSITIONS_4
          : []
      : [];
  for (let n = 1; n <= spec.count; n += 1) {
    const tcg = spec.pieceTcg?.[n - 1] ?? null;
    const pos = positions[n - 1];
    entries.push(
      puzzleEntry({
        uid: `puzzle:${spec.setCode}:${n}`,
        setCode: spec.setCode,
        setName: spec.setName,
        number: n,
        printed: `${n}/${spec.count}`,
        fullName: spec.subject
          ? `${spec.subject} — ${pieceWord} ${n} of ${spec.count}${pos ? ` (${pos})` : ""}`
          : `${pieceWord} ${n} of ${spec.count}${pos ? ` (${pos})` : ""}`,
        name: spec.subject ?? pieceWord,
        rarity: spec.kind === "lore" ? "Lore" : "Puzzle",
        type: spec.kind === "lore" ? "Lore Card" : "Puzzle",
        text:
          spec.kind === "lore"
            ? `Lore card ${n} of ${spec.count} from ${spec.setName} — one of the story cards found in the set's booster packs.`
            : `Puzzle piece ${n} of ${spec.count} from ${spec.setName} — collect all ${spec.count} pieces to assemble the set's full puzzle artwork.`,
        image: tcg != null ? tcgImage(tcg) : null,
        tcg,
      }),
    );
  }
  entries.push(
    puzzleEntry({
      uid: `puzzle:${spec.setCode}:full`,
      setCode: spec.setCode,
      setName: spec.setName,
      number: spec.fullNumber ?? spec.count + 1,
      printed: "Full",
      fullName: spec.subject
        ? `${spec.subject} — Full Puzzle Art`
        : "Full Puzzle Art",
      name: "Full Puzzle Art",
      rarity: spec.kind === "lore" ? "Lore" : "Puzzle",
      type: "Puzzle Art",
      text:
        spec.fullText ??
        `The complete assembled puzzle artwork from ${spec.setName}, put together from all ${spec.count} ${spec.kind === "lore" ? "lore cards" : "puzzle pieces"}.`,
      image:
        spec.fullArtImage ??
        (spec.fullArtTcg != null ? tcgImage(spec.fullArtTcg) : null),
      tcg: spec.fullArtTcg ?? null,
    }),
  );
    return entries;
  }),
  ...WINTERSPELL_PUZZLE_ENTRIES,
  ...INK_DROP_ENTRIES,
  ...HUNNY_PRIZE_ENTRIES,
  ...HUNNY_ENCOUNTER_ENTRIES,
];
