// Drizzle schema for the Lorcana binder.
//
// One row per binder slot: every printed card in the catalog (main sets
// 1-14, all promo families, Illumineer's Quest sets), ordered into binder
// groups of 12-pocket pages. Ownership columns start from Anthony's Nov 1
// 2026 Shiny export (seeded once by the seedBinder action) and are editable
// in the UI afterwards; the seed never overwrites them.

import {
integer,
primaryKey,
real,
sqliteTable,
text,
} from "drizzle-orm/sqlite-core";

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Stable catalog id, e.g. "13:12345" (source set code + source card id). */
  uid: text("uid").notNull().unique(),
  /** "set" | "promo" | "quest" */
  grp: text("grp").notNull(),
  /** Binder section key: "set:1".."set:14", "promo:P1"..., "quest:Q1"... */
  groupKey: text("group_key").notNull(),
  /** Section display name, e.g. "Attack of the Vine!" or "Promo Set 1". */
  groupName: text("group_name").notNull(),
  /** Short section label for chips, e.g. "Set 13", "P1", "Quest Q1". */
  groupLabel: text("group_label").notNull(),
  /** Section ordering across the whole binder. */
  groupSort: integer("group_sort").notNull(),
  /** Slot ordering inside the section (collector number order). */
  slotSort: integer("slot_sort").notNull(),
  setCode: text("set_code").notNull(),
  family: text("family"),
  number: integer("number"),
  /** Printed identifier as it appears on the card, e.g. "207/204", "34/P2". */
  printed: text("printed").notNull(),
  fullName: text("full_name").notNull(),
  name: text("name"),
  rarity: text("rarity"),
  ink: text("ink"),
  cost: integer("cost"),
  inkwell: integer("inkwell").notNull().default(0),
  cardType: text("card_type"),
  strength: integer("strength"),
  willpower: integer("willpower"),
  lore: integer("lore"),
  cardText: text("card_text"),
  subtypes: text("subtypes"),
  /** Source URL of the official card scan (Ravensburger CDN). */
  imageUrl: text("image_url"),
  /** Blob key once the scan has been fetched into owned storage. */
  imageBlobKey: text("image_blob_key"),
  tcgplayerId: text("tcgplayer_id"),
  /** Copies Anthony owns (all finishes). 0 = missing slot (ghosted). */
  ownedQty: integer("owned_qty").notNull().default(0),
  /** JSON object: finish label -> copies, e.g. {"Regular":2,"Cold Foil":1}. */
  finishes: text("finishes").notNull().default("{}"),
  /** Quantity-weighted average market value per unit, USD. Starts as the
      Nov 1 2026 Shiny export price; the daily re-pricing refresh updates it. */
  marketValue: real("market_value"),
  /** Quantity-weighted average amount paid per unit, USD (Nov 1 2026 export;
      paid amounts stay as recorded and are never re-priced). */
  paidValue: real("paid_value"),
  /** JSON: finish label -> { value, paid } per-unit prices for that finish. */
  financeJson: text("finance_json"),
});

/** One point on the collection value-over-time chart. Seeded with the real
    Shiny export snapshots (history starts Oct 25, 2026 — the first export
    Anthony sent); a new export or the daily re-pricing appends a point. */
export const financeSnapshots = sqliteTable("finance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ISO date of the snapshot, e.g. "2026-11-01". Two exports can share a date. */
  date: text("date").notNull(),
  /** Display label, e.g. "Oct 25" or "Nov 1 (latest)". Unique per snapshot. */
  label: text("label").notNull().unique(),
  /** Collection market value that day, USD (export scope: cards + sealed + tokens/puzzle). */
  value: real("value").notNull(),
  /** Total amount paid recorded that day, USD. */
  paid: real("paid").notNull(),
  /** Total items counted that day. */
  cards: integer("cards").notNull(),
  /** "export" for a Shiny export snapshot, "daily" for a daily re-pricing point. */
  source: text("source").notNull().default("export"),
});

/** One row per in-app ownership INCREASE of a Lorcana card (Nov 6, 2026):
    written by updateOwnership / adjustPocketCount when a card's total
    owned count goes UP — a stepper tap, a pocket adjustment, a scan add.
    This is the honest source for Home's Recently Added rail under the
    New Vision 2.0 Beta theme: the rail shows only cards actually added
    through the app since this log began. Cards from the Nov 1 2026 Shiny
    export have no rows here — their add dates were never recorded, and
    none are invented for them. */
export const recentAdditions = sqliteTable("recent_additions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** The cards row id that gained copies. */
  cardId: integer("card_id").notNull(),
  /** ISO instant the copies were added in the app. */
  addedAt: text("added_at").notNull(),
  /** How many copies that increase added. */
  qty: integer("qty").notNull().default(1),
});

/** Owned-quantity overrides for sealed products. The sealed catalog
    itself (names, sets, per-unit value/paid) comes from Anthony's
    Nov 1 2026 Shiny export in data/exportFinance.ts; this table only
    stores quantities he has adjusted in the UI (plus/minus on the
    Sealed shelf), keyed by the item's exact export name. No row =
    the export quantity (1 each). */
export const sealedQty = sqliteTable("sealed_qty", {
  /** Exact sealed item name from the export, e.g. "Fabled Booster Pack". */
  name: text("name").primaryKey(),
  /** Copies Anthony owns. */
  qty: integer("qty").notNull().default(0),
  /** ISO instant the quantity was last set in the app (migration
      0027) — the closest thing to a "date acquired" the data
      honestly has: it exists only for items whose quantity was
      set in-app (e.g. a catalog box he added himself), and the
      Sealed sort says so. Null for rows from before it existed. */
  updatedAt: text("updated_at"),
});

/** One point on a single sealed product's value-over-time chart, keyed
    by the item's exact export name. Seeded from the five real Shiny
    exports (Oct 25 – Nov 1, 2026) with the item's market value per unit
    that day; a new Shiny export is what moves sealed values (sealed
    products are not part of the daily card re-pricing). */
export const sealedPriceHistory = sqliteTable("sealed_price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Exact sealed item name from the export, e.g. "Fabled Booster Pack". */
  name: text("name").notNull(),
  date: text("date").notNull(),
  label: text("label").notNull(),
  /** Market value per unit that day, USD. */
  unitValue: real("unit_value").notNull(),
  source: text("source").notNull().default("export"),
});

/** A price alert Anthony set on an individual card's or sealed item's
    detail view: notify on Home when the item's current unit value
    crosses the threshold ("below" = drops to or under, "above" = rises
    to or over). Triggered state is computed live from current prices
    whenever alerts are read — no separate evaluation job. */
export const priceAlerts = sqliteTable("price_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** "card" | "sealed" | "comic" */
  targetKind: text("target_kind").notNull(),
  /** Binder card id when targetKind is "card". */
  cardId: integer("card_id"),
  /** Exact sealed item name when targetKind is "sealed". */
  sealedName: text("sealed_name"),
  /** Client comic catalog id (e.g. "batman-136") when targetKind
      is "comic" (migration 0044) — graded comics live in the
      client's COMICS catalog, so the server resolves their current
      value from its mirrored COMIC_ALERT_CATALOG in actions.ts. */
  comicId: text("comic_id"),
  /** game_cards id when targetKind is "game" (migration 0058) —
      alerts generalize to any cataloged item with a tracked
      price; the server refuses game items whose catalog row
      carries no price. */
  gameCardId: integer("game_card_id"),
  /** Display name captured when the alert was set. */
  label: text("label").notNull(),
  /** "below" | "above" */
  direction: text("direction").notNull(),
  /** USD threshold for the item's unit value. */
  threshold: real("threshold").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Portfolio Watchlist (Nov 4, 2026): items the user is watching,
    owned or not — cards and sealed products — added from the item's
    detail view ("Watch" action) and managed in Portfolio's
    Watchlist area. One row per watched target; prices are read live
    from the same canonical sources as everywhere else (binder card
    market value / sealed unit value), never stored here. */
export const watchlistItems = sqliteTable("watchlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** "card" | "sealed" | "game" | "comic" (migration 0058:
      the Watchlist generalizes to any cataloged item — game
      catalog rows (Pokémon/Magic/Star Wars/Funko/Lego) and
      graded comics included). */
  targetKind: text("target_kind").notNull(),
  /** Binder card id when targetKind is "card". */
  cardId: integer("card_id"),
  /** Exact sealed item name when targetKind is "sealed". */
  sealedName: text("sealed_name"),
  /** game_cards id when targetKind is "game". */
  gameCardId: integer("game_card_id"),
  /** Client comic catalog id when targetKind is "comic". */
  comicId: text("comic_id"),
  createdAt: text("created_at").notNull(),
});

