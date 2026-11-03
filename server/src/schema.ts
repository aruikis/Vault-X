// Drizzle schema for the Lorcana binder.
//
// One row per binder slot: every printed card in the catalog (main sets
// 1-14, all promo families, Illumineer's Quest sets), ordered into binder
// groups of 12-pocket pages. Ownership columns start from Anthony's Nov 1
// 2026 Shiny export (seeded once by the seedBinder action) and are editable
// in the UI afterwards; the seed never overwrites them.

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  /** "card" | "sealed" */
  targetKind: text("target_kind").notNull(),
  /** Binder card id when targetKind is "card". */
  cardId: integer("card_id"),
  /** Exact sealed item name when targetKind is "sealed". */
  sealedName: text("sealed_name"),
  /** Display name captured when the alert was set. */
  label: text("label").notNull(),
  /** "below" | "above" */
  direction: text("direction").notNull(),
  /** USD threshold for the item's unit value. */
  threshold: real("threshold").notNull(),
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
  /** The app theme he picked in Settings ("vault" | "light" |
      "midnight" | "crimson" | "contrast"); null = never picked, so
      the default Vault Dark applies. Presentation only — the theme
      drives the CSS variables in theme.css and no collection data. */
  theme: text("theme"),
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
  /** The user's own Zelle handle — the email or phone number
      their Zelle is registered under (Anthony, Nov 3, 2026) —
      entered by the user in Settings > Payment info, never
      hard-coded, never shown on the public profile. It is
      revealed only to the other party inside a cash purchase
      order where this user is the seller (the "Pay the
      seller" line), so the buyer can copy it into their own
      bank app. Null = not saved. */
  zelleHandle: text("zelle_handle"),
  /** JSON array of Home "Your Collections" tile keys this
      user has hidden in Settings (Anthony, Nov 3, 2026):
      display-only — hiding a tile deletes nothing and touches
      no totals; null/empty = all six tiles shown. */
  hiddenCollections: text("hidden_collections"),
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
  updatedAt: text("updated_at").notNull(),
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
  /** JSON: [{cardId, qty}] */
  cardsJson: text("cards_json").notNull().default("[]"),
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
  /** Market value per unit at listing time (comics: the logged
      value; cards/sealed are re-resolved live when read). */
  marketValue: real("market_value"),
  /** "available" | "pending" | "sold" | "removed" */
  status: text("status").notNull().default("available"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
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
  proposerConfirmed: integer("proposer_confirmed").notNull().default(0),
  partnerConfirmed: integer("partner_confirmed").notNull().default(0),
  completedAt: text("completed_at"),
  trustRecorded: integer("trust_recorded").notNull().default(0),
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
  buyerConfirmed: integer("buyer_confirmed").notNull().default(0),
  sellerConfirmed: integer("seller_confirmed").notNull().default(0),
  completedAt: text("completed_at"),
  trustRecorded: integer("trust_recorded").notNull().default(0),
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
  /** "card" | "sealed" | "comic" */
  targetKind: text("target_kind").notNull(),
  /** Binder card id when targetKind is "card". */
  cardId: integer("card_id"),
  /** Exact sealed item name when targetKind is "sealed". */
  sealedName: text("sealed_name"),
  /** Client comic id when targetKind is "comic". */
  comicId: text("comic_id"),
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
  /** Who the ticket is assigned to, as a display name
      (e.g. "Anthony" or "Jarvis"); null = unassigned. The
      submitter sees the assignee when following their ticket. */
  assignee: text("assignee"),
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
  /** "cash" | "trade" | "ticket" */
  kind: text("kind").notNull(),
  /** cash_purchases.id / trade_offers.id / change_requests.id. */
  refId: integer("ref_id").notNull(),
  /** ISO instant of the deletion. */
  deletedAt: text("deleted_at").notNull(),
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
