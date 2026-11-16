// Village Aggro — INTENTIONALLY EMPTY in the shared source.
//
// This module backs the one-off createVillageAggroDeck action, which
// builds a named starter deck from a fixed list. The list previously
// shipped here was the original owner's personal deck; it was
// removed in v1.127.0 so shared Vault X installs contain nothing
// from anyone's collection (see AGENTS.md, "Privacy: personal data
// files"). With an empty list the action has nothing to build, and
// every collector creates their own decks inside the app.

export const VILLAGE_AGGRO_DECK_NAME = "Village Aggro";

export const VILLAGE_AGGRO_LIST: { fullName: string; qty: number }[] = [];