/** Anthony's collector identity — the unique identifier shown in the
    oval Collector ID card at the top of Home: a username he picks, a
    photo of his choice (stored as a blob; only the key lives here),
    and a stable collector code generated once and never changed, so
    the QR code that encodes username + code keeps pointing at the
    same identifier. Single row (id = 1). */
export const collectorProfile = sqliteTable("collector_profile", {
  id: integer("id").primaryKey(),
  /** The username Anthony picked, e.g. "ARUIKIS" (his Shiny/gamer handle). */
  username: text("username").notNull(),
  /** Stable unique collector code, e.g. "MC-7K2P-9QXD". */
  collectorCode: text("collector_code").notNull(),
  /** Blob key of the photo he chose for the ID card, when set. */
  photoBlobKey: text("photo_blob_key"),
  /** Blob key of the OPTIONAL profile banner image (opt-in per
      user, default none — Anthony's own stays unset unless he adds
      one). Rendered behind the profile header with the avatar on
      top, fully visible. */
  bannerBlobKey: text("banner_blob_key"),
  /** The one-line bio shown on his profile (Anthony, Nov 3,
      2026, late): edited from Edit profile on the profile
      itself; null = never edited — the profile then shows
      its starting line. */
  bio: text("bio"),
  /** The app theme he picked in Settings ("vault" | "light" |
      "midnight" | "crimson" | "contrast" | "rainbow" | "jarvis");
      null = never picked, so
      the default Vault Dark applies. Presentation only — the theme
      drives the CSS variables in theme.css and no collection data. */
  theme: text("theme"),
  /** The UI language he picked in Settings ("en" | "es" | "de" |
      "fr" | "ja"; Anthony, Nov 4, 2026); null = never picked, so
      English applies. Presentation only — catalog names and
      user content are never translated. */
  language: text("language"),
  /** Set-page grid density he picked (Anthony, Nov 4, 2026):
      2 or 4 cards across on set/chapter grids app-wide; null =
      never picked, so the default of 2 applies. Presentation
      only, like the theme. */
  gridCols: integer("grid_cols"),
  /** "Only mine" list filter he picked (Anthony, Nov 5, 2026):
      1 = long list pages (>15 displayed entries) hide every
      entry he owns nothing from; 0 or null = never on / off,
      so every list shows everything (the default). ONE shared
      choice across every collection section, presentation
      only — like the theme and grid density. */
  onlyMine: integer("only_mine"),
  /** Saved drag-reorder orders (Anthony, Nov 5, 2026): a JSON
      object mapping a reorder surface's key ("tcg-games",
      "au-areas", "sports") to the user's saved order of that
      surface's tile keys, from the app-wide long-press drag
      reorder. Presentation only — like the theme and grid
      density; no collection data. */
  reorderPrefs: text("reorder_prefs"),
  /** Trade availability (Anthony, Nov 2, 2026, late): how many
      copies of a card he is willing to trade or part with —
      tradeable quantity is SEPARATE from owned quantity.
      "keep_one" = owned minus one (his personal setting: one copy
      of each card stays back for his master sets), "all" = every
      copy is tradeable, "none" = nothing is up for trade.
      null = never picked, which reads as "keep_one", his stated
      personal setting. (Trading setting only — the old minus-1
      deck-build rule stays lifted.) */
  /** Trade availability, hybrid model (Anthony, Nov 2, 2026,
      late — supersedes the single trade_mode pick): canonical
      string in collector_profile.trade_availability. "all" =
      every owned copy tradeable (exclusive); "none" = nothing
      tradeable (exclusive); otherwise a comma-joined subset of
      the two stackable hold-backs: "master" (keep one copy of
      each printing back for the master sets) and "decks"
      (copies allocated to decks in Where it lives are held
      back). tradeMode below is the legacy single-pick column,
      still mirrored on save for older readers. */
  tradeMode: text("trade_mode"),
  /** Canonical hybrid trade availability (see above); null =
      never picked, which reads as "master", his stated
      personal default from the single-pick era. */
  tradeAvailability: text("trade_availability"),
  /** ISO instant this profile was last verified present in the
      central Supabase registry (Shadow Vault project's `profiles`
      table) by the syncCollectorRegistry action; null = not yet
      verified there. The registry row itself lives on Supabase —
      this is only the app's local record of the last check. */
  registrySyncedAt: text("registry_synced_at"),
  /** 1 once the user has read the example price-alert explanation
      on Home and dismissed it (the example banner shows only to
      users who have no price alerts of their own and haven't
      dismissed it yet); 0 = not dismissed. */
  exampleAlertDismissed: integer("example_alert_dismissed")
    .notNull()
    .default(0),
  /** 1 once the one-time TEST of the Home "Update available"
      indicator has been COMPLETED (Anthony, Nov 2, 2026,
      late: the test note sits left of his username on Home;
      tapping it walks him through the whole update flow as a
      dress rehearsal, and the flag is consumed only when he
      finishes the walkthrough — backing out leaves it armed);
      0 = the test is still to be shown. */
  updateTestSeen: integer("update_test_seen").notNull().default(0),
  /** 1 once the owner has completed the one-time TEST of the
      Home red envelope (Anthony, Nov 3, 2026): with no real
      change requests waiting, the envelope only ever rendered
      on unread rows, so he could never see or try it — the
      test envelope shows (marked TEST, with a matching test
      message in the Admin inbox) until he opens that test
      message and finishes the test there; real unread
      requests always take the envelope's place. */
  envelopeTestSeen: integer("envelope_test_seen").notNull().default(0),
  /** 1 once the user has hidden the Sealed section's intro
      window (Anthony, Nov 3, 2026): the "Your sealed Lorcana,
      kept mint in acrylic" intro sits in a bordered window
      like "How trading works", collapses to its title row
      with a Show control, and the choice is remembered. */
  sealedIntroHidden: integer("sealed_intro_hidden").notNull().default(0),
  /** Same treatment for the Social section's top intro text
      (Anthony, Nov 3, 2026): a bordered hideable window that
      collapses to its title row and can be brought back. */
  socialIntroHidden: integer("social_intro_hidden").notNull().default(0),
  /** Same treatment for the note at the very bottom of Home
      (Anthony, Nov 3, 2026, ~1:52 AM): the two-pockets
      explainer sits in a bordered hideable window like the
      Sealed/Social intros, wording unchanged. */
  homeIntroHidden: integer("home_intro_hidden").notNull().default(0),
  /** 1 once the user has hidden the "How trading works"
      explainer in Trades (Anthony, Nov 3, 2026: nobody wants
      to re-read it every time; it collapses to its title row
      with a Show control, and the choice is remembered);
      0 = shown. */
  howTradesWorkHidden: integer("how_trades_work_hidden")
    .notNull()
    .default(0),
  /** 1 = connected friends can see this collector's collection
      (Anthony, Nov 2, 2026, late: sharing is ON by default —
      people won't know it's off and it would cause problems);
      the switch lives in Settings. */
  shareCollection: integer("share_collection").notNull().default(1),
  /** The comic ids on display on this collector's Library
      slab wall (migration 0058, Anthony, Nov 4, 2026): a JSON
      array of client COMICS ids, max 5. NULL = never chosen —
      the wall then shows Anthony's standing default, his two
      signed comics (aliens-1, batman-136). */
  libraryComicDisplay: text("library_comic_display"),
  /** 1 = this collector's TOTAL COLLECTION VALUE is hidden
      from other collectors on their profile (Anthony, Nov 3,
      2026, ~11:23 AM): a privacy choice with two controls —
      a switch in Settings and a small hide button right above
      the value figure on their own profile — both driving
      this one flag. The owner always sees their own value;
      other viewers of the profile do not see the figure at
      all. 0 = value shown (the default). */
  hideCollectionValue: integer("hide_collection_value")
    .notNull()
    .default(0),
  /** The user's own Zelle handle — the email or phone number
      their Zelle is registered under (Anthony, Nov 3, 2026) —
      entered by the user in Settings > Payment info, never
      hard-coded, never shown on the public profile. It is
      revealed only to the other party inside a cash purchase
      order where this user is the seller (the "Pay the
      seller" line), so the buyer can copy it into their own
      bank app. Null = not saved. */
  zelleHandle: text("zelle_handle"),
  /** The user's own Muse invite link, pasted by the user
      themselves in Settings (Share Vault X) from the Muse
      app's Invite button (Anthony, Nov 3, 2026): it is
      included in the Share Vault X invite message so a new
      Muse sign-up is credited to the person who shared.
      Never invented or hard-coded — null until the user
      pastes their own link. */
  museInviteLink: text("muse_invite_link"),
  /** JSON array of Home "Your Collections" tile keys this
      user has hidden in Settings (Anthony, Nov 3, 2026):
      display-only — hiding a tile deletes nothing and touches
      no totals; null/empty = all six tiles shown. */
  hiddenCollections: text("hidden_collections"),
  /** JSON array of Home "Your Collections" tile keys in the
      order this user arranged them by long-hold drag on Home
      (Anthony, Nov 3, 2026, late): display-only — the order
      deletes nothing and touches no totals; null = the default
      order (Lorcana, Pokémon, Magic, Lego, Comics, Star Wars).
      Keys missing from the array (e.g. a tile added later)
      fall back to their default position at the end. */
  collectionOrder: text("collection_order"),
  /** 1 once the user has used their ONE username change in
      Settings (Anthony, Nov 3, 2026, late): a username may be
      changed exactly one time after registration, then it
      locks. Registration (the Welcome flow) is the initial
      set and does NOT consume the change. */
  usernameChangeUsed: integer("username_change_used")
    .notNull()
    .default(0),
  /** 1 once the one-time Welcome page has been completed on
      this profile (Anthony, Nov 3, 2026): the welcome +
      registration + forced tour flow shows exactly once per
      profile and never nags again; it can be re-opened
      voluntarily from Settings > About this app. */
  welcomeSeen: integer("welcome_seen").notNull().default(0),
  /** ISO instant the user registered their username through
      the Welcome flow (chose the name, got their Collector
      ID); null = the profile predates registration (an
      established profile — the welcome then shows once in
      its returning, dismissible form, with no forced tour). */
  registeredAt: text("registered_at"),
  /** This user's own Vault X invite code (Anthony, Nov 4,
      2026 — invite lineage): carried by the Share Vault X
      invite they send, distinct from their Collector ID,
      resolved server-side at a newcomer's registration so
      attribution is captured from the invite itself and
      never typed in as a name. Null = not generated yet
      (generated on first read by the server). */
  inviteCode: text("invite_code"),
  /** Invite lineage for THIS profile (Anthony, Nov 4, 2026):
      the collector code + username of whoever's invite code
      was presented when this user registered, plus when.
      Null = no voucher on file — recorded honestly, never
      guessed. OWNER-ONLY data: it is read only by the
      Admin user-trust action, never shown on any public
      profile or friends view. Lineage is provenance only —
      it NEVER feeds the verified badge. */
  vouchedByCode: text("vouched_by_code"),
  vouchedByUsername: text("vouched_by_username"),
  vouchedAt: text("vouched_at"),
  updatedAt: text("updated_at").notNull(),
});

