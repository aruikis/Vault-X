/** Bundled official section (set) artwork, seeded into the
    game_section_art table by the syncBundledSectionArt
    action wherever a section has no art row yet — the same
    delivery pattern as the bundled card catalog (a row the
    app ships must reach populated binders on open, not wait
    for a scheduled hunt). Existing rows are never
    overwritten: a section whose art was sourced or replaced
    by the daily section-art run keeps its art.
    Star Wars: Unlimited (Nov 10, 2026 — Anthony's on-device
    verdict on the new set tiles: "Star Wars Unlimited looks
    a lot better. Only the artwork needs to be fixed on every
    one of them." The tiles' first-printing card slices were
    not set artwork at all). Each URL below is the set's own
    official key art on Fantasy Flight's own CDN
    (cdn.starwarsunlimited.com — the same CDN the catalog's
    card images live on), found on the publisher's Product
    Guide (starwarsunlimited.com/product-guide) and verified
    per set on its official set page, Nov 10, 2026:
      - Spark of Rebellion — set page
        /products/set-1-spark-of-rebellion (hero banner).
      - Shadows of the Galaxy — /products/set-2-shadows-of-the-galaxy.
      - Twilight of the Republic — /products/set-3-twilight-of-the-republic.
      - Jump to Lightspeed — /products/set-4-jump-to-lightspeed.
      - Legends of the Force — /products/set-5-legends-of-the-force.
      - Secrets of Power — /products/set-6-secrets-of-power.
      - Intro Battle: Hoth — the Product Guide's own title
        image for the set (its box/logo treatment), also the
        image the site's homepage and Product Guide feature
        for it; page /products/intro-battle-hoth.
    The remaining eight Star Wars Unlimited sections in the
    catalog — 2024 / 2025 Convention Exclusive, 2024 / 2025
    Judge Program, 2025 Promo, Jump to Lightspeed Weekly
    Play, Legends of the Force Weekly Play, and Gamegenic —
    have NO official set logo or key art anywhere on the
    publisher's site (checked Nov 10, 2026: absent from the
    Product Guide's set list, no set pages, site search
    empty). They deliberately carry NO entry here, so their
    tiles show the clean placeholder — never another set's
    art and never a random card slice. */
export const BUNDLED_SECTION_ART: {
  game: string;
  sectionKey: string;
  imageUrl: string;
  pageUrl: string;
}[] = [
  {
    game: "starwars",
    sectionKey: "SOR",
    imageUrl:
      "https://cdn.starwarsunlimited.com//SWH_Header_SOR_Key_Art_40bd735fa9.jpg",
    pageUrl:
      "https://starwarsunlimited.com/products/set-1-spark-of-rebellion",
  },
  {
    game: "starwars",
    sectionKey: "SHD",
    imageUrl:
      "https://cdn.starwarsunlimited.com//SWH_02_Header_Key_Art_8cb63a9d13.jpg",
    pageUrl:
      "https://starwarsunlimited.com/products/set-2-shadows-of-the-galaxy",
  },
  {
    game: "starwars",
    sectionKey: "TWI",
    imageUrl:
      "https://cdn.starwarsunlimited.com//TWI_Header_TWI_Key_Art_c2580cd783.png",
    pageUrl:
      "https://starwarsunlimited.com/products/set-3-twilight-of-the-republic",
  },
  {
    game: "starwars",
    sectionKey: "JTL",
    imageUrl:
      "https://cdn.starwarsunlimited.com//JTL_Header_JTL_Key_Art_d0eb90588a.jpg",
    pageUrl:
      "https://starwarsunlimited.com/products/set-4-jump-to-lightspeed",
  },
  {
    game: "starwars",
    sectionKey: "LOF",
    imageUrl:
      "https://cdn.starwarsunlimited.com//LOF_Header_LOF_Key_Art_4926aeef08.png",
    pageUrl:
      "https://starwarsunlimited.com/products/set-5-legends-of-the-force",
  },
  {
    game: "starwars",
    sectionKey: "SEC",
    imageUrl:
      "https://cdn.starwarsunlimited.com//SEC_Header_SEC_Key_Art_9550a72733.png",
    pageUrl:
      "https://starwarsunlimited.com/products/set-6-secrets-of-power",
  },
  {
    game: "starwars",
    sectionKey: "IBH",
    imageUrl:
      "https://cdn.starwarsunlimited.com//SWH_Product_Guide_Title_Intro_Battle_Hoth_8f694264d2.jpg",
    pageUrl: "https://starwarsunlimited.com/products/intro-battle-hoth",
  },
];
