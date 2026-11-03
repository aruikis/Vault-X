import {
useEffect,
useMemo,
useRef,
useState,
type ReactNode,
type TouchEvent as ReactTouchEvent,
} from "react";
import {
useMutation,
useQuery,
useQueryClient,
} from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import {
Area,
AreaChart,
Bar,
BarChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { api, type ApiResponse } from "./api";
import { qrMatrix } from "./qr";
import {
ComicsPanel,
COMICS,
COMICS_TOTAL_VALUE,
COMICS_VALUE_CHECKED,
} from "./comics";
import { LegoPanel } from "./lego";
import {
collectionToCsv,
collectionToJson,
collectionToXlsx,
deliverFile,
type ExportRow,
} from "./exportCollection";
import { pruneOldArtCaches, useCachedArt } from "./artCache";
import { APP_NAME, APP_VERSION, CHANGELOG } from "./version";
import { Turntable } from "./turntable";
import { OwnedLocationBar } from "./whereItLives";
import { SidewaysCountDial } from "./countDial";
import {
manualSaveCount,
setManualSaveCount,
useManualSaveCount,
} from "./saveMode";
import {
hapticConfirm,
hapticTick,
hapticsEnabled,
setHapticsEnabled,
} from "./haptics";
import {
evaluateBadges,
type BadgeState,
} from "./achievements";
import {
THEMES,
applyTheme,
isThemeId,
readStoredTheme,
type ThemeId,
} from "./themes";
import tcgplayerLogo from "./assets/tcgplayer-logo.png";
import deckBoxPhoto from "./assets/deck-box-custom.jpg";
import vaultXRingArtwork from "./assets/vault-x-ring-artwork.webp";
import setLogo1 from "./assets/set-logos/set-1.png";
import setLogo2 from "./assets/set-logos/set-2.png";
import setLogo3 from "./assets/set-logos/set-3.png";
import setLogo4 from "./assets/set-logos/set-4.png";
import setLogo5 from "./assets/set-logos/set-5.png";
import setLogo6 from "./assets/set-logos/set-6.png";
import setLogo7 from "./assets/set-logos/set-7.png";
import setLogo8 from "./assets/set-logos/set-8.png";
import setLogo9 from "./assets/set-logos/set-9.png";
import setLogo10 from "./assets/set-logos/set-10.png";
import setLogo11 from "./assets/set-logos/set-11.png";
import setLogo12 from "./assets/set-logos/set-12.png";
import setLogo13 from "./assets/set-logos/set-13.png";
import setLogo14 from "./assets/set-logos/set-14.png";
import promoD23Art from "./assets/set-logos/promo-d23.png";
import promoIcon from "./assets/set-logos/promo-icon.png";
import questArtQ1 from "./assets/set-logos/quest-q1.png";
import questArtQ2 from "./assets/set-logos/quest-q2.png";
import questArtQ3 from "./assets/set-logos/quest-q3.png";
import collectionLorcana from "./assets/collection-lorcana.webp";
import collectionPokemon from "./assets/collection-pokemon.webp";
import collectionMagic from "./assets/collection-magic.webp";
import collectionLego from "./assets/collection-lego.webp";
import collectionComics from "./assets/collection-comics.webp";
import collectionStarwars from "./assets/collection-starwars.webp";
import sealedBoosterFront from "./assets/sealed/sealed-booster-front.webp";
import sealedHyperiaBox from "./assets/sealed/item-hyperia-box.webp";
import sealedHyperiaPrerelease from "./assets/sealed/item-hyperia-prerelease.webp";
import sealedHyperiaPack from "./assets/sealed/item-hyperia-pack.webp";
import sealedFabledPack from "./assets/sealed/item-fabled-pack.webp";
import sealedFirstChapterPack from "./assets/sealed/item-firstchapter-pack.webp";
import sealedWinterspellPack from "./assets/sealed/item-winterspell-pack.webp";
import sealedWildsPack from "./assets/sealed/item-wilds-pack.webp";
import sealedVinePack from "./assets/sealed/item-vine-pack.webp";
import sealedUrsulaPack from "./assets/sealed/item-ursula-pack.webp";
import sealedJafarPack from "./assets/sealed/item-jafar-pack.webp";
import sealedShimmeringPack from "./assets/sealed/item-shimmering-pack.webp";
import sealedFloodbornPack from "./assets/sealed/item-floodborn-pack.webp";
import sealedInklandsPack from "./assets/sealed/item-inklands-pack.webp";
import sealedAzuritePack from "./assets/sealed/item-azurite-pack.webp";
import sealedJapaneseFirstChapterPack from "./assets/sealed/item-japanese-firstchapter-pack.webp";
import sealedTroveFirstChapter from "./assets/sealed/item-trove-firstchapter.webp";
import sealedTroveFloodborn from "./assets/sealed/item-trove-floodborn.webp";
import sealedTroveInklands from "./assets/sealed/item-trove-inklands.webp";
import sealedTroveUrsula from "./assets/sealed/item-trove-ursula.webp";
import sealedTroveShimmering from "./assets/sealed/item-trove-shimmering.webp";
import sealedTroveAzurite from "./assets/sealed/item-trove-azurite.webp";
import sealedTroveArchazia from "./assets/sealed/item-trove-archazia.webp";
import sealedTroveJafar from "./assets/sealed/item-trove-jafar.webp";
import sealedTroveFabled from "./assets/sealed/item-trove-fabled.webp";
import sealedTroveWhispers from "./assets/sealed/item-trove-whispers.webp";
import sealedTroveWinterspell from "./assets/sealed/item-trove-winterspell.webp";
import sealedTroveWilds from "./assets/sealed/item-trove-wilds.webp";
import sealedTroveVine from "./assets/sealed/item-trove-vine.webp";
import sealedTroveHyperia from "./assets/sealed/item-trove-hyperia.webp";
import sealedGreatHunnyRescue from "./assets/sealed/item-great-hunny-rescue.webp";
import sealedDeepTrouble from "./assets/sealed/item-deep-trouble.webp";
import sealedPalaceHeist from "./assets/sealed/item-palace-heist.webp";
import sealedGiftFirstChapter from "./assets/sealed/item-gift-firstchapter.webp";
import sealedGiftInklands from "./assets/sealed/item-gift-inklands.webp";
import sealedGiftStitch from "./assets/sealed/item-gift-stitch.webp";
import sealedGiftArchazia from "./assets/sealed/item-gift-archazia.webp";
import sealedGiftFabled from "./assets/sealed/item-gift-fabled.webp";
import sealedGiftWinterspell from "./assets/sealed/item-gift-winterspell.webp";
import sealedGiftHyperia from "./assets/sealed/item-gift-hyperia.webp";
import sealedDeckTfcAmberAmethyst from "./assets/sealed/item-deck-tfc-amber-amethyst.webp";
import sealedDeckTfcEmeraldRuby from "./assets/sealed/item-deck-tfc-emerald-ruby.webp";
import sealedDeckTfcSapphireSteel from "./assets/sealed/item-deck-tfc-sapphire-steel.webp";
import sealedDeckFloodbornAmberSapphire from "./assets/sealed/item-deck-floodborn-amber-sapphire.webp";
import sealedDeckFloodbornAmethystSteel from "./assets/sealed/item-deck-floodborn-amethyst-steel.webp";
import sealedDeckInklandsAmberEmerald from "./assets/sealed/item-deck-inklands-amber-emerald.webp";
import sealedDeckInklandsRubySapphire from "./assets/sealed/item-deck-inklands-ruby-sapphire.webp";
import sealedDeckUrsulaAmberAmethyst from "./assets/sealed/item-deck-ursula-amber-amethyst.webp";
import sealedDeckUrsulaSapphireSteel from "./assets/sealed/item-deck-ursula-sapphire-steel.webp";
import sealedDeckShimmeringAmethystRuby from "./assets/sealed/item-deck-shimmering-amethyst-ruby.webp";
import sealedDeckShimmeringEmeraldSteel from "./assets/sealed/item-deck-shimmering-emerald-steel.webp";
import sealedDeckAzuriteAmberRuby from "./assets/sealed/item-deck-azurite-amber-ruby.webp";
import sealedDeckAzuriteEmeraldSapphire from "./assets/sealed/item-deck-azurite-emerald-sapphire.webp";
import sealedDeckArchaziaRubySapphire from "./assets/sealed/item-deck-archazia-ruby-sapphire.webp";
import sealedDeckArchaziaAmethystSteel from "./assets/sealed/item-deck-archazia-amethyst-steel.webp";
import sealedDeckJafarAmberAmethyst from "./assets/sealed/item-deck-jafar-amber-amethyst.webp";
import sealedDeckJafarRubySteel from "./assets/sealed/item-deck-jafar-ruby-steel.webp";
import sealedDeckFabledEmeraldRuby from "./assets/sealed/item-deck-fabled-emerald-ruby.webp";
import sealedDeckFabledAmberSapphire from "./assets/sealed/item-deck-fabled-amber-sapphire.webp";
import sealedDeckWhispersSapphireSteel from "./assets/sealed/item-deck-whispers-sapphire-steel.webp";
import sealedDeckWhispersAmberEmerald from "./assets/sealed/item-deck-whispers-amber-emerald.webp";
import sealedDeckWilds2Player from "./assets/sealed/item-deck-wilds-2player.webp";
import sealedDeckHyperia2Player from "./assets/sealed/item-deck-hyperia-2player.webp";
import sealedGateway from "./assets/sealed/item-gateway.webp";

/** Real Illumineer's Quest box art per quest group key: Q1 Deep
    Trouble, Q2 Palace Heist, Q3 The Great Hunny Rescue — official
    product artwork, cut out onto transparency like the set logos. */
const QUEST_ART: Record<string, string> = {
  "quest:Q1": questArtQ1,
  "quest:Q2": questArtQ2,
  "quest:Q3": questArtQ3,
};

/** Product photo per sealed item, keyed by the item's exact name in
    Anthony's Shiny export (the names getSealed returns). Each photo is
    the real sealed product for that set — booster box, prerelease box,
    or booster pack — stored locally as a full square scene with its
    holder baked in (see SEALED_IN_CASE): packs sit in a label-less
    clear graded slab, the two Hyperia City boxes in thick acrylic
    display cases. Nov 2, 2026 fixes: the English First Chapter pack's
    photo previously showed the JAPANESE pack by mistake — the two
    are distinct items with their own art; the Hyperia City Booster
    Box photo previously showed the tall Prerelease box — it is now
    the real wide 24-pack display box, sealed, in its case; and the
    Hyperia City pack art now comes from the official English pack
    render (an earlier scene used the French edition). */
const SEALED_PHOTOS: Record<string, string> = {
  "Disney Lorcana: Hyperia City Booster Box": sealedHyperiaBox,
  "Disney Lorcana: Hyperia City Prerelease Box": sealedHyperiaPrerelease,
  "Disney Lorcana: Hyperia City Booster Pack": sealedHyperiaPack,
  "Fabled Booster Pack": sealedFabledPack,
  "The First Chapter Booster Pack": sealedFirstChapterPack,
  "Disney Lorcana: Winterspell Booster Pack": sealedWinterspellPack,
  "Disney Lorcana: Wilds Unknown Booster Pack": sealedWildsPack,
  "Disney Lorcana: Attack of the Vine! Booster Pack": sealedVinePack,
  "Ursula's Return Booster Pack": sealedUrsulaPack,
  "Reign of Jafar Booster Pack": sealedJafarPack,
  "Disney Lorcana: Shimmering Skies Booster Pack": sealedShimmeringPack,
  "Rise of the Floodborn Booster Pack": sealedFloodbornPack,
  "Into the Inklands Booster Pack": sealedInklandsPack,
  "Azurite Sea Booster Pack": sealedAzuritePack,
  // The Japanese-edition pack: a real Takara Tomy pack photo (Mickey
  // art, matching its SNKRDUNK listing), a clean cut-out like the two
  // boxes, so it renders inside the CSS acrylic case — it is not in
  // SEALED_IN_CASE.
  "Disney Lorcana: The First Chapter Booster Pack (Japanese)":
    sealedJapaneseFirstChapterPack,
  // The Great Hunny Rescue Quest box: the box itself, cropped
  // tight out of the earlier full-scene render (Nov 3, 2026:
  // that scene baked a second acrylic case into the photo, and
  // its bright white rim read as a white border running across
  // the whole photo — Anthony had it deleted). The photo is
  // now ONLY the box, so the one acrylic case it sits in is
  // the app's CSS case, like the other Quest boxes — not in
  // SEALED_IN_CASE. It is a native catalog item (not from the
  // Shiny export): it sits on the shelf at Owned ×0 until the
  // user adds their own sealed copy with the steppers.
  "Illumineer's Quest: The Great Hunny Rescue": sealedGreatHunnyRescue,
  // The first two Quest boxes (Nov 3, 2026): official box photos
  // with the backdrop cut away (white for Deep Trouble, black
  // for Palace Heist), so they render as clean cut-outs inside
  // the CSS acrylic case like the Hunny Rescue box. Native
  // catalog items at Owned ×0 until the user adds a copy.
  "Illumineer's Quest: Deep Trouble": sealedDeepTrouble,
  "Illumineer's Quest: Palace Heist": sealedPalaceHeist,
  // Illumineer's Troves (Nov 3, 2026): the official box renders
  // (via CardsRealm's catalog images) with the white backdrop
  // cut away, so each Trove renders as a clean cut-out inside
  // the CSS acrylic case like the Quest boxes — none are in
  // SEALED_IN_CASE. The Archazia's Island and Fabled renders
  // came from their case SKUs; the black "x4" case badge was
  // cropped out, leaving the single Trove box.
  "Disney Lorcana: The First Chapter Illumineer's Trove":
    sealedTroveFirstChapter,
  "Disney Lorcana: Rise of the Floodborn Illumineer's Trove":
    sealedTroveFloodborn,
  "Disney Lorcana: Into the Inklands Illumineer's Trove":
    sealedTroveInklands,
  "Disney Lorcana: Ursula's Return Illumineer's Trove": sealedTroveUrsula,
  "Disney Lorcana: Shimmering Skies Illumineer's Trove":
    sealedTroveShimmering,
  "Disney Lorcana: Azurite Sea Illumineer's Trove": sealedTroveAzurite,
  "Disney Lorcana: Archazia's Island Illumineer's Trove":
    sealedTroveArchazia,
  "Disney Lorcana: Reign of Jafar Illumineer's Trove": sealedTroveJafar,
  "Disney Lorcana: Fabled Illumineer's Trove": sealedTroveFabled,
  "Disney Lorcana: Whispers in the Well Illumineer's Trove":
    sealedTroveWhispers,
  "Disney Lorcana: Winterspell Illumineer's Trove": sealedTroveWinterspell,
  "Disney Lorcana: Wilds Unknown Illumineer's Trove": sealedTroveWilds,
  "Disney Lorcana: Attack of the Vine! Illumineer's Trove": sealedTroveVine,
  "Disney Lorcana: Hyperia City Illumineer's Trove": sealedTroveHyperia,
  // Gift Sets, Starter Decks, and Gateway (Nov 3, 2026): the
  // official TCGplayer product photos with the white backdrop
  // cut away, so each renders as a clean cut-out inside the CSS
  // acrylic case like the Troves — none are in SEALED_IN_CASE.
  // Native catalog items at Owned ×0 until the user adds a copy.
  "Disney Lorcana: The First Chapter Gift Set": sealedGiftFirstChapter,
  "Disney Lorcana: Into the Inklands Gift Set": sealedGiftInklands,
  "Disney Lorcana: Stitch Collector's Gift Set": sealedGiftStitch,
  "Disney Lorcana: Archazia's Island Gift Box": sealedGiftArchazia,
  "Disney Lorcana: Fabled Gift Set": sealedGiftFabled,
  "Disney Lorcana: Winterspell Gift Box - Scrooge McDuck":
    sealedGiftWinterspell,
  "Disney Lorcana: Hyperia City Gift Box - Beast": sealedGiftHyperia,
  "Disney Lorcana: The First Chapter Starter Deck (Amber & Amethyst)":
    sealedDeckTfcAmberAmethyst,
  "Disney Lorcana: The First Chapter Starter Deck (Emerald & Ruby)":
    sealedDeckTfcEmeraldRuby,
  "Disney Lorcana: The First Chapter Starter Deck (Sapphire & Steel)":
    sealedDeckTfcSapphireSteel,
  "Disney Lorcana: Rise of the Floodborn Starter Deck (Amber & Sapphire)":
    sealedDeckFloodbornAmberSapphire,
  "Disney Lorcana: Rise of the Floodborn Starter Deck (Amethyst & Steel)":
    sealedDeckFloodbornAmethystSteel,
  "Disney Lorcana: Into the Inklands Starter Deck (Amber & Emerald)":
    sealedDeckInklandsAmberEmerald,
  "Disney Lorcana: Into the Inklands Starter Deck (Ruby & Sapphire)":
    sealedDeckInklandsRubySapphire,
  "Disney Lorcana: Ursula's Return Starter Deck (Amber & Amethyst)":
    sealedDeckUrsulaAmberAmethyst,
  "Disney Lorcana: Ursula's Return Starter Deck (Sapphire & Steel)":
    sealedDeckUrsulaSapphireSteel,
  "Disney Lorcana: Shimmering Skies Starter Deck (Amethyst & Ruby)":
    sealedDeckShimmeringAmethystRuby,
  "Disney Lorcana: Shimmering Skies Starter Deck (Emerald & Steel)":
    sealedDeckShimmeringEmeraldSteel,
  "Disney Lorcana: Azurite Sea Starter Deck (Amber & Ruby)":
    sealedDeckAzuriteAmberRuby,
  "Disney Lorcana: Azurite Sea Starter Deck (Emerald & Sapphire)":
    sealedDeckAzuriteEmeraldSapphire,
  "Disney Lorcana: Archazia's Island Starter Deck (Ruby & Sapphire)":
    sealedDeckArchaziaRubySapphire,
  "Disney Lorcana: Archazia's Island Starter Deck (Amethyst & Steel)":
    sealedDeckArchaziaAmethystSteel,
  "Disney Lorcana: Reign of Jafar Starter Deck (Amber & Amethyst)":
    sealedDeckJafarAmberAmethyst,
  "Disney Lorcana: Reign of Jafar Starter Deck (Ruby & Steel)":
    sealedDeckJafarRubySteel,
  "Disney Lorcana: Fabled Starter Deck (Emerald & Ruby)":
    sealedDeckFabledEmeraldRuby,
  "Disney Lorcana: Fabled Starter Deck (Amber & Sapphire)":
    sealedDeckFabledAmberSapphire,
  "Disney Lorcana: Whispers in the Well Starter Deck (Sapphire & Steel)":
    sealedDeckWhispersSapphireSteel,
  "Disney Lorcana: Whispers in the Well Starter Deck (Amber & Emerald)":
    sealedDeckWhispersAmberEmerald,
  "Disney Lorcana: Wilds Unknown 2-Player Starter Set":
    sealedDeckWilds2Player,
  "Disney Lorcana: Hyperia City 2-Player Starter Set":
    sealedDeckHyperia2Player,
  "Disney Lorcana: Gateway": sealedGateway,
};

/** Items whose photos are full scenes with the holder baked into
    the image itself, so views render them as a plain square picture
    instead of layering the CSS acrylic case and stand on top.
    Anthony's direction (Nov 2, 2026, later that evening): the packs
    should look PSA-graded WITHOUT the PSA — every pack now sits in
    a rigid, crystal-clear slab that hugs the pack's shape (beveled
    edges, a sealed seam, glassy reflections) with NO label or grade
    strip. Eleven packs were re-rendered that way from their real
    pack art, the two First Chapter packs (English and Japanese)
    first; the Winterspell and Into the Inklands packs still carry
    the previous framed-case scene for now. The two Hyperia City
    boxes keep their thick acrylic display cases, and the Booster
    Box photo is the real wide 24-pack display box, sealed — an
    earlier render wrongly showed the Prerelease box. */
const SEALED_IN_CASE: ReadonlySet<string> = new Set([
  "Disney Lorcana: Hyperia City Booster Box",
  "Disney Lorcana: Hyperia City Prerelease Box",
  "Disney Lorcana: Hyperia City Booster Pack",
  "Fabled Booster Pack",
  "The First Chapter Booster Pack",
  "Disney Lorcana: The First Chapter Booster Pack (Japanese)",
  "Disney Lorcana: Winterspell Booster Pack",
  "Disney Lorcana: Wilds Unknown Booster Pack",
  "Disney Lorcana: Attack of the Vine! Booster Pack",
  "Ursula's Return Booster Pack",
  "Reign of Jafar Booster Pack",
  "Disney Lorcana: Shimmering Skies Booster Pack",
  "Rise of the Floodborn Booster Pack",
  "Into the Inklands Booster Pack",
  "Azurite Sea Booster Pack",
]);

/** Real set logo artwork per main set number: sets 4-14 cropped from
    Anthony's Shiny set-screen photo, sets 1-3 from official logo files. */
const SET_LOGOS: Record<number, string> = {
  1: setLogo1,
  2: setLogo2,
  3: setLogo3,
  4: setLogo4,
  5: setLogo5,
  6: setLogo6,
  7: setLogo7,
  8: setLogo8,
  9: setLogo9,
  10: setLogo10,
  11: setLogo11,
  12: setLogo12,
  13: setLogo13,
  14: setLogo14,
};

/** Marketplace release hold (Anthony, Nov 2, 2026, late): the
    Marketplace needs more time to think through, so it is NOT
    open to users yet. Its entry points stay exactly where they
    are — the Home doorway card and the Marketplace tab in
    Social — and the buy/sell area stays visible in Social, but
    the whole area is gated off under a diagonal yellow
    "Coming soon" overlay and none of its controls work. The
    seeded Elsa / Stitch listing artwork no longer shows in the
    area at all. Everything underneath (listings, deals,
    feedback, the server actions) is kept untouched, so
    flipping this one flag reopens it exactly as it was when
    Anthony says go. */
const MARKETPLACE_AVAILABLE = false;

type Binder = ApiResponse<typeof api, "getBinder">;
type Group = Binder["groups"][number];
type SectionData = ApiResponse<typeof api, "getSection">;
type CardLite = SectionData["cards"][number];
type CardDetail = ApiResponse<typeof api, "getCard">;
type SearchResult = ApiResponse<typeof api, "searchCards">["results"][number];
type Finance = ApiResponse<typeof api, "getFinance">;

function fmtUSD(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Yen display for Japanese-edition items: whole yen, no decimals.
    Japanese-edition prices always show in BOTH currencies — the yen
    figure from the Japanese source first, the USD conversion beside
    it (the item data carries both; the conversion note lives in the
    item detail). */
function fmtJPY(n: number): string {
  return `¥${Math.round(n).toLocaleString("en-US")}`;
}

const FINISH_OPTIONS = [
  "Regular",
  "Cold Foil",
  "Epic Foil",
  "Enchanted",
  "Enchanted Foil",
  "Promo",
  "Promo Foil",
  "Promo Cold Foil",
  "Foil",
];

function finishTotal(finishes: Record<string, number>): number {
  return Object.values(finishes).reduce((sum, n) => sum + n, 0);
}

function hasFoil(finishes: Record<string, number>): boolean {
  return Object.entries(finishes).some(
    ([finish, qty]) => qty > 0 && finish !== "Regular" && finish !== "Promo",
  );
}

/** One binder pocket: real card art, full color when owned, ghosted when missing. */
function Pocket({
  card,
  onOpen,
}: {
  card: CardLite;
  onOpen: (id: number) => void;
}) {
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (nearViewport) return;
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nearViewport]);

  const { url, settled: artSettled } = useCachedArt(card.id, "grid", nearViewport);
  const owned = card.ownedQty > 0;
  const isFoilPocket = card.pocket === "foil" || hasFoil(card.finishes);
  return (
    <button
      ref={rootRef}
      id={
        card.pocket === "foil" ? `pocket-${card.id}-foil` : `pocket-${card.id}`
      }
      type="button"
      onClick={() => onOpen(card.id)}
      aria-label={`${card.fullName}, number ${card.printed}, ${card.pocketLabel} pocket${
        isFoilPocket ? ", foil" : ""
      }, ${owned ? `owned, ${card.ownedQty} copies` : "missing"}`}
      className="group block w-full scroll-mt-28 text-left focus:outline-none"
    >
      <div className="pocket-sheen relative aspect-[63/88] overflow-hidden rounded-[8px] border border-[var(--pocket-edge)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_6px_rgba(0,0,0,0.45)]">
        {url ? (
          <img
            src={url}
            alt={owned ? card.fullName : `${card.fullName} (missing)`}
            loading="lazy"
            className={`h-full w-full object-cover ${
              owned ? (isFoilPocket ? "foil-img" : "") : "ghost-img"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1.5">
            <span
              className={`text-center text-[10px] leading-tight ${
                owned ? "text-[var(--text)]" : "text-[var(--ghost)]"
              }`}
            >
              {nearViewport && !url && !artSettled ? "Loading art…" : card.fullName}
            </span>
          </div>
        )}
        {owned && isFoilPocket ? (
          <>
            <span aria-hidden="true" className="foil-overlay" />
            {nearViewport ? (
              <span
                aria-hidden="true"
                className="foil-shine-band foil-shine-band-grid"
                style={{
                  animationDelay: `${-((card.id % 7) * 0.3).toFixed(1)}s`,
                }}
              />
            ) : null}
          </>
        ) : null}
        {owned ? (
          <span className="absolute right-1 top-1 rounded-full bg-[var(--gold)] px-1.5 py-px text-[10px] font-bold text-black shadow">
            ×{card.ownedQty}
          </span>
        ) : (
          <span className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--ghost)]">
            Missing
          </span>
        )}
        <span
          className={`absolute bottom-1 left-1 rounded-full px-1.5 py-px text-[9px] font-semibold ${
            card.pocket === "foil" || hasFoil(card.finishes)
              ? "bg-black/55 text-[var(--gold-soft)]"
              : "bg-black/55 text-[var(--text)]"
          }`}
        >
          {card.pocketLabel}
        </span>
      </div>
      <div className="px-0.5 pt-1">
        <p
          className={`truncate text-[10px] leading-tight ${
            owned ? "text-[var(--text)]" : "text-[var(--ghost)]"
          }`}
        >
          {card.fullName}
        </p>
        <p className="text-[9px] leading-tight text-[var(--dim)]">
          #{card.printed}
          {card.rarity ? ` · ${card.rarity}` : ""}
        </p>
      </div>
    </button>
  );
}

/** The honed-in card on its turntable (Anthony's Courtyard-style
    reference photo): the card hovers above a soft oval pedestal and
    slowly turns side to side, clean over the dark backdrop, with the
    foil treatment riding on top when the copy is a foil. It's the
    existing full-res art on CSS 3D transforms only — no video and no
    extra downloads, so it adds nothing to the on-device art cache.
    Dragging (or the arrow keys) turns it by hand; releasing hands it
    back to the slow sway. Missing cards hover too, ghosted as usual. */
function HoverCard({
  url,
  alt,
  foil,
  ghost,
}: {
  url: string;
  alt: string;
  foil: boolean;
  ghost: boolean;
}) {
  return (
    <Turntable
      label={`${alt}, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
      floatClassName="w-72 max-w-full sm:w-80"
    >
      <div className="relative overflow-hidden rounded-[10px] shadow-[0_28px_55px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
        <img
          src={url}
          alt={alt}
          draggable={false}
          className={`block w-full select-none ${
            ghost ? "ghost-img" : foil ? "foil-img" : ""
          }`}
        />
        {foil && !ghost ? (
          <>
            <span aria-hidden="true" className="foil-overlay" />
            <span aria-hidden="true" className="foil-shine-band" />
          </>
        ) : null}
        <span aria-hidden="true" className="card-glare" />
      </div>
    </Turntable>
  );
}

/** Card detail sheet: big art, stats, rules text, and the ownership editor. */
function CardSheet({
  cardId,
  onClose,
}: {
  cardId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => api.getCard({ cardId }),
  });
  // Full-resolution art, cached on-device from this view onward.
  const { url, settled: artSettled } = useCachedArt(cardId, "full", true);
  const [finishes, setFinishes] = useState<Record<string, number> | null>(
    null,
  );
  const [sheetTab, setSheetTab] = useState<"card" | "finances">("card");
  const loadedFor = useRef<number | null>(null);
  useEffect(() => {
    if (detail.data && loadedFor.current !== detail.data.id) {
      loadedFor.current = detail.data.id;
      setFinishes({ ...detail.data.finishes });
      setSheetTab("card");
    }
  }, [detail.data]);

  const save = useMutation({
    mutationFn: (next: Record<string, number>) =>
      api.updateOwnership({ cardId, finishes: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["binder"] });
      void queryClient.invalidateQueries({ queryKey: ["section"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      onClose();
    },
  });

  // Count saving mode (Anthony, Nov 2, 2026 — Settings toggle,
  // both modes): manual (default) stages counts until "Save
  // collection count"; auto-save commits every +/− tap at once,
  // with no button and no closing of the sheet.
  const manualSave = useManualSaveCount();
  const autoSave = useMutation({
    mutationFn: (next: Record<string, number>) =>
      api.updateOwnership({ cardId, finishes: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["binder"] });
      void queryClient.invalidateQueries({ queryKey: ["section"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    },
  });
  const changeFinish = (
    base: Record<string, number>,
    finish: string,
    delta: number,
  ) => {
    const next = {
      ...base,
      [finish]: Math.max(0, (base[finish] ?? 0) + delta),
    };
    setFinishes(next);
    if (!manualSave) autoSave.mutate(next);
  };

  // Long-press count picker (Anthony, Nov 3, 2026): hold a
  // finish's + stepper and a scrollable counter opens; picking
  // a number sets that finish's count and SAVES AUTOMATICALLY
  // (even in manual-save mode — the pick is the save), so bulk
  // counts never need tap after tap.
  const [countPickerFinish, setCountPickerFinish] = useState<
    string | null
  >(null);
  const setFinishQty = (
    base: Record<string, number>,
    finish: string,
    qty: number,
  ) => {
    const next = { ...base, [finish]: Math.max(0, qty) };
    setFinishes(next);
    autoSave.mutate(next);
  };

  const card: CardDetail | undefined = detail.data;
  const current = finishes ?? card?.finishes ?? {};
  const total = finishTotal(current);
  const dirty =
    card != null &&
    finishes != null &&
    JSON.stringify(finishes) !== JSON.stringify(card.finishes);
  // Puzzle/lore inserts have no foil printing — their detail
  // offers just the one count stepper (Anthony, Nov 3, 2026).
  const isPuzzleCard = card?.groupLabel === "Puzzle";
  const shownFinishes = FINISH_OPTIONS.filter(
    (f) =>
      (current[f] ?? 0) > 0 ||
      f === "Regular" ||
      (!isPuzzleCard && f === "Cold Foil"),
  );

  // Title-block price: the card's current market value per copy and its
  // move since the previous tracked point, from its real price history.
  const hist = card?.priceHistory ?? [];
  const lastHist = hist[hist.length - 1];
  const prevHist = hist[hist.length - 2];
  const titlePrice = card?.marketValue ?? lastHist?.value ?? null;
  const priceChange =
    lastHist && prevHist ? lastHist.value - prevHist.value : null;
  const priceChangePct =
    priceChange != null && prevHist && prevHist.value > 0
      ? (priceChange / prevHist.value) * 100
      : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={card ? `Details for ${card.fullName}` : "Card details"}
      onClick={onClose}
    >
      {/* Blurred, darkened blow-up of the card's own artwork as the
          backdrop, like the Shiny card detail screen */}
      {url ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <img
            src={url}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-45 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#05070d]/40 to-[#05070d]" />
        </div>
      ) : null}
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        {detail.isPending || !card ? (
          <>
            <div className="flex items-start">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to binder"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
              >
                ←
              </button>
            </div>
            <p className="py-10 text-center text-sm text-[var(--dim)]">
              Loading card…
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to binder"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
              >
                ←
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close card details"
                className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
              >
                Close
              </button>
            </div>

            <div className="mt-2">
              {url ? (
                <HoverCard
                  url={url}
                  alt={card.fullName}
                  foil={card.ownedQty > 0 && hasFoil(card.finishes)}
                  ghost={card.ownedQty === 0}
                />
              ) : (
                <div className="mx-auto flex aspect-[63/88] w-72 max-w-full items-center justify-center rounded-xl border border-white/15 bg-black/40 text-sm text-[var(--dim)]">
                  {artSettled ? "Art unavailable" : "Loading art…"}
                </div>
              )}
            </div>

            {/* Professional title block: name + collector number and the
                market price on one line, set name in blue + rarity under */}
            <div className="mt-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-album text-[22px] font-bold leading-tight text-white">
                  {card.fullName} {card.printed}
                </h2>
                <p className="mt-1 text-[15px]">
                  <span className="font-medium text-[var(--accent)]">
                    {card.groupName}
                  </span>
                  {card.rarity ? (
                    <span className="text-white"> • {card.rarity}</span>
                  ) : null}
                </p>
              </div>
              {titlePrice != null ? (
                <div className="shrink-0 text-right">
                  <p className="text-[22px] font-bold leading-tight text-white">
                    {fmtUSD(titlePrice)}
                  </p>
                  {priceChange != null ? (
                    <p
                      className={`mt-0.5 text-[13px] font-medium ${
                        priceChange >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {priceChange >= 0 ? "↑" : "↓"}{" "}
                      {priceChange < 0 ? "−" : "+"}
                      {fmtUSD(Math.abs(priceChange))}
                      {priceChangePct != null
                        ? ` (${priceChangePct < 0 ? "−" : "+"}${Math.abs(priceChangePct).toFixed(2)}%)`
                        : ""}
                      <span className="block text-[11px] font-normal text-[var(--dim)]">
                        since {prevHist?.label}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Best Offer: quick hyperlink straight to this exact
                printing on TCGplayer (Anthony's addition). */}
            {card.tcgplayerId ? (
              <a
                href={`https://www.tcgplayer.com/product/${card.tcgplayerId}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
              >
                <TcgplayerLogoMark />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text)]">
                    Best Offer — TCGplayer
                  </span>
                  <span className="block text-xs text-[var(--dim)]">
                    {titlePrice != null
                      ? `Tracked market ${fmtUSD(titlePrice)} — `
                      : ""}
                    see live offers and buy this exact printing
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-[var(--gold-soft)]">
                  View ↗
                </span>
              </a>
            ) : (
              <BestOfferFallback name={card.fullName} />
            )}

            <div
              className="mt-4 flex rounded-full border border-[var(--border)] bg-[var(--bg)] p-1"
              role="group"
              aria-label="Card detail view"
            >
              {(
                [
                  ["card", "Card"],
                  ["finances", "Card Performance"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sheetTab === value}
                  onClick={() => setSheetTab(value)}
                  className={`flex-1 rounded-full px-3.5 py-1.5 text-sm ${
                    sheetTab === value
                      ? "bg-[var(--gold)] font-bold text-black"
                      : "text-[var(--text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {sheetTab === "card" ? (
              <>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Ink / Cost
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">
                  {card.ink ?? "—"} · {card.cost ?? "—"}
                  {card.inkwell ? " · Inkable" : ""}
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Type
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">
                  {card.cardType ?? "—"}
                  {card.subtypes ? (
                    <span className="block text-xs text-[var(--dim)]">
                      {card.subtypes}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  S / W / Lore
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">
                  {card.strength ?? "—"} / {card.willpower ?? "—"} /{" "}
                  {card.lore ?? "—"}
                </dd>
              </div>
            </dl>

            {card.cardText ? (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-[var(--bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)]">
                {card.cardText}
              </p>
            ) : null}

            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-album text-base text-[var(--text)]">
                  In your collection
                </h3>
                <span
                  className={`text-sm font-semibold ${
                    total > 0
                      ? "text-[var(--gold-soft)]"
                      : "text-red-400"
                  }`}
                >
                  {total > 0
                    ? `${total} cop${total === 1 ? "y" : "ies"}`
                    : "Don’t own"}
                </span>
              </div>
              {card.marketValue != null ? (
                <p className="mt-1 text-xs text-[var(--dim)]">
                  Average market value {fmtUSD(card.marketValue)} per copy —
                  per-finish value and what you paid are under Card Performance.
                </p>
              ) : null}
              {/* Merged bar (Anthony's placement change, Nov 2,
                  2026): Where it lives is no longer a standalone
                  section at the bottom — it is the LEFT half of
                  this bar, a dropdown; the RIGHT half is Copies
                  owned (the total), and the per-finish steppers
                  that set that total ride directly underneath
                  inside the same cell. */}
              <div className="mt-3">
                <OwnedLocationBar
                  targetKind="card"
                  cardId={card.id}
                  sealedName={null}
                  comicId={null}
                  ownedQty={total}
                  copiesQty={total}
                  copiesItemName={card.fullName}
                  barClassName="bg-[var(--surface)]"
                >
              {/* The count dial renders ABOVE the finish rows
                  (Anthony, Nov 3, 2026, ~2:59 AM): below them
                  it opened under his thumb and got covered. */}
              {countPickerFinish ? (
                <div className="mb-3 rounded-lg bg-[var(--bg)] p-2.5">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
                    {countPickerFinish} — how many copies?
                  </p>
                  <SidewaysCountDial
                    overlay
                    label={`Pick how many ${countPickerFinish} copies of ${card.fullName} you own`}
                    current={current[countPickerFinish] ?? 0}
                    onPick={(n) => {
                      setFinishQty(current, countPickerFinish, n);
                      setCountPickerFinish(null);
                    }}
                    onClose={() => setCountPickerFinish(null)}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                {shownFinishes.map((finish) => {
                  const qty = current[finish] ?? 0;
                  return (
                    <div
                      key={finish}
                      className="flex items-center justify-between rounded-lg bg-[var(--bg)] px-3 py-1.5"
                    >
                      <span className="flex h-8 items-center text-sm leading-none text-[var(--text)]">
                        {finish}
                      </span>
                      <span className="flex items-center gap-2">
                        <StepperButton
                          label={`Remove one ${finish} copy of ${card.fullName}`}
                          disabled={qty <= 0}
                          onClick={() => changeFinish(current, finish, -1)}
                          glyph="−"
                          circleClass="h-8 w-8 text-base"
                        />
                        <span className="w-6 text-center text-sm font-semibold leading-none tabular-nums text-[var(--text)]">
                          {qty}
                        </span>
                        <StepperButton
                          label={`Add one ${finish} copy of ${card.fullName} — hold to pick a count`}
                          onClick={() => changeFinish(current, finish, 1)}
                          onLongPress={() =>
                            setCountPickerFinish(
                              countPickerFinish === finish ? null : finish,
                            )
                          }
                          glyph="+"
                          circleClass="h-8 w-8 text-base"
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--dim)]">
                Tip: hold the + button on a finish and a sideways
                dial opens above it — tap a number and that
                becomes the count.
              </p>
              {manualSave ? (
                <>
                  <button
                    type="button"
                    disabled={!dirty || save.isPending}
                    onClick={() => finishes && save.mutate(finishes)}
                    className="mt-3 w-full rounded-lg bg-[var(--gold)] py-2.5 text-sm font-bold text-black disabled:opacity-40"
                  >
                    {save.isPending ? "Saving…" : "Save collection count"}
                  </button>
                  {save.isError ? (
                    <p className="mt-2 text-center text-sm text-red-400">
                      Couldn't save — try again.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="mt-3 text-center text-xs leading-relaxed text-[var(--dim)]">
                    {autoSave.isPending
                      ? "Saving…"
                      : "Auto-save is on — every tap saves right away."}
                  </p>
                  {autoSave.isError ? (
                    <p className="mt-2 text-center text-sm text-red-400">
                      Couldn't save — try again.
                    </p>
                  ) : null}
                </>
              )}
                </OwnedLocationBar>
              </div>
            </div>
            {/* The value-over-time chart also lives right here on
                the main Card tab (Anthony's every-item charting
                rule, re-reported Nov 2, 2026 on Fru Fru - VIP Guest
                #1, Hyperia City): opening a card shows its graph
                without needing the Card Performance tab. */}
            <CardValueChart history={card.priceHistory} />
              </>
            ) : (
              <CardFinanceTab card={card} />
            )}
          </>
        )}
      </div>
    </div>
  );
}


/** TCGplayer's actual logo (their own CDN art, cropped and stored
    as an app asset) — Anthony asked for the real logo inside the
    Best Offer element on every item detail (Nov 2, 2026). It sits
    on its native black plate at a fixed height so rows never shift
    layout. */
function TcgplayerLogoMark() {
  return (
    <img
      src={tcgplayerLogo}
      alt="TCGplayer"
      className="h-10 w-auto shrink-0 rounded-md"
    />
  );
}

/** Best Offer element for an item's Performance section: a quick
    hyperlink straight to that exact item on TCGplayer, to buy it or
    sell it. Anthony's placement (Nov 2, 2026): in EVERY card and
    sealed item detail, it sits between the Value total / Paid total /
    Gain-loss block and the value-over-time chart. (Card detail also
    keeps the earlier Best Offer link under the title block.) */
function BestOfferLink({
  tcgplayerId,
  price,
  noun,
}: {
  tcgplayerId: string;
  price: number | null;
  noun: string;
}) {
  return (
    <a
      href={`https://www.tcgplayer.com/product/${tcgplayerId}`}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
    >
      <TcgplayerLogoMark />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--text)]">
          Best Offer — TCGplayer
        </span>
        <span className="block text-xs text-[var(--dim)]">
          {price != null ? `Tracked market ${fmtUSD(price)} ${noun} — ` : ""}
          see live offers to buy or sell this item
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[var(--gold-soft)]">
        View ↗
      </span>
    </a>
  );
}

/** Best Offer for an item with no TCGplayer product ID in any source
    (a printing Anthony has never owned in a Shiny export — some
    promos, quest cards, and Hyperia Enchanteds/Iconics): the element
    still shows on the detail, like Anthony's every-item rule demands,
    and links to TCGplayer itself with the card's name to search by,
    rather than guessing a product page URL that may not exist. */
function BestOfferFallback({ name }: { name: string }) {
  return (
    <a
      href="https://www.tcgplayer.com"
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
    >
      <TcgplayerLogoMark />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--text)]">
          Best Offer — TCGplayer
        </span>
        <span className="block text-xs text-[var(--dim)]">
          Not yet matched to a TCGplayer product page — search
          TCGplayer for “{name}” to see live offers to buy or sell.
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[var(--gold-soft)]">
        View ↗
      </span>
    </a>
  );
}

/** Best Offer for an item priced from a non-TCGplayer market (the
    Japanese-edition sealed items, priced from SNKRDUNK): the same
    element in the same place, linking to the source's own product
    page, with the yen price shown beside the USD conversion. */
function BestOfferMarketLink({
  url,
  sourceLabel,
  jpyPrice,
  price,
}: {
  url: string;
  sourceLabel: string;
  jpyPrice: number | null;
  price: number | null;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
    >
      <span>
        <span className="block text-sm font-semibold text-[var(--text)]">
          Best Offer — {sourceLabel}
        </span>
        <span className="block text-xs text-[var(--dim)]">
          {jpyPrice != null && price != null
            ? `Market ${fmtJPY(jpyPrice)} · ${fmtUSD(price)} per unit — `
            : ""}
          see live offers to buy or sell this item
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[var(--gold-soft)]">
        View ↗
      </span>
    </a>
  );
}

/** One card's value-over-time chart section. Rendered on BOTH card
    sheet tabs — the main Card tab (so the chart is visible the
    moment a card opens, no tab switch needed; Anthony re-reported
    Nov 2, 2026 that Fru Fru - VIP Guest #1 in Hyperia City showed
    no graph) and the Card Performance tab under Best Offer. With
    no tracked points it shows an honest empty state rather than
    vanishing (Anthony's every-item charting rule). */
function CardValueChart({
  history,
}: {
  history: CardDetail["priceHistory"];
}) {
  if (history.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-sm font-semibold text-[var(--text)]">
          Value per copy over time
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
          No tracked prices yet for this card — its value-over-time
          chart starts with the next daily re-pricing.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-sm font-semibold text-[var(--text)]">
        Value per copy over time
      </p>
      <div
        role="img"
        aria-label={`Line chart of this card's value per copy from ${history[0]?.label} to ${history[history.length - 1]?.label}. Latest value ${fmtUSD(history[history.length - 1]?.value ?? 0)} per copy.`}
      >
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart
            data={history}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="cardValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7aa5ff" stopOpacity={0.38} />
                <stop offset="100%" stopColor="#7aa5ff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8b9bb8", fontSize: 10 }}
              axisLine={{ stroke: "#24365e" }}
              tickLine={false}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={40}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#8b9bb8", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v}`}
              axisLine={false}
              tickLine={false}
              width={48}
              label={{
                value: "USD per copy",
                angle: -90,
                position: "insideLeft",
                fill: "#8b9bb8",
                fontSize: 11,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0e1526",
                border: "1px solid #24365e",
                borderRadius: 8,
                color: "#eef2ff",
                fontSize: 13,
              }}
              formatter={(v: number) => [fmtUSD(v), "Value per copy"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Value per copy"
              stroke="var(--accent)"
              strokeWidth={2.5}
              fill="url(#cardValueFill)"
              dot={{ r: 3, fill: "#7aa5ff", strokeWidth: 0 }}
              activeDot={{ r: 4.5, fill: "#7aa5ff", strokeWidth: 0 }}
              style={{
                filter: "drop-shadow(0 0 6px rgba(122,165,255,0.45))",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-[var(--dim)]">
        Tracked from your first Shiny export, Oct 25, 2026; a new point
        is added by each export and each daily re-pricing.
      </p>
    </div>
  );
}

/** Per-card financial tab inside the card sheet: value vs paid by finish.
    (The per-item Paid vs Value bar chart was removed at Anthony's
    request, Nov 2, 2026 — the totals and the value-over-time chart
    stay.) */
function CardFinanceTab({ card }: { card: CardDetail }) {
  const fin = card.finance;
  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-album text-base text-[var(--text)]">
          This card&rsquo;s performance
        </h3>
        {fin.byFinish.length > 0 ? (
          <span
            className={`text-sm font-semibold ${
              fin.net >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {fin.net < 0 ? "−" : "+"}
            {fmtUSD(Math.abs(fin.net))}
          </span>
        ) : null}
      </div>
      {fin.byFinish.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dim)]">
          You don&rsquo;t own this card, so there&rsquo;s no value or paid
          amount recorded for it yet. Once it&rsquo;s in your collection, its
          per-finish value, what you paid, and the gain or loss will show
          here.
        </p>
      ) : (
        <>
          <div className="mt-2 space-y-1.5">
            {fin.byFinish.map((row) => (
              <div
                key={row.finish}
                className="rounded-lg bg-[var(--bg)] px-3 py-2 text-sm"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[var(--text)]">
                    {row.finish} × {row.qty}
                  </span>
                  <span className="font-semibold text-[var(--gold-soft)]">
                    {fmtUSD(row.valueTotal)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--dim)]">
                  Value {fmtUSD(row.valuePerUnit ?? 0)} each · Paid{" "}
                  {fmtUSD(row.paidTotal)} total (
                  {fmtUSD(row.paidPerUnit ?? 0)} each)
                </p>
              </div>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                Value total
              </dt>
              <dd className="mt-0.5 font-semibold text-[var(--text)]">
                {fmtUSD(fin.valueTotal)}
              </dd>
            </div>
            <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                Paid total
              </dt>
              <dd className="mt-0.5 font-semibold text-[var(--text)]">
                {fmtUSD(fin.paidTotal)}
              </dd>
            </div>
            <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                Gain / loss
              </dt>
              <dd
                className={`mt-0.5 font-semibold ${
                  fin.net >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {fin.net < 0 ? "−" : "+"}
                {fmtUSD(Math.abs(fin.net))}
              </dd>
            </div>
          </dl>
        </>
      )}
      {/* Best Offer in Performance: between the Value total / Paid
          total / Gain-loss block and the value-over-time chart —
          Anthony's placement for every card and item detail. */}
      {card.tcgplayerId ? (
        <BestOfferLink
          tcgplayerId={card.tcgplayerId}
          price={card.marketValue}
          noun="per copy"
        />
      ) : (
        <BestOfferFallback name={card.fullName} />
      )}
      <CardValueChart history={card.priceHistory} />
      <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
        Prices as of {fin.asOfLabel}. Paid amounts come from your Shiny
        records and stay as recorded; market values are re-priced daily.
      </p>
      <PriceAlertBox
        targetKind="card"
        cardId={card.id}
        sealedName={null}
        currentValue={card.marketValue}
      />
      {/* No standalone "Where it lives" section here anymore
          (Anthony's placement change, Nov 2, 2026): it is merged
          into the Copies owned bar on the Card tab — see
          OwnedLocationBar in the "In your collection" block. */}
    </div>
  );
}

const CHART_TICK = { fill: "#8b9bb8", fontSize: 11 } as const;

function ValueBarChart({
  data,
  nameKey,
  label,
}: {
  data: { name: string; value: number }[];
  nameKey: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ height: Math.max(220, data.length * 30) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, "dataMax"]}
            tick={CHART_TICK}
            tickFormatter={(v: number) => `$${v.toLocaleString("en-US")}`}
            axisLine={{ stroke: "#24365e" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey={nameKey}
            width={86}
            tick={CHART_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(110,155,255,0.10)" }}
            contentStyle={{
              backgroundColor: "#0e1526",
              border: "1px solid #24365e",
              borderRadius: 8,
              color: "#eef2ff",
              fontSize: 13,
            }}
          />
          <Bar dataKey="value" name="Market value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small thumbnail for a most-valuable row: the card's real art for binder
    cards; for sealed products, the item's own product photo from the
    Sealed shelf (Anthony asked for the picture, not a "Sealed" label). */
function TopItemThumb({ item }: { item: Finance["topItems"][number] }) {
  const { url } = useCachedArt(item.id, "grid", item.id != null);
  if (item.id == null) {
    const photo = SEALED_PHOTOS[item.name];
    return photo ? (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)]">
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain p-0.5"
        />
      </span>
    ) : (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[var(--dim)]">
        Sealed
      </span>
    );
  }
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="h-14 w-10 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span className="block h-14 w-10 shrink-0 rounded-md bg-[var(--bg)]" />
  );
}

/** Card Performance section (the Portfolio tab): what the collection is
    worth, what he paid, and how both move over time. The headline
    collection value is the GRAND total across everything cataloged —
    the same rule as Home (Anthony's direction, Nov 2, 2026): the
    Lorcana finance total (binder cards plus sealed products, tokens,
    and puzzle pieces) PLUS his graded comics at their recorded values.
    Paid / gain / loss stay Lorcana scope — no purchase amounts are
    recorded for the comics — and the value-over-time chart keeps
    tracking the Lorcana export history, since the comics have only
    one recorded valuation. */
function FinancePanel({
  finance,
  onOpenCard,
  onOpenSealed,
}: {
  finance: Finance;
  onOpenCard: (id: number) => void;
  onOpenSealed: (name: string) => void;
}) {
  const refresh = useMutation({
    mutationFn: () => api.refreshFinance({}),
  });
  const groupChart = finance.setsChart.map((g) => ({
    name: g.name,
    value: g.value,
  }));
  const rarityChart = finance.byRarity.map((r) => ({
    name: r.rarity,
    value: r.value,
  }));
  const histMin = Math.min(...finance.history.map((h) => Math.min(h.value, h.paid)));
  const histMax = Math.max(...finance.history.map((h) => Math.max(h.value, h.paid)));
  const histLo = Math.floor((histMin - 120) / 100) * 100;
  const histHi = Math.ceil((histMax + 120) / 100) * 100;
  const netColor = finance.net >= 0 ? "text-emerald-400" : "text-red-400";
  const netPct =
    finance.paid > 0 ? (finance.net / finance.paid) * 100 : 0;
  // Grand total across everything cataloged (same rule as Home):
  // Lorcana finance total + graded comics. Items and the per-item
  // average follow the same everything-counts scope.
  const comicsValue = COMICS_TOTAL_VALUE;
  const grandValue = finance.value + comicsValue;
  const grandItems = finance.cards + COMICS.length;
  const grandAvg = grandItems > 0 ? grandValue / grandItems : 0;

  // Each breakdown (Value by Set, Value and Paid by Set, Value by
  // Rarity, Where Your Items Sit by Price, Most Valuable Items) lives
  // on its own page, opened from the pill tab row above Value Over
  // Time (Anthony: the main Card Performance page was getting too long
  // with them all on it). Opening one pushes one history entry, so the
  // device/browser Back returns to Card Performance — the same pattern
  // as the card detail sheet — and the on-page Back button goes
  // through history too.
  type FinanceSub = "bySet" | "paidBySet" | "byRarity" | "tiers" | "top";
  const [subView, setSubView] = useState<FinanceSub | null>(null);
  const subPushedRef = useRef(false);
  const openSub = (view: FinanceSub) => {
    setSubView(view);
    window.scrollTo({ top: 0 });
    try {
      window.history.pushState(
        { mcView: "finances", lorcanaFinanceSub: view },
        "",
      );
      subPushedRef.current = true;
    } catch {
      subPushedRef.current = false;
    }
  };
  const closeSub = () => {
    if (subPushedRef.current) {
      window.history.back();
    } else {
      setSubView(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      // A card opened from a sub-page pushes its own entry; only close
      // when the pop lands on a state that isn't a sub-page entry.
      if (
        subPushedRef.current &&
        !(
          window.history.state as { lorcanaFinanceSub?: string } | null
        )?.lorcanaFinanceSub
      ) {
        subPushedRef.current = false;
        setSubView(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const topItemsList = (
    <ol className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
      {finance.topItems.map((item, i) => {
        const itemPct =
          item.paidTotal > 0
            ? ((item.totalValue - item.paidTotal) / item.paidTotal) * 100
            : null;
        const inner = (
          <>
            <TopItemThumb item={item} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--text)]">
                <span className="mr-1.5 text-[var(--dim)]">{i + 1}.</span>
                {item.name}
              </span>
              <span className="block truncate text-xs text-[var(--gold-soft)]">
                {item.groupName}
                {item.printed ? ` · #${item.printed}` : ""}
                {item.rarity ? ` · ${item.rarity}` : ""}
              </span>
              <span className="block text-xs text-[var(--dim)]">
                Qty {item.qty} · Paid {fmtUSD(item.paidTotal)}
                {itemPct != null ? (
                  <span
                    className={
                      itemPct >= 0 ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    {" "}
                    ({itemPct < 0 ? "−" : "+"}
                    {Math.abs(itemPct).toFixed(2)}%)
                  </span>
                ) : null}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-bold text-[var(--text)]">
                {fmtUSD(item.totalValue)}
              </span>
              <span className="block text-xs text-[var(--dim)]">
                {fmtUSD(item.unitValue)} each
              </span>
            </span>
          </>
        );
        return (
          <li key={`${item.id ?? item.name}-${i}`}>
            {item.id != null ? (
              <button
                type="button"
                onClick={() => onOpenCard(item.id as number)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                {inner}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`View details for ${item.name}`}
                onClick={() => onOpenSealed(item.name)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );

  const valueBySetContent = (
    <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <ValueBarChart
        data={groupChart}
        nameKey="name"
        label={`Bar chart of market value by set. Highest: ${finance.setsChart[0]?.name ?? ""} at ${fmtUSD(finance.setsChart[0]?.value ?? 0)}.`}
      />
    </div>
  );

  const valuePaidBySetContent = (
    <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs leading-relaxed text-[var(--dim)]">
        Grouped as in your Nov 1, 2026 export. In the live figures
        elsewhere in this view, the foil reprints inside the
        Illumineer&rsquo;s Quest decks count with their original sets
        instead of the quests, so a few sets differ by a few dollars
        between the two.
      </p>
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {finance.bySet.map((s) => (
          <li
            key={s.name}
            className="flex items-baseline justify-between gap-2 py-1.5 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate text-[var(--text)]">{s.name}</span>
              <span className="block text-xs text-[var(--dim)]">
                {s.cards.toLocaleString()} cards · from the Nov 1, 2026 export
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold text-[var(--text)]">
                {fmtUSD(s.value)}{" "}
                <span className="font-normal text-[var(--dim)]">
                  / paid {fmtUSD(s.paid)}
                </span>
              </span>
              <span
                className={`block text-xs font-semibold ${
                  s.net >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {s.net < 0 ? "−" : "+"}
                {fmtUSD(Math.abs(s.net))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const valueByRarityContent = (
    <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <ValueBarChart
        data={rarityChart}
        nameKey="name"
        label="Bar chart of market value by card rarity."
      />
      <ul className="mt-2 divide-y divide-[var(--border)]">
        {finance.byRarity.map((r) => (
          <li
            key={r.rarity}
            className="flex items-baseline justify-between gap-2 py-1.5 text-sm"
          >
            <span className="text-[var(--text)]">
              {r.rarity}
              <span className="block text-xs text-[var(--dim)]">
                {r.distinct.toLocaleString()} printings ·{" "}
                {r.ownedQty.toLocaleString()} cards
              </span>
            </span>
            <span className="shrink-0 font-semibold text-[var(--text)]">
              {fmtUSD(r.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const priceTiersContent = (
    <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
      {finance.tiers.map((tier) => (
        <li
          key={tier.label}
          className="flex items-baseline justify-between gap-2 py-2 text-sm"
        >
          <span className="text-[var(--text)]">
            {tier.label}
            <span className="block text-xs text-[var(--dim)]">
              per-item market price
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-semibold text-[var(--text)]">
              {tier.copies.toLocaleString()} cards
            </span>
            <span className="block text-xs text-[var(--dim)]">
              {fmtUSD(tier.value)} total
            </span>
          </span>
        </li>
      ))}
    </ul>
  );

  if (subView != null) {
    const subPages: Record<
      FinanceSub,
      { title: string; content: ReactNode }
    > = {
      bySet: { title: "Value by set", content: valueBySetContent },
      paidBySet: {
        title: "Value and paid, by set",
        content: valuePaidBySetContent,
      },
      byRarity: { title: "Value by rarity", content: valueByRarityContent },
      tiers: {
        title: "Where your items sit by price",
        content: priceTiersContent,
      },
      top: { title: "Most valuable items you own", content: topItemsList },
    };
    const page = subPages[subView];
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={closeSub}
          aria-label="Back to Card Performance"
          className="rounded-full border border-[var(--accent)]/50 px-3.5 py-1.5 text-sm font-medium text-[var(--gold-soft)]"
        >
          ← Back
        </button>
        <h2 className="mt-3 font-album text-xl text-[var(--text)]">
          {page.title}
        </h2>
        {page.content}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Page title in a clean bordered window (Anthony, Nov 3,
          2026), matching the bordered section headers he has
          been approving (Sealed intro, Social intro/Friends) —
          the plain title floating on the page didn't flow with
          the rest. The summary block directly underneath got
          the same treatment later that night (see below). */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
          Portfolio
        </h1>
      </div>

      {/* Headline numbers in ONE clean bordered window
          (Anthony, Nov 3, 2026 — his correction: the title
          window was fine; the loose text under it was not).
          Everything that used to float as loose text — the
          As-of freshness line, the collection total, and the
          summary figures — is tidied into this window: the
          total stays the hero, and every other figure is a
          neat aligned label/value row. The breakdown tabs
          and charts below are unchanged. */}
      <section
        aria-label="Collection value summary"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-[var(--dim)]">
            As of {finance.asOfLabel}
          </p>
          <button
            type="button"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
            className="shrink-0 rounded-full border border-[var(--accent)]/50 px-3 py-1.5 text-xs font-medium text-[var(--gold-soft)] disabled:opacity-40"
          >
            {refresh.isPending ? "Starting…" : "Re-price now"}
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
          Prices update on their own once a day. Need a live price
          right now? Press Re-price now to force a fresh price check
          on everything.
        </p>
        {refresh.isSuccess ? (
          <p className="mt-1 text-xs text-[var(--dim)]">
            {refresh.data.started
              ? "Daily re-pricing started in the background — totals and a new chart point land when it finishes."
              : "A re-pricing run is already in progress."}
          </p>
        ) : null}
        {refresh.isError ? (
          <p className="mt-1 text-xs text-red-400">
            Re-pricing couldn&rsquo;t start — try again.
          </p>
        ) : null}
        <div className="pt-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
            Your collection
          </p>
          <p className="mt-1 text-[52px] font-extrabold leading-none tracking-tight text-[var(--accent)] sm:text-6xl">
            {fmtUSD(grandValue)}
          </p>
          <p className="mt-2 text-xs text-[var(--dim)]">
            Lorcana {fmtUSD(finance.value)} + Graded Comics{" "}
            {fmtUSD(comicsValue)}
          </p>
        </div>
        <dl className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
              Total paid
            </dt>
            <dd className="font-album text-base font-bold tabular-nums text-[var(--text)]">
              {fmtUSD(finance.paid)}{" "}
              <span className={`text-sm ${netColor}`}>
                ({netPct < 0 ? "−" : "+"}
                {Math.abs(netPct).toFixed(2)}%)
              </span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
              Gain / loss
            </dt>
            <dd
              className={`font-album text-base font-bold tabular-nums ${netColor}`}
            >
              {finance.net < 0 ? "−" : "+"}
              {fmtUSD(Math.abs(finance.net))}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
              Items
            </dt>
            <dd className="font-album text-base font-bold tabular-nums text-[var(--accent)]">
              {grandItems.toLocaleString()}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
              Avg per item
            </dt>
            <dd className="font-album text-base font-bold tabular-nums text-[var(--accent)]">
              {fmtUSD(grandAvg)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
              Per distinct printing
            </dt>
            <dd className="font-album text-base font-bold tabular-nums text-[var(--text)]">
              {fmtUSD(finance.avgPerDistinct)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--dim)]">
          Foil-family printings hold {fmtUSD(finance.foilValue)} of the
          binder&rsquo;s value ({finance.foilSharePct}%). In spare copies
          beyond your first of each card: {fmtUSD(finance.spareValue)} across{" "}
          {finance.spareCopies.toLocaleString()} copies
          {finance.beyondPlaysetCopies > 0 ? (
            <>
              {" "}— and {fmtUSD(finance.beyondPlaysetValue)} of that sits in{" "}
              {finance.beyondPlaysetCopies.toLocaleString()} copies beyond a
              playset of four, the natural stock for selling lots
            </>
          ) : null}
          .
        </p>
      </section>

      {/* Breakdown tabs — oval pills in the Most Valuable Items style,
          sitting directly above Value Over Time (Anthony's layout).
          Most Valuable Items moved down into this row from the top of
          the page. Each pill opens its own page, not a scroll-down.
          The row is an equal-column grid so the five pills spread
          evenly across the full width, centered — never bunched on
          the left (Anthony's fix). */}
      <nav
        aria-label="Card Performance breakdowns"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
      >
        {(
          [
            ["bySet", "Value by Set"],
            ["paidBySet", "Value and Paid by Set"],
            ["byRarity", "Value by Rarity"],
            ["tiers", "Where Your Items Sit by Price"],
            ["top", "Most Valuable Items"],
          ] as [FinanceSub, string][]
        ).map(([view, label], index) => (
          <button
            key={view}
            type="button"
            aria-label={`Open the ${label} page`}
            onClick={() => openSub(view)}
            className={`flex items-center justify-center rounded-full border border-[var(--accent)]/60 bg-[var(--surface)] px-3 py-1.5 text-center text-xs font-medium leading-tight text-[var(--gold-soft)] ${
              index === 4 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Value over time — line chart on the binder's dark theme */}
      <section aria-label="Collection value over time">
        <h2 className="font-album text-xl text-[var(--text)]">
          Value over time
        </h2>
        <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-sm font-semibold text-[var(--text)]">
            Collection market value over time
          </p>
          <div
            role="img"
            aria-label={`Line chart of Lorcana collection market value from Oct 25, 2026 to ${finance.asOfLabel}. Latest value ${fmtUSD(finance.value)}.`}
          >
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart
                data={finance.history}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7aa5ff" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#7aa5ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8b9bb8", fontSize: 10 }}
                  axisLine={{ stroke: "#24365e" }}
                  tickLine={false}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={44}
                />
                <YAxis
                  domain={[histLo, histHi]}
                  tick={{ fill: "#8b9bb8", fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toLocaleString("en-US")}`}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                  label={{
                    value: "Market value (USD)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#8b9bb8",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0e1526",
                    border: "1px solid #24365e",
                    borderRadius: 8,
                    color: "#eef2ff",
                    fontSize: 13,
                  }}
                  formatter={(v: number) => [fmtUSD(v), "Market value"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Market value"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fill="url(#valueFill)"
                  dot={{ r: 3, fill: "#7aa5ff", strokeWidth: 0 }}
                  activeDot={{ r: 4.5, fill: "#7aa5ff", strokeWidth: 0 }}
                  style={{
                    filter: "drop-shadow(0 0 6px rgba(122,165,255,0.45))",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            Tracked collection history starts Oct 25, 2026 — your first Shiny
            export; there is no earlier history. Each new export and each
            daily re-pricing adds a point. The axis starts at{" "}
            {fmtUSD(histLo, 0)} so small moves stay visible. What you paid
            ({fmtUSD(finance.paid)}) is compared per set in the Value and
            Paid by Set tab above. This chart tracks the Lorcana collection;
            the graded comics aren&rsquo;t charted — only one valuation is
            recorded for them ({COMICS_VALUE_CHECKED}) — and their{" "}
            {fmtUSD(comicsValue)} is counted in the headline total above.
          </p>
        </div>
      </section>

      {/* The four breakdown sections and Most Valuable Items moved
          off this page into their own pages behind the pill tab row
          above; this pricing note stays as the page's footnote. */}
      <p className="text-xs leading-relaxed text-[var(--dim)]">
        Prices started from your Shiny export of Nov 1, 2026 and are
        re-priced daily from current market prices; what you paid stays as
        recorded in Shiny. The headline total covers everything cataloged:
        the Lorcana figures (which include sealed products, Ink Drop
        tokens, and puzzle pieces at their export values) plus your{" "}
        {COMICS.length} graded comics at their recorded values (
        {fmtUSD(comicsValue)}, checked {COMICS_VALUE_CHECKED}). Paid and
        gain/loss cover the Lorcana collection — no purchase amounts are
        recorded for the comics. Binder-only
        totals are {fmtUSD(finance.binderValue)} value /{" "}
        {fmtUSD(finance.binderPaid)} paid across{" "}
        {finance.binderCards.toLocaleString()} cards. Figures recalculate
        whenever you change a card&rsquo;s count.
        {finance.unpricedOwnedQty > 0
          ? ` ${finance.unpricedOwnedQty.toLocaleString()} owned cards have no recorded price and count as $0.`
          : ""}
      </p>
    </div>
  );
}

/** On-device copy of the last getBinder response, so repeat opens paint
    instantly from localStorage while the fresh response revalidates in
    the background. Tiny payload (section summaries + totals only). */
const BINDER_CACHE_KEY = "lorcana-binder-response-v1";

function readBinderCache(): { data: Binder; savedAt: number } | undefined {
  try {
    const raw = window.localStorage.getItem(BINDER_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { data: Binder; savedAt: number };
    if (!parsed?.data || !Array.isArray(parsed.data.groups)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Release year per main set number, matching the year groupings on
    Shiny's set-selection screen (Anthony's reference photo): sets 11-14
    are 2026 releases, 7-10 are 2025, 3-6 are 2024, 1-2 are 2023. */
const SET_YEAR: Record<number, number> = {
  1: 2023,
  2: 2023,
  3: 2024,
  4: 2024,
  5: 2024,
  6: 2024,
  7: 2025,
  8: 2025,
  9: 2025,
  10: 2025,
  11: 2026,
  12: 2026,
  13: 2026,
  14: 2026,
};

/** Wordmark color per main set, echoing each set logo's own colors. */
const SET_ACCENT: Record<number, string> = {
  1: "#d8b45a",
  2: "#7ec8e3",
  3: "#4fb3a9",
  4: "#b18cff",
  5: "#e58bb5",
  6: "#38b6c9",
  7: "#6fce8e",
  8: "#f08a3c",
  9: "#9a7bff",
  10: "#d9c27a",
  11: "#9fd8ff",
  12: "#cfd8a0",
  13: "#8ee63f",
  14: "#ffc46b",
};

function setNumberOf(group: Group): number | null {
  if (group.kind !== "set") return null;
  const n = Number.parseInt(group.key.replace("set:", ""), 10);
  return Number.isNaN(n) ? null : n;
}

/** One tile on the set-selection screen: dark rounded tile with the
    set's real logo artwork centered and a thin blue progress bar along
    its bottom edge; the set name and its Cost to complete sit
    under the tile. The D23 promo tile shows
    the 2024 D23 Collection box artwork, sized down and contained so
    it sits inside its tile (Anthony: the full-tile cover looked too
    big); the other promo tiles show TCGplayer's promo set icon large
    with the family label (P1, P2, …) typeset to the RIGHT of the
    photo (no unique logo artwork exists for them). Quest tiles show
    each quest's real box art (Deep Trouble, Palace Heist, The Great
    Hunny Rescue), contained to fill the tile like the main set
    logos. (The tile's progress bar and owned/total line were
    removed with the app-wide pockets-filled deletion, Nov 3,
    2026.) */
function SetTile({
  group,
  selected,
  onPick,
}: {
  group: Group;
  selected: boolean;
  onPick: (key: string) => void;
}) {
  const setNum = setNumberOf(group);
  const accent =
    (setNum != null ? SET_ACCENT[setNum] : undefined) ?? "#a9c3ff";
  const logo = setNum != null ? SET_LOGOS[setNum] : undefined;
  const questArt =
    group.kind === "quest" ? QUEST_ART[group.key] : undefined;
  const wordmark = group.kind === "set" ? group.name : group.label;
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => onPick(group.key)}
        aria-current={selected || undefined}
        aria-label={`${group.name}. View its cards.`}
        className={`relative flex aspect-[21/11] w-full items-center justify-center overflow-hidden rounded-xl border bg-[var(--surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
          selected
            ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
            : "border-[#26314d]"
        }`}
      >
        {/* Tile artwork fills the tile (Anthony, Nov 3, 2026,
            ~10:15 AM): the chapter art used to sit small and
            centered over a dead padding band at the bottom
            (a leftover of the deleted progress bar), which
            made the high-res logos look like a photo pasted
            into the tile. The band is gone: set logos now
            stretch to the tile's full area (contained, so the
            wordmarks are never cropped or warped), and the
            Quest / D23 box art covers the tile full-bleed. */}
        {logo ? (
          <img
            src={logo}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain p-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
          />
        ) : questArt ? (
          <img
            src={questArt}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : group.key === "promo:D23" ? (
          <img
            src={promoD23Art}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : group.kind === "promo" ? (
          <span className="flex h-full w-full flex-row items-center justify-center gap-1.5 px-1.5">
            <img
              src={promoIcon}
              alt=""
              aria-hidden="true"
              className="min-w-0 flex-1 self-stretch object-contain py-0.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
            />
            <span
              aria-hidden="true"
              className="shrink-0 text-left text-xs font-extrabold uppercase leading-tight tracking-wide sm:text-sm"
              style={{ color: accent }}
            >
              {wordmark}
            </span>
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="text-center text-[12px] font-extrabold uppercase leading-tight tracking-wide sm:text-sm"
            style={{ color: accent }}
          >
            {wordmark}
          </span>
        )}
        {/* No progress bar and no owned/total counts on the
            tile (Anthony, Nov 3, 2026): the pockets-filled
            metric is deleted from everywhere in the app, in
            every form — text, accessible label, and bar. The
            Cost to complete line below is a different figure
            (money, not pockets) and stays. */}
      </button>
      <p className="mt-1.5 truncate text-center text-xs font-medium text-[var(--text)]">
        {group.name}
      </p>
      <p className="text-center text-[11px] font-medium leading-snug text-[var(--gold-soft)]">
        {group.missingPockets > 0
          ? `Cost to complete ${fmtUSD(group.costToComplete)}`
          : "Set complete"}
      </p>
    </div>
  );
}

/** Set-selection screen replacing the dropdown: main sets grouped under
    "Disney Lorcana <year>" headings, newest year and newest set first,
    with promo families and quests under their own headings. Each
    heading's arrow collapses its grid. */
function SetPicker({
  groups,
  currentKey,
  onPick,
}: {
  groups: Group[];
  currentKey: string | null;
  onPick: (key: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byYear = new Map<number, Group[]>();
  const promos: Group[] = [];
  const quests: Group[] = [];
  for (const g of groups) {
    // Puzzle groups get no tile of their own: they render as
    // a section inside their set's page (Anthony, Nov 3, 2026).
    if (g.kind === "puzzle") continue;
    if (g.kind === "set") {
      const n = setNumberOf(g);
      const year = (n != null ? SET_YEAR[n] : undefined) ?? 2023;
      const list = byYear.get(year) ?? [];
      list.push(g);
      byYear.set(year, list);
    } else if (g.kind === "quest") {
      quests.push(g);
    } else {
      promos.push(g);
    }
  }
  const sections: { id: string; title: string; items: Group[] }[] = [
    ...[...byYear.keys()]
      .sort((a, b) => b - a)
      .map((year) => ({
        id: `year-${year}`,
        title: `Disney Lorcana ${year}`,
        items: [...(byYear.get(year) ?? [])].sort(
          (a, b) => (setNumberOf(b) ?? 0) - (setNumberOf(a) ?? 0),
        ),
      })),
    ...(promos.length > 0
      ? [{ id: "promos", title: "Promos", items: promos }]
      : []),
    ...(quests.length > 0
      ? [{ id: "quests", title: "Illumineer's Quests", items: quests }]
      : []),
  ];

  return (
    <div className="mt-5 space-y-6">
      {sections.map((section) => {
        const isCollapsed = collapsed.has(section.id);
        return (
          <section key={section.id} aria-label={section.title}>
            <button
              type="button"
              onClick={() => toggle(section.id)}
              aria-expanded={!isCollapsed}
              aria-label={`${section.title} sets, ${isCollapsed ? "expand" : "collapse"}`}
              className="flex w-full items-center justify-between gap-2 py-1 text-left focus:outline-none"
            >
              <span className="text-base font-semibold text-[var(--text)]">
                {section.title}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-3.5 w-3.5 shrink-0 text-[var(--dim)] transition-transform ${isCollapsed ? "rotate-180" : ""}`}
              >
                <path d="m6 15 6-6 6 6" />
              </svg>
            </button>
            {!isCollapsed ? (
              <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3">
                {section.items.map((g) => (
                  <SetTile
                    key={g.key}
                    group={g}
                    selected={g.key === currentKey}
                    onPick={onPick}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** QR code for the Collector ID payload, rendered as an SVG from the
    in-app encoder (client/src/qr.ts — a real, scannable QR). White
    plate with a quiet zone so any scanner can read it. */
function CollectorQr({ payload }: { payload: string }) {
  let path = "";
  let size = 0;
  try {
    const qr = qrMatrix(payload);
    size = qr.size;
    const parts: string[] = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.modules[y]?.[x]) parts.push(`M${x + 4} ${y + 4}h1v1h-1z`);
      }
    }
    path = parts.join("");
  } catch {
    path = "";
  }
  if (!path || size === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${size + 8} ${size + 8}`}
      role="img"
      aria-label="QR code for your collector ID — scanning it shows your username and collector code"
      className="block h-full w-full"
    >
      <rect width={size + 8} height={size + 8} fill="#ffffff" />
      <path d={path} fill="#0a0f1e" />
    </svg>
  );
}

/** Collector ID (Anthony's requests, Nov 2, 2026): his unique
    identifier — a username he picks, a photo of his choice, a stable
    collector code, and a QR code encoding username + code. Per his
    follow-up direction it is now a small oval chip tucked into the
    top corner of Home (small, but the name and code stay readable),
    and tapping it opens the full ID view with a big, scannable QR
    code. The code never changes; username and photo are edited in
    the expanded view. */
/** Quantity stepper button (− / +) with a much bigger touch
    target — Anthony's fix for his biggest aggravation with Shiny
    ("when I try to hit the plus button my thumb just never hits
    it"). The visible circle keeps its neat size; the tappable box
    is ~56px square (52px on the narrow sealed tiles), and negative
    margins keep the layout box at the circle's old footprint, so
    rows, tiles, and the Owned-label alignment stay exactly as
    they were — only the hit area grows. The two buttons of a
    stepper sit far enough apart that their grown zones never
    overlap each other, and the zones live inside the stepper row,
    so a tile's own tap (its image) still opens the item. Every
    press ticks the haptics. */
function StepperButton({
  label,
  onClick,
  disabled,
  glyph,
  circleClass,
  tight,
  onLongPress,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  glyph: string;
  /** Visible circle size/text classes, e.g. "h-8 w-8 text-base". */
  circleClass: string;
  /** Narrow-tile variant: 52px box on a 28px footprint. */
  tight?: boolean;
  /** Long-hold behavior (Anthony, Nov 3, 2026): holding the
      button opens the scrollable count picker instead of
      stepping once; the click after a long hold is swallowed. */
  onLongPress?: () => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const pressLongFired = useRef(false);
  const endPress = () => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => {
        if (!onLongPress || disabled) return;
        pressLongFired.current = false;
        endPress();
        pressTimer.current = window.setTimeout(() => {
          pressLongFired.current = true;
          hapticConfirm();
          onLongPress();
        }, 450);
      }}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
      onClick={() => {
        if (pressLongFired.current) {
          pressLongFired.current = false;
          return;
        }
        hapticTick();
        onClick();
      }}
      className={`relative -m-3 flex shrink-0 items-center justify-center rounded-full disabled:opacity-35 ${
        tight ? "h-[52px] w-[52px]" : "h-14 w-14"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full border border-[var(--border)] leading-none text-[var(--text)] ${circleClass}`}
      >
        {glyph}
      </span>
    </button>
  );
}

/** Anthony's own profile page — the same Shiny-style layout as a
    friend's profile (avatar, stats, badges, searchable item
    grid; no banner — it was cutting his photo in half), fed by
    his real collection: the profile summary action computes his
    joined date, Founder status, master-set completions, and
    verified social counts, and the item grid pages through
    every owned printing and sealed product. No Trade Match tab
    — there's nobody to match against himself. Tapping the QR
    chip goes to the same expanded Collector ID page the Home
    element opens (onOpenCollectorId closes this page back to
    it — the profile sits on top of that very view). */
function OwnProfilePage({
  username,
  collectorCode,
  photoUrl,
  bannerUrl,
  payload,
  onClose,
  onOpenCollectorId,
  onOpenCard,
  onOpenSealed,
  onOpenBinderGroup,
}: {
  username: string;
  collectorCode: string;
  photoUrl: string | null;
  bannerUrl: string | null;
  payload: string;
  onClose: () => void;
  onOpenCollectorId: () => void;
  onOpenCard: (cardId: number) => void;
  onOpenSealed: (name: string) => void;
  /** Opens a binder section (or "comics") from the Library
      page — threaded from the app root's navigation. */
  onOpenBinderGroup?: (key: string) => void;
}) {
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [decksOpen, setDecksOpen] = useState(false);
  const badgesSheet = useHistorySheet("lorcanaBadges", setBadgesOpen,
  );
  const decksSheet = useHistorySheet("lorcanaDecks", setDecksOpen,
  );
  // The profile shelf + Library (Anthony, Nov 3, 2026): the
  // binder groups come from the same getBinder query the
  // binder view uses (shared cache) — a book stands on the
  // little shelf for every group he owns at least one card
  // in (owned slots > 0), and the Library lists every group,
  // empty ones faded.
  const [libraryOpen, setLibraryOpen] = useState(false);
  const librarySheet = useHistorySheet("lorcanaLibrary", setLibraryOpen);
  const binderQ = useQuery({
    queryKey: ["binder"],
    queryFn: () => api.getBinder({}),
  });
  const shelfBinderGroups = (binderQ.data?.groups ?? []).filter(
    (g) => g.kind !== "puzzle",
  );
  const shelfGroups = shelfBinderGroups
    .filter((g) => g.owned > 0)
    .map((g) => ({ key: g.key }));
  const libraryEntries: LibraryEntry[] = [
    ...shelfBinderGroups.map((g) => ({
      id: g.key,
      spineLabel:
        g.kind === "set"
          ? String(setNumberOf(g) ?? "")
          : g.label.replace(/^Quest /, ""),
      title: g.name,
      detail: `${g.label} binder`,
      owned: g.owned,
      total: g.total,
      canOpen: Boolean(onOpenBinderGroup),
    })),
    {
      id: "comics",
      spineLabel: "C",
      title: "Graded Comics",
      detail: "Comics binder",
      owned: COMICS.length,
      total: COMICS.length,
      canOpen: Boolean(onOpenBinderGroup),
    },
  ];
  // Optional profile banner (opt-in, default none): the ⋮ menu on
  // the header offers add/change/remove; the picker and mutations
  // live here, mirroring the Collector ID photo flow.
  const queryClient = useQueryClient();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const saveBanner = useMutation({
    mutationFn: (imageBase64: string) =>
      api.setProfileBanner({ imageBase64 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
      setBannerError(null);
    },
    onError: () => setBannerError("That banner didn't save — try again."),
  });
  const removeBanner = useMutation({
    mutationFn: () => api.removeProfileBanner({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
    },
  });
  const onBannerPicked = (file: File | undefined) => {
    if (!file) return;
    setBannerError(null);
    void imageFileToJpegBase64(file)
      .then((b64) => saveBanner.mutate(b64))
      .catch(() =>
        setBannerError("That photo couldn't be read — try another."),
      );
  };
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState<ProfileSort>("value");
  const [filter, setFilter] = useState<ProfileFilter>("all");
  const finance = useQuery({
    queryKey: ["finance"],
    queryFn: () => api.getFinance({}),
  });
  const summary = useQuery({
    queryKey: ["profileSummary"],
    queryFn: () => api.getProfileSummary({ comicsOwned: COMICS.length }),
  });
  const items = useQuery({
    queryKey: ["profileItems", query, group, sort, filter],
    queryFn: () =>
      api.getProfileItems({ query, group, sort, filter }),
    placeholderData: (prev) => prev,
  });
  const s = summary.data;
  const badgeStates = evaluateBadges({
    founder: s?.founder ?? false,
    totalItems: s?.totalItems ?? 0,
    setsCompleted: s?.completedSets.length ?? 0,
    ownsEnchanted: s?.ownsEnchanted ?? false,
    ownsIconic: s?.ownsIconic ?? false,
    sealedCount: s?.sealedCount ?? 0,
    comicsCount: COMICS.length,
    confirmedTrades: s?.confirmedTrades ?? 0,
    trustScore: s?.trustScore ?? 0,
    confirmedConnections: s?.confirmedConnections ?? 0,
  });
  const grandValue =
    finance.data != null
      ? finance.data.value + COMICS_TOTAL_VALUE
      : null;
  const collected =
    finance.data != null ? finance.data.cards + COMICS.length : null;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Your profile"
    >
      <div className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Choose a banner photo"
          onChange={(e) => {
            onBannerPicked(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <ProfileHeader
          onBack={onClose}
          backLabel="Back to collector ID"
          onQrTap={onOpenCollectorId}
          bannerUrl={bannerUrl}
          onBannerPick={() => bannerInputRef.current?.click()}
          onBannerRemove={() => removeBanner.mutate()}
          avatar={
            photoUrl ? (
              <img
                src={photoUrl}
                alt={`Photo chosen by ${username}`}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-[var(--bg)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent)] font-album text-4xl font-bold text-[var(--on-accent)] ring-4 ring-[var(--bg)]"
              >
                {username.charAt(0).toUpperCase() || "?"}
              </span>
            )
          }
          displayName={username}
          handle={username.toLowerCase()}
          bio="Just an average guy collecting cards letting his inner child let loose :)"
          joined={joinedLabel(s?.joinedAt)}
          statValue={grandValue != null ? fmtUSD(grandValue) : "—"}
          statCollected={
            collected != null ? collected.toLocaleString() : "—"
          }
          trustScore={s?.trustScore ?? 0}
          connections={s?.confirmedConnections ?? 0}
          collectorCode={collectorCode}
          qrPayload={payload}
          badges={badgeStates}
          onOpenBadges={badgesSheet.openSheet}
          onOpenDecks={decksSheet.openSheet}
          shelfGroups={shelfGroups}
          onOpenLibrary={librarySheet.openSheet}
        />
        {bannerError ? (
          <p role="alert" className="mt-2 px-1 text-sm text-red-400">
            {bannerError}
          </p>
        ) : null}
        {s && s.completedSets.length > 0 ? (
          <p className="mt-3 px-1 text-xs leading-relaxed text-[var(--dim)]">
            Master sets complete: {s.completedSets.join(", ")} — your
            rule: regular + cold foil + Epics.
          </p>
        ) : null}
        <ProfileCollectionSection
          total={items.data?.total ?? 0}
          groups={items.data?.groups ?? []}
          query={query}
          onQueryChange={setQuery}
          group={group}
          onGroupChange={setGroup}
          sort={sort}
          onSortChange={setSort}
          filter={filter}
          onFilterChange={setFilter}
          items={items.data?.items ?? []}
          loading={items.isPending}
          emptyText="No items match that search or filter in your collection."
          onOpenCard={onOpenCard}
          onOpenSealed={onOpenSealed}
        />
        {libraryOpen ? (
          <LibraryPage
            ownerName={username}
            entries={libraryEntries}
            onClose={librarySheet.closeSheet}
            onOpenEntry={(entry) => {
              if (onOpenBinderGroup) onOpenBinderGroup(entry.id);
            }}
          />
        ) : null}
        {badgesOpen ? (
          <AchievementsSheet
            states={badgeStates}
            ownerLabel="Your"
            onClose={badgesSheet.closeSheet}
          />
        ) : null}
        {decksOpen ? (
          <DecksSheet
            heading="My Decks"
            ownerName={username}
            isOwn
            onClose={decksSheet.closeSheet}
          />
        ) : null}
      </div>
    </div>
  );
}

function CollectorIdCard({
  onOpenCard,
  onOpenSealed,
  onOpenBinderGroup,
  updateAvailable,
  onOpenUpdate,
  onOpenUpdateTest,
  envelope,
  orderMail,
}: {
  onOpenCard?: (cardId: number) => void;
  onOpenSealed?: (name: string) => void;
  /** Opens a binder section (or "comics") from the own
      profile's Library page. */
  onOpenBinderGroup?: (key: string) => void;
  /** The order-mail indicator (Anthony, Nov 3, 2026): sits
      in the same row as the envelope, left of the ID pill —
      shown to ANY collector when a reply inside one of their
      orders is unread. Distinct from the red ticket
      envelope: this one is for order messages only. */
  orderMail?: ReactNode;
  /** The owner's red envelope (Anthony, Nov 3, 2026): it
      renders INSIDE this row, immediately left of the ID pill
      and vertically centered on the pill's line — right up
      against the profile picture and name, as he directed.
      (It used to sit in a wrapper outside this component,
      which left it stranded at the far left of the row while
      this row's justify-between pushed the pill to the far
      right.) */
  envelope?: ReactNode;
  /** A newer build is live (the app's automatic check on
      open found one): show the yellow Update available note
      left of the username. */
  updateAvailable?: boolean;
  onOpenUpdate?: () => void;
  /** Opens the one-time test walkthrough of the update flow. */
  onOpenUpdateTest?: () => void;
}) {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["collectorId"],
    queryFn: () => api.getCollectorId({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  // Central registry (Vault X server on Supabase): usernames
  // live server-side in the registry's profiles table. This query
  // reads the live member list back; when Anthony's own Collector
  // ID isn't there yet (or his username changed since), the effect
  // below registers it and the server read-back proves it landed —
  // the same registration that put the Jarvis test friend
  // (MC-JARVIS) on the server.
  const registry = useQuery({
    queryKey: ["registryMembers"],
    queryFn: () => api.getRegistryMembers({}),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const syncRegistry = useMutation({
    mutationFn: () => api.syncCollectorRegistry({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["registryMembers"],
      });
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
    },
  });
  const autoSyncedForRef = useRef<string | null>(null);
  useEffect(() => {
    const p = profile.data;
    const r = registry.data;
    if (!p || !r || !r.reachable || syncRegistry.isPending) return;
    const mine = r.members.find((m) => m.collectorId === p.collectorCode);
    const needsSync = !mine || mine.username !== p.username;
    const key = `${p.collectorCode}:${p.username}`;
    if (needsSync && autoSyncedForRef.current !== key) {
      autoSyncedForRef.current = key;
      syncRegistry.mutate();
    }
  }, [profile.data, registry.data, syncRegistry]);
  // Seeded from a surviving history entry so a refresh on the
  // full ID view — or on the profile page above it — reopens
  // exactly there (Anthony, Nov 3, 2026: refresh on "View my
  // profile" threw him back to Home).
  const [expanded, setExpanded] = useState(() => {
    const st = readHistoryState();
    return st?.lorcanaCollectorId === true || st?.lorcanaOwnProfile === true;
  });
  const expandedPushedRef = useRef(
    readHistoryState()?.lorcanaCollectorId === true ||
      readHistoryState()?.lorcanaOwnProfile === true,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const openExpanded = () => {
    setExpanded(true);
    try {
      window.history.pushState({ lorcanaCollectorId: true }, "");
      expandedPushedRef.current = true;
    } catch {
      expandedPushedRef.current = false;
    }
  };
  const closeExpanded = () => {
    if (expandedPushedRef.current) {
      window.history.back();
    } else {
      setExpanded(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (
        expandedPushedRef.current &&
        !(window.history.state as { lorcanaCollectorId?: boolean } | null)
          ?.lorcanaCollectorId
      ) {
        expandedPushedRef.current = false;
        setExpanded(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // His own profile page (the Shiny-style layout) opens ON TOP of
  // the full ID view with its own history entry, so Back from the
  // profile returns to the ID, and Back again returns Home.
  const [profileOpen, setProfileOpen] = useState(
    () => readHistoryState()?.lorcanaOwnProfile === true,
  );
  const profilePushedRef = useRef(
    readHistoryState()?.lorcanaOwnProfile === true,
  );
  const openProfile = () => {
    hapticTick();
    setProfileOpen(true);
    try {
      window.history.pushState({ lorcanaOwnProfile: true }, "");
      profilePushedRef.current = true;
    } catch {
      profilePushedRef.current = false;
    }
  };
  const closeProfile = () => {
    if (profilePushedRef.current) {
      window.history.back();
    } else {
      setProfileOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (
        profilePushedRef.current &&
        !(window.history.state as { lorcanaOwnProfile?: boolean } | null)
          ?.lorcanaOwnProfile
      ) {
        profilePushedRef.current = false;
        setProfileOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const data = profile.data;
  const username = data?.username ?? "…";
  const draftValue = draft ?? data?.username ?? "";
  const usernameValid = /^[A-Za-z0-9_]{3,20}$/.test(draftValue.trim());

  const saveUsername = useMutation({
    mutationFn: (name: string) => api.setCollectorUsername({ username: name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
      setDraft(null);
    },
  });
  const savePhoto = useMutation({
    mutationFn: (imageBase64: string) => api.setCollectorPhoto({ imageBase64 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
      setPhotoError(null);
    },
    onError: () => setPhotoError("That photo didn't save — try again."),
  });
  const removePhoto = useMutation({
    mutationFn: () => api.removeCollectorPhoto({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
    },
  });
  // The one-time TEST of the Update available note (Anthony):
  // tapping it does NOT dismiss it — it walks him through the
  // whole update flow another collector would go through
  // (the Settings rehearsal), and the note disappears only
  // once he finishes the walkthrough there.
  const showUpdateTest = data != null && !data.updateTestSeen;

  const onPhotoPicked = (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    void imageFileToJpegBase64(file)
      .then((b64) => savePhoto.mutate(b64))
      .catch(() => setPhotoError("That photo couldn't be read — try another."));
  };

  const payload = data
    ? `Vault X\nCollector: @${data.username}\nID: ${data.collectorCode}`
    : "";

  const avatar = (sizeClass: string, textClass: string) =>
    data?.photoUrl ? (
      <img
        src={data.photoUrl}
        alt={`Photo chosen by ${username} for the collector ID`}
        className={`${sizeClass} shrink-0 rounded-full border-2 border-[var(--accent)]/60 object-cover`}
      />
    ) : (
      <span
        aria-hidden="true"
        className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)]/60 bg-[var(--bg)] font-album font-bold text-[var(--gold-soft)] ${textClass}`}
      >
        {username.charAt(0).toUpperCase() || "?"}
      </span>
    );

  return (
    <section aria-label="Your collector ID" className="mb-3">
      {/* The compact corner chip: photo, username, code, and a QR
          thumbnail in a small oval at the top corner of Home. The
          whole chip opens the full ID view. To its LEFT sits the
          update note (Anthony, Nov 2, 2026, late): the app checks
          on open, and when a newer build is live a yellow "Update
          available" note appears here — tapping it goes to
          Settings to read the changelog and update (updating is
          always his tap, never automatic). Until he has been
          through it once, a one-time TEST of the same note shows
          instead: tapping it opens a dress-rehearsal walkthrough
          of the whole update flow, and the test note is gone for
          good once he finishes it. */}
      <div className="flex items-center justify-between gap-2">
        {updateAvailable ? (
          <button
            type="button"
            onClick={() => {
              hapticTick();
              onOpenUpdate?.();
            }}
            aria-label="Update available — tap to read what's new and choose to update"
            className="shrink-0 rounded-full bg-[#ffd21f] px-3 py-1.5 text-xs font-black text-[#4a3200] shadow-[0_0_14px_rgba(255,210,31,0.4)] transition active:scale-[0.97]"
          >
            Update available
          </button>
        ) : showUpdateTest ? (
          <button
            type="button"
            onClick={() => {
              hapticTick();
              onOpenUpdateTest?.();
            }}
            aria-label="Test of the update note — tap to walk through the update flow"
            className="shrink-0 rounded-full bg-[#ffd21f] px-3 py-1.5 text-xs font-black text-[#4a3200] shadow-[0_0_14px_rgba(255,210,31,0.4)] transition active:scale-[0.97]"
          >
            Update available
            <span className="ml-1.5 rounded-full border border-[#4a3200]/60 px-1.5 py-px align-middle text-[9px] font-bold uppercase tracking-wider">
              Test
            </span>
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex items-center gap-1">
          {orderMail ?? null}
          {envelope ?? null}
          <button
          type="button"
          onClick={openExpanded}
          disabled={!data}
          aria-label={`Your collector ID: ${username}, ${data?.collectorCode ?? ""}. Tap to open the full ID with a large QR code.`}
          className="flex items-center gap-2 rounded-full border border-[var(--accent)]/45 bg-[var(--surface)] py-1.5 pl-2 pr-2.5 text-left shadow-[0_0_18px_rgba(110,155,255,0.14),inset_0_1px_0_rgba(255,255,255,0.06)] disabled:opacity-60"
        >
          {avatar("h-9 w-9", "text-sm")}
          <span className="min-w-0">
            <span className="block max-w-36 truncate text-[13px] font-bold leading-tight text-[var(--text)]">
              @{username}
            </span>
            <span className="block text-[10px] leading-tight tabular-nums text-[var(--dim)]">
              {data?.collectorCode ?? "Generating…"}
            </span>
          </span>
          {data ? (
            <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/25">
              <CollectorQr payload={payload} />
            </span>
          ) : null}
          </button>
        </div>
      </div>

      {/* Full ID view: big photo, username, code, and a large
          scannable QR, with the username/photo editor below. */}
      {expanded && data ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
          role="dialog"
          aria-modal="true"
          aria-label="Your collector ID"
          onClick={closeExpanded}
        >
          <div
            className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={closeExpanded}
                aria-label="Back"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
              >
                ←
              </button>
              <button
                type="button"
                onClick={closeExpanded}
                aria-label="Close collector ID"
                className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center text-center">
              {avatar("h-20 w-20", "text-3xl")}
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--dim)]">
                Collector ID
              </p>
              <h2 className="font-album mt-1 text-2xl font-bold leading-tight text-white">
                @{data.username}
              </h2>
              <p className="mt-0.5 text-sm tabular-nums text-[var(--dim)]">
                {data.collectorCode}
              </p>
              {/* Profile stats, directly under the name and photo
                  (Anthony's direction): the Trust Score and the
                  Confirmed connections count. Both are verified-only
                  by design — connections count only people who
                  scanned this Collector ID and actually connected,
                  never views or taps. Honest zeros until connecting
                  and trading go live; the full breakdown is below. */}
              <div className="mt-4 flex items-stretch justify-center gap-6">
                <div className="text-center">
                  <p className="font-album text-2xl font-bold leading-none text-[var(--gold-soft)]">
                    0
                  </p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
                    Trust Score
                  </p>
                </div>
                <div
                  aria-hidden="true"
                  className="w-px bg-[var(--border)]"
                />
                <div className="text-center">
                  <p className="font-album text-2xl font-bold leading-none text-[var(--gold-soft)]">
                    0
                  </p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
                    Confirmed connections
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--dim)]">
                Verified events only — connections count people who
                scanned your ID and connected, not views or taps.
              </p>
              <div className="mt-5 w-64 max-w-full overflow-hidden rounded-3xl border border-white/25 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
                <CollectorQr payload={payload} />
              </div>
              <p className="mt-3 max-w-72 text-sm leading-relaxed text-[var(--dim)]">
                Your unique identifier — another collector can scan this
                QR code to get your username and collector code.
              </p>
              {onOpenCard && onOpenSealed ? (
                <button
                  type="button"
                  onClick={openProfile}
                  className="mt-5 w-full max-w-72 rounded-full bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--on-accent)]"
                >
                  View my profile
                </button>
              ) : null}
            </div>

            {/* Trust Score (Anthony's design, Nov 2, 2026): a
                karma-style score that can only be earned through
                VERIFIED events — never upvotes or self-voting. Front-
                end structure only for now (Social is not live), so the
                figures are honest zeros: nothing has been confirmed
                yet because connecting and trading aren't switched on. */}
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <h3 className="font-album text-base text-[var(--text)]">
                Trust Score breakdown
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
                Earned only from verified events — it can&rsquo;t be
                gamed with upvotes or self-votes. A trade counts only
                when both collectors confirm it (for example, by
                scanning each other&rsquo;s Collector ID), and feedback
                counts only after a confirmed trade.
              </p>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                <li className="flex items-baseline justify-between gap-2 py-2 text-sm">
                  <span className="text-[var(--text)]">Confirmed trades</span>
                  <span className="font-semibold tabular-nums text-[var(--text)]">
                    0
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-2 py-2 text-sm">
                  <span className="text-[var(--text)]">
                    Confirmed connections
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--text)]">
                    0
                  </span>
                </li>
                <li className="flex items-baseline justify-between gap-2 py-2 text-sm">
                  <span className="text-[var(--text)]">
                    Feedback from confirmed trades
                  </span>
                  <span className="text-[var(--dim)]">None yet</span>
                </li>
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                Connections count only people who scanned your Collector
                ID and actually connected — not views or taps. Your score
                starts moving once connecting and trading switch on.
              </p>
            </div>

            {/* Server registry status (Anthony's question, Nov 2,
                2026): is the username actually living on the Shadow
                Vault server (Supabase), not just inside this app?
                This reads the live profiles table back: his row,
                the Jarvis test friend's row, and the member count
                are whatever the server itself reports. */}
            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <h3 className="font-album text-base text-[var(--text)]">
                Vault X server registry
              </h3>
              {registry.isPending || syncRegistry.isPending ? (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]" role="status">
                  {syncRegistry.isPending
                    ? "Registering your username on the server…"
                    : "Checking the server…"}
                </p>
              ) : registry.data && registry.data.reachable ? (
                <>
                  {registry.data.iAmRegistered ? (
                    <p className="mt-1.5 text-sm font-semibold leading-relaxed text-emerald-400" role="status">
                      ✓ On the server — @{data.username} ·{" "}
                      {data.collectorCode} lives in the Vault X
                      registry, alongside {registry.data.members.length}{" "}
                      {registry.data.members.length === 1
                        ? "collector"
                        : "collectors"}
                      .
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm font-semibold leading-relaxed text-[var(--gold-soft)]" role="status">
                      Your username isn&rsquo;t on the server yet —
                      registering it puts it in the same registry
                      other collectors will join.
                    </p>
                  )}
                  <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
                    {registry.data.jarvisRegistered
                      ? "Jarvis (MC-JARVIS) is on the server too — the test friend ported over, exactly as he should have."
                      : "Jarvis (MC-JARVIS) isn't showing on the server right now."}
                    {registry.data.registrySyncedAt
                      ? ` Your registration was last verified ${new Date(
                          registry.data.registrySyncedAt,
                        ).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}.`
                      : ""}
                  </p>
                  <button
                    type="button"
                    disabled={syncRegistry.isPending}
                    onClick={() => syncRegistry.mutate()}
                    className="mt-2.5 rounded-full border border-[var(--accent)]/60 px-3.5 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
                  >
                    {registry.data.iAmRegistered
                      ? "Re-check server"
                      : "Register my username"}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed text-red-400" role="status">
                    Couldn&rsquo;t reach the server registry just
                    now — your ID still works in the app, and the app
                    keeps retrying.
                  </p>
                  <button
                    type="button"
                    disabled={syncRegistry.isPending}
                    onClick={() => {
                      autoSyncedForRef.current = null;
                      syncRegistry.mutate();
                      void registry.refetch();
                    }}
                    className="mt-2.5 rounded-full border border-[var(--accent)]/60 px-3.5 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
                  >
                    Try again
                  </button>
                </>
              )}
              {syncRegistry.isError ? (
                <p className="mt-1.5 text-xs text-red-400">
                  That registration didn&rsquo;t go through — try
                  again.
                </p>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <label
                htmlFor="collector-username"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Username
              </label>
              <p className="mt-0.5 text-xs text-[var(--dim)]">
                The name other collectors will know you by. Letters,
                numbers, and underscores, 3–20 characters.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5">
                  <span className="text-sm text-[var(--dim)]">@</span>
                  <input
                    id="collector-username"
                    type="text"
                    value={draftValue}
                    maxLength={20}
                    autoCapitalize="none"
                    autoCorrect="off"
                    onChange={(e) => setDraft(e.target.value)}
                    aria-invalid={!usernameValid}
                    className="w-full bg-transparent py-2 text-sm text-[var(--text)] focus:outline-none"
                  />
                </span>
                <button
                  type="button"
                  disabled={
                    !usernameValid ||
                    saveUsername.isPending ||
                    draftValue.trim() === data.username
                  }
                  onClick={() => saveUsername.mutate(draftValue.trim())}
                  className="shrink-0 rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  {saveUsername.isPending ? "Saving…" : "Save"}
                </button>
              </div>
              {draft != null && !usernameValid ? (
                <p className="mt-1.5 text-xs text-red-400">
                  Use 3–20 letters, numbers, or underscores.
                </p>
              ) : null}
              {saveUsername.isSuccess && draft == null ? (
                <p className="mt-1.5 text-xs text-emerald-400">
                  Username saved — the QR code now carries the new
                  name, and the server registry above updates to
                  match.
                </p>
              ) : null}
              {saveUsername.isError ? (
                <p className="mt-1.5 text-xs text-red-400">
                  That username didn&rsquo;t save — try again.
                </p>
              ) : null}

              <p className="mt-4 text-sm font-semibold text-[var(--text)]">
                Photo
              </p>
              <p className="mt-0.5 text-xs text-[var(--dim)]">
                A photo of your choice for the ID — you, your avatar,
                your favorite card, anything.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={savePhoto.isPending}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full border border-[var(--accent)]/60 px-3.5 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
                >
                  {savePhoto.isPending
                    ? "Saving photo…"
                    : data.photoUrl
                      ? "Change photo"
                      : "Choose a photo"}
                </button>
                {data.photoUrl ? (
                  <button
                    type="button"
                    disabled={removePhoto.isPending}
                    onClick={() => removePhoto.mutate()}
                    className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--dim)] disabled:opacity-50"
                  >
                    Remove photo
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Choose a photo for your collector ID"
                  onChange={(e) => {
                    onPhotoPicked(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              {photoError ? (
                <p className="mt-1.5 text-xs text-red-400">{photoError}</p>
              ) : null}
              {savePhoto.isSuccess ? (
                <p className="mt-1.5 text-xs text-emerald-400">Photo saved.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {profileOpen && data && onOpenCard && onOpenSealed ? (
        <OwnProfilePage
          username={data.username}
          collectorCode={data.collectorCode}
          photoUrl={data.photoUrl}
          bannerUrl={data.bannerUrl}
          payload={payload}
          onClose={closeProfile}
          onOpenCollectorId={closeProfile}
          onOpenCard={onOpenCard}
          onOpenSealed={onOpenSealed}
          onOpenBinderGroup={onOpenBinderGroup}
        />
      ) : null}
    </section>
  );
}

/** Home tab: started as a clean slate (Anthony's call, later Nov 2,
    2026, superseding the "collection at a glance" layout), and now
    building back up piece by piece as he decides what he wants here.
    Order (Anthony's call, later Nov 2, 2026): Your collections on
    top — the collection artworks (Lorcana / Pokémon / Magic: The
    Gathering / Lego / Comics), centered three across — no
    pockets-filled count, per his standing correction, and no
    wide banner above them (removed at his request, later Nov 2,
    2026 — he wants just the five collection tiles there). Underneath
    the collection images sit the total collection value and the
    Collection Distribution card directly underneath it, modeled on
    his Shiny screenshot — with proportional blue bars, computed
    live from his actual collection values.
    Total value (Anthony's call, Nov 2, 2026): the Home total is
    EVERYTHING across collections, not Lorcana alone — the Lorcana
    finance total ($4,418.05 at the Nov 1, 2026 export) PLUS his
    graded comics (COMICS_TOTAL_VALUE, $1,970 for the 8 slabs,
    checked Oct 29, 2026), for a combined $6,388.05 at those
    recorded values. The Distribution card breaks that grand total
    back out into Ungraded Cards (Lorcana finance total minus
    sealed), Sealed Products, and Graded Comics, so the three rows
    sum to the headline total. Collections with nothing cataloged
    yet (Pokémon, Magic, Lego, Star Wars Unlimited) contribute $0.
    Triggered price alerts sit at the very top as a
    deep-red oval banner (deeper, slightly dimmer red at his
    request). */
/** Owner-only mail indicator (Anthony, Nov 3, 2026): a
    little red envelope on Home, to the left of his name and
    picture, shown only while change-request tickets are
    waiting for him. The server returns tickets to the owner
    alone, so a non-empty list can only ever be his — nobody
    else ever sees this. Tapping it opens the ticket list in
    its own window (NOT Settings — his correction).
    Refinements (Anthony, Nov 3, 2026, later, after the test
    envelope reached him): ONLY the plain envelope icon —
    no red circle, border, or fill around it — sitting right
    up against his Collector ID pill, vertically centered on
    that line, with the count badge on the LEFT of the
    envelope. The badge counts OPEN tickets. One-time TEST:
    with no open tickets, the envelope also shows (badge 1)
    until he finishes the test ticket, so the flow can be
    tried end to end; real open tickets always take its
    place. */
function OwnerEnvelope({ onOpen }: { onOpen: () => void }) {
  const reqs = useQuery({
    queryKey: ["changeRequests"],
    queryFn: () => api.getChangeRequests({}),
    staleTime: 60_000,
  });
  const count = (reqs.data?.requests ?? []).filter(
    (r) => r.status === "open",
  ).length;
  const isTest =
    count === 0 &&
    reqs.data != null &&
    reqs.data.isOwner &&
    !reqs.data.envelopeTestSeen;
  if (count === 0 && !isTest) return null;
  return (
    <button
      type="button"
      onClick={() => {
        hapticTick();
        onOpen();
      }}
      aria-label={
        isTest
          ? "Test ticket — tap to open your change request tickets"
          : `${count} open change request ticket${count === 1 ? "" : "s"} — tap to open your tickets`
      }
      title={isTest ? "Test — change request tickets" : "Change request tickets"}
      className="relative flex h-11 w-9 shrink-0 items-center justify-center text-red-500 transition active:scale-95"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 drop-shadow-[0_2px_6px_rgba(239,68,68,0.45)]"
        aria-hidden="true"
      >
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
      <span className="absolute -left-1 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white">
        {isTest ? 1 : count}
      </span>
    </button>
  );
}

/** Inbox indicator (Anthony, Nov 3, 2026, ~2:02 AM; Inbox
    routing added later the same night): a reply inside a
    trade or purchase order must never land silently. An
    accent mail icon sits beside the Collector ID pill on
    Home, with the Inbox's unread count as a badge on the
    LEFT (mirroring the ticket envelope) whenever there is
    something new; tapping it opens the personal Inbox
    window. The icon itself always renders, so the Inbox can
    be opened to re-read old mail too — the red envelope
    next to it stays tickets-only. */
function OrderMailIndicator({ onOpen }: { onOpen: () => void }) {
  // The Inbox badge (Anthony, Nov 3, 2026): the count is the
  // Inbox's total unread — order messages plus, for the owner,
  // unread tickets — and tapping it opens the Inbox window.
  const mail = useQuery({
    queryKey: ["inbox"],
    queryFn: () => api.getInbox({}),
    refetchInterval: 15000,
  });
  const count = mail.data?.totalUnread ?? 0;
  // Always rendered: the Inbox must be openable even with
  // nothing unread (to re-read old orders); the badge only
  // appears when there is something new.
  return (
    <button
      type="button"
      onClick={() => {
        hapticTick();
        onOpen();
      }}
      aria-label={
        count > 0
          ? `${count} unread in your Inbox — tap to open your Inbox`
          : "Open your Inbox"
      }
      title="Your Inbox"
      className="relative flex h-11 w-9 shrink-0 items-center justify-center text-[var(--gold-soft)] transition active:scale-95"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 drop-shadow-[0_2px_6px_rgba(169,195,255,0.45)]"
        aria-hidden="true"
      >
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
      {count > 0 ? (
        <span className="absolute -left-1 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold tabular-nums text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

type InboxItemView = ApiResponse<typeof api, "getInbox">["items"][number];

/** The personal Inbox (Anthony, Nov 3, 2026): every order and
    — for the owner — every change-request ticket involving
    this collector, as one mail-style list: Subject, From,
    date, a short preview, and unread clearly marked. Opening
    an order item opens that order (its invoice view with the
    message thread); opening a ticket item opens that ticket.
    This is where order replies land — never silently inside
    Trades again. */
function InboxList({
  onOpenOrder,
  onOpenTicket,
}: {
  onOpenOrder: (kind: "cash" | "trade", refId: number) => void;
  onOpenTicket: (refId: number) => void;
}) {
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: ["inbox"],
    queryFn: () => api.getInbox({}),
    refetchInterval: 15000,
  });
  const items = inbox.data?.items ?? [];
  // Delete from the Inbox (Anthony, Nov 3, 2026): per-user,
  // like deleting an email — the order/trade/ticket itself
  // is untouched, and a new message in the thread brings the
  // item back. Two-step: the trash tap arms a confirm on
  // that row.
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const deleteItem = useMutation({
    mutationFn: (item: InboxItemView) =>
      api.deleteInboxItem({ kind: item.kind, refId: item.refId }),
    onSuccess: () => {
      setConfirmKey(null);
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
  const statusLabel = (item: InboxItemView) =>
    item.kind === "ticket"
      ? item.status === "in_progress"
        ? "In Progress"
        : item.status === "completed"
          ? "Completed"
          : "Open"
      : item.status === "pending"
        ? "Pending"
        : item.status === "accepted"
          ? "Accepted"
          : item.status === "declined"
            ? "Declined"
            : "Withdrawn";
  return (
    <section aria-label="Your Inbox" className="mt-4">
      {inbox.isLoading ? (
        <p className="text-sm text-[var(--dim)]">Loading your Inbox…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed text-[var(--dim)]">
          Nothing here yet. When a purchase order or trade offer
          involves you — and, for the owner, when a change-request
          ticket comes in — it lands in this Inbox.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4">
          {items.map((item) => {
            const unread = item.unreadCount > 0;
            return (
              <li key={item.key} className="flex items-start">
                <button
                  type="button"
                  onClick={() => {
                    hapticTick();
                    if (item.kind === "ticket") {
                      onOpenTicket(item.refId);
                    } else {
                      onOpenOrder(item.kind, item.refId);
                    }
                  }}
                  aria-label={`${item.subject} from ${item.fromUsername}${unread ? `, ${item.unreadCount} unread` : ""} — tap to open`}
                  className="flex min-w-0 flex-1 items-start gap-2.5 py-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      unread ? "bg-[var(--accent)]" : "bg-transparent"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={`text-sm text-[var(--text)] ${
                          unread ? "font-bold" : "font-semibold"
                        }`}
                      >
                        {item.subject}
                      </span>
                      <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--dim)]">
                        {statusLabel(item)}
                      </span>
                      <span className="ml-auto text-xs text-[var(--dim)]">
                        {new Date(item.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--dim)]">
                      From @{item.fromUsername}
                      {unread
                        ? item.kind === "ticket"
                          ? " · Unread"
                          : ` · ${item.unreadCount} new message${item.unreadCount === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-sm ${
                        unread
                          ? "text-[var(--text)]"
                          : "text-[var(--dim)]"
                      }`}
                    >
                      {item.preview}
                    </span>
                  </span>
                </button>
                {confirmKey === item.key ? (
                  <span className="flex shrink-0 flex-col items-end gap-1.5 py-3 pl-1">
                    <button
                      type="button"
                      disabled={deleteItem.isPending}
                      onClick={() => deleteItem.mutate(item)}
                      className="rounded-full border border-red-400/60 px-3 py-1.5 text-xs font-bold text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmKey(null)}
                      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--dim)]"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      hapticTick();
                      setConfirmKey(item.key);
                    }}
                    aria-label={`Delete this ${item.subject} from your Inbox`}
                    className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--dim)]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-[18px] w-[18px]"
                      aria-hidden="true"
                    >
                      <path d="M4 7h16" />
                      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
                      <path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The standalone mail view (Anthony, Nov 3, 2026, ~2:37 AM):
    one message from the Inbox, opened as its OWN page — never
    routed through or rendered inside Social/Trades. The order
    card itself (the same component the Trades area renders,
    in its single-item mode) carries the Subject/From header,
    the invoice, the actions, and the message thread with its
    reply box. The X at the top closes back to the Inbox list,
    which stays open underneath. */
const WELCOME_GETTING_STARTED = [
  "Set up your profile and Collector ID — that's how other collectors know you.",
  "Add your collection — scan cards, pick them from the catalog, or bring a collection file.",
  "Connect with friends by scanning their Collector ID.",
  "Browse, trade, and track what your collection is worth.",
];

const WELCOME_TOUR_PAGES = [
  {
    title: "Home and your Collector ID",
    body: "Home is where you land. Your Collector ID — your username and your code — sits at the top with your collection's value at a glance. Friends scan your ID's QR code to connect with you.",
  },
  {
    title: "Your binder",
    body: "The Binder holds every Lorcana set, pocket by pocket, regular and foil side by side. Cards you own show their real artwork; the ones you're missing sit ghosted, waiting. Tap any card to see its value, its price history, and where it lives.",
  },
  {
    title: "Search and scan",
    body: "The Search tab finds any card by name — add its number to narrow to the exact printing. You can also scan a card with your camera to jump straight to it.",
  },
  {
    title: "Sealed products",
    body: "The Sealed shelf keeps your unopened boxes, troves, and packs in their acrylic cases, each with its own value and history.",
  },
  {
    title: "Friends, trades, and your Inbox",
    body: "Under Social you'll find your friends and their collections. Propose trades, buy for cash, and message inside the order itself — every order and reply lands in your Inbox, the mail icon by your name on Home. There are no push notifications: new mail waits for you when you open the app.",
  },
  {
    title: "Portfolio",
    body: "Portfolio tracks your collection's value over time — what you paid, what it's worth now, and your most valuable items.",
  },
  {
    title: "Settings and tickets",
    body: "Settings holds your theme, your trade availability, your payment info, and — if something looks wrong or you have an idea — Send a change request opens a ticket you can follow while it's worked on.",
  },
];

/** The one-time Welcome page (Anthony, Nov 3, 2026): the first
    thing a new user sees. It is also registration — a brand-new
    user chooses their username right here, it becomes their
    registered name on the network, their Collector ID is
    created from it, and then the tour is FORCED: no skip, no
    "later", step by step to Home. An established profile sees
    the returning form once — welcome, getting-started path,
    Get started — dismissible, no registration, no tour. The
    Settings > About re-open ("review") is the returning form
    with a plain close. */
function WelcomeFlow({
  review,
  onClose,
}: {
  review: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const welcome = useQuery({
    queryKey: ["welcomeState"],
    queryFn: () => api.getWelcomeState({}),
  });
  const mode = review
    ? "returning"
    : (welcome.data?.mode ?? "returning");
  const isRegister = mode === "register";
  const [phase, setPhase] = useState<"welcome" | "id" | "tour">(
    "welcome",
  );
  const [tourIndex, setTourIndex] = useState(0);
  const [username, setUsername] = useState("");
  const nameCheck = useQuery({
    queryKey: ["usernameCheck", username.trim()],
    queryFn: () => api.checkUsername({ username: username.trim() }),
    enabled: isRegister && username.trim().length >= 3,
  });
  const syncRegistry = useMutation({
    mutationFn: () => api.syncCollectorRegistry({}),
  });
  const register = useMutation({
    mutationFn: () => api.registerCollector({ username: username.trim() }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        syncRegistry.mutate();
        setPhase("id");
      }
    },
  });
  const finish = useMutation({
    mutationFn: () => api.completeWelcome({}),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
  });
  const dismiss = () => {
    if (review) {
      onClose();
    } else {
      finish.mutate();
    }
  };
  const checkState = nameCheck.data;
  const nameProblem =
    username.trim().length === 0
      ? null
      : username.trim().length < 3
        ? "Usernames are 3–20 letters, numbers, or underscores."
        : checkState && !checkState.valid
          ? "Usernames are 3–20 letters, numbers, or underscores."
          : checkState && !checkState.available
            ? "That username is already taken on the network."
            : null;
  const nameOk =
    isRegister &&
    username.trim().length >= 3 &&
    checkState != null &&
    checkState.valid &&
    checkState.available;
  const registerError =
    register.data && !register.data.ok
      ? register.data.error
      : register.isError
        ? "That registration didn't go through — try again."
        : null;
  const tourPage = WELCOME_TOUR_PAGES[tourIndex];
  return (
    <div
      className="app-shell fixed inset-0 z-[100] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Vault X"
    >
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 pt-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {!isRegister ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                hapticTick();
                dismiss();
              }}
              aria-label="Close the welcome page"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg leading-none text-[var(--text)]"
            >
              ✕
            </button>
          </div>
        ) : null}
        {phase === "welcome" ? (
          <>
            <div className="welcome-reveal flex flex-col items-center text-center">
              <img
                src={vaultXRingArtwork}
                alt="Vault X ring artwork"
                className="h-28 w-28 rounded-3xl border border-[var(--border)] object-cover"
              />
              <h2 className="font-album mt-5 text-3xl font-bold text-[var(--text)]">
                Welcome to Vault X
              </h2>
              <p className="mt-2 max-w-md text-base leading-relaxed text-[var(--dim)]">
                Your collection, kept like it matters — every card
                in its pocket, every sealed box on its shelf, and
                the friends you trade with a scan away.
              </p>
            </div>
            <ol className="mt-7 space-y-2.5">
              {WELCOME_GETTING_STARTED.map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-bold text-[var(--gold-soft)]"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-[var(--text)]">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            {isRegister ? (
              <div className="mt-7">
                <label
                  htmlFor="welcome-username"
                  className="block text-base font-semibold text-[var(--text)]"
                >
                  Choose your username
                </label>
                <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                  This becomes your registered name on the network
                  — it's how friends find you, and it goes on your
                  Collector ID.
                </p>
                <input
                  id="welcome-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  autoComplete="off"
                  autoCapitalize="off"
                  placeholder="e.g. ARUIKIS"
                  className="mt-2.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-base text-[var(--text)] placeholder:text-[var(--dim)]"
                />
                {nameProblem ? (
                  <p role="alert" className="mt-2 text-sm text-red-400">
                    {nameProblem}
                  </p>
                ) : nameOk ? (
                  <p className="mt-2 text-sm text-emerald-300">
                    {checkState && !checkState.reachable
                      ? "That name looks good — the network check couldn't be reached just now, so it'll be confirmed as you register."
                      : "That username is available."}
                  </p>
                ) : null}
                {registerError ? (
                  <p role="alert" className="mt-2 text-sm text-red-400">
                    {registerError}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={!nameOk || register.isPending}
                  onClick={() => register.mutate()}
                  className="mt-4 w-full rounded-full bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
                >
                  {register.isPending
                    ? "Registering…"
                    : "Register and continue"}
                </button>
                <p className="mt-3 text-center text-sm leading-relaxed text-[var(--dim)]">
                  Next comes your Collector ID — and then the
                  tour. The tour isn't optional: it walks you
                  through the whole app, step by step, so you
                  start out knowing your way around.
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={finish.isPending}
                onClick={() => dismiss()}
                className="mt-7 w-full rounded-full bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
              >
                Get started
              </button>
            )}
          </>
        ) : null}
        {phase === "id" ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
              You're registered
            </p>
            <h2 className="font-album mt-2 text-2xl font-bold text-[var(--text)]">
              Your Collector ID
            </h2>
            <div className="mt-5 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-xl font-bold text-[var(--text)]">
                @{register.data?.username ?? username.trim()}
              </p>
              <p className="mt-1 text-base tabular-nums text-[var(--gold-soft)]">
                {register.data?.collectorCode ??
                  welcome.data?.collectorCode ??
                  ""}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
                This ID is yours for good. Friends scan its QR
                code from your Home page to connect with you.
              </p>
            </div>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--text)]">
              Now — take the tour. It only takes a minute, and
              it's the difference between wandering the app and
              knowing it. There's no skipping it: step by step,
              then you're in.
            </p>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setTourIndex(0);
                setPhase("tour");
              }}
              className="mt-5 w-full rounded-full bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--on-accent)]"
            >
              Start the tour
            </button>
          </div>
        ) : null}
        {phase === "tour" && tourPage ? (
          <div className="flex flex-1 flex-col">
            <p className="text-sm font-medium text-[var(--dim)]">
              Tour · Step {tourIndex + 1} of {WELCOME_TOUR_PAGES.length}
            </p>
            <div
              className="mt-2 flex gap-1.5"
              aria-hidden="true"
            >
              {WELCOME_TOUR_PAGES.map((p, i) => (
                <span
                  key={p.title}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= tourIndex
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>
            <div className="mt-6 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="font-album text-xl font-bold text-[var(--text)]">
                {tourPage.title}
              </h3>
              <p className="mt-2.5 text-base leading-relaxed text-[var(--dim)]">
                {tourPage.body}
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              {tourIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticTick();
                    setTourIndex(tourIndex - 1);
                  }}
                  className="rounded-full border border-[var(--border)] px-5 py-3.5 text-base font-semibold text-[var(--text)]"
                >
                  Back
                </button>
              ) : null}
              {tourIndex < WELCOME_TOUR_PAGES.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticTick();
                    setTourIndex(tourIndex + 1);
                  }}
                  className="flex-1 rounded-full bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--on-accent)]"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  disabled={finish.isPending}
                  onClick={() => finish.mutate()}
                  className="flex-1 rounded-full bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
                >
                  {finish.isPending ? "One moment…" : "Enter Vault X"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MailMessageView({
  kind,
  id,
  nonce,
  onClose,
  onOpenCard,
}: {
  kind: "cash" | "trade";
  id: number;
  nonce: number;
  onClose: () => void;
  onOpenCard: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  // Delete from the Inbox (Anthony, Nov 3, 2026): the trash
  // sits next to the X; one confirm step, then the item is
  // out of YOUR Inbox only — the order itself is untouched
  // and a new message in the thread brings it back.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteItem = useMutation({
    mutationFn: () => api.deleteInboxItem({ kind, refId: id }),
    onSuccess: (res) => {
      if (res.ok) {
        void queryClient.invalidateQueries({ queryKey: ["inbox"] });
        onClose();
      }
    },
  });
  return (
    <div
      className="app-shell fixed inset-0 z-[95] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={
        kind === "cash" ? "Purchase order message" : "Trade offer message"
      }
    >
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-album text-xl text-[var(--text)]">
            {kind === "cash" ? "Purchase Order" : "Trade Offer"}
          </h2>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setConfirmDelete(true);
              }}
              aria-label="Delete this message from your Inbox"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 7h16" />
                <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
                <path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                onClose();
              }}
              aria-label="Close this message and return to the Inbox"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg leading-none text-[var(--text)]"
            >
              ✕
            </button>
          </span>
        </div>
        {confirmDelete ? (
          <div
            role="alertdialog"
            aria-label="Delete this message from your Inbox?"
            className="mt-3 rounded-2xl border border-red-400/40 bg-[var(--surface)] p-4"
          >
            <p className="text-sm leading-relaxed text-[var(--text)]">
              Delete this from your Inbox? The order itself
              stays exactly as it is — this only removes it from
              your Inbox, and if they message in this order
              again, it comes back with the new message.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={deleteItem.isPending}
                onClick={() => deleteItem.mutate()}
                className="rounded-full border border-red-400/60 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
              >
                {deleteItem.isPending ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
              >
                Keep it
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-3">
          {kind === "cash" ? (
            <CashPurchasesSection
              onlyPurchaseId={id}
              focusDeal={{ kind: "cash", id, nonce }}
            />
          ) : (
            <TradesPanel
              onlyTradeId={id}
              focusDeal={{ kind: "trade", id, nonce }}
              onOpenCard={onOpenCard}
              wantPick={null}
              onWantConsumed={() => {}}
              tradeCart={[]}
              cashCart={[]}
              onAddTrade={() => {}}
              onAddCash={() => {}}
              onSetTradeCart={() => {}}
              onSetCashCart={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function HomePanel({
  value,
  sealedValue,
  onOpenBinder,
  onOpenComics,
  onOpenLego,
  onOpenCard,
  onOpenSealed,
  onOpenBinderGroup,
  onOpenMarketplace,
  updateAvailable,
  onOpenUpdate,
  onOpenUpdateTest,
  onOpenChangeRequests,
  onOpenOrderMail,
}: {
  value: number | null;
  sealedValue: number | null;
  onOpenBinder: () => void;
  onOpenComics: () => void;
  onOpenLego: () => void;
  onOpenCard: (cardId: number) => void;
  onOpenSealed: (name: string) => void;
  onOpenBinderGroup: (key: string) => void;
  onOpenMarketplace: () => void;
  updateAvailable?: boolean;
  onOpenUpdate?: () => void;
  onOpenUpdateTest?: () => void;
  onOpenChangeRequests?: () => void;
  onOpenOrderMail?: () => void;
}) {
  // Hidden "Your Collections" tiles (Anthony, Nov 3, 2026):
  // the user's Settings switches — a hidden tile simply
  // isn't rendered and the rest reflow, still centered
  // three across. Display-only.
  const collectionVisibility = useQuery({
    queryKey: ["collectionVisibility"],
    queryFn: () => api.getCollectionVisibility({}),
  });
  const hiddenTiles = new Set(
    collectionVisibility.data?.hidden ?? [],
  );
  // Triggered price alerts show here first, in translucent red —
  // Anthony's design for the alerts feature.
  const priceAlerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const triggeredAlerts = (priceAlerts.data?.alerts ?? []).filter(
    (a) => a.triggered,
  );
  // Example price-alert banner (Anthony, Nov 2, 2026): a user who
  // has never created a price alert sees ONE example of the red
  // banner on Home, clearly labeled as an example, so they know
  // what a price alert looks like before they ever use one.
  // Tapping it opens a short explanation with a Got it button;
  // dismissing there removes the example for good (remembered on
  // their profile) — and once they have a real alert of their own
  // the example never shows anyway. Users WITH alerts (like
  // Anthony's booster-box alert) never see the example at all.
  const queryClient = useQueryClient();
  const [exampleOpen, setExampleOpen] = useState(false);
  // Marketplace held from release: Home's doorway stays in place,
  // stamped Coming soon, and tapping it explains the hold instead
  // of opening the Marketplace.
  const [marketplaceHeldOpen, setMarketplaceHeldOpen] = useState(false);
  const showExampleAlert =
    priceAlerts.data != null &&
    priceAlerts.data.alerts.length === 0 &&
    !priceAlerts.data.exampleDismissed;
  const dismissExampleAlert = async () => {
    setExampleOpen(false);
    try {
      await api.dismissExampleAlert({});
    } catch {
      // The dismissal is also reflected when the query refetches;
      // a failed write just means the example may reappear next
      // open — never an error worth showing.
    }
    void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
  };
  const comicsValue = COMICS_TOTAL_VALUE;
  const totalValue = value != null ? value + comicsValue : null;
  const ungraded =
    value != null && sealedValue != null ? value - sealedValue : null;
  const pctOf = (part: number) =>
    totalValue != null && totalValue > 0 ? (part / totalValue) * 100 : 0;
  const distRows =
    totalValue != null && sealedValue != null && ungraded != null
      ? [
          { label: "Ungraded Cards", amount: ungraded },
          { label: "Sealed Products", amount: sealedValue },
          { label: "Graded Comics", amount: comicsValue },
        ]
      : [];
  return (
    <div className="mt-4">
      {/* Home header REMOVED (Anthony, Nov 2, 2026, late): the
          small centered Vault X ring + "Vault X" label that sat
          here duplicated the app name the shell already shows
          directly above the page — he circled the whole band in
          red on his screenshot as redundant area to clean up,
          ring, duplicate name, and the blank space around them.
          Home now opens straight into its content: the Collector
          ID pill below is the first thing on the page. The ring
          artwork itself still lives in Settings → About this
          app, where he approved it. */}
      {/* The oval Collector ID sits at the very top of Home
          (Anthony's request) — above even the price-alert banners. */}
      <CollectorIdCard
        onOpenCard={onOpenCard}
        onOpenSealed={onOpenSealed}
        onOpenBinderGroup={onOpenBinderGroup}
        updateAvailable={updateAvailable}
        onOpenUpdate={onOpenUpdate}
        onOpenUpdateTest={onOpenUpdateTest}
        envelope={
          onOpenChangeRequests ? (
            <OwnerEnvelope onOpen={onOpenChangeRequests} />
          ) : undefined
        }
        orderMail={
          onOpenOrderMail ? (
            <OrderMailIndicator onOpen={onOpenOrderMail} />
          ) : undefined
        }
      />
      {triggeredAlerts.map((a) => (
        <button
          key={a.id}
          type="button"
          role="alert"
          onClick={() => {
            if (a.targetKind === "card" && a.cardId != null) {
              onOpenCard(a.cardId);
            } else if (a.targetKind === "sealed" && a.sealedName) {
              onOpenSealed(a.sealedName);
            }
          }}
          className="mb-3 block w-full rounded-full border border-red-800/60 bg-red-900/30 px-6 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-red-100">
            Price alert
            <span aria-hidden="true" className="text-red-100">
              ›
            </span>
          </p>
          <p className="mt-0.5 text-sm leading-snug text-red-100/90">
            {a.label} is now{" "}
            {a.currentValue != null ? fmtUSD(a.currentValue) : "—"} — your
            alert was {a.direction === "below" ? "at or below" : "at or above"}{" "}
            {fmtUSD(a.threshold)}. Tap to open it.
          </p>
        </button>
      ))}
      {showExampleAlert ? (
        <button
          type="button"
          onClick={() => setExampleOpen(true)}
          aria-label="Example price alert — tap to learn how price alerts work"
          className="mb-3 block w-full rounded-full border border-red-800/60 bg-red-900/30 px-6 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-red-100">
            Price alert
            <span className="rounded-full border border-red-200/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-100">
              Example
            </span>
            <span aria-hidden="true" className="text-red-100">
              ›
            </span>
          </p>
          <p className="mt-0.5 text-sm leading-snug text-red-100/90">
            This is an example alert. When an item you&rsquo;re
            watching reaches your price, a banner like this one
            appears here. Tap to see how it works.
          </p>
        </button>
      ) : null}
      {exampleOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="How price alerts work"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-album text-lg text-[var(--text)]">
                Price alerts
              </h2>
              <button
                type="button"
                onClick={() => void dismissExampleAlert()}
                aria-label="Close and dismiss the example"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[var(--dim)] ring-1 ring-white/15"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
              A price alert watches an item&rsquo;s price for you, so
              you don&rsquo;t have to keep checking it yourself.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--dim)]">
              <li>
                Open any card or sealed product, then tap{" "}
                <span className="font-semibold text-[var(--text)]">
                  Price Alert
                </span>{" "}
                on its page.
              </li>
              <li>
                Pick your price — at or below it, or at or above it.
              </li>
              <li>
                When the item reaches your price, the red banner
                appears at the top of Home, just like the example.
                Tap the banner to jump straight to that item.
              </li>
            </ul>
            <button
              type="button"
              onClick={() => void dismissExampleAlert()}
              className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)]"
            >
              Got it
            </button>
            <p className="mt-2 text-center text-xs leading-relaxed text-[var(--dim)]">
              The example banner won&rsquo;t come back. Your own
              alerts will show here when they trigger.
            </p>
          </div>
        </div>
      ) : null}
      <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
        Home
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
        This is your home area — a clean slate for now. We&rsquo;ll build
        it out together once you decide what you want here.
      </p>
      {/* Your collections — just the rich collection artworks,
          centered three across, wrapping to a new centered row of
          three as collections are added (his standing layout rule).
          The wide Lorcana banner that sat above them was removed
          at his request (later Nov 2, 2026). Row one: Lorcana (live — its tile
          opens the binder, labeled just "Lorcana", no pockets
          count per his correction), Pokémon and Magic: The
          Gathering (dashed tiles labeled "Coming soon" — he will
          add those cards later). Row two starts with Lego (a
          "Coming soon" placeholder tile like Pokémon/Magic — the
          wider collectibles expansion itself is parked; Funko
          Pops has no tile), then Comics: his 8 graded comics are
          cataloged from his graded comics binder, so its tile is
          live like Lorcana's — it opens the Comics section (built
          the same way as the Lorcana section) and is labeled just
          "Comics" (Anthony had the "8 graded comics" line under it
          removed, Nov 2, 2026).
          The app is now "Vault X" (his rename) because it
          brings all his collectibles together, not only cards. */}
      <section aria-label="Your Collections" className="mt-6">
        {/* The grand total rides on the SAME line as the
            "Your Collections" heading, offset to the right
            (Anthony, Nov 3, 2026) — label and total only; the
            per-collection breakdown lines that used to sit
            under the total are deleted from Home. */}
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-album text-lg text-[var(--text)]">
            Your Collections
          </h2>
          {totalValue != null ? (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                Collection value
              </p>
              <p className="font-album text-xl font-bold leading-tight text-[var(--gold-soft)]">
                {fmtUSD(totalValue)}
              </p>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {!hiddenTiles.has("lorcana") ? (
          <button
            type="button"
            onClick={onOpenBinder}
            aria-label="Open your Lorcana binder"
            className="block w-[calc((100%-1.5rem)/3)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <img
              src={collectionLorcana}
              alt="Lorcana collection artwork: a golden ink pot spilling blue and violet ink around floating illustrated cards"
              loading="lazy"
              className="block aspect-square w-full object-cover"
            />
            <span className="block px-1 py-2 text-center text-xs font-semibold text-[var(--text)] sm:text-sm">
              Lorcana
            </span>
          </button>
          ) : null}
          {!hiddenTiles.has("pokemon") ? (
          <div
            aria-label="Pokémon collection, coming soon"
            className="w-[calc((100%-1.5rem)/3)] overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]"
          >
            <img
              src={collectionPokemon}
              alt="Pokémon collection artwork: a glossy red-and-white capture ball in tall grass at sunset with fireflies"
              loading="lazy"
              className="block aspect-square w-full object-cover"
            />
            <span className="block px-1 py-2 text-center">
              <span className="block text-xs font-semibold text-[var(--text)] sm:text-sm">
                Pokémon
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#ffb020]">
                Coming soon
              </span>
            </span>
          </div>
          ) : null}
          {!hiddenTiles.has("magic") ? (
          <div
            aria-label="Magic: The Gathering collection, coming soon"
            className="w-[calc((100%-1.5rem)/3)] overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]"
          >
            <img
              src={collectionMagic}
              alt="Magic: The Gathering collection artwork: a flame vortex over a rune-carved stone altar in a dark arcane landscape"
              loading="lazy"
              className="block aspect-square w-full object-cover"
            />
            <span className="block px-1 py-2 text-center">
              <span className="block text-xs font-semibold leading-tight text-[var(--text)] sm:text-sm">
                Magic: The Gathering
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#ffb020]">
                Coming soon
              </span>
            </span>
          </div>
          ) : null}
          {!hiddenTiles.has("lego") ? (
          <button
            type="button"
            onClick={onOpenLego}
            aria-label="Open your Lego section"
            className="block w-[calc((100%-1.5rem)/3)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <img
              src={collectionLego}
              alt="Lego collection artwork: colorful interlocking building bricks with a small brick castle tower and house under a starry sky"
              loading="lazy"
              className="block aspect-square w-full object-cover"
            />
            <span className="block px-1 py-2 text-center">
              <span className="block text-xs font-semibold text-[var(--text)] sm:text-sm">
                Lego
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#ffb020]">
                Coming soon
              </span>
            </span>
          </button>
          ) : null}
          {!hiddenTiles.has("comics") ? (
          <button
            type="button"
            onClick={onOpenComics}
            aria-label="Open your Comics collection"
            className="block w-[calc((100%-1.5rem)/3)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <img
              src={collectionComics}
              alt="Comics collection artwork: graded comic books in clear display slabs with bold caped-superhero cover art"
              loading="lazy"
              className="block aspect-square w-full object-cover"
            />
            <span className="block px-1 py-2 text-center text-xs font-semibold text-[var(--text)] sm:text-sm">
              Comics
            </span>
          </button>
          ) : null}
          {!hiddenTiles.has("starwars") ? (
          <div
            aria-label="Star Wars Unlimited collection, coming soon"
            className="w-[calc((100%-1.5rem)/3)] overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]"
          >
            <img
              src={collectionStarwars}
              alt="Star Wars Unlimited collection artwork: starfighters in a deep-space battle over a glowing planet, laser fire and a space station"
              loading="lazy"
              className="block aspect-square w-full object-cover"
            />
            <span className="block px-1 py-2 text-center">
              <span className="block text-xs font-semibold leading-tight text-[var(--text)] sm:text-sm">
                Star Wars Unlimited
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#ffb020]">
                Coming soon
              </span>
            </span>
          </div>
          ) : null}
        </div>
      </section>

      {distRows.length > 0 ? (
        <div className="relative mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
              >
                <ellipse cx="9" cy="6" rx="6" ry="3" />
                <path d="M3 6v6c0 1.66 2.69 3 6 3 1.1 0 2.13-.15 3-.41" />
                <path d="M3 12c0 1.66 2.69 3 6 3" />
                <path d="M15.5 11.5c1.9.4 3.5 1.3 3.5 2.5 0 1.66-3.13 3-7 3-1 0-1.95-.08-2.8-.24" />
                <path d="M21 14v4c0 1.66-3.13 3-7 3-3.87 0-7-1.34-7-3" />
              </svg>
              Collection Distribution
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {distRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-[var(--text)]">
                    {row.label}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-[var(--text)]">
                    {pctOf(row.amount).toFixed(2)}% • {fmtUSD(row.amount)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--border)]"
                  role="progressbar"
                  aria-valuenow={Math.round(pctOf(row.amount))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.label}: ${pctOf(row.amount).toFixed(2)}% of collection value`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${pctOf(row.amount)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Marketplace entry (Anthony, Nov 2, 2026): the marketplace
          lives in Social; this is Home's doorway into it. Held
          from release (later Nov 2, 2026): the doorway stays right
          here, stamped Coming soon in yellow, and tapping it while
          the hold is on explains that the Marketplace is not open
          yet instead of opening it. Stamp placement (Anthony's
          FINAL call, after the update landed): an oval yellow pill
          on the SAME LINE as the Marketplace label — translucent
          and toned down so it is visible without shouting — and
          the description line underneath stays plain. */}
      <button
        type="button"
        onClick={
          MARKETPLACE_AVAILABLE
            ? onOpenMarketplace
            : () => setMarketplaceHeldOpen(true)
        }
        aria-label={
          MARKETPLACE_AVAILABLE
            ? "Open the Marketplace"
            : "Marketplace, coming soon — tap to learn more"
        }
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--gold-soft)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M4 7 5.5 3h13L20 7" />
            <path d="M4 7h16v3a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0A2.5 2.5 0 0 1 4 10Z" />
            <path d="M5.5 12.5V21h13v-8.5" />
            <path d="M9.5 21v-5h5v5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="block text-base font-semibold text-[var(--text)]">
              Marketplace
            </span>
            {MARKETPLACE_AVAILABLE ? null : (
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#ffd21f]/35 bg-[#ffd21f]/15 px-2.5 py-[3px] text-[10px] font-black uppercase leading-none tracking-[0.14em] text-[#ffd21f]/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.45)]"
              >
                Coming soon
              </span>
            )}
          </span>
          <span className="block text-xs leading-relaxed text-[var(--dim)]">
            Buy and sell cards, sealed products, and comics with other
            collectors
            {MARKETPLACE_AVAILABLE ? null : " — not open yet"}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-[var(--dim)]">
          ›
        </span>
      </button>
      {marketplaceHeldOpen && !MARKETPLACE_AVAILABLE ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Marketplace coming soon"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-album text-lg text-[var(--text)]">
                Marketplace — coming soon
              </h2>
              <button
                type="button"
                onClick={() => setMarketplaceHeldOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[var(--dim)] ring-1 ring-white/15"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
              The Marketplace isn&rsquo;t open yet — it needs a
              little more thought before collectors can buy and sell
              in it. Its spot stays right here and in Social, marked
              Coming soon, and everything already listed stays saved
              underneath for when it opens.
            </p>
            <button
              type="button"
              onClick={() => setMarketplaceHeldOpen(false)}
              className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)]"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Missing-cards sheet for one section: every missing printing of
    the COMPLETE set (Enchanteds and Iconics included) with its
    current price and a direct TCGplayer link, the total cost to
    complete, and the one-click "Buy missing cards" handoff — which
    starts Jarvis's TCGplayer cart build under Anthony's rules; it is
    not an in-app checkout, and final payment approval stays his. */
function MissingSheet({
  groupKey,
  onClose,
}: {
  groupKey: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["setCompletion", groupKey],
    queryFn: () => api.getSetCompletion({ groupKey }),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const buy = useMutation({
    mutationFn: () => api.requestBuyList({ groupKey }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["setCompletion", groupKey],
      });
    },
  });
  const data = detail.data;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={
        data
          ? `Missing cards for ${data.groupName}`
          : "Missing cards"
      }
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close missing cards"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>
        {detail.isPending || !data ? (
          <p className="py-10 text-center text-sm text-[var(--dim)]">
            {detail.isError
              ? "The missing list couldn't load. Close and try again."
              : "Adding up what's missing…"}
          </p>
        ) : (
          <>
            <h2 className="font-album mt-4 text-[22px] font-bold leading-tight text-white">
              {data.groupName} — missing cards
            </h2>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {data.missingCount} missing
            </p>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                Cost to complete
              </p>
              <p className="font-album mt-1 text-3xl font-bold text-[var(--gold-soft)]">
                {fmtUSD(data.costToComplete)}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                The complete set — every printing and finish, Enchanteds
                and Iconics included. {data.priceNote}
                {data.unpricedMissing > 0
                  ? ` ${data.unpricedMissing} missing ${data.unpricedMissing === 1 ? "card has" : "cards have"} no tracked price yet and ${data.unpricedMissing === 1 ? "is" : "are"} not counted in the total.`
                  : ""}
              </p>
              {data.missingCount > 0 ? (
                <>
                  <button
                    type="button"
                    disabled={buy.isPending || buy.isSuccess}
                    onClick={() => buy.mutate()}
                    className="mt-3.5 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
                  >
                    {buy.isPending
                      ? "Handing the list to Jarvis…"
                      : buy.isSuccess && buy.data?.started
                        ? "Buy list handed off ✓"
                        : "Buy missing cards"}
                  </button>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                    {buy.isSuccess && buy.data?.started
                      ? "Jarvis is building the TCGplayer cart for this list (Near Mint, his shipping rules). Checkout and final payment approval stay yours, on TCGplayer."
                      : buy.isError
                        ? "The handoff didn't start — try again."
                        : "One tap hands this whole list to Jarvis, who builds the TCGplayer cart the usual way (Near Mint, no single-card package over $3 shipping). Nothing is bought in the app — checkout and final payment approval stay yours, on TCGplayer."}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm font-semibold text-emerald-400">
                  This set is complete — nothing missing.
                </p>
              )}
            </div>
            <ol className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
              {data.missing.map((m) => (
                <li
                  key={`${m.cardId}-${m.finishLabel}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--text)]">
                      {m.fullName}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      #{m.printed} · {m.finishLabel}
                      {m.rarity ? ` · ${m.rarity}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {m.price != null ? fmtUSD(m.price) : "—"}
                    </span>
                    {m.tcgplayerId ? (
                      <a
                        href={`https://www.tcgplayer.com/product/${m.tcgplayerId}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${m.fullName} ${m.finishLabel} on TCGplayer`}
                        className="rounded-full border border-[var(--accent)]/60 px-2.5 py-1 text-xs font-semibold text-[var(--gold-soft)]"
                      >
                        TCGplayer ↗
                      </a>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

/** Draws an image source onto a canvas capped at 1280px and returns
    the JPEG base64 (no data-URL prefix) for the identify action. */
function drawToJpegBase64(
  source: CanvasImageSource,
  w: number,
  h: number,
): string {
  const max = 1280;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Canvas unavailable");
  ctx2d.drawImage(source, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function imageFileToJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that photo"));
      el.src = url;
    });
    return drawToJpegBase64(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ScanMatch = ApiResponse<typeof api, "identifyCard">["matches"][number];

/** One identified card in the scan results: art, printing, ownership,
    a finish toggle (foil calls in a photo are a best guess — he can
    switch before adding), and an add-to-collection button using the
    same ownership update as the card detail. */
function ScanMatchRow({
  match,
  onAdded,
}: {
  match: ScanMatch;
  onAdded: (name: string, finish: string) => void;
}) {
  const { url } = useCachedArt(match.cardId, "grid", true);
  const [finish, setFinish] = useState(match.suggestedFinish);
  const [finishes, setFinishes] = useState(match.finishes);
  const [ownedQty, setOwnedQty] = useState(match.ownedQty);
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (next: Record<string, number>) =>
      api.updateOwnership({ cardId: match.cardId, finishes: next }),
    onSuccess: (data, next) => {
      setFinishes(next);
      setOwnedQty(data.ownedQty);
      onAdded(match.fullName, finish);
      void queryClient.invalidateQueries({ queryKey: ["binder"] });
      void queryClient.invalidateQueries({ queryKey: ["section"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      void queryClient.invalidateQueries({ queryKey: ["card", match.cardId] });
    },
  });
  const finishOptions =
    finish === "Regular"
      ? ["Regular", "Cold Foil"]
      : finish === "Cold Foil"
        ? ["Cold Foil", "Regular"]
        : [finish];
  const ownedLabels = Object.entries(finishes)
    .filter(([, q]) => q > 0)
    .map(([f, q]) => `${q} ${f}`)
    .join(" · ");
  return (
    <li className="flex gap-3 py-3">
      {url ? (
        <img
          src={url}
          alt=""
          className="h-20 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-1 text-center text-[9px] text-[var(--dim)]">
          {match.fullName}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text)]">
          {match.fullName}
        </p>
        <p className="text-xs text-[var(--dim)]">
          {match.groupName} · #{match.printed}
          {match.rarity ? ` · ${match.rarity}` : ""}
          {match.marketValue != null
            ? ` · ${fmtUSD(match.marketValue)}`
            : ""}
        </p>
        <p
          className={`mt-0.5 text-xs font-medium ${
            ownedQty > 0 ? "text-emerald-400" : "text-[var(--gold-soft)]"
          }`}
        >
          {ownedQty > 0
            ? `You own ${ownedQty}${ownedLabels ? ` (${ownedLabels})` : ""}`
            : "Not in your collection yet"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {finishOptions.length > 1 ? (
            <span
              className="flex rounded-full border border-[var(--border)] p-0.5"
              role="group"
              aria-label="Finish"
            >
              {finishOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={finish === f}
                  onClick={() => setFinish(f)}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    finish === f
                      ? "bg-[var(--gold)] font-bold text-black"
                      : "text-[var(--text)]"
                  }`}
                >
                  {f === "Cold Foil" ? "Foil" : f}
                </button>
              ))}
            </span>
          ) : (
            <span className="text-xs text-[var(--dim)]">{finish}</span>
          )}
          <button
            type="button"
            disabled={add.isPending}
            onClick={() =>
              add.mutate({
                ...finishes,
                [finish]: (finishes[finish] ?? 0) + 1,
              })
            }
            className="rounded-full bg-[var(--gold)] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
          >
            {add.isPending
              ? "Adding…"
              : add.isSuccess
                ? "Added — add another?"
                : `Add one ${finish === "Cold Foil" ? "foil" : finish.toLowerCase()}`}
          </button>
          {add.isError ? (
            <span className="text-xs text-red-400">
              That didn&rsquo;t save — try again.
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Camera scanning (Anthony's approved must-have): point the camera
    at a card — or a whole binder page — capture, and the photo is
    identified against the binder catalog. Live camera is used when
    the device allows it; the photo button (which opens the camera on
    his phone) always works. Scanning a stack is continuous: add or
    skip, then scan the next; a binder page photo identifies every
    readable card on it at once. */
function ScanPanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cameraState, setCameraState] = useState<
    "starting" | "live" | "unavailable"
  >("starting");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse<
    typeof api,
    "identifyCard"
  > | null>(null);
  const [sessionAdds, setSessionAdds] = useState<
    { name: string; finish: string }[]
  >([]);
  // Wrong-match recovery (Anthony, Nov 2, 2026, late — his fix
  // after a live scan test matched the wrong card): the result
  // screen carries its own catalog search, so when the scan
  // matched the wrong card (or none) he can type the card —
  // name, or name and number like the main Search — pick the
  // right printing, and add it from here.
  const [fixQuery, setFixQuery] = useState("");
  const fixSearch = useQuery({
    queryKey: ["searchCards", fixQuery.trim()],
    queryFn: () => api.searchCards({ query: fixQuery.trim() }),
    enabled: fixQuery.trim().length >= 2,
  });

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraState("unavailable");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraState("live");
      } catch {
        if (!cancelled) setCameraState("unavailable");
      }
    };
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const identify = useMutation({
    mutationFn: (imageBase64: string) => api.identifyCard({ imageBase64 }),
    onSuccess: (data) => {
      setResult(data);
      setScanning(false);
    },
    onError: () => {
      setScanError(
        "That photo couldn't be identified — try again with the card filling the frame.",
      );
      setScanning(false);
    },
  });

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    try {
      const b64 = drawToJpegBase64(video, video.videoWidth, video.videoHeight);
      setScanError(null);
      setScanning(true);
      identify.mutate(b64);
    } catch {
      setScanError("Couldn't grab that frame — try the photo button.");
    }
  };

  const onPhotoPicked = (file: File | undefined) => {
    if (!file) return;
    setScanError(null);
    setScanning(true);
    void imageFileToJpegBase64(file)
      .then((b64) => identify.mutate(b64))
      .catch(() => {
        setScanning(false);
        setScanError("That photo couldn't be read — try another.");
      });
  };

  const scanAnother = () => {
    setResult(null);
    setScanError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Scan a card"
    >
      <div className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-album pt-2 text-xl font-bold text-white">
            Scan a card
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          Point the camera at a card and capture — or photograph a whole
          binder page and every readable card is identified at once.
          Check the match and the finish before adding; foil calls from
          a photo are a best guess.
        </p>

        {result == null ? (
          <>
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`aspect-[3/4] w-full object-cover sm:aspect-[4/3] ${
                  cameraState === "live" ? "" : "hidden"
                }`}
              />
              {cameraState !== "live" ? (
                <div className="flex aspect-[3/4] w-full items-center justify-center px-6 text-center sm:aspect-[4/3]">
                  <p className="text-sm leading-relaxed text-[var(--dim)]">
                    {cameraState === "starting"
                      ? "Starting the camera…"
                      : "Live camera isn't available here — use the photo button below; on your phone it opens the camera."}
                  </p>
                </div>
              ) : null}
              {scanning ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <p className="text-sm font-semibold text-white">
                    Identifying…
                  </p>
                </div>
              ) : null}
            </div>
            {scanError ? (
              <p className="mt-2.5 text-sm text-red-400">{scanError}</p>
            ) : null}
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                disabled={cameraState !== "live" || scanning}
                onClick={captureFrame}
                className="flex-1 rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
              >
                Capture
              </button>
              <button
                type="button"
                disabled={scanning}
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
              >
                Use a photo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-label="Take or choose a photo of a card"
                onChange={(e) => {
                  onPhotoPicked(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        ) : (
          <>
            {result.binderPage ? (
              <p className="mt-3 text-sm font-medium text-[var(--gold-soft)]">
                Binder page — {result.matches.length}{" "}
                {result.matches.length === 1 ? "card" : "cards"} identified.
              </p>
            ) : null}
            {result.matches.length > 0 ? (
              <ol className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
                {result.matches.map((m) => (
                  <ScanMatchRow
                    key={m.cardId}
                    match={m}
                    onAdded={(name, finish) =>
                      setSessionAdds((prev) => [...prev, { name, finish }])
                    }
                  />
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--dim)]">
                No card in the binder matched that photo. Try again with
                the card filling the frame, straight-on, out of glare.
              </p>
            )}
            {result.unmatched.length > 0 ? (
              <p className="mt-2.5 text-xs leading-relaxed text-[var(--dim)]">
                Read but not matched in the binder:{" "}
                {result.unmatched.join(", ")}.
              </p>
            ) : null}
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
              <h3 className="font-album text-base text-[var(--text)]">
                Wrong card — or no match?
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                If the scan matched the wrong card, search the
                catalog yourself and add the right one from here —
                type the name, or the name and its number (like
                Ariel 137).
              </p>
              <input
                type="text"
                value={fixQuery}
                onChange={(e) => setFixQuery(e.target.value)}
                placeholder="Search by name or name + number…"
                aria-label="Search the catalog for the right card"
                className="mt-2.5 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
              />
              {fixQuery.trim().length >= 2 ? (
                fixSearch.isPending ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    Searching…
                  </p>
                ) : (fixSearch.data?.results ?? []).length > 0 ? (
                  <ol className="mt-1 divide-y divide-[var(--border)]">
                    {(fixSearch.data?.results ?? [])
                      .slice(0, 8)
                      .map((r) => (
                        <ScanMatchRow
                          key={r.cardId}
                          match={{
                            cardId: r.cardId,
                            fullName: r.fullName,
                            groupName: r.groupName,
                            groupKey: r.groupKey,
                            printed: r.printed,
                            rarity: r.rarity,
                            ownedQty: r.ownedQty,
                            finishes: r.finishes,
                            marketValue: r.marketValue,
                            suggestedFinish: r.suggestedFinish,
                          }}
                          onAdded={(name, finish) =>
                            setSessionAdds((prev) => [
                              ...prev,
                              { name, finish },
                            ])
                          }
                        />
                      ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-[var(--dim)]">
                    No catalog card matches that — check the name
                    or the number and try again.
                  </p>
                )
              ) : null}
            </div>
            <button
              type="button"
              onClick={scanAnother}
              className="mt-3.5 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black"
            >
              Scan another
            </button>
          </>
        )}

        {sessionAdds.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
              Added this session
            </p>
            <ul className="mt-1.5 space-y-1">
              {sessionAdds.map((s, i) => (
                <li key={i} className="text-sm text-[var(--text)]">
                  <span className="text-emerald-400">✓</span> {s.name}{" "}
                  <span className="text-[var(--dim)]">({s.finish})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Price alert setter for an item's detail view (Anthony's design:
    the alert lives on the card/item itself — no separate alerts
    section; when a threshold is met, Home shows it in translucent
    red). v1: set one or more thresholds per item, delete them here. */
function PriceAlertBox({
  targetKind,
  cardId,
  sealedName,
  currentValue,
}: {
  targetKind: "card" | "sealed";
  cardId: number | null;
  sealedName: string | null;
  currentValue: number | null;
}) {
  const queryClient = useQueryClient();
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [threshold, setThreshold] = useState<string>(
    currentValue != null ? currentValue.toFixed(2) : "",
  );
  const mine = (alerts.data?.alerts ?? []).filter((a) =>
    targetKind === "card"
      ? a.targetKind === "card" && a.cardId === cardId
      : a.targetKind === "sealed" && a.sealedName === sealedName,
  );
  const setAlert = useMutation({
    mutationFn: () =>
      api.setPriceAlert({
        targetKind,
        cardId,
        sealedName,
        direction,
        threshold: Number(threshold),
      }),
    onSuccess: () => {
      hapticConfirm();
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const deleteAlert = useMutation({
    mutationFn: (id: number) => api.deletePriceAlert({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const thresholdValid =
    threshold.trim() !== "" &&
    Number.isFinite(Number(threshold)) &&
    Number(threshold) > 0;
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <h3 className="font-album text-base text-[var(--text)]">Price alert</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
        Get flagged on Home, in red, when this{" "}
        {targetKind === "card" ? "card's" : "item's"} value crosses your
        threshold.{" "}
        {currentValue != null
          ? `Currently ${fmtUSD(currentValue)} each.`
          : ""}
      </p>
      {mine.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {mine.map((a) => (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                a.triggered
                  ? "bg-red-500/15 text-red-200"
                  : "bg-[var(--bg)] text-[var(--text)]"
              }`}
            >
              <span>
                {a.direction === "below" ? "At or below" : "At or above"}{" "}
                {fmtUSD(a.threshold)}
                {a.triggered ? " — triggered now" : ""}
              </span>
              <button
                type="button"
                aria-label={`Delete price alert at ${fmtUSD(a.threshold)}`}
                disabled={deleteAlert.isPending}
                onClick={() => deleteAlert.mutate(a.id)}
                className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--dim)]"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Alert when the value goes"
          value={direction}
          onChange={(e) => setDirection(e.target.value as "below" | "above")}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
        >
          <option value="below">Drops to or below</option>
          <option value="above">Rises to or above</option>
        </select>
        <span className="flex items-center gap-1 text-sm text-[var(--dim)]">
          $
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-label="Alert threshold in dollars"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
          />
        </span>
        <button
          type="button"
          disabled={!thresholdValid || setAlert.isPending}
          onClick={() => setAlert.mutate()}
          className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {setAlert.isPending ? "Setting…" : "Set alert"}
        </button>
      </div>
      {setAlert.isSuccess ? (
        <p className="mt-2 text-xs text-emerald-400">
          Alert set — it will show on Home in red once the price crosses.
        </p>
      ) : setAlert.isError ? (
        <p className="mt-2 text-xs text-red-400">
          That alert didn&rsquo;t save — try again.
        </p>
      ) : null}
    </div>
  );
}

/** Sealed product detail sheet: one sealed item honed in on, exactly
    like tapping a card — its photo in the acrylic case, set / type /
    owned attributes, a quantity stepper, and its performance: value
    and paid per unit and in total, gain/loss with the paid-vs-value
    bar, and the value-per-unit-over-time chart from the Shiny export
    history. Opened from the Most Valuable Items rows and from the
    Sealed shelf; it never routes through the Sealed section. */
function SealedSheet({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["sealedItem", name],
    queryFn: () => api.getSealedItem({ name }),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const setQty = useMutation({
    mutationFn: (qty: number) => api.setSealedQty({ name, qty }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sealedItem", name] });
      void queryClient.invalidateQueries({ queryKey: ["sealed"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
  const item = detail.data;
  const photo = SEALED_PHOTOS[name] ?? sealedBoosterFront;
  const type = name.includes("Prerelease")
    ? "Prerelease Box"
    : name.includes("Illumineer's Quest")
      ? "Illumineer's Quest Box"
      : name.includes("Booster Box")
        ? "Booster Box"
        : "Booster Pack";
  const hist = item?.priceHistory ?? [];
  const lastHist = hist[hist.length - 1];
  const prevHist = hist[hist.length - 2];
  const priceChange =
    lastHist && prevHist ? lastHist.value - prevHist.value : null;
  const priceChangePct =
    priceChange != null && prevHist && prevHist.value > 0
      ? (priceChange / prevHist.value) * 100
      : null;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${name}`}
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sealed item details"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>

        {detail.isPending || !item ? (
          <p className="py-10 text-center text-sm text-[var(--dim)]">
            {detail.isError
              ? "This item couldn't load. Close and try again."
              : "Opening the display case…"}
          </p>
        ) : (
          <>
            {/* Standing rule (Anthony, Nov 2, 2026): every item with
                a photo floats and turns on its detail view — sealed
                products included, acrylic case and all. */}
            <Turntable
              label={`${item.name}, sealed, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
              floatClassName="w-64 max-w-full sm:w-72"
            >
              {SEALED_IN_CASE.has(item.name) ? (
                /* Individual pack: the photo is the full in-case scene
                   (slab case + black stand baked in) — show it plainly
                   at the same display size, no CSS case over it. */
                <div className="aspect-square w-full overflow-hidden rounded-2xl border border-white/10">
                  <img
                    src={photo}
                    alt={`${item.name}, sealed, in an acrylic display case`}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="acrylic-case w-full rounded-2xl">
                  <img
                    src={photo}
                    alt={`${item.name}, sealed, in an acrylic display case`}
                    className="h-full w-full object-contain px-4 pb-8 pt-4"
                    draggable={false}
                  />
                  <span className="acrylic-stand" aria-hidden="true" />
                </div>
              )}
            </Turntable>

            {/* Title block, mirroring the card sheet: name + set on the
                left, market value per unit with its move since the
                previous tracked point on the right. */}
            <div className="mt-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-album text-[22px] font-bold leading-tight text-white">
                  {item.name.replace(/^Disney Lorcana: /, "")}
                </h2>
                <p className="mt-1 text-[15px]">
                  <span className="font-medium text-[var(--accent)]">
                    {item.setName}
                  </span>
                  <span className="text-white"> • Sealed</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                {item.jpyValuePerUnit != null ? (
                  /* Japanese-edition: yen from the Japanese source and
                     the USD conversion, side by side. */
                  <>
                    <p className="text-[19px] font-bold leading-tight text-white">
                      {fmtJPY(item.jpyValuePerUnit)} ·{" "}
                      {fmtUSD(item.valuePerUnit)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-normal text-[var(--dim)]">
                      per unit · {item.marketSourceLabel ?? "Japanese market"}
                    </p>
                  </>
                ) : (
                  <p className="text-[22px] font-bold leading-tight text-white">
                    {fmtUSD(item.valuePerUnit)}
                  </p>
                )}
                {priceChange != null ? (
                  <p
                    className={`mt-0.5 text-[13px] font-medium ${
                      priceChange >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {priceChange >= 0 ? "↑" : "↓"}{" "}
                    {priceChange < 0 ? "−" : "+"}
                    {fmtUSD(Math.abs(priceChange))}
                    {priceChangePct != null
                      ? ` (${priceChangePct < 0 ? "−" : "+"}${Math.abs(priceChangePct).toFixed(2)}%)`
                      : ""}
                    <span className="block text-[11px] font-normal text-[var(--dim)]">
                      since {prevHist?.label}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Set
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">{item.setName}</dd>
              </div>
              <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Type
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">{type}</dd>
              </div>
              <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Owned
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">× {item.qty}</dd>
              </div>
            </dl>

            {/* Copies owned bar, merged with Where it lives
                (Anthony's placement change, Nov 2, 2026): the bar
                is split in half — Where it lives (dropdown) on the
                left, Copies owned with its stepper on the right. */}
            <div className="mt-3">
              <OwnedLocationBar
                targetKind="sealed"
                cardId={null}
                sealedName={item.name}
                comicId={null}
                ownedQty={item.qty}
                copiesQty={item.qty}
                onCopiesMinus={() => setQty.mutate(item.qty - 1)}
                onCopiesPlus={() => setQty.mutate(item.qty + 1)}
                onCopiesSet={(n) => setQty.mutate(n)}
                copiesMinusDisabled={item.qty <= 0 || setQty.isPending}
                copiesPlusDisabled={setQty.isPending}
                copiesItemName={item.name}
                barClassName="bg-[var(--surface)]"
              />
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-album text-base text-[var(--text)]">
                  This item&rsquo;s performance
                </h3>
                <span
                  className={`text-sm font-semibold ${
                    item.net >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {item.net < 0 ? "−" : "+"}
                  {fmtUSD(Math.abs(item.net))}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--dim)]">
                {item.jpyValuePerUnit != null
                  ? `Value ${fmtJPY(item.jpyValuePerUnit)} · ${fmtUSD(item.valuePerUnit)} each`
                  : `Value ${fmtUSD(item.valuePerUnit)} each`}{" "}
                · Paid {fmtUSD(item.paidPerUnit)} each
                {item.qty !== 1
                  ? ` · ${item.qty} copies owned`
                  : ""}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                    Value total
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[var(--text)]">
                    {fmtUSD(item.valueTotal)}
                  </dd>
                </div>
                <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                    Paid total
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[var(--text)]">
                    {fmtUSD(item.paidTotal)}
                  </dd>
                </div>
                <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                    Gain / loss
                  </dt>
                  <dd
                    className={`mt-0.5 font-semibold ${
                      item.net >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {item.net < 0 ? "−" : "+"}
                    {fmtUSD(Math.abs(item.net))}
                  </dd>
                </div>
              </dl>
              {/* Best Offer in Performance: between the Value total /
                  Paid total / Gain-loss block and the value-per-unit
                  chart — same placement as card details. */}
              {item.marketUrl ? (
                <BestOfferMarketLink
                  url={item.marketUrl}
                  sourceLabel={item.marketSourceLabel ?? "Japanese market"}
                  jpyPrice={item.jpyValuePerUnit}
                  price={item.valuePerUnit}
                />
              ) : item.tcgplayerId ? (
                <BestOfferLink
                  tcgplayerId={item.tcgplayerId}
                  price={item.valuePerUnit}
                  noun="per unit"
                />
              ) : (
                <BestOfferFallback name={item.name} />
              )}
              {hist.length > 0 ? (
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    Value per unit over time
                  </p>
                  <div
                    role="img"
                    aria-label={`Line chart of this item's value per unit from ${hist[0]?.label} to ${hist[hist.length - 1]?.label}. Latest value ${fmtUSD(hist[hist.length - 1]?.value ?? 0)} per unit.`}
                  >
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart
                        data={hist}
                        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                      >
                        <defs>
                          <linearGradient id="sealedValueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7aa5ff" stopOpacity={0.38} />
                            <stop offset="100%" stopColor="#7aa5ff" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "#8b9bb8", fontSize: 10 }}
                          axisLine={{ stroke: "#24365e" }}
                          tickLine={false}
                          interval={0}
                          angle={-18}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tick={{ fill: "#8b9bb8", fontSize: 11 }}
                          tickFormatter={(v: number) => `$${v}`}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          label={{
                            value: "USD per unit",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#8b9bb8",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0e1526",
                            border: "1px solid #24365e",
                            borderRadius: 8,
                            color: "#eef2ff",
                            fontSize: 13,
                          }}
                          formatter={(v: number) => [fmtUSD(v), "Value per unit"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name="Value per unit"
                          stroke="var(--accent)"
                          strokeWidth={2.5}
                          fill="url(#sealedValueFill)"
                          dot={{ r: 3, fill: "#7aa5ff", strokeWidth: 0 }}
                          activeDot={{ r: 4.5, fill: "#7aa5ff", strokeWidth: 0 }}
                          style={{
                            filter: "drop-shadow(0 0 6px rgba(122,165,255,0.45))",
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 text-xs text-[var(--dim)]">
                    {item.marketSourceLabel
                      ? `Priced from ${item.marketSourceLabel}; tracking starts Nov 2, 2026, the day it was added.`
                      : "Tracked from your first Shiny export, Oct 25, 2026; a new point is added by each export."}
                  </p>
                </div>
              ) : (
                /* Same every-item rule as card details: the chart
                    section always shows, with an honest empty state
                    when nothing is tracked yet. */
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    Value per unit over time
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
                    {item.marketSourceLabel
                      ? "No tracked prices yet for this item — its value-over-time chart starts when its Japanese market price is next checked."
                      : "No tracked prices yet for this item — its value-over-time chart starts with the next Shiny export."}
                  </p>
                </div>
              )}
              {item.marketSourceLabel ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  Priced from {item.marketSourceLabel}, checked Nov 2,
                  2026 — this Japanese-edition item isn&rsquo;t tracked
                  by TCGplayer or Shiny. {item.fxNote ?? ""} Paid amount
                  not recorded.
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  Prices as of {item.asOfLabel}. Paid amounts come from
                  your Shiny records and stay as recorded; sealed values
                  update with each new Shiny export.
                </p>
              )}
              <PriceAlertBox
                targetKind="sealed"
                cardId={null}
                sealedName={item.name}
                currentValue={item.valuePerUnit}
              />
              {/* No standalone "Where it lives" section at the
                  bottom anymore (Anthony's placement change,
                  Nov 2, 2026): it is merged into the Copies owned
                  bar up top — see OwnedLocationBar. */}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Sealed tab: Anthony's own sealed Lorcana from his latest Shiny
    export — 14 items (Hyperia City booster box and prerelease box,
    plus one sealed booster pack from each of twelve sets), qty 1
    each, served by getSealed from the same export data the finances
    use. Layout follows his Shiny screenshot: product photo prominent
    on top, then name, set, a blue "Sealed" label, and the value /
    qty / paid lines with the gain-loss percent. The two boxes sit
    inside the CSS acrylic-case frame; each individual pack's photo
    is a full scene with a thick clear acrylic slab case and black
    stand baked into the image (SEALED_IN_CASE), matching Anthony's
    reference photo. Tapping a tile opens that item's own detail
    sheet (SealedSheet). */
type SealedTypeFilter =
  | "all"
  | "box"
  | "pack"
  | "quest"
  | "trove"
  | "gift"
  | "deck"
  | "gateway";
type SealedSortKey =
  | "catalog"
  | "value-desc"
  | "value-asc"
  | "name"
  | "set"
  | "added-desc"
  | "added-asc";

/** Product type from the catalog name: Quest boxes, Troves,
    gift sets/boxes, starter decks and 2-Player Starter Sets,
    and the Gateway box name themselves; anything "Booster
    Pack" is a pack; the rest (booster boxes, prerelease
    boxes) are boxes. */
function sealedTypeOf(
  name: string,
): Exclude<SealedTypeFilter, "all"> {
  if (name.includes("Illumineer's Quest")) return "quest";
  if (name.includes("Illumineer's Trove")) return "trove";
  if (name.includes("Gift Set") || name.includes("Gift Box"))
    return "gift";
  if (name.includes("Starter Deck") || name.includes("Starter Set"))
    return "deck";
  if (name === "Disney Lorcana: Gateway") return "gateway";
  if (name.includes("Booster Pack")) return "pack";
  return "box";
}

/** On-theme dropdown for the Sealed shelf controls (Anthony,
    Nov 3, 2026: the native select's popup menu was off-theme
    — "absolute horseshit" — so the menu is now the app's own:
    dark Vault surface, rounded edges, the accent for the
    current pick, in the blue-purple theme like everything
    else). Same options, same behavior — only the presentation
    is the app's instead of the phone's. */
function ThemedSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current =
    options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="relative flex items-center gap-2">
      <span className="text-sm text-[var(--dim)]">{label}</span>
      <button
        type="button"
        aria-label={`${ariaLabel}: ${current}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          hapticTick();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-3.5 pr-3 text-sm font-medium text-[var(--text)]"
      >
        {current}
        <span
          aria-hidden="true"
          className={`text-[10px] text-[var(--dim)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default bg-transparent"
          />
          <div
            role="listbox"
            aria-label={ariaLabel}
            className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  hapticTick();
                  setOpen(false);
                  onChange(o.value);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                  o.value === value
                    ? "bg-[var(--accent)]/15 font-semibold text-[var(--gold-soft)]"
                    : "text-[var(--text)]"
                }`}
              >
                {o.label}
                {o.value === value ? (
                  <span aria-hidden="true" className="text-xs">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Section intro windows (Anthony, Nov 3, 2026): the Sealed
    and Social intros sit in bordered windows in the "How
    trading works" / Checkout style — a Hide control collapses
    the window to its title row with a Show control, and the
    choice is remembered on the profile (sectionIntros query),
    so nobody has to re-read an intro on every visit. */
function useSectionIntro(section: "sealed" | "social" | "home") {
  const queryClient = useQueryClient();
  const prefs = useQuery({
    queryKey: ["sectionIntros"],
    queryFn: () => api.getSectionIntros({}),
  });
  const [local, setLocal] = useState<boolean | null>(null);
  const hidden =
    local ??
    (prefs.data
      ? section === "sealed"
        ? prefs.data.sealedIntroHidden
        : section === "social"
          ? prefs.data.socialIntroHidden
          : prefs.data.homeIntroHidden
      : false);
  const setHidden = useMutation({
    mutationFn: (h: boolean) =>
      api.setSectionIntroHidden({ section, hidden: h }),
    onSuccess: (_res, h) => {
      setLocal(h);
      void queryClient.invalidateQueries({ queryKey: ["sectionIntros"] });
    },
  });
  return { hidden, toggle: (h: boolean) => setHidden.mutate(h) };
}

function HideableIntroWindow({
  title,
  hidden,
  onToggle,
  children,
}: {
  title: ReactNode;
  hidden: boolean;
  onToggle: (hidden: boolean) => void;
  children: ReactNode;
}) {
  if (hidden) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        {title}
        <button
          type="button"
          onClick={() => {
            hapticTick();
            onToggle(false);
          }}
          className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
        >
          Show
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        {title}
        <button
          type="button"
          onClick={() => {
            hapticTick();
            onToggle(true);
          }}
          className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
        >
          Hide
        </button>
      </div>
      {children}
    </div>
  );
}

function SealedPanel({
  onOpen,
}: {
  onOpen: (name: string) => void;
}) {
  const sealed = useQuery({
    queryKey: ["sealed"],
    queryFn: () => api.getSealed({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const queryClient = useQueryClient();
  const sealedIntro = useSectionIntro("sealed");
  const setQty = useMutation({
    mutationFn: (args: { name: string; qty: number }) =>
      api.setSealedQty(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sealed"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
  const items = sealed.data?.items ?? [];
  const totals = sealed.data?.totals;
  // Shelf controls (Anthony, Nov 3, 2026): Owned / All available
  // toggle (default Owned — the shelf is his vault; All available
  // shows the whole catalog with the ones he doesn't own yet
  // ghostly, so he can add them), a type filter, and sorting.
  const [viewMode, setViewMode] = useState<"owned" | "all">("owned");
  const [typeFilter, setTypeFilter] = useState<SealedTypeFilter>("all");
  const [sortKey, setSortKey] = useState<SealedSortKey>("catalog");
  // The sideways count dial's open tile (Anthony, Nov 3,
  // 2026): long-holding a shelf tile's + opens the dial under
  // that tile; tapping a number sets the owned count at once.
  const [dialFor, setDialFor] = useState<string | null>(null);
  const visibleItems = (() => {
    const filtered = items.filter((item) => {
      if (viewMode === "owned" && item.qty <= 0) return false;
      if (typeFilter !== "all" && sealedTypeOf(item.name) !== typeFilter)
        return false;
      return true;
    });
    const by = [...filtered];
    switch (sortKey) {
      case "value-desc":
        by.sort((a, b) => b.unitValue - a.unitValue);
        break;
      case "value-asc":
        by.sort((a, b) => a.unitValue - b.unitValue);
        break;
      case "name":
        by.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "set":
        by.sort((a, b) => a.setName.localeCompare(b.setName));
        break;
      case "added-desc":
      case "added-asc": {
        const dir = sortKey === "added-desc" ? -1 : 1;
        by.sort((a, b) => {
          if (a.acquiredAt == null && b.acquiredAt == null) return 0;
          if (a.acquiredAt == null) return 1;
          if (b.acquiredAt == null) return -1;
          return dir * a.acquiredAt.localeCompare(b.acquiredAt);
        });
        break;
      }
      default:
        break;
    }
    return by;
  })();
  return (
    <div className="mt-5">
      {/* The intro as a bordered hideable window (Anthony, Nov 3,
          2026), in the "How trading works" style: Hide collapses
          it to the Sealed title row with a Show control, and the
          choice is remembered. The shelf controls and items
          below stay outside the window, untouched. */}
      <HideableIntroWindow
        title={
          <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
            Sealed
          </h1>
        }
        hidden={sealedIntro.hidden}
        onToggle={sealedIntro.toggle}
      >
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          Your sealed Lorcana, kept mint in acrylic — from your Nov 1
          Shiny export, plus the catalog additions since: the
          Japanese-edition First Chapter pack, all three
          Illumineer&rsquo;s Quest boxes (Deep Trouble, Palace Heist,
          and The Great Hunny Rescue), an Illumineer&rsquo;s
          Trove for every set, and the rest of the sealed family:
          every gift set, every starter deck, and the Lorcana
          Gateway box — each priced from TCGplayer and selectable
          here, so any sealed product can be added to a vault
          right from this shelf.
          {totals
            ? ` ${totals.qty} items · ${fmtUSD(totals.value)} value · ${fmtUSD(totals.paid)} paid.`
            : ""}
        </p>
      </HideableIntroWindow>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Sealed shelf view"
          className="flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
        >
          {(
            [
              ["owned", "Owned"],
              ["all", "All available"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => {
                hapticTick();
                setViewMode(mode);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                viewMode === mode
                  ? "bg-[var(--accent)] text-[var(--on-accent)]"
                  : "text-[var(--dim)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <ThemedSelect
          label="Type"
          ariaLabel="Filter sealed products by type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All types" },
            { value: "box", label: "Boxes" },
            { value: "pack", label: "Packs" },
            { value: "quest", label: "Quests" },
            { value: "trove", label: "Troves" },
            { value: "gift", label: "Gift sets" },
            { value: "deck", label: "Starter decks" },
            { value: "gateway", label: "Gateway" },
          ]}
        />
        <ThemedSelect
          label="Sort"
          ariaLabel="Sort the sealed shelf"
          value={sortKey}
          onChange={setSortKey}
          options={[
            { value: "catalog", label: "Catalog order" },
            { value: "value-desc", label: "Value, high to low" },
            { value: "value-asc", label: "Value, low to high" },
            { value: "name", label: "Name, A to Z" },
            { value: "set", label: "Set" },
            { value: "added-desc", label: "Date added, newest" },
            { value: "added-asc", label: "Date added, oldest" },
          ]}
        />
      </div>
      {sortKey === "added-desc" || sortKey === "added-asc" ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          Dates are recorded only for items whose quantity was set
          in the app; everything else keeps its catalog place at
          the end of the list.
        </p>
      ) : null}
      {viewMode === "all" ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          Products shown faded are in the catalog but not in your
          vault yet — open one and add it with the steppers.
        </p>
      ) : null}
      {sealed.isPending ? (
        <p className="py-14 text-center text-sm text-[var(--dim)]">
          Opening the display case…
        </p>
      ) : sealed.isError ? (
        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-red-400">
          The sealed shelf couldn&rsquo;t load.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void sealed.refetch()}
          >
            Try again
          </button>
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--dim)]">
          {viewMode === "owned"
            ? "Nothing on the shelf for this filter yet — switch to All available to browse the catalog and add sealed products."
            : "No sealed products match this filter."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleItems.map((item) => {
            const photo = SEALED_PHOTOS[item.name] ?? sealedBoosterFront;
            // In All available, a product not yet in the vault
            // renders ghostly — its real art, washed out and
            // translucent, the same treatment as a missing card.
            const ghosted = viewMode === "all" && item.qty <= 0;
            const pctChange =
              item.paid > 0
                ? ((item.value - item.paid) / item.paid) * 100
                : null;
            return (
              <figure
                key={item.name}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
              >
                <button
                  type="button"
                  onClick={() => onOpen(item.name)}
                  aria-label={`View details for ${item.name}`}
                  className="block w-full"
                >
                  {SEALED_IN_CASE.has(item.name) ? (
                    /* Individual packs: the photo itself is the full
                       scene — the pack standing in a thick clear
                       acrylic slab case on a black stand — so it fills
                       the tile plainly, with no CSS case or stand
                       doubled over it. */
                    <div className="aspect-square bg-[var(--bg)]">
                      <img
                        src={photo}
                        alt={`${item.name}, sealed, in an acrylic display case`}
                        className={`h-full w-full object-cover ${ghosted ? "ghost-img" : ""}`}
                      />
                    </div>
                  ) : (
                    <div className="acrylic-case">
                      {/* Eager loading (no lazy): the shelf is only 14
                          lightweight WebP photos, and lazy loading in
                          the phone webview was leaving tiles blank for
                          Anthony — every product must paint at once. */}
                      <img
                        src={photo}
                        alt={`${item.name}, sealed, in an acrylic display case`}
                        className={`h-full w-full object-contain px-1.5 pb-5 pt-1.5 ${ghosted ? "ghost-img" : ""}`}
                      />
                      <span className="acrylic-stand" aria-hidden="true" />
                    </div>
                  )}
                </button>
                <figcaption className="flex flex-1 flex-col px-3 py-2.5">
                  <span className="block text-sm font-semibold leading-snug text-[var(--text)]">
                    {item.name.replace(/^Disney Lorcana: /, "")}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--dim)]">
                    {item.setName}
                  </span>
                  <span className="block text-xs font-medium text-[var(--gold-soft)]">
                    Sealed
                  </span>
                  {item.jpyValue != null ? (
                    /* Japanese-edition items price in both currencies:
                       the yen figure from the Japanese source and its
                       USD conversion, side by side. */
                    <span className="mt-1.5 block text-xs text-[var(--dim)]">
                      {fmtJPY(item.jpyValue)} · {fmtUSD(item.value)} Value
                    </span>
                  ) : item.qty === 0 ? (
                    /* Catalog item not yet in the vault (selectable
                       items like the Great Hunny Rescue box): the
                       totals are honestly zero, so the tile shows
                       the per-unit market value instead — the price
                       of adding one. */
                    <span className="mt-1.5 block text-xs text-[var(--dim)]">
                      {fmtUSD(item.unitValue)} Value each · not in
                      your vault yet
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-xs text-[var(--dim)]">
                      {fmtUSD(item.value)} Value
                    </span>
                  )}
                  {item.marketSourceLabel ? (
                    <span className="block text-xs text-[var(--dim)]">
                      Priced from {item.marketSourceLabel}
                    </span>
                  ) : null}
                  {item.qty > 0 ? (
                    <span className="mb-2 block text-xs text-[var(--dim)]">
                      {fmtUSD(item.paid)} Paid
                      {pctChange != null ? (
                        <span
                          className={
                            pctChange >= 0 ? "text-green-400" : "text-red-400"
                          }
                        >
                          {" "}
                          ({pctChange >= 0 ? "+" : ""}
                          {pctChange.toFixed(2)}%)
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="mb-2 block text-xs text-[var(--dim)]">
                      In the catalog — add yours with the + stepper
                    </span>
                  )}
                  {/* Stepper row pinned to the tile's bottom (mt-auto
                      inside the flex-column caption) so it sits at the
                      exact same height on every tile, and the label is
                      a full-height flex box matching the buttons'
                      height — one shared centerline, no offset. */}
                  {/* The count dial rides directly ABOVE the
                      stepper row inside the same bottom-pinned
                      block (Anthony, Nov 3, 2026, ~2:59 AM):
                      under the row it opened below his thumb
                      and got covered. */}
                  <span className="mt-auto block">
                  {dialFor === item.name ? (
                    <SidewaysCountDial
                      overlay
                      label={`Pick how many copies of ${item.name} you own`}
                      current={item.qty}
                      onPick={(n) => {
                        setDialFor(null);
                        setQty.mutate({ name: item.name, qty: n });
                      }}
                      onClose={() => setDialFor(null)}
                    />
                  ) : null}
                  <span className="flex items-center justify-between border-t border-[var(--border)] pt-2">
                    <span className="flex h-7 items-center text-xs font-medium leading-none tabular-nums text-[var(--dim)]">
                      Owned ×{item.qty}
                    </span>
                    {/* The gap between the two buttons is wide
                        enough that their grown touch zones (52px
                        each, on 28px footprints) never overlap. */}
                    <span className="flex items-center gap-6">
                      <StepperButton
                        tight
                        label={`Remove one ${item.name}`}
                        disabled={item.qty <= 0 || setQty.isPending}
                        onClick={() =>
                          setQty.mutate({
                            name: item.name,
                            qty: item.qty - 1,
                          })
                        }
                        glyph="−"
                        circleClass="h-7 w-7 text-base"
                      />
                      <StepperButton
                        tight
                        label={`Add one ${item.name} — hold to pick a count`}
                        disabled={setQty.isPending}
                        onClick={() =>
                          setQty.mutate({
                            name: item.name,
                            qty: item.qty + 1,
                          })
                        }
                        onLongPress={() =>
                          setDialFor(
                            dialFor === item.name ? null : item.name,
                          )
                        }
                        glyph="+"
                        circleClass="h-7 w-7 text-base"
                      />
                    </span>
                  </span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Social tab: three distinct areas Anthony asked for — Forums
    (message-board style, in the spirit of Facebook message boards),
    Friends (a friends list), and Trades (trade offers, borrowing
    presentation ideas from trading-social apps like TraYde's
    friend-group trade matching and Collectr-style collection
    sharing). Each area is its own separate page inside Social,
    switched by the pill tabs — not one long scrolling page — and
    Friends is the default page Social opens on (Anthony's call).
    Forums and Trades are structure only for now — no live posting
    or trading is wired up, so they show honest empty states
    instead of invented posts or offers. Friends is partly live:
    the one friend entry is Jarvis himself (see JARVIS_FRIEND
    below) — Anthony asked Jarvis to build himself into the app as
    a friend, with a couple of cards of his own, so the friending
    and collection-viewing flow can be watched working in real
    time — and both his identity and Anthony's own Collector ID
    are registered in the central Vault X registry on
    Supabase, which the Friends page reads back live ("On the
    server" list + the server-backed Add a Friend lookup). */
/** Numeric compare of two "x.y.z" versions: > 0 when a is newer. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

type UpdateCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; version: string; notes: string[] }
  | { status: "error" };

/** Pull the per-version changelog embedded in a fetched bundle's
    text (see CHANGELOG_EMBED in version.ts): an older running copy
    reads the NEWER build's own notes this way, so the update prompt
    can say exactly what changed in the version on offer. Returns
    null when no readable notes are embedded. */
function changelogInBundle(text: string): Record<string, string[]> | null {
  const at = text.indexOf("mc-changelog:");
  if (at < 0) return null;
  const start = text.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < text.length; j++) {
    const c = text[j];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          const raw = text
            .slice(start, j + 1)
            .replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) =>
              String.fromCharCode(parseInt(h, 16)),
            )
            .replace(/\\(.)/g, "$1");
          const parsed: unknown = JSON.parse(raw);
          if (parsed != null && typeof parsed === "object") {
            return parsed as Record<string, string[]>;
          }
          return null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Notes for every version newer than `running` up to `found`,
    newest version first — what the update prompt lists. */
function notesBetween(
  log: Record<string, string[]>,
  running: string,
  found: string,
): string[] {
  return Object.keys(log)
    .filter(
      (v) =>
        compareVersions(v, running) > 0 && compareVersions(v, found) <= 0,
    )
    .sort((a, b) => compareVersions(b, a))
    .flatMap((v) => log[v] ?? []);
}

/** The automatic update check (Anthony's philosophy, Nov 2,
    2026, late): he is NOT a fan of apps that auto-update — he
    reads the changelog first and updating is always his tap.
    But the app checks on its own when it opens: this fetches
    the page the server is currently serving and compares its
    build marker against the running copy (the same fetch the
    Settings check makes). Returns the newer version + its
    notes, "current" when up to date, or null when the check
    itself couldn't complete. */
async function fetchLatestBuild(): Promise<
  { version: string; notes: string[] } | "current" | null
> {
  const markerIn = (text: string): string | null => {
    const m = text.match(/mycollectibles-build-v(\d+)\.(\d+)\.(\d+)/);
    return m ? `${m[1] ?? "0"}.${m[2] ?? "0"}.${m[3] ?? "0"}` : null;
  };
  let found: string | null = null;
  let foundText: string | null = null;
  try {
    const pageRes = await fetch("./", { cache: "no-store" });
    if (pageRes.ok) {
      const html = await pageRes.text();
      found = markerIn(html);
      if (found != null) foundText = html;
      if (found == null) {
        const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)]
          .map((m) => m[1])
          .filter((s): s is string => typeof s === "string");
        for (const src of srcs) {
          try {
            const jsRes = await fetch(
              new URL(src, document.baseURI).toString(),
              { cache: "no-store" },
            );
            if (!jsRes.ok) continue;
            const jsText = await jsRes.text();
            found = markerIn(jsText);
            if (found != null) {
              foundText = jsText;
              break;
            }
          } catch {
            // Try the next script; total failure returns null.
          }
        }
      }
    }
  } catch {
    // Network failure: the check couldn't be completed.
  }
  if (found == null) return null;
  if (compareVersions(found, APP_VERSION) <= 0) return "current";
  const newerLog = foundText != null ? changelogInBundle(foundText) : null;
  return {
    version: found,
    notes: notesBetween(newerLog ?? CHANGELOG, APP_VERSION, found),
  };
}

/** Trade availability (Anthony, Nov 2, 2026, late — hybrid
    model): how many copies of a card the owner is willing to
    trade or part with — tradeable quantity is separate from
    owned quantity. Two hold-backs are MULTI-SELECT and stack:
    "Keep one of each for the master set" and "Cards dedicated
    to my decks". "Everything I own" and "Nothing for now" are
    EXCLUSIVE — picking either clears the hold-backs, and
    picking a hold-back clears them. Shown in Settings and in
    the Trades area; the server enforces the combined math
    (owned − master keep-back − deck copies) everywhere. */
type TradeAvailabilityValue =
  | "all"
  | "none"
  | "master"
  | "decks"
  | "master,decks";

function TradeAvailabilityControl() {
  const queryClient = useQueryClient();
  const trades = useQuery({
    queryKey: ["trades"],
    queryFn: () => api.getTrades({}),
  });
  const availability: TradeAvailabilityValue =
    trades.data?.tradeAvailability ?? "master";
  const holdbacks: ("master" | "decks")[] =
    availability === "all" || availability === "none"
      ? []
      : (availability.split(",") as ("master" | "decks")[]);
  const setAvailability = useMutation({
    mutationFn: (a: TradeAvailabilityValue) =>
      api.setTradeAvailability({ availability: a }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
      void queryClient.invalidateQueries({ queryKey: ["profileItems"] });
    },
  });
  const pick = (next: TradeAvailabilityValue) => {
    if (next === availability || setAvailability.isPending) return;
    hapticTick();
    setAvailability.mutate(next);
  };
  const toggleHoldback = (h: "master" | "decks") => {
    const set = new Set(holdbacks);
    if (set.has(h)) set.delete(h);
    else set.add(h);
    const ordered = (["master", "decks"] as const).filter((x) =>
      set.has(x),
    );
    pick(
      ordered.length === 0
        ? "all"
        : (ordered.join(",") as TradeAvailabilityValue),
    );
  };
  const holdbackOptions = [
    [
      "master",
      "Keep one of each for the master set",
      "One copy of each printing stays back, for your master sets.",
    ],
    [
      "decks",
      "Cards dedicated to my decks",
      "Copies you've placed in a deck box in Where it lives stay back.",
    ],
  ] as const;
  const exclusiveOptions = [
    [
      "all",
      "Everything I own",
      "Every copy you own can be put into a trade. Stands alone — it clears both hold-backs above.",
    ],
    [
      "none",
      "Nothing for now",
      "No copies are up for trade until you change this. Stands alone — it clears everything else.",
    ],
  ] as const;
  const rowClass = (active: boolean) =>
    `block w-full rounded-xl border px-3.5 py-3 text-left disabled:opacity-60 ${
      active
        ? "border-[var(--accent)] bg-[var(--accent)]/10"
        : "border-[var(--border)] bg-[var(--bg)]"
    }`;
  return (
    <div>
      <div className="space-y-2">
        {holdbackOptions.map(([value, label, blurb]) => {
          const active = holdbacks.includes(value);
          return (
            <button
              key={value}
              type="button"
              role="checkbox"
              aria-checked={active}
              disabled={setAvailability.isPending}
              onClick={() => toggleHoldback(value)}
              className={rowClass(active)}
            >
              <span className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[13px] font-black ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                      : "border-[var(--border)] text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                    {blurb}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
        {exclusiveOptions.map(([value, label, blurb]) => {
          const active = availability === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={setAvailability.isPending}
              onClick={() => pick(value)}
              className={rowClass(active)}
            >
              <span className="block text-sm font-semibold text-[var(--text)]">
                {label}
                {active ? (
                  <span className="ml-2 text-xs font-bold text-[var(--gold-soft)]">
                    Current
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                {blurb}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
        The pools you hold back are protected — copies kept for
        your master sets and your decks can never be traded away.
        Only what&rsquo;s left over can go into a trade, and this
        never changes how many copies you own.
      </p>
    </div>
  );
}

/** Settings page (Anthony's request, Nov 2, 2026): the app's About
    area — display name, the Vault X codename, and the current
    semantic version — plus Check for Update, the built-in way fixes
    and additions reach everyone running the app. The check fetches
    the page the server is currently serving and compares the build
    marker baked into it (see version.ts) against the marker in this
    running copy: a newer one means a newer build is published, and
    Reload picks it up; no marker found means the check itself
    couldn't be completed, which is reported honestly rather than
    claiming "up to date". */
/** Settings quick-jump targets, in the page's section order. */
const SETTINGS_JUMPS: {
  id: string;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "settings-about",
    label: "About this app",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </>
    ),
  },
  {
    id: "settings-requests",
    label: "Send a change request",
    icon: (
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z" />
    ),
  },
  {
    id: "settings-theme",
    label: "Theme",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    id: "settings-collections",
    label: "Your Collections",
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    id: "settings-sharing",
    label: "Sharing",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
        <path d="M16 5.5a3.5 3.5 0 0 1 0 6.5" />
        <path d="M17.5 15.3c1.7.7 2.7 2.3 3 4.7" />
      </>
    ),
  },
  {
    id: "settings-save-count",
    label: "Save collection count",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    id: "settings-haptics",
    label: "Haptics",
    icon: (
      <>
        <rect x="8" y="3" width="8" height="18" rx="2" />
        <path d="M4.5 9v6M19.5 9v6" />
      </>
    ),
  },
  {
    id: "settings-trade-availability",
    label: "Trade availability",
    icon: (
      <>
        <path d="M4 8h13" />
        <path d="m13.5 4.5 3.5 3.5-3.5 3.5" />
        <path d="M20 16H7" />
        <path d="m10.5 12.5-3.5 3.5 3.5 3.5" />
      </>
    ),
  },
  {
    id: "settings-payment",
    label: "Payment info",
    icon: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <circle cx="12" cy="12" r="2.7" />
        <path d="M5.8 9.4h.01" strokeWidth="2.6" />
        <path d="M18.2 14.6h.01" strokeWidth="2.6" />
      </>
    ),
  },
  {
    id: "settings-data",
    label: "Your data and backups",
    icon: (
      <>
        <ellipse cx="12" cy="5.5" rx="7" ry="3" />
        <path d="M5 5.5v13c0 1.66 3.13 3 7 3s7-1.34 7-3v-13" />
        <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
      </>
    ),
  },
  {
    id: "settings-updates",
    label: "App updates",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16V8" />
        <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
      </>
    ),
  },
];

/** The Admin jump chip — rendered UNCONDITIONALLY, exactly
    like every other jump icon (Anthony, Nov 3, 2026,
    re-report ~1:36 AM: the shield kept flickering on and off
    even after the latch fix). DIAGNOSED CAUSE: this was the
    only jump icon whose existence depended on async data —
    it rendered null until getAdminStats returned isOwner,
    and the "latch" that was supposed to hold it was a
    useRef, which resets on every mount. Settings unmounts
    whenever he switches tabs, so every return to Settings
    started with the icon missing until the stats call (the
    app's slowest — it reads the Supabase registry and builds
    the charts) came back, and because the jump row is
    justify-between, the whole row reflowed when the shield
    popped in: the visible flicker. PERMANENT FIX: the chip
    is just a scroll anchor, so it needs no data at all — it
    renders always, in the first render, like its neighbors.
    What it points at stays owner-gated on its own:
    getAdminStats still withholds the numbers from every
    other profile and the Admin section renders nothing for
    them, so the anchor simply has nothing to land on for a
    non-owner. */
function SettingsAdminJump() {
  return (
    <button
      type="button"
      aria-label="Jump to Admin"
      title="Admin"
      onClick={() => {
        hapticTick();
        document
          .getElementById("settings-admin")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--gold-soft)] transition active:scale-95"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M12 3l7 3v5c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6Z" />
        <path d="m9.2 12 2 2 3.6-4" />
      </svg>
    </button>
  );
}

/** The symbol beside a Settings section heading (Anthony,
    Nov 3, 2026, ~3:01 AM): every section heading carries the
    SAME symbol as its quick-jump icon, placed to the LEFT of
    the heading word, so the symbol and the name read as one
    thing (his examples: the swatch beside "Theme", the shield
    beside "Admin"). Admin's shield is the special case — it
    lives on the separately-gated jump button, so its paths
    are repeated here. */
function SettingsSectionIcon({ id }: { id: string }) {
  const paths =
    id === "settings-admin" ? (
      <>
        <path d="M12 3l7 3v5c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6Z" />
        <path d="m9.2 12 2 2 3.6-4" />
      </>
    ) : (
      (SETTINGS_JUMPS.find((j) => j.id === id)?.icon ?? null)
    );
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0 text-[var(--gold-soft)]"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

/** Payment info (Anthony, Nov 3, 2026): the user's own
    Zelle handle — the email or phone number their Zelle is
    registered under — saved once here. It is never shown on
    their public profile; it appears only inside a cash
    purchase order where they're the seller, as the "Pay the
    seller" line the buyer copies into their bank app. Vault
    X never processes payments. */
function PaymentInfoSection() {
  const queryClient = useQueryClient();
  const info = useQuery({
    queryKey: ["paymentInfo"],
    queryFn: () => api.getPaymentInfo({}),
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (handle: string) => api.setZelleHandle({ handle }),
    onSuccess: (res) => {
      if (res.ok) {
        setSaveError(null);
        setSaved(true);
        setDraft(null);
        void queryClient.invalidateQueries({ queryKey: ["paymentInfo"] });
        void queryClient.invalidateQueries({ queryKey: ["cashPurchases"] });
        window.setTimeout(() => setSaved(false), 2500);
      } else {
        setSaveError(res.error ?? "That didn't save.");
      }
    },
    onError: () => setSaveError("That didn't save — try again."),
  });
  const current = info.data?.zelleHandle ?? null;
  const value = draft ?? current ?? "";
  return (
    <div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Your Zelle handle — the email or phone number your
        Zelle is registered under. When you sell a card for
        cash, the buyer sees it inside that purchase order
        only (never on your profile), so they can copy it and
        pay you from their own bank app. Vault X doesn&rsquo;t
        process payments.
      </p>
      <label
        htmlFor="settings-zelle-handle"
        className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[var(--dim)]"
      >
        Zelle email or phone
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <ZelleMark className="h-6 w-6 text-[13px]" />
        <input
          id="settings-zelle-handle"
          type="text"
          autoComplete="off"
          placeholder="you@example.com or (555) 123-4567"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
        />
      </div>
      {saveError ? (
        <p className="mt-2 text-xs font-semibold leading-relaxed text-red-300">
          {saveError}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={save.isPending || draft === null || draft.trim() === (current ?? "")}
          onClick={() => save.mutate(value)}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
        >
          Save
        </button>
        {current ? (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate("")}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
        {saved ? (
          <span role="status" className="text-xs font-medium text-emerald-400">
            Saved ✓
          </span>
        ) : null}
      </div>
      {info.data && !current ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          Nothing saved yet — buyers won&rsquo;t see a Zelle
          pay line on your orders until you add it.
        </p>
      ) : null}
    </div>
  );
}

const COLLECTION_TILE_OPTIONS = [
  { key: "lorcana", label: "Lorcana" },
  { key: "pokemon", label: "Pokémon" },
  { key: "magic", label: "Magic: The Gathering" },
  { key: "lego", label: "Lego" },
  { key: "comics", label: "Comics" },
  { key: "starwars", label: "Star Wars Unlimited" },
] as const;

/** The Your Collections visibility switches (Settings):
    one per Home tile, all shown by default; the choice
    persists on the user's profile. */
function CollectionsVisibilitySwitches() {
  const queryClient = useQueryClient();
  const visibility = useQuery({
    queryKey: ["collectionVisibility"],
    queryFn: () => api.getCollectionVisibility({}),
  });
  const hidden = new Set(visibility.data?.hidden ?? []);
  const toggle = useMutation({
    mutationFn: (args: {
      collection:
        | "lorcana"
        | "pokemon"
        | "magic"
        | "lego"
        | "comics"
        | "starwars";
      hidden: boolean;
    }) => api.setCollectionHidden(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["collectionVisibility"],
      });
    },
  });
  return (
    <ul className="mt-3 divide-y divide-[var(--border)]">
      {COLLECTION_TILE_OPTIONS.map((c) => {
        const shown = !hidden.has(c.key);
        return (
          <li
            key={c.key}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <span className="text-sm font-medium text-[var(--text)]">
              {c.label}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={shown}
              aria-label={`Show the ${c.label} tile on Home`}
              disabled={toggle.isPending}
              onClick={() => {
                hapticTick();
                toggle.mutate({ collection: c.key, hidden: shown });
              }}
              className={`flex h-7 w-12 shrink-0 items-center rounded-full border px-1 transition ${
                shown
                  ? "justify-end border-[var(--accent)] bg-[var(--accent)]/30"
                  : "justify-start border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-5 w-5 rounded-full ${
                  shown ? "bg-[var(--accent)]" : "bg-[var(--dim)]"
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SettingsPanel({
  theme,
  onThemeChange,
  onShowWelcome,
}: {
  theme: ThemeId;
  onThemeChange: (next: ThemeId) => void;
  onShowWelcome: () => void;
}) {
  const queryClient = useQueryClient();
  const [check, setCheck] = useState<UpdateCheckState>({ status: "idle" });
  // Haptics (Anthony, Nov 2, 2026): on by default, switchable here;
  // the module owns the stored choice and every call site respects
  // it. Turning it on fires one tick so he feels what he enabled.
  const [hapticsOn, setHapticsOn] = useState<boolean>(() =>
    hapticsEnabled(),
  );
  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsOn(next);
    setHapticsEnabled(next);
  };
  // Save collection count mode (Anthony, Nov 2, 2026): ON keeps
  // the manual "Save collection count" button on card pages;
  // OFF switches to auto-save, where every +/− tap saves at once.
  const [manualSaveOn, setManualSaveOn] = useState<boolean>(() =>
    manualSaveCount(),
  );
  const toggleManualSave = () => {
    const next = !manualSaveOn;
    setManualSaveOn(next);
    setManualSaveCount(next);
    hapticTick();
  };
  // Sharing (Anthony, Nov 3, 2026): one switch per connected
  // friend, housed in Settings, every one ON by default — a
  // connected friend can see your collection unless you turn
  // it off for them here. Persisted per friend on the server.
  const sharingSettings = useQuery({
    queryKey: ["sharingSettings"],
    queryFn: () => api.getSharingSettings({}),
  });
  const friendShareMutation = useMutation({
    mutationFn: (args: { friendCode: string; share: boolean }) =>
      api.setFriendSharing(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["sharingSettings"],
      });
    },
  });

  // Save the icon artwork (repair, Nov 2, 2026): this used to be a
  // plain <a download> link, which the phone's browser swallowed
  // after the first tap — Anthony saved once, backed out, and every
  // later tap did nothing. A real button instead: fetch the artwork
  // bytes, then hand the file to the phone — the system share sheet
  // ("Save to Files" / "Save image") where the browser supports
  // sharing files, falling back to a blob download — and report the
  // outcome in plain text. State always settles back to idle, so the
  // button works on every tap, not just the first.
  const [iconSave, setIconSave] = useState<
    "idle" | "working" | "shared" | "downloaded" | "opened" | "error"
  >("idle");
  const [iconZoom, setIconZoom] = useState(false);
  const saveIconArtwork = async () => {
    if (iconSave === "working") return;
    setIconSave("working");
    try {
      const res = await fetch(vaultXRingArtwork);
      if (!res.ok) throw new Error("artwork fetch failed");
      const blob = await res.blob();
      const file = new File([blob], "vault-x-icon-artwork.webp", {
        type: blob.type || "image/webp",
      });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
      };
      if (
        typeof nav.canShare === "function" &&
        nav.canShare({ files: [file] }) &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({ files: [file] });
          setIconSave("shared");
          return;
        } catch (err) {
          // Backing out of the share sheet is not an error: settle
          // back to idle quietly so the next tap works the same.
          if (err instanceof DOMException && err.name === "AbortError") {
            setIconSave("idle");
            return;
          }
          // Any other share failure falls through to the download.
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vault-x-icon-artwork.webp";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setIconSave("downloaded");
    } catch {
      // Last resort: show the artwork full-screen in the app, where
      // a long-press offers the phone's own "Save image".
      setIconZoom(true);
      setIconSave("opened");
    }
  };

  // Collection export (Settings > Your data & backups, Nov 2,
  // 2026): pull the owned cards + sealed rows fresh from the
  // server on every tap, append the graded comics from the client
  // catalog, build the file in the picked format, and hand it to
  // the phone with the same share/download helper the icon
  // artwork save uses — so the buttons work on every tap.
  const [exportStatus, setExportStatus] = useState<
    | { phase: "idle" }
    | { phase: "working"; format: string }
    | { phase: "shared" | "downloaded"; format: string; filename: string }
    | { phase: "error" }
  >({ phase: "idle" });
  const runExport = async (format: "csv" | "xlsx" | "json") => {
    if (exportStatus.phase === "working") return;
    setExportStatus({ phase: "working", format });
    try {
      // Fresh rows on every tap: an export is a backup, so it must
      // reflect the collection as it stands right now — never a
      // cached copy from earlier in the visit.
      const data = await api.exportCollection({});
      const comicRows: ExportRow[] = COMICS.map((c) => ({
        type: "Graded Comic",
        name: c.title,
        setOrPublisher: c.publisher,
        number: "",
        finishOrLabel: `CGC ${c.label} 9.8`,
        rarity: c.label,
        qty: 1,
        unitValue: c.value,
        unitPaid: null,
        cert: c.cert,
      }));
      const rows = [...data.rows, ...comicRows];
      const stamp = new Date().toISOString().slice(0, 10);
      let blob: Blob;
      let filename: string;
      if (format === "csv") {
        blob = new Blob([collectionToCsv(rows)], { type: "text/csv" });
        filename = `vault-x-collection-${stamp}.csv`;
      } else if (format === "json") {
        blob = new Blob(
          [collectionToJson(rows, new Date().toISOString())],
          { type: "application/json" },
        );
        filename = `vault-x-collection-${stamp}.json`;
      } else {
        blob = new Blob([collectionToXlsx(rows)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        filename = `vault-x-collection-${stamp}.xlsx`;
      }
      const outcome = await deliverFile(blob, filename);
      if (outcome === "aborted") {
        setExportStatus({ phase: "idle" });
      } else {
        setExportStatus({ phase: outcome, format, filename });
        hapticConfirm();
      }
    } catch {
      setExportStatus({ phase: "error" });
    }
  };

  // Cloud backup status (live from the server) + a manual
  // "Back up now" that runs the full sync on demand. The backup
  // also updates on its own whenever a quantity changes.
  const backup = useQuery({
    queryKey: ["backupStatus"],
    queryFn: () => api.getBackupStatus({}),
    retry: 1,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const runSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await api.syncCollectionBackup({});
      if (res.ok) {
        setSyncNote(
          `Backed up — ${res.items.toLocaleString()} items (${res.copies.toLocaleString()} copies) are on the cloud server.`,
        );
        hapticConfirm();
      } else {
        setSyncNote(
          "The cloud server didn't answer just now — your collection is safe in the app and the backup will catch up on the next sync.",
        );
      }
    } catch {
      setSyncNote(
        "The cloud server didn't answer just now — your collection is safe in the app and the backup will catch up on the next sync.",
      );
    } finally {
      setSyncing(false);
      void backup.refetch();
    }
  };

  const runCheck = async () => {
    setCheck({ status: "checking" });
    // The marker lives in the JS bundle: fetch the page the server
    // is currently serving, look for the marker in it directly (some
    // serving modes inline the bundle), and otherwise follow the
    // page's script reference to the current bundle and look there.
    const markerIn = (text: string): string | null => {
      const m = text.match(/mycollectibles-build-v(\d+)\.(\d+)\.(\d+)/);
      return m ? `${m[1] ?? "0"}.${m[2] ?? "0"}.${m[3] ?? "0"}` : null;
    };
    let found: string | null = null;
    let foundText: string | null = null;
    try {
      const pageRes = await fetch("./", { cache: "no-store" });
      if (pageRes.ok) {
        const html = await pageRes.text();
        found = markerIn(html);
        if (found != null) foundText = html;
        if (found == null) {
          const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)]
            .map((m) => m[1])
            .filter((s): s is string => typeof s === "string");
          for (const src of srcs) {
            try {
              const jsRes = await fetch(
                new URL(src, document.baseURI).toString(),
                { cache: "no-store" },
              );
              if (!jsRes.ok) continue;
              const jsText = await jsRes.text();
              found = markerIn(jsText);
              if (found != null) {
                foundText = jsText;
                break;
              }
            } catch {
              // Try the next script; total failure lands in error.
            }
          }
        }
      }
    } catch {
      // Network failure: found stays null and the error state shows.
    }
    if (found == null) {
      setCheck({ status: "error" });
    } else if (compareVersions(found, APP_VERSION) > 0) {
      // Changelog for the version on offer: prefer the notes embedded
      // in the newer build itself; fall back to this copy's own log.
      const newerLog =
        foundText != null ? changelogInBundle(foundText) : null;
      const notes = notesBetween(
        newerLog ?? CHANGELOG,
        APP_VERSION,
        found,
      );
      setCheck({ status: "available", version: found, notes });
    } else {
      setCheck({ status: "current" });
    }
  };

  // The check also runs on its own when Settings opens, so
  // arriving here from the Home "Update available" note lands
  // on the changelog and the Reload button straight away.
  const autoCheckedRef = useRef(false);
  useEffect(() => {
    if (autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    void runCheck();
  }, []);

  // Reload to update (repair, Nov 2, 2026): a plain
  // window.location.reload() was NOT landing the new version on
  // Anthony's phone — Check for Update fetches with cache:
  // "no-store", so it correctly saw the published build, but the
  // webview answered the plain reload from its HTTP cache and
  // served the OLD page (and with it the old bundle), leaving him
  // on the old version no matter how many times he reloaded. The
  // fix: before reloading, re-fetch the page and its bundle with
  // cache: "reload", which forces the browser to go back to the
  // server AND replaces the cached copies with the fresh ones —
  // so the reload that follows can only serve the new build.
  // Priming is best-effort: if a fetch fails, the plain reload
  // still runs.
  const [reloading, setReloading] = useState(false);
  const reloadToUpdate = async () => {
    if (reloading) return;
    setReloading(true);
    await primeCacheAndReload();
  };

  return (
    <div className="mt-5 pb-2">
      <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
        Settings
      </h1>

      {/* About — the app's name and version, kept together as
          Anthony asked: "Vault X — Version 1.0.0". */}
      <section
        id="settings-about"
        aria-label="About this app"
        className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
          <SettingsSectionIcon id="settings-about" />
          About this app
        </p>
        {/* The name and version line sits at the very top of
            the section (Anthony, Nov 3, 2026). */}
        <h2 className="mt-1.5 font-album text-xl font-bold text-[var(--gold-soft)]">
          {APP_NAME} — Version {APP_VERSION}
        </h2>
        {/* The custom Vault X ring artwork Anthony approved (the
            gunmetal ring with the glowing blue-purple segment and
            the X), shown at the top of About next to the app name —
            the artwork itself lives in the app even though the
            home-screen shell icon is picked from the platform's
            icon pool. The save button hands him the full-size file,
            e.g. to set as a custom shortcut icon on his phone. */}
        <div className="mt-3 flex items-start gap-3.5">
          <button
            type="button"
            onClick={() => setIconZoom(true)}
            aria-label="View the Vault X icon artwork full size"
            className="shrink-0 rounded-2xl"
          >
            <img
              src={vaultXRingArtwork}
              alt="Vault X ring artwork"
              className="h-[88px] w-[88px] rounded-2xl border border-[var(--border)] object-cover"
            />
          </button>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-[var(--dim)]">
              Your collection binder — Lorcana cards and sealed products,
              graded comics, and the collections still to come.
            </p>
            <button
              type="button"
              onClick={() => void saveIconArtwork()}
              disabled={iconSave === "working"}
              className="mt-2.5 inline-block rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--gold-soft)] disabled:opacity-60"
            >
              {iconSave === "working"
                ? "Preparing the artwork…"
                : "Save the icon artwork"}
            </button>
            {iconSave === "shared" && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                Sent — if you picked "Save to Files" or "Save image",
                the full-size artwork is on your phone now.
              </p>
            )}
            {iconSave === "downloaded" && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                Download started — look for vault-x-icon-artwork.webp
                in your downloads.
              </p>
            )}
            {iconSave === "opened" && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                The artwork is open full-size below — press and hold
                it, then choose "Save image".
              </p>
            )}
            {iconSave === "error" && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                That save didn't go through. Tap the artwork to open
                it full-size, then press and hold to save it.
              </p>
            )}
          </div>
        </div>
        {iconZoom && (
          <div
            className="mt-4 border-t border-[var(--border)] pt-4"
            role="dialog"
            aria-label="Vault X icon artwork, full size"
          >
            <img
              src={vaultXRingArtwork}
              alt="Vault X ring artwork, full size — press and hold to save it to your phone"
              className="mx-auto w-full max-w-[320px] rounded-2xl border border-[var(--border)]"
            />
            <p className="mt-2.5 text-center text-xs leading-relaxed text-[var(--dim)]">
              Press and hold the artwork, then choose "Save image" —
              or use the save button above.
            </p>
            <button
              type="button"
              onClick={() => setIconZoom(false)}
              className="mx-auto mt-2 block rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text)]"
            >
              Close
            </button>
          </div>
        )}
        {/* Re-open the one-time Welcome page on demand
            (Anthony, Nov 3, 2026) — for anyone who dismissed
            it too fast. Review mode: a plain close, nothing
            forced. */}
        <div className="mt-4 border-t border-[var(--border)] pt-3.5">
          <button
            type="button"
            onClick={() => {
              hapticTick();
              onShowWelcome();
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--gold-soft)]"
          >
            See the welcome page again
          </button>
        </div>
      </section>

      {/* Quick-jump icons (Anthony, Nov 3, 2026): the page is
          long, so a centered row of small icon buttons under the
          heading scrolls straight to each section. Sections are
          ordered most-used first: updates and requests, theme,
          sharing and the collection controls up top; trade
          availability, data, and about lower down. */}
      <nav
        aria-label="Jump to a Settings section"
        className="mt-3 flex flex-wrap items-center justify-between gap-2"
      >
        {SETTINGS_JUMPS.map((j) => (
          <button
            key={j.id}
            type="button"
            aria-label={`Jump to ${j.label}`}
            title={j.label}
            onClick={() => {
              hapticTick();
              document
                .getElementById(j.id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--gold-soft)] transition active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {j.icon}
            </svg>
          </button>
        ))}
        <SettingsAdminJump />
      </nav>

      {/* Change requests (Anthony, Nov 3, 2026): any user can
          send the developer a change request, bug report, or
          idea from right here — a type plus a text message,
          text only. It goes to the server stamped with their
          username, Collector ID, and the date; Anthony reviews
          them in the Admin section above. */}
      <ChangeRequestSection />

      {/* Theme — pick the app's look. Applies app-wide the moment
          it's tapped and saves to the user's profile, so the choice
          sticks (and follows them across devices). Vault Dark is
          the default. Presentation only: no collection data. */}
      <section
        id="settings-theme"
        aria-label="App theme"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-theme" />
          Theme
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Pick the look you like. It applies right away, everywhere in
          the app, and your choice is saved to your profile.
        </p>
        <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Choose a theme">
          {THEMES.map((t) => {
            const selected = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onThemeChange(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--bg)]"
                    : "border-[var(--border)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-1.5 py-1"
                  style={{ backgroundColor: t.swatches.bg }}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/20"
                    style={{ backgroundColor: t.swatches.surface }}
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/20"
                    style={{ backgroundColor: t.swatches.accent }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text)]">
                    {t.name}
                    {t.id === "vault" ? (
                      <span className="ml-2 text-[11px] font-medium text-[var(--dim)]">
                        Default
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs leading-snug text-[var(--dim)]">
                    {t.blurb}
                  </span>
                </span>
                {selected ? (
                  <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--on-accent)]">
                    Current
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* Your Collections visibility (Anthony, Nov 3, 2026):
          one switch per Home tile — turn off the collections
          you don't collect and their tiles disappear from
          Home; the rest reflow. Display-only: nothing is
          deleted and no totals change. */}
      <section
        id="settings-collections"
        aria-label="Your Collections on Home"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-collections" />
          Your Collections
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Which collection tiles show on your Home page. Turn
          one off and its tile disappears — your collection
          itself is untouched, and you can bring the tile back
          here any time.
        </p>
        <CollectionsVisibilitySwitches />
      </section>

      {/* Sharing — per-friend switches in Settings (Anthony,
          Nov 3, 2026): when sharing is on, that connected
          friend can see your collection; turn it off per
          friend if you don't want them to. Every switch is ON
          by default — people won't know it's off and it would
          cause problems. */}
      <section
        id="settings-sharing"
        aria-label="Sharing"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-sharing" />
          Sharing
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          When sharing is on, that connected friend can see your
          collection; turn it off per friend if you don&rsquo;t
          want them to. Sharing is on by default for every
          connection.
        </p>
        {sharingSettings.isPending ? (
          <p className="mt-3 text-sm text-[var(--dim)]">
            Loading your connections…
          </p>
        ) : (sharingSettings.data?.friends ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-[var(--dim)]">
            No connected friends yet — when you connect with a
            collector, their switch shows up here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {(sharingSettings.data?.friends ?? []).map((f) => (
              <li
                key={f.code}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <span className="truncate">{f.username}</span>
                    {f.isTest ? (
                      <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        Test
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-[var(--dim)]">
                    {f.code} ·{" "}
                    {f.share
                      ? "can see your collection"
                      : "can't see your collection"}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.share}
                  aria-label={`Share my collection with ${f.username}`}
                  disabled={friendShareMutation.isPending}
                  onClick={() => {
                    hapticTick();
                    friendShareMutation.mutate({
                      friendCode: f.code,
                      share: !f.share,
                    });
                  }}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    f.share ? "bg-[var(--gold)]" : "bg-[var(--border)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                      f.share ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Save collection count — both modes (Anthony, Nov 2,
          2026): ON is the manual mode the app has always had,
          where a card's count steppers wait for the Save button;
          OFF is auto-save, where every tap records at once and
          there is no Save button. */}
      <section
        id="settings-save-count"
        aria-label="Save collection count"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
              <SettingsSectionIcon id="settings-save-count" />
              Save collection count
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              On a card&rsquo;s page, the plus and minus buttons
              change the count. With this on, the new count waits
              until you tap Save collection count. Turn it off and
              every tap saves right away — no Save button.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={manualSaveOn}
            aria-label="Save collection count button"
            onClick={toggleManualSave}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${
              manualSaveOn ? "bg-[var(--gold)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                manualSaveOn ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--text)]">
          {manualSaveOn
            ? "Manual — counts wait for the Save button"
            : "Auto-save — every tap saves right away"}
        </p>
      </section>

      {/* Haptics — a light physical tap on selections, with an
          off switch for anyone who doesn't want it. */}
      <section
        id="settings-haptics"
        aria-label="Haptics"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
              <SettingsSectionIcon id="settings-haptics" />
              Haptics
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              A light tap from your phone when you make a selection —
              tabs, tiles, toggles, and the plus and minus buttons —
              and a firmer pulse when something is confirmed. Only
              where your device supports it.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hapticsOn}
            aria-label="Haptic feedback"
            onClick={toggleHaptics}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${
              hapticsOn ? "bg-[var(--gold)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                hapticsOn ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--text)]">
          {hapticsOn ? "Haptics are on" : "Haptics are off"}
        </p>
      </section>

      {/* Trade availability — how many copies of a card are up
          for trade (separate from ownership); Anthony's setting
          keeps one of each back for his master sets. */}
      <section
        id="settings-trade-availability"
        aria-label="Trade availability"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-trade-availability" />
          Trade availability
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          How many copies of a card you&rsquo;re willing to trade
          or part with. What&rsquo;s up for trade is separate from
          what you own — a trade can only include copies this
          setting leaves available.
        </p>
        <div className="mt-3">
          <TradeAvailabilityControl />
        </div>
      </section>

      {/* Payment info (Anthony, Nov 3, 2026): the user's own
          Zelle handle, saved once, shown only inside cash
          purchase orders where they're the seller. */}
      <section
        id="settings-payment"
        aria-label="Payment info"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-payment" />
          Payment info
        </h2>
        <PaymentInfoSection />
      </section>

      {/* Your data & backups (Anthony, Nov 2, 2026): plain answers
          to "will my cataloging work be lost?" — only protections
          that actually exist in the app as built are stated — plus
          the export buttons: the backup a user keeps themselves.
          The exports are real files of the full collection (cards,
          sealed, graded comics) built on the spot. */}
      <section
        id="settings-data"
        aria-label="Your data and backups"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-data" />
          Your data &amp; backups
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--dim)]">
          <li>
            Your collection is stored in the cloud, tied to your
            account — not only on this phone.
          </li>
          <li>
            Every card, sealed product, and graded comic you log is
            also backed up to the Vault X cloud server, and the
            backup updates on its own whenever your collection
            changes.
          </li>
          <li>
            Lose your phone or get a new one? Sign back in and your
            collection is restored from the cloud backup.
          </li>
          <li>
            Your Collector ID name and code are kept on the same
            cloud server, in the Vault X registry.
          </li>
          <li>
            Prices refresh on their own once a day. What you paid
            stays exactly as you recorded it.
          </li>
          <li>
            Want a copy that is yours to keep? Export your full
            collection below — that file is your own backup.
          </li>
        </ul>
        <div className="mt-3 rounded-xl bg-[var(--bg)] px-3 py-2.5">
          <p className="text-sm leading-relaxed text-[var(--text)]">
            Cloud backup
          </p>
          {backup.data ? (
            backup.data.reachable ? (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
                {backup.data.inSync
                  ? `In sync — ${backup.data.cloudItems.toLocaleString()} items (${backup.data.cloudCopies.toLocaleString()} copies) backed up.`
                  : `${backup.data.cloudItems.toLocaleString()} of ${backup.data.localItems.toLocaleString()} items backed up so far — tap Back up now to finish.`}
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
                The cloud server couldn&rsquo;t be reached just now
                to check the backup.
              </p>
            )
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
              Checking your backup&hellip;
            </p>
          )}
          <button
            type="button"
            onClick={() => void runSyncNow()}
            disabled={syncing}
            className="mt-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--gold-soft)] disabled:opacity-60"
          >
            {syncing ? "Backing up…" : "Back up now"}
          </button>
          {syncNote ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              {syncNote}
            </p>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">
          Export your collection
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
          Every card, sealed product, and graded comic you own —
          with quantities, current values, and what you paid.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["csv", "Export as CSV"],
              ["xlsx", "Export as Excel (XLSX)"],
              ["json", "Export as JSON"],
            ] as const
          ).map(([format, label]) => (
            <button
              key={format}
              type="button"
              onClick={() => void runExport(format)}
              disabled={exportStatus.phase === "working"}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--gold-soft)] disabled:opacity-60"
            >
              {exportStatus.phase === "working" &&
              exportStatus.format === format
                ? "Preparing…"
                : label}
            </button>
          ))}
        </div>
        {exportStatus.phase === "shared" && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
            Sent — if you picked &ldquo;Save to Files&rdquo;,{" "}
            {exportStatus.filename} is on your phone now.
          </p>
        )}
        {exportStatus.phase === "downloaded" && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
            Download started — look for {exportStatus.filename} in
            your downloads.
          </p>
        )}
        {exportStatus.phase === "error" && (
          <p className="mt-2 text-xs leading-relaxed text-red-400">
            That export didn&rsquo;t go through. Check your
            connection and tap again.
          </p>
        )}
      </section>

      {/* Admin — owner-only app statistics. Renders nothing at all
          for anyone but Anthony: the server withholds the stats
          from other profiles and this section only appears when
          it confirms the owner. */}
      <AdminPanel />

      {/* Updates — Check for Update lives here, next to the version
          it checks. */}
      <section
        id="settings-updates"
        aria-label="App updates"
        className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
          <SettingsSectionIcon id="settings-updates" />
          App updates
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          You&rsquo;re running Version {APP_VERSION}. When a fix or a
          new feature ships, check here and reload to get it — no
          reinstall, no app store. That&rsquo;s how updates reach
          everyone running the app.
        </p>
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={check.status === "checking"}
          className="mt-3 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
        >
          {check.status === "checking"
            ? "Checking for updates…"
            : "Check for Update"}
        </button>
        {check.status === "current" ? (
          <p className="mt-3 text-sm font-semibold text-emerald-400" role="status">
            You&rsquo;re up to date — Version {APP_VERSION} is the
            latest.
          </p>
        ) : null}
        {check.status === "available" ? (
          <div className="mt-3" role="status">
            <p className="text-sm font-semibold text-[var(--gold-soft)]">
              Update available — Version {check.version} is ready.
            </p>
            {check.notes.length > 0 ? (
              <div className="mt-2.5">
                <p className="text-sm font-semibold text-[var(--text)]">
                  What&rsquo;s new in Version {check.version}:
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--dim)]">
                  {check.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void reloadToUpdate()}
              disabled={reloading}
              className="mt-2.5 w-full rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-bold text-[var(--gold-soft)] disabled:opacity-60"
            >
              {reloading ? "Reloading…" : "Reload to update"}
            </button>
          </div>
        ) : null}
        {check.status === "error" ? (
          <p className="mt-3 text-sm text-red-400" role="status">
            Couldn&rsquo;t check for updates just now — check your
            connection and try again.
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
          How the version numbers work: bug fixes bump the last number
          (1.0.1), new features bump the middle (1.1.0), and a big
          release bumps the first (2.0.0) — so the number alone tells
          you what kind of update you&rsquo;re getting.
        </p>
      </section>

    </div>
  );
}

/** One Admin statistic tile: a big number with a small label. */
function AdminStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--bg)] px-3 py-2.5 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold leading-tight text-[var(--text)]">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--dim)]">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** One storage bar in the Admin panel: how much of a Supabase
    free-plan allotment is used, as a labeled horizontal bar in
    the app's blue-purple accent. */
function StorageBar({
  label,
  usedMb,
  allotMb,
  note,
}: {
  label: string;
  usedMb: number;
  allotMb: number;
  note: string;
}) {
  const pct = allotMb > 0 ? (usedMb / allotMb) * 100 : 0;
  const usedLabel =
    usedMb >= 100
      ? `${Math.round(usedMb).toLocaleString()} MB`
      : `${usedMb.toFixed(2)} MB`;
  const allotLabel =
    allotMb >= 1024
      ? `${(allotMb / 1024).toLocaleString()} GB`
      : `${allotMb.toLocaleString()} MB`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text)]">{label}</p>
        <p className="text-xs tabular-nums text-[var(--dim)]">
          {usedLabel} of {allotLabel} · {pct < 0.01 ? "<0.01" : pct.toFixed(2)}%
          used
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${usedLabel} of ${allotLabel} used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100) / 100}
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--border)]"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{
            width: `${Math.min(100, Math.max(pct, usedMb > 0 ? 0.5 : 0))}%`,
            boxShadow: "0 0 8px rgba(108, 124, 255, 0.55)",
          }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[var(--dim)]">
        {note}
      </p>
    </div>
  );
}

function fmtAdminDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function fmtAdminWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${fmtAdminDay(iso)} · ${d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
}

/** Admin — Anthony's nerd corner (Nov 2, 2026): overall app
    statistics read live from the Vault X server on Supabase —
    registered collectors, items logged app-wide, social counts,
    and system status — with his own collection totals kept in
    their own clearly separate block. The section is owner-only:
    getAdminStats withholds the numbers from every other profile
    and this renders nothing for them. Test profiles (Jarvis, the
    dummy friend) are labeled as test data, and anything the
    server can't provide is labeled rather than dressed up. */
/** The Settings change-request form (Anthony, Nov 3, 2026):
    sits directly under App updates. A type — bug or idea (he
    removed the generic "Change Request" type the same night:
    only Bug and Idea are selectable) — plus a text message
    (text only), sent to the developer through the server,
    stamped with the sender's username, Collector ID, and date. */
function ChangeRequestSection() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sentTicketId, setSentTicketId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Your tickets (Anthony, Nov 3, 2026 — ticket system):
  // everything this collector has submitted, with status and
  // assignee, so a ticket can be followed after it's sent.
  const myTickets = useQuery({
    queryKey: ["myTickets"],
    queryFn: () => api.getMyTickets({}),
  });
  const send = useMutation({
    mutationFn: () =>
      api.submitChangeRequest({ kind, message: message.trim() }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setSent(true);
        setSentTicketId(res.ticketId);
        setMessage("");
        setError(null);
        void queryClient.invalidateQueries({ queryKey: ["myTickets"] });
        void queryClient.invalidateQueries({
          queryKey: ["changeRequests"],
        });
      } else {
        setError(res.error ?? "That didn't go through — try again.");
      }
    },
    onError: () => setError("That didn't go through — try again."),
  });
  return (
    <section
      id="settings-requests"
      aria-label="Send a change request"
      className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h2 className="flex items-center gap-2 font-album text-lg text-[var(--text)]">
        <SettingsSectionIcon id="settings-requests" />
        Send a change request
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Want something changed, found a bug, or have an idea?
        Send it straight to the developer — it opens a ticket,
        with your username and Collector ID on it so he knows
        who it&rsquo;s from, and you can follow the ticket
        below.
      </p>
      {sent ? (
        <div className="mt-3">
          <p
            className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-3 text-sm leading-relaxed text-[var(--text)]"
            role="status"
          >
            Sent ✓ —{" "}
            {sentTicketId != null
              ? `ticket #${sentTicketId} is open. `
              : "your ticket is open. "}
            Follow it under Your tickets below.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticTick();
              setSent(false);
            }}
            className="mt-2.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            Send another
          </button>
        </div>
      ) : (
        <>
          <div
            className="mt-3 flex rounded-full border border-[var(--border)] bg-[var(--bg)] p-1"
            role="group"
            aria-label="Request type"
          >
            {(
              [
                ["bug", "Bug"],
                ["idea", "Idea"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => {
                  hapticTick();
                  setKind(value);
                }}
                className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${
                  kind === value
                    ? "bg-[var(--gold)] font-bold text-black"
                    : "text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Your message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Tell the developer what you'd like changed…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--dim)]"
            />
          </label>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={send.isPending || message.trim().length === 0}
            onClick={() => send.mutate()}
            className="mt-3 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {send.isPending ? "Sending…" : "Send to the developer"}
          </button>
        </>
      )}
      <h3 className="mt-5 font-album text-base text-[var(--text)]">
        Your tickets
      </h3>
      {(myTickets.data?.tickets ?? []).length === 0 ? (
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Tickets you send show up here with their status — Open,
          In Progress, Completed — and who they&rsquo;re assigned
          to, so you can follow them.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {(myTickets.data?.tickets ?? []).map((t) => (
            <li key={t.id} className="py-2.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[var(--text)]">
                  #{t.id}
                </span>
                <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[11px] font-bold text-black">
                  {ticketKindLabel(t.kind)}
                </span>
                <TicketStatusChip status={t.status} />
                <span className="text-xs text-[var(--dim)]">
                  {fmtAdminWhen(t.createdAt)}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-[var(--dim)]">
                {t.message}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--dim)]">
                {t.assignee
                  ? `Assigned to ${t.assignee}`
                  : "Not assigned yet"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One Admin bar chart (Anthony, Nov 3, 2026): daily counts
    over the last 14 days as simple bars — real registry rows
    only, so a quiet day is an honest short bar. The full
    day-by-day figures ride in the accessible label. */
function AdminBarChart({
  title,
  points,
}: {
  title: string;
  points: { date: string; label: string; count: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((s, p) => s + p.count, 0);
  return (
    <div className="rounded-xl bg-[var(--bg)] px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text)]">
          {title}
        </p>
        <p className="text-xs tabular-nums text-[var(--dim)]">
          {total.toLocaleString()} in the last 14 days
        </p>
      </div>
      <div
        className="mt-3 flex h-24 items-end gap-1"
        role="img"
        aria-label={`${title} by day: ${points.map((p) => `${p.label}, ${p.count}`).join("; ")}`}
      >
        {points.map((p) => (
          <div
            key={p.date}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch"
            title={`${p.label}: ${p.count}`}
          >
            <span className="text-[9px] tabular-nums leading-none text-[var(--dim)]">
              {p.count > 0 ? p.count : ""}
            </span>
            <div
              className="w-full rounded-t-[3px] bg-[var(--accent)]"
              style={{
                height: `${Math.max(3, (p.count / max) * 62)}px`,
                opacity: p.count > 0 ? 1 : 0.22,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-[var(--dim)]">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function AdminPanel() {
  const stats = useQuery({
    queryKey: ["adminStats"],
    queryFn: () => api.getAdminStats({}),
    retry: 1,
  });
  const s = stats.data;
  if (!s || !s.isOwner) return null;
  const ownItems =
    s.own.cardCopies + s.own.sealedQty + COMICS.length;
  const ownValue = s.own.lorcanaValue + COMICS_TOTAL_VALUE;
  const kindLabel = (kind: string) =>
    kind === "card"
      ? "Cards"
      : kind === "sealed"
        ? "Sealed"
        : kind === "comic"
          ? "Comics"
          : kind;
  return (
    <>
    <section
      id="settings-admin"
      aria-label="Admin statistics"
      className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
        <SettingsSectionIcon id="settings-admin" />
        Admin · only you see this
      </p>
      <h2 className="mt-1.5 font-album text-lg text-[var(--text)]">
        App statistics
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Live numbers from the Vault X server — every collector, every
        logged item, the whole app.
      </p>

      {!s.reachable ? (
        <p className="mt-3 rounded-xl bg-[var(--bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--dim)]">
          The server couldn&rsquo;t be reached just now, so the
          app-wide numbers are unavailable. Your own collection totals
          at the bottom come from this device and are still current.
        </p>
      ) : null}

      {s.users ? (
        <>
          <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
            Users
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <AdminStat
              label="Registered collectors"
              value={s.users.total.toLocaleString()}
            />
            <AdminStat
              label="New this week"
              value={s.users.newThisWeek.toLocaleString()}
            />
          </div>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl bg-[var(--bg)] px-3">
            {s.users.roster.map((m) => (
              <li key={m.collectorId} className="py-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {m.username}
                  </span>
                  {m.isYou ? (
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--on-accent)]">
                      YOU
                    </span>
                  ) : null}
                  {m.isTest ? (
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold text-[var(--dim)]">
                      TEST
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs tabular-nums text-[var(--dim)]">
                    {m.collectorId}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--dim)]">
                  Trust Score {m.trustScore} ·{" "}
                  {m.itemsOwned.toLocaleString()} items on the server
                  {m.joinedAt
                    ? ` · joined ${fmtAdminDay(m.joinedAt)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
            Item counts are what&rsquo;s stored on the server for each
            collector. Collections back up to the server on their own
            whenever they change, so these counts track the real
            totals — yours are in the block at the bottom too.
          </p>
        </>
      ) : null}

      {s.activity ? (
        <>
          <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
            Collection activity — all users
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <AdminStat
              label="Items logged"
              value={s.activity.totalCopies.toLocaleString()}
              sub={`app-wide · ${s.activity.totalRows.toLocaleString()} stored entries`}
            />
            <AdminStat
              label="Cards logged"
              value={s.activity.cardsLogged.toLocaleString()}
            />
            <AdminStat
              label="Avg items per collector"
              value={s.activity.avgPerCollector.toLocaleString()}
            />
            <AdminStat
              label="Largest collection"
              value={
                s.activity.largest
                  ? s.activity.largest.items.toLocaleString()
                  : "—"
              }
              sub={s.activity.largest?.username}
            />
          </div>
          {s.activity.byKind.length > 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              By type:{" "}
              {s.activity.byKind
                .map(
                  (k) =>
                    `${kindLabel(k.kind)} ${k.copies.toLocaleString()}`,
                )
                .join(" · ")}
            </p>
          ) : null}
          {s.activity.mostOwned.length > 0 ? (
            <>
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">
                Most-owned cards across all collectors
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[var(--dim)]">
                {s.activity.mostOwned.map((c) => (
                  <li key={c.name}>
                    <span className="text-[var(--text)]">{c.name}</span>{" "}
                    — {c.copies.toLocaleString()}{" "}
                    {c.copies === 1 ? "copy" : "copies"} ·{" "}
                    {c.owners.toLocaleString()}{" "}
                    {c.owners === 1 ? "collector" : "collectors"}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              No items are stored on the server yet, so there&rsquo;s
              no most-owned list yet.
            </p>
          )}
        </>
      ) : null}

      <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
        Social
      </h3>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <AdminStat
          label="Connections"
          value={
            s.social.confirmedConnections != null
              ? s.social.confirmedConnections.toLocaleString()
              : "—"
          }
          sub={
            s.social.connections != null
              ? `confirmed · ${s.social.connections.toLocaleString()} total`
              : "confirmed"
          }
        />
        <AdminStat
          label="Trust events"
          value={
            s.social.trustEvents != null
              ? s.social.trustEvents.toLocaleString()
              : "—"
          }
        />
        <AdminStat
          label="Trades"
          value={
            s.social.confirmedTrades != null
              ? s.social.confirmedTrades.toLocaleString()
              : "—"
          }
          sub="confirmed"
        />
      </div>
      {s.social.confirmedConnections == null ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
          The connections and trust tables couldn&rsquo;t be read just
          now — the counts above fill in when the server answers.
        </p>
      ) : null}

      <h3 className="mt-5 text-sm font-semibold text-[var(--text)]">
        Growth — last 14 days
      </h3>
      <div className="mt-2 space-y-2">
        <AdminBarChart
          title="New collectors"
          points={s.series.usersByDay}
        />
        <AdminBarChart
          title="New trades"
          points={s.series.tradesByDay}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
        Counted from the server registry: collectors by the day
        they registered, trades by the day their confirmed-trade
        events landed. The Jarvis and Dummy Friend test profiles
        are part of these numbers, same as the roster above —
        they&rsquo;re labeled TEST there.
      </p>

      {s.deals ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-[var(--text)]">
            Trades and deals
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <AdminStat
              label="Trades proposed"
              value={s.deals.tradesProposed.toLocaleString()}
            />
            <AdminStat
              label="Trades accepted"
              value={s.deals.tradesAccepted.toLocaleString()}
            />
            <AdminStat
              label="Trades completed"
              value={s.deals.tradesCompleted.toLocaleString()}
            />
            <AdminStat
              label="Cash purchases"
              value={s.deals.cashPurchases.toLocaleString()}
              sub={`${s.deals.cashCompleted.toLocaleString()} completed`}
            />
            <AdminStat
              label="Marketplace listings"
              value={s.deals.listingsActive.toLocaleString()}
              sub={`live · ${s.deals.listingsTotal.toLocaleString()} total`}
            />
            <AdminStat
              label="Tickets"
              value={s.deals.pendingChangeRequests.toLocaleString()}
              sub="open tickets in the list below"
            />
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
            Deal records are kept in the app&rsquo;s own database —
            these are the trades, cash purchases, and listings
            recorded here, including the test deals with Jarvis.
          </p>
        </>
      ) : null}

      <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
        System
      </h3>
      <dl className="mt-2 space-y-1.5 rounded-xl bg-[var(--bg)] px-3 py-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--dim)]">App</dt>
          <dd className="text-right font-medium text-[var(--text)]">
            {APP_NAME} — Version {APP_VERSION}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--dim)]">Server (Supabase)</dt>
          <dd
            className={`text-right font-medium ${
              s.reachable ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {s.reachable ? "Reachable" : "Not reachable"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--dim)]">Rows stored on the server</dt>
          <dd className="text-right font-medium tabular-nums text-[var(--text)]">
            {s.system.storedRows.toLocaleString()}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--dim)]">Last registry sync</dt>
          <dd className="text-right font-medium text-[var(--text)]">
            {s.system.registrySyncedAt
              ? fmtAdminWhen(s.system.registrySyncedAt)
              : "Not yet"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--dim)]">Last price snapshot</dt>
          <dd className="text-right font-medium text-[var(--text)]">
            {s.system.lastPriceSnapshot ?? "—"}
          </dd>
        </div>
      </dl>
      <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
        Storage — Supabase free plan
      </h3>
      <div className="mt-2 space-y-3 rounded-xl bg-[var(--bg)] px-3 py-3">
        <StorageBar
          label="Database"
          usedMb={s.system.storage.dbUsedMb}
          allotMb={s.system.storage.dbAllotmentMb}
          note="Estimated from the live row counts and sampled row sizes — Supabase doesn't expose the exact byte size to the app."
        />
        <StorageBar
          label="File storage"
          usedMb={s.system.storage.fileUsedMb}
          allotMb={s.system.storage.fileAllotmentMb}
          note={
            s.system.storage.fileMeasured
              ? "Measured from the files stored on Supabase."
              : "Vault X keeps its photos and files in the app's own storage, not on Supabase — so nothing is stored there."
          }
        />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">
        Your collection — for reference
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <AdminStat
          label="Your items"
          value={ownItems.toLocaleString()}
          sub={`${s.own.cardCopies.toLocaleString()} cards · ${s.own.sealedQty.toLocaleString()} sealed · ${COMICS.length} graded comics`}
        />
        <AdminStat
          label="Your value"
          value={fmtUSD(ownValue)}
          sub="Cards, sealed, and graded comics"
        />
      </div>
    </section>
    <div id="settings-change-requests" className="scroll-mt-4">
      <TicketsInbox />
    </div>
    </>
  );
}

/** Ticket status chip (Anthony, Nov 3, 2026 — the ticket
    system): Open, In Progress, and Completed, visibly shown
    on every ticket in the list and on its detail. */
function TicketStatusChip({ status }: { status: string }) {
  const label =
    status === "in_progress"
      ? "In Progress"
      : status === "completed"
        ? "Completed"
        : "Open";
  const cls =
    status === "in_progress"
      ? "bg-[var(--accent)] text-[var(--on-accent)]"
      : status === "completed"
        ? "bg-emerald-500 text-white"
        : "bg-[#ffd21f] text-[#4a3200]";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

function ticketKindLabel(kind: string): string {
  return kind === "bug" ? "Bug" : kind === "idea" ? "Idea" : "Change Request";
}

/** The developer's change-request TICKETS (Anthony, Nov 3,
    2026 — the ticket system that replaced the email/Outlook
    inbox at his direction, modeled on tickets at his work):
    submitting a change request opens a ticket; the owner
    follows tickets here, assigns them, and moves them Open
    → In Progress → Completed; submitters follow their own
    tickets under the Settings form. This one component is
    the ticket list + detail — it renders inside the Admin
    section of Settings AND inside the standalone ticket
    window the Home envelope opens. Owner-only — the server
    withholds the list from every other profile, and this
    renders nothing when it does. */
function TicketsInbox({
  focusTicketId,
}: {
  /** When the window was opened from the Inbox on a specific
      ticket, open that ticket straight away. */
  focusTicketId?: number | null;
}) {
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: ["changeRequests"],
    queryFn: () => api.getChangeRequests({}),
    retry: 1,
  });
  const [openId, setOpenId] = useState<number | null>(null);
  // Opening a ticket marks it read (its Inbox item clears).
  const markRead = useMutation({
    mutationFn: (id: number) => api.markChangeRequestRead({ id }),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["changeRequests"],
      });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
  const focusHandledRef = useRef(false);
  useEffect(() => {
    if (focusHandledRef.current) return;
    if (focusTicketId == null || !inbox.data) return;
    focusHandledRef.current = true;
    setOpenId(focusTicketId);
  }, [focusTicketId, inbox.data]);
  useEffect(() => {
    if (openId == null || !inbox.data) return;
    const t = inbox.data.requests.find((r) => r.id === openId);
    if (t && !t.readAt) markRead.mutate(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, inbox.data]);
  const setStatus = useMutation({
    mutationFn: (args: {
      id: number;
      status: "open" | "in_progress" | "completed";
    }) => api.setTicketStatus(args),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["changeRequests"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["adminStats"],
      });
      void queryClient.invalidateQueries({ queryKey: ["myTickets"] });
    },
  });
  const setAssignee = useMutation({
    mutationFn: (args: { id: number; assignee: string | null }) =>
      api.setTicketAssignee(args),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["changeRequests"],
      });
      void queryClient.invalidateQueries({ queryKey: ["myTickets"] });
    },
  });
  // One-time TEST ticket (Anthony, Nov 3, 2026): until he
  // finishes it here, the list carries one clearly-labeled
  // test ticket so the envelope → ticket flow can be tried
  // end to end with no real ticket waiting. Its Finish
  // button retires the test (and the Home test envelope).
  const [testOpen, setTestOpen] = useState(false);
  const finishTest = useMutation({
    mutationFn: () => api.dismissEnvelopeTest({}),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["changeRequests"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["collectorId"],
      });
    },
  });
  const data = inbox.data;
  if (!data || !data.isOwner) return null;
  const showTest = !data.envelopeTestSeen;
  const openCount = data.requests.filter(
    (r) => r.status === "open",
  ).length;
  const open = data.requests.find((r) => r.id === openId) ?? null;
  const statusButton = (
    ticketId: number,
    status: "open" | "in_progress" | "completed",
    current: string,
    label: string,
  ) => (
    <button
      key={status}
      type="button"
      disabled={setStatus.isPending || current === status}
      onClick={() => {
        hapticTick();
        setStatus.mutate({ id: ticketId, status });
      }}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-100 ${
        current === status
          ? "bg-[var(--gold)] font-bold text-black"
          : "border border-[var(--border)] text-[var(--text)] disabled:opacity-50"
      }`}
    >
      {label}
    </button>
  );
  return (
    <section
      aria-label="Change request tickets"
      className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
        Admin · only you see this
      </p>
      <h2 className="mt-1.5 font-album text-lg text-[var(--text)]">
        Tickets
        {openCount > 0 ? (
          <span className="ml-2 rounded-full bg-[#ffd21f] px-2 py-0.5 align-middle text-[11px] font-bold text-[#4a3200]">
            {openCount} open
          </span>
        ) : null}
      </h2>
      {testOpen && showTest ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              hapticTick();
              setTestOpen(false);
            }}
            className="text-sm font-semibold text-[var(--gold-soft)]"
          >
            ← Back to tickets
          </button>
          <dl className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Ticket</dt>
              <dd className="font-semibold text-[var(--text)]">Test</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">From</dt>
              <dd className="font-semibold text-[var(--text)]">
                @Jarvis
                <span className="ml-2 font-normal text-xs text-[var(--dim)]">
                  MC-JARVIS
                </span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Status</dt>
              <dd>
                <TicketStatusChip status="open" />
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Assigned</dt>
              <dd className="text-[var(--text)]">Anthony</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Type</dt>
              <dd>
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  Test
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-3 whitespace-pre-wrap border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text)]">
            This is a test ticket — the red envelope on Home brought
            you here, the way it will when a real change request,
            bug report, or idea comes in. Every one of those opens
            a ticket in this list, with its status and who it is
            assigned to, and the person who sent it can follow it
            from Settings. Work a ticket by opening it and moving
            it from Open to In Progress to Completed.
          </p>
          <button
            type="button"
            disabled={finishTest.isPending}
            onClick={() => {
              hapticTick();
              setTestOpen(false);
              finishTest.mutate();
            }}
            className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
          >
            {finishTest.isPending ? "Finishing…" : "Got it — finish the test"}
          </button>
          <p className="mt-2 text-center text-xs leading-relaxed text-[var(--dim)]">
            The test envelope and this test ticket won&rsquo;t come
            back. Real tickets will still arrive here.
          </p>
        </div>
      ) : open ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              hapticTick();
              setOpenId(null);
            }}
            className="text-sm font-semibold text-[var(--gold-soft)]"
          >
            ← Back to tickets
          </button>
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <p className="text-sm text-[var(--text)]">
              <span className="text-[var(--dim)]">Subject:</span>{" "}
              <span className="font-bold">{ticketKindLabel(open.kind)}</span>
            </p>
            <p className="mt-0.5 text-sm text-[var(--text)]">
              <span className="text-[var(--dim)]">From:</span>{" "}
              <span className="font-semibold">@{open.senderUsername}</span>
              <span className="ml-2 text-xs font-normal text-[var(--dim)]">
                {open.senderCode}
              </span>
            </p>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Ticket</dt>
              <dd className="font-semibold text-[var(--text)]">
                #{open.id}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Opened</dt>
              <dd className="text-[var(--text)]">
                {fmtAdminWhen(open.createdAt)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Status</dt>
              <dd>
                <TicketStatusChip status={open.status} />
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--dim)]">Assigned</dt>
              <dd className="text-[var(--text)]">
                {open.assignee ?? "Unassigned"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 whitespace-pre-wrap border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text)]">
            {open.message}
          </p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
            Set status
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {statusButton(open.id, "open", open.status, "Open")}
            {statusButton(open.id, "in_progress", open.status, "In Progress")}
            {statusButton(open.id, "completed", open.status, "Completed")}
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
            Assign to
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Anthony", "Jarvis"].map((name) => (
              <button
                key={name}
                type="button"
                disabled={setAssignee.isPending || open.assignee === name}
                onClick={() => {
                  hapticTick();
                  setAssignee.mutate({ id: open.id, assignee: name });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-100 ${
                  open.assignee === name
                    ? "bg-[var(--gold)] font-bold text-black"
                    : "border border-[var(--border)] text-[var(--text)] disabled:opacity-50"
                }`}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              disabled={setAssignee.isPending || open.assignee == null}
              onClick={() => {
                hapticTick();
                setAssignee.mutate({ id: open.id, assignee: null });
              }}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
            >
              Unassigned
            </button>
          </div>
        </div>
      ) : data.requests.length === 0 && !showTest ? (
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          No tickets yet — when a user sends a change request, bug
          report, or idea from Settings, it opens a ticket here.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {showTest ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  setTestOpen(true);
                }}
                aria-label="Test ticket from Jarvis — tap to open it and finish the test"
                className="flex w-full items-start gap-2.5 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text)]">
                      Test ticket
                    </span>
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      Test
                    </span>
                    <TicketStatusChip status="open" />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--dim)]">
                    From @Jarvis · Assigned to Anthony — tap to open
                    it and finish the test.
                  </span>
                </span>
              </button>
            </li>
          ) : null}
          {data.requests.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  setOpenId(r.id);
                }}
                aria-label={`Ticket ${r.id}: ${ticketKindLabel(r.kind)} from ${r.senderUsername}, status ${r.status === "in_progress" ? "In Progress" : r.status === "completed" ? "Completed" : "Open"}`}
                className="flex w-full items-start gap-2.5 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text)]">
                      {ticketKindLabel(r.kind)}
                    </span>
                    <TicketStatusChip status={r.status} />
                    <span className="text-xs text-[var(--dim)]">
                      {fmtAdminWhen(r.createdAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--text)]">
                    {r.message}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--dim)]">
                    #{r.id} · From @{r.senderUsername} ·{" "}
                    {r.assignee
                      ? `Assigned to ${r.assignee}`
                      : "Unassigned"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One card in Jarvis's collection: the real catalog artwork (the
    binder's own art path), with the foil treatment when Jarvis's
    copy is a foil — same look as a binder pocket. */
function JarvisFriendCardArt({
  cardId,
  foil,
  name,
}: {
  cardId: number;
  foil: boolean;
  name: string;
}) {
  const { url, settled } = useCachedArt(cardId, "grid", true);
  return (
    <div className="pocket-sheen relative aspect-[63/88] overflow-hidden rounded-lg border border-[var(--pocket-edge)]">
      {url ? (
        <img
          src={url}
          alt={`Artwork for ${name}`}
          className={`absolute inset-0 h-full w-full object-cover ${
            foil ? "foil-img" : ""
          }`}
          loading="lazy"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] text-[var(--dim)]">
          {settled ? "Art unavailable" : "Loading…"}
        </span>
      )}
      {url && foil ? (
        <>
          <span className="foil-overlay" aria-hidden="true" />
          <span
            className="foil-shine-band foil-shine-band-grid"
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  );
}

/** "Joined November 2026" from an ISO date; null when unknown. */
function joinedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}

/** One item on a collector profile grid — the server profile-item
    shape, plus (on a friend's profile) how many copies the VIEWER
    owns, which drives the red "Don't own" line. */
type ProfileItemView = ApiResponse<
  typeof api,
  "getProfileItems"
>["items"][number] & { yourQty?: number };

/** Client-side twin of the server's profile-item filtering (used
    for friend collections, which are small and already in hand):
    name tokens as substrings plus an optional collector-number
    token — the same name + number rule as the main Search. */
function matchProfileItems(
  items: ProfileItemView[],
  query: string,
  group: string,
  filter: string,
  sort: string,
): ProfileItemView[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const numberToken = tokens.find((t) => /^\d+$/.test(t.replace(/^#/, "")));
  const nameNeedle = tokens.filter((t) => t !== numberToken).join(" ");
  const out = items.filter((item) => {
    if (group !== "all" && item.groupName !== group) return false;
    if (filter === "cards" && item.cardId == null) return false;
    if (filter === "sealed" && item.sealedName == null) return false;
    if (
      filter === "foils" &&
      (item.cardId == null || !item.finish.toLowerCase().includes("foil"))
    )
      return false;
    if (filter === "enchanteds" && item.rarity !== "Enchanted")
      return false;
    if (nameNeedle && !item.name.toLowerCase().includes(nameNeedle))
      return false;
    if (numberToken) {
      const want = numberToken.replace(/^#/, "");
      const got = (item.printed ?? "").split("/")[0]?.trim() ?? "";
      if (got !== want) return false;
    }
    return true;
  });
  const sorted = [...out];
  if (sort === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "qty") {
    sorted.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  } else {
    sorted.sort(
      (a, b) =>
        (b.unitValue ?? 0) * b.qty - (a.unitValue ?? 0) * a.qty ||
        a.name.localeCompare(b.name),
    );
  }
  return sorted;
}

/** One achievement badge icon: lit in the accent when earned,
    dimmed and hollow when not. */
function BadgeIcon({
  state,
  large,
}: {
  state: BadgeState;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border ${
        large ? "h-11 w-11" : "h-6 w-6"
      } ${
        state.earned
          ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-[var(--gold-soft)]"
          : "border-[var(--border)] bg-[var(--bg)] text-[var(--dim)] opacity-55"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={large ? "h-6 w-6" : "h-3.5 w-3.5"}
      >
        {state.badge.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** The badge row beside a collector's name (Anthony's Shiny
    screenshot has the same little icon row): up to four earned
    badges plus a count, opening the full achievements list. */
function BadgeRow({
  states,
  onOpen,
}: {
  states: BadgeState[];
  onOpen: () => void;
}) {
  const earned = states.filter((s) => s.earned);
  if (earned.length === 0) return null;
  const shown = earned.slice(0, 4);
  return (
    <button
      type="button"
      onClick={() => {
        hapticTick();
        onOpen();
      }}
      aria-label={`Achievements — ${earned.length} of ${states.length} earned. View all achievements.`}
      className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-1.5 pr-2.5"
    >
      {shown.map((s) => (
        <BadgeIcon key={s.badge.id} state={s} />
      ))}
      {earned.length > shown.length ? (
        <span className="text-[11px] font-bold text-[var(--dim)]">
          +{earned.length - shown.length}
        </span>
      ) : null}
    </button>
  );
}

/** The full achievements list: every badge, earned or not, with
    how it's earned and honest progress toward the locked ones. */
/** The "My Decks" button on a profile (Anthony, Nov 2, 2026,
    late): a pressable icon + label that ports the viewer to
    that user's decks page. It sits alongside the profile's
    other elements (Trade Match, achievements) on both Anthony's
    own profile and a friend's. */
/** Gives a boolean sheet its own history entry, the pattern
    every other sheet in the app follows: opening pushes one
    entry, Back (device gesture or the sheet's own close, which
    goes through history) closes ONLY the sheet and lands right
    back where the user was. The decks sheet used to be plain
    state with no entry (Anthony, Nov 3, 2026): Back from My
    Decks popped the PROFILE's entry instead and landed him on
    the Collector ID page. */
function useHistorySheet(
  key: string,
  setOpen: (v: boolean) => void,
) {
  const pushedRef = useRef(false);
  const openSheet = () => {
    setOpen(true);
    try {
      window.history.pushState({ [key]: true }, "");
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
  };
  const closeSheet = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      setOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (
        pushedRef.current &&
        !(window.history.state as Record<string, unknown> | null)?.[
          key
        ]
      ) {
        pushedRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { openSheet, closeSheet };
}

/** The My Decks entry on a profile (Anthony, Nov 3, 2026,
    refined ~1 AM): deliberately a small CIRCULAR icon like an
    app icon — a line-drawn deck of cards inside a circle with
    a thick border, drawn in the same stroke style as the
    Settings quick-jump icons and colored with the theme's own
    variables, so it follows whichever theme is running. NO
    label and no explanation text (the decks page itself
    carries the explanation). A discoverable Easter egg, not
    a big button. It renders centered under the profile's
    Trust Score stat (see ProfileHeader). */
function MyDecksButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTick();
        onOpen();
      }}
      aria-label="My Decks — open the decks page"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)]/30 bg-[var(--surface)] text-[var(--gold-soft)] shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition active:scale-95"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="12" height="15" rx="2" />
        <rect x="3" y="6" width="12" height="15" rx="2" />
        <path d="M6.5 10.5h5" />
      </svg>
    </button>
  );
}

/** Deck box color choices (Anthony, Nov 2, 2026, late): one
    deck box image for the decks page, and the user can change
    ITS color — a per-user choice (per deck once decks exist).
    Each choice is a stain/tint filter over the same photo, so
    the box itself never changes, only its finish. Persisted on
    this device like the other presentation preferences. */
const DECK_BOX_COLORS: {
  id: string;
  label: string;
  swatch: string;
  filter: string;
}[] = [
  { id: "natural", label: "Natural wood", swatch: "#d9c49a", filter: "none" },
  {
    id: "walnut",
    label: "Walnut",
    swatch: "#7a5230",
    filter: "sepia(0.45) saturate(1.25) hue-rotate(-10deg) brightness(0.78) contrast(1.06)",
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "#23283b",
    filter: "saturate(0.22) brightness(0.6) contrast(1.18)",
  },
  {
    id: "royal",
    label: "Royal blue",
    swatch: "#3b5bd6",
    filter: "sepia(0.55) hue-rotate(178deg) saturate(2.1) brightness(0.82)",
  },
  {
    id: "crimson",
    label: "Crimson",
    swatch: "#b3352c",
    filter: "sepia(0.55) hue-rotate(-28deg) saturate(2.3) brightness(0.84)",
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "#2e7d4f",
    filter: "sepia(0.55) hue-rotate(92deg) saturate(1.8) brightness(0.84)",
  },
  {
    id: "violet",
    label: "Violet",
    swatch: "#7a4fd0",
    filter: "sepia(0.55) hue-rotate(228deg) saturate(1.9) brightness(0.86)",
  },
];

const DECK_BOX_COLOR_KEY = "vaultx-deck-box-color";

function readDeckBoxColor(): string {
  try {
    const v = window.localStorage.getItem(DECK_BOX_COLOR_KEY);
    return DECK_BOX_COLORS.some((c) => c.id === v) ? (v as string) : "natural";
  } catch {
    return "natural";
  }
}

/** A user's decks page (Anthony, Nov 2, 2026, late): the custom
    decks that user is currently playing, presented as display
    pieces with their cards — the showcase the profile's My
    Decks button opens. One deck box image fronts the page —
    the single custom wooden deck box photo Anthony picked
    from the pulled Etsy deck-case photos (credited under the
    image) — and its color is the viewer's own choice on their
    own page. Deck building/display design itself is in
    Anthony's workshop queue, so no deck data exists yet: when
    a user has no decks, the page says so plainly instead of
    showing anything invented. Copies allocated to a deck will
    be shown in that deck and stay out of trade availability,
    per his Binder/Deck allocation idea. */
function DecksSheet({
  heading,
  ownerName,
  isOwn,
  onClose,
}: {
  heading: string;
  ownerName: string;
  isOwn: boolean;
  onClose: () => void;
}) {
  const [boxColor, setBoxColor] = useState<string>(() =>
    isOwn ? readDeckBoxColor() : "natural",
  );
  const activeColor =
    DECK_BOX_COLORS.find((c) => c.id === boxColor) ?? DECK_BOX_COLORS[0]!;
  const pickColor = (id: string) => {
    hapticTick();
    setBoxColor(id);
    try {
      window.localStorage.setItem(DECK_BOX_COLOR_KEY, id);
    } catch {
      // Preference just won't persist on this device.
    }
  };
  // The deck builder (Anthony, Nov 3, 2026): the owner's own
  // decks live here — create, edit, delete, and the On
  // display switch that presents them on this page. A
  // friend's page has no deck source in this app and keeps
  // the plain empty state.
  const queryClient = useQueryClient();
  const decksQuery = useQuery({
    queryKey: ["decks"],
    queryFn: () => api.getMyDecks({}),
    enabled: isOwn,
  });
  const myDecks = decksQuery.data?.decks ?? [];
  const displayedDecks = myDecks.filter((d) => d.displayed);
  const [deckMode, setDeckMode] = useState<
    | { kind: "list" }
    | { kind: "build"; deck: DeckViewT | null }
    | { kind: "view"; deck: DeckViewT }
  >({ kind: "list" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(
    null,
  );
  const invalidateDecks = () =>
    void queryClient.invalidateQueries({ queryKey: ["decks"] });
  const setDisplayed = useMutation({
    mutationFn: (args: { id: number; displayed: boolean }) =>
      api.setDeckDisplayed(args),
    onSuccess: invalidateDecks,
  });
  const deleteDeckMut = useMutation({
    mutationFn: (id: number) => api.deleteDeck({ id }),
    onSuccess: () => {
      setConfirmDeleteId(null);
      invalidateDecks();
    },
  });
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to profile"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close decks page"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>
        <h2 className="font-album mt-4 text-[22px] font-bold leading-tight text-[var(--text)]">
          {heading}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {isOwn
            ? "The decks you are currently playing, shown off as display pieces with their cards."
            : `The decks ${ownerName} is currently playing, shown off as display pieces with their cards.`}
        </p>
        {deckMode.kind === "list" ? (
        <>
        <figure className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <img
              src={deckBoxPhoto}
              alt="A custom wooden deck box with a patterned magnetic top, sitting on a gaming table"
              className="aspect-[4/3] w-full object-cover object-center"
              style={{ filter: activeColor.filter }}
            />
          </div>
          <figcaption className="mt-1.5 px-1 text-xs leading-relaxed text-[var(--dim)]">
            {isOwn
              ? `Your deck box, shown in ${activeColor.label.toLowerCase()}. Photo: a custom wooden deck box from an `
              : "The deck box look for this page. Photo: a custom wooden deck box from an "}
            <a
              href="https://www.etsy.com/listing/4462623898/wooden-deck-box-customizable-with"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--gold-soft)] underline"
            >
              Etsy listing
            </a>
            .
          </figcaption>
        </figure>
        {isOwn ? (
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p
              id="deck-box-color-label"
              className="text-sm font-semibold text-[var(--text)]"
            >
              Deck box color
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
              Your choice — it follows your decks page.
            </p>
            <div
              role="group"
              aria-labelledby="deck-box-color-label"
              className="mt-3 flex flex-wrap gap-2"
            >
              {DECK_BOX_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={boxColor === c.id}
                  aria-label={`Deck box color: ${c.label}`}
                  onClick={() => pickColor(c.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${
                    boxColor === c.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--dim)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-white/25"
                    style={{ backgroundColor: c.swatch }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        </>
        ) : null}
        {deckMode.kind === "list" &&
        (!isOwn || displayedDecks.length === 0) ? (
        <div
          className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center"
          role="status"
        >
          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--gold-soft)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <rect x="8" y="3" width="13" height="17" rx="2" />
              <path d="M5 7v11a2 2 0 0 0 2 2h9" />
              <path d="M11.5 8.5h6M11.5 12h6" />
            </svg>
          </span>
          <p className="mt-3 text-base font-semibold text-[var(--text)]">
            No decks on display yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--dim)]">
            {isOwn
              ? "You have not put any decks on display yet. Decks you build and choose to show off will appear here, presented with their cards — and copies sitting in a deck are set aside in it, not part of what you can trade."
              : `${ownerName} has not put any decks on display yet. Decks they build and choose to show off will appear here, presented with their cards.`}
          </p>
        </div>
        ) : null}
        {isOwn && deckMode.kind === "build" ? (
          <DeckBuilder
            initial={deckMode.deck}
            onDone={() => setDeckMode({ kind: "list" })}
            onCancel={() => setDeckMode({ kind: "list" })}
          />
        ) : null}
        {isOwn && deckMode.kind === "view" ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDeckMode({ kind: "list" })}
              className="text-sm font-semibold text-[var(--gold-soft)]"
            >
              ← Back to your decks
            </button>
            <h3 className="font-album mt-2 text-lg text-[var(--text)]">
              {deckMode.deck.name}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--dim)]">
              {deckMode.deck.totalCards} cards
              {deckMode.deck.inks.length > 0
                ? ` · ${deckMode.deck.inks.join(" / ")}`
                : ""}
            </p>
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              {deckMode.deck.cards.map((c) => (
                <li
                  key={c.cardId}
                  className="flex items-baseline justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--text)]">
                      {c.fullName}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      {c.groupName} · #{c.printed}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]">
                    ×{c.qty}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {isOwn && deckMode.kind === "list" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-album text-lg text-[var(--text)]">
                Your decks
              </h3>
              <button
                type="button"
                onClick={() =>
                  setDeckMode({ kind: "build", deck: null })
                }
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)]"
              >
                Create a deck
              </button>
            </div>
            {decksQuery.isPending ? (
              <p className="mt-2 text-sm text-[var(--dim)]">
                Loading your decks…
              </p>
            ) : myDecks.length === 0 ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                No decks yet — create your first one and it can
                go on display here. Copies in a deck are set
                aside in it: with the decks hold-back on in
                Trade availability, they are not tradeable.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {myDecks.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDeckMode({ kind: "view", deck: d })
                        }
                        className="min-w-0 text-left"
                        aria-label={`View the ${d.name} deck list`}
                      >
                        <span className="block truncate text-base font-semibold text-[var(--text)]">
                          {d.name}
                        </span>
                        <span className="block text-xs text-[var(--dim)]">
                          {d.totalCards} / 60 cards
                          {d.inks.length > 0
                            ? ` · ${d.inks.join(" / ")}`
                            : ""}
                        </span>
                      </button>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-[var(--dim)]">
                        On display
                        <button
                          type="button"
                          role="switch"
                          aria-checked={d.displayed}
                          aria-label={`Put ${d.name} on display`}
                          disabled={setDisplayed.isPending}
                          onClick={() =>
                            setDisplayed.mutate({
                              id: d.id,
                              displayed: !d.displayed,
                            })
                          }
                          className={`flex h-7 w-12 items-center rounded-full border px-1 transition ${
                            d.displayed
                              ? "justify-end border-[var(--accent)] bg-[var(--accent)]/30"
                              : "justify-start border-[var(--border)] bg-[var(--bg)]"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-5 w-5 rounded-full ${
                              d.displayed
                                ? "bg-[var(--accent)]"
                                : "bg-[var(--dim)]"
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDeckMode({ kind: "build", deck: d })
                        }
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                      >
                        Edit
                      </button>
                      {confirmDeleteId === d.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => deleteDeckMut.mutate(d.id)}
                            className="rounded-full border border-red-400/60 px-3 py-1.5 text-xs font-semibold text-red-300"
                          >
                            Delete for good?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--dim)]"
                          >
                            Keep it
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(d.id)}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--dim)]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {displayedDecks.length > 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
                On display: {displayedDecks.map((d) => d.name).join(", ")} —
                anyone viewing your profile sees these decks here
                and can open their card lists.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type DeckViewT = ApiResponse<typeof api, "getMyDecks">["decks"][number];

/** The deck builder (Anthony, Nov 3, 2026): name the deck,
    add cards from your OWN collection (search by name, or
    name + number), quantities capped at what you own and at
    4 copies per card name, with the running total shown
    against the 60 cards a Lorcana deck holds. Saving is
    validated again on the server. */
function DeckBuilder({
  initial,
  onDone,
  onCancel,
}: {
  initial: DeckViewT | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Map<number, number>>(
    () =>
      new Map(
        (initial?.cards ?? []).map((c) => [c.cardId, c.qty] as const),
      ),
  );
  // Card info for every line (from the deck being edited and
  // from candidate results) so totals and caps can be shown.
  const [info, setInfo] = useState<
    Map<
      number,
      { fullName: string; printed: string; groupName: string; ink: string | null; ownedQty: number }
    >
  >(
    () =>
      new Map(
        (initial?.cards ?? []).map(
          (c) =>
            [
              c.cardId,
              {
                fullName: c.fullName,
                printed: c.printed,
                groupName: c.groupName,
                ink: c.ink,
                ownedQty: Number.MAX_SAFE_INTEGER,
              },
            ] as const,
        ),
      ),
  );
  const candidates = useQuery({
    queryKey: ["deckCandidates", search],
    queryFn: () => api.getDeckCandidates({ search }),
    enabled: search.trim().length >= 2,
  });
  const total = [...lines.values()].reduce((s, q) => s + q, 0);
  const nameCount = (fullName: string, exceptId?: number) => {
    let n = 0;
    for (const [cid, q] of lines) {
      if (cid === exceptId) continue;
      if (info.get(cid)?.fullName === fullName) n += q;
    }
    return n;
  };
  const setLineQty = (
    cardId: number,
    qty: number,
    meta?: { fullName: string; printed: string; groupName: string; ink: string | null; ownedQty: number },
  ) => {
    if (meta) {
      setInfo((prev) => new Map(prev).set(cardId, meta));
    }
    setLines((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(cardId);
      else next.set(cardId, qty);
      return next;
    });
  };
  const save = useMutation({
    mutationFn: () =>
      api.saveDeck({
        id: initial?.id ?? null,
        name: name.trim(),
        cards: [...lines.entries()].map(([cardId, qty]) => ({
          cardId,
          qty,
        })),
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        void queryClient.invalidateQueries({ queryKey: ["decks"] });
        onDone();
      }
    },
  });
  const saveError =
    save.data && !save.data.ok
      ? save.data.error
      : save.isError
        ? "That deck didn't save — try again."
        : null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-album text-lg text-[var(--text)]">
          {initial ? "Edit deck" : "Create a deck"}
        </h3>
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold tabular-nums ${
            total === 60
              ? "border-emerald-400/50 text-emerald-300"
              : "border-[var(--border)] text-[var(--dim)]"
          }`}
          aria-label={`${total} of 60 cards in this deck`}
        >
          {total} / 60
        </span>
      </div>
      <label
        htmlFor="deck-name"
        className="mt-3 block text-sm font-medium text-[var(--text)]"
      >
        Deck name
      </label>
      <input
        id="deck-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        placeholder="e.g. Clue Crew Tempo"
        className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--dim)]"
      />
      <label
        htmlFor="deck-card-search"
        className="mt-4 block text-sm font-medium text-[var(--text)]"
      >
        Add cards from your collection
      </label>
      <input
        id="deck-card-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your cards by name…"
        className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--dim)]"
      />
      {search.trim().length >= 2 ? (
        <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {candidates.isPending ? (
            <li className="px-3 py-2.5 text-sm text-[var(--dim)]">
              Searching your collection…
            </li>
          ) : (candidates.data?.candidates ?? []).length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[var(--dim)]">
              No owned cards match that search.
            </li>
          ) : (
            (candidates.data?.candidates ?? []).map((c) => {
              const inDeck = lines.get(c.cardId) ?? 0;
              const perName = nameCount(c.fullName);
              const capped =
                inDeck >= c.ownedQty || perName >= 4 || total >= 60;
              return (
                <li
                  key={c.cardId}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--text)]">
                      {c.fullName}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      {c.groupName} · #{c.printed} · you own{" "}
                      {c.ownedQty}
                      {inDeck > 0 ? ` · ${inDeck} in deck` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={capped}
                    onClick={() =>
                      setLineQty(c.cardId, inDeck + 1, {
                        fullName: c.fullName,
                        printed: c.printed,
                        groupName: c.groupName,
                        ink: c.ink,
                        ownedQty: c.ownedQty,
                      })
                    }
                    aria-label={`Add one ${c.fullName} to the deck`}
                    className="shrink-0 rounded-full border border-[var(--accent)]/60 px-3 py-1.5 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-35"
                  >
                    Add
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
      {lines.size > 0 ? (
        <>
          <h4 className="mt-4 text-sm font-semibold text-[var(--text)]">
            In this deck
          </h4>
          <ul className="mt-1.5 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {[...lines.entries()]
              .map(([cardId, qty]) => ({
                cardId,
                qty,
                meta: info.get(cardId),
              }))
              .sort((a, b) =>
                (a.meta?.fullName ?? "").localeCompare(
                  b.meta?.fullName ?? "",
                ),
              )
              .map(({ cardId, qty, meta }) => (
                <li
                  key={cardId}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--text)]">
                      {meta?.fullName ?? `Card ${cardId}`}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      {meta?.groupName} · #{meta?.printed}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLineQty(cardId, qty - 1)}
                      aria-label={`Remove one ${meta?.fullName ?? "card"} from the deck`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-base text-[var(--text)]"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold tabular-nums text-[var(--text)]">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLineQty(cardId, qty + 1)}
                      disabled={
                        meta != null &&
                        meta.ownedQty !== Number.MAX_SAFE_INTEGER &&
                        qty >= meta.ownedQty
                      }
                      aria-label={`Add one more ${meta?.fullName ?? "card"} to the deck`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-base text-[var(--text)] disabled:opacity-35"
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
          No cards yet — search above and add the cards you own.
          A Lorcana deck holds 60 cards, at most 4 copies of any
          one card name.
        </p>
      )}
      {saveError ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {saveError}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={
            name.trim().length === 0 || lines.size === 0 || save.isPending
          }
          onClick={() => save.mutate()}
          className="flex-1 rounded-full bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save deck"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--border)] px-4 py-3 text-base font-semibold text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AchievementsSheet({
  states,
  ownerLabel,
  onClose,
}: {
  states: BadgeState[];
  ownerLabel: string;
  onClose: () => void;
}) {
  const earnedCount = states.filter((s) => s.earned).length;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`${ownerLabel} achievements`}
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to profile"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close achievements"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>
        <h2 className="font-album mt-4 text-[22px] font-bold leading-tight text-[var(--text)]">
          Achievements
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          {earnedCount} of {states.length} earned. Badges come only
          from real collection and social data — finished sets,
          verified trades, confirmed connections — never from taps
          or upvotes, and nobody can grant one by hand.
        </p>
        <ul className="mt-4 space-y-2">
          {states.map((s) => (
            <li
              key={s.badge.id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <BadgeIcon state={s} large />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {s.badge.name}
                </span>
                <span className="block text-xs leading-snug text-[var(--dim)]">
                  {s.badge.how}
                </span>
                {!s.earned && s.progress ? (
                  <span className="mt-0.5 block text-xs font-medium text-[var(--gold-soft)]">
                    {s.progress}
                  </span>
                ) : null}
              </span>
              {s.earned ? (
                <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--on-accent)]">
                  EARNED
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold text-[var(--dim)]">
                  LOCKED
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One tile in a profile's two-column item grid (modeled on
    Anthony's Shiny profile): artwork, name, set line, finish line
    in the accent, the value • qty line, and — on a friend's
    profile — the overlap line against the viewer's collection. */
/** The cash insignia on the green third of the split button:
    a banknote — outline bill with the center medallion and
    corner marks. No text: the symbol alone says cash. */
function CashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="2" y="5.5" width="20" height="13" rx="2" />
      <circle cx="12" cy="12" r="2.7" />
      <path d="M5.6 9.2h.01" strokeWidth="2.8" />
      <path d="M18.4 14.8h.01" strokeWidth="2.8" />
    </svg>
  );
}

/** The Zelle mark (Anthony, Nov 3, 2026): Zelle's own glyph
    is a bold Z in its purple — drawn here as a small purple
    rounded square with a white Z, used wherever Zelle is
    named in the app (the split button's cash segment, the
    "Pay the seller" line on a purchase order, Settings >
    Payment info). Decorative; the text next to it carries
    the meaning. */
function ZelleMark({ className = "h-4 w-4 text-[10px]" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[4px] bg-[#6d1ed4] font-black leading-none text-white ${className}`}
    >
      Z
    </span>
  );
}

function ProfileItemTile({
  item,
  onOpenCard,
  onOpenSealed,
  onWant,
  onCash,
  availableQty,
  cartTradeQty,
  cartCashQty,
}: {
  item: ProfileItemView;
  onOpenCard: (id: number) => void;
  onOpenSealed?: (name: string) => void;
  /** Anthony's trade-flow entry (Nov 2, 2026, late): on a
      FRIEND's cards, an "I want this" button that opens a new
      trade in the Trades area with this card on the get side. */
  onWant?: (item: ProfileItemView) => void;
  /** The cash third of the split button (Anthony's direction,
      later Nov 2, 2026): tapping it adds the card to the cash
      cart toward cash checkout. */
  onCash?: (item: ProfileItemView) => void;
  /** Copies of this card the owner has available to part with
      (Anthony's visibility rule): when this is 0 the split
      button does not render at all — absent, never greyed.
      Undefined = availability not tracked here, button shows. */
  availableQty?: number;
  /** Copies of this card already in the viewer's carts, shown
      as a small line under the button. */
  cartTradeQty?: number;
  cartCashQty?: number;
}) {
  const total = item.unitValue != null ? item.unitValue * item.qty : null;
  const open =
    item.cardId != null
      ? () => onOpenCard(item.cardId as number)
      : item.sealedName != null && onOpenSealed
        ? () => onOpenSealed(item.sealedName as string)
        : undefined;
  const inner = (
    <>
      {item.cardId != null ? (
        <JarvisFriendCardArt
          cardId={item.cardId}
          foil={item.finish !== "Regular"}
          name={item.name}
        />
      ) : (
        <span className="relative block aspect-square overflow-hidden rounded-lg border border-[var(--pocket-edge)]">
          <img
            src={
              (item.sealedName != null
                ? SEALED_PHOTOS[item.sealedName]
                : undefined) ?? sealedBoosterFront
            }
            alt={`${item.name} photo`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </span>
      )}
      <span className="mt-2 block text-sm font-semibold leading-tight text-[var(--text)]">
        {item.name}
        {item.printed ? ` ${item.printed.split("/")[0]}` : ""}
      </span>
      <span className="mt-0.5 block truncate text-xs text-[var(--dim)]">
        {item.groupName}
      </span>
      <span className="block text-xs font-medium text-[var(--accent)]">
        {item.finish}
        {item.sealedName != null ? " · Sealed" : ""}
      </span>
      <span className="mt-1 block text-sm font-semibold text-[var(--text)]">
        {total != null ? `${fmtUSD(total)} Value` : "Value not tracked"}
        {" · "}
        <span className="font-medium text-[var(--dim)]">
          Qty {item.qty}
        </span>
      </span>
      {item.yourQty != null ? (
        <span
          className={`mt-0.5 block text-xs font-semibold ${
            item.yourQty > 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {item.yourQty > 0 ? `You own ×${item.yourQty} too` : "Don’t own"}
        </span>
      ) : null}
    </>
  );
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
      {open ? (
        <button
          type="button"
          onClick={open}
          aria-label={`Open ${item.name} — ${item.finish}, quantity ${item.qty}${item.yourQty != null ? (item.yourQty > 0 ? `. You own ${item.yourQty} too` : ". Don't own") : ""}`}
          className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {inner}
        </button>
      ) : (
        <div>{inner}</div>
      )}
      {onWant &&
      item.cardId != null &&
      (availableQty == null || availableQty > 0) ? (
        onCash ? (
          /* Split button (Anthony, Nov 2, 2026, late): ONE pill,
             two independently tappable zones — the blue two-thirds
             starts the card trade ("I want this", exactly as
             before), the green third with the cash insignia opens
             the cash purchase for the same card. Both zones keep
             the restyled depth/glow treatment. SLIMMED hard at
             his direction later that night ("a lot thinner —
             squeeze it in, from top to bottom, a lot tighter"):
             py-1 and text-xs make it a tight strip under the
             card; the tightness is his explicit call here. */
          <div className="mt-2 flex w-full overflow-hidden rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.35),0_0_10px_rgba(108,124,255,0.3)] ring-1 ring-white/25">
            <button
              type="button"
              onClick={() => {
                hapticTick();
                onWant(item);
              }}
              aria-label={`I want this: add ${item.name}, ${item.finish} to your trade cart`}
              style={{
                backgroundImage:
                  "linear-gradient(180deg, color-mix(in srgb, var(--accent) 68%, #ffffff) 0%, var(--accent) 52%, color-mix(in srgb, var(--accent) 76%, #101736) 100%)",
              }}
              className="flex flex-[2] items-center justify-center gap-1 whitespace-nowrap px-2 py-1.5 text-[11px] font-bold text-[var(--on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_5px_rgba(0,0,0,0.25)] transition-transform duration-100 active:scale-[0.98]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 shrink-0"
                aria-hidden="true"
              >
                <path d="M4 7h13" />
                <path d="m13 3 4 4-4 4" />
                <path d="M20 17H7" />
                <path d="m11 13-4 4 4 4" />
              </svg>
              I want this
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                onCash(item);
              }}
              aria-label={`Buy for cash / Zelle: add ${item.name}, ${item.finish} to your cash cart`}
              style={{
                backgroundImage:
                  "linear-gradient(180deg, color-mix(in srgb, #22c55e 62%, #ffffff) 0%, #22c55e 52%, color-mix(in srgb, #22c55e 74%, #052e16) 100%)",
              }}
              className="flex flex-[1] items-center justify-center gap-1 border-l-2 border-white/30 px-3 py-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_5px_rgba(0,0,0,0.28),0_0_10px_rgba(34,197,94,0.35)] transition-transform duration-100 active:scale-[0.96]"
            >
              {/* Cash–Zelle pairing (Anthony, Nov 3, 2026):
                  the green segment carries the cash icon and
                  the Zelle mark together, hyphen-paired, so
                  the buy-outright side reads as pay cash/Zelle.
                  Size, colors, and styling are unchanged. */}
              <CashIcon />
              <span aria-hidden="true" className="text-[10px] font-black leading-none">
                –
              </span>
              <ZelleMark className="h-3.5 w-3.5 text-[9px]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticTick();
              onWant(item);
            }}
            aria-label={`I want this: start a trade for ${item.name}, ${item.finish}`}
            style={{
              backgroundImage:
                "linear-gradient(180deg, color-mix(in srgb, var(--accent) 68%, #ffffff) 0%, var(--accent) 52%, color-mix(in srgb, var(--accent) 76%, #101736) 100%)",
            }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-[var(--on-accent)] shadow-[0_4px_10px_rgba(0,0,0,0.35),0_0_10px_rgba(108,124,255,0.35),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_5px_rgba(0,0,0,0.25)] ring-1 ring-white/25 transition-transform duration-100 active:scale-[0.98]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M4 7h13" />
              <path d="m13 3 4 4-4 4" />
              <path d="M20 17H7" />
              <path d="m11 13-4 4 4 4" />
            </svg>
            I want this
          </button>
        )
      ) : null}
      {(cartTradeQty ?? 0) > 0 || (cartCashQty ?? 0) > 0 ? (
        <p className="mt-1.5 text-center text-[11px] font-semibold text-emerald-400">
          {[
            (cartTradeQty ?? 0) > 0
              ? `In trade cart ×${cartTradeQty}`
              : null,
            (cartCashQty ?? 0) > 0
              ? `In cash cart ×${cartCashQty}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </li>
  );
}

type ProfileSort = "value" | "name" | "qty";
type ProfileFilter = "all" | "cards" | "sealed" | "foils" | "enchanteds";

/** The "All Collected Items" section of a profile (Anthony's
    Shiny layout): result count, a Viewing • group selector, a
    Search items… bar, Sort and Filter pills, and the two-column
    grid. Fully controlled — each profile page wires its own data
    source (server query for his own items, in-hand list for a
    friend's) into the same controls. */
function ProfileCollectionSection({
  total,
  groups,
  query,
  onQueryChange,
  group,
  onGroupChange,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  items,
  loading,
  emptyText,
  onOpenCard,
  onOpenSealed,
  onWantItem,
  onCashItem,
  cartCounts,
}: {
  total: number;
  groups: string[];
  query: string;
  onQueryChange: (v: string) => void;
  group: string;
  onGroupChange: (v: string) => void;
  sort: ProfileSort;
  onSortChange: (v: ProfileSort) => void;
  filter: ProfileFilter;
  onFilterChange: (v: ProfileFilter) => void;
  items: ProfileItemView[];
  loading: boolean;
  emptyText: string;
  onOpenCard: (id: number) => void;
  onOpenSealed?: (name: string) => void;
  onWantItem?: (item: ProfileItemView) => void;
  onCashItem?: (item: ProfileItemView) => void;
  cartCounts?: Map<string, { trade: number; cash: number }>;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-album text-lg text-[var(--text)]">
            All Collected Items
          </h3>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            {total.toLocaleString()} Results
          </p>
        </div>
        <label className="shrink-0">
          <span className="sr-only">Choose which group to view</span>
          <select
            value={group}
            onChange={(e) => onGroupChange(e.target.value)}
            className="max-w-[168px] rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text)]"
          >
            <option value="all">Viewing • All Groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                Viewing • {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="relative mt-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8a96]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search items…"
          aria-label="Search items"
          className="h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-12 pr-4 text-base text-[var(--text)] placeholder:italic placeholder:text-[#8a8a96]"
        />
      </div>

      <div className="mt-2.5 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Sort items</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ProfileSort)}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]"
          >
            <option value="value">Sort • Total Value</option>
            <option value="name">Sort • Name</option>
            <option value="qty">Sort • Quantity</option>
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Filter items</span>
          <select
            value={filter}
            onChange={(e) =>
              onFilterChange(e.target.value as ProfileFilter)
            }
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]"
          >
            <option value="all">All Items</option>
            <option value="cards">Cards</option>
            <option value="sealed">Sealed</option>
            <option value="foils">Foils</option>
            <option value="enchanteds">Enchanteds</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--dim)]">
          Loading items…
        </p>
      ) : items.length === 0 ? (
        <p
          className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm leading-relaxed text-[var(--dim)]"
          role="status"
        >
          {emptyText}
        </p>
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {items.map((item) => (
              <ProfileItemTile
                key={item.key}
                item={item}
                onOpenCard={onOpenCard}
                onOpenSealed={onOpenSealed}
                onWant={onWantItem}
                onCash={onCashItem}
                availableQty={item.qty}
                cartTradeQty={
                  item.cardId != null
                    ? cartCounts?.get(cartKeyOf(item.cardId, item.finish))
                        ?.trade
                    : undefined
                }
                cartCashQty={
                  item.cardId != null
                    ? cartCounts?.get(cartKeyOf(item.cardId, item.finish))
                        ?.cash
                    : undefined
                }
              />
            ))}
          </ul>
          {total > items.length ? (
            <p className="mt-3 text-center text-xs leading-relaxed text-[var(--dim)]">
              Showing the top {items.length.toLocaleString()} of{" "}
              {total.toLocaleString()} — search or filter to narrow it
              down.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The Trade Match tab on a friend's profile (Anthony, Nov 2,
    2026 — the upgrade of the "Cards They Have That I Need"
    button, which it replaces): a two-way comparison with a
    toggle. "They Have, You Need" is the friend's cards the
    viewer doesn't own (the red "Don't own" set); "You Have,
    They Need" runs the other way against the viewer's own
    collection. Both views carry the name + collector-number
    search and the set filter. */
function TradeMatchView({
  friendName,
  friendItems,
  friendLoading,
  onOpenCard,
  onWantItem,
  onCashItem,
  cartCounts,
}: {
  friendName: string;
  friendItems: ProfileItemView[];
  friendLoading: boolean;
  onOpenCard: (id: number) => void;
  onWantItem?: (item: ProfileItemView) => void;
  onCashItem?: (item: ProfileItemView) => void;
  cartCounts?: Map<string, { trade: number; cash: number }>;
}) {
  const [direction, setDirection] = useState<"they" | "you">("they");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const theyNeed = useMemo(
    () => friendItems.filter((c) => (c.yourQty ?? 0) === 0),
    [friendItems],
  );
  const friendNames = useMemo(
    () => [...new Set(friendItems.map((c) => c.name))],
    [friendItems],
  );
  const theyGroups = useMemo(
    () => [...new Set(theyNeed.map((c) => c.groupName))].sort(),
    [theyNeed],
  );
  const theyShown = useMemo(
    () => matchProfileItems(theyNeed, query, group, "all", "value"),
    [theyNeed, query, group],
  );
  const youQuery = useQuery({
    queryKey: ["tradeMatch", friendNames.join("|"), query, group],
    queryFn: () =>
      api.getTradeMatchItems({
        excludeNames: friendNames,
        query,
        group,
      }),
    enabled: direction === "you",
  });
  const switchDirection = (next: "they" | "you") => {
    if (next === direction) return;
    hapticTick();
    setDirection(next);
    setGroup("all");
  };
  const activeGroups =
    direction === "they" ? theyGroups : (youQuery.data?.groups ?? []);
  const countLine =
    direction === "they"
      ? friendLoading
        ? "Loading their collection…"
        : `${theyNeed.length} of ${friendName}’s cards are ones you don’t own.`
      : youQuery.data
        ? `${youQuery.data.total.toLocaleString()} of your cards are ones ${friendName} doesn’t have.`
        : "Checking your collection…";
  const shownItems: ProfileItemView[] =
    direction === "they" ? theyShown : (youQuery.data?.items ?? []);
  const isLoading =
    direction === "they" ? friendLoading : youQuery.isPending;
  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="Trade Match direction"
        className="grid grid-cols-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        {(
          [
            ["they", "They Have, You Need"],
            ["you", "You Have, They Need"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={direction === value}
            onClick={() => switchDirection(value)}
            className={`rounded-full px-2 py-2 text-[13px] font-semibold leading-tight ${
              direction === value
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "text-[var(--dim)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-sm font-medium text-[var(--text)]">
        {countLine}
      </p>

      <div className="relative mt-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8a96]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or card number…"
          aria-label="Search trade match cards by name or collector number"
          className="h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-12 pr-4 text-base text-[var(--text)] placeholder:text-[#8a8a96]"
        />
      </div>
      <label className="mt-2.5 block">
        <span className="sr-only">Filter trade match by set</span>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]"
        >
          <option value="all">Filter by set • All Sets</option>
          {activeGroups.map((g) => (
            <option key={g} value={g}>
              Filter by set • {g}
            </option>
          ))}
        </select>
      </label>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-[var(--dim)]">
          Loading cards…
        </p>
      ) : shownItems.length === 0 ? (
        <p
          className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm leading-relaxed text-[var(--dim)]"
          role="status"
        >
          {query.trim() || group !== "all"
            ? "No cards match that search or set filter."
            : direction === "they"
              ? `Nothing here — you already own every card in ${friendName}’s collection.`
              : `${friendName} already has every card you have that we can compare — no matches this way.`}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {shownItems.map((item) => (
            <ProfileItemTile
              key={item.key}
              item={item}
              onOpenCard={onOpenCard}
              onWant={direction === "they" ? onWantItem : undefined}
              onCash={direction === "they" ? onCashItem : undefined}
              availableQty={direction === "they" ? item.qty : undefined}
              cartTradeQty={
                item.cardId != null
                  ? cartCounts?.get(cartKeyOf(item.cardId, item.finish))
                      ?.trade
                  : undefined
              }
              cartCashQty={
                item.cardId != null
                  ? cartCounts?.get(cartKeyOf(item.cardId, item.finish))
                      ?.cash
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The shared profile header (Anthony's Shiny profile layout,
    Nov 2, 2026; banner REMOVED later the same evening at his
    direction — it was cutting his profile picture in half):
    a top band with a back control on the left and the overflow
    menu on the right — cleaned up late Nov 2, 2026 at his
    direction: the centered Vault X ring + name that duplicated
    the app title was removed as redundant, and both controls
    were refined to a modern soft frosted-glass (fabric-like)
    look — then the
    circular avatar whole and clean at the top, the Value •
    Collected • Trust Score stats row, name + achievement badges,
    @handle, bio, joined line, and the Vault X trust chips with
    the Collector ID kept small — its QR chip is a generous tap
    target that opens the big scannable QR (on Anthony's own
    profile, the very same expanded Collector ID page the Home
    element opens). No share button — the shell owns sharing;
    the menu copies the collector code instead. */
/** Spine tones for the profile shelf and the Library page:
    deep navy, violet, and periwinkle gradients with a lit top
    edge — the Vault X palette, no lettering on the spines
    themselves (Anthony, Nov 3, 2026). Shared so the little
    shelf on the profile and the full Library shelf read as
    the same furniture. */
const SPINE_TONES = [
  "linear-gradient(180deg,#31457e,#182650)",
  "linear-gradient(180deg,#463186,#211343)",
  "linear-gradient(180deg,#2a5680,#13304e)",
  "linear-gradient(180deg,#5a3a7d,#2a1745)",
  "linear-gradient(180deg,#223d6e,#0f1f3a)",
  "linear-gradient(180deg,#4a2f6e,#1c0f38)",
] as const;

/** The little shelf on the profile (Anthony, Nov 3, 2026,
    ~10:12–10:14 AM): a photo-like row of THIN binder spines
    filling the void under the profile stats — one book per
    chapter/set, DATA-DRIVEN: a book stands on the shelf only
    when the owner owns at least one card in that chapter (a
    complete set is not required; a chapter with zero owned
    cards gets no book). The spines carry no lettering and
    match the Vault X theme. The whole shelf is ONE tap
    target: tapping it opens the owner's Library page. This
    is the photo whose look Anthony settles first; the
    Library page behind it is finalized after. */
function ShelfPhoto({
  groups,
  ownerName,
  onOpen,
}: {
  groups: { key: string }[];
  ownerName: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTick();
        onOpen();
      }}
      aria-label={`Open ${ownerName}'s Library — ${groups.length} binder${groups.length === 1 ? "" : "s"} on the shelf`}
      className="block w-full rounded-md text-left transition active:scale-[0.98]"
    >
      <span
        aria-hidden="true"
        className="flex h-9 items-end justify-center gap-[2px] overflow-hidden px-0.5"
      >
        {groups.map((g, i) => (
          <span
            key={g.key}
            className="w-[5px] shrink-0 rounded-t-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_-1px_0_0_rgba(0,0,0,0.35),0_0_6px_rgba(108,124,255,0.22)]"
            style={{
              height: `${22 + ((i * 5) % 3) * 5}px`,
              background: SPINE_TONES[i % SPINE_TONES.length],
            }}
          />
        ))}
      </span>
      <span
        aria-hidden="true"
        className="block h-[3px] rounded bg-gradient-to-r from-[#33477c] via-[#6c7cff]/50 to-[#33477c] shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
      />
      <span className="mt-0.5 block text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
        Library ›
      </span>
    </button>
  );
}

/** One binder on the Library shelf. */
type LibraryEntry = {
  /** Binder group key ("set:5", "promo:P1", "quest:Q1") or
      "comics"; for a friend's library, the group name their
      collection filter uses. */
  id: string;
  /** Short spine mark: the set number, "P1", "Q1", "C"… */
  spineLabel: string;
  /** Full binder name, e.g. "Shimmering Skies". */
  title: string;
  /** Chapter line, e.g. "Set 5 binder". */
  detail: string;
  /** Copies/printings the owner has in this binder. */
  owned: number;
  /** Total printings in the binder, when known. */
  total: number | null;
  /** Whether opening this binder goes somewhere real. */
  canOpen: boolean;
};

/** One Library spine: a light TAP peeks — a small floating
    window pops in beside the tap saying whose binder it is
    and which chapter (Anthony, Nov 3, 2026, refined ~10:18
    AM: the peek used to be a panel pinned to the very bottom
    of the screen; he had it replaced with this floating
    window, placed above or below the tap so the thumb never
    covers it); a PRESS AND HOLD (550ms) opens the binder
    itself — the interaction model from the Library mock-up.
    The peek window also carries an explicit Open button, so
    opening never depends on the hold alone. */
function LibrarySpine({
  entry,
  index,
  selected,
  onPeek,
  onOpen,
}: {
  entry: LibraryEntry;
  index: number;
  selected: boolean;
  onPeek: (entry: LibraryEntry, tapRect: DOMRect) => void;
  onOpen: (entry: LibraryEntry) => void;
}) {
  const timerRef = useRef<number | null>(null);
  const openedRef = useRef(false);
  const cancelHold = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const startHold = () => {
    openedRef.current = false;
    cancelHold();
    timerRef.current = window.setTimeout(() => {
      openedRef.current = true;
      hapticTick();
      onOpen(entry);
    }, 550);
  };
  return (
    <button
      type="button"
      aria-label={`${entry.title} binder — ${entry.detail}. Tap to peek; press and hold to open it.`}
      aria-pressed={selected}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onClick={(e) => {
        if (openedRef.current) {
          openedRef.current = false;
          return;
        }
        hapticTick();
        onPeek(entry, e.currentTarget.getBoundingClientRect());
      }}
      className={`flex h-28 w-[26px] shrink-0 flex-col items-center justify-between rounded-t-md pb-1.5 pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_-2px_0_3px_rgba(0,0,0,0.35),0_0_10px_rgba(108,124,255,0.15)] transition active:scale-[0.97] ${
        entry.owned > 0 ? "" : "opacity-40 saturate-50"
      } ${selected ? "ring-2 ring-[var(--accent)]" : ""}`}
      style={{ background: SPINE_TONES[index % SPINE_TONES.length] }}
    >
      <span
        aria-hidden="true"
        className="block h-6 w-[3px] rounded bg-white/15"
      />
      <span className="text-[10px] font-bold leading-none text-white/85">
        {entry.spineLabel}
      </span>
    </button>
  );
}

/** The Library page (Anthony, Nov 3, 2026, ~10:12 AM — the
    name is his: "we'll call that second upload the library
    page"): the owner's shelf as a full page inside Vault X,
    reached by tapping the little shelf photo on their
    profile. One thin spine per binder (sets, promos, quests,
    graded comics), numbered; binders the owner has nothing
    in stand faded. Tap a spine to peek — a floating window
    pops in beside the tap (above it, or below when that's
    what's clear) naming the owner and the chapter and saying
    what they hold there; press and hold a spine (or use the
    window's Open button) to open that binder. */
function LibraryPage({
  ownerName,
  entries,
  onClose,
  onOpenEntry,
}: {
  ownerName: string;
  entries: LibraryEntry[];
  onClose: () => void;
  onOpenEntry: (entry: LibraryEntry) => void;
}) {
  // The peek is a FLOATING WINDOW now (Anthony, Nov 3, 2026,
  // ~10:18 AM): the bottom info panel is deleted. The window
  // carries the tapped spine's rect so it can anchor beside
  // the tap — below the thumb when there is room, above it
  // when there isn't.
  const [peek, setPeek] = useState<{
    entry: LibraryEntry;
    rect: DOMRect;
  } | null>(null);
  const shelves: LibraryEntry[][] = [];
  for (let i = 0; i < entries.length; i += 6) {
    shelves.push(entries.slice(i, i + 6));
  }
  const peekWidth = Math.min(300, window.innerWidth - 24);
  const peekLeft = peek
    ? Math.min(
        Math.max(
          12,
          peek.rect.left + peek.rect.width / 2 - peekWidth / 2,
        ),
        window.innerWidth - peekWidth - 12,
      )
    : 12;
  const peekAbove = peek
    ? peek.rect.bottom + 190 > window.innerHeight &&
      peek.rect.top > 210
    : false;
  return (
    <div
      className="app-shell fixed inset-0 z-[70] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`${ownerName}'s Library`}
    >
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticTick();
              onClose();
            }}
            aria-label="Back to profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
          >
            ←
          </button>
          <div>
            <h2 className="font-album text-xl text-[var(--text)]">Library</h2>
            <p className="text-xs text-[var(--dim)]">
              {ownerName}&rsquo;s shelf — a binder for every chapter
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {shelves.map((shelf, si) => (
            <div key={si}>
              <div className="flex items-end gap-[6px] px-1">
                {shelf.map((entry, ei) => (
                  <LibrarySpine
                    key={entry.id}
                    entry={entry}
                    index={si * 6 + ei}
                    selected={peek?.entry.id === entry.id}
                    onPeek={(e, rect) => setPeek({ entry: e, rect })}
                    onOpen={onOpenEntry}
                  />
                ))}
              </div>
              <div
                aria-hidden="true"
                className="h-[6px] rounded bg-gradient-to-b from-[#3d5086] to-[#141f3d] shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
              />
            </div>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--dim)]">
            No binders on this shelf yet.
          </p>
        ) : (
          <p className="mt-5 px-1 text-center text-xs leading-relaxed text-[var(--dim)]">
            Light-tap a spine to peek at whose binder it is and which
            chapter — press and hold a spine to open that binder.
          </p>
        )}
      </div>

      {/* The floating peek window: pops in beside the tapped
          spine (below the tap when that side is clear, above
          it when it isn't), carrying everything the deleted
          bottom panel used to say. Tapping anywhere else
          dismisses it. */}
      {peek ? (
        <>
          <button
            type="button"
            aria-label="Close the binder preview"
            onClick={() => setPeek(null)}
            className="fixed inset-0 z-[71] cursor-default"
          />
          <section
            aria-label="Binder preview"
            className="library-pop fixed z-[72] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.6)]"
            style={{
              width: peekWidth,
              left: peekLeft,
              ...(peekAbove
                ? { bottom: window.innerHeight - peek.rect.top + 10 }
                : { top: peek.rect.bottom + 10 }),
            }}
          >
            <h3 className="font-album text-lg text-[var(--text)]">
              {ownerName} — {peek.entry.title}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--dim)]">
              {peek.entry.detail}
            </p>
            <p className="mt-2 text-sm text-[var(--text)]">
              {peek.entry.total != null
                ? `${peek.entry.owned} of ${peek.entry.total} printings in this binder`
                : peek.entry.owned > 0
                  ? `${peek.entry.owned} card${peek.entry.owned === 1 ? "" : "s"} in this binder`
                  : "Nothing in this binder yet"}
            </p>
            <button
              type="button"
              disabled={!peek.entry.canOpen}
              onClick={() => {
                hapticTick();
                onOpenEntry(peek.entry);
              }}
              className="mt-3 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--on-accent)] disabled:opacity-40"
            >
              Open this binder
            </button>
            <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
              Press and hold the spine to open the binder right away.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ProfileHeader({
  onBack,
  backLabel,
  avatar,
  displayName,
  nameChip,
  handle,
  bio,
  joined,
  statValue,
  statCollected,
  trustScore,
  connections,
  collectorCode,
  qrPayload,
  badges,
  onOpenBadges,
  onOpenDecks,
  onQrTap,
  bannerUrl,
  onBannerPick,
  onBannerRemove,
  shelfGroups,
  onOpenLibrary,
}: {
  onBack: () => void;
  backLabel: string;
  avatar: ReactNode;
  /** Optional profile banner (opt-in; null/absent = no banner). */
  bannerUrl?: string | null;
  /** Own-profile only: opens the banner photo picker. */
  onBannerPick?: () => void;
  /** Own-profile only: removes the current banner. */
  onBannerRemove?: () => void;
  displayName: string;
  nameChip?: ReactNode;
  handle: string;
  bio: string | null;
  joined: string | null;
  statValue: string;
  statCollected: string;
  trustScore: number;
  connections: number;
  collectorCode: string;
  qrPayload: string;
  badges: BadgeState[];
  onOpenBadges: () => void;
  /** Opens the decks page; the deck icon renders centered
      under the Trust Score stat when supplied. */
  onOpenDecks?: () => void;
  onQrTap?: () => void;
  /** The little data-driven shelf under the stats (Anthony,
      Nov 3, 2026): one thin book per chapter the owner owns
      at least one card in. Rendered only when both this and
      onOpenLibrary are supplied. */
  shelfGroups?: { key: string }[];
  /** Opens the owner's Library page (the shelf photo's tap). */
  onOpenLibrary?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(collectorCode);
      setCopied(true);
    } catch {
      // Clipboard unavailable in this frame — the code stays
      // visible on the profile, so nothing is lost.
    }
    setMenuOpen(false);
  };
  // The big scannable QR view (used when no onQrTap destination
  // was supplied — e.g. a friend's profile): its own history
  // entry, so Back closes it like every other sheet in the app.
  const [qrOpen, setQrOpen] = useState(false);
  const qrPushedRef = useRef(false);
  const openQr = () => {
    hapticTick();
    if (onQrTap) {
      onQrTap();
      return;
    }
    setQrOpen(true);
    try {
      window.history.pushState({ lorcanaProfileQr: true }, "");
      qrPushedRef.current = true;
    } catch {
      qrPushedRef.current = false;
    }
  };
  const closeQr = () => {
    if (qrPushedRef.current) {
      window.history.back();
    } else {
      setQrOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (
        qrPushedRef.current &&
        !(window.history.state as { lorcanaProfileQr?: boolean } | null)
          ?.lorcanaProfileQr
      ) {
        qrPushedRef.current = false;
        setQrOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const onBanner = Boolean(bannerUrl);
  return (
    <div>
      {/* Optional banner (Anthony, Nov 2, 2026): strictly opt-in,
          default none for every user. When a user adds one, it
          sits BEHIND the header — the back/menu row floats over
          its top, and the avatar overlaps its bottom edge rendered
          fully on top (it paints after the banner and carries its
          own ring), so the banner can never crop, cover, or cut
          the profile picture the way the old one did. With no
          banner, this is the plain header, unchanged. */}
      <div className="relative">
        {bannerUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-36 overflow-hidden rounded-2xl"
          >
            <img
              src={bannerUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/35" />
          </div>
        ) : null}
        <div
          className={`relative flex items-start justify-between gap-2 px-1 ${
            onBanner ? "px-3 pt-3" : ""
          }`}
        >
        {/* Header cleanup + control refinement (Anthony, Nov 2,
            2026, late): the centered Vault X ring + "Vault X"
            label that sat in the middle of this top band is GONE
            — it duplicated the app name the shell already shows
            above the page, and he circled that whole band as
            redundant area to clean up. The band is now just the
            two controls, floating clean over the content. The
            back button and the three-dots menu were refined at
            the same direction to a more modern, soft fabric-like
            look: no more heavy solid grey discs — each glyph sits
            in a translucent frosted-glass circle with a woven
            light gradient (bright along the top edge, settling
            darker at the bottom), a hairline ring, a soft drop
            shadow, and a gentle press scale. The dots now run
            horizontally, the chevron is finer, and both buttons
            keep their full 44px touch area and exactly their old
            behavior. */}
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text)] transition-transform duration-150 active:scale-95"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-white/[0.13] via-white/[0.06] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_2px_rgba(0,0,0,0.28),0_6px_16px_rgba(0,0,0,0.32)] ring-1 ring-white/10 backdrop-blur-xl"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[17px] w-[17px]"
            >
              <path d="M14.8 5.6 8.4 12l6.4 6.4" />
            </svg>
          </span>
        </button>
        {/* Name + flags on the TOP LINE (Anthony, Nov 3, 2026,
            ~10:06 AM, clarified minutes later: "No, not just
            the flags. My name and the flags."): the username,
            its chip, and the achievement flags travel as ONE
            unit, and that unit now sits up here on the header's
            top line — between the back button and the menu,
            vertically centered on them — instead of down at
            the lower right of the profile photo where it used
            to sit. This is the shared header, so the top line
            carries the name unit on EVERY profile: his own,
            friends', Jarvis's, everyone's. */}
        <div className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="font-album text-[22px] font-bold leading-tight text-[var(--text)]">
            {displayName}
          </h2>
          {nameChip}
          <BadgeRow states={badges} onOpen={onOpenBadges} />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              hapticTick();
              setMenuOpen((v) => !v);
            }}
            aria-label="Profile options"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--text)] transition-transform duration-150 active:scale-95"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-white/[0.13] via-white/[0.06] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_2px_rgba(0,0,0,0.28),0_6px_16px_rgba(0,0,0,0.32)] ring-1 ring-white/10 backdrop-blur-xl"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-[17px] w-[17px]"
              >
                <circle cx="5.2" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="18.8" cy="12" r="1.7" />
              </svg>
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-12 z-10 w-52 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => void copyCode()}
                className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--text)]"
              >
                Copy Collector ID
                <span className="block text-xs font-normal text-[var(--dim)]">
                  {collectorCode}
                </span>
              </button>
              {onBannerPick ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onBannerPick();
                  }}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--text)]"
                >
                  {bannerUrl ? "Change banner photo" : "Add a banner photo"}
                  <span className="block text-xs font-normal text-[var(--dim)]">
                    Shown behind your profile photo
                  </span>
                </button>
              ) : null}
              {bannerUrl && onBannerRemove ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onBannerRemove();
                  }}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--text)]"
                >
                  Remove banner
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

        <div
          className={`relative flex items-end gap-3 px-1 ${
            onBanner ? "mt-10 px-3" : "mt-1"
          }`}
        >
          <div className="shrink-0">{avatar}</div>
          {/* Stats + decks in ONE column beside the photo
              (Anthony, Nov 3, 2026, ~10:05 AM — the void fix):
              the deck-box icon used to live on its own
              full-width row under the photo (next to the name,
              back when the name sat down there), and that row
              — empty of everything but the icon on friend
              profiles, whose name had moved out — was the
              whole empty stretch between the photo and the
              @handle. The icon now sits directly under the
              Trust Score stat, inside the photo's own row, so
              the header is photo-height and the @handle
              follows right underneath it. The icon itself
              keeps its place under Trust Score (only its
              border was toned down — see MyDecksButton). */}
          <div className="min-w-0 flex-1 pb-1">
            <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Value", statValue],
                ["Collected", statCollected],
                ["Trust Score", String(trustScore)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dd className="truncate text-[15px] font-bold text-[var(--text)]">
                  {value}
                </dd>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--dim)]">
                  {label}
                </dt>
              </div>
              ))}
            </dl>
            {onOpenDecks || (onOpenLibrary && shelfGroups) ? (
              <div className="mt-1.5 grid grid-cols-3 items-end gap-2">
                {/* The little shelf fills the void in the
                    first two columns under the stats (Anthony,
                    Nov 3, 2026): thin books, one per chapter
                    the owner collects, tappable into their
                    Library. The deck-box icon keeps the third
                    column, under Trust Score, as before. */}
                <div className="col-span-2 min-w-0">
                  {onOpenLibrary && shelfGroups ? (
                    <ShelfPhoto
                      groups={shelfGroups}
                      ownerName={displayName}
                      onOpen={onOpenLibrary}
                    />
                  ) : null}
                </div>
                <div className="flex justify-center">
                  {onOpenDecks ? (
                    <MyDecksButton onOpen={onOpenDecks} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {bio ? (
        <p className="mt-1.5 px-1 text-sm leading-relaxed text-[var(--text)]">
          {bio}
        </p>
      ) : null}
      {/* The @handle sits one step lower than it used to and
          CENTERED under the profile photo (Anthony, Nov 3,
          2026, ~10:20 AM): it moved down below the bio, with
          an extra space between the bio and the handle. The
          w-24 box matches the avatar's own width, so the
          handle centers on the photo itself. */}
      <p className="mt-3.5 w-24 px-1 text-center text-sm text-[var(--dim)]">
        @{handle}
      </p>
      {joined ? (
        <p className="mt-1.5 flex items-center gap-1.5 px-1 text-xs text-[var(--dim)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          {joined}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--gold-soft)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M12 3 5 5.8v5.4c0 4.6 3 7.9 7 9.3 4-1.4 7-4.7 7-9.3V5.8Z" />
            <path d="m9 11.6 2.1 2.1 4-4.2" />
          </svg>
          Trust Score {trustScore}
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text)]">
          {connections} confirmed connection{connections === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={openQr}
          aria-label={`Open the big QR code for ${displayName}, collector ID ${collectorCode}`}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-2 pr-3.5 text-xs text-[var(--text)]"
        >
          <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-md">
            <CollectorQr payload={qrPayload} />
          </span>
          <span className="font-mono text-[13px] font-semibold tracking-wide">
            {collectorCode}
          </span>
          <span aria-hidden="true" className="text-base text-[var(--dim)]">
            ›
          </span>
        </button>
        {copied ? (
          <span role="status" className="text-xs font-medium text-emerald-400">
            Collector ID copied
          </span>
        ) : null}
      </div>

      {qrOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Collector ID for ${displayName}`}
          onClick={closeQr}
        >
          <div
            className="search-pop mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center px-6 py-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-64 max-w-full rounded-[26px] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
              <CollectorQr payload={qrPayload} />
            </div>
            <p className="mt-5 text-center font-album text-xl font-bold text-white">
              {displayName}
            </p>
            <p className="mt-0.5 text-center text-sm text-white/75">
              @{handle}
            </p>
            <p className="mt-1.5 text-center font-mono text-base font-semibold tracking-widest text-white">
              {collectorCode}
            </p>
            <p className="mt-2 max-w-[260px] text-center text-xs leading-relaxed text-white/60">
              Show this code to another collector so they can scan it
              and connect with you.
            </p>
            <button
              type="button"
              onClick={closeQr}
              className="mt-6 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--on-accent)]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Jarvis's little collection, resolved live from the catalog
    (genuine card art and prices, his finishes and quantities from
    JARVIS_FRIEND_CARDS). Shared by his profile page and the
    Trades area — one react-query cache entry feeds both. */
async function loadJarvisFriendItems(): Promise<ProfileItemView[]> {
  const found: ProfileItemView[] = [];
  for (const pick of JARVIS_FRIEND_CARDS) {
    const res = await api.searchCards({ query: pick.query });
    const hit =
      res.results.find((r) => r.fullName === pick.query) ??
      res.results[0];
    if (!hit) continue;
    let unitValue: number | null = null;
    try {
      const card = await api.getCard({ cardId: hit.cardId });
      const byFinish = card.finance.byFinish.find(
        (f) => f.finish === pick.finish,
      );
      unitValue = byFinish?.valuePerUnit ?? card.marketValue ?? null;
    } catch {
      unitValue = null;
    }
    found.push({
      key: `${hit.cardId}-${pick.finish}`,
      cardId: hit.cardId,
      sealedName: null,
      name: hit.fullName,
      groupName: hit.groupName,
      printed: hit.printed,
      finish: pick.finish,
      rarity: null,
      qty: pick.qty,
      unitValue,
      tradeableQty: null,
      yourQty: hit.ownedQty,
    });
  }
  return found;
}

/** Jarvis's profile page in the shared Vault X profile layout
    (Anthony's Shiny-style redesign, Nov 2, 2026): avatar,
    stats, badges, his items with search/sort/filter, the Trade
    Match tab, and the sharing preview. Jarvis ALSO lives in the
    central registry on Supabase (verified live: MC-JARVIS /
    "Jarvis" / trust 5) and syncCollectorRegistry re-verifies his
    row alongside Anthony's, so the Add a Friend lookup resolves
    him from the server; this page falls back to the built-in copy
    of his little collection when the server is unreachable. */
function JarvisFriendProfile({
  onBack,
  onOpenCard,
  onWantItem,
  onCashItem,
  cartCounts,
}: {
  onBack: () => void;
  onOpenCard: (cardId: number) => void;
  onWantItem?: (item: ProfileItemView) => void;
  onCashItem?: (item: ProfileItemView) => void;
  cartCounts?: Map<string, { trade: number; cash: number }>;
}) {
  const [tab, setTab] = useState<"collection" | "trade">("collection");
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [decksOpen, setDecksOpen] = useState(false);
  const badgesSheet = useHistorySheet("lorcanaBadges", setBadgesOpen,
  );
  const decksSheet = useHistorySheet("lorcanaDecks", setDecksOpen,
  );
  // Jarvis's shelf + Library (Anthony, Nov 3, 2026): the
  // binder structure comes from the shared getBinder catalog
  // groups (names/labels only — its owned counts are
  // Anthony's and are never used here); how much JARVIS holds
  // in each binder is counted from his own items, so a book
  // stands on his little shelf only for a chapter he actually
  // has a card in. Opening a binder in his Library filters
  // his collection below to that chapter.
  const [libraryOpen, setLibraryOpen] = useState(false);
  const librarySheet = useHistorySheet("lorcanaLibrary", setLibraryOpen);
  const binderCatalog = useQuery({
    queryKey: ["binder"],
    queryFn: () => api.getBinder({}),
  });
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState<ProfileSort>("value");
  const [filter, setFilter] = useState<ProfileFilter>("all");
  const jarvisCards = useQuery({
    queryKey: ["jarvisFriendCards"],
    queryFn: loadJarvisFriendItems,
  });
  const registry = useQuery({
    queryKey: ["registryMembers"],
    queryFn: () => api.getRegistryMembers({}),
  });
  const items = jarvisCards.data ?? [];
  const shownItems = useMemo(
    () => matchProfileItems(items, query, group, filter, sort),
    [items, query, group, filter, sort],
  );
  const itemGroups = useMemo(
    () => [...new Set(items.map((c) => c.groupName))].sort(),
    [items],
  );
  const jarvisMember = registry.data?.members.find(
    (m) => m.collectorId === JARVIS_FRIEND.collectorCode,
  );
  const founder = useMemo(() => {
    const members = registry.data?.members ?? [];
    if (!jarvisMember || members.length === 0) return false;
    const earliest = Math.min(
      ...members.map((m) => new Date(m.createdAt).getTime()),
    );
    const mine = new Date(jarvisMember.createdAt).getTime();
    return (
      Number.isFinite(earliest) &&
      Number.isFinite(mine) &&
      mine - earliest <= 45 * 24 * 60 * 60 * 1000
    );
  }, [registry.data, jarvisMember]);
  const jarvisCopies = items.reduce((s, c) => s + c.qty, 0);
  const jarvisValue = items.reduce(
    (s, c) => s + (c.unitValue ?? 0) * c.qty,
    0,
  );
  const badgeStates = evaluateBadges({
    founder,
    totalItems: jarvisCopies,
    setsCompleted: 0,
    ownsEnchanted: false,
    ownsIconic: false,
    sealedCount: 0,
    comicsCount: 0,
    confirmedTrades: JARVIS_FRIEND.trades,
    trustScore: JARVIS_FRIEND.trustScore,
    confirmedConnections: JARVIS_FRIEND.connections,
  });
  const jarvisPayload = `Vault X\nCollector: @${JARVIS_FRIEND.username}\nID: ${JARVIS_FRIEND.collectorCode}`;
  const jarvisNameChip = (
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--dim)]">
      Built-in friend
    </span>
  );
  // His per-binder counts, from his own items only.
  const jarvisCounts = new Map<string, number>();
  for (const it of items) {
    jarvisCounts.set(
      it.groupName,
      (jarvisCounts.get(it.groupName) ?? 0) + it.qty,
    );
  }
  const jarvisShelfGroups = [...jarvisCounts.keys()].map((name) => ({
    key: name,
  }));
  const jarvisLibraryEntries: LibraryEntry[] = (
    binderCatalog.data?.groups ?? []
  )
    .filter((g) => g.kind !== "puzzle")
    .map((g) => ({
      id: g.name,
      spineLabel:
        g.kind === "set"
          ? String(setNumberOf(g) ?? "")
          : g.label.replace(/^Quest /, ""),
      title: g.name,
      detail: `${g.label} binder`,
      owned: jarvisCounts.get(g.name) ?? 0,
      total: null,
      canOpen: (jarvisCounts.get(g.name) ?? 0) > 0,
    }));
  return (
    <section aria-label="Jarvis profile" className="mt-2">
      {/* No separate name strip anymore (Anthony, Nov 3,
          2026, ~10:05–10:06 AM, superseding the strip-under-
          Trades placement from earlier that day): the name,
          the Built-in friend badge, and the achievement flags
          travel as one unit on the TOP LINE of the shared
          ProfileHeader — same as every other profile — and
          the header itself is condensed: the deck-box icon
          moved up into the photo's own row, so there is no
          empty row left between the photo and the @handle,
          and no void under where the strip used to sit. The
          chip is handed to the header as its nameChip. */}
      <ProfileHeader
        onBack={onBack}
        backLabel="Back to friends list"
        avatar={
          <span
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent)] font-album text-4xl font-bold text-[var(--on-accent)] ring-4 ring-[var(--bg)]"
          >
            J
          </span>
        }
        displayName={JARVIS_FRIEND.displayName}
        nameChip={jarvisNameChip}
        handle={JARVIS_FRIEND.username}
        bio="Your collection assistant — I keep a couple of cards for testing how friends see each other’s collections."
        joined={joinedLabel(jarvisMember?.createdAt)}
        statValue={jarvisCards.data ? fmtUSD(jarvisValue) : "—"}
        statCollected={jarvisCards.data ? String(jarvisCopies) : "—"}
        trustScore={JARVIS_FRIEND.trustScore}
        connections={JARVIS_FRIEND.connections}
        collectorCode={JARVIS_FRIEND.collectorCode}
        qrPayload={jarvisPayload}
        badges={badgeStates}
        onOpenBadges={badgesSheet.openSheet}
        onOpenDecks={decksSheet.openSheet}
        shelfGroups={jarvisShelfGroups}
        onOpenLibrary={librarySheet.openSheet}
      />
      <p className="mt-1.5 px-1 text-xs leading-relaxed text-[var(--dim)]">
        {registry.data?.reachable
          ? "Live on the Vault X server: this profile is registered in the central collector registry (Supabase), and Add a Friend finds it there by its code."
          : "Showing the built-in copy — the Vault X server couldn't be reached just now, so this profile may be out of date."}
      </p>

      <div
        role="tablist"
        aria-label="Jarvis profile sections"
        className="mt-2.5 grid grid-cols-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        {(
          [
            ["collection", "Collection"],
            ["trade", "Trade Match"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              if (tab === value) return;
              hapticTick();
              setTab(value);
            }}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${
              tab === value
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "text-[var(--dim)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The cart entry point is the long checkout bar docked
          above the bottom menu (SocialPanel renders it) — it
          appears the minute the first card lands in a cart. */}

      {tab === "collection" ? (
        <>
          <ProfileCollectionSection
            total={items.length}
            groups={itemGroups}
            query={query}
            onQueryChange={setQuery}
            group={group}
            onGroupChange={setGroup}
            sort={sort}
            onSortChange={setSort}
            filter={filter}
            onFilterChange={setFilter}
            items={shownItems}
            loading={jarvisCards.isPending}
            emptyText="No items match that search or filter in Jarvis’s collection."
            onOpenCard={onOpenCard}
            onWantItem={onWantItem}
            onCashItem={onCashItem}
            cartCounts={cartCounts}
          />
        </>
      ) : (
        <TradeMatchView
          friendName={JARVIS_FRIEND.displayName}
          friendItems={items}
          friendLoading={jarvisCards.isPending}
          onOpenCard={onOpenCard}
          onWantItem={onWantItem}
          onCashItem={onCashItem}
          cartCounts={cartCounts}
        />
      )}
      {libraryOpen ? (
        <LibraryPage
          ownerName={JARVIS_FRIEND.displayName}
          entries={jarvisLibraryEntries}
          onClose={librarySheet.closeSheet}
          onOpenEntry={(entry) => {
            librarySheet.closeSheet();
            setGroup(entry.id);
            setTab("collection");
          }}
        />
      ) : null}
      {badgesOpen ? (
        <AchievementsSheet
          states={badgeStates}
          ownerLabel="Jarvis’s"
          onClose={badgesSheet.closeSheet}
        />
      ) : null}
      {decksOpen ? (
        <DecksSheet
          heading={`${JARVIS_FRIEND.displayName}’s Decks`}
          ownerName={JARVIS_FRIEND.displayName}
          isOwn={false}
          onClose={decksSheet.closeSheet}
        />
      ) : null}
    </section>
  );
}

/** Jarvis as a friend inside the app (Anthony's request, Nov 2,
    2026: "build this app within yourself, create yourself as a
    friend... just give yourself a couple cards... we'll see how
    the visualization works between seeing each other's
    collection"). Jarvis is built into the app as a friend so the
    whole Friends / sharing flow works in real time — profile,
    Collector ID, Trust Score, his own little collection, the
    side-by-side two-way view, and what he sees when a collection
    is shared with him. His cards are NOT Anthony's — they never
    touch his collection or totals. The friend code is deliberately
    short and readable — MC-JARVIS — so it can be TYPED into Add a
    Friend instead of scanned (Anthony can't scan a QR of a code
    shown on his own phone). This replaces the earlier Dummy Friend
    test account outright, so there's exactly one friend entry.
    Server registration (Nov 2, 2026, Anthony's follow-up): Jarvis
    ALSO lives in the central Vault X registry on Supabase —
    verified live in the profiles table as MC-JARVIS / username
    "Jarvis" / trust 5 — and the app's syncCollectorRegistry action
    re-registers and verifies his row alongside Anthony's own, so
    the Add a Friend lookup resolves him from the server, not just
    from this built-in copy. */
const JARVIS_FRIEND = {
  displayName: "Jarvis",
  username: "jarvis",
  collectorCode: "MC-JARVIS",
  trustScore: 5,
  connections: 1,
  trades: 0,
} as const;

/** Jarvis's own cards: a couple of real catalog printings (looked
    up by exact name at runtime so the artwork is the genuine card
    art), owned by Jarvis only. */
const JARVIS_FRIEND_CARDS = [
  { query: "Mickey Mouse - Brave Little Tailor", finish: "Regular", qty: 1 },
  { query: "Elsa - Snow Queen", finish: "Cold Foil", qty: 1 },
  { query: "Stitch - Rock Star", finish: "Regular", qty: 2 },
] as const;

/** ---- Marketplace (phase 1, Nov 2, 2026) ----
    Listings from collectors' own collections, Buy Now claims,
    offers, both-sides-confirmed deals, and mandatory blind
    feedback. NO in-app payments in this phase — a claim reserves
    the item and notifies the seller; the deal is arranged and
    completed in person, then confirmed by both sides. */

type MarketListing = ApiResponse<
  typeof api,
  "getMarketplace"
>["listings"][number];
type MarketDeal = ApiResponse<
  typeof api,
  "getMarketplaceActivity"
>["deals"][number];
type MarketOfferView = ApiResponse<
  typeof api,
  "getMarketplaceActivity"
>["incoming"][number];

/** Artwork for any marketplace item kind, reusing the same art
    sources as the rest of the app (cached card art, sealed
    photos, comic covers). */
function MarketArt({
  kind,
  cardId,
  sealedName,
  comicId,
  name,
  finish,
}: {
  kind: "card" | "sealed" | "comic";
  cardId: number | null;
  sealedName: string | null;
  comicId: string | null;
  name: string;
  finish: string;
}) {
  if (kind === "card" && cardId != null) {
    return (
      <JarvisFriendCardArt
        cardId={cardId}
        foil={finish !== "Regular"}
        name={name}
      />
    );
  }
  if (kind === "sealed") {
    return (
      <span className="relative block aspect-square overflow-hidden rounded-lg border border-[var(--pocket-edge)]">
        <img
          src={
            (sealedName != null ? SEALED_PHOTOS[sealedName] : undefined) ??
            sealedBoosterFront
          }
          alt={`${name} photo`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
    );
  }
  const comic = COMICS.find((c) => c.id === comicId);
  return (
    <span className="relative block aspect-[3/4] overflow-hidden rounded-lg border border-[var(--pocket-edge)] bg-[var(--pocket)]">
      {comic ? (
        <img
          src={comic.cover}
          alt={`${name} cover art`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

/** Asking price vs current market value, as a plain verdict. */
function marketCompareText(asking: number, market: number | null) {
  if (market == null || market <= 0) return null;
  const diff = ((asking - market) / market) * 100;
  if (Math.abs(diff) < 1) return "At market value";
  return diff < 0
    ? `${Math.abs(diff).toFixed(0)}% below market`
    : `${diff.toFixed(0)}% above market`;
}

function MarketCompareChip({
  asking,
  market,
}: {
  asking: number;
  market: number | null;
}) {
  const text = marketCompareText(asking, market);
  if (!text) return null;
  const below = text.includes("below");
  const above = text.includes("above");
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        below
          ? "bg-emerald-400/15 text-emerald-400"
          : above
            ? "bg-amber-400/15 text-amber-400"
            : "bg-[var(--border)] text-[var(--dim)]"
      }`}
    >
      {text}
    </span>
  );
}

function ListingTile({
  listing,
  trust,
  onOpen,
}: {
  listing: MarketListing;
  trust: number | null;
  onOpen: () => void;
}) {
  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open listing: ${listing.name}, ${listing.finish}, asking ${fmtUSD(listing.askingPrice)} from ${listing.sellerUsername}${listing.status === "pending" ? ". Sale pending" : ""}`}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        <MarketArt
          kind={listing.kind}
          cardId={listing.cardId}
          sealedName={listing.sealedName}
          comicId={listing.comicId}
          name={listing.name}
          finish={listing.finish}
        />
        <span className="mt-2 block text-sm font-semibold leading-tight text-[var(--text)]">
          {listing.name}
          {listing.printed ? ` ${listing.printed.split("/")[0]}` : ""}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--dim)]">
          {listing.groupName}
        </span>
        <span className="block text-xs font-medium text-[var(--accent)]">
          {listing.finish} · {listing.condition}
          {listing.qty > 1 ? ` · Qty ${listing.qty}` : ""}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-base font-bold text-[var(--text)]">
            {fmtUSD(listing.askingPrice)}
          </span>
          <MarketCompareChip
            asking={listing.askingPrice}
            market={listing.marketValue}
          />
        </span>
        <span className="mt-1 block text-xs text-[var(--dim)]">
          @{listing.sellerUsername}
          {trust != null ? ` · Trust ${trust}` : ""}
          {listing.sellerIsTest ? " · Test user" : ""}
          {listing.mine ? " · Your listing" : ""}
        </span>
        {listing.status === "pending" ? (
          <span className="mt-1.5 inline-block rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
            Sale pending
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Listing detail: the item floating on the turntable (the
    standing every-item rule), the asking price with Buy Now right
    beside it, the market comparison, the seller snippet, and
    Make an Offer as the secondary action. Buy Now claims the item
    at the asking price and notifies the seller — no payment is
    taken in the app in this phase, and the sheet says so. */
function ListingSheet({
  listing,
  trust,
  connections,
  myPending,
  onClose,
  onChanged,
  onOpenJarvisProfile,
  onGoInbox,
}: {
  listing: MarketListing;
  trust: number | null;
  connections: number | null;
  myPending: MarketOfferView | undefined;
  onClose: () => void;
  onChanged: () => void;
  onOpenJarvisProfile: () => void;
  onGoInbox: () => void;
}) {
  const queryClient = useQueryClient();
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [claimed, setClaimed] = useState(false);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["myListings"] });
    void queryClient.invalidateQueries({ queryKey: ["marketActivity"] });
    onChanged();
  };
  const claim = useMutation({
    mutationFn: () => api.placeClaim({ listingId: listing.id }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setClaimed(true);
        setMessage({
          ok: true,
          text: `Claimed! @${listing.sellerUsername} has been notified: you want to buy this at the asking price of ${fmtUSD(listing.askingPrice)}. It's reserved for you while they answer — no payment is taken in the app.`,
        });
        invalidate();
      } else {
        setMessage({ ok: false, text: res.error ?? "That claim didn't go through." });
      }
    },
    onError: () =>
      setMessage({ ok: false, text: "That claim didn't go through — try again." }),
  });
  const offer = useMutation({
    mutationFn: (amount: number) =>
      api.placeOffer({ listingId: listing.id, amount }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setMessage({
          ok: true,
          text: `Offer sent to @${listing.sellerUsername}. They can accept or decline it in their Inbox.`,
        });
        invalidate();
      } else {
        setMessage({ ok: false, text: res.error ?? "That offer didn't go through." });
      }
    },
    onError: () =>
      setMessage({ ok: false, text: "That offer didn't go through — try again." }),
  });
  const withdraw = useMutation({
    mutationFn: (offerId: number) => api.cancelOffer({ offerId }),
    onSuccess: (res) => {
      if (res.ok) {
        setMessage({ ok: true, text: "Withdrawn — the item is back on the market." });
        invalidate();
      } else {
        setMessage({ ok: false, text: res.error ?? "That didn't go through." });
      }
    },
  });
  const compare = marketCompareText(listing.askingPrice, listing.marketValue);
  const sellerIsJarvis =
    listing.sellerCode === JARVIS_FRIEND.collectorCode;
  const canAct =
    !listing.mine && listing.status === "available" && !myPending && !claimed;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Listing: ${listing.name}`}
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to marketplace"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close listing"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>

        <Turntable
          label={`${listing.name} listing photo — drag or use the left and right arrow keys to turn it`}
          floatClassName={
            listing.kind === "sealed"
              ? "w-64 max-w-full"
              : "w-60 max-w-full"
          }
        >
          <MarketArt
            kind={listing.kind}
            cardId={listing.cardId}
            sealedName={listing.sealedName}
            comicId={listing.comicId}
            name={listing.name}
            finish={listing.finish}
          />
        </Turntable>

        <h2 className="font-album mt-3 text-[22px] font-bold leading-tight text-[var(--text)]">
          {listing.name}
          {listing.printed ? ` ${listing.printed.split("/")[0]}` : ""}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--dim)]">
          {listing.groupName} · {listing.finish} · {listing.condition}
          {listing.qty > 1 ? ` · Qty ${listing.qty}` : ""}
        </p>

        {/* Price + Buy Now, side by side — Buy Now is the primary
            action and sits right next to the asking price. */}
        <div className="mt-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[26px] font-bold leading-none text-[var(--text)]">
              {fmtUSD(listing.askingPrice)}
            </p>
            {listing.marketValue != null ? (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
                Market value {fmtUSD(listing.marketValue)}
                {compare ? ` — ${compare.toLowerCase()}` : ""}
              </p>
            ) : null}
          </div>
          {listing.mine ? (
            <span className="shrink-0 rounded-full border border-[var(--border)] px-3.5 py-2.5 text-sm font-semibold text-[var(--dim)]">
              Your listing
            </span>
          ) : listing.status === "pending" && !myPending && !claimed ? (
            <span className="shrink-0 rounded-full bg-amber-400/15 px-3.5 py-2.5 text-sm font-bold text-amber-400">
              Sale pending
            </span>
          ) : canAct ? (
            <button
              type="button"
              disabled={claim.isPending}
              onClick={() => claim.mutate()}
              className="shrink-0 rounded-full bg-[var(--accent)] px-5 py-3 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
            >
              {claim.isPending ? "Claiming…" : "Buy Now"}
            </button>
          ) : null}
        </div>

        {message ? (
          <p
            role="status"
            className={`mt-3 rounded-xl border p-3 text-sm leading-relaxed ${
              message.ok
                ? "border-emerald-400/40 bg-emerald-400/10 text-[var(--text)]"
                : "border-red-400/40 bg-red-400/10 text-[var(--text)]"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        {myPending || claimed ? (
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <p className="text-sm font-semibold text-[var(--text)]">
              {myPending?.type === "claim" || claimed
                ? "Your claim is in"
                : "Your offer is in"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              {myPending
                ? `${fmtUSD(myPending.amount)} — waiting on @${listing.sellerUsername} to accept or decline.`
                : "Waiting on the seller to accept or decline."}{" "}
              Track it any time in the Marketplace Inbox.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGoInbox}
                className="rounded-full bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-[var(--on-accent)]"
              >
                Open the Inbox
              </button>
              {myPending ? (
                <button
                  type="button"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate(myPending.offerId)}
                  className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--text)] disabled:opacity-50"
                >
                  Withdraw
                </button>
              ) : null}
            </div>
          </div>
        ) : canAct ? (
          <div className="mt-3">
            {!offerOpen ? (
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  setOfferOpen(true);
                  setOfferAmount(
                    listing.marketValue != null
                      ? String(Math.round(listing.marketValue * 0.9 * 100) / 100)
                      : "",
                  );
                }}
                className="w-full rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-semibold text-[var(--gold-soft)]"
              >
                Make an offer instead
              </button>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
                <label
                  htmlFor="market-offer-amount"
                  className="text-sm font-semibold text-[var(--text)]"
                >
                  Your offer (USD)
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="market-offer-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)]"
                  />
                  <button
                    type="button"
                    disabled={
                      offer.isPending ||
                      !(Number.parseFloat(offerAmount) > 0)
                    }
                    onClick={() =>
                      offer.mutate(Number.parseFloat(offerAmount))
                    }
                    className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
                  >
                    {offer.isPending ? "Sending…" : "Send offer"}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  The seller can accept or decline. If they accept, the
                  deal is on — you arrange payment and the handoff in
                  person, then both of you confirm.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Seller snippet */}
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
            Seller
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-album text-lg font-bold text-[var(--on-accent)]"
            >
              {listing.sellerUsername.charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                @{listing.sellerUsername}
                {listing.sellerIsTest ? (
                  <span className="ml-1.5 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--dim)]">
                    Test user
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-[var(--dim)]">
                Trust Score {trust ?? "—"}
                {connections != null
                  ? ` · ${connections} confirmed connection${connections === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            {sellerIsJarvis ? (
              <button
                type="button"
                onClick={onOpenJarvisProfile}
                className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
              >
                View profile
              </button>
            ) : null}
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
          How buying works in this phase: Buy Now claims the item at
          the asking price and notifies the seller — no payment is
          taken in the app. You arrange payment and the handoff in
          person; when you've both got what you agreed, each of you
          confirms the completed sale (in person, by scanning each
          other's Collector ID), and then each of you leaves a thumbs
          up or down for the other. Confirmed sales feed Trust
          Scores.
        </p>
      </div>
    </div>
  );
}

/** Sell an item: pick from your own collection (cards by finish,
    sealed products, or graded comics), set the price and
    condition, and publish. The server checks the quantity against
    what you actually own and haven't already listed. */
function SellSheet({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const [kind, setKind] = useState<"card" | "sealed" | "comic">("card");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProfileItemView | null>(null);
  const [selectedComic, setSelectedComic] = useState<
    (typeof COMICS)[number] | null
  >(null);
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("Near Mint");
  const [qty, setQty] = useState(1);
  const [qtyDialOpen, setQtyDialOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useQuery({
    queryKey: ["profileItems", search, "all", "name", kind],
    queryFn: () =>
      api.getProfileItems({
        query: search,
        group: "all",
        sort: "name",
        filter: kind === "card" ? "cards" : "sealed",
      }),
    enabled: kind !== "comic",
  });
  const comicResults = COMICS.filter((c) =>
    c.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const publish = useMutation({
    mutationFn: () => {
      const askingPrice = Number.parseFloat(price);
      if (selected) {
        return api.createListing({
          kind: selected.sealedName != null ? "sealed" : "card",
          cardId: selected.cardId,
          sealedName: selected.sealedName,
          comicId: null,
          comicName: "",
          comicGroup: "",
          comicFinish: "",
          comicValue: null,
          finish: selected.finish,
          condition:
            selected.sealedName != null ? "Sealed" : condition,
          qty,
          askingPrice,
        });
      }
      const comic = selectedComic as (typeof COMICS)[number];
      return api.createListing({
        kind: "comic",
        cardId: null,
        sealedName: null,
        comicId: comic.id,
        comicName: comic.title,
        comicGroup: comic.publisher,
        comicFinish: comic.label,
        comicValue: comic.value,
        finish: comic.label,
        condition: "Graded slab",
        qty: 1,
        askingPrice,
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        onPublished();
      } else {
        setError(res.error ?? "That listing didn't publish.");
      }
    },
    onError: () => setError("That listing didn't publish — try again."),
  });
  const pickItem = (item: ProfileItemView) => {
    hapticTick();
    setSelected(item);
    setSelectedComic(null);
    setQty(1);
    setError(null);
    setPrice(
      item.unitValue != null ? String(item.unitValue) : "",
    );
  };
  const pickComic = (comic: (typeof COMICS)[number]) => {
    hapticTick();
    setSelectedComic(comic);
    setSelected(null);
    setQty(1);
    setError(null);
    setPrice(String(comic.value));
  };
  const ready = (selected != null || selectedComic != null) &&
    Number.parseFloat(price) > 0;
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Sell an item"
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to marketplace"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sell form"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>
        <h2 className="font-album mt-4 text-[22px] font-bold leading-tight text-[var(--text)]">
          Sell an item
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Pick something from your own collection, set your asking
          price, and publish it to the Marketplace. You can change
          the price or pull the listing any time.
        </p>

        <div
          role="tablist"
          aria-label="What are you selling"
          className="mt-4 grid grid-cols-3 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
        >
          {(
            [
              ["card", "Cards"],
              ["sealed", "Sealed"],
              ["comic", "Comics"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              onClick={() => {
                if (kind === value) return;
                hapticTick();
                setKind(value);
                setSelected(null);
                setSelectedComic(null);
                setError(null);
              }}
              className={`rounded-full px-2 py-2 text-sm font-semibold ${
                kind === value
                  ? "bg-[var(--accent)] text-[var(--on-accent)]"
                  : "text-[var(--dim)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8a96]"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your collection…"
            aria-label="Search your collection"
            className="h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-12 pr-4 text-base text-[var(--text)] placeholder:text-[#8a8a96]"
          />
        </div>

        {kind !== "comic" ? (
          items.isPending ? (
            <p className="py-8 text-center text-sm text-[var(--dim)]">
              Loading your items…
            </p>
          ) : (items.data?.items ?? []).length === 0 ? (
            <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm text-[var(--dim)]" role="status">
              Nothing in your collection matches that.
            </p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-0.5">
              {(items.data?.items ?? []).map((item) => {
                const isPicked = selected?.key === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => pickItem(item)}
                      aria-pressed={isPicked}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${
                        isPicked
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--surface)]"
                      }`}
                    >
                      <span className="w-12 shrink-0">
                        <MarketArt
                          kind={item.sealedName != null ? "sealed" : "card"}
                          cardId={item.cardId}
                          sealedName={item.sealedName}
                          comicId={null}
                          name={item.name}
                          finish={item.finish}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">
                          {item.name}
                          {item.printed
                            ? ` ${item.printed.split("/")[0]}`
                            : ""}
                        </span>
                        <span className="block text-xs text-[var(--dim)]">
                          {item.groupName} · {item.finish} · You own ×
                          {item.qty}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[var(--text)]">
                        {item.unitValue != null
                          ? fmtUSD(item.unitValue)
                          : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : comicResults.length === 0 ? (
          <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm text-[var(--dim)]" role="status">
            No comics match that.
          </p>
        ) : (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-0.5">
            {comicResults.map((comic) => {
              const isPicked = selectedComic?.id === comic.id;
              return (
                <li key={comic.id}>
                  <button
                    type="button"
                    onClick={() => pickComic(comic)}
                    aria-pressed={isPicked}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${
                      isPicked
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    <span className="w-12 shrink-0">
                      <MarketArt
                        kind="comic"
                        cardId={null}
                        sealedName={null}
                        comicId={comic.id}
                        name={comic.title}
                        finish={comic.label}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {comic.title}
                      </span>
                      <span className="block text-xs text-[var(--dim)]">
                        {comic.publisher} · CGC {comic.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[var(--text)]">
                      {fmtUSD(comic.value)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected || selectedComic ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">
              {selected
                ? `${selected.name}${selected.printed ? ` ${selected.printed.split("/")[0]}` : ""} — ${selected.finish}`
                : `${selectedComic?.title} — CGC ${selectedComic?.label}`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                  Asking price (USD)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  aria-label="Asking price in dollars"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)]"
                />
              </label>
              {selected && selected.sealedName == null ? (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                    Condition
                  </span>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    aria-label="Card condition"
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)]"
                  >
                    {[
                      "Near Mint",
                      "Lightly Played",
                      "Moderately Played",
                      "Heavily Played",
                      "Damaged",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
                    Condition
                  </span>
                  <p className="mt-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)]">
                    {selected ? "Sealed" : "Graded slab"}
                  </p>
                </div>
              )}
            </div>
            {selected && selected.qty > 1 ? (
              <>
              {/* The count dial opens ABOVE the quantity row
                  (Anthony, Nov 3, 2026, ~2:59 AM) — below it,
                  his thumb covered it. */}
              {qtyDialOpen ? (
                <div className="mt-3">
                  <SidewaysCountDial
                    overlay
                    label="Pick how many copies to list"
                    current={qty}
                    onPick={(n) => {
                      setQty(Math.min(n, selected.qty));
                      setQtyDialOpen(false);
                    }}
                    onClose={() => setQtyDialOpen(false)}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-[var(--text)]">
                  Quantity{" "}
                  <span className="text-[var(--dim)]">
                    (you own {selected.qty})
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <StepperButton
                    label="List one fewer"
                    glyph="−"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    circleClass="h-8 w-8 text-base"
                  />
                  <span className="w-8 text-center text-base font-semibold tabular-nums text-[var(--text)]">
                    {qty}
                  </span>
                  <StepperButton
                    label="List one more — hold to pick a count"
                    glyph="+"
                    disabled={qty >= selected.qty}
                    onClick={() =>
                      setQty((q) => Math.min(selected.qty, q + 1))
                    }
                    onLongPress={() => setQtyDialOpen((v) => !v)}
                    circleClass="h-8 w-8 text-base"
                  />
                </span>
              </div>
              </>
            ) : null}
            {selected?.unitValue != null || selectedComic ? (
              <p className="mt-2.5 text-xs leading-relaxed text-[var(--dim)]">
                Market value:{" "}
                {fmtUSD(
                  selected ? (selected.unitValue ?? 0) : selectedComic?.value ?? 0,
                )}{" "}
                — price above or below it as you like; buyers see how
                your price compares.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-2.5 text-sm text-red-400">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!ready || publish.isPending}
              onClick={() => publish.mutate()}
              className="mt-3 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
            >
              {publish.isPending ? "Publishing…" : "Publish listing"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const POSITIVE_TAGS = ["As described", "Fair price", "Friendly", "Fast"];
const NEGATIVE_TAGS = ["Not as described", "Slow", "Unresponsive"];

function ThumbIcon({ down }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {down ? (
        <>
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </>
      ) : (
        <>
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </>
      )}
    </svg>
  );
}

/** One deal: both-sides confirmation, then the mandatory blind
    feedback that finishes it. The feedback form has no skip —
    leaving it undone keeps the deal "Awaiting your feedback" and
    blocks new marketplace actions (the gate), with a 7-day
    neutral close as the safety valve. Test-friend steps are
    labeled as what they are. */
function DealSheet({
  deal,
  onClose,
  onChanged,
}: {
  deal: MarketDeal;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<"positive" | "negative" | null>(
    null,
  );
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [fbError, setFbError] = useState<string | null>(null);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["myListings"] });
    void queryClient.invalidateQueries({ queryKey: ["marketActivity"] });
    onChanged();
  };
  const confirm = useMutation({
    mutationFn: (asTestFriend: boolean) =>
      api.confirmDealSide({ offerId: deal.offerId, asTestFriend }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        invalidate();
      } else {
        setFbError(res.error ?? "That confirmation didn't go through.");
      }
    },
    onError: () => setFbError("That confirmation didn't go through."),
  });
  const submitFb = useMutation({
    mutationFn: (args: {
      rating: "positive" | "negative";
      tags: string[];
      comment: string | null;
      asTestFriend: boolean;
    }) =>
      api.submitFeedback({
        offerId: deal.offerId,
        rating: args.rating,
        tags: args.tags,
        comment: args.comment,
        asTestFriend: args.asTestFriend,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        invalidate();
      } else {
        setFbError(res.error ?? "That feedback didn't save.");
      }
    },
    onError: () => setFbError("That feedback didn't save — try again."),
  });
  const completed = deal.completedAt != null;
  const tagOptions =
    rating === "positive"
      ? POSITIVE_TAGS
      : rating === "negative"
        ? NEGATIVE_TAGS
        : [];
  const ratingLine = (
    label: string,
    value: "positive" | "negative" | null,
    fbTags: string[],
    fbComment: string | null,
    noFeedback: boolean,
  ) => (
    <div className="flex items-start gap-3 py-2">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          value === "positive"
            ? "bg-emerald-400/15 text-emerald-400"
            : value === "negative"
              ? "bg-red-400/15 text-red-400"
              : "bg-[var(--border)] text-[var(--dim)]"
        }`}
      >
        <ThumbIcon down={value === "negative"} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">
          {label}:{" "}
          {noFeedback
            ? "No feedback"
            : value === "positive"
              ? "Positive"
              : value === "negative"
                ? "Negative"
                : "—"}
        </p>
        {fbTags.length > 0 ? (
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            {fbTags.join(" · ")}
          </p>
        ) : null}
        {fbComment ? (
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--text)]">
            “{fbComment}”
          </p>
        ) : null}
      </div>
    </div>
  );
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Deal: ${deal.itemName}`}
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to inbox"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close deal"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="w-16 shrink-0">
            <MarketArt
              kind={deal.kind}
              cardId={deal.cardId}
              sealedName={deal.sealedName}
              comicId={deal.comicId}
              name={deal.itemName}
              finish={deal.finish}
            />
          </span>
          <div className="min-w-0">
            <h2 className="font-album text-lg font-bold leading-tight text-[var(--text)]">
              {deal.itemName}
            </h2>
            <p className="text-sm text-[var(--dim)]">
              {deal.finish} · {deal.type === "claim" ? "Buy Now claim" : "Accepted offer"}
            </p>
            <p className="mt-0.5 text-base font-bold text-[var(--text)]">
              {fmtUSD(deal.amount)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--dim)]">
          You are the {deal.role}. Other side: @{deal.otherUsername}
          {deal.otherIsTest ? " (test user)" : ""}
        </p>

        {fbError ? (
          <p role="alert" className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-[var(--text)]">
            {fbError}
          </p>
        ) : null}

        {!completed ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="font-album text-base text-[var(--text)]">
              Complete the sale
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              Meet in person, hand over the item and the payment you
              arranged, and each of you confirms here — in person
              you scan each other's Collector ID first. The sale only
              counts as complete when BOTH sides have confirmed, and
              that's what feeds Trust.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--text)]">You</span>
                <span
                  className={`font-semibold ${deal.myConfirmed ? "text-emerald-400" : "text-[var(--dim)]"}`}
                >
                  {deal.myConfirmed ? "Confirmed ✓" : "Not yet"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-[var(--text)]">
                  @{deal.otherUsername}
                </span>
                <span
                  className={`font-semibold ${deal.theirConfirmed ? "text-emerald-400" : "text-[var(--dim)]"}`}
                >
                  {deal.theirConfirmed ? "Confirmed ✓" : "Not yet"}
                </span>
              </li>
            </ul>
            {!deal.myConfirmed ? (
              <button
                type="button"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(false)}
                className="mt-3 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
              >
                Confirm my side — we completed the sale
              </button>
            ) : null}
            {deal.otherIsTest && !deal.theirConfirmed ? (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-3">
                <p className="text-xs leading-relaxed text-[var(--dim)]">
                  Test user: @{deal.otherUsername} is built into the
                  app for testing, so his confirmation happens here.
                </p>
                <button
                  type="button"
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate(true)}
                  className="mt-2 rounded-full border border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                >
                  Confirm as @{deal.otherUsername} (test)
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
            <h3 className="font-album text-base text-[var(--text)]">
              Sale complete ✓
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              Both sides confirmed — this deal is recorded in the
              Trust ledger on the server.
            </p>
          </div>
        )}

        {completed && deal.awaitingMyFeedback ? (
          <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4">
            <h3 className="font-album text-base text-[var(--text)]">
              Last step: rate @{deal.otherUsername}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              This is required — the deal isn't finished until you've
              rated, and new marketplace actions stay paused until
              you do. Two taps: pick a thumb, add any tags that fit.
              Neither side sees the other's rating until both are in.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={rating === "positive"}
                onClick={() => {
                  hapticTick();
                  setRating("positive");
                  setTags([]);
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold ${
                  rating === "positive"
                    ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                <ThumbIcon /> Positive
              </button>
              <button
                type="button"
                aria-pressed={rating === "negative"}
                onClick={() => {
                  hapticTick();
                  setRating("negative");
                  setTags([]);
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold ${
                  rating === "negative"
                    ? "border-red-400 bg-red-400/15 text-red-400"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                <ThumbIcon down /> Negative
              </button>
            </div>
            {tagOptions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tagOptions.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        hapticTick();
                        setTags((prev) =>
                          on
                            ? prev.filter((t) => t !== tag)
                            : [...prev, tag],
                        );
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        on
                          ? "bg-[var(--accent)] text-[var(--on-accent)]"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <label className="mt-3 block">
              <span className="sr-only">Optional comment</span>
              <input
                type="text"
                value={comment}
                maxLength={280}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[#8a8a96]"
              />
            </label>
            <button
              type="button"
              disabled={rating == null || submitFb.isPending}
              onClick={() =>
                rating &&
                submitFb.mutate({
                  rating,
                  tags,
                  comment: comment.trim() ? comment.trim() : null,
                  asTestFriend: false,
                })
              }
              className="mt-3 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--on-accent)] disabled:opacity-50"
            >
              {submitFb.isPending ? "Saving…" : "Finish — submit feedback"}
            </button>
          </div>
        ) : null}

        {completed && deal.myRating && !deal.feedbackClosed ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm leading-relaxed text-[var(--text)]">
              Your rating is in — waiting on @{deal.otherUsername}.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              Ratings stay hidden until both sides have rated, so
              nobody can copy or retaliate. If 7 days pass with no
              rating from them, the deal closes as neutral "No
              feedback" with no score impact.
            </p>
            {deal.otherIsTest ? (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-3">
                <p className="text-xs leading-relaxed text-[var(--dim)]">
                  Test user: leave @{deal.otherUsername}'s feedback
                  here to close the deal out.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={submitFb.isPending}
                    onClick={() =>
                      submitFb.mutate({
                        rating: "positive",
                        tags: ["As described", "Friendly"],
                        comment: null,
                        asTestFriend: true,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                  >
                    <ThumbIcon /> as @{deal.otherUsername} (test)
                  </button>
                  <button
                    type="button"
                    disabled={submitFb.isPending}
                    onClick={() =>
                      submitFb.mutate({
                        rating: "negative",
                        tags: [],
                        comment: null,
                        asTestFriend: true,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                  >
                    <ThumbIcon down /> as @{deal.otherUsername} (test)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {completed && deal.feedbackClosed ? (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
            {ratingLine(
              "You rated",
              deal.myRating,
              deal.myTags,
              deal.myComment,
              deal.myRating == null,
            )}
            <div className="border-t border-[var(--border)]">
              {ratingLine(
                `@${deal.otherUsername} rated`,
                deal.theirRating,
                deal.theirTags,
                deal.theirComment,
                deal.theirRating == null,
              )}
            </div>
            {deal.myRating == null || deal.theirRating == null ? (
              <p className="pb-2 text-xs leading-relaxed text-[var(--dim)]">
                A side that never rated inside 7 days closes as
                neutral "No feedback" — no score impact either way.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The Marketplace area while it is held from release (Anthony,
    Nov 2, 2026, late): the buy/sell area stays visible in its
    usual place — heading, the buy-and-sell description, the
    section tabs, and the search bar, all present but switched
    off — with a big yellow bubbly "Coming soon" running
    diagonally down across the whole area, left to right. No
    listings render here, so the seeded Elsa and Stitch artwork
    is gone from the Marketplace entirely, and nothing in the
    area can be tapped, claimed, or sold until Anthony reopens
    it. His listings and deals stay stored underneath, untouched. */
function MarketplaceHeldPanel() {
  return (
    <section
      aria-label="Marketplace, coming soon"
      className="relative mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <p className="sr-only">
        The Marketplace is coming soon. It is not open yet, so
        buying and selling are switched off for now.
      </p>
      {/* The area itself, visible but inert: every control is
          disabled and the whole block is hidden from assistive
          tech, which gets the coming-soon message above instead. */}
      <div aria-hidden="true" className="pointer-events-none p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-album text-xl text-[var(--text)]">
              Marketplace
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              Buy and sell with other collectors. Buy Now claims an
              item at the asking price and notifies the seller — no
              payment happens in the app; you arrange the deal, meet
              in person, and both confirm the sale, which is what
              feeds Trust.
            </p>
          </div>
          <button
            type="button"
            disabled
            tabIndex={-1}
            className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)] opacity-60"
          >
            Sell an item
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 rounded-full border border-[var(--border)] bg-[var(--bg)] p-1">
          {["Browse", "Your Listings", "Inbox"].map((label, i) => (
            <span
              key={label}
              className={`rounded-full px-2 py-2 text-center text-sm font-semibold ${
                i === 0
                  ? "bg-[var(--accent)] text-[var(--on-accent)] opacity-60"
                  : "text-[var(--dim)]"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
        <input
          type="search"
          disabled
          tabIndex={-1}
          placeholder="Search by name or card number…"
          className="mt-4 h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-base text-[var(--text)] placeholder:text-[#8a8a96]"
        />
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3.5 text-sm leading-relaxed text-[var(--dim)]">
          Listings from other collectors will appear here when the
          Marketplace opens.
        </p>
      </div>
      {/* The stamp: yellow bubbly "Coming soon" running diagonally
          down toward the right across the whole area. Purely a
          label — it never blocks the tabs around the area. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
        <span className="bubbly-soon rotate-[18deg] whitespace-nowrap text-[42px] leading-none sm:text-6xl">
          Coming soon
        </span>
      </div>
    </section>
  );
}

/** The Marketplace area: Browse (search/filter/sort + Sell),
    Your Listings (manage), and the Inbox (claims, offers, and
    deals needing an answer, a confirmation, or feedback). The
    feedback gate banner rides on top of every tab while a
    finished deal waits on Anthony's rating. */
function MarketplacePanel({
  onOpenJarvisProfile,
}: {
  onOpenJarvisProfile: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"browse" | "listings" | "inbox">(
    "browse",
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "card" | "sealed" | "comic">(
    "all",
  );
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState<"price-asc" | "price-desc" | "newest">(
    "newest",
  );
  const [selected, setSelected] = useState<MarketListing | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [openDealId, setOpenDealId] = useState<number | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>(
    {},
  );
  const [manageError, setManageError] = useState<string | null>(null);
  const seededRef = useRef(false);
  const invalidateMarket = () => {
    void queryClient.invalidateQueries({ queryKey: ["marketplace"] });
    void queryClient.invalidateQueries({ queryKey: ["myListings"] });
    void queryClient.invalidateQueries({ queryKey: ["marketActivity"] });
  };
  // First open: seed the test friend's listings exactly once
  // (server-guarded by a marker; a no-op afterwards).
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void api
      .seedMarketplace({})
      .then(() => invalidateMarket())
      .catch(() => {
        // Seeding is a convenience; the marketplace works without it.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const browse = useQuery({
    queryKey: ["marketplace", query, kind, group, sort],
    queryFn: () => api.getMarketplace({ query, kind, group, sort }),
  });
  const mine = useQuery({
    queryKey: ["myListings"],
    queryFn: () => api.getMyListings({}),
  });
  const activity = useQuery({
    queryKey: ["marketActivity"],
    queryFn: () => api.getMarketplaceActivity({}),
  });
  const registry = useQuery({
    queryKey: ["registryMembers"],
    queryFn: () => api.getRegistryMembers({}),
  });
  const gate = activity.data?.gate ?? browse.data?.gate ?? null;
  const trustFor = (code: string): number | null => {
    const member = registry.data?.members.find(
      (m) => m.collectorId === code,
    );
    if (member) return member.trustScore;
    if (code === JARVIS_FRIEND.collectorCode)
      return JARVIS_FRIEND.trustScore;
    return null;
  };
  const connectionsFor = (code: string): number | null =>
    code === JARVIS_FRIEND.collectorCode ? JARVIS_FRIEND.connections : null;
  const incoming = activity.data?.incoming ?? [];
  const outgoing = activity.data?.outgoing ?? [];
  const deals = activity.data?.deals ?? [];
  const inboxBadge =
    incoming.length + (gate?.awaitingCount ?? 0);
  const openDeal = deals.find((d) => d.offerId === openDealId) ?? null;
  const manage = useMutation({
    mutationFn: (args: {
      listingId: number;
      askingPrice: number | null;
      action: "none" | "remove" | "mark_sold" | "relist";
    }) => api.updateListing(args),
    onSuccess: (res) => {
      if (res.ok) {
        hapticTick();
        setManageError(null);
        invalidateMarket();
      } else {
        setManageError(res.error ?? "That didn't go through.");
      }
    },
    onError: () => setManageError("That didn't go through — try again."),
  });
  const respond = useMutation({
    mutationFn: (args: {
      offerId: number;
      accept: boolean;
      asTestFriend: boolean;
    }) => api.respondOffer(args),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setManageError(null);
        invalidateMarket();
      } else {
        setManageError(res.error ?? "That didn't go through.");
      }
    },
    onError: () => setManageError("That didn't go through — try again."),
  });
  const withdraw = useMutation({
    mutationFn: (offerId: number) => api.cancelOffer({ offerId }),
    onSuccess: (res) => {
      if (res.ok) {
        invalidateMarket();
      } else {
        setManageError(res.error ?? "That didn't go through.");
      }
    },
    onError: () => setManageError("That didn't go through — try again."),
  });
  const myPendingFor = (listingId: number) =>
    outgoing.find((o) => o.listingId === listingId);
  const firstAwaitingDeal = deals.find((d) => d.awaitingMyFeedback);
  return (
    <section aria-label="Marketplace" className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-album text-xl text-[var(--text)]">
            Marketplace
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
            Buy and sell with other collectors. Buy Now claims an
            item at the asking price and notifies the seller — no
            payment happens in the app; you arrange the deal, meet
            in person, and both confirm the sale, which is what
            feeds Trust.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            hapticTick();
            setSellOpen(true);
          }}
          className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)]"
        >
          Sell an item
        </button>
      </div>

      {gate?.blocked ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-red-400/50 bg-red-500/15 p-3.5"
        >
          <p className="text-sm font-semibold text-[var(--text)]">
            Awaiting your feedback
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--text)]">
            {gate.awaitingCount === 1
              ? "A finished deal is waiting on your thumbs up or down."
              : `${gate.awaitingCount} finished deals are waiting on your thumbs up or down.`}{" "}
            New claims, offers, and listings stay paused until it's
            done — finish your feedback to keep trading.
          </p>
          {firstAwaitingDeal ? (
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setTab("inbox");
                setOpenDealId(firstAwaitingDeal.offerId);
              }}
              className="mt-2 rounded-full bg-[var(--accent)] px-3.5 py-2 text-sm font-bold text-[var(--on-accent)]"
            >
              Leave feedback now
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Marketplace sections"
        className="mt-4 grid grid-cols-3 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
      >
        {(
          [
            ["browse", "Browse"],
            ["listings", "Your Listings"],
            ["inbox", inboxBadge > 0 ? `Inbox (${inboxBadge})` : "Inbox"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              if (tab === value) return;
              hapticTick();
              setTab(value);
            }}
            className={`rounded-full px-2 py-2 text-sm font-semibold ${
              tab === value
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "text-[var(--dim)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {manageError ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {manageError}
        </p>
      ) : null}

      {tab === "browse" ? (
        <>
          <div className="relative mt-4">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8a96]"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or card number…"
              aria-label="Search marketplace listings by name or collector number"
              className="h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-12 pr-4 text-base text-[var(--text)] placeholder:text-[#8a8a96]"
            />
          </div>
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
            {(
              [
                ["all", "All items"],
                ["card", "Cards"],
                ["sealed", "Sealed"],
                ["comic", "Comics"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => {
                  if (kind === value) return;
                  hapticTick();
                  setKind(value);
                  setGroup("all");
                }}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${
                  kind === value
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Filter by set or collection</span>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]"
              >
                <option value="all">Set • All Sets</option>
                {(browse.data?.groups ?? []).map((g) => (
                  <option key={g} value={g}>
                    Set • {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Sort listings</span>
              <select
                value={sort}
                onChange={(e) =>
                  setSort(
                    e.target.value as "price-asc" | "price-desc" | "newest",
                  )
                }
                className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)]"
              >
                <option value="newest">Sort • Newest</option>
                <option value="price-asc">Sort • Price, low to high</option>
                <option value="price-desc">Sort • Price, high to low</option>
              </select>
            </label>
          </div>

          {browse.isPending ? (
            <p className="py-10 text-center text-sm text-[var(--dim)]">
              Loading listings…
            </p>
          ) : (browse.data?.listings ?? []).length === 0 ? (
            <p
              className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm leading-relaxed text-[var(--dim)]"
              role="status"
            >
              No listings match that right now. Try a different
              search — or be the first to sell something with the
              Sell an item button.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {(browse.data?.listings ?? []).map((listing) => (
                <ListingTile
                  key={listing.id}
                  listing={listing}
                  trust={trustFor(listing.sellerCode)}
                  onOpen={() => {
                    hapticTick();
                    setSelected(listing);
                  }}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}

      {tab === "listings" ? (
        <>
          {mine.isPending ? (
            <p className="py-10 text-center text-sm text-[var(--dim)]">
              Loading your listings…
            </p>
          ) : (mine.data?.listings ?? []).length === 0 ? (
            <p
              className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-sm leading-relaxed text-[var(--dim)]"
              role="status"
            >
              You have no listings yet. Tap Sell an item and pick
              anything from your collection — a card, a sealed
              product like a booster box, or a graded comic.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(mine.data?.listings ?? []).map((listing) => {
                const draft =
                  priceDrafts[listing.id] ?? String(listing.askingPrice);
                const priceChanged =
                  Number.parseFloat(draft) > 0 &&
                  Number.parseFloat(draft) !== listing.askingPrice;
                return (
                  <li
                    key={listing.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 shrink-0">
                        <MarketArt
                          kind={listing.kind}
                          cardId={listing.cardId}
                          sealedName={listing.sealedName}
                          comicId={listing.comicId}
                          name={listing.name}
                          finish={listing.finish}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text)]">
                          {listing.name}
                          {listing.printed
                            ? ` ${listing.printed.split("/")[0]}`
                            : ""}
                        </p>
                        <p className="text-xs text-[var(--dim)]">
                          {listing.finish} · {listing.condition}
                          {listing.qty > 1 ? ` · Qty ${listing.qty}` : ""}
                        </p>
                        <p className="mt-0.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              listing.status === "available"
                                ? "bg-emerald-400/15 text-emerald-400"
                                : listing.status === "pending"
                                  ? "bg-amber-400/15 text-amber-400"
                                  : "bg-[var(--border)] text-[var(--dim)]"
                            }`}
                          >
                            {listing.status === "available"
                              ? "Available"
                              : listing.status === "pending"
                                ? "Sale pending"
                                : "Sold"}
                          </span>
                          {listing.pendingOffers > 0 ? (
                            <span className="ml-1.5 text-xs font-medium text-[var(--gold-soft)]">
                              {listing.pendingOffers} waiting in your
                              Inbox
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-sm text-[var(--dim)]">
                        $
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={draft}
                          disabled={listing.status !== "available"}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [listing.id]: e.target.value,
                            }))
                          }
                          aria-label={`Asking price for ${listing.name}`}
                          className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--text)] disabled:opacity-50"
                        />
                      </label>
                      {priceChanged && listing.status === "available" ? (
                        <button
                          type="button"
                          disabled={manage.isPending}
                          onClick={() =>
                            manage.mutate({
                              listingId: listing.id,
                              askingPrice: Number.parseFloat(draft),
                              action: "none",
                            })
                          }
                          className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--on-accent)] disabled:opacity-50"
                        >
                          Save price
                        </button>
                      ) : null}
                      {listing.status === "available" ? (
                        <button
                          type="button"
                          disabled={manage.isPending}
                          onClick={() =>
                            manage.mutate({
                              listingId: listing.id,
                              askingPrice: null,
                              action: "mark_sold",
                            })
                          }
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
                        >
                          Mark sold
                        </button>
                      ) : null}
                      {listing.status === "sold" ? (
                        <button
                          type="button"
                          disabled={manage.isPending}
                          onClick={() =>
                            manage.mutate({
                              listingId: listing.id,
                              askingPrice: null,
                              action: "relist",
                            })
                          }
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
                        >
                          Relist
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={manage.isPending}
                        onClick={() =>
                          manage.mutate({
                            listingId: listing.id,
                            askingPrice: null,
                            action: "remove",
                          })
                        }
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {tab === "inbox" ? (
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="font-album text-base text-[var(--text)]">
              Claims & offers on your items
            </h3>
            {incoming.length === 0 ? (
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                Nothing waiting. When a collector claims or offers on
                one of your listings, it lands here for you to accept
                or decline.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {incoming.map((o) => (
                  <li
                    key={o.offerId}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-sm text-[var(--text)]">
                      <span className="font-semibold">
                        @{o.otherUsername}
                      </span>{" "}
                      {o.type === "claim"
                        ? `wants to buy your ${o.itemName} at your asking price of ${fmtUSD(o.amount)}.`
                        : `offered ${fmtUSD(o.amount)} for your ${o.itemName} (asking ${fmtUSD(o.askingPrice)}).`}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({
                            offerId: o.offerId,
                            accept: true,
                            asTestFriend: false,
                          })
                        }
                        className="rounded-full bg-[var(--accent)] px-3.5 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({
                            offerId: o.offerId,
                            accept: false,
                            asTestFriend: false,
                          })
                        }
                        className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-album text-base text-[var(--text)]">
              Your claims & offers
            </h3>
            {outgoing.length === 0 ? (
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                You haven't claimed or offered on anything yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {outgoing.map((o) => (
                  <li
                    key={o.offerId}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-sm text-[var(--text)]">
                      {o.type === "claim" ? "You claimed" : "You offered"}{" "}
                      <span className="font-semibold">{o.itemName}</span>{" "}
                      from @{o.otherUsername} at {fmtUSD(o.amount)} —
                      waiting on the seller.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={withdraw.isPending}
                        onClick={() => withdraw.mutate(o.offerId)}
                        className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                      >
                        Withdraw
                      </button>
                      {o.otherIsTest ? (
                        <>
                          <button
                            type="button"
                            disabled={respond.isPending}
                            onClick={() =>
                              respond.mutate({
                                offerId: o.offerId,
                                accept: true,
                                asTestFriend: true,
                              })
                            }
                            className="rounded-full border border-dashed border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                          >
                            Accept as @{o.otherUsername} (test)
                          </button>
                          <button
                            type="button"
                            disabled={respond.isPending}
                            onClick={() =>
                              respond.mutate({
                                offerId: o.offerId,
                                accept: false,
                                asTestFriend: true,
                              })
                            }
                            className="rounded-full border border-dashed border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
                          >
                            Decline as @{o.otherUsername} (test)
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-album text-base text-[var(--text)]">
              Your deals
            </h3>
            {deals.length === 0 ? (
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                No deals yet. When a claim or offer is accepted, the
                deal lives here — confirmations, completion, and the
                feedback that finishes it.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {deals.map((deal) => (
                  <li key={deal.offerId}>
                    <button
                      type="button"
                      onClick={() => {
                        hapticTick();
                        setOpenDealId(deal.offerId);
                      }}
                      aria-label={`Open deal: ${deal.itemName} with ${deal.otherUsername}${deal.awaitingMyFeedback ? ". Awaiting your feedback" : ""}`}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left"
                    >
                      <span className="w-12 shrink-0">
                        <MarketArt
                          kind={deal.kind}
                          cardId={deal.cardId}
                          sealedName={deal.sealedName}
                          comicId={deal.comicId}
                          name={deal.itemName}
                          finish={deal.finish}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--text)]">
                          {deal.itemName}
                        </span>
                        <span className="block text-xs text-[var(--dim)]">
                          {deal.role === "buyer" ? "Buying from" : "Selling to"} @
                          {deal.otherUsername} · {fmtUSD(deal.amount)}
                        </span>
                        <span
                          className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            deal.awaitingMyFeedback
                              ? "bg-red-400/15 text-red-400"
                              : deal.completedAt
                                ? "bg-emerald-400/15 text-emerald-400"
                                : "bg-amber-400/15 text-amber-400"
                          }`}
                        >
                          {deal.awaitingMyFeedback
                            ? "Awaiting your feedback"
                            : deal.completedAt
                              ? deal.feedbackClosed
                                ? "Complete — feedback closed"
                                : "Complete — feedback in progress"
                              : "Deal in progress — confirmations needed"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {selected ? (
        <ListingSheet
          listing={selected}
          trust={trustFor(selected.sellerCode)}
          connections={connectionsFor(selected.sellerCode)}
          myPending={myPendingFor(selected.id)}
          onClose={() => setSelected(null)}
          onChanged={invalidateMarket}
          onOpenJarvisProfile={() => {
            setSelected(null);
            onOpenJarvisProfile();
          }}
          onGoInbox={() => {
            setSelected(null);
            setTab("inbox");
          }}
        />
      ) : null}
      {sellOpen ? (
        <SellSheet
          onClose={() => setSellOpen(false)}
          onPublished={() => {
            setSellOpen(false);
            setTab("listings");
            invalidateMarket();
          }}
        />
      ) : null}
      {openDeal ? (
        <DealSheet
          deal={openDeal}
          onClose={() => setOpenDealId(null)}
          onChanged={invalidateMarket}
        />
      ) : null}
    </section>
  );
}

type TradeView = ApiResponse<typeof api, "getTrades">["trades"][number];
type CashPurchaseView = ApiResponse<
  typeof api,
  "getCashPurchases"
>["purchases"][number];
type TradePick = {
  cardId: number;
  name: string;
  printed: string | null;
  finish: string;
  qty: number;
  maxQty: number;
  /** Current market value per copy when known (from the
      profile item or cart line it came from); null when the
      pick came from a Fill my order result, whose per-item
      values the server reports only as side totals. */
  unitValue: number | null;
};

/** One line in a trade or cash cart (Anthony's cart design,
    Nov 2, 2026, late): a card being gathered from one friend's
    collection toward checkout. Carts live in SocialPanel state,
    keyed per card + finish; maxQty is the owner's available
    copies, the cap every stepper respects. */
type CartLine = {
  cardId: number;
  name: string;
  groupName: string;
  printed: string | null;
  finish: string;
  qty: number;
  maxQty: number;
  unitValue: number | null;
};

const cartKeyOf = (cardId: number, finish: string) =>
  `${cardId}:${finish}`;

function TradeItemsLine({
  items,
}: {
  items: TradeView["myGive"];
}) {
  if (items.length === 0)
    return <span className="text-[var(--dim)]">Nothing</span>;
  return (
    <span>
      {items.map(
        (i) =>
          `${i.qty}× ${i.name}${i.printed ? ` ${i.printed.split("/")[0]}` : ""} (${i.finish})`,
      ).join(", ")}
    </span>
  );
}

/** The mandatory blind feedback form for one completed trade —
    same rules as a marketplace deal: pick a thumb, optional tags
    and comment, no skipping (new proposals stay paused until
    it's given). Used for Anthony's own rating and, labeled, for
    the test friend's side so a trade can be walked end to end. */
function TradeFeedbackForm({
  trade,
  asTestFriend,
  onDone,
}: {
  trade: TradeView;
  asTestFriend: boolean;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      api.submitTradeFeedback({
        tradeId: trade.tradeId,
        rating: rating as "positive" | "negative",
        tags,
        comment: comment.trim() ? comment.trim() : null,
        asTestFriend,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        onDone();
      } else {
        setError(res.error ?? "That feedback didn't save.");
      }
    },
    onError: () => setError("That feedback didn't save — try again."),
  });
  const tagOptions =
    rating === "positive"
      ? POSITIVE_TAGS
      : rating === "negative"
        ? NEGATIVE_TAGS
        : [];
  return (
    <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-3">
      <p className="text-sm font-semibold text-[var(--text)]">
        {asTestFriend
          ? `Rate as @${trade.otherUsername} (test)`
          : `Last step: rate @${trade.otherUsername}`}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
        Required to finish the trade — and neither side sees the
        other&rsquo;s rating until both are in.
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={rating === "positive"}
          aria-label="Positive feedback"
          onClick={() => {
            hapticTick();
            setRating("positive");
            setTags([]);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
            rating === "positive"
              ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          }`}
        >
          <ThumbIcon /> Positive
        </button>
        <button
          type="button"
          aria-pressed={rating === "negative"}
          aria-label="Negative feedback"
          onClick={() => {
            hapticTick();
            setRating("negative");
            setTags([]);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
            rating === "negative"
              ? "border-red-400 bg-red-400/15 text-red-400"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          }`}
        >
          <ThumbIcon down /> Negative
        </button>
      </div>
      {tagOptions.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tagOptions.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  hapticTick();
                  setTags((prev) =>
                    on ? prev.filter((t) => t !== tag) : [...prev, tag],
                  );
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  on
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}
      <label className="mt-2.5 block">
        <span className="sr-only">Optional comment</span>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment…"
          maxLength={280}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={rating == null || submit.isPending}
        onClick={() => submit.mutate()}
        className="mt-2.5 w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
      >
        Send feedback
      </button>
    </div>
  );
}

/** The mandatory blind feedback on a completed cash purchase —
    the trade feedback form's twin, same rules: ratings stay
    hidden until both sides are in (or the 7-day neutral close). */
function CashFeedbackForm({
  purchase,
  asTestSeller,
  onDone,
}: {
  purchase: CashPurchaseView;
  asTestSeller: boolean;
  onDone: () => void;
}) {
  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      api.submitCashFeedback({
        purchaseId: purchase.purchaseId,
        rating: rating as "positive" | "negative",
        tags,
        comment: comment.trim() ? comment.trim() : null,
        asTestSeller,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        onDone();
      } else {
        setError(res.error ?? "That feedback didn't save.");
      }
    },
    onError: () => setError("That feedback didn't save — try again."),
  });
  const tagOptions =
    rating === "positive"
      ? POSITIVE_TAGS
      : rating === "negative"
        ? NEGATIVE_TAGS
        : [];
  return (
    <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-3">
      <p className="text-sm font-semibold text-[var(--text)]">
        {asTestSeller
          ? `Rate as @${purchase.sellerUsername} (test)`
          : `Last step: rate @${purchase.sellerUsername}`}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
        Required to finish the purchase — and neither side sees
        the other&rsquo;s rating until both are in.
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={rating === "positive"}
          aria-label="Positive feedback"
          onClick={() => {
            hapticTick();
            setRating("positive");
            setTags([]);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
            rating === "positive"
              ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          }`}
        >
          <ThumbIcon /> Positive
        </button>
        <button
          type="button"
          aria-pressed={rating === "negative"}
          aria-label="Negative feedback"
          onClick={() => {
            hapticTick();
            setRating("negative");
            setTags([]);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
            rating === "negative"
              ? "border-red-400 bg-red-400/15 text-red-400"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          }`}
        >
          <ThumbIcon down /> Negative
        </button>
      </div>
      {tagOptions.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tagOptions.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  hapticTick();
                  setTags((prev) =>
                    on ? prev.filter((t) => t !== tag) : [...prev, tag],
                  );
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  on
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}
      <label className="mt-2.5 block">
        <span className="sr-only">Optional comment</span>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment…"
          maxLength={280}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={rating == null || submit.isPending}
        onClick={() => submit.mutate()}
        className="mt-2.5 w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
      >
        Send feedback
      </button>
    </div>
  );
}

/** Cash checkout (Anthony's cart design): the cash cart's
    review-and-send step — a clean invoice, since the only
    counter is the price. Lines are priced live on the server
    at current market value; sending freezes each price and
    lands one purchase request per card under Cash purchases
    below, for the owner to accept or decline card by card. A
    line with no tracked price NEVER blocks the send (his
    rule, Nov 3, 2026): the notice is information only — the
    line simply isn't counted in the TCG suggested total, and
    he can remove it here and send the rest whenever he likes. */
function CashCheckoutSection({
  lines,
  onSetLines,
  bare = false,
  onCancel,
}: {
  lines: CartLine[];
  onSetLines: (lines: CartLine[]) => void;
  /** On the dedicated checkout page the big page title already
      says it — the section's own "Cash checkout" label is the
      duplicate Anthony had deleted (Nov 3, 2026). */
  bare?: boolean;
  /** Checkout-page cancel (Anthony, Nov 3, 2026): backs out of
      the checkout entirely — nothing is sent, no order is
      created. Only wired on the dedicated checkout page. */
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The buyer's offer total (Anthony's receiver-verification
  // rule): it starts at the TCG suggested total and he may
  // change it before sending; the receiver then sees the
  // offer next to the suggested price. null = untouched, so
  // it follows the quote; any cart change resets it.
  const [offerDraft, setOfferDraft] = useState<string | null>(null);
  // The buyer's message with this order (Anthony, Nov 3,
  // 2026): written here in the checkout BEFORE sending, it
  // travels with the purchase order and opens the message
  // thread inside each purchase — the seller sees it with
  // the order and answers in that same thread. Text only,
  // no links, like every order message.
  const [orderMessage, setOrderMessage] = useState("");
  const [sentWithMessage, setSentWithMessage] = useState(false);
  const messageHasLink = DEAL_LINK_CLIENT.test(orderMessage);
  const sig = lines
    .map((l) => `${l.cardId}:${l.finish}:${l.qty}`)
    .join("|");
  useEffect(() => {
    setOfferDraft(null);
  }, [sig]);
  const quote = useQuery({
    queryKey: ["cashCartQuote", sig],
    queryFn: () =>
      api.priceCashCart({
        items: lines.map((l) => ({
          cardId: l.cardId,
          finish: l.finish,
          qty: l.qty,
        })),
      }),
    enabled: lines.length > 0,
  });
  const suggestedTotal = quote.data?.total ?? null;
  const offerValue =
    offerDraft == null
      ? suggestedTotal
      : Number.parseFloat(offerDraft);
  const offerValid =
    offerValue != null && Number.isFinite(offerValue) && offerValue >= 0;
  const offerTotalArg =
    offerValid && offerDraft != null && offerValue != null
      ? Math.round(offerValue * 100) / 100
      : undefined;
  const send = useMutation({
    mutationFn: () =>
      api.createCashOrder({
        items: lines.map((l) => ({
          cardId: l.cardId,
          finish: l.finish,
          qty: l.qty,
        })),
        ...(offerTotalArg != null ? { offerTotal: offerTotalArg } : {}),
        ...(orderMessage.trim()
          ? { message: orderMessage.trim() }
          : {}),
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setSentCount(res.purchaseIds.length);
        setSentWithMessage(orderMessage.trim().length > 0);
        setError(null);
        setOrderMessage("");
        onSetLines([]);
        void queryClient.invalidateQueries({ queryKey: ["cashPurchases"] });
      } else {
        setError(res.error ?? "That order didn't go through.");
      }
    },
    onError: () => setError("That order didn't go through — try again."),
  });
  if (lines.length === 0 && sentCount == null) return null;
  const quoteByKey = new Map(
    (quote.data?.lines ?? []).map((l) => [
      cartKeyOf(l.cardId, l.finish),
      l,
    ]),
  );
  const unpriced = quote.data
    ? lines.filter(
        (l) => quoteByKey.get(cartKeyOf(l.cardId, l.finish))?.price == null,
      )
    : [];
  const setQty = (line: CartLine, qty: number) => {
    onSetLines(
      lines.map((l) =>
        l === line ? { ...l, qty: Math.max(1, Math.min(qty, l.maxQty)) } : l,
      ),
    );
  };
  return (
    <>
      {bare ? null : (
        <h3 className="font-album mt-6 text-base text-[var(--text)]">
          Cash checkout
        </h3>
      )}
      {sentCount != null && lines.length === 0 ? (
        <p className="mt-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-3 text-sm leading-relaxed text-[var(--text)]">
          Order sent ✓ — {sentCount}{" "}
          {sentCount === 1 ? "request is" : "requests are"} waiting
          under Cash purchases {bare ? "in Trades" : "below"} for{" "}
          @{JARVIS_FRIEND.username} to accept or decline.
          {sentWithMessage
            ? " Your message went with the order — his answer lands in the message thread on the purchase below."
            : ""}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)]">
              Purchase order
            </p>
            <p className="text-xs text-[var(--dim)]">
              To @{JARVIS_FRIEND.username} · cash, in person
            </p>
          </div>
          <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {lines.map((line) => {
              const q = quoteByKey.get(cartKeyOf(line.cardId, line.finish));
              return (
                <li
                  key={cartKeyOf(line.cardId, line.finish)}
                  className="py-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-[var(--text)]">
                      {line.name}
                      {line.printed
                        ? ` ${line.printed.split("/")[0]}`
                        : ""}
                    </span>
                    <span className="shrink-0 font-album text-sm font-bold tabular-nums text-[var(--text)]">
                      {q == null || quote.isPending
                        ? "…"
                        : q.price == null
                          ? "—"
                          : fmtUSD(q.price * line.qty)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--dim)]">
                      {line.finish} ·{" "}
                      {q == null || quote.isPending
                        ? "pricing…"
                        : q.price == null
                          ? "no price tracked"
                          : `${fmtUSD(q.price)} each`}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`One fewer copy of ${line.name}`}
                        disabled={line.qty <= 1}
                        onClick={() => {
                          hapticTick();
                          setQty(line, line.qty - 1);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-sm font-bold text-[var(--text)] disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-5 text-center text-sm font-bold tabular-nums text-[var(--text)]">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`One more copy of ${line.name}`}
                        disabled={line.qty >= line.maxQty}
                        onClick={() => {
                          hapticTick();
                          setQty(line, line.qty + 1);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-sm font-bold text-[var(--text)] disabled:opacity-40"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name} from the cash cart`}
                        onClick={() => {
                          hapticTick();
                          onSetLines(lines.filter((l) => l !== line));
                        }}
                        className="ml-1 shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--dim)]"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {unpriced.length > 0 && !quote.isPending ? (
            <p className="mt-2.5 text-xs leading-relaxed text-amber-300">
              No price is tracked for{" "}
              {unpriced.map((l) => l.name).join(", ")} yet, so{" "}
              {unpriced.length === 1 ? "it isn't" : "they aren't"}{" "}
              counted in the TCG suggested total. You can still
              send the order with{" "}
              {unpriced.length === 1 ? "it" : "them"} in — your
              offer total covers the whole order — or remove{" "}
              {unpriced.length === 1 ? "it" : "them"} above and
              send the rest.
            </p>
          ) : null}
          <div className="mt-3.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[var(--dim)]">
                TCG suggested total
              </span>
              <span className="font-album text-base font-bold tabular-nums text-[var(--text)]">
                {quote.isPending
                  ? "…"
                  : quote.isError
                    ? "couldn't load"
                    : fmtUSD(suggestedTotal ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-right text-xs leading-relaxed text-[var(--dim)]">
              Each card at its current-day TCGplayer value, times
              quantity — priced fresh when the order goes out.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <label
                htmlFor="cash-offer-total"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Your offer total
              </label>
              <span className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--dim)]">$</span>
                <input
                  id="cash-offer-total"
                  inputMode="decimal"
                  value={
                    offerDraft ??
                    (suggestedTotal != null
                      ? suggestedTotal.toFixed(2)
                      : "")
                  }
                  onChange={(e) => setOfferDraft(e.target.value)}
                  placeholder="0.00"
                  className="h-[42px] w-28 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-right text-sm font-bold tabular-nums text-[var(--text)]"
                />
              </span>
            </div>
            {offerDraft != null &&
            suggestedTotal != null &&
            offerValid &&
            Math.abs((offerValue ?? 0) - suggestedTotal) >= 0.005 ? (
              <p className="mt-1 text-right text-xs text-[var(--dim)]">
                {(offerValue ?? 0) < suggestedTotal
                  ? `${fmtUSD(suggestedTotal - (offerValue ?? 0))} below the TCG suggested total`
                  : `${fmtUSD((offerValue ?? 0) - suggestedTotal)} above the TCG suggested total`}
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              You can change the total before sending — $0 is fine
              between friends. @{JARVIS_FRIEND.username} will see
              it as a proposed cash trade, with your offered total
              right next to the TCG suggested market price, and
              accepts or declines each card. You pay him directly;
              no payment happens in the app.
            </p>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={
                send.isPending ||
                quote.isPending ||
                !offerValid ||
                messageHasLink
              }
              onClick={() => {
                if (quote.isError) {
                  void quote.refetch();
                  return;
                }
                send.mutate();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3.5 text-base font-bold text-white shadow-[0_8px_20px_rgba(34,197,94,0.35),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.15)] ring-1 ring-white/30 transition-transform duration-100 active:scale-[0.98] disabled:opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)",
              }}
            >
              <CashIcon />
              {send.isPending
                ? "Sending…"
                : quote.isPending
                  ? "Pricing…"
                  : quote.isError
                    ? "Couldn't price the cart — tap to retry"
                    : `Send purchase order · ${fmtUSD(offerValid ? (offerValue ?? 0) : 0)}`}
            </button>
            {onCancel ? (
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  onCancel();
                }}
                className="flex shrink-0 items-center justify-center rounded-full px-5 py-3.5 text-base font-bold text-white shadow-[0_8px_20px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.15)] ring-1 ring-white/30 transition-transform duration-100 active:scale-[0.98]"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, #f87171 0%, #ef4444 100%)",
                }}
              >
                Cancel this purchase
              </button>
            ) : null}
          </div>
          {/* Message with this order (Anthony, Nov 3, 2026):
              below the Send / Cancel buttons, per his layout.
              Written before sending; it travels with the
              purchase order and opens the thread inside each
              purchase, where the conversation continues for
              both sides. Text only, no photos (there is no
              attach control), no links. */}
          <div className="mt-4 border-t border-[var(--border)] pt-3.5">
            <label
              htmlFor="cash-order-message"
              className="text-sm font-semibold text-[var(--text)]"
            >
              Message with this order
            </label>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
              Write it before you send — it goes with the purchase
              order, and @{JARVIS_FRIEND.username} sees it with the
              order and can answer in the same thread on the
              purchase.
            </p>
            <textarea
              id="cash-order-message"
              rows={3}
              maxLength={500}
              value={orderMessage}
              onChange={(e) => setOrderMessage(e.target.value)}
              placeholder={`Anything @${JARVIS_FRIEND.username} should know — timing, the meetup…`}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
            />
            {messageHasLink ? (
              <p className="mt-1 text-xs font-semibold leading-relaxed text-red-300">
                Links aren&rsquo;t allowed in order messages —
                remove the link to send.
              </p>
            ) : null}
            <p className="mt-2.5 text-[11px] leading-relaxed text-red-400">
              * Vault X doesn&rsquo;t send push notifications —
              you&rsquo;ll only see new messages when you open the
              app.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Cash purchases (Anthony's split-button direction): the
    requests sent from the green cash third of a friend's card
    live here, under Trades — the seller answers, both sides
    confirm once the purchase is done in person, and the blind
    feedback finishes it into Trust. The seller is the test
    friend, so his steps carry labeled (test) buttons like the
    trade cards above. */
/** Trade-only messages (Anthony, Nov 2, 2026, late — his
    restriction set): every trade and cash purchase carries
    its own message thread between its two collectors, for
    coordinating the swap and the meetup. Text only — the
    composer takes text and nothing else, no attach button —
    and links are not allowed: a draft containing a link
    can't be sent until the link is removed. The thread
    closes to new messages when the deal ends; its history
    stays on the deal's record. The red footnote at the very
    bottom is his wording. */
const DEAL_LINK_CLIENT =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|gg|me|tv|shop|store|xyz|info|biz|us|uk|de|jp|au|ca)\b)/i;

function DealMessages({
  kind,
  dealId,
  otherUsername,
  otherIsTest,
  unreadCount = 0,
  autoOpenNonce = 0,
}: {
  kind: "trade" | "cash";
  dealId: number;
  otherUsername: string;
  otherIsTest: boolean;
  /** Messages from the other side this user hasn't opened
      yet (Anthony, Nov 3, 2026, ~2:02 AM: a reply inside an
      order must never land silently). Shown as a mail chip
      on the toggle; opening the thread marks it read. */
  unreadCount?: number;
  /** Inbox deep-link (Anthony, Nov 3, 2026): when the user
      opens this order from their Inbox, the nonce changes
      and the thread opens itself. */
  autoOpenNonce?: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const autoOpenedForRef = useRef(0);
  useEffect(() => {
    if (autoOpenNonce > 0 && autoOpenNonce !== autoOpenedForRef.current) {
      autoOpenedForRef.current = autoOpenNonce;
      setOpen(true);
    }
  }, [autoOpenNonce]);
  const [draft, setDraft] = useState("");
  const [msgError, setMsgError] = useState<string | null>(null);
  const thread = useQuery({
    queryKey: ["dealMessages", kind, dealId],
    queryFn: () => api.getDealMessages({ kind, dealId }),
    enabled: open,
    refetchInterval: open ? 10000 : false,
  });
  // Opening the thread marks it read (and re-marks as new
  // messages land while it's open), so the mail indicators
  // on Home, the Trades entry, and this order clear.
  const messageCount = thread.data?.messages.length ?? 0;
  useEffect(() => {
    if (!open) return;
    void api.markDealThreadRead({ kind, dealId }).then(() => {
      void queryClient.invalidateQueries({
        queryKey: ["orderMailStatus"],
      });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    });
  }, [open, messageCount, kind, dealId, queryClient]);
  const send = useMutation({
    mutationFn: (asTestSide: boolean) =>
      api.sendDealMessage({ kind, dealId, body: draft.trim(), asTestSide }),
    onSuccess: (res) => {
      if (res.ok) {
        setDraft("");
        setMsgError(null);
        void queryClient.invalidateQueries({
          queryKey: ["dealMessages", kind, dealId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["orderMailStatus"],
        });
        void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      } else {
        setMsgError(res.error ?? "That message didn't send.");
      }
    },
    onError: () => setMsgError("That message didn't send — try again."),
  });
  const hasLink = DEAL_LINK_CLIENT.test(draft);
  const threadOpen = thread.data?.threadOpen ?? false;
  const messages = thread.data?.messages ?? [];
  const inputId = `deal-msg-${kind}-${dealId}`;
  return (
    <div className="mt-3 border-t border-[var(--border)] pt-2.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          hapticTick();
          setOpen((v) => !v);
        }}
        className="text-sm font-semibold text-[var(--gold-soft)]"
      >
        Messages with @{otherUsername} {open ? "▾" : "▸"}
        {!open && unreadCount > 0 ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 align-middle text-[11px] font-bold text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            {unreadCount} new
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="mt-2">
          {thread.isPending ? (
            <p className="text-sm text-[var(--dim)]">Loading messages…</p>
          ) : null}
          {thread.data && !thread.data.ok ? (
            <p className="text-sm leading-relaxed text-red-300">
              {thread.data.error}
            </p>
          ) : null}
          {thread.data?.ok && messages.length === 0 ? (
            <p className="text-sm leading-relaxed text-[var(--dim)]">
              No messages yet. This thread belongs to this{" "}
              {kind === "trade" ? "trade" : "purchase"} only — use it
              to work out the swap and the meetup.
            </p>
          ) : null}
          {messages.length > 0 ? (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      m.mine
                        ? "bg-[var(--accent)] text-[var(--on-accent)]"
                        : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                    }`}
                  >
                    <p className="text-[11px] font-semibold opacity-80">
                      {m.mine ? "You" : `@${m.fromUsername}`} ·{" "}
                      {new Date(m.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {m.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {threadOpen ? (
            <div className="mt-2.5">
              <label className="sr-only" htmlFor={inputId}>
                Message @{otherUsername} about this{" "}
                {kind === "trade" ? "trade" : "purchase"}
              </label>
              <textarea
                id={inputId}
                rows={2}
                maxLength={500}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message @${otherUsername}…`}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
              />
              {hasLink ? (
                <p className="mt-1 text-xs font-semibold leading-relaxed text-red-300">
                  Links aren&rsquo;t allowed in trade messages —
                  remove the link to send.
                </p>
              ) : null}
              {msgError ? (
                <p className="mt-1 text-xs font-semibold leading-relaxed text-red-300">
                  {msgError}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!draft.trim() || hasLink || send.isPending}
                  onClick={() => send.mutate(false)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
                >
                  Send
                </button>
                {otherIsTest ? (
                  <button
                    type="button"
                    disabled={!draft.trim() || hasLink || send.isPending}
                    onClick={() => send.mutate(true)}
                    className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
                  >
                    Send as @{otherUsername} (test)
                  </button>
                ) : null}
              </div>
            </div>
          ) : thread.data?.ok ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              This conversation is closed — the deal is finished.
              The messages stay on the record.
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-red-400">
            * Vault X doesn&rsquo;t send push notifications —
            you&rsquo;ll only see new messages when you open the
            app.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CashPurchasesSection({
  focusDeal,
  onlyPurchaseId,
}: {
  /** Inbox deep-link: the purchase to scroll to and open. */
  focusDeal?: { kind: "cash" | "trade"; id: number; nonce: number } | null;
  /** Standalone mail view (Anthony, Nov 3, 2026): render ONLY
      this purchase's card — no section header, explainer, or
      list chrome — because the message opens as its own mail
      page, never inside Social/Trades. */
  onlyPurchaseId?: number;
}) {
  const queryClient = useQueryClient();
  const cashQuery = useQuery({
    queryKey: ["cashPurchases"],
    queryFn: () => api.getCashPurchases({}),
  });
  // Unread order mail per purchase (Anthony, Nov 3, 2026):
  // drives the "N new" chip on each order's message toggle.
  const mailStatus = useQuery({
    queryKey: ["orderMailStatus"],
    queryFn: () => api.getOrderMailStatus({}),
    refetchInterval: 15000,
  });
  const unreadFor = (kind: "trade" | "cash", dealId: number) =>
    mailStatus.data?.deals.find(
      (d) => d.kind === kind && d.dealId === dealId,
    )?.unread ?? 0;
  // "Pay the seller" copy button feedback, per purchase.
  const [zelleCopiedId, setZelleCopiedId] = useState<number | null>(null);
  const copyZelle = async (purchaseId: number, handle: string) => {
    try {
      await navigator.clipboard.writeText(handle);
      setZelleCopiedId(purchaseId);
      window.setTimeout(() => {
        setZelleCopiedId((cur) => (cur === purchaseId ? null : cur));
      }, 2500);
    } catch {
      // Clipboard unavailable — the handle stays visible to
      // copy by hand.
    }
  };
  const [cashError, setCashError] = useState<string | null>(null);
  const invalidateCash = () => {
    void queryClient.invalidateQueries({ queryKey: ["cashPurchases"] });
  };
  const fail = (
    res: { ok: boolean; error: string | null },
    fallback: string,
  ) => setCashError(res.ok ? null : (res.error ?? fallback));
  const respond = useMutation({
    mutationFn: (args: { purchaseId: number; accept: boolean }) =>
      api.respondCashPurchase({ ...args, asTestSeller: true }),
    onSuccess: (res) => {
      if (res.ok) hapticConfirm();
      fail(res, "That answer didn't go through.");
      invalidateCash();
    },
    onError: () => setCashError("That answer didn't go through — try again."),
  });
  const withdraw = useMutation({
    mutationFn: (purchaseId: number) =>
      api.cancelCashPurchase({ purchaseId }),
    onSuccess: (res) => {
      fail(res, "That withdrawal didn't go through.");
      invalidateCash();
    },
    onError: () =>
      setCashError("That withdrawal didn't go through — try again."),
  });
  const confirm = useMutation({
    mutationFn: (args: { purchaseId: number; asTestSeller: boolean }) =>
      api.confirmCashPurchase(args),
    onSuccess: (res) => {
      if (res.ok) hapticConfirm();
      fail(res, "That confirmation didn't go through.");
      invalidateCash();
    },
    onError: () =>
      setCashError("That confirmation didn't go through — try again."),
  });
  const purchases = cashQuery.data?.purchases ?? [];
  const gate = cashQuery.data?.gate;
  const purchaseCard = (p: CashPurchaseView) => (
    <li
      key={p.purchaseId}
      id={`order-cash-${p.purchaseId}`}
      className="scroll-mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      {/* Invoice treatment (Anthony, Nov 3, 2026): the order
          reads like the checkout he approved — a clean header
          (who it's with, the date, the status), the line item
          with aligned prices, a totals block, the Zelle pay
          line, and the message thread in its own section
          below — nothing jumbled together. The opened order
          also carries a mail-style header (same night): a
          Subject line naming what it is and a From line naming
          who sent it, above everything else. */}
      <div className="mb-3 border-b border-[var(--border)] pb-2.5">
        <p className="text-sm text-[var(--text)]">
          <span className="text-[var(--dim)]">Subject:</span>{" "}
          <span className="font-bold">Purchase Order</span>
        </p>
        <p className="mt-0.5 text-sm text-[var(--text)]">
          <span className="text-[var(--dim)]">From:</span>{" "}
          <span className="font-semibold">@{p.buyerUsername}</span>
        </p>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-album text-base text-[var(--text)]">
            Purchase order
          </h4>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
            {p.iAmSeller
              ? `Selling to @${p.buyerUsername}`
              : `Buying from @${p.sellerUsername}${p.sellerIsTest ? " (test friend)" : ""}`}{" "}
            ·{" "}
            {new Date(p.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {p.status === "pending" ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            Proposed cash trade
          </span>
        ) : p.status === "accepted" ? (
          <span className="shrink-0 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--gold-soft)]">
            Accepted
          </span>
        ) : p.completedAt != null ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            Complete ✓
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[var(--bg)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">
            {p.status === "declined" ? "Declined" : "Withdrawn"}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">
            {p.name}
            {p.printed ? ` ${p.printed.split("/")[0]}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            {p.finish} · {p.qty} {p.qty === 1 ? "copy" : "copies"} ×{" "}
            {fmtUSD(p.unitPrice)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold text-[var(--text)]">
          {fmtUSD(p.totalPrice)}
        </p>
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[var(--dim)]">Offer total</dt>
          <dd className="font-bold text-[var(--text)]">
            {fmtUSD(p.totalPrice)}
          </dd>
        </div>
        {p.suggestedTotal != null ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--dim)]">TCG suggested</dt>
            <dd className="text-right text-[var(--text)]">
              {fmtUSD(p.suggestedTotal)}
              <span className="block text-[11px] text-[var(--dim)]">
                {Math.abs(p.totalPrice - p.suggestedTotal) >= 0.005
                  ? p.totalPrice < p.suggestedTotal
                    ? `offer is ${fmtUSD(p.suggestedTotal - p.totalPrice)} below`
                    : `offer is ${fmtUSD(p.totalPrice - p.suggestedTotal)} above`
                  : "offer matches it"}
              </span>
            </dd>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[var(--dim)]">
            No TCG price is tracked for this card yet — the offer
            stands on its own.
          </p>
        )}
      </dl>
      {/* "Pay the seller" (Anthony, Nov 3, 2026): inside the
          order only — the seller's saved Zelle handle as
          plain text with a Copy button, so the buyer can
          paste it into their own bank app. Vault X never
          processes the payment. No saved handle = no line
          for the buyer; the seller instead gets a quiet
          pointer to Settings. */}
      {p.sellerZelleHandle && !p.iAmSeller ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <ZelleMark />
            <p className="min-w-0 flex-1 text-sm text-[var(--text)]">
              <span className="font-semibold">Pay the seller</span>
              <span className="block truncate font-mono text-[13px] text-[var(--dim)]">
                {p.sellerZelleHandle}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void copyZelle(p.purchaseId, p.sellerZelleHandle!)}
              className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
            >
              {zelleCopiedId === p.purchaseId ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--dim)]">
            Send the {fmtUSD(p.totalPrice)} from your own bank
            app — Vault X doesn&rsquo;t process payments.
          </p>
        </div>
      ) : p.iAmSeller && p.sellerZelleHandle ? (
        <p className="mt-3 flex items-center gap-2 text-xs leading-relaxed text-[var(--dim)]">
          <ZelleMark className="h-3.5 w-3.5 text-[9px]" />
          Your Zelle on this order: {p.sellerZelleHandle} — the
          buyer sees it here to pay you.
        </p>
      ) : p.iAmSeller ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
          No Zelle info saved — the buyer won&rsquo;t see a pay
          line on this order. Add it in Settings &gt; Payment
          info.
        </p>
      ) : null}
      {p.orderMessage ? (
        <>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
            Message with this order
          </p>
          <p className="mt-0.5 text-sm italic leading-relaxed text-[var(--text)]">
            “{p.orderMessage}”
          </p>
        </>
      ) : null}
      {p.status === "pending" ? (
        <div className="mt-2.5">
          <p className="text-sm text-[var(--dim)]">
            Waiting on @{p.sellerUsername} to answer your request.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.sellerIsTest ? (
              <>
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() =>
                    respond.mutate({ purchaseId: p.purchaseId, accept: true })
                  }
                  className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
                >
                  Accept as @{p.sellerUsername} (test)
                </button>
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() =>
                    respond.mutate({ purchaseId: p.purchaseId, accept: false })
                  }
                  className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--dim)] disabled:opacity-50"
                >
                  Decline as @{p.sellerUsername} (test)
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate(p.purchaseId)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
            >
              Withdraw request
            </button>
          </div>
        </div>
      ) : null}
      {p.status === "accepted" && !p.completedAt ? (
        <div className="mt-2.5">
          <p className="text-sm text-[var(--dim)]">
            {p.buyerConfirmed
              ? "You confirmed ✓"
              : "Waiting on your confirmation"}{" "}
            ·{" "}
            {p.sellerConfirmed
              ? `@${p.sellerUsername} confirmed ✓`
              : `@${p.sellerUsername} hasn't confirmed yet`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!p.buyerConfirmed ? (
              <button
                type="button"
                disabled={confirm.isPending}
                onClick={() =>
                  confirm.mutate({
                    purchaseId: p.purchaseId,
                    asTestSeller: false,
                  })
                }
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
              >
                Confirm the purchase is complete
              </button>
            ) : null}
            {p.sellerIsTest && !p.sellerConfirmed ? (
              <button
                type="button"
                disabled={confirm.isPending}
                onClick={() =>
                  confirm.mutate({
                    purchaseId: p.purchaseId,
                    asTestSeller: true,
                  })
                }
                className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
              >
                Confirm as @{p.sellerUsername} (test)
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {p.completedAt != null ? (
        <div className="mt-2.5">
          <p className="text-sm font-semibold text-emerald-400">
            Purchase complete ✓ — recorded in the Trust ledger
          </p>
          {p.feedbackClosed ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              Feedback: you{" "}
              {p.myRating
                ? p.myRating === "positive"
                  ? "rated positive"
                  : "rated negative"
                : "— no feedback (closed neutral)"}
              {" · "}
              @{p.sellerUsername}{" "}
              {p.theirRating
                ? p.theirRating === "positive"
                  ? "rated positive"
                  : "rated negative"
                : "— no feedback (closed neutral)"}
            </p>
          ) : p.awaitingMyFeedback ? (
            <CashFeedbackForm
              purchase={p}
              asTestSeller={false}
              onDone={invalidateCash}
            />
          ) : (
            <p className="mt-1 text-sm text-[var(--dim)]">
              Your feedback is in — theirs stays hidden until both
              sides have rated.
            </p>
          )}
          {p.sellerIsTest && !p.feedbackClosed ? (
            <CashFeedbackForm
              purchase={p}
              asTestSeller={true}
              onDone={invalidateCash}
            />
          ) : null}
        </div>
      ) : null}
      <DealMessages
        kind="cash"
        dealId={p.purchaseId}
        otherUsername={p.sellerUsername}
        otherIsTest={p.sellerIsTest}
        unreadCount={unreadFor("cash", p.purchaseId)}
        autoOpenNonce={
          focusDeal && focusDeal.kind === "cash" && focusDeal.id === p.purchaseId
            ? focusDeal.nonce
            : 0
        }
      />
    </li>
  );
  if (onlyPurchaseId != null) {
    const only = purchases.filter(
      (p) => p.purchaseId === onlyPurchaseId,
    );
    return (
      <>
        {cashError ? (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {cashError}
          </p>
        ) : null}
        {cashQuery.isPending ? (
          <p className="mt-2 py-4 text-center text-sm text-[var(--dim)]">
            Loading this purchase…
          </p>
        ) : only.length === 0 ? (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
            This purchase could not be found.
          </p>
        ) : (
          <ul className="space-y-2">{only.map(purchaseCard)}</ul>
        )}
      </>
    );
  }
  return (
    <>
      <h3 className="font-album mt-6 text-base text-[var(--text)]">
        Cash purchases
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Buying outright, no trade: the green cash side of the
        button on a friend&rsquo;s card adds it to your cash
        cart, and sending the order from Cash checkout above
        puts a request here for each card at their asking price,
        or the card&rsquo;s market value when they have no ask.
        They accept or decline, you pay them directly — no
        payment happens in the app — and once it is done in
        person you both confirm, then rate each other.
      </p>
      {gate?.blocked ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-red-400/50 bg-red-500/15 p-3.5"
        >
          <p className="text-sm font-semibold text-[var(--text)]">
            Awaiting your feedback
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--text)]">
            A finished cash purchase is waiting on your thumbs up
            or down. New cash requests stay paused until it&rsquo;s
            done — find the purchase below.
          </p>
        </div>
      ) : null}
      {cashError ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {cashError}
        </p>
      ) : null}
      {cashQuery.isPending ? (
        <p className="mt-2 py-4 text-center text-sm text-[var(--dim)]">
          Loading cash purchases…
        </p>
      ) : purchases.length === 0 ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          No cash purchases yet — add cards with the green cash
          side of the button on a friend&rsquo;s cards, then send
          the order from Cash checkout above.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">{purchases.map(purchaseCard)}</ul>
      )}
    </>
  );
}

/** The Trades area (Anthony, Nov 2, 2026, late): OPERATIONAL at
    release — his explicit correction. No Coming soon overlay, no
    click-blocking (those are for Marketplace and Forums only).
    Real actions, wired end to end like a marketplace deal:
    Trade Match finds the swap, Propose sends it, the other side
    accepts or declines, both sides confirm in person, and the
    mandatory blind feedback finishes it and feeds Trust. The
    one friend in the app is Jarvis, so he is the trade partner;
    his steps can be driven from here as labeled test actions,
    exactly like marketplace deals with the test friend. */
function TradesPanel({
  onOpenCard,
  wantPick,
  onWantConsumed,
  tradeCart,
  cashCart,
  onAddTrade,
  onAddCash,
  onSetTradeCart,
  onSetCashCart,
  cartCounts,
  checkout = false,
  onCancelCashCheckout,
  onCancelTradeCheckout,
  focusDeal = null,
  onlyTradeId,
}: {
  /** Standalone mail view (Anthony, Nov 3, 2026): render ONLY
      this trade's card — the message opens as its own mail
      page, never inside Social/Trades. The panel's carts and
      composer are inert in this mode. */
  onlyTradeId?: number;
  onOpenCard: (id: number) => void;
  /** Inbox deep-link (Anthony, Nov 3, 2026): the order the
      user tapped in their Inbox — scroll it into view and
      open its message thread. */
  focusDeal?: { kind: "cash" | "trade"; id: number; nonce: number } | null;
  /** A card handed over from an "I want this" tap on a friend's
      collection: it lands on the composer's get side. */
  wantPick: TradePick | null;
  onWantConsumed: () => void;
  /** Anthony's carts (state lives in SocialPanel so they
      survive moving between the friend's profile and here). */
  tradeCart: CartLine[];
  cashCart: CartLine[];
  onAddTrade: (item: ProfileItemView) => void;
  onAddCash: (item: ProfileItemView) => void;
  onSetTradeCart: (lines: CartLine[]) => void;
  onSetCashCart: (lines: CartLine[]) => void;
  cartCounts?: Map<string, { trade: number; cash: number }>;
  /** Checkout-page variant (Anthony, Nov 3, 2026): the
      dedicated checkout page shows ONLY the checkout itself —
      the cash invoice and the trade composer. The Trades
      header, "How trading works", Trade Match, and every
      offers/purchases list belong to the Trades area and do
      not render here. */
  checkout?: boolean;
  /** FULL cancels (Anthony, Nov 3, 2026 — his bug report:
      the first version only closed the checkout page and
      left the cart, the selections, and the checkout bar
      alive). "Cancel this purchase" clears the WHOLE cash
      cart and then backs out of the checkout page; "Cancel
      this trade" clears the whole trade cart (and the
      composer's picks) the same way. Nothing is sent, no
      order is created, and every chosen quantity returns to
      zero because the profile counts read from the carts. */
  onCancelCashCheckout?: () => void;
  onCancelTradeCheckout?: () => void;
}) {
  const queryClient = useQueryClient();
  const tradesQuery = useQuery({
    queryKey: ["trades"],
    queryFn: () => api.getTrades({}),
  });
  // Unread order mail per trade (Anthony, Nov 3, 2026):
  // drives the "N new" chip on each trade's message toggle.
  const mailStatus = useQuery({
    queryKey: ["orderMailStatus"],
    queryFn: () => api.getOrderMailStatus({}),
    refetchInterval: 15000,
  });
  const unreadForTrade = (dealId: number) =>
    mailStatus.data?.deals.find(
      (d) => d.kind === "trade" && d.dealId === dealId,
    )?.unread ?? 0;
  // Inbox deep-link landing: once the focused order's card has
  // rendered, scroll it into view (retried briefly while the
  // lists load).
  const focusNonce = focusDeal?.nonce ?? 0;
  useEffect(() => {
    if (!focusDeal || checkout) return;
    const targetId = `order-${focusDeal.kind}-${focusDeal.id}`;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        window.clearInterval(timer);
      } else if (tries > 12) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);
  const jarvisItems = useQuery({
    queryKey: ["jarvisFriendCards"],
    queryFn: loadJarvisFriendItems,
  });
  const [composerOpen, setComposerOpen] = useState(false);
  // "How trading works" explainer visibility (Anthony, Nov 3,
  // 2026): shown by default; Hide collapses it to its title row
  // and the choice is remembered on the profile. null = follow
  // the saved server value until he toggles it here.
  const [howHiddenLocal, setHowHiddenLocal] = useState<boolean | null>(
    null,
  );
  const howHidden =
    howHiddenLocal ?? tradesQuery.data?.howTradesWorkHidden ?? false;
  const setHowHidden = useMutation({
    mutationFn: (hidden: boolean) =>
      api.setHowTradesWorkHidden({ hidden }),
    onSuccess: (_res, hidden) => {
      setHowHiddenLocal(hidden);
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
  const [giveSearch, setGiveSearch] = useState("");
  const [give, setGive] = useState<TradePick[]>([]);
  const [get, setGet] = useState<TradePick[]>([]);
  const [note, setNote] = useState("");
  const noteHasLink = DEAL_LINK_CLIENT.test(note);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const myItems = useQuery({
    queryKey: ["tradeGiveItems", giveSearch],
    queryFn: () =>
      api.getProfileItems({
        query: giveSearch,
        group: "all",
        sort: "name",
        filter: "cards",
      }),
    enabled: composerOpen,
  });
  const invalidateTrades = () => {
    void queryClient.invalidateQueries({ queryKey: ["trades"] });
  };
  // "I want this" hand-off: open the composer with the wanted
  // card already on the get side, ready to pick how many copies
  // and what to give for it.
  useEffect(() => {
    if (!wantPick) return;
    setComposerOpen(true);
    setGet((prev) => {
      const existing = prev.find(
        (p) => p.cardId === wantPick.cardId && p.finish === wantPick.finish,
      );
      return existing ? prev : [...prev, wantPick];
    });
    onWantConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPick]);
  // Trade cart → composer (Anthony's cart design): the cart
  // gathered on the friend's profile (and from Trade Match
  // below) seeds the composer's get side whenever it changes,
  // and opens the composer so checkout is right there. Sending
  // the proposal clears the cart, which re-syncs to empty.
  const cartSig = tradeCart
    .map((l) => `${l.cardId}:${l.finish}:${l.qty}`)
    .join("|");
  const lastCartSig = useRef("");
  useEffect(() => {
    if (cartSig === lastCartSig.current) return;
    lastCartSig.current = cartSig;
    setGet(
      tradeCart.map((l) => ({
        cardId: l.cardId,
        name: l.name,
        printed: l.printed,
        finish: l.finish,
        qty: l.qty,
        maxQty: l.maxQty,
        unitValue: l.unitValue,
      })),
    );
    if (tradeCart.length > 0) setComposerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSig]);
  // Fill my order (auto-fill): the server builds the give side
  // from Anthony's tradeable cards that Jarvis does not own,
  // by value, totaling equal or less than the get side. The
  // result lands in the give picks, fully reviewable and
  // amendable with the steppers and search below before send.
  const [fillInfo, setFillInfo] = useState<{
    getTotal: number;
    giveTotal: number;
    /** Signature of the give+get picks the fill produced; the
        totals are only shown while the picks still match it,
        so amending either side drops back to per-pick values. */
    sig: string;
  } | null>(null);
  const fill = useMutation({
    mutationFn: () =>
      api.fillTradeOrder({
        get: get.map((p) => ({
          cardId: p.cardId,
          finish: p.finish,
          qty: p.qty,
        })),
      }),
    onSuccess: (res) => {
      const filledGive = res.give.map((g) => ({
        cardId: g.cardId,
        name: g.name,
        printed: g.printed,
        finish: g.finish,
        qty: g.qty,
        maxQty: g.qty,
        unitValue: null,
      }));
      setGive(filledGive);
      const sigOf = (picks: TradePick[]) =>
        picks
          .map((p) => `${p.cardId}:${p.finish}:${p.qty}`)
          .join("|");
      setFillInfo({
        getTotal: res.getTotal,
        giveTotal: res.giveTotal,
        sig: `${sigOf(filledGive)}>${sigOf(get)}`,
      });
      setTradeError(null);
      hapticConfirm();
    },
    onError: () => setTradeError("The auto-fill didn't run — try again."),
  });
  const fail = (res: { ok: boolean; error: string | null }, fallback: string) =>
    setTradeError(res.ok ? null : (res.error ?? fallback));
  const respond = useMutation({
    mutationFn: (args: { tradeId: number; accept: boolean; asTestFriend: boolean }) =>
      api.respondTrade(args),
    onSuccess: (res) => {
      if (res.ok) hapticConfirm();
      fail(res, "That answer didn't go through.");
      invalidateTrades();
    },
    onError: () => setTradeError("That answer didn't go through — try again."),
  });
  const cancel = useMutation({
    mutationFn: (args: { tradeId: number; asTestFriend: boolean }) =>
      api.cancelTrade(args),
    onSuccess: (res) => {
      fail(res, "That withdrawal didn't go through.");
      invalidateTrades();
    },
    onError: () => setTradeError("That withdrawal didn't go through — try again."),
  });
  const confirm = useMutation({
    mutationFn: (args: { tradeId: number; asTestFriend: boolean }) =>
      api.confirmTradeSide(args),
    onSuccess: (res) => {
      if (res.ok) hapticConfirm();
      fail(res, "That confirmation didn't go through.");
      invalidateTrades();
    },
    onError: () => setTradeError("That confirmation didn't go through — try again."),
  });
  const propose = useMutation({
    mutationFn: () =>
      api.proposeTrade({
        give: give.map((p) => ({ cardId: p.cardId, finish: p.finish, qty: p.qty })),
        get: get.map((p) => ({ cardId: p.cardId, finish: p.finish, qty: p.qty })),
        note: note.trim() ? note.trim() : null,
        asTestFriend: false,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        hapticConfirm();
        setComposerOpen(false);
        setGive([]);
        setGet([]);
        setNote("");
        setFillInfo(null);
        onSetTradeCart([]);
        setTradeError(null);
      } else {
        setTradeError(res.error ?? "That proposal didn't go through.");
      }
      invalidateTrades();
    },
    onError: () => setTradeError("That proposal didn't go through — try again."),
  });
  const addPick = (
    list: TradePick[],
    setList: (next: TradePick[]) => void,
    item: ProfileItemView,
  ) => {
    if (item.cardId == null) return;
    hapticTick();
    const existing = list.find(
      (p) => p.cardId === item.cardId && p.finish === item.finish,
    );
    if (existing) {
      setList(
        list.map((p) =>
          p === existing
            ? { ...p, qty: Math.min(p.qty + 1, p.maxQty) }
            : p,
        ),
      );
      return;
    }
    setList([
      ...list,
      {
        cardId: item.cardId,
        name: item.name,
        printed: item.printed,
        finish: item.finish,
        qty: 1,
        maxQty: Math.max(1, item.qty),
        unitValue: item.unitValue,
      },
    ]);
  };
  const pickRow = (
    picks: TradePick[],
    setPicks: (next: TradePick[]) => void,
    label: string,
  ) =>
    picks.length === 0 ? (
      <p className="mt-1.5 text-xs text-[var(--dim)]">
        No cards picked yet for {label}.
      </p>
    ) : (
      <ul className="mt-1.5 space-y-1.5">
        {picks.map((p) => (
          <li
            key={`${p.cardId}-${p.finish}`}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
              {p.name}
              {p.printed ? ` ${p.printed.split("/")[0]}` : ""} · {p.finish}
            </span>
            <button
              type="button"
              aria-label={`Remove one ${p.name} from the trade`}
              onClick={() =>
                setPicks(
                  p.qty <= 1
                    ? picks.filter((x) => x !== p)
                    : picks.map((x) => (x === p ? { ...x, qty: x.qty - 1 } : x)),
                )
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-base text-[var(--text)]"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-bold text-[var(--text)]">
              {p.qty}
            </span>
            <button
              type="button"
              aria-label={`Add one ${p.name} to the trade`}
              onClick={() =>
                setPicks(
                  picks.map((x) =>
                    x === p ? { ...x, qty: Math.min(x.qty + 1, x.maxQty) } : x,
                  ),
                )
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-base text-[var(--text)]"
            >
              +
            </button>
          </li>
        ))}
      </ul>
    );
  const trades = tradesQuery.data?.trades ?? [];
  const gate = tradesQuery.data?.gate ?? null;
  const availability = tradesQuery.data?.tradeAvailability ?? "master";
  // Invoice-style side totals for the trade composer
  // (Anthony's clean-invoice direction for checkout): summed
  // live from each pick's known unit value; when a Fill my
  // order produced the current picks unchanged, its server
  // totals stand instead (fill picks carry no per-item value).
  const picksSig = `${give
    .map((p) => `${p.cardId}:${p.finish}:${p.qty}`)
    .join("|")}>${get
    .map((p) => `${p.cardId}:${p.finish}:${p.qty}`)
    .join("|")}`;
  const sideTotal = (picks: TradePick[]): number | null =>
    picks.length === 0
      ? 0
      : picks.every((p) => p.unitValue != null)
        ? Math.round(
            picks.reduce((s, p) => s + (p.unitValue ?? 0) * p.qty, 0) * 100,
          ) / 100
        : null;
  const fillStands = fillInfo != null && fillInfo.sig === picksSig;
  const giveTotal = fillStands ? fillInfo.giveTotal : sideTotal(give);
  const getTotal = fillStands ? fillInfo.getTotal : sideTotal(get);
  const pendingIncoming = trades.filter(
    (t) => t.status === "pending" && t.direction === "incoming",
  );
  const pendingOutgoing = trades.filter(
    (t) => t.status === "pending" && t.direction === "outgoing",
  );
  const inProgress = trades.filter(
    (t) => t.status === "accepted" && t.completedAt == null,
  );
  const completed = trades.filter(
    (t) => t.status === "accepted" && t.completedAt != null,
  );
  const closed = trades.filter(
    (t) => t.status === "declined" || t.status === "cancelled",
  );
  const tradeCard = (t: TradeView) => (
    <li
      key={t.tradeId}
      id={`order-trade-${t.tradeId}`}
      className="scroll-mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
    >
      {/* Mail-style header (Anthony, Nov 3, 2026): the opened
          trade carries a Subject line and a From line at the
          top, same as the purchase order. */}
      <div className="mb-2.5 border-b border-[var(--border)] pb-2.5">
        <p className="text-sm text-[var(--text)]">
          <span className="text-[var(--dim)]">Subject:</span>{" "}
          <span className="font-bold">Trade Offer</span>
        </p>
        <p className="mt-0.5 text-sm text-[var(--text)]">
          <span className="text-[var(--dim)]">From:</span>{" "}
          <span className="font-semibold">@{t.proposerUsername}</span>
        </p>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text)]">
        <span className="font-semibold">
          {t.direction === "incoming"
            ? `@${t.otherUsername} proposes:`
            : `Your proposal to @${t.otherUsername}:`}
        </span>
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
        <span className="font-semibold text-[var(--gold-soft)]">You give:</span>{" "}
        <TradeItemsLine items={t.myGive} />
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-[var(--text)]">
        <span className="font-semibold text-[var(--gold-soft)]">You get:</span>{" "}
        <TradeItemsLine items={t.myGet} />
      </p>
      {t.note ? (
        <p className="mt-1 text-sm italic leading-relaxed text-[var(--dim)]">
          “{t.note}”
        </p>
      ) : null}
      {t.status === "pending" && t.direction === "incoming" ? (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={respond.isPending}
            onClick={() =>
              respond.mutate({ tradeId: t.tradeId, accept: true, asTestFriend: false })
            }
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
          >
            Accept trade
          </button>
          <button
            type="button"
            disabled={respond.isPending}
            onClick={() =>
              respond.mutate({ tradeId: t.tradeId, accept: false, asTestFriend: false })
            }
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : null}
      {t.status === "pending" && t.direction === "outgoing" ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ tradeId: t.tradeId, asTestFriend: false })}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
          >
            Withdraw proposal
          </button>
          {t.otherIsTest ? (
            <>
              <button
                type="button"
                disabled={respond.isPending}
                onClick={() =>
                  respond.mutate({ tradeId: t.tradeId, accept: true, asTestFriend: true })
                }
                className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
              >
                Accept as @{t.otherUsername} (test)
              </button>
              <button
                type="button"
                disabled={respond.isPending}
                onClick={() =>
                  respond.mutate({ tradeId: t.tradeId, accept: false, asTestFriend: true })
                }
                className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--dim)] disabled:opacity-50"
              >
                Decline as @{t.otherUsername} (test)
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {t.status === "accepted" && t.completedAt == null ? (
        <div className="mt-2.5">
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span className="text-[var(--text)]">You</span>
              <span className={`font-semibold ${t.myConfirmed ? "text-emerald-400" : "text-[var(--dim)]"}`}>
                {t.myConfirmed ? "Confirmed ✓" : "Not yet"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-[var(--text)]">@{t.otherUsername}</span>
              <span className={`font-semibold ${t.theirConfirmed ? "text-emerald-400" : "text-[var(--dim)]"}`}>
                {t.theirConfirmed ? "Confirmed ✓" : "Not yet"}
              </span>
            </li>
          </ul>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {!t.myConfirmed ? (
              <button
                type="button"
                disabled={confirm.isPending}
                onClick={() =>
                  confirm.mutate({ tradeId: t.tradeId, asTestFriend: false })
                }
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
              >
                Confirm my side — we swapped
              </button>
            ) : null}
            {t.otherIsTest && !t.theirConfirmed ? (
              <button
                type="button"
                disabled={confirm.isPending}
                onClick={() =>
                  confirm.mutate({ tradeId: t.tradeId, asTestFriend: true })
                }
                className="rounded-full border border-dashed border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--gold-soft)] disabled:opacity-50"
              >
                Confirm as @{t.otherUsername} (test)
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {t.completedAt != null ? (
        <div className="mt-2.5">
          <p className="text-sm font-semibold text-emerald-400">
            Trade complete ✓ — recorded in the Trust ledger
          </p>
          {t.feedbackClosed ? (
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
              Feedback: you{" "}
              {t.myRating
                ? t.myRating === "positive"
                  ? "rated positive"
                  : "rated negative"
                : "— no feedback (closed neutral)"}
              {" · "}
              @{t.otherUsername}{" "}
              {t.theirRating
                ? t.theirRating === "positive"
                  ? "rated positive"
                  : "rated negative"
                : "— no feedback (closed neutral)"}
            </p>
          ) : t.awaitingMyFeedback ? (
            <TradeFeedbackForm trade={t} asTestFriend={false} onDone={invalidateTrades} />
          ) : (
            <p className="mt-1 text-sm text-[var(--dim)]">
              Your feedback is in — theirs stays hidden until both
              sides have rated.
            </p>
          )}
          {t.otherIsTest && !t.feedbackClosed ? (
            <TradeFeedbackForm trade={t} asTestFriend={true} onDone={invalidateTrades} />
          ) : null}
        </div>
      ) : null}
      {t.status === "declined" || t.status === "cancelled" ? (
        <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
          {t.status === "declined" ? "Declined" : "Withdrawn"}
        </p>
      ) : null}
      <DealMessages
        kind="trade"
        dealId={t.tradeId}
        otherUsername={t.otherUsername}
        otherIsTest={t.otherIsTest}
        unreadCount={unreadForTrade(t.tradeId)}
        autoOpenNonce={
          focusDeal && focusDeal.kind === "trade" && focusDeal.id === t.tradeId
            ? focusDeal.nonce
            : 0
        }
      />
    </li>
  );
  if (onlyTradeId != null) {
    const only = trades.filter((t) => t.tradeId === onlyTradeId);
    return (
      <section aria-label="Trade message">
        {tradeError ? (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {tradeError}
          </p>
        ) : null}
        {tradesQuery.isPending ? (
          <p className="mt-2 py-4 text-center text-sm text-[var(--dim)]">
            Loading this trade…
          </p>
        ) : only.length === 0 ? (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
            This trade could not be found.
          </p>
        ) : (
          <ul className="space-y-2">{only.map(tradeCard)}</ul>
        )}
      </section>
    );
  }
  return (
    <section aria-label={checkout ? "Checkout" : "Trades"} className="mt-6">
      {checkout ? null : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-album text-xl text-[var(--text)]">Trades</h2>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--dim)]">
              Trade offers
            </span>
          </div>
          {/* No intro paragraph here (Anthony, Nov 3, 2026):
              it said the same thing as the "How trading works"
              window below — that hideable window is now the
              single explanation, and Trades opens straight
              into its content. */}
        </>
      )}

      <CashCheckoutSection
        lines={cashCart}
        onSetLines={onSetCashCart}
        bare={checkout}
        onCancel={checkout ? onCancelCashCheckout : undefined}
      />
      {gate?.blocked ? (
        <div role="alert" className="mt-3 rounded-2xl border border-red-400/50 bg-red-500/15 p-3.5">
          <p className="text-sm font-semibold text-[var(--text)]">
            Awaiting your feedback
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--text)]">
            {gate.awaitingCount === 1
              ? "A finished trade is waiting on your thumbs up or down."
              : `${gate.awaitingCount} finished trades are waiting on your thumbs up or down.`}{" "}
            New proposals stay paused until it&rsquo;s done — find
            the trade under Completed trades below.
          </p>
        </div>
      ) : null}
      {tradeError ? (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {tradeError}
        </p>
      ) : null}

      {checkout ? null : howHidden ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
            How trading works
          </p>
          <button
            type="button"
            onClick={() => {
              hapticTick();
              setHowHidden.mutate(false);
            }}
            className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
          >
            Show
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
              How trading works
            </p>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setHowHidden.mutate(true);
              }}
              className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
            >
              Hide
            </button>
          </div>
          <ol className="mt-3 space-y-3">
          {[
            {
              title: "Find the swap",
              blurb:
                "Trade Match below compares your collection with a friend's — the cards they have that you need, and yours they need.",
            },
            {
              title: "Propose the trade",
              blurb:
                "Pick cards from each side and send it as a trade offer. The other side accepts or declines.",
            },
            {
              title: "Swap in person, both confirm",
              blurb:
                "Meet up — game night works — make the trade face to face, and both of you confirm here. Then each side leaves a thumbs up or down, which feeds Trust.",
            },
          ].map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-xs font-bold text-black">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                  {step.blurb}
                </span>
              </span>
            </li>
          ))}
          </ol>
        </div>
      )}

      {checkout ? null : (
        <>
          <h3 className="font-album mt-5 text-base text-[var(--text)]">
            Trade Match with @{JARVIS_FRIEND.username}
          </h3>
          <TradeMatchView
            friendName={JARVIS_FRIEND.displayName}
            friendItems={jarvisItems.data ?? []}
            friendLoading={jarvisItems.isPending}
            onOpenCard={onOpenCard}
            onWantItem={onAddTrade}
            onCashItem={onAddCash}
            cartCounts={cartCounts}
          />
        </>
      )}

      <div className="mt-5">
        {/* Flow separation (Anthony, Nov 3, 2026): on the
            checkout page the trade composer exists ONLY when
            the trade cart actually has cards in it — a cash
            checkout shows the cash invoice and nothing about
            proposing a trade ("There was no trade to propose.
            The trade is cash. So why am I seeing this?"), and
            the cash section likewise renders only for a
            non-empty cash cart. */}
        {!composerOpen || (checkout && tradeCart.length === 0) ? (
          checkout ? null : (
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setComposerOpen(true);
              }}
              className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--on-accent)]"
            >
              Propose a trade
            </button>
          )
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="font-album text-base text-[var(--text)]">
              Propose a trade with @{JARVIS_FRIEND.username}
            </h3>
            {/* Fill my order (Anthony's auto-fill): builds the
                give side from his cards Jarvis does not own,
                balanced by value at equal or less than the get
                side — then everything stays reviewable and
                amendable below before anything is sent. */}
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text)]">
                    Fill my order
                  </span>
                  <span className="block text-xs leading-relaxed text-[var(--dim)]">
                    Auto-build your side from cards you own that{" "}
                    @{JARVIS_FRIEND.username} doesn&rsquo;t have,
                    balanced by value — yours totals the same or
                    less, so he&rsquo;s never shorted.
                  </span>
                </span>
                <button
                  type="button"
                  disabled={get.length === 0 || fill.isPending}
                  onClick={() => fill.mutate()}
                  className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
                >
                  {fill.isPending ? "Filling…" : "Fill my order"}
                </button>
              </div>
              {fillInfo ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  Cards you get ≈ {fmtUSD(fillInfo.getTotal)} · your
                  filled side ≈ {fmtUSD(fillInfo.giveTotal)}
                  {fillInfo.giveTotal < fillInfo.getTotal
                    ? " — a little under, by design: equal or less, never over."
                    : " — right at the value of what you get."}{" "}
                  Review it below and change anything before you
                  send.
                </p>
              ) : null}
              {get.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  Add cards on the get side first — from your trade
                  cart or the list below — then fill.
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--text)]">
              You give
            </p>
            {pickRow(give, setGive, "your side")}
            <div className="relative mt-2.5">
              <input
                type="search"
                value={giveSearch}
                onChange={(e) => setGiveSearch(e.target.value)}
                placeholder="Search your collection…"
                aria-label="Search your collection for cards to give"
                className="h-[46px] w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
              />
            </div>
            {myItems.isPending ? (
              <p className="py-4 text-center text-sm text-[var(--dim)]">
                Loading your cards…
              </p>
            ) : (
              <>
              <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                {(myItems.data?.items ?? [])
                  .filter((item) => item.cardId != null)
                  .map((item) => ({
                    item,
                    // Tradeable is separate from owned: the
                    // server works it out from the hybrid
                    // availability setting (master-set keep-back
                    // and deck-dedicated copies both come off).
                    tradeable: item.tradeableQty ?? 0,
                  }))
                  .filter(({ tradeable }) => tradeable > 0)
                  .slice(0, 30)
                  .map(({ item, tradeable }) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() =>
                          addPick(give, setGive, { ...item, qty: tradeable })
                        }
                        className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--text)]">
                            {item.name}
                            {item.printed ? ` ${item.printed.split("/")[0]}` : ""}
                          </span>
                          <span className="block text-xs text-[var(--dim)]">
                            {item.finish} · you own {item.qty} · {tradeable}{" "}
                            up for trade
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[var(--on-accent)]">
                          Add
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
              {availability === "none" ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  Your trade availability is set to Nothing for now,
                  so no cards can be offered — change it in
                  Settings, under Trade availability, to propose a
                  trade.
                </p>
              ) : availability !== "all" ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                  {availability.includes("master")
                    ? "One copy of each card is held back for your master sets. "
                    : null}
                  {availability.includes("decks")
                    ? "Copies dedicated to your decks are held back. "
                    : null}
                  Only what&rsquo;s left over can be offered.
                </p>
              ) : null}
              </>
            )}
            <p className="mt-4 text-sm font-semibold text-[var(--text)]">
              You get — @{JARVIS_FRIEND.username}&rsquo;s cards
            </p>
            {pickRow(get, setGet, "their side")}
            <ul className="mt-2 space-y-1.5">
              {(jarvisItems.data ?? []).map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => addPick(get, setGet, item)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {item.name}
                        {item.printed ? ` ${item.printed.split("/")[0]}` : ""}
                      </span>
                      <span className="block text-xs text-[var(--dim)]">
                        {item.finish} · he has {item.qty}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[var(--on-accent)]">
                      Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {give.length > 0 || get.length > 0 ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[var(--dim)]">
                    You give · {give.reduce((s, p) => s + p.qty, 0)}{" "}
                    {give.reduce((s, p) => s + p.qty, 0) === 1
                      ? "card"
                      : "cards"}
                  </span>
                  <span className="font-album font-bold tabular-nums text-[var(--text)]">
                    {giveTotal != null ? fmtUSD(giveTotal) : "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[var(--dim)]">
                    You get · {get.reduce((s, p) => s + p.qty, 0)}{" "}
                    {get.reduce((s, p) => s + p.qty, 0) === 1
                      ? "card"
                      : "cards"}
                  </span>
                  <span className="font-album font-bold tabular-nums text-[var(--text)]">
                    {getTotal != null ? fmtUSD(getTotal) : "—"}
                  </span>
                </div>
                {giveTotal != null && getTotal != null ? (
                  <p className="mt-2 text-right text-xs text-[var(--dim)]">
                    {Math.abs(giveTotal - getTotal) < 0.005
                      ? "Even on value."
                      : giveTotal < getTotal
                        ? `${fmtUSD(getTotal - giveTotal)} in your favor on value`
                        : `${fmtUSD(giveTotal - getTotal)} in their favor on value`}
                  </p>
                ) : (
                  <p className="mt-2 text-right text-xs text-[var(--dim)]">
                    Totals show once every picked card has a
                    tracked price.
                  </p>
                )}
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={give.length === 0 || get.length === 0 || propose.isPending || noteHasLink}
                onClick={() => propose.mutate()}
                className="flex-1 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
              >
                Send proposal
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  // Full clear (Anthony, Nov 3, 2026): the
                  // composer's own picks go, the trade cart
                  // goes (which zeroes every chosen quantity
                  // on the profiles and drops the checkout
                  // bar), and on the checkout page we back out
                  // entirely. In the Trades area the composer
                  // just closes, emptied.
                  setGive([]);
                  setGet([]);
                  setNote("");
                  onSetTradeCart([]);
                  if (checkout && onCancelTradeCheckout)
                    onCancelTradeCheckout();
                  else setComposerOpen(false);
                }}
                className="shrink-0 rounded-full px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.15)] ring-1 ring-white/30 transition-transform duration-100 active:scale-[0.98]"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, #f87171 0%, #ef4444 100%)",
                }}
              >
                Cancel this trade
              </button>
            </div>
            {/* Message with this trade (Anthony, Nov 3, 2026):
                below the Send / Cancel buttons, the same
                placement as the cash checkout's order message.
                Written before sending; it travels with the
                proposal and opens the trade's message thread,
                where the conversation continues for both
                sides. Text only, no links. */}
            <div className="mt-4 border-t border-[var(--border)] pt-3.5">
              <label
                htmlFor="trade-order-message"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Message with this trade
              </label>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
                Write it before you send — it goes with the
                proposal, and they can answer in the same thread
                on the trade.
              </p>
              <textarea
                id="trade-order-message"
                rows={2}
                maxLength={280}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything they should know — timing, the meetup…"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
              />
              {noteHasLink ? (
                <p className="mt-1 text-xs font-semibold leading-relaxed text-red-300">
                  Links aren&rsquo;t allowed in trade messages —
                  remove the link to send.
                </p>
              ) : null}
              <p className="mt-2.5 text-[11px] leading-relaxed text-red-400">
                * Vault X doesn&rsquo;t send push notifications —
                you&rsquo;ll only see new messages when you open the
                app.
              </p>
            </div>
          </div>
        )}
      </div>

      {checkout ? null : (
        <>
      <h3 className="font-album mt-6 text-base text-[var(--text)]">
        Offers from friends
      </h3>
      {tradesQuery.isPending ? (
        <p className="py-6 text-center text-sm text-[var(--dim)]">
          Loading trades…
        </p>
      ) : pendingIncoming.length === 0 ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          No offers yet — when a friend proposes a trade, it lands
          here for you to accept or decline.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">{pendingIncoming.map(tradeCard)}</ul>
      )}

      <h3 className="font-album mt-5 text-base text-[var(--text)]">
        Your trade offers
      </h3>
      {pendingOutgoing.length === 0 ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          No proposals out right now — trades you propose to friends
          show up here.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">{pendingOutgoing.map(tradeCard)}</ul>
      )}

      {inProgress.length > 0 ? (
        <>
          <h3 className="font-album mt-5 text-base text-[var(--text)]">
            Trades in progress
          </h3>
          <ul className="mt-2 space-y-2">{inProgress.map(tradeCard)}</ul>
        </>
      ) : null}

      <h3 className="font-album mt-5 text-base text-[var(--text)]">
        Completed trades
      </h3>
      {completed.length === 0 && closed.length === 0 ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          Nothing here yet — swaps you finish in person will be
          recorded here.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {completed.map(tradeCard)}
          {closed.map(tradeCard)}
        </ul>
      )}


      <CashPurchasesSection focusDeal={focusDeal} />
        </>
      )}
    </section>
  );
}

/** The Social carts and the checkout page are remembered in
    sessionStorage so a pull-to-refresh lands back IN checkout
    with the cart intact (Anthony, Nov 3, 2026: refreshing on
    the cash checkout page threw him out to the friend's
    profile with the cart gone — the main view and the Social
    area already restore, so the page he is standing on must
    too). Same in-tab sessionStorage pattern as the main view:
    survives an in-place reload, clears when the app closes. */
const SOCIAL_NAV_STORAGE_KEY = "vaultx-social-nav-v1";

type StoredSocialNav = {
  tradeCart: CartLine[];
  cashCart: CartLine[];
  checkoutPage: boolean;
};

function readStoredSocialNav(): StoredSocialNav {
  const empty: StoredSocialNav = {
    tradeCart: [],
    cashCart: [],
    checkoutPage: false,
  };
  try {
    const raw = window.sessionStorage.getItem(SOCIAL_NAV_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<StoredSocialNav>;
    const lines = (v: unknown): CartLine[] =>
      Array.isArray(v)
        ? (v as CartLine[]).filter(
            (l) =>
              l != null &&
              typeof l.cardId === "number" &&
              typeof l.finish === "string" &&
              typeof l.qty === "number",
          )
        : [];
    return {
      tradeCart: lines(parsed.tradeCart),
      cashCart: lines(parsed.cashCart),
      checkoutPage: parsed.checkoutPage === true,
    };
  } catch {
    return empty;
  }
}

function SocialPanel({
  onOpenCard,
  pendingArea,
  onConsumePendingArea,
  focusDeal = null,
}: {
  onOpenCard: (id: number) => void;
  /** A one-shot request from elsewhere in the app (the Home
      order-mail indicator) to land on a given area; consumed
      once via the callback so it never re-fires. */
  pendingArea?: "trades" | null;
  onConsumePendingArea?: () => void;
  /** Inbox deep-link, forwarded to the Trades area. */
  focusDeal?: { kind: "cash" | "trade"; id: number; nonce: number } | null;
}) {
  const [area, setArea] = useState<
    "friends" | "forums" | "trades" | "market"
  >("friends");
  const socialIntro = useSectionIntro("social");
  // Unread order mail (Anthony, Nov 3, 2026): the Trades
  // entry carries the count so a reply inside an order is
  // visible from anywhere in Social.
  const mailStatus = useQuery({
    queryKey: ["orderMailStatus"],
    queryFn: () => api.getOrderMailStatus({}),
    refetchInterval: 15000,
  });
  useEffect(() => {
    if (!pendingArea) return;
    setArea(pendingArea);
    setFriendOpen(false);
    setCheckoutPage(false);
    onConsumePendingArea?.();
  }, [pendingArea]);
  // Jarvis's profile is a page inside Friends: opening it
  // pushes a history entry like every other navigation step, and the
  // sync below restores it (or closes it) from whatever entry Back
  // lands on.
  const [friendOpen, setFriendOpen] = useState(false);
  const friendPushedRef = useRef(false);
  // Trade and cash carts (Anthony's cart design, Nov 2, 2026,
  // late — supersedes per-card instant execution): the split
  // button's blue side adds a card to the trade cart, the green
  // cash side adds it to the cash cart, a card at a time while
  // browsing a friend's collection. Checkout lives in the
  // Trades area: the trade cart seeds the composer's get side
  // (with Fill my order auto-building his side by value), and
  // the cash cart sends as a purchase order from Cash checkout.
  // State lives here so the carts survive moving between the
  // friend's profile and Trades.
  const [socialNavSeed] = useState(readStoredSocialNav);
  const [tradeCart, setTradeCart] = useState<CartLine[]>(
    socialNavSeed.tradeCart,
  );
  const [cashCart, setCashCart] = useState<CartLine[]>(
    socialNavSeed.cashCart,
  );
  // The dedicated checkout page (Anthony, Nov 2, 2026, late):
  // the docked bar's Checkout opens this full page — the
  // checkout flows on their own screen — and the green bar is
  // gone while the page is open.
  const [checkoutPage, setCheckoutPage] = useState(
    socialNavSeed.checkoutPage,
  );
  // The checkout page's heading window can be hidden like the
  // "How trading works" window (title row stays, with Show).
  const [checkoutIntroHidden, setCheckoutIntroHidden] = useState(false);
  // Refresh-in-place: keep the stored copy in step so a reload
  // restores the carts and reopens the checkout page when he
  // was standing on it.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        SOCIAL_NAV_STORAGE_KEY,
        JSON.stringify({ tradeCart, cashCart, checkoutPage }),
      );
    } catch {
      // Storage full/blocked: the carts still work this session.
    }
  }, [tradeCart, cashCart, checkoutPage]);
  const addToCart =
    (setCart: (updater: (prev: CartLine[]) => CartLine[]) => void) =>
    (item: ProfileItemView) => {
      if (item.cardId == null) return;
      hapticConfirm();
      setCart((prev) => {
        const key = cartKeyOf(item.cardId as number, item.finish);
        const existing = prev.find(
          (l) => cartKeyOf(l.cardId, l.finish) === key,
        );
        if (existing) {
          return prev.map((l) =>
            l === existing
              ? { ...l, qty: Math.min(l.qty + 1, l.maxQty) }
              : l,
          );
        }
        return [
          ...prev,
          {
            cardId: item.cardId as number,
            name: item.name,
            groupName: item.groupName,
            printed: item.printed,
            finish: item.finish,
            qty: 1,
            maxQty: Math.max(1, item.qty),
            unitValue: item.unitValue,
          },
        ];
      });
    };
  const startWant = addToCart(setTradeCart);
  const startCash = addToCart(setCashCart);
  const cartCounts = useMemo(() => {
    const map = new Map<string, { trade: number; cash: number }>();
    for (const l of tradeCart) {
      const key = cartKeyOf(l.cardId, l.finish);
      const entry = map.get(key) ?? { trade: 0, cash: 0 };
      entry.trade = l.qty;
      map.set(key, entry);
    }
    for (const l of cashCart) {
      const key = cartKeyOf(l.cardId, l.finish);
      const entry = map.get(key) ?? { trade: 0, cash: 0 };
      entry.cash = l.qty;
      map.set(key, entry);
    }
    return map;
  }, [tradeCart, cashCart]);
  // Docked checkout bar figures: copy counts per cart, the
  // cash cart's running total at current market value, and
  // how many cash lines carry no tracked price yet.
  const tradeCartCount = tradeCart.reduce((s, l) => s + l.qty, 0);
  const cashCartCount = cashCart.reduce((s, l) => s + l.qty, 0);
  const cashCartTotal = cashCart.reduce(
    (s, l) => s + (l.unitValue ?? 0) * l.qty,
    0,
  );
  const cashCartUnpriced = cashCart.filter(
    (l) => l.unitValue == null,
  ).length;
  // Add-a-friend-by-code form state (typed codes, no scanning).
  // The lookup checks the LIVE Vault X registry on Supabase
  // (lookupCollector): any collector registered there resolves —
  // Jarvis (MC-JARVIS) included — while unregistered codes get an
  // honest not-found and an unreachable server is reported as
  // such, never faked as a result.
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [friendLookup, setFriendLookup] = useState<
    | { status: "idle" }
    | { status: "checking" }
    | { status: "jarvis" }
    | {
        status: "member";
        username: string;
        collectorId: string;
        trustScore: number;
      }
    | { status: "self" }
    | { status: "notfound" }
    | { status: "unreachable" }
  >({ status: "idle" });
  // Live registry members, for the "On the server" list and the
  // Jarvis entry's live badge (same query the Collector ID card
  // uses — shared cache).
  const registry = useQuery({
    queryKey: ["registryMembers"],
    queryFn: () => api.getRegistryMembers({}),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const runFriendLookup = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    setFriendLookup({ status: "checking" });
    try {
      const res = await api.lookupCollector({ code });
      if (!res.reachable) {
        setFriendLookup(
          code.toUpperCase() === JARVIS_FRIEND.collectorCode
            ? { status: "jarvis" }
            : { status: "unreachable" },
        );
        return;
      }
      if (!res.found || !res.member) {
        setFriendLookup({ status: "notfound" });
      } else if (res.isSelf) {
        setFriendLookup({ status: "self" });
      } else if (
        res.member.collectorId === JARVIS_FRIEND.collectorCode
      ) {
        hapticConfirm();
        setFriendLookup({ status: "jarvis" });
      } else {
        hapticConfirm();
        setFriendLookup({
          status: "member",
          username: res.member.username,
          collectorId: res.member.collectorId,
          trustScore: res.member.trustScore,
        });
      }
    } catch {
      setFriendLookup(
        code.toUpperCase() === JARVIS_FRIEND.collectorCode
          ? { status: "jarvis" }
          : { status: "unreachable" },
      );
    }
  };
  // Area switches are navigation steps (whole-app back-gesture fix):
  // each one pushes a history entry, and this listener syncs the
  // area from whatever entry Back lands on — a Social entry restores
  // its area (the plain Social entry means the default, Friends),
  // and pops landing on overlay entries (no mcView) are left to the
  // overlays' own traps. It also runs once on mount, so returning to
  // Social via Back restores the area its entry names.
  useEffect(() => {
    const syncFromHistory = () => {
      const st = window.history.state as {
        mcView?: string;
        socialArea?: string;
        socialFriend?: string;
      } | null;
      if (!st || st.mcView !== "social") return;
      setArea(
        st.socialArea === "forums" ||
          st.socialArea === "trades" ||
          st.socialArea === "market"
          ? st.socialArea
          : "friends",
      );
      const open = st.socialFriend === "jarvis";
      if (!open) friendPushedRef.current = false;
      setFriendOpen(open);
    };
    syncFromHistory();
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);
  const openFriend = () => {
    setFriendOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      window.history.pushState(
        { mcView: "social", socialArea: "friends", socialFriend: "jarvis" },
        "",
      );
      friendPushedRef.current = true;
    } catch {
      friendPushedRef.current = false;
    }
  };
  const closeFriend = () => {
    if (friendPushedRef.current) {
      window.history.back();
    } else {
      setFriendOpen(false);
    }
  };
  const pickArea = (key: "friends" | "forums" | "trades" | "market") => {
    if (key === area && !friendOpen) return;
    setFriendOpen(false);
    setArea(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      window.history.pushState(
        { mcView: "social", socialArea: key },
        "",
      );
    } catch {
      // History unavailable: the area still switched.
    }
  };
  const boards: { name: string; blurb: string }[] = [
    {
      name: "General Discussion",
      blurb: "Talk Lorcana, share pulls, and chat with other collectors",
    },
    {
      name: "Deck Help & Strategy",
      blurb: "Deck lists, ink combos, and advice for your next build",
    },
    {
      name: "Trades & Want Lists",
      blurb: "Line up trades and post the cards you're hunting for",
    },
    {
      name: "Local Game Nights",
      blurb: "Game nights, league play, and meetups at your local shops",
    },
    {
      name: "Collection Showcases",
      blurb: "Show off new pickups, completed sets, and binder pages",
    },
  ];
  return (
    <div className="mt-5 pb-2">
      {/* The intro as a bordered hideable window (Anthony, Nov 3,
          2026), same style as the Sealed intro: Hide collapses it
          to the Social title row with a Show control, remembered
          on the profile. The areas below are untouched. */}
      <HideableIntroWindow
        title={
          <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
            Social
          </h1>
        }
        hidden={socialIntro.hidden}
        onToggle={socialIntro.toggle}
      >
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          Spaces for connecting with other collectors — your friends
          list, boards to talk in, trade offers to line up swaps, and
          the Marketplace for buying and selling. The Marketplace and
          Forums are both coming soon — they&rsquo;re held back for
          more refinement before they open.
        </p>
      </HideableIntroWindow>

      {/* Area tabs — each area is its own page; Friends is first and
          is what Social opens on. */}
      <div
        className="mt-4 flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
        role="group"
        aria-label="Social areas"
      >
        {(
          [
            ["friends", "Friends"],
            ["trades", "Trades"],
            ["market", "Marketplace"],
            ["forums", "Forums"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={area === key}
            aria-label={
              key === "market" || key === "forums"
                ? `${label}, coming soon`
                : label
            }
            onClick={() => pickArea(key)}
            className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${
              area === key
                ? "bg-[var(--gold)] font-bold text-black"
                : "text-[var(--text)]"
            }`}
          >
            {label}
            {key === "market" || key === "forums" ? (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#ffd21f] align-middle"
              />
            ) : null}
            {key === "trades" && mailStatus.data && mailStatus.data.totalUnread > 0 ? (
              <span
                aria-label={`${mailStatus.data.totalUnread} unread order messages`}
                className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 py-px align-middle text-[10px] font-bold text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-2.5 w-2.5"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                {mailStatus.data.totalUnread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Forums page — a message-board style list of boards.
          Held from release (Anthony, Nov 2, 2026, late): the exact
          same treatment as the Marketplace — everything in the
          section stays in place, under a translucent diagonal
          yellow "Coming soon" overlay, and the overlay makes the
          section not clickable. It still needs refinement before
          anyone can use it. */}
      {area === "forums" ? (
      <section aria-label="Forums, coming soon" className="relative mt-6">
        <p className="sr-only">
          Forums are coming soon. The boards are here to see, but
          the section is not open to use yet.
        </p>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-album text-xl text-[var(--text)]">Forums</h2>
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--dim)]">
            Message boards
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Board-style discussions, grouped by topic — like a Facebook
          message board for Lorcana players.
        </p>
        <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
          {boards.map((board) => (
            <li key={board.name} className="flex items-start gap-3 py-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--gold-soft)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[18px] w-[18px]"
                >
                  <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1.1L3 20l1.1-5.3A8.5 8.5 0 1 1 21 11.5Z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {board.name}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                  {board.blurb}
                </span>
                <span className="mt-1 block text-xs text-[var(--dim)]">
                  No threads yet
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          Posting isn&rsquo;t switched on yet — the boards are laid out
          and ready for when we wire up threads.
        </p>
        {/* Translucent diagonal stamp — it covers the section and
            takes the clicks, so nothing underneath is tappable,
            while the boards stay visible through it. */}
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/20">
          <span className="bubbly-soon rotate-[18deg] whitespace-nowrap text-[42px] leading-none sm:text-6xl">
            Coming soon
          </span>
        </div>
      </section>
      ) : null}

      {/* Friends page — the friends list, and Social's default page.
          The single entry is Jarvis himself, built into the app as a
          friend at Anthony's request: a full working example of how
          a friend looks, what their profile shows, and how the two
          of you view each other's collections. Below the list, Add a
          Friend by code accepts a typed friend code (no scanning
          needed) — MC-JARVIS resolves to Jarvis right away. */}
      {area === "friends" && friendOpen ? (
        <JarvisFriendProfile
          onBack={closeFriend}
          onOpenCard={onOpenCard}
          onWantItem={startWant}
          onCashItem={startCash}
          cartCounts={cartCounts}
        />
      ) : null}
      {area === "friends" && !friendOpen ? (
      <section
        aria-label="Friends"
        className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-album text-xl text-[var(--text)]">Friends</h2>
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--dim)]">
            Friends list
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          The collectors you connect with will live here — so you can
          see their binders and line up trades in person.
        </p>
        {/* Your Trust Score summary (Anthony's verified-only design):
            the full breakdown lives on the Collector ID profile; the
            figures are honest zeros until connecting/trading go live. */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)]">
              Your Trust Score
            </span>
            <span className="block text-xs leading-relaxed text-[var(--dim)]">
              0 confirmed connections · 0 confirmed trades — it grows
              only from verified events, never upvotes. Full breakdown
              on your Collector ID, at the top of Home.
            </span>
          </span>
          <span className="font-album shrink-0 text-2xl font-bold text-[var(--gold-soft)]">
            0
          </span>
        </div>
        <ul className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
          <li>
            <button
              type="button"
              onClick={openFriend}
              aria-label={`Open ${JARVIS_FRIEND.displayName}'s profile — your assistant, built into the app as a friend`}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--accent)]/60 bg-[var(--bg)] font-album text-base font-bold text-[var(--gold-soft)]"
              >
                J
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {JARVIS_FRIEND.displayName}
                </span>
                <span className="block text-xs text-[var(--dim)]">
                  @{JARVIS_FRIEND.username} · Trust Score{" "}
                  {JARVIS_FRIEND.trustScore} · {JARVIS_FRIEND.connections}{" "}
                  confirmed connection
                </span>
                <span className="block text-xs text-[var(--dim)]">
                  Your assistant, built in as a friend — tap to see my
                  collection and how sharing looks
                </span>
                {registry.data?.jarvisRegistered ? (
                  <span className="block text-xs font-semibold text-emerald-400">
                    ✓ Live on the Vault X server
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 rounded-full border border-[var(--accent)]/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-soft)]">
                Friend
              </span>
              <span aria-hidden="true" className="shrink-0 text-lg text-[var(--dim)]">
                ›
              </span>
            </button>
          </li>
        </ul>

        {/* On the server — the LIVE member list of the Shadow
            Vault registry (Supabase profiles table), read back from
            the server itself: these usernames and codes live on
            the central server, not just inside this app. Anthony's
            own row is flagged "You"; Jarvis's row proves the test
            friend ported over. */}
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-album text-base text-[var(--text)]">
            On the server
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            Collectors registered in the Vault X registry — the
            central server every copy of the app checks.
          </p>
          {registry.isPending ? (
            <p className="mt-2.5 text-sm text-[var(--dim)]" role="status">
              Checking the server…
            </p>
          ) : registry.data && registry.data.reachable ? (
            registry.data.members.length > 0 ? (
              <ul className="mt-2.5 divide-y divide-[var(--border)]">
                {registry.data.members.map((m) => (
                  <li
                    key={m.collectorId}
                    className="flex items-center gap-2.5 py-2"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent)]/50 bg-[var(--bg)] font-album text-xs font-bold text-[var(--gold-soft)]"
                    >
                      {(m.username.replace(/^@/, "").charAt(0) || "?").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {m.username.startsWith("@")
                          ? m.username
                          : `@${m.username}`}
                      </span>
                      <span className="block text-[11px] tabular-nums text-[var(--dim)]">
                        {m.collectorId} · Trust Score {m.trustScore}
                      </span>
                    </span>
                    {m.collectorId === registry.data.myCollectorCode ? (
                      <span className="shrink-0 rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                        You
                      </span>
                    ) : m.collectorId === JARVIS_FRIEND.collectorCode ? (
                      <span className="shrink-0 rounded-full border border-emerald-400/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        On server
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 text-sm text-[var(--dim)]" role="status">
                The server registry is empty right now.
              </p>
            )
          ) : (
            <p className="mt-2.5 text-sm text-red-400" role="status">
              Couldn&rsquo;t reach the server registry just now — the
              list above your Collector ID keeps retrying.
            </p>
          )}
        </div>

        {/* Add a friend by typed code — no QR scanning needed: a
            friend reads their code out (or sends it in a message)
            and you type it here. The lookup checks the live Shadow
            Vault registry on the server, so any registered
            collector resolves — MC-JARVIS included. */}
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-album text-base text-[var(--text)]">
            Add a friend by code
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
            No scanning needed — type a friend&rsquo;s code exactly as
            they give it to you, and the app checks the live server
            registry. Try mine:{" "}
            <span className="font-bold text-[var(--text)]">
              {JARVIS_FRIEND.collectorCode}
            </span>
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runFriendLookup(friendCodeInput);
            }}
          >
            <label className="sr-only" htmlFor="friend-code-input">
              Friend code
            </label>
            <input
              id="friend-code-input"
              type="text"
              value={friendCodeInput}
              onChange={(e) => {
                setFriendCodeInput(e.target.value);
                setFriendLookup({ status: "idle" });
              }}
              placeholder="e.g. MC-JARVIS"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--text)] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--dim)]"
            />
            <button
              type="submit"
              disabled={friendLookup.status === "checking"}
              className="shrink-0 rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
            >
              {friendLookup.status === "checking"
                ? "Checking…"
                : "Add friend"}
            </button>
          </form>
          {friendLookup.status === "checking" ? (
            <p className="mt-3 text-sm text-[var(--dim)]" role="status">
              Checking the server registry…
            </p>
          ) : null}
          {friendLookup.status === "jarvis" ? (
            <div className="mt-3" role="status">
              <p className="text-sm font-semibold text-emerald-400">
                Found on the server — that&rsquo;s me, Jarvis
                (@{JARVIS_FRIEND.username}). We&rsquo;re already
                connected.
              </p>
              <button
                type="button"
                onClick={openFriend}
                className="mt-2 w-full rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-bold text-[var(--gold-soft)]"
              >
                View Jarvis&rsquo;s collection
              </button>
            </div>
          ) : null}
          {friendLookup.status === "member" ? (
            <p className="mt-3 text-sm font-semibold text-emerald-400" role="status">
              Found on the server —{" "}
              {friendLookup.username.startsWith("@")
                ? friendLookup.username
                : `@${friendLookup.username}`}{" "}
              ({friendLookup.collectorId}) · Trust Score{" "}
              {friendLookup.trustScore}. Sending a confirmed
              connection is the next layer to switch on.
            </p>
          ) : null}
          {friendLookup.status === "self" ? (
            <p className="mt-3 text-sm font-semibold text-[var(--gold-soft)]" role="status">
              That&rsquo;s your own Collector ID — it&rsquo;s
              registered on the server, just as it should be.
            </p>
          ) : null}
          {friendLookup.status === "notfound" ? (
            <p className="mt-3 text-sm text-red-400" role="status">
              No collector with that code is registered on the server
              yet — double-check the code and try again. A code
              resolves once its owner&rsquo;s app registers their
              Collector ID; {JARVIS_FRIEND.collectorCode} works today.
            </p>
          ) : null}
          {friendLookup.status === "unreachable" ? (
            <p className="mt-3 text-sm text-red-400" role="status">
              Couldn&rsquo;t reach the server registry just now —
              check your connection and try again.
            </p>
          ) : null}
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
          Jarvis is your one friend in the app right now — and
          he&rsquo;s registered on the server, so the lookup above
          finds him live. Any collector whose app registers their
          Collector ID can be found by code the same way; confirmed
          connections and trading are the next layer.
        </p>
      </section>
      ) : null}

      {/* Trades page — trade offers, TraYde-style. Friends share
          their collections, line up a swap here, and complete it in
          person. Structure only — no live trading and no invented
          offers. */}
      {area === "market" ? (
        MARKETPLACE_AVAILABLE ? (
          <MarketplacePanel
            onOpenJarvisProfile={() => {
              pickArea("friends");
              openFriend();
            }}
          />
        ) : (
          <MarketplaceHeldPanel />
        )
      ) : null}

      {area === "trades" ? (
        <TradesPanel
          onOpenCard={onOpenCard}
          wantPick={null}
          onWantConsumed={() => {}}
          tradeCart={tradeCart}
          cashCart={cashCart}
          onAddTrade={startWant}
          onAddCash={startCash}
          onSetTradeCart={setTradeCart}
          onSetCashCart={setCashCart}
          cartCounts={cartCounts}
          focusDeal={focusDeal}
        />
      ) : null}

      {checkoutPage ? (
        <div className="app-shell fixed inset-0 z-50 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-3 pb-12 pt-4">
            {/* The Checkout heading + tagline as a WINDOW in
                the "How trading works" style (Anthony, Nov 3,
                2026): a panel with a Hide control that collapses
                it to its title row; the invoice below stays
                outside the window. */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-album text-xl text-[var(--text)]">
                  Checkout
                </h2>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticTick();
                      setCheckoutIntroHidden((h) => !h);
                    }}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--dim)] underline"
                  >
                    {checkoutIntroHidden ? "Show" : "Hide"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutPage(false)}
                    className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
                  >
                    Back to browsing
                  </button>
                </span>
              </div>
              {checkoutIntroHidden ? null : (
                <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                  Everything you picked up, in one place — fill
                  and send the trade, or send the cash purchase
                  order.
                </p>
              )}
            </div>
            <TradesPanel
              checkout
              onOpenCard={onOpenCard}
              wantPick={null}
              onWantConsumed={() => {}}
              tradeCart={tradeCart}
              cashCart={cashCart}
              onAddTrade={startWant}
              onAddCash={startCash}
              onSetTradeCart={setTradeCart}
              onSetCashCart={setCashCart}
              cartCounts={cartCounts}
              onCancelCashCheckout={() => {
                // Full clear: the whole cash cart goes (every
                // chosen quantity back to zero, checkout bar
                // gone), then back to browsing.
                setCashCart([]);
                setCheckoutPage(false);
              }}
              onCancelTradeCheckout={() => {
                setTradeCart([]);
                setCheckoutPage(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Docked checkout bar (Anthony's placement, Nov 2, 2026,
          late): a LONG bar riding directly above the bottom
          menu bar, standard online-store behavior — it is NOT
          there while both carts are empty; the minute the
          first card is added (blue trade side or green cash
          side) it appears and just stays, updating its counts
          and the cash running total, while he keeps browsing
          and adding. Nobody has to touch it until they're
          done: its Checkout button then takes them to the
          Trades area to finalize. Bright green, shaped like
          the Send purchase order bar he pointed at — "that's
          exactly how I want it to look, just brighter." */}
      {!checkoutPage &&
      (tradeCart.length > 0 || cashCart.length > 0) &&
      friendOpen ? (
        <div
          className="fixed inset-x-0 z-40 mx-auto w-full max-w-3xl px-3"
          style={{
            bottom:
              "calc(4.6rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-b from-[#4ade80] to-[#22c55e] px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.55),0_0_18px_rgba(74,222,128,0.35)] ring-1 ring-white/30">
            <span className="min-w-0 text-sm font-semibold leading-snug text-white">
              {tradeCart.length > 0 ? (
                <span className="block">
                  Trade cart · {tradeCartCount}{" "}
                  {tradeCartCount === 1 ? "card" : "cards"}
                </span>
              ) : null}
              {cashCart.length > 0 ? (
                <span className="block">
                  Cash cart · {cashCartCount}{" "}
                  {cashCartCount === 1 ? "card" : "cards"} · ≈{" "}
                  {fmtUSD(cashCartTotal)}
                  {cashCartUnpriced > 0
                    ? ` + ${cashCartUnpriced} unpriced`
                    : ""}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setCheckoutPage(true);
              }}
              className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-black text-green-700 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition active:scale-[0.97]"
            >
              Checkout
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}

/** The main view is remembered in sessionStorage so a pull-to-refresh
    reload lands back on the SAME section instead of resetting to
    Home (Anthony's bug report: refreshing on the Sealed page bounced
    him to Home). sessionStorage survives an in-place reload of the
    same tab — exactly the pull-to-refresh case — and clears when the
    app is fully closed, so a fresh open still starts on Home. */
const VIEW_STORAGE_KEY = "mycollectibles-view-v1";

type MainView =
  | "home"
  | "binder"
  | "finances"
  | "social"
  | "sealed"
  | "comics"
  | "lego"
  | "settings";

const MAIN_VIEWS: MainView[] = [
  "home",
  "binder",
  "finances",
  "social",
  "sealed",
  "comics",
  "lego",
  "settings",
];

function readStoredView(): MainView {
  try {
    const v = window.sessionStorage.getItem(VIEW_STORAGE_KEY);
    return MAIN_VIEWS.includes(v as MainView) ? (v as MainView) : "home";
  } catch {
    return "home";
  }
}

/** The current history entry's state, read during first render.
    Overlay and section states (binder group, card sheet, sealed
    sheet, missing sheet, own profile) are seeded from it so a
    PAGE REFRESH reopens exactly the view the user was on —
    refresh in place, never relocate (Anthony, Nov 3, 2026:
    refreshes bounced him out of a set view to all-sets, out of
    checkout to a Social profile, and off his own profile to
    Home). On a fresh open the state is null and every seed
    falls back to its normal default. */
function readHistoryState(): Record<string, unknown> | null {
  try {
    const st = window.history.state as Record<string, unknown> | null;
    return st && typeof st === "object" ? st : null;
  } catch {
    return null;
  }
}

/** Reload to update, shared by Settings and the dedicated
    update view: re-fetch the page and its bundle with cache:
    "reload" first — replacing the webview's cached copies with
    the fresh build — then reload, so the reload can only serve
    the new version (a plain reload alone was served from cache
    and kept landing on the old version). Priming is
    best-effort: if a fetch fails, the plain reload still runs. */
async function primeCacheAndReload(): Promise<void> {
  try {
    const pageRes = await fetch("./", { cache: "reload" });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)]
        .map((m) => m[1])
        .filter((s): s is string => typeof s === "string");
      await Promise.all(
        srcs.map(async (src) => {
          try {
            await fetch(new URL(src, document.baseURI).toString(), {
              cache: "reload",
            });
          } catch {
            // One bundle failing to prime still leaves the
            // reload itself; the page prime is the part that
            // decides which bundle gets loaded.
          }
        }),
      );
    }
  } catch {
    // Priming failed (offline, etc.) — reload anyway.
  }
  window.location.reload();
}

/** The element that actually scrolls this page. The Muse
    shell wraps the app in a generated root div that is the
    real scroller — the window itself never scrolls — while a
    plain browser build scrolls the document. The first
    version of the scroll arrows measured only the window
    (Anthony, Nov 3, 2026: shipped in v1.27 but he saw them
    NOWHERE — not on long set pages, not in Settings — because
    window.scrollY stayed 0 and the document's scrollHeight
    never exceeded the viewport, so the arrows concluded no
    page was ever long). This finds whichever element is
    genuinely scrollable, longest first. */
function findPageScroller(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>(
    "[data-generated-space-root]",
  );
  if (root && root.scrollHeight > root.clientHeight + 8) return root;
  const se = document.scrollingElement as HTMLElement | null;
  if (se && se.scrollHeight > se.clientHeight + 8) return se;
  return root ?? se ?? null;
}

/** Floating scroll arrows (Anthony, Nov 3, 2026): on any long
    view — his example was the Hyperia City set view — a pair of
    ghost (translucent, frosted) arrows floats at the right
    edge above the bottom menu: the down arrow rides to the
    very bottom of the page, the up arrow back to the top, so
    nobody has to swipe the whole list. They only appear when
    the page is actually long, each arrow only when it has
    somewhere to go. Settings gets them too — it's one of the
    longest pages in the app. Rebuilt the same night to measure
    the real scrolling element (see findPageScroller) after
    the window-measuring version never appeared on his phone. */
function ScrollArrows() {
  const [pos, setPos] = useState({ y: 0, max: 0, view: 0 });
  /** Follow-mode timer for the down arrow (see the button). */
  const followRef = useRef<number | null>(null);
  const stopFollow = () => {
    if (followRef.current != null) {
      window.clearInterval(followRef.current);
      followRef.current = null;
    }
  };
  useEffect(() => stopFollow, []);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = findPageScroller();
      if (!el) {
        setPos({ y: 0, max: 0, view: window.innerHeight });
        return;
      }
      setPos({
        y: el.scrollTop,
        max: Math.max(0, el.scrollHeight - el.clientHeight),
        view: el.clientHeight,
      });
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    // Scroll events don't bubble, but they DO travel the
    // capture phase — listening on the document in capture
    // hears the real scroller (and any inner one) scroll.
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onScroll);
    // Content growth without any scroll or resize event —
    // arriving on a long set page whose pockets render in
    // chunks — must still bring the arrows up: watch the
    // content wrapper and the body, whose heights actually
    // change as content loads (the document element's own
    // box is just the viewport and never grows).
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onScroll)
        : null;
    const shell = document.querySelector(".app-shell");
    if (shell) ro?.observe(shell);
    if (document.body) ro?.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("scroll", onScroll, {
        capture: true,
      });
      window.removeEventListener("resize", onScroll);
      ro?.disconnect();
    };
  }, []);
  if (pos.max < Math.max(240, pos.view * 0.5)) return null;
  const showUp = pos.y > 240;
  const showDown = pos.y < pos.max - 240;
  if (!showUp && !showDown) return null;
  // Translucent and toned down (Anthony, Nov 3, 2026): the
  // arrows are a quiet see-through frost, not solid buttons —
  // and a set floats on BOTH edges so either thumb can reach
  // them. Both stacks run the same handlers below. The fill
  // itself is the .scroll-arrow-btn style in theme.css
  // (surface color at 18% over a strong blur) — the earlier
  // 35% utility tint still read as solid on his phone, so the
  // mix is thinner now and the glyph sits at 60%.
  const btn =
    "scroll-arrow-btn flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-[var(--text)]/60 shadow-[0_4px_14px_rgba(0,0,0,0.22)] transition active:scale-95";
  const goTop = () => {
    hapticTick();
    stopFollow();
    findPageScroller()?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const stack = (side: "left" | "right") => (
    <div
      className={`fixed ${side}-3 z-40 flex flex-col gap-2`}
      style={{ bottom: "calc(5.4rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {showUp ? (
        <button
          type="button"
          aria-label="Scroll to the top of the page"
          onClick={goTop}
          className={btn}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 20V4" />
            <path d="m5 11 7-7 7 7" />
          </svg>
        </button>
      ) : null}
      {showDown ? (
        <button
          type="button"
          aria-label="Scroll to the bottom of the page"
          onClick={() => {
            hapticTick();
            const el = findPageScroller();
            if (!el) return;
            stopFollow();
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            // Chunked pages (the binder grid loads pockets
            // in batches as you scroll) keep GROWING while
            // the jump travels — a single scrollTo lands at
            // the bottom of only the loaded part, mid-list.
            // Follow mode re-aims at the bottom each time
            // the page grows, until the height settles (all
            // chunks in) or the user takes over scrolling.
            let lastHeight = el.scrollHeight;
            let stableTicks = 0;
            const startedAt = Date.now();
            const cancel = () => stopFollow();
            el.addEventListener("wheel", cancel, {
              once: true,
              passive: true,
            });
            el.addEventListener("touchstart", cancel, {
              once: true,
              passive: true,
            });
            followRef.current = window.setInterval(() => {
              const s = findPageScroller();
              if (!s) {
                stopFollow();
                return;
              }
              if (s.scrollHeight !== lastHeight) {
                lastHeight = s.scrollHeight;
                stableTicks = 0;
                s.scrollTo({
                  top: s.scrollHeight,
                  behavior: "smooth",
                });
              } else {
                stableTicks += 1;
              }
              if (
                stableTicks >= 6 ||
                Date.now() - startedAt > 20000
              ) {
                stopFollow();
              }
            }, 250);
          }}
          className={btn}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 4v16" />
            <path d="m19 13-7 7-7-7" />
          </svg>
        </button>
      ) : null}
    </div>
  );
  return (
    <>
      {stack("left")}
      {stack("right")}
    </>
  );
}

export function App() {
  const queryClient = useQueryClient();
  // Theme (Settings > Theme): starts from the device mirror so the
  // picked theme is on from the first frame; the profile's saved
  // choice, once fetched, wins if it differs (that's the copy that
  // follows the user across devices). Picking applies instantly,
  // mirrors to the device, and saves to the profile.
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);
  const profileTheme = useQuery({
    queryKey: ["collector-id-theme"],
    queryFn: () => api.getCollectorId({}),
  });
  useEffect(() => {
    const saved = profileTheme.data?.theme;
    if (isThemeId(saved) && saved !== theme) {
      setTheme(saved);
      applyTheme(saved);
    }
    // Only the arriving server value matters here; `theme` is read
    // for the comparison, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileTheme.data]);
  const changeTheme = (next: ThemeId) => {
    hapticTick();
    setTheme(next);
    applyTheme(next);
    void api.setThemePreference({ theme: next }).catch(() => {
      // Offline or server hiccup: the theme still applies here and
      // is mirrored on this device; the profile keeps the last
      // saved choice.
    });
  };
  const [binderCacheSeed] = useState(readBinderCache);
  const binder = useQuery({
    queryKey: ["binder"],
    queryFn: () => api.getBinder({}),
    initialData: binderCacheSeed?.data,
    initialDataUpdatedAt: binderCacheSeed?.savedAt,
    // A one-off load failure shouldn't dead-end the binder: retry with
    // backoff and stay in the loading state while retries run.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Drop art caches from older versions once per open.
  useEffect(() => {
    void pruneOldArtCaches();
  }, []);

  // Keep the on-device binder copy fresh whenever new data lands.
  useEffect(() => {
    if (!binder.data) return;
    try {
      window.localStorage.setItem(
        BINDER_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), data: binder.data }),
      );
    } catch {
      // Storage unavailable: repeat opens just fetch as before.
    }
  }, [binder.data]);
  const seed = useMutation({
    mutationFn: () => api.seedBinder({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["binder"] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
  const seedStarted = useRef(false);
  // Bottom-nav views: Home (placeholder), Binder, Portfolio (the Card
  // Performance section), and Social (Forums + Friends areas).
  // Search is a nav action that opens the floating search overlay.
  const [view, setView] = useState<MainView>(readStoredView);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Storage unavailable: navigation works as before, a reload
      // just starts on Home.
    }
  }, [view]);
  // Automatic update check on open (Anthony, Nov 2, 2026,
  // late): the app checks by itself when it opens — never
  // auto-updates; a newer build only lights the yellow
  // "Update available" note on Home, left of his username,
  // and tapping it takes him to Settings to read the
  // changelog and choose to reload.
  const [availableUpdate, setAvailableUpdate] = useState<{
    version: string;
    notes: string[];
  } | null>(null);
  // The update view (Anthony, Nov 3, 2026): tapping the
  // "Update available" note on Home opens THIS dedicated view
  // — not the Settings page. It shows only the update itself:
  // the changelog, and the choice — Update, or Don't update
  // at this time. Backing out leaves everything as it was.
  // The one-time TEST note opens the same view in rehearsal
  // mode; the test is consumed only when he makes the choice
  // at the end of it (either button), never by backing out.
  const [updateViewMode, setUpdateViewMode] = useState<
    "test" | "real" | null
  >(null);
  const [updateTestPhase, setUpdateTestPhase] = useState<
    "read" | "applying" | "done"
  >("read");
  const updateViewPushedRef = useRef(false);
  const openUpdateView = (mode: "test" | "real") => {
    setUpdateTestPhase("read");
    setUpdateViewMode(mode);
    try {
      window.history.pushState({ lorcanaUpdateView: mode }, "");
      updateViewPushedRef.current = true;
    } catch {
      updateViewPushedRef.current = false;
    }
  };
  const closeUpdateView = () => {
    if (updateViewPushedRef.current) {
      window.history.back();
    } else {
      setUpdateViewMode(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (updateViewPushedRef.current) {
        updateViewPushedRef.current = false;
        setUpdateViewMode(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // The tickets window (Anthony, Nov 3, 2026): tapping the
  // red envelope on Home opens the change-request ticket list
  // in THIS dedicated window — never the Settings page (his
  // correction, twice over). Same history pattern as the
  // update view: opening pushes one entry, Back closes it.
  const [ticketsOpen, setTicketsOpen] = useState(false);
  // The Home bottom note window (Anthony, Nov 3, 2026,
  // ~1:52 AM): the two-pockets explainer at the foot of the
  // page gets the same bordered hideable window as the
  // Sealed/Social intros.
  const homeIntro = useSectionIntro("home");
  const ticketsPushedRef = useRef(false);
  const openTicketsWindow = () => {
    setTicketsOpen(true);
    try {
      window.history.pushState({ lorcanaTickets: true }, "");
      ticketsPushedRef.current = true;
    } catch {
      ticketsPushedRef.current = false;
    }
  };
  // Trades landing hand-off (Anthony, Nov 3, 2026): the
  // pendingSocialArea state names the Social area a deep
  // link should land on (an Inbox order item lands on
  // Trades, focused on that order). One-shot: the Social
  // panel consumes it and clears it.
  const [pendingSocialArea, setPendingSocialArea] = useState<
    "trades" | null
  >(null);
  // The personal Inbox (Anthony, Nov 3, 2026, later): the
  // Home mail indicator opens THIS window — every purchase
  // order, trade offer, and (for the owner) change-request
  // ticket in one mail-style list. Same history pattern as
  // the tickets window: opening pushes one entry, Back
  // closes it. Opening an item stacks its own view above
  // the Inbox (the standalone mail view for orders, the
  // tickets window for tickets) and closing that view
  // returns here — the Inbox itself never routes through
  // Social or Settings.
  const [inboxOpen, setInboxOpen] = useState(false);
  // The one-time Welcome flow (Anthony, Nov 3, 2026): shown
  // when the profile still owes it (getWelcomeState), and
  // re-openable any time from Settings > About this app
  // (review mode — a plain close, nothing forced).
  const welcomeState = useQuery({
    queryKey: ["welcomeState"],
    queryFn: () => api.getWelcomeState({}),
  });
  const [welcomeReviewOpen, setWelcomeReviewOpen] = useState(false);
  const welcomeOwed = welcomeState.data?.needsWelcome ?? false;
  const inboxPushedRef = useRef(false);
  const [focusDeal, setFocusDeal] = useState<{
    kind: "cash" | "trade";
    id: number;
    nonce: number;
  } | null>(null);
  const [ticketFocusId, setTicketFocusId] = useState<number | null>(
    null,
  );
  const openInbox = () => {
    setInboxOpen(true);
    try {
      window.history.pushState({ lorcanaInbox: true }, "");
      inboxPushedRef.current = true;
    } catch {
      inboxPushedRef.current = false;
    }
  };
  const closeInboxWindow = () => {
    if (inboxPushedRef.current) {
      window.history.back();
    } else {
      setInboxOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      // Stacked windows (Anthony, Nov 3, 2026): the mail view
      // and the tickets window can sit ABOVE the Inbox, so one
      // popstate must close only the top one. The history
      // state after the pop names the entry we landed on —
      // the Inbox closes only when we've left its entry for
      // good (not when a window above it closed back to it).
      const s = window.history.state as {
        lorcanaInbox?: boolean;
        lorcanaMail?: boolean;
        lorcanaTickets?: boolean;
      } | null;
      if (
        inboxPushedRef.current &&
        !s?.lorcanaInbox &&
        !s?.lorcanaMail &&
        !s?.lorcanaTickets
      ) {
        inboxPushedRef.current = false;
        setInboxOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // (The Inbox no longer lands on Trades at all — messages
  //  open in the standalone mail view above the Inbox. The
  //  focusDeal state below stays null now; the Trades panel
  //  still accepts it for its own in-place thread chips.)
  // Standalone mail view (Anthony, Nov 3, 2026, ~2:37 AM —
  // his correction after the first Inbox shipped: opening a
  // message must NOT throw him into Social/Trades). A message
  // opens as its OWN page above the Inbox — Subject/From
  // header, the order itself, its thread — with an X (or the
  // phone's Back) returning him to the Inbox list, which
  // stays open underneath the whole time.
  const [mailView, setMailView] = useState<{
    kind: "cash" | "trade";
    id: number;
    nonce: number;
  } | null>(null);
  const mailViewPushedRef = useRef(false);
  const openInboxOrder = (kind: "cash" | "trade", refId: number) => {
    setMailView({ kind, id: refId, nonce: Date.now() });
    try {
      window.history.pushState({ lorcanaMail: true }, "");
      mailViewPushedRef.current = true;
    } catch {
      mailViewPushedRef.current = false;
    }
  };
  const closeMailView = () => {
    if (mailViewPushedRef.current) {
      window.history.back();
    } else {
      setMailView(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      const s = window.history.state as {
        lorcanaMail?: boolean;
      } | null;
      if (mailViewPushedRef.current && !s?.lorcanaMail) {
        mailViewPushedRef.current = false;
        setMailView(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const openInboxTicket = (refId: number) => {
    setTicketFocusId(refId);
    // The Inbox stays open underneath; the tickets window
    // stacks above it and its Back returns to the Inbox list.
    openTicketsWindow();
  };
  const closeTicketsWindow = () => {
    if (ticketsPushedRef.current) {
      window.history.back();
    } else {
      setTicketsOpen(false);
    }
  };
  // A ticket focus handed over from the Inbox is one-shot:
  // once the tickets window closes, forget it so a later
  // plain envelope tap opens the list as usual.
  useEffect(() => {
    if (!ticketsOpen && ticketFocusId != null) {
      setTicketFocusId(null);
    }
  }, [ticketsOpen, ticketFocusId]);
  useEffect(() => {
    const onPopState = () => {
      const s = window.history.state as {
        lorcanaTickets?: boolean;
      } | null;
      if (ticketsPushedRef.current && !s?.lorcanaTickets) {
        ticketsPushedRef.current = false;
        setTicketsOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const finishUpdateTest = useMutation({
    mutationFn: () => api.dismissUpdateTest({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["collectorId"] });
    },
  });
  const completeTestAndClose = () => {
    finishUpdateTest.mutate();
    closeUpdateView();
  };
  useEffect(() => {
    let live = true;
    void fetchLatestBuild().then((res) => {
      if (live && res != null && res !== "current") {
        setAvailableUpdate(res);
      }
    });
    return () => {
      live = false;
    };
  }, []);
  // Section navigation + browser history (the whole-app back-gesture
  // fix, Nov 2, 2026): the sheets and overlays have always pushed a
  // history entry so Back closes them in place, but switching between
  // the main sections (Home / Binders / Sealed / Social / Portfolio /
  // Comics / Lego) only flipped React state — no history entry — so
  // the phone's back button/gesture had nothing to step back to
  // inside the app and exited it altogether. Now every section switch
  // pushes one entry carrying { mcView }, and one central popstate
  // listener (below, next to pickGroup) restores the section from the
  // entry Back lands on. Overlay entries carry no mcView, so the
  // central listener ignores overlay pops and the overlays' own
  // traps keep working exactly as before.
  //
  // On a fresh open, normalize the stack: the document's own entry
  // becomes the Home entry, and a section restored from
  // sessionStorage (pull-to-refresh on Sealed, say) is pushed above
  // it, so Back from a restored section lands on Home instead of
  // exiting. A reload with an intact stack already carries mcView on
  // its current entry and is left alone.
  const navInitRef = useRef(false);
  useEffect(() => {
    if (navInitRef.current) return;
    navInitRef.current = true;
    try {
      const st = window.history.state as {
        mcView?: string;
        mcBinder?: string;
        lorcanaCard?: number;
        lorcanaSealed?: string;
        lorcanaMissing?: string;
        lorcanaOwnProfile?: boolean;
        lorcanaCollectorId?: boolean;
      } | null;
      // A reload whose current entry carries ANY app state —
      // a section, a binder group, or an open sheet/profile —
      // is an intact stack: leave it alone so the seeded states
      // reopen exactly where the user was (refresh in place).
      if (
        st &&
        (typeof st.mcView === "string" ||
          typeof st.mcBinder === "string" ||
          typeof st.lorcanaCard === "number" ||
          typeof st.lorcanaSealed === "string" ||
          typeof st.lorcanaMissing === "string" ||
          st.lorcanaOwnProfile === true ||
          st.lorcanaCollectorId === true)
      )
        return;
      window.history.replaceState({ mcView: "home" }, "");
      if (view !== "home") {
        window.history.pushState({ mcView: view }, "");
      }
    } catch {
      // History unavailable (e.g. sandboxed frame): navigation still
      // works via the on-screen controls, as before.
    }
    // Only the initial view matters here; this runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  // Page-to-page transition animation (Anthony, Nov 3, 2026,
  // ~10:03 AM rework): ONE animation state drives every tab
  // change — swipe or bottom-bar tap alike. The old version
  // animated only swipes, at 240ms, and Anthony's on-device
  // verdict was that it still felt sharp and fast, like a cut;
  // taps cut instantly on top of that. The CSS side
  // (.tab-slide-next/.tab-slide-prev/.tab-fade in theme.css) is
  // now 480ms on a soft ease-out curve with a full crossfade,
  // and this state is triggered from navigate(), goSearch(),
  // closeSearch(), and the swipe handler so no page change
  // snaps. Direction comes from the bottom bar's own order:
  // Home 0, Search 1, Sealed/Comics/Lego 2, Social 3,
  // Portfolio 4, Settings 5. "fade" is the directionless
  // return from Search to the view underneath.
  const [pageAnim, setPageAnim] = useState<{
    dir: "next" | "prev" | "fade";
    nonce: number;
  } | null>(null);
  const pageAnimAtRef = useRef(0);
  const triggerPageAnim = (dir: "next" | "prev" | "fade") => {
    pageAnimAtRef.current = Date.now();
    setPageAnim(null);
    window.requestAnimationFrame(() =>
      setPageAnim({ dir, nonce: Date.now() }),
    );
  };
  // Which way the Search screen itself slides in when it
  // opens (set by goSearch from the tab it was opened from;
  // null = opened some other way, use the gentle pop).
  const [searchAnimDir, setSearchAnimDir] = useState<
    "next" | "prev" | null
  >(null);
  // Bottom-bar order index for a view (Search handled by the
  // caller, which knows whether it is open).
  const tabIndexForView = (v: MainView): number => {
    switch (v) {
      case "sealed":
      case "comics":
      case "lego":
        return 2;
      case "social":
        return 3;
      case "finances":
        return 4;
      case "settings":
        return 5;
      default:
        // "home" and "binder" both sit in Home's slot.
        return 0;
    }
  };
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  // Keyboard-synced Search rise (Anthony, Nov 3, 2026, live
  // bug: when the keyboard came up, the page rose with a
  // tremendous lag). DIAGNOSED CAUSE: two things fought the
  // keyboard's own animation — (1) the overlay's full-screen
  // backdrop-blur forced the browser to re-rasterize a
  // blurred copy of the entire app on every frame of the
  // keyboard's resize, and (2) the panel's position was
  // layout-driven (a full-height flex column with a vh
  // bottom padding), so the whole page relayout ran behind
  // the keyboard frame by frame. THE FIX: while the search
  // field is focused, the overlay drops the backdrop blur
  // (plain dark scrim — nothing expensive to repaint) and
  // its height is pinned to the visual viewport's height,
  // updated by the same visualViewport resize events the
  // browser fires as the keyboard animates — so the panel,
  // anchored to the bottom of that height, rides up in the
  // keyboard's own motion instead of trailing it.
  // GHOST-PATTERN FIX (Anthony, Nov 3, 2026, live: the rise
  // was fast after the lag fix but showed a heavy glitchy
  // "ghost pattern" while the keyboard opened). DIAGNOSED
  // CAUSE: the height lived in React state — every
  // visualViewport resize event during the keyboard's
  // animation (dozens) re-rendered the whole app, and the
  // overlay still swapped its backdrop-blur off at focus,
  // repainting the full screen mid-animation; the panel's
  // translucent surface and 44px glow shadow smeared over
  // the moving background. THE FIX: the keyboard state is a
  // single boolean (two renders per open, not per frame);
  // the overlay's height is written DIRECTLY to its DOM node
  // (rAF-throttled) with no React render at all; the overlay
  // never uses backdrop-blur; and while the keyboard is up
  // the panel is fully opaque with a plain shadow and no
  // entrance animation, so nothing translucent or blurred is
  // repainting during the ride.
  const [searchKbUp, setSearchKbUp] = useState(false);
  const searchInputFocusedRef = useRef(false);
  const searchOverlayRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!searchOpen) {
      setSearchKbUp(false);
      searchInputFocusedRef.current = false;
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const apply = () => {
      const el = searchOverlayRef.current;
      if (!el) return;
      el.style.height = searchInputFocusedRef.current
        ? `${vv.height}px`
        : "";
    };
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    vv.addEventListener("resize", onResize);
    apply();
    return () => {
      vv.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [searchOpen]);
  // Sealed item detail sheet: tapping a sealed product (a Most
  // Valuable Cards row, or its tile on the Sealed shelf) hones in on
  // that exact item's own detail view, like a card — it does NOT jump
  // to the Sealed section (Anthony's correction). Opening pushes one
  // history entry, mirroring the card sheet, so Back closes the sheet
  // and lands right where he was; UI closes go through history.back().
  const [sealedSheetName, setSealedSheetName] = useState<string | null>(
    () => {
      const st = readHistoryState();
      return typeof st?.lorcanaSealed === "string"
        ? st.lorcanaSealed
        : null;
    },
  );
  const sealedSheetPushedRef = useRef(
    typeof readHistoryState()?.lorcanaSealed === "string",
  );
  const openSealedItem = (name: string) => {
    if (sealedSheetName === name) return;
    hapticTick();
    setSealedSheetName(name);
    try {
      if (sealedSheetPushedRef.current) {
        window.history.replaceState({ lorcanaSealed: name }, "");
      } else {
        window.history.pushState({ lorcanaSealed: name }, "");
        sealedSheetPushedRef.current = true;
      }
    } catch {
      sealedSheetPushedRef.current = false;
    }
  };
  const closeSealedSheet = () => {
    if (sealedSheetPushedRef.current) {
      window.history.back();
    } else {
      setSealedSheetName(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (sealedSheetPushedRef.current) {
        sealedSheetPushedRef.current = false;
        setSealedSheetName(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Missing-cards sheet (per section) and the camera scanner: same
  // one-history-entry trap as the other sheets, so Back closes them
  // and lands right where he was.
  const [missingSheetKey, setMissingSheetKey] = useState<string | null>(
    () => {
      const st = readHistoryState();
      return typeof st?.lorcanaMissing === "string"
        ? st.lorcanaMissing
        : null;
    },
  );
  const missingPushedRef = useRef(
    typeof readHistoryState()?.lorcanaMissing === "string",
  );
  const openMissingSheet = (key: string) => {
    if (missingSheetKey === key) return;
    setMissingSheetKey(key);
    try {
      if (missingPushedRef.current) {
        window.history.replaceState({ lorcanaMissing: key }, "");
      } else {
        window.history.pushState({ lorcanaMissing: key }, "");
        missingPushedRef.current = true;
      }
    } catch {
      missingPushedRef.current = false;
    }
  };
  const closeMissingSheet = () => {
    if (missingPushedRef.current) {
      window.history.back();
    } else {
      setMissingSheetKey(null);
    }
  };
  const [scanOpen, setScanOpen] = useState(false);
  const scanPushedRef = useRef(false);
  const openScan = (fromSearch = false) => {
    if (scanOpen) return;
    setScanOpen(true);
    try {
      if (fromSearch && searchPushedRef.current) {
        // Hand the search overlay's history entry to the scanner.
        window.history.replaceState({ lorcanaScan: true }, "");
        searchPushedRef.current = false;
        scanPushedRef.current = true;
      } else if (!scanPushedRef.current) {
        window.history.pushState({ lorcanaScan: true }, "");
        scanPushedRef.current = true;
      }
    } catch {
      scanPushedRef.current = false;
    }
  };
  const closeScan = () => {
    if (scanPushedRef.current) {
      window.history.back();
    } else {
      setScanOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (
        missingPushedRef.current &&
        !(window.history.state as { lorcanaMissing?: string } | null)
          ?.lorcanaMissing
      ) {
        missingPushedRef.current = false;
        setMissingSheetKey(null);
      }
      if (
        scanPushedRef.current &&
        !(window.history.state as { lorcanaScan?: boolean } | null)
          ?.lorcanaScan
      ) {
        scanPushedRef.current = false;
        setScanOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // Finance data is heavy (full-collection scan): don't load it with the
  // binder on first paint. It loads the moment the Finances view opens,
  // or in the background once the browser is idle so the header totals
  // still appear on their own shortly after a cold open.
  const [financeEnabled, setFinanceEnabled] = useState(false);
  useEffect(() => {
    if (financeEnabled) return;
    if (view === "finances") {
      setFinanceEnabled(true);
      return;
    }
    const w = window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setFinanceEnabled(true), {
        timeout: 2500,
      });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setFinanceEnabled(true), 1800);
    return () => window.clearTimeout(t);
  }, [view, financeEnabled]);
  const finance = useQuery({
    queryKey: ["finance"],
    queryFn: () => api.getFinance({}),
    enabled: financeEnabled,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  // Sealed totals feed Home's Collection Distribution card; shares
  // the ["sealed"] query key with the Sealed shelf, so it's one fetch.
  const sealedTotals = useQuery({
    queryKey: ["sealed"],
    queryFn: () => api.getSealed({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  // Seeded from the surviving history entry so a refresh inside
  // a set view reopens THAT set (Anthony's Quest 3 repro: refresh
  // bounced him back to all-sets). Null on a fresh open.
  const [groupKey, setGroupKey] = useState<string | null>(() => {
    const st = readHistoryState();
    return typeof st?.mcBinder === "string" ? st.mcBinder : null;
  });
  // True while a binder section entry ({ mcView: "binder", mcBinder })
  // is the current history entry — kept in sync by pickGroup and the
  // central popstate listener, so the "← All sets" button knows
  // whether it can step back through history (consuming the entry
  // exactly once) or should just flip state locally.
  const binderGroupPushedRef = useRef(
    typeof readHistoryState()?.mcBinder === "string",
  );
  const [filter, setFilter] = useState<"all" | "owned" | "missing">("all");
  // Seeded from a surviving card-sheet entry the same way, so a
  // refresh on an open card reopens that card.
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const st = readHistoryState();
    return typeof st?.lorcanaCard === "number" ? st.lorcanaCard : null;
  });
  const [searchText, setSearchText] = useState("");
  // Set selection starts on the year-grouped tile grid (Shiny-style);
  // tapping a tile drills into that section, "All sets" returns here.
  // When a set view is restored from history, the picker stays shut.
  const [showPicker, setShowPicker] = useState(
    () => typeof readHistoryState()?.mcBinder !== "string",
  );

  const groups = binder.data?.groups ?? [];
  const totals = binder.data?.totals;
  const isEmpty = binder.data != null && groups.length === 0;

  // Seed only when the binder is genuinely empty — never on every load
  // once it's populated. Right after seeding, try the cloud restore:
  // on a fresh device the seeded catalog carries no ownership of the
  // user's own edits, and restoreCollectionFromCloud fills an empty
  // collection from the Supabase backup (it no-ops when there is no
  // backup or nothing to restore).
  useEffect(() => {
    if (
      binder.data != null &&
      binder.data.groups.length === 0 &&
      !seedStarted.current
    ) {
      seedStarted.current = true;
      void (async () => {
        try {
          await api.seedBinder({});
          await api.restoreCollectionFromCloud({}).catch(() => null);
        } finally {
          void queryClient.invalidateQueries({ queryKey: ["binder"] });
          void queryClient.invalidateQueries({ queryKey: ["finance"] });
        }
      })();
    }
  }, [binder.data, seed]);

  useEffect(() => {
    if (groups.length === 0) return;
    if (groupKey == null) {
      setGroupKey(
        groups.find((g) => g.key === "set:1")?.key ?? groups[0]?.key ?? null,
      );
    } else if (!groups.some((g) => g.key === groupKey)) {
      // A restored set key that no longer exists (stale entry):
      // fall back to the set-selection grid rather than a void.
      setGroupKey(
        groups.find((g) => g.key === "set:1")?.key ?? groups[0]?.key ?? null,
      );
      setShowPicker(true);
      binderGroupPushedRef.current = false;
    }
  }, [groups, groupKey]);

  const group: Group | undefined = groups.find((g) => g.key === groupKey);
  const sectionData = useQuery({
    queryKey: ["section", groupKey, filter],
    queryFn: () =>
      api.getSection({ groupKey: groupKey ?? "", filter }),
    enabled: groupKey != null,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // The set's Puzzle section (Anthony, Nov 3, 2026): the
  // puzzle/lore insert cards live in their own binder group
  // (puzzle:<set>) and render as a section INSIDE the set's
  // page, after its cards — every piece its own pocket,
  // ghosted when missing, plus the Full Puzzle Art item.
  const puzzleGroupKey =
    group?.kind === "set" ? `puzzle:${group.key.slice(4)}` : null;
  const puzzleData = useQuery({
    queryKey: ["section", puzzleGroupKey, filter],
    queryFn: () =>
      api.getSection({ groupKey: puzzleGroupKey ?? "", filter }),
    enabled: puzzleGroupKey != null && !showPicker,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Progressive pocket rendering: paint the first chunk of the section
  // immediately and grow it as the reader scrolls, so a 420-pocket
  // section never blocks first paint. Section data itself loads on
  // demand for the current section only, and pocket art lazy-loads (and
  // is cached on-device) as pockets near the viewport.
  const POCKET_CHUNK = 160;
  const [visibleCount, setVisibleCount] = useState(POCKET_CHUNK);
  useEffect(() => {
    setVisibleCount(POCKET_CHUNK);
  }, [groupKey, filter]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => c + POCKET_CHUNK);
        }
      },
      { rootMargin: "1400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, filter, sectionData.data]);

  const search = useQuery({
    queryKey: ["search", searchText.trim()],
    queryFn: () => api.searchCards({ query: searchText.trim() }),
    enabled: searchText.trim().length >= 2,
  });

  const pickGroup = (key: string) => {
    setShowPicker(false);
    setGroupKey(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Drilling into a section is a navigation step too: push one
    // history entry, so Back returns to the set-selection grid
    // instead of leaving the app.
    try {
      window.history.pushState({ mcView: "binder", mcBinder: key }, "");
      binderGroupPushedRef.current = true;
    } catch {
      binderGroupPushedRef.current = false;
    }
  };

  // Section navigation for the bottom bar and Home's entries: flip
  // the view AND push its history entry (see the note at the view
  // state above). Switching to Binders while a section is open
  // carries that section in the entry, so the entry always matches
  // what's on screen.
  const navigate = (next: MainView) => {
    // Leaving Search via the bottom menu (Anthony, Nov 2, 2026):
    // the menu floats above the search blur, so tapping any tab —
    // including the one for the view already underneath — closes
    // the overlay and lands on that tab. The overlay's pushed
    // history entry is handed to the destination (replaceState
    // instead of a push) so Back never lands on a dead search
    // entry afterwards.
    if (next === view) {
      if (searchOpen) {
        // Leaving Search back to the very view underneath it:
        // slide in the direction of travel (Search is stop 1),
        // then close — closeSearch sees the fresh animation
        // stamp and doesn't override it with its plain fade.
        const toIdx = tabIndexForView(next);
        if (toIdx !== 1) triggerPageAnim(toIdx > 1 ? "next" : "prev");
        closeSearch();
      }
      return;
    }
    // Soft directional slide for the incoming page (see the
    // pageAnim note above): direction from the bottom bar's
    // order, Search counting as its own stop when it is open.
    {
      const fromIdx = searchOpen ? 1 : tabIndexForView(view);
      const toIdx = tabIndexForView(next);
      if (toIdx !== fromIdx) {
        triggerPageAnim(toIdx > fromIdx ? "next" : "prev");
      }
    }
    hapticTick();
    const handOffSearch = searchOpen && searchPushedRef.current;
    if (searchOpen) {
      setSearchOpen(false);
      searchPushedRef.current = false;
    }
    setView(next);
    try {
      if (next === "binder" && !showPicker && groupKey) {
        if (handOffSearch) {
          window.history.replaceState(
            { mcView: "binder", mcBinder: groupKey },
            "",
          );
        } else {
          window.history.pushState(
            { mcView: "binder", mcBinder: groupKey },
            "",
          );
        }
        binderGroupPushedRef.current = true;
      } else if (handOffSearch) {
        window.history.replaceState({ mcView: next }, "");
      } else {
        window.history.pushState({ mcView: next }, "");
      }
    } catch {
      // History unavailable: the view still switched.
    }
  };

  // Opening a binder from a profile's Library page (Anthony,
  // Nov 3, 2026): land in the binder on that exact section —
  // switching views unmounts the profile/Library overlays
  // stacked above Home. The "comics" entry opens the Comics
  // section instead.
  const openBinderGroup = (key: string) => {
    if (key === "comics") {
      navigate("comics");
      return;
    }
    navigate("binder");
    pickGroup(key);
  };

  // Home's Marketplace doorway: land in Social with the
  // Marketplace area already selected (SocialPanel's history sync
  // reads socialArea from the entry on mount).
  const openMarketplace = () => {
    hapticTick();
    setView("social");
    try {
      window.history.pushState(
        { mcView: "social", socialArea: "market" },
        "",
      );
    } catch {
      // History unavailable: Social opens on its default area.
    }
  };

  // Central popstate listener for section navigation: when Back
  // lands on an entry carrying mcView, restore the section (and, for
  // the binder, the set-selection grid vs. the open section) from
  // that entry. Entries without mcView belong to the overlays and
  // sheets, whose own popstate traps handle them — ignore those pops
  // here so the two systems never fight.
  useEffect(() => {
    const onPopState = () => {
      const st = window.history.state as {
        mcView?: string;
        mcBinder?: string;
      } | null;
      if (!st || typeof st.mcView !== "string") return;
      if (MAIN_VIEWS.includes(st.mcView as MainView)) {
        setView(st.mcView as MainView);
      }
      if (st.mcView === "binder") {
        if (typeof st.mcBinder === "string") {
          binderGroupPushedRef.current = true;
          setGroupKey(st.mcBinder);
          setShowPicker(false);
        } else {
          binderGroupPushedRef.current = false;
          setShowPicker(true);
        }
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Bottom-nav Search tab: opens the floating search overlay over
  // whatever view he's on (Anthony reversed the embedded binder
  // search bar — it no longer lives in the binder view, and searching
  // must not snap back to the binder list). The overlay focuses its
  // field on open; closing it returns to the same view, untouched.
  //
  // Opening the overlay pushes one history entry, the same trap the
  // card sheet uses: the device/browser Back button (or back gesture)
  // then closes the overlay and lands back on the view underneath
  // (Home, if that's where he was) instead of exiting the app.
  // Closing from the UI (backdrop, ✕, Escape) goes through
  // history.back() so the pushed entry is consumed exactly once.
  const searchPushedRef = useRef(false);
  const goSearch = () => {
    // The Search tab stays reachable above the blur while the
    // overlay is open (see the nav's z-index below); tapping it
    // again closes the overlay instead of stacking another entry.
    if (searchOpen) {
      closeSearch();
      return;
    }
    hapticTick();
    // The Search screen slides in from the direction of
    // travel: from the right when it is ahead of the current
    // tab in the bar's order (Home → Search), from the left
    // when it is behind it (Portfolio → Search).
    setSearchAnimDir(tabIndexForView(view) < 1 ? "next" : "prev");
    setSearchOpen(true);
    try {
      window.history.pushState({ lorcanaSearch: true }, "");
      searchPushedRef.current = true;
    } catch {
      // History unavailable (e.g. sandboxed frame): the overlay still
      // opens and closes via its own controls.
      searchPushedRef.current = false;
    }
  };
  const closeSearch = () => {
    // Returning from Search has no direction of travel, so the
    // view underneath fades back in softly instead of snapping
    // (unless a directional animation was just triggered for
    // this same move — e.g. navigate() handing off to a tab —
    // in which case that slide wins).
    if (Date.now() - pageAnimAtRef.current > 150) {
      triggerPageAnim("fade");
    }
    if (searchPushedRef.current) {
      window.history.back();
    } else {
      setSearchOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (
        searchPushedRef.current &&
        !(window.history.state as { lorcanaSearch?: boolean } | null)
          ?.lorcanaSearch
      ) {
        searchPushedRef.current = false;
        setSearchOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // NO auto-focus on open (Anthony, Nov 3, 2026): entering
  // Search must not pop the keyboard up — the field stays
  // unfocused until he taps it himself, and only then does
  // the keyboard open. (An earlier version focused the field
  // 60ms after opening, which forced the keyboard up every
  // time the Search tab was entered.)

  // Tapping a result closes the overlay and opens that card right
  // where he is — no jump to the binder list first. The overlay's
  // history entry is handed to the card sheet (openCard replaceStates
  // it into the card's entry), so Back from the card lands on the
  // view underneath exactly as if the card had been opened directly.
  const pickSearchResult = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchText("");
    if (searchPushedRef.current) {
      searchPushedRef.current = false;
      sheetPushedRef.current = true;
    }
    openCard(result.cardId);
  };

  // Card detail + browser history: opening a card pushes one history
  // entry, so the device/browser Back button (or back gesture) closes
  // the detail and lands back on the binder exactly where it was — the
  // page behind the overlay never unmounts, so section, filter, and
  // scroll position are all preserved. Closing from the UI (Back/Close
  // buttons, backdrop tap, after saving) goes through history.back() so
  // the pushed entry is always consumed exactly once and entries never
  // stack up across repeated open/close cycles.
  const sheetPushedRef = useRef(
    typeof readHistoryState()?.lorcanaCard === "number",
  );
  const openCard = (id: number) => {
    if (selectedId === id) return;
    hapticTick();
    setSelectedId(id);
    try {
      if (sheetPushedRef.current) {
        window.history.replaceState({ lorcanaCard: id }, "");
      } else {
        window.history.pushState({ lorcanaCard: id }, "");
        sheetPushedRef.current = true;
      }
    } catch {
      // History unavailable (e.g. sandboxed frame): the sheet still
      // opens and closes via its own buttons.
      sheetPushedRef.current = false;
    }
  };
  const closeCard = () => {
    if (sheetPushedRef.current) {
      window.history.back();
    } else {
      setSelectedId(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (sheetPushedRef.current) {
        sheetPushedRef.current = false;
        setSelectedId(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Swipe between bottom-bar tabs (Anthony, Nov 3, 2026, ~3:06 AM):
  // on the main tab screens, a clear sideways swipe moves to the
  // neighbouring tab in the bottom bar's own order — Home, Search,
  // Sealed (or Comics/Lego inside those sections), Social,
  // Portfolio, Settings — so from Home one swipe left lands on
  // Search without reaching down for the bar. Search counts as
  // the stop it is on the bar: swiping right out of it closes the
  // overlay back to the view underneath, swiping left out of it
  // moves on to the next tab. The gesture has to be unmistakably
  // horizontal (at least 64px sideways and clearly wider than it
  // is tall), so ordinary vertical scrolling, pull-to-refresh, and
  // diagonal scrolls never trigger it. It never fires while a
  // sheet, overlay, or window is open (card/sealed/missing sheets,
  // scanner, Inbox, mail view, tickets, update view, welcome), on
  // form fields, or inside a sideways-scrolling strip (chip rows
  // and the like keep their own sideways scroll). The binder view
  // is not itself a bottom-bar tab — it sits in Home's slot, so a
  // swipe left there opens Search like it does from Home.
  type SwipeTabKey =
    | "home"
    | "search"
    | "third"
    | "social"
    | "finances"
    | "settings";
  const SWIPE_TAB_ORDER: SwipeTabKey[] = [
    "home",
    "search",
    "third",
    "social",
    "finances",
    "settings",
  ];
  const swipeBlocked = () =>
    selectedId != null ||
    sealedSheetName != null ||
    missingSheetKey != null ||
    scanOpen ||
    inboxOpen ||
    mailView != null ||
    ticketsOpen ||
    updateViewMode != null ||
    welcomeOwed ||
    welcomeReviewOpen;
  const currentSwipeTab = (): SwipeTabKey => {
    if (searchOpen) return "search";
    switch (view) {
      case "sealed":
      case "comics":
      case "lego":
        return "third";
      case "social":
        return "social";
      case "finances":
        return "finances";
      case "settings":
        return "settings";
      default:
        // "home" and "binder" both sit in Home's slot.
        return "home";
    }
  };
  // Animated page transitions (Anthony, Nov 3, 2026, ~3:13 AM;
  // reworked ~10:03 AM): a swipe doesn't cut — and neither does
  // a tap anymore. The animation state itself (pageAnim) lives
  // up by the search state; navigate(), goSearch(), and
  // closeSearch() trigger it with the direction of travel, so
  // this handler only has to route to the right tab. The one
  // case none of those cover — swiping out of Search onto the
  // Comics/Lego tab the user is already standing in, which is
  // just closing Search onto the same view — triggers its
  // slide here (Search is stop 1, that tab is stop 2: next).
  const goSwipeTab = (tab: SwipeTabKey) => {
    switch (tab) {
      case "home":
        navigate("home");
        break;
      case "search":
        goSearch();
        break;
      case "third":
        if (view === "comics" || view === "lego") {
          // Already standing in that tab — the only way a swipe
          // lands here is out of the Search overlay above it.
          if (searchOpen) {
            triggerPageAnim("next");
            closeSearch();
          }
        } else {
          navigate("sealed");
        }
        break;
      case "social":
        navigate("social");
        break;
      case "finances":
        navigate("finances");
        break;
      case "settings":
        navigate("settings");
        break;
    }
  };
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    blocked: boolean;
  } | null>(null);
  const onTabSwipeStart = (e: ReactTouchEvent) => {
    if (e.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    let blocked = swipeBlocked();
    const target = e.target as HTMLElement | null;
    if (
      !blocked &&
      target &&
      typeof target.closest === "function" &&
      target.closest(
        "input, textarea, select, [contenteditable='true']",
      )
    ) {
      blocked = true;
    }
    if (!blocked && target) {
      // A sideways-scrolling strip under the finger keeps its
      // own gesture — the swipe belongs to it, not the tab bar.
      let el: HTMLElement | null = target;
      while (el && el !== e.currentTarget) {
        if (el.scrollWidth > el.clientWidth + 4) {
          const ox = window.getComputedStyle(el).overflowX;
          if (ox === "auto" || ox === "scroll") {
            blocked = true;
            break;
          }
        }
        el = el.parentElement;
      }
    }
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      blocked,
    };
  };
  const onTabSwipeEnd = (e: ReactTouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.blocked || swipeBlocked()) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const idx = SWIPE_TAB_ORDER.indexOf(currentSwipeTab());
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= SWIPE_TAB_ORDER.length) return;
    const tab = SWIPE_TAB_ORDER[nextIdx];
    if (tab) goSwipeTab(tab);
  };
  const onTabSwipeCancel = () => {
    swipeStartRef.current = null;
  };

  return (
    <div
      className="app-shell min-h-screen"
      onTouchStart={onTabSwipeStart}
      onTouchEnd={onTabSwipeEnd}
      onTouchCancel={onTabSwipeCancel}
    >
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main
        className={`mx-auto w-full max-w-3xl px-3 pb-28 sm:px-4 ${
          pageAnim
            ? pageAnim.dir === "next"
              ? "tab-slide-next"
              : pageAnim.dir === "prev"
                ? "tab-slide-prev"
                : "tab-fade"
            : ""
        }`}
        onAnimationEnd={(e) => {
          // Only the main element's own slide ending clears the
          // class — animations inside panels bubble up too.
          if (e.target === e.currentTarget) setPageAnim(null);
        }}
      >
        {/* The pockets-filled collection header USED to render
            here on the binder view — Anthony directed the whole
            metric deleted from everywhere in the app (Nov 3,
            2026: "delete that whole metric... from everywhere";
            it had already come off Settings, Portfolio, Sealed,
            and Home the day before). What remains in this spot
            is only the binder's loading and error surface, which
            is not the metric. If he wants the metric back, it
            comes back as a new block — nothing of it renders
            now. */}
        {view === "binder" ? (
        <section aria-label="Binder status" className="pt-4">
          {totals && totals.slots > 0 ? null : (
            <p className="font-album text-lg text-[var(--text)]">
              {binder.isPending || seed.isPending
                ? "Assembling your binder — cataloguing every set, promo, and quest card…"
                : "Your binder"}
            </p>
          )}
          {binder.isError ? (
            <div className="mt-2">
              <p className="text-sm text-red-400">
                The binder couldn't load.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void binder.refetch()}
                >
                  Try again
                </button>
              </p>
              <p className="mt-0.5 text-xs text-[var(--dim)]">
                {binder.error instanceof Error
                  ? binder.error.message
                  : String(binder.error)}
              </p>
            </div>
          ) : null}
          {isEmpty && seed.isError ? (
            <p className="mt-2 text-sm text-red-400">
              Seeding failed.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => seed.mutate()}
              >
                Retry
              </button>
            </p>
          ) : null}
        </section>
        ) : null}

        {view === "home" ? (
          <HomePanel
            value={finance.data ? finance.data.value : null}
            sealedValue={sealedTotals.data ? sealedTotals.data.totals.value : null}
            onOpenBinder={() => navigate("binder")}
            onOpenComics={() => navigate("comics")}
            onOpenLego={() => navigate("lego")}
            onOpenCard={(id) => openCard(id)}
            onOpenSealed={(name) => openSealedItem(name)}
            onOpenBinderGroup={openBinderGroup}
            onOpenMarketplace={openMarketplace}
            updateAvailable={availableUpdate != null}
            onOpenUpdate={() => openUpdateView("real")}
            onOpenUpdateTest={() => openUpdateView("test")}
            onOpenChangeRequests={openTicketsWindow}
            onOpenOrderMail={openInbox}
          />
        ) : view === "comics" ? (
          <ComicsPanel />
        ) : view === "lego" ? (
          <LegoPanel />
        ) : view === "sealed" ? (
          <SealedPanel onOpen={openSealedItem} />
        ) : view === "social" ? (
          <SocialPanel
            onOpenCard={openCard}
            pendingArea={pendingSocialArea}
            onConsumePendingArea={() => setPendingSocialArea(null)}
            focusDeal={focusDeal}
          />
        ) : view === "settings" ? (
          <SettingsPanel
            theme={theme}
            onThemeChange={changeTheme}
            onShowWelcome={() => setWelcomeReviewOpen(true)}
          />
        ) : view === "finances" ? (
          finance.isPending ? (
            <p className="py-14 text-center text-sm text-[var(--dim)]">
              Adding up your collection…
            </p>
          ) : finance.data ? (
            <FinancePanel
              finance={finance.data}
              onOpenCard={openCard}
              onOpenSealed={openSealedItem}
            />
          ) : (
            <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-red-400">
              Card Performance couldn't load.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void finance.refetch()}
              >
                Try again
              </button>
            </p>
          )
        ) : (
          <>
        {/* No search bar in the binder view anymore — search lives
            in the floating overlay under the bottom Search tab. */}

        {/* Camera scanning entry point for the binder view. */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => openScan()}
            className="flex items-center gap-2 rounded-full border border-[var(--accent)]/60 px-3.5 py-1.5 text-sm font-semibold text-[var(--gold-soft)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4.5 w-4.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M4 8h2.2l1.6-2.4A1 1 0 0 1 8.6 5h6.8a1 1 0 0 1 .8.6L17.8 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
              <circle cx="12" cy="13.5" r="3.4" />
            </svg>
            Scan a card
          </button>
        </div>

        {/* Set selection — year-grouped tiles with progress bars,
            matching the Shiny set screen (Anthony's reference photo).
            Tapping a tile opens that section, like the dropdown did. */}
        {groups.length > 0 && showPicker ? (
          <SetPicker
            groups={groups}
            currentKey={groupKey}
            onPick={pickGroup}
          />
        ) : null}

        {/* Back to the set-selection grid while viewing one section */}
        {groups.length > 0 && !showPicker ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                // Step back through history when the section was
                // opened with a push (the popstate listener restores
                // the grid); otherwise just flip state locally.
                if (binderGroupPushedRef.current) {
                  window.history.back();
                } else {
                  setShowPicker(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              aria-label="Back to set selection"
              className="rounded-full border border-[var(--accent)]/50 px-3.5 py-1.5 text-sm font-medium text-[var(--gold-soft)]"
            >
              ← All sets
            </button>
          </div>
        ) : null}

        {/* Section heading + filter */}
        {!showPicker && group ? (
          <section aria-label={group.name} className="mt-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
                  {group.name}
                </h1>
                <p className="text-sm text-[var(--dim)]">
                  {sectionData.data
                    ? `Showing ${sectionData.data.total} — scroll to see them all`
                    : ""}
                </p>
              </div>
              <div
                className="flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
                role="group"
                aria-label="Filter pockets"
              >
                {(
                  [
                    ["all", "All"],
                    ["owned", "Owned"],
                    ["missing", "Missing"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={`rounded-full px-3.5 py-1.5 text-sm ${
                      filter === value
                        ? "bg-[var(--gold)] font-bold text-black"
                        : "text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* The sealed Quest box, surfaced on its own set's
                page (Anthony, Nov 3, 2026: he came to the Quest
                3 page looking for the option to say he owns an
                unopened box and it wasn't there). Every Quest
                set page carries its box as a selectable sealed
                item — tapping opens the sealed item itself,
                where the Owned steppers live. */}
            {group.kind === "quest"
              ? (() => {
                  const boxName = (
                    {
                      "quest:Q1": "Illumineer's Quest: Deep Trouble",
                      "quest:Q2": "Illumineer's Quest: Palace Heist",
                      "quest:Q3":
                        "Illumineer's Quest: The Great Hunny Rescue",
                    } as Record<string, string>
                  )[group.key];
                  const box = boxName
                    ? (sealedTotals.data?.items ?? []).find(
                        (i) => i.name === boxName,
                      )
                    : undefined;
                  if (!boxName || !box) return null;
                  const photo = SEALED_PHOTOS[boxName];
                  return (
                    <button
                      type="button"
                      onClick={() => openSealedItem(boxName)}
                      aria-label={`${boxName} — sealed box. Owned ${box.qty}. Tap to open the sealed item and set how many unopened boxes you own.`}
                      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left"
                    >
                      {photo ? (
                        <span className="acrylic-case block h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                          <img
                            src={photo}
                            alt=""
                            className="h-full w-full object-contain p-1"
                          />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
                          Sealed box
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--text)]">
                          {boxName}
                        </span>
                        <span className="block text-xs text-[var(--dim)]">
                          Owned ×{box.qty} · {fmtUSD(box.unitValue)} each
                          — tap to open and add your unopened box
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-lg text-[var(--dim)]"
                      >
                        →
                      </span>
                    </button>
                  );
                })()
              : null}

            {/* Cost to complete the COMPLETE set (every printing and
                finish, Enchanteds and Iconics included), with the
                door to the missing list + buy handoff. */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
              {group.missingPockets > 0 ? (
                <>
                  <p className="text-sm text-[var(--text)]">
                    Cost to complete{" "}
                    <span className="font-bold text-[var(--gold-soft)]">
                      {fmtUSD(group.costToComplete)}
                    </span>
                    <span className="text-[var(--dim)]">
                      {" "}
                      · {group.missingPockets} missing
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => openMissingSheet(group.key)}
                    className="rounded-full border border-[var(--accent)]/60 px-3 py-1.5 text-sm font-semibold text-[var(--gold-soft)]"
                  >
                    Missing cards &amp; buy list
                  </button>
                </>
              ) : (
                <p className="text-sm font-semibold text-emerald-400">
                  This set is complete — every pocket filled.
                </p>
              )}
            </div>

            {/* One continuous binder: 4 across, all the way down */}
            {sectionData.isPending ? (
              <p className="py-14 text-center text-sm text-[var(--dim)]">
                Opening the binder…
              </p>
            ) : sectionData.data && sectionData.data.cards.length > 0 ? (
              <>
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 sm:gap-3 sm:p-4">
                  {sectionData.data.cards
                    .slice(0, visibleCount)
                    .map((card) => (
                      <Pocket
                        key={`${card.id}:${card.pocket}`}
                        card={card}
                        onOpen={openCard}
                      />
                    ))}
                </div>
                <div ref={sentinelRef} aria-hidden="true" />
                <p className="mt-4 text-center font-album text-sm text-[var(--dim)]">
                  {visibleCount >= sectionData.data.total
                    ? `End of ${group.name} — ${sectionData.data.total} pockets`
                    : `Showing ${Math.min(visibleCount, sectionData.data.total)} of ${sectionData.data.total} pockets — keep scrolling to load the rest`}
                </p>
              </>
            ) : sectionData.isError ? (
              <p className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-red-400">
                This section couldn't load.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void sectionData.refetch()}
                >
                  Try again
                </button>
              </p>
            ) : (
              <p className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--dim)]">
                {filter === "owned"
                  ? "No owned cards in this section yet."
                  : filter === "missing"
                    ? "Nothing missing here — this section is complete."
                    : "This section has no cards."}
              </p>
            )}

            {/* The set's Puzzle section (Anthony, Nov 3,
                2026): the puzzle/lore insert cards — one in
                every booster pack — as their own pockets at
                the end of the set's items, each piece numbered
                (2/4 style), ghosted when not owned, with the
                assembled Full Puzzle Art as its own item. */}
            {puzzleData.data && puzzleData.data.cards.length > 0 ? (
              <div className="mt-6">
                <h2 className="font-album text-lg text-[var(--text)]">
                  Puzzle
                </h2>
                <p className="text-sm text-[var(--dim)]">
                  One insert in every booster pack — collect
                  all the pieces to assemble the full artwork.
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 sm:gap-3 sm:p-4">
                  {puzzleData.data.cards.map((card) => (
                    <Pocket
                      key={`${card.id}:${card.pocket}`}
                      card={card}
                      onOpen={openCard}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* This set's sealed products, at the very bottom
                of the set's page (Anthony, Nov 3, 2026): the
                cards come first, and the set's unopened boxes —
                booster box, prerelease box, Trove, packs, gift
                set, starter decks — sit together after the last
                card. Owned ones render normally; the ones not in
                the vault yet are ghosted like missing cards.
                Tapping any of them opens the sealed item, where
                the Owned steppers live. */}
            {group.kind === "set"
              ? (() => {
                  const setSealed = (
                    sealedTotals.data?.items ?? []
                  ).filter(
                    (i) =>
                      i.setName.toLowerCase() ===
                      group.name.toLowerCase(),
                  );
                  if (setSealed.length === 0) return null;
                  return (
                    <div className="mt-6">
                      <h2 className="font-album text-lg text-[var(--text)]">
                        Sealed {group.name}
                      </h2>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
                        This set&rsquo;s unopened products — the
                        ones faded like ghost cards aren&rsquo;t in
                        your vault yet. Tap one to open it and add
                        your copy.
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                        {setSealed.map((item) => {
                          const photo =
                            SEALED_PHOTOS[item.name] ??
                            sealedBoosterFront;
                          const ghosted = item.qty <= 0;
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() =>
                                openSealedItem(item.name)
                              }
                              aria-label={`${item.name} — sealed product. ${
                                ghosted
                                  ? "Not in your vault yet"
                                  : `Owned ${item.qty}`
                              }. Tap to open the sealed item.`}
                              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left"
                            >
                              {SEALED_IN_CASE.has(item.name) ? (
                                <span className="block aspect-square bg-[var(--bg)]">
                                  <img
                                    src={photo}
                                    alt=""
                                    className={`h-full w-full object-cover ${ghosted ? "ghost-img" : ""}`}
                                  />
                                </span>
                              ) : (
                                <span className="acrylic-case block">
                                  <img
                                    src={photo}
                                    alt=""
                                    className={`h-full w-full object-contain px-1.5 pb-5 pt-1.5 ${ghosted ? "ghost-img" : ""}`}
                                  />
                                  <span
                                    className="acrylic-stand"
                                    aria-hidden="true"
                                  />
                                </span>
                              )}
                              <span className="block px-2 py-2">
                                <span className="block text-xs font-semibold leading-snug text-[var(--text)]">
                                  {item.name.replace(
                                    /^Disney Lorcana: /,
                                    "",
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-[var(--dim)]">
                                  {ghosted
                                    ? `${fmtUSD(item.unitValue)} each · not in your vault yet`
                                    : `Owned ×${item.qty} · ${fmtUSD(item.unitValue)} each`}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              : null}
          </section>
        ) : null}
          </>
        )}

        <footer
          className={
            view === "social" || view === "comics" || view === "lego"
              ? "hidden"
              : "mt-8"
          }
        >
          {/* The two-pockets note in a bordered hideable
              window (Anthony, Nov 3, 2026, ~1:52 AM) — same
              treatment as the Sealed/Social intros; the
              wording is unchanged. */}
          <HideableIntroWindow
            title={
              <h2 className="font-album text-lg text-[var(--text)]">
                Two pockets for every card number
              </h2>
            }
            hidden={homeIntro.hidden}
            onToggle={homeIntro.toggle}
          >
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
              Each card number sits in two pockets — regular first, foil right
              next to it — like your physical binders, and each pocket is owned
              or ghosted on its own. Ownership comes from your Shiny export of
              Nov 1, 2026. Cards from
              orders that arrived after that export won&rsquo;t show as owned until you
              tap the card and update its count. Unnumbered Ink Drop tokens,
              Floodborn puzzle pieces, and sealed products aren&rsquo;t binder cards,
              so they aren&rsquo;t pocketed here.
            </p>
          </HideableIntroWindow>
        </footer>
      </main>

      {/* The dedicated update view (Anthony, Nov 3, 2026):
          opens on its own — never routed through Settings —
          with the changelog and the choice: Update, or Don't
          update at this time. In TEST mode it's the dress
          rehearsal of the same view: choosing Update walks the
          simulated apply; either choice is the rehearsal's last
          step and ends the one-time test. The Back control (and
          the phone's back gesture) leaves without deciding —
          and leaves the test armed. */}
      {/* The tickets window (Anthony, Nov 3, 2026): the red
          envelope's own page — the ticket list and detail, with
          a Back control (and the phone's back gesture) to leave.
          It is NOT Settings and never scrolls Settings. */}
      {inboxOpen ? (
        <div
          className="app-shell fixed inset-0 z-[90] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Your Inbox"
        >
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  closeInboxWindow();
                }}
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
              >
                ←
              </button>
              <h2 className="font-album text-xl text-[var(--text)]">
                Inbox
              </h2>
            </div>
            <InboxList
              onOpenOrder={openInboxOrder}
              onOpenTicket={openInboxTicket}
            />
          </div>
        </div>
      ) : null}
      {mailView ? (
        <MailMessageView
          kind={mailView.kind}
          id={mailView.id}
          nonce={mailView.nonce}
          onClose={closeMailView}
          onOpenCard={openCard}
        />
      ) : null}
      {welcomeOwed || welcomeReviewOpen ? (
        <WelcomeFlow
          review={!welcomeOwed}
          onClose={() => setWelcomeReviewOpen(false)}
        />
      ) : null}
      {ticketsOpen ? (
        <div
          className="app-shell fixed inset-0 z-[90] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Change request tickets"
        >
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  closeTicketsWindow();
                }}
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
              >
                ←
              </button>
              <h2 className="font-album text-xl text-[var(--text)]">
                Tickets
              </h2>
            </div>
            <TicketsInbox focusTicketId={ticketFocusId} />
          </div>
        </div>
      ) : null}
      {updateViewMode != null ? (
        <div
          className="app-shell fixed inset-0 z-[90] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="App updates"
        >
          <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticTick();
                  closeUpdateView();
                }}
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
              >
                ←
              </button>
              <h2 className="font-album text-xl text-[var(--text)]">
                App updates
              </h2>
              {updateViewMode === "test" ? (
                <span className="rounded-full border border-[#ffd21f]/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#ffd21f]">
                  Test
                </span>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-[#ffd21f]/60 bg-[#ffd21f]/10 p-4">
              <p className="text-base font-bold text-[var(--text)]">
                Update available — Version{" "}
                {updateViewMode === "test"
                  ? APP_VERSION
                  : (availableUpdate?.version ?? APP_VERSION)}
              </p>
              {updateViewMode === "test" ? (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  This is the one-time test of the update flow —
                  this App updates view on its own, the same one
                  another collector gets. Read the changelog, then
                  choose at the bottom: Update now walks through
                  applying it, and Update at a later time closes
                  it, exactly as it would for them. Either choice
                  is the last step and ends the test; backing out
                  leaves the test for next time. Your own copy is
                  already current, so the applying step here is a
                  rehearsal.
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  A newer version of Vault X is ready. Read
                  what&rsquo;s new, then choose — updating is
                  always your tap, never automatic.
                </p>
              )}
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">
                What&rsquo;s new:
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[var(--dim)]">
                {(updateViewMode === "test"
                  ? (CHANGELOG[APP_VERSION] ?? [])
                  : (availableUpdate?.notes ?? [])
                ).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {updateViewMode === "test" &&
              updateTestPhase === "applying" ? (
                <p
                  className="mt-4 text-sm font-semibold text-[var(--text)]"
                  role="status"
                >
                  Fetching the update… applying it… (rehearsal)
                </p>
              ) : updateViewMode === "test" &&
                updateTestPhase === "done" ? (
                <div className="mt-4" role="status">
                  <p className="text-sm font-semibold text-emerald-400">
                    You&rsquo;re up to date — that&rsquo;s the
                    whole flow a collector goes through.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticConfirm();
                      if (updateViewMode === "test") {
                        setUpdateTestPhase("applying");
                        window.setTimeout(
                          () => setUpdateTestPhase("done"),
                          1400,
                        );
                        // Choosing Update now IS the end of the
                        // walkthrough (Anthony, Nov 3, 2026: the
                        // two choice buttons replace the old
                        // "Finish the test" step) — once the
                        // rehearsal apply lands, the test is
                        // complete and the view closes.
                        window.setTimeout(
                          () => completeTestAndClose(),
                          3200,
                        );
                      } else {
                        void primeCacheAndReload();
                      }
                    }}
                    className="w-full rounded-full bg-[#ffd21f] px-4 py-3 text-sm font-black text-[#4a3200]"
                  >
                    Update now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTick();
                      if (updateViewMode === "test") {
                        completeTestAndClose();
                      } else {
                        closeUpdateView();
                      }
                    }}
                    className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--text)]"
                  >
                    Update at a later time
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ScrollArrows />

      {/* Fixed bottom navigation — Home / Search / Sealed / Social /
          Portfolio / Settings (plus a Comics or Lego tab inside
          those sections). Like the tab bar in Anthony's Shiny
          screenshot (9044_4_f3it.jpg): a floating, inset, fully
          rounded bar, and the selected tab's highlight pill wraps
          its icon and label together. There is NO Binders tab
          anywhere (Anthony's direction, Nov 2, 2026, extended the
          same evening after he still saw it inside My
          Collectibles): a binder is entered only by tapping its
          collection tile on Home (Lorcana, Pokémon, Star Wars…),
          which lands directly in the binder view. Sealed belongs to
          the card collections, so inside the Comics and Lego
          sections it is replaced by a single tab for that
          collection. Settings is in every variant: it's global,
          reachable from anywhere. */}
      {/* While Search is open, the bar rises above the search
          overlay's blur (z-50) so it stays sharp, untinted, and
          tappable — nobody gets trapped in Search by mistake
          (Anthony, Nov 2, 2026). Otherwise it keeps its normal
          layer under the sheets and overlays. */}
      <nav
        aria-label="Main navigation"
        className={`pointer-events-none fixed inset-x-0 bottom-0 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] ${
          searchOpen ? "z-[60]" : "z-40"
        }`}
      >
        <div
          className="pointer-events-auto mx-auto grid w-full max-w-3xl grid-cols-6 rounded-[26px] border border-[var(--border)] bg-[var(--surface)]/95 px-1.5 py-1.5 shadow-[0_10px_36px_rgba(0,0,0,0.6)] backdrop-blur"
        >
          {(
            [
              {
                key: "home",
                label: "Home",
                // While Search is open, Search owns the highlight —
                // the tab underneath never lights up alongside it
                // (Anthony, Nov 2, 2026: closing the on-screen
                // keyboard left Home lit while he was still in
                // Search). The highlight is derived only from the
                // current view + searchOpen; no blur/resize/focus
                // event ever touches it.
                active: view === "home" && !searchOpen,
                onClick: () => navigate("home"),
                icon: (
                  <>
                    <path d="m4 11 8-7 8 7" />
                    <path d="M6 9.5V20h12V9.5" />
                    <path d="M10 20v-5h4v5" />
                  </>
                ),
              },
              {
                key: "search",
                label: "Search",
                active: searchOpen,
                onClick: goSearch,
                icon: (
                  <>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.8-3.8" />
                  </>
                ),
              },
              ...(view === "comics" || view === "lego"
                ? [
                    {
                      key: view,
                      label: view === "comics" ? "Comics" : "Lego",
                      active: !searchOpen,
                      onClick: () =>
                        window.scrollTo({ top: 0, behavior: "smooth" }),
                      icon:
                        view === "comics" ? (
                          <>
                            <rect x="5" y="3" width="14" height="18" rx="2" />
                            <path d="M8.5 7.5h7" />
                            <path d="M8.5 11h7" />
                            <path d="M8.5 14.5h4.5" />
                          </>
                        ) : (
                          <>
                            <rect x="4" y="9" width="16" height="9" rx="1.5" />
                            <path d="M7 9V6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5V9" />
                            <path d="M8.5 13h.01M12 13h.01M15.5 13h.01" />
                          </>
                        ),
                    },
                  ]
                : view === "home"
                  ? [
                      // Home (the main screen): no Binders tab —
                      // binders are entered through the collection
                      // tiles above. Sealed stays on the bar.
                      {
                        key: "sealed",
                        label: "Sealed",
                        active: false,
                        onClick: () => navigate("sealed"),
                        icon: (
                          <>
                            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
                            <path d="M4 7l8 4 8-4" />
                            <path d="M12 11v10" />
                          </>
                        ),
                      },
                    ]
                  : [
                      // Card-collection views (binder, sealed,
                      // portfolio, social, settings): NO Binders tab
                      // here either (Anthony's correction, Nov 2,
                      // 2026 — he was still seeing it inside My
                      // Collectibles). A binder is reached only by
                      // tapping its collection tile on Home, which
                      // lands directly in the binder view; Sealed
                      // stays as its own tab.
                      {
                        key: "sealed",
                        label: "Sealed",
                        active: view === "sealed" && !searchOpen,
                        onClick: () => navigate("sealed"),
                        icon: (
                          <>
                            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
                            <path d="M4 7l8 4 8-4" />
                            <path d="M12 11v10" />
                          </>
                        ),
                      },
                    ]),
              {
                key: "social",
                label: "Social",
                active: view === "social" && !searchOpen,
                onClick: () => navigate("social"),
                icon: (
                  <>
                    <circle cx="9" cy="8" r="3.2" />
                    <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
                    <circle cx="17.2" cy="9" r="2.6" />
                    <path d="M16.2 14.7c2.2.3 3.7 1.8 4.2 4.3" />
                  </>
                ),
              },
              {
                key: "portfolio",
                label: "Portfolio",
                active: view === "finances" && !searchOpen,
                onClick: () => navigate("finances"),
                icon: (
                  <>
                    <path d="M4 4v16h16" />
                    <path d="M8 16v-5" />
                    <path d="M12.5 16V8" />
                    <path d="M17 16v-8.5" />
                  </>
                ),
              },
              {
                // Settings is global (Anthony's direction): it sits
                // in every collection's bottom menu, not just the
                // card collections', so About / version / Check for
                // Update is reachable from anywhere in the app.
                key: "settings",
                label: "Settings",
                active: view === "settings" && !searchOpen,
                onClick: () => navigate("settings"),
                icon: (
                  <>
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8" />
                  </>
                ),
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              aria-current={tab.active ? "page" : undefined}
              aria-label={tab.label}
              className="flex justify-center py-0.5"
            >
              <span
                className={`flex flex-col items-center gap-0.5 whitespace-nowrap rounded-[20px] px-2 py-1.5 text-[10px] font-medium ${
                  tab.active
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "text-[var(--dim)]"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[22px] w-[22px]"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Search screen — opened from the bottom Search tab
          (or a swipe, or the Home shortcut). FULL TAKEOVER
          (Anthony, Nov 3, 2026, ~10:03 AM bug report): the old
          overlay was a translucent scrim (bg-black/70) with the
          panel floating low, so the page underneath — Home,
          when he swiped Home → Search — stayed visible all
          around and behind the search field. Search is a stop
          on the bottom bar like any other tab, so it now takes
          the whole screen on the app's own solid background
          (app-shell, the same treatment as the Inbox and
          tickets windows): the view underneath is completely
          covered, nothing of Home shows through anywhere. It
          keeps the familiar dark pill field (grey magnifier,
          grey italic placeholder, white typed text) and shows
          results inside its panel. Tapping a result opens the
          card in place; closing (empty-area tap, ✕, Escape, or
          the device/browser Back — opening pushed one history
          entry, the same trap as the card sheet) returns to
          the view underneath, untouched. The screen slides in
          from the direction of travel (searchAnimDir, set by
          goSearch) on the same soft 480ms curve as every other
          page change; while the keyboard is up the entrance
          class drops and the panel stays fully opaque with a
          plain shadow, per the keyboard ghost-pattern fix. */}
      {searchOpen ? (
        <div
          ref={searchOverlayRef}
          className="app-shell fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Search your collection"
          onClick={closeSearch}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeSearch();
          }}
        >
          {/* Panel position (Anthony, Nov 3, 2026): NOT at
              the top and NOT centered — the panel anchors low
              on the screen, inside easy thumb reach, still
              horizontally centered; raised another ~12% at
              his direction after he saw the first placement
              live, so its base sits roughly 37% up from the
              bottom (~63% down the screen). Results grow
              upward from there. The keyboard still never
              opens on its own: nothing focuses the field
              until he taps it. The Search heading at the top
              is new with the full takeover: it makes the
              screen read as its own page, not a popup over
              Home, and hides while the keyboard is up so the
              panel keeps its room. */}
          <div
            className={`${
              searchKbUp
                ? ""
                : searchAnimDir === "next"
                  ? "tab-slide-next "
                  : searchAnimDir === "prev"
                    ? "tab-slide-prev "
                    : "search-pop "
            }mx-auto flex min-h-full w-full max-w-lg flex-col px-4 ${
              searchKbUp ? "pb-3" : "pb-[26vh]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {searchKbUp ? null : (
              <div className="pt-8">
                <h2 className="font-album text-2xl text-[var(--text)]">
                  Search
                </h2>
                <p className="mt-1 text-sm text-[var(--dim)]">
                  Find any card in the catalog — or scan one with
                  your camera.
                </p>
              </div>
            )}
            <div
              className={`rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-3 ${
                searchKbUp
                  ? "mt-3 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
                  : "mt-auto shadow-[0_0_44px_rgba(110,155,255,0.28),0_24px_60px_rgba(0,0,0,0.65)]"
              }`}
            >
              <div className="relative">
                <label htmlFor="overlay-search" className="sr-only">
                  Search your collection by name
                </label>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8a96]"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.8-3.8" />
                </svg>
                <input
                  id="overlay-search"
                  ref={searchInputRef}
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onFocus={() => {
                    searchInputFocusedRef.current = true;
                    setSearchKbUp(true);
                    // Pin the height directly on the DOM node
                    // (no React render); the resize listener
                    // keeps it glued to the visual viewport
                    // through the keyboard's animation.
                    const vv = window.visualViewport;
                    const el = searchOverlayRef.current;
                    if (vv && el) el.style.height = `${vv.height}px`;
                  }}
                  onBlur={() => {
                    searchInputFocusedRef.current = false;
                    setSearchKbUp(false);
                    const el = searchOverlayRef.current;
                    if (el) el.style.height = "";
                  }}
                  placeholder="Search your collection…"
                  className="h-[52px] w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-12 pr-12 text-base text-[var(--text)] placeholder:italic placeholder:text-[#8a8a96]"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none text-[var(--dim)]"
                >
                  ✕
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  openScan(true);
                }}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)]/50 px-4 py-2.5 text-sm font-semibold text-[var(--gold-soft)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M4 8h2.2l1.6-2.4A1 1 0 0 1 8.6 5h6.8a1 1 0 0 1 .8.6L17.8 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
                  <circle cx="12" cy="13.5" r="3.4" />
                </svg>
                Scan a card with your camera
              </button>
              {searchText.trim().length >= 2 ? (
                <div
                  className={`mt-2 overflow-y-auto ${
                    searchKbUp ? "max-h-[24vh]" : "max-h-[42vh]"
                  }`}
                >
                  {search.isPending ? (
                    <p className="px-2 py-2.5 text-sm text-[var(--dim)]">
                      Searching…
                    </p>
                  ) : search.data && search.data.results.length > 0 ? (
                    search.data.results.map((result) => (
                      <button
                        key={result.cardId}
                        type="button"
                        onClick={() => pickSearchResult(result)}
                        className="flex w-full items-center justify-between gap-2 border-b border-[var(--border)] px-2 py-2.5 text-left last:border-b-0"
                      >
                        <span>
                          <span className="block text-sm text-[var(--text)]">
                            {result.fullName}
                          </span>
                          <span className="block text-xs text-[var(--dim)]">
                            {result.groupName} · #{result.printed}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            result.ownedQty > 0
                              ? "text-[var(--gold-soft)]"
                              : "text-[var(--ghost)]"
                          }`}
                        >
                          {result.ownedQty > 0
                            ? `Owned ×${result.ownedQty}`
                            : "Missing"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2 py-2.5 text-sm text-[var(--dim)]">
                      No cards match that name.
                    </p>
                  )}
                </div>
              ) : (
                <p className="px-2 pb-1 pt-2.5 text-sm text-[var(--dim)]">
                  Start typing a card name — add its number to hone in
                  (like “Ariel 137”). Tapping a result opens the card
                  right here, no jumping back to the binder list.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedId != null ? (
        <CardSheet cardId={selectedId} onClose={closeCard} />
      ) : null}

      {sealedSheetName != null ? (
        <SealedSheet name={sealedSheetName} onClose={closeSealedSheet} />
      ) : null}

      {missingSheetKey != null ? (
        <MissingSheet groupKey={missingSheetKey} onClose={closeMissingSheet} />
      ) : null}

      {scanOpen ? <ScanPanel onClose={closeScan} /> : null}
    </div>
  );
}