/** The verified badge ledger (Anthony, Nov 4, 2026 — his
    design, spec at research_notes/verified-badge-spec):
    one row per collector who has ever held the badge.
    status "verified" | "revoked"; basis "root" (the owner,
    root of the chain) | "builtin" (Jarvis, the built-in
    friend) | "owner" (the owner's manual grant — the proof
    honestly reads "Verified by the owner") | "trade" (earned
    through a completed, both-sides-confirmed trade with an
    already-verified counterparty). proof_json carries the
    transparency record the badge's explainer shows: for a
    trade, the deal kind/id, the counterparty, and when it
    completed. Revocation keeps the row (and its proof) —
    a revoked badge is visible as revoked, never erased. */
export const verifiedBadges = sqliteTable("verified_badges", {
  collectorCode: text("collector_code").primaryKey(),
  username: text("username").notNull(),
  status: text("status", { enum: ["verified", "revoked"] }).notNull(),
  basis: text("basis", {
    enum: ["root", "builtin", "owner", "trade"],
  }).notNull(),
  proofJson: text("proof_json"),
  grantedAt: text("granted_at").notNull(),
  revokedAt: text("revoked_at"),
  revokedBy: text("revoked_by"),
  updatedAt: text("updated_at").notNull(),
});

/** Every badge conferral a completed trade ever produced
    (Anthony, Nov 4, 2026): the pair rule — a given pair of
    accounts can confer the badge only ONCE, ever — is
    enforced against this history, so revoking a badge does
    not let the same pair re-confer it. Invite lineage never
    writes here: the badge comes only from completed trades
    with a verified counterparty or the owner's own grant. */
export const badgeConferrals = sqliteTable("badge_conferrals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  earnerCode: text("earner_code").notNull(),
  granterCode: text("granter_code").notNull(),
  /** "trade" | "cash" | "marketplace" — the deal family. */
  kind: text("kind").notNull(),
  refId: integer("ref_id").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Invite lineage ledger (Anthony, Nov 4, 2026): one row
    per registration this server witnessed being vouched in
    by someone's invite code (source "registration"), so the
    owner can trace a swarm of signups back to one voucher
    in Admin. OWNER-ONLY: read only by the Admin user-trust
    action; never rendered on a public profile, a friends
    view, or anywhere another user can see it. Provenance
    only — it never grants, implies, or feeds the verified
    badge. */
export const inviteLineage = sqliteTable("invite_lineage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  newCollectorCode: text("new_collector_code").notNull(),
  newUsername: text("new_username").notNull(),
  vouchedByCode: text("vouched_by_code").notNull(),
  vouchedByUsername: text("vouched_by_username").notNull(),
  /** "registration" (a code presented at sign-up) — kept as
      a column so a future witnessed source can be told apart
      from a witnessed registration rather than blended in. */
  source: text("source").notNull(),
  createdAt: text("created_at").notNull(),
});

/** A deck the collector built in the app (Anthony, Nov 3,
    2026 — the deck builder): a name plus the card list
    (cards_json: [{cardId, qty}] — quantities validated
    against owned copies at save time, max 4 copies per card
    name, 60-card running total shown in the builder).
    `displayed` decks are the ones presented on the owner's
    My Decks page; copies allocated to ANY saved deck count
    toward the trade-availability "decks" hold-back when that
    hold-back is on. */
