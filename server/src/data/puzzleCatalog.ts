// Puzzle / Lore insert cards (Anthony, Nov 3, 2026): nearly every
// Lorcana set's booster packs include one puzzle/art insert per
// pack — collect all of a set's pieces to assemble the full
// artwork. These inserts are NOT part of the sets' 204-card lists
// and are not in the LorcanaJSON catalog the main catalog was
// slimmed from, so they are hand-authored here from marketplace
// and wiki listings, verified Nov 3, 2026:
//
//   Set 1  The First Chapter — 4 puzzle pieces, Mickey Mouse -
//          Brave Little Tailor art (Philibert "Puzzle Mickey (4
//          cartes)"; COMC position-named piece listings).
//   Set 2  Rise of the Floodborn — 4 pieces, Minnie Mouse -
//          Wide-Eyed Diver (eBay complete 4-card puzzle listings;
//          WDWNT's assembled-puzzle photo, used for the Full
//          Puzzle Art entry below).
//   Set 3  Into the Inklands — NO puzzle: its packs carried rules
//          cards instead, so it gets no Puzzle section.
//   Set 4  Ursula's Return — 9 pieces, Ursula art (Coleka:
//          "a nine-card artistic puzzle"; eBay complete sets).
//   Set 5  Shimmering Skies — 4 insert pieces (eBay shop listing:
//          "Shimmering Skies Insert Card set of 4").
//   Set 6  Azurite Sea — 6 pieces, Stitch art (Anthony's research;
//          eBay complete-art listing names Stitch for this set).
//   Set 7  Archazia's Island — 20 Lore cards (comicbook.com: "one
//          of 20 randomized Lore cards in every Booster pack";
//          OfferUp/eBay complete 20-card sets). Their backs form
//          two 9-piece pictures (Mushu Report wiki, Lore Card).
//   Set 8  Reign of Jafar — 19 Lore cards (eBay "Story Card Set
//          #1-19"; the wiki's Lore Card page excerpts run to card
//          19). Two 9-piece pictures (Jafar / Palace).
//   Set 9  Fabled — 9 pieces, Powerline art (Anthony's research;
//          eBay complete-art listing names Powerline).
//   Set 10 Whispers in the Well — 18 Lore cards, Judy Hopps art
//          (Anthony's research: story art sets of 18; eBay
//          complete-art listing names Judy Hopps).
//   Set 11 Winterspell — 18 Lore cards (eBay: "Winterspell — 18
//          Puzzle/Lore card set. Complete").
//   Set 12 Wilds Unknown — 9 pieces (eBay: "Wilds Unknown — 9
//          Puzzle/Lore card set. Complete").
//   Set 13 Attack of the Vine! — no verified piece count found
//          in listings or the wiki, so it gets no Puzzle section
//          yet (add it here when a count is verified).
//   Set 14 Hyperia City — 9 pieces (Anthony's research).
//
// Each set also gets ONE "Full Puzzle Art" entry — the assembled
// artwork as its own ownable item. Only Rise of the Floodborn's
// assembled image is wired so far (the WDWNT photo Anthony's
// research supplied, verified as the completed Minnie puzzle);
// the other sets' Full Puzzle Art entries carry no image until
// an assembled photo for that set is verified — the pocket then
// shows the item's name plate, like any card whose art hasn't
// loaded. Piece entries carry no per-piece image for the same
// reason: no verified per-piece scan source exists in the data
// the catalog was built from.

import type { CatalogEntry } from "./catalogTypes";

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
  /** Verified assembled-artwork image URL (Full Puzzle Art only). */
  fullArtImage?: string;
}

const PUZZLE_SETS: PuzzleSetSpec[] = [
  { setCode: "1", setName: "The First Chapter", count: 4, kind: "puzzle", subject: "Mickey Mouse - Brave Little Tailor" },
  {
    setCode: "2",
    setName: "Rise of the Floodborn",
    count: 4,
    kind: "puzzle",
    subject: "Minnie Mouse - Wide-Eyed Diver",
    fullArtImage:
      "https://r2-media.wdwnt.com/2023/11/lorcana-rise-of-the-floodborn-puzzle-3570.jpg",
  },
  { setCode: "4", setName: "Ursula's Return", count: 9, kind: "puzzle", subject: "Ursula" },
  { setCode: "5", setName: "Shimmering Skies", count: 4, kind: "puzzle", subject: null },
  { setCode: "6", setName: "Azurite Sea", count: 6, kind: "puzzle", subject: "Stitch" },
  { setCode: "7", setName: "Archazia's Island", count: 20, kind: "lore", subject: null },
  { setCode: "8", setName: "Reign of Jafar", count: 19, kind: "lore", subject: null },
  { setCode: "9", setName: "Fabled", count: 9, kind: "puzzle", subject: "Powerline" },
  { setCode: "10", setName: "Whispers in the Well", count: 18, kind: "lore", subject: "Judy Hopps" },
  { setCode: "11", setName: "Winterspell", count: 18, kind: "lore", subject: null },
  { setCode: "12", setName: "Wilds Unknown", count: 9, kind: "lore", subject: null },
  { setCode: "14", setName: "Hyperia City", count: 9, kind: "puzzle", subject: null },
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

export const puzzleCatalog: CatalogEntry[] = PUZZLE_SETS.flatMap((spec) => {
  const entries: CatalogEntry[] = [];
  const pieceWord = spec.kind === "lore" ? "Lore Card" : "Puzzle Piece";
  for (let n = 1; n <= spec.count; n += 1) {
    entries.push(
      puzzleEntry({
        uid: `puzzle:${spec.setCode}:${n}`,
        setCode: spec.setCode,
        setName: spec.setName,
        number: n,
        printed: `${n}/${spec.count}`,
        fullName: spec.subject
          ? `${spec.subject} — ${pieceWord} ${n} of ${spec.count}`
          : `${pieceWord} ${n} of ${spec.count}`,
        name: spec.subject ?? pieceWord,
        rarity: spec.kind === "lore" ? "Lore" : "Puzzle",
        type: spec.kind === "lore" ? "Lore Card" : "Puzzle",
        text:
          spec.kind === "lore"
            ? `Lore card ${n} of ${spec.count} from ${spec.setName} — one of the story cards found in the set's booster packs.`
            : `Puzzle piece ${n} of ${spec.count} from ${spec.setName} — collect all ${spec.count} pieces to assemble the set's full puzzle artwork.`,
      }),
    );
  }
  entries.push(
    puzzleEntry({
      uid: `puzzle:${spec.setCode}:full`,
      setCode: spec.setCode,
      setName: spec.setName,
      number: spec.count + 1,
      printed: "Full",
      fullName: spec.subject
        ? `${spec.subject} — Full Puzzle Art`
        : "Full Puzzle Art",
      name: "Full Puzzle Art",
      rarity: spec.kind === "lore" ? "Lore" : "Puzzle",
      type: "Puzzle Art",
      text: `The complete assembled puzzle artwork from ${spec.setName}, put together from all ${spec.count} ${spec.kind === "lore" ? "lore cards" : "puzzle pieces"}.`,
      image: spec.fullArtImage ?? null,
    }),
  );
  return entries;
});
