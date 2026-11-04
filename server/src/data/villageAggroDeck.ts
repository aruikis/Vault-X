// Village Aggro — Anthony's Amber/Emerald deck, the locked 60
// he approved on Nov 3, 2026 (source list:
// ~/workspace/lorcana/deck_village_aggro.json, name -> copies).
// He directed that the deck be created in HIS My Decks, on
// display on his profile, valued from his own inventory, with
// each used copy's "Where it lives" assigned to a "Village
// Aggro" deck location. createVillageAggroDeck does exactly
// that, once: it resolves each name to a printing he owns
// (preferring an Amber/Emerald printing, then the printing he
// owns the most copies of), creates the deck on display, and
// assigns the locations. It never runs twice — if the deck
// already exists it reports it and changes nothing.

export const VILLAGE_AGGRO_DECK_NAME = "Village Aggro";

export const VILLAGE_AGGRO_LIST: { fullName: string; qty: number }[] = [
  { fullName: "Mickey Mouse - Best in Town", qty: 4 },
  { fullName: "Bobby Zimuruski - Spray Cheese Kid", qty: 4 },
  { fullName: "Cursed Merfolk - Ursula's Handiwork", qty: 2 },
  { fullName: "Pluto - Friendly Pooch", qty: 2 },
  { fullName: "Eilonwy - Princess of Llyr", qty: 2 },
  { fullName: "Improvise", qty: 2 },
  { fullName: "Pocahontas - Guiding the Tribe", qty: 4 },
  { fullName: "Kevin - Flightless Bird", qty: 4 },
  { fullName: "Copper - Creative Storyteller", qty: 4 },
  { fullName: "Go Go Tomago - Extreme Tester", qty: 4 },
  { fullName: "Dinky - Has the Brains", qty: 4 },
  { fullName: "Rebecca Cunningham - Savvy Manager", qty: 4 },
  { fullName: "Tod - Clever Fox", qty: 4 },
  { fullName: "Abuelita - Loving Grandmother", qty: 4 },
  { fullName: "Nani - Stage Manager", qty: 2 },
  { fullName: "Percy - Pupsicle", qty: 1 },
  { fullName: "World's Greatest Criminal Mind", qty: 2 },
  { fullName: "Dale - Ready for His Shot", qty: 3 },
  { fullName: "Elinor - Renowned Diplomat", qty: 2 },
  { fullName: "Flintheart Glomgold - Scheming Billionaire", qty: 2 },
];