export const decks = sqliteTable("decks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** The deck owner's collector code. */
  ownerCode: text("owner_code").notNull(),
  name: text("name").notNull(),
  /** The deck box's body color (Anthony, Nov 3, 2026,
      ~12:00 PM — the cartridge-style deck box): a color id
      from the client's box palette, picked when the box is
      created/edited; null = never picked (the client shows
      its default box color). */
  color: text("color"),
  /** The card featured in the deck box's front display
      window: a binder card id from THIS deck's lines, picked
      by the owner; null = unpicked, and the box shows the
      deck's signature card instead (its highest-value card,
      resolved when the deck is read). */
  featuredCardId: integer("featured_card_id"),
  /** JSON: [{cardId, qty}] */
  cardsJson: text("cards_json").notNull().default("[]"),
  /** Copy attribution (Anthony, Nov 3, 2026 — copy-a-deck):
      when this deck was copied from another collector's
      displayed deck, the source collector's code, username,
      and the source deck's name at copy time. Null on decks
      the owner built themselves. */
  copiedFromCode: text("copied_from_code"),
  copiedFromUsername: text("copied_from_username"),
  sourceDeckName: text("source_deck_name"),
  /** 1 = shown on the owner's My Decks display page. */
  displayed: integer("displayed").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Marketplace (phase 1, Nov 2, 2026): listings, claims/offers,
    and deal feedback, stored in the app's own database. Sellers
    list items out of their own collections; a Buy Now claim or an
    accepted offer becomes a deal both sides confirm, and the
    mandatory blind feedback after completion is what feeds the
    Trust ledger on the server. No payments exist in this phase —
    a claim only reserves the item and notifies the seller. */
export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Seller's collector code (registry id), e.g. "MC-XFU8-Z5WD". */
  sellerCode: text("seller_code").notNull(),
  sellerUsername: text("seller_username").notNull(),
  /** "card" | "sealed" | "comic" */
  kind: text("kind").notNull(),
  /** Binder card id when kind is "card". */
  cardId: integer("card_id"),
  /** Exact sealed item name when kind is "sealed". */
  sealedName: text("sealed_name"),
  /** Comic id (client catalog) when kind is "comic". */
  comicId: text("comic_id"),
  name: text("name").notNull(),
  /** Set / collection line, e.g. "Hyperia City" or "Dark Horse Comics". */
  groupName: text("group_name").notNull(),
  /** Finish or type line, e.g. "Cold Foil", "Sealed", "Signature Series". */
  finish: text("finish").notNull(),
  condition: text("condition").notNull(),
  qty: integer("qty").notNull().default(1),
  askingPrice: real("asking_price").notNull(),
  /** Per-listing "Allow offers" switch (Anthony's approved
      Marketplace design, Nov 4, 2026): fixed price is the
      default way everything sells — Buy Now at the asking
      price. Offers exist only where the seller turned this
      on for that listing. 0 = off (the default), 1 = on. */
  allowOffers: integer("allow_offers").notNull().default(0),
  /** Market value per unit at listing time (comics: the logged
      value; cards/sealed are re-resolved live when read). */
  marketValue: real("market_value"),
  /** "available" | "pending" | "sold" | "removed" */
  status: text("status").notNull().default("available"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  /** Accessory ("other") listings only (Anthony, Nov 4, 2026):
      the seller-written description and the preset category
      (Oversized cards, Playmats, Lore counters, Flags &
      banners, Pins, Deck boxes & storage, Other accessories).
      Null on catalog listings. */
  description: text("description"),
  category: text("category"),
  /** The seller-uploaded photo's blob key (accessory listings
      only; required for them, null on catalog listings). */
  photoBlobKey: text("photo_blob_key"),
  /** Photo review state (Anthony's corrected flow, Nov 4,
      2026): the listing is live immediately; only the photo
      is gated. "pending" — visible to the seller only, other
      users see a placeholder; "approved" — visible to
      everyone; "rejected" — never displays, the seller may
      upload a replacement. Null on catalog listings. */
  photoStatus: text("photo_status"),
});

/** A Buy Now claim (type "claim", at the full asking price) or a
    make-an-offer bid (type "offer") on a listing. An accepted row
    IS the deal: both sides confirm on it, and completion unlocks
    the mandatory feedback step. */
export const marketplaceOffers = sqliteTable("marketplace_offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  buyerCode: text("buyer_code").notNull(),
  buyerUsername: text("buyer_username").notNull(),
  /** "claim" | "offer" */
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  /** "pending" | "accepted" | "declined" | "cancelled" */
  status: text("status").notNull().default("pending"),
  /** Both-sides completion confirmation (the in-person QR step). */
  sellerConfirmed: integer("seller_confirmed").notNull().default(0),
  buyerConfirmed: integer("buyer_confirmed").notNull().default(0),
  /** ISO instant both sides had confirmed; null until then. */
  completedAt: text("completed_at"),
  /** 1 once the completed deal has been written to the server
      trust_events ledger. */
  trustRecorded: integer("trust_recorded").notNull().default(0),
  /** Auto-settlement (same columns and machinery as trades /
      cash purchases): stamped when a fully complete card
      deal's copies have moved seller -> buyer in both
      collections; settlement_json stores the replayable plan.
      Null = not settled yet. */
  settledAt: text("settled_at"),
  settlementJson: text("settlement_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Mandatory post-deal feedback: thumbs up/down plus optional
    one-tap tags and an optional comment. Blind both ways — a side's
    rating is only revealed once BOTH sides have rated (or the
    7-day neutral close passes). */
export const marketplaceFeedback = sqliteTable("marketplace_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  offerId: integer("offer_id").notNull(),
  fromCode: text("from_code").notNull(),
  toCode: text("to_code").notNull(),
  /** "positive" | "negative" */
  rating: text("rating").notNull(),
  /** JSON array of tag labels. */
  tags: text("tags").notNull().default("[]"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
});

/** Trades (Nov 2, 2026, late — operational at release at
    Anthony's direction, unlike the held Marketplace/Forums):
    a proposed card swap between two collectors. give_json /
    get_json are JSON arrays of {cardId, name, groupName,
    printed, finish, qty} from the PROPOSER's point of view —
    give is what the proposer hands over, get is what they ask
    for. An accepted row is the deal: both sides confirm in
    person, completion writes to the server trust ledger, and
    the mandatory blind feedback (trade_feedback) finishes it,
    mirroring the marketplace deal flow. */
export const tradeOffers = sqliteTable("trade_offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposerCode: text("proposer_code").notNull(),
  proposerUsername: text("proposer_username").notNull(),
  partnerCode: text("partner_code").notNull(),
  partnerUsername: text("partner_username").notNull(),
  /** JSON: items the proposer gives. */
  giveJson: text("give_json").notNull().default("[]"),
  /** JSON: items the proposer gets. */
  getJson: text("get_json").notNull().default("[]"),
  note: text("note"),
  /** "pending" | "accepted" | "declined" | "cancelled" */
  status: text("status").notNull().default("pending"),
  /** Trade auto-archive (Anthony, Nov 3, 2026, ~11:04 PM):
      stamped the moment the offer reaches an end state
      (declined, cancelled/withdrawn, or fully complete with
      feedback resolved) — or earlier when either side
      archives a finished trade by hand. An archived trade
      leaves the active Trades list for the collapsed History
      section; the record itself is NEVER deleted (Trust and
      feedback read it forever). Null = still active. */
  archivedAt: text("archived_at"),
  proposerConfirmed: integer("proposer_confirmed").notNull().default(0),
  partnerConfirmed: integer("partner_confirmed").notNull().default(0),
  completedAt: text("completed_at"),
  trustRecorded: integer("trust_recorded").notNull().default(0),
  /** Trade auto-settlement (Anthony, Nov 3, 2026, ~5:17 PM):
      once the trade is fully complete — both sides confirmed
      AND both sides' feedback in (or the 7-day neutral close)
      — the agreed give/get lists are settled into both
      collections automatically. settlement_json stores the
      computed settlement plan (absolute per-card finish
      targets for the local binder and absolute cloud rows
      for the counterparty) the first time settlement is
      attempted, so a retry replays the same plan and can
      never double-apply; settled_at stamps when the plan
      fully landed. */
  settledAt: text("settled_at"),
  settlementJson: text("settlement_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Mandatory blind post-trade feedback, same shape and rules as
    marketplace feedback: revealed only once both sides are in
    (or the 7-day neutral close passes). */
export const tradeFeedback = sqliteTable("trade_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tradeId: integer("trade_id").notNull(),
  fromCode: text("from_code").notNull(),
  toCode: text("to_code").notNull(),
  /** "positive" | "negative" */
  rating: text("rating").notNull(),
  tags: text("tags").notNull().default("[]"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
});

/** Cash purchases (Nov 2, 2026, late — Anthony's split-button
    direction): tapping the green cash third of the split
    "I want this" button on a friend's card creates one of these
    — a cash purchase REQUEST to the card's owner at their asking
    price (a live listing's ask when one exists) or the card's
    current market value, resolved server-side at creation and
    frozen on the row. It then follows the app's established buy
    flow: the owner accepts or declines, both sides confirm once
    the in-person purchase is done, completion writes to the
    server trust ledger, and the mandatory blind feedback
    (cash_feedback) finishes it. No payment moves in the app —
    the collectors settle the cash between themselves. */
export const cashPurchases = sqliteTable("cash_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buyerCode: text("buyer_code").notNull(),
  buyerUsername: text("buyer_username").notNull(),
  sellerCode: text("seller_code").notNull(),
  sellerUsername: text("seller_username").notNull(),
  /** Binder card id of the printing being bought. */
  cardId: integer("card_id").notNull(),
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  printed: text("printed"),
  finish: text("finish").notNull(),
  qty: integer("qty").notNull().default(1),
  /** Price per copy, USD, frozen at request time. When the
      buyer adjusted the order total at checkout, this is their
      OFFERED per-copy price (the market total scaled to their
      offer); otherwise it equals the suggested price. */
  unitPrice: real("unit_price").notNull(),
  /** The system-computed TCG suggested market price per copy
      at request time (current-day TCGplayer value) — shown to
      the receiver next to the offered price so they can
      price-check the offer before accepting (Anthony, Nov 2,
      2026, late). Null on rows from before this column. */
  suggestedUnitPrice: real("suggested_unit_price"),
  /** "ask" (the seller's listing ask) | "market" (market value) */
  priceSource: text("price_source").notNull(),
  /** "pending" | "accepted" | "declined" | "cancelled" */
  status: text("status").notNull().default("pending"),
  /** Auto-archive, the cash twin of trade_offers.archivedAt
      (Anthony, Nov 3, 2026, ~11:04 PM): stamped at an end
      state or by either side's hand on a finished order; the
      order then lives in the Trades History section and is
      never deleted. Null = still active. */
  archivedAt: text("archived_at"),
  buyerConfirmed: integer("buyer_confirmed").notNull().default(0),
  sellerConfirmed: integer("seller_confirmed").notNull().default(0),
  completedAt: text("completed_at"),
  trustRecorded: integer("trust_recorded").notNull().default(0),
  /** Cash-purchase auto-settlement — same mechanism and
      rules as trade_offers.settledAt / settlementJson
      (Anthony, Nov 3, 2026, ~5:17 PM): when the purchase
      fully completes, the bought copies move from the
      seller's collection to the buyer's automatically,
      under a stored absolute-target plan that retries
      replay without double-applying. */
  settledAt: text("settled_at"),
  settlementJson: text("settlement_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Mandatory blind post-purchase feedback, same shape and rules
    as trade feedback. */
export const cashFeedback = sqliteTable("cash_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull(),
  fromCode: text("from_code").notNull(),
  toCode: text("to_code").notNull(),
  /** "positive" | "negative" */
  rating: text("rating").notNull(),
  tags: text("tags").notNull().default("[]"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
});

/** Trade-only messages (Anthony, Nov 2, 2026, late — his
    restriction set): a thread exists ONLY inside a deal — one
    row per message on a trade (kind "trade", deal_id = the
    trade_offers id) or a cash purchase (kind "cash", deal_id =
    the cash_purchases id), between exactly the two collectors
    on that deal. Text only (no attachments exist anywhere in
    the shape), links are rejected at send time, and the thread
    closes to new messages when the deal completes, is
    declined, or is cancelled — the history stays readable on
    the deal's record. There is deliberately NO standalone DM,
    friends-list chat, group, or public-room table. Stored in
    the app's own server database behind its actions, the same
    pattern as trades, offers, and feedback; a message is only
    ever returned to one of the deal's two parties. */
export const dealMessages = sqliteTable("deal_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** "trade" | "cash" */
  kind: text("kind").notNull(),
  /** trade_offers.id or cash_purchases.id, per kind. */
  dealId: integer("deal_id").notNull(),
  fromCode: text("from_code").notNull(),
  fromUsername: text("from_username").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Tiny key/value store for marketplace one-time markers (the
    test-friend listing seed runs exactly once). */
export const marketplaceMeta = sqliteTable("marketplace_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Where a physical item lives (Anthony's "Where it lives"
    feature, Nov 2, 2026): user-entered storage spots shown on an
    item's detail view — a binder (name + page/pocket), a deck
    box, a trade box, a bulk box (name + row/section), or a
    free-text somewhere else — each with how many of the item's
    copies sit there, so copies in different places are all
    accounted for. Rows exist ONLY where the user added them; no
    location is ever invented or seeded. One row per spot; an item
    can have several rows. */
export const itemLocations = sqliteTable("item_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** "card" | "sealed" | "comic" | "game" */
  targetKind: text("target_kind").notNull(),
  /** Binder card id when targetKind is "card". */
  cardId: integer("card_id"),
  /** Exact sealed item name when targetKind is "sealed". */
  sealedName: text("sealed_name"),
  /** Client comic id when targetKind is "comic". */
  comicId: text("comic_id"),
  /** game_cards id when targetKind is "game" (migration 0063 —
      a Lego set's Where it lives rows). */
  gameCardId: integer("game_card_id"),
  /** "binder" | "deck_box" | "trade_box" | "bulk_box" | "other" */
  locType: text("loc_type").notNull(),
  /** The place itself: binder name, box name, or free text. */
  place: text("place").notNull(),
  /** The spot inside it: page/pocket for a binder, row/section
      for a bulk box, anything precise for the rest (optional). */
  spot: text("spot"),
  /** Copies of the item stored at this spot. */
  qty: integer("qty").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

/** Per-friend collection sharing (Anthony, Nov 3, 2026:
    sharing lives in SETTINGS as one switch per connected
    friend, every one ON by default — people won't know to
    turn it on, so on is the default and off is the deliberate
    choice). No row for a friend = sharing ON for them. */
export const friendSharing = sqliteTable("friend_sharing", {
  /** The friend's collector code, e.g. "MC-JARVIS". */
  friendCode: text("friend_code").primaryKey(),
  /** 1 = that friend can see this collector's collection. */
  share: integer("share").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

/** User change requests (Anthony, Nov 3, 2026): any user can
    send the developer a change request, bug report, or idea
    from Settings (a simple form under App updates — a type
    plus a text message, text only). Each row is stamped
    server-side with the sender's username, Collector ID, and
    the date; Anthony reviews them in his owner-only Admin
    section. */
export const changeRequests = sqliteTable("change_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Sender's collector code, e.g. "MC-XFU8-Z5WD". */
  senderCode: text("sender_code").notNull(),
  senderUsername: text("sender_username").notNull(),
  /** "change" | "bug" | "idea" */
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  /** ISO instant the request was submitted. */
  createdAt: text("created_at").notNull(),
  /** ISO instant the owner opened this request in the
      email-style Admin inbox (Anthony, Nov 3, 2026); null =
      unread. The Home envelope badge counts unread rows. */
  readAt: text("read_at"),
  /** Ticket status (Anthony, Nov 3, 2026 — the email model
      was scratched for a work-style TICKET system): "open" |
      "in_progress" | "completed". Submitting a change
      request opens a ticket; the owner works it through the
      statuses; the Home envelope badge counts open tickets. */
  status: text("status").notNull().default("open"),
  /** ISO instant the ticket was marked completed (Nov 5,
      2026 — the Completed tickets rule): a completed ticket
      stays in the sender's Your tickets list for one week
      after this moment, then moves under their Completed
      tickets pill. Null while open/in progress; legacy
      completed rows without a stamp fall back to their
      created_at for the week count. */
  completedAt: text("completed_at"),
  /** Who the ticket is assigned to, as a display name
      (e.g. "Anthony" or "Jarvis"); null = unassigned. The
      submitter sees the assignee when following their ticket. */
  assignee: text("assignee"),
  /** Blob key of the screenshot attached to a bug report
      (Anthony, Nov 4, 2026 — bug-form photo upload); null =
      no photo. The photo travels with the ticket: the admin
      sees it in the ticket detail and the sender sees it
      under Your tickets. */
  photoBlobKey: text("photo_blob_key"),
});

/** Plain mail between collectors (Anthony, Nov 4, 2026 —
    deck sharing, simplified at his direction): sharing a
    deck renders it to a plain-text list and mails it here;
    the recipient reads it in their Inbox. One row per
    message; readAt null = unread for the recipient. */
export const mailMessages = sqliteTable("mail_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromCode: text("from_code").notNull(),
  fromUsername: text("from_username").notNull(),
  toCode: text("to_code").notNull(),
  toUsername: text("to_username").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  /** ISO instant the message was sent. */
  createdAt: text("created_at").notNull(),
  /** ISO instant the recipient opened it; null = unread. */
  readAt: text("read_at"),
});

/** Read markers for order message threads (Anthony, Nov 3,
    2026, ~2:02 AM: a reply inside an order landed silently —
    he had no signal anywhere that Jarvis had answered). One
    row per (viewer, thread): last_read_at is when that viewer
    last opened the thread; messages from the OTHER party
    newer than the marker are unread and drive the mail
    indicators on Home, on the Trades entry, and on the order
    itself. No row = the viewer has never opened the thread,
    so every message from the other side counts as unread. */
export const dealThreadReads = sqliteTable("deal_thread_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** The collector doing the reading (their collector code). */
  viewerCode: text("viewer_code").notNull(),
  /** "trade" | "cash" */
  kind: text("kind").notNull(),
  /** trade_offers.id or cash_purchases.id, per kind. */
  dealId: integer("deal_id").notNull(),
  /** ISO instant the viewer last opened this thread. */
  lastReadAt: text("last_read_at").notNull(),
});

/** Per-user Inbox deletions (Anthony, Nov 3, 2026): deleting a
    message from your Inbox is like deleting an email — it
    removes the item from YOUR Inbox only; the underlying
    purchase order / trade / ticket is untouched and the other
    party keeps their own copy. The row stamps when you
    deleted it: the item stays hidden until newer activity
    (a new message in that thread) lands after the stamp, at
    which point it reappears with the new message. */
export const inboxDeletions = sqliteTable("inbox_deletions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** The collector who deleted the item from their Inbox. */
  viewerCode: text("viewer_code").notNull(),
  /** "cash" | "trade" | "ticket" | "mail" */
  kind: text("kind").notNull(),
  /** cash_purchases.id / trade_offers.id / change_requests.id /
      mail_messages.id. */
  refId: integer("ref_id").notNull(),
  /** ISO instant of the deletion. */
  deletedAt: text("deleted_at").notNull(),
});

/** Admin change tracking (Anthony, Nov 3, 2026, 1:51 PM): one
    row per Admin dashboard metric key. `last_value` is the
    value getAdminStats most recently computed for that metric
    (a stringified scalar or composite); `seen_value` is the
    value the owner last acknowledged by tapping the metric's
    highlighted tile. A metric counts as CHANGED when the two
    differ; a null seen_value means the metric appeared after
    the baseline was set and has never been acknowledged. The
    very first stats run (empty table) writes the baseline
    with seen = last, so nothing lights up spuriously. */
export const adminMetricSeen = sqliteTable("admin_metric_seen", {
  /** Metric key, e.g. "users.total", "roster:MC-XXXX-XXXX". */
  key: text("key").primaryKey(),
  /** Last value the owner acknowledged (tap on the tile). */
  seenValue: text("seen_value"),
  /** Value from the most recent getAdminStats computation. */
  lastValue: text("last_value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** The last fully computed Admin dashboard payload (Anthony,
    Nov 3, 2026 — the Admin page speed fix): getAdminStats is the
    app's slowest action (it pages every collection_items row on
    Supabase, bulk-reads connections/trust, and estimates storage
    table by table), so tapping the Admin badge could wait ~10s
    on it. Every successful owner computation now stores its
    whole result here (single row, id = 1) and the Admin page
    reads this snapshot FIRST — one local row, no Supabase — so
    it opens instantly with the last-known numbers, labeled with
    `computedAt` as their as-of time, while the live computation
    refreshes behind it. The payload is the exact JSON of a real
    past getAdminStats response — never invented numbers; with
    no row yet, the page shows honest loading states instead. */
export const adminStatsCache = sqliteTable("admin_stats_cache", {
  id: integer("id").primaryKey(),
  /** JSON of the last full getAdminStats response (owner only). */
  payload: text("payload").notNull(),
  /** ISO instant that payload was computed. */
  computedAt: text("computed_at").notNull(),
});

/** One completed catalog audit run (Anthony, Nov 3, 2026: the
    audit-and-fill runs DAILY and its last result is visible
    in-app under Settings > Your data & backups). Written by
    saveCatalogAdditions every time the daily audit task saves
    its findings — including a zero-additions save, which is
    how a run that found nothing new still records that it
    ran. The Settings line reads the newest row. */
export const catalogAuditLog = sqliteTable("catalog_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ISO instant the audit run completed (its save landed). */
  ranAt: text("ran_at").notNull(),
  /** Printings that run inserted into the catalog. */
  added: integer("added").notNull().default(0),
  /** Printings the run supplied that were already cataloged. */
  skipped: integer("skipped").notNull().default(0),
  /** "daily" for the scheduled audit task's saves. */
  source: text("source").notNull().default("daily"),
});

/** Price audit trail (Anthony, Nov 6, 2026 — the Promo Set 3
    mispricing): the Nov 6, 2026 daily re-pricing wrote wrong-
    printing prices onto eight owned Promo Set 3 cards (Lenny
    - Toy Binoculars $1.58 → $266.75, Woody - Jungle Guide
    $2.62 → $155.33 and $55.15 → $495.44, five more like them),
    inflating the portfolio and the Top Movers rail until he
    caught it by eye. Two defenses now write here:
      kind "quarantine" — saveRepricing refused an incoming
        price whose one-day jump versus the card's tracked
        value is implausible (≥4× or ≤¼, and ≥$5); the stored
        price was NOT changed. One row per refused price.
      kind "repair" — the nightly auditPrices run found a
        card whose latest tracked history point is an
        implausible jump from the point before it, restored
        the last good value, and deleted the bad point. One
        row per repaired card (oldValue = the bad value that
        was removed, newValue = the value restored).
      kind "run" — one row per completed auditPrices run,
        carrying the run's scanned / flagged / repaired
        counts (uid and card fields null).
    The Settings > Your data & backups price-audit line reads
    the newest rows. */
export const priceAuditLog = sqliteTable("price_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ISO instant this row was written. */
  ranAt: text("ran_at").notNull(),
  /** "quarantine" | "repair" | "run". */
  kind: text("kind").notNull(),
  /** Catalog uid of the affected card (null on run rows). */
  uid: text("uid"),
  fullName: text("full_name"),
  printed: text("printed"),
  /** Quarantine: the tracked value kept. Repair: the bad
      value removed. */
  oldValue: real("old_value"),
  /** Quarantine: the refused incoming value. Repair: the
      value restored. */
  newValue: real("new_value"),
  /** Run rows only: history series scanned / cards flagged /
      cards repaired. */
  scanned: integer("scanned"),
  flagged: integer("flagged"),
  repaired: integer("repaired"),
  /** "nightly" for the scheduled audit, "save-guard" for
      saveRepricing quarantines, "manual" for in-app runs. */
  source: text("source").notNull().default("nightly"),
});

/** One point on a single card's value-over-time chart. Seeded from the five
    real Shiny exports (Oct 25 – Nov 1, 2026) with the card's weighted
    average value per copy that day; the daily re-pricing appends a point
    per day for each card it prices. */
export const cardPriceHistory = sqliteTable("card_price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Catalog uid of the printing, e.g. "13:2988". */
  uid: text("uid").notNull(),
  date: text("date").notNull(),
  label: text("label").notNull(),
  /** Market value per copy that day, USD. */
  unitValue: real("unit_value").notNull(),
  source: text("source").notNull().default("export"),
});

/** One point on a game item's value-over-time chart (Funko
    market data, Anthony, Nov 4, 2026): the item's Financial
    view shows how its value fluctuated over time, built from
    eBay SOLD values (see data/funkoSoldPrices.ts). The daily
    recordFunkoDailyPoints run appends one point per day for
    each snapshot-covered item, so the history accumulates
    going forward the same way card history does. */
export const gameCardPriceHistory = sqliteTable("game_card_price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** game_cards.id of the item. */
  gameCardId: integer("game_card_id").notNull(),
  date: text("date").notNull(),
  label: text("label").notNull(),
  /** Market value per copy that day, USD. */
  unitValue: real("unit_value").notNull(),
  source: text("source").notNull().default("daily"),
});

/** Researched detail for one Lego set (Anthony, Nov 4, 2026 —
    the Lego detail build-out): the product facts and market
    data the Lego tracking sources publish per set (Brickset,
    BrickLink, BrickEconomy, Rebrickable, Brickfact), gathered
    by an agent research task and saved through
    saveLegoSetResearch. Every field is nullable: a field with
    no real published data stays null and the detail page shows
    it plainly as unavailable — nothing here is ever estimated
    silently (forecasts are stored in their own columns and
    labeled forecasts in the app). Lists ride as JSON text:
    minifigs [{name, code, uniqueToSet, valueUsd}], sold
    listings [{date, priceUsd, condition, title, source,
    sourceUrl}], retailers [{name, priceUsd, url}], sources
    [{label, url}]. researched_at is the ISO date the research
    was saved; the page shows it as the data's as-of date. */
export const legoSetDetails = sqliteTable("lego_set_details", {
  /** game_cards.id of the Lego set. */
  gameCardId: integer("game_card_id").primaryKey(),
  /** Rebrickable set number, e.g. "75095-1". */
  setNum: text("set_num").notNull(),
  /** Exact release date, ISO yyyy-mm-dd, when a source gives one. */
  releaseDate: text("release_date"),
  /** US retail price (RRP/MSRP) at release, USD. */
  retailPriceUsd: real("retail_price_usd"),
  /** Recommended ages as printed, e.g. "14+". */
  ages: text("ages"),
  upc: text("upc"),
  ean: text("ean"),
  /** Built-model dimensions as a display string (source wording). */
  dimensions: text("dimensions"),
  weightGrams: integer("weight_grams"),
  /** Build time display string; estimates are labeled in the text. */
  buildTime: text("build_time"),
  /** Official LEGO set description, verbatim from the source. */
  description: text("description"),
  /** Availability as published, e.g. "Retired". */
  availability: text("availability"),
  /** Retirement date, ISO yyyy-mm-dd, when retired and known. */
  retiredDate: text("retired_date"),
  /** Expected retirement display string (labeled an estimate). */
  expectedRetirement: text("expected_retirement"),
  minifigsJson: text("minifigs_json"),
  /** Combined market value of the set's minifigures, USD. */
  minifigsValueUsd: real("minifigs_value_usd"),
  /** Distinct parts in the set's inventory. */
  partsDistinct: integer("parts_distinct"),
  /** Spare parts in the set's inventory. */
  partsSpares: integer("parts_spares"),
  /** BrickLink part-out value (parts sold individually), USD —
      labeled part-out in the app, never merged with set value. */
  partOutValueUsd: real("part_out_value_usd"),
  /** Current market value of a sealed copy, USD. */
  marketSealedUsd: real("market_sealed_usd"),
  /** Current market value of a used copy, USD. */
  marketUsedUsd: real("market_used_usd"),
  /** Published used-value range display string, when given. */
  usedRange: text("used_range"),
  /** Published annual growth of the sealed value, percent. */
  annualGrowthPct: real("annual_growth_pct"),
  /** Published forecasts (BrickEconomy) — always labeled
      forecast/estimate in the app. */
  forecast1yrUsd: real("forecast_1yr_usd"),
  forecast5yrUsd: real("forecast_5yr_usd"),
  soldListingsJson: text("sold_listings_json"),
  retailersJson: text("retailers_json"),
  sourcesJson: text("sources_json"),
  researchedAt: text("researched_at").notNull(),
});

/** The collector's own record for one Lego set (Anthony,
    Nov 4, 2026): what they paid per copy, the copy's
    condition and completeness (with a missing-pieces count),
    and the date the set first entered the collection
    (stamped by setGameCardOwned on the 0-to-owned step, or
    when notes are first saved for an already-owned set).
    Entered/stamped only — never invented or backfilled with
    guesses. */
export const legoOwnershipNotes = sqliteTable("lego_ownership_notes", {
  /** game_cards.id of the Lego set. */
  gameCardId: integer("game_card_id").primaryKey(),
  /** What the collector paid per copy, USD. */
  paidPriceUsd: real("paid_price_usd"),
  /** "new_sealed" | "built_complete" | "built_incomplete" |
      "in_pieces" — the Your copy condition choice. */
  condition: text("condition"),
  /** "complete" | "missing_pieces" | "unknown". */
  completeness: text("completeness"),
  /** How many pieces are missing, when known. */
  missingPieces: integer("missing_pieces"),
  /** ISO date the set first entered the collection. */
  dateAdded: text("date_added"),
});

/** Catalog rows for the other card games (Anthony, Nov 3, 2026,
    late — the three-game build): Pokémon, Magic: The Gathering,
    and Star Wars: Unlimited, cataloged the Vault X way — one row
    per printing (name, set/section, collector number, rarity /
    finish variant, artwork as an image LINK only — artwork bytes
    are not stored server-side, matching the Lorcana catalog's
    storage model — and a market price where the source publishes
    one). Rows are filled by the resumable importGameCatalog
    action from each game's canonical free source (Pokémon:
    PokemonTCG/pokemon-tcg-data on GitHub; Magic: Scryfall;
    Star Wars: Unlimited: Fantasy Flight's official card API).
    owned_qty is the collector's own count for that printing
    (0 = missing, shown ghosted) and is only ever set by them. */
export const gameCards = sqliteTable("game_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** "pokemon" | "magic" | "starwars" */
  game: text("game").notNull(),
  /** Stable per-game printing id, e.g. "pokemon:base1-4". */
  uid: text("uid").notNull().unique(),
  /** Section (set) key inside the game, e.g. "base1" / "sld". */
  sectionKey: text("section_key").notNull(),
  sectionName: text("section_name").notNull(),
  /** Section order inside the game (source release order). */
  sectionSort: integer("section_sort").notNull().default(0),
  /** Card order inside the section (collector number order). */
  slotSort: integer("slot_sort").notNull().default(0),
  /** Collector number as text (some games print letters). */
  number: text("number"),
  /** Printed identifier, e.g. "4/102", "257/204". */
  printed: text("printed").notNull(),
  name: text("name").notNull(),
  rarity: text("rarity"),
  /** Finish / variant label where the game has them. */
  finish: text("finish"),
  /** Artwork URL from the source (link only, never stored). */
  imageUrl: text("image_url"),
  /** Market price in USD where the source publishes one. */
  price: real("price"),
  /** What the collector paid per copy, USD, when they record
      it on the item's page (Money Tracker, Nov 5, 2026).
      Null = cost not recorded — shown honestly as unknown,
      never estimated. Applies to every owned copy of the
      printing (opened and sealed alike). */
  paidValue: real("paid_value"),
  ownedQty: integer("owned_qty").notNull().default(0),
  /** Sealed copies owned (Lego only, migration 0058): Lego
      value turns on the sealed-vs-opened distinction, so a
      Lego set tracks sealed copies apart from opened ones.
      Always 0 for the card games and Funko. */
  ownedSealedQty: integer("owned_sealed_qty").notNull().default(0),
  /** Box barcode (UPC/EAN digits) where one is known (Funko,
      migration 0061): the funko-pop-data catalog carries no
      barcodes, so this starts null everywhere and is filled
      only when a collector scans a box and links the barcode
      to the figure it belongs to. Barcode matching reads this
      column and nothing else — no UPC, no match, stated
      plainly in the app. */
  upc: text("upc"),
});

/** Graded slabs attached to catalog cards (Anthony, Nov 5,
    2026 — cert scanning for the top five companies): one
    row per physical graded copy, keyed by its certification
    number. The five companies wired are PSA, Beckett (BGS),
    SGC, CGC Cards, and TAG — Anthony's "top five"; every
    other grader stays parked from Nov 3. Certs are TEXT on
    purpose: real certs carry shapes a numeric column would
    eat — PSA leading zeros (06139522), TAG's leading letter
    (F6396638), SGC's hyphenated 11-character format.
    A slab IS one of the card's owned copies — adding one
    steps game_cards.owned_qty up, removing one steps it
    down — and within one company a cert is unique across
    the whole vault: one cert number, one slab, ever
    (duplicates are refused with the existing slab shown
    instead). No company pricing or live company
    verification is stored or claimed: the cert is the
    collector's own record of the slab in hand. */
export const gradedSlabs = sqliteTable("graded_slabs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** The catalog card this graded copy is a copy of. */
  gameCardId: integer("game_card_id").notNull(),
  /** Grading company: "PSA" | "BGS" | "SGC" | "CGC" |
      "TAG" — the top five (Nov 5, 2026). */
  company: text("company").notNull().default("PSA"),
  /** Certification number exactly as printed, leading
      zeros kept. */
  cert: text("cert").notNull(),
  /** Grade as printed on the label: "10", "9", "8.5", …,
      or "Authentic". */
  grade: text("grade").notNull(),
  /** What was paid for this slab, when he records it. */
  paid: real("paid"),
  /** Copies held under this one company+cert (Nov 5, 2026 —
      the Card / Slab View stepper): normally 1; the stepper
      on the slab's detail page raises it when the same cert
      covers more than one recorded copy, and game_cards
      owned_qty always moves by the same delta. */
  qty: integer("qty").notNull().default(1),
  /** Blob key of the slab's front photo when one was
      imported from the grading company's own cert record
      or saved from the collector's own photo. Null when no
      photo exists — the UI then shows the catalog card art
      in a slab frame, clearly labeled a stand-in. */
  imageKey: text("image_key"),
  /** Blob key of the slab's back photo, same rule. */
  imageBackKey: text("image_back_key"),
  /** Where the front photo came from: "company" (imported
      from the company's cert record for THIS cert),
      "user" (the collector's own photo), or null (no
      photo — catalog-art fallback). The UI words each one
      honestly and never calls the fallback a slab photo. */
  imageSource: text("image_source"),
  /** The grading company's own one-line description of the
      item from its online cert record, when the lookup
      reached one (e.g. PSA's year/brand/subject line).
      Null when no online record was read. */
  onlineLine: text("online_line"),
  /** When the online cert lookup last ran for this slab
      (epoch ms), when it ran at all. */
  onlineCheckedAt: integer("online_checked_at"),
  createdAt: integer("created_at").notNull(),
});

/** Forums (Anthony, Nov 4, 2026 — Direction A, "Latest-first
    hybrid", LIVE at launch): threads live in one flat
    category-tagged feed; posts are flat under their thread.
    Read markers are per reader so thread rows can show an
    honest read/unread state. Roles are forum-scoped and
    gated on the verified-badge ledger (see forum_roles and
    the actions): a role is effective only while its holder
    is currently verified, and a badge revocation suspends it
    until the owner re-grants. */
export const forumThreads = sqliteTable("forum_threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Category key: announcements | general | showoffs |
      decktalk | grading | trading | help. */
  category: text("category").notNull(),
  title: text("title").notNull(),
  authorCode: text("author_code").notNull(),
  authorUsername: text("author_username").notNull(),
  pinned: integer("pinned").notNull().default(0),
  locked: integer("locked").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  lastActivityAt: integer("last_activity_at").notNull(),
});

export const forumPosts = sqliteTable("forum_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull(),
  authorCode: text("author_code").notNull(),
  authorUsername: text("author_username").notNull(),
  body: text("body").notNull(),
  deleted: integer("deleted").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const forumThreadReads = sqliteTable("forum_thread_reads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull(),
  readerCode: text("reader_code").notNull(),
  lastReadAt: integer("last_read_at").notNull(),
});

export const forumRoles = sqliteTable("forum_roles", {
  collectorCode: text("collector_code").primaryKey(),
  /** "admin" | "moderator" (the owner's Owner role is
      inherent to the owner account, never a row). */
  role: text("role").notNull(),
  grantedBy: text("granted_by").notNull(),
  grantedAt: integer("granted_at").notNull(),
  /** 1 once a badge revocation suspended the role; only an
      owner re-grant (which requires a current verified
      badge) clears it. */
  suspended: integer("suspended").notNull().default(0),
});

/** Resumable import progress per game: the importer works in
    chunks (a few sets/pages per call) and stores its cursor in
    `state` (JSON), so a download of tens of thousands of
    printings never has to finish inside one request — the
    section's Continue control and the daily continuation both
    pick up exactly where the last chunk stopped. */
export const gameImportMeta = sqliteTable("game_import_meta", {
  game: text("game").primaryKey(),
  state: text("state").notNull().default("{}"),
  setsTotal: integer("sets_total").notNull().default(0),
  setsDone: integer("sets_done").notNull().default(0),
  cardsTotal: integer("cards_total").notNull().default(0),
  complete: integer("complete").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

/** Per-version go-live stamps (Anthony, Nov 5, 2026):
    the first time a shipped build is confirmed live (the
    running copy's version equals the version the server is
    serving), the server records that moment here, and
    Settings shows it under the up-to-date line. One row per
    version; the first stamp wins and is never rewritten.
    v1.97.0 predates the table — its row is seeded from that
    build's recorded audit trail by the versionLiveStamp
    action. */
export const versionLiveStamps = sqliteTable("version_live_stamps", {
  version: text("version").primaryKey(),
  wentLiveAt: text("went_live_at").notNull(),
});

/** Official product artwork for catalog SECTIONS (sets)
    whose own catalog source is text-only (Anthony, Nov 5,
    2026: Disney Topps + Garbage Pail Kids). One row per
    section that has verified official artwork: imageUrl is
    the publisher's own product photo (Topps' launch
    platform), pageUrl the official product page it came
    from. The bytes are ingested into blob storage by the
    getSectionArt action — the client never hotlinks. */
export const gameSectionArt = sqliteTable(
  "game_section_art",
  {
    game: text("game").notNull(),
    sectionKey: text("section_key").notNull(),
    imageUrl: text("image_url").notNull(),
    pageUrl: text("page_url"),
  },
  (t) => [primaryKey({ columns: [t.game, t.sectionKey] })],
);

/** Collector-sourced artwork for individual catalog CARDS
    whose own catalog source is text-only (Anthony, Nov 6,
    2026: Topps publishes checklists with no images, so he
    directed the hunt to other sites — collector databases
    and collector marketplaces). One row per card filled by
    importCardArt: imageUrl is the front scan of that exact
    card (also written onto game_cards.imageUrl, which is
    what the grids and detail pages render), pageUrl the
    source page it was taken from, source the site's name
    (e.g. "Trading Card Database", "COMC"). The provenance
    row is what lets a later pass replace a dead or wrong
    collector image without ever touching art that came
    with a catalog itself. */
export const gameCardArt = sqliteTable(
  "game_card_art",
  {
    game: text("game").notNull(),
    cardId: integer("card_id").notNull(),
    imageUrl: text("image_url").notNull(),
    pageUrl: text("page_url"),
    source: text("source"),
  },
  (t) => [primaryKey({ columns: [t.game, t.cardId] })],
);

/** The Library's per-collector arrangement (Anthony, Nov 4,
    2026): shelf order and spine order inside each shelf,
    saved when the owner drags to reorder their own Library.
    One row per collector code; `orderJson` carries
    { sections: string[], entries: string[] } — section keys
    and entry ids in display order. Anything not listed keeps
    its natural place after the listed ids, so newly owned
    binders simply append until arranged. */
export const libraryOrders = sqliteTable("library_orders", {
  collectorCode: text("collector_code").primaryKey(),
  orderJson: text("order_json").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull().default(0),
});
