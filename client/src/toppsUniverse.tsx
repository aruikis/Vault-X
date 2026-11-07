import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { hapticTick } from "./haptics";
import { useDragReorder } from "./dragReorder";
import { useSavedOrder } from "./reorderPrefs";
import type { GameKey } from "./games";
import collectionDisneyTopps from "./assets/collection-disney-topps.webp";
// Tile art picks (Anthony, Nov 5, 2026): Star Wars Topps →
// the hooded figure from behind looking up at a starship
// in a dark starry sky; WWE Topps → the wrestler's
// silhouette at the ring ropes with a gold belt hanging
// beside him. Anthony picked the finished files in the
// media workspace; the bundler embeds them into the app
// bundle from there, byte for byte, like every other tile.
import collectionStarwarsTopps from "../../../../imagine_media/media-generation-star-wars-topps-tile-final-0-a032e9fa-5d3e-432b-a621-33be3eb93ad8.webp";
import collectionGpk from "./assets/collection-gpk.webp";
import collectionWweTopps from "../../../../imagine_media/media-generation-wwe-topps-tile-final-0-ce02f77f-0abf-4c97-810c-43efcda1f63f.webp";

/**
 * Topps Alternate Universe (Anthony, Nov 4, 2026): the
 * sixth main area on Home, same folder pattern as TCG
 * Universe — one tile on Home opens this page, and inside
 * are Topps' non-sports card worlds, each its own full
 * section on the standard game template (set groups,
 * binder grids, card pages, steppers):
 * - Disney Topps — Topps' Disney cards; NOT Lorcana
 *   (Ravensburger makes Lorcana).
 * - Star Wars Topps — Topps' Star Wars cards; NOT Star
 *   Wars Unlimited (that is Fantasy Flight's game).
 * - Garbage Pail Kids — Topps' own brand.
 * - WWE Topps — Topps' WWE cards.
 * Every catalog comes from Topps' own official checklists
 * (topps.com), text data only — cards carry no artwork;
 * SET rows carry Topps' official product photo where one
 * exists on a Topps source (Nov 5, 2026 artwork pull), and
 * the clean placeholder where none does. Back from a sub-area returns
 * HERE; Back from this page returns Home. Order and
 * show/hide follow the same per-user tile settings as
 * Home ("Inside Topps Alternate Universe" in the eye
 * window).
 */
export type AuAreaView =
  | "au-disney"
  | "au-starwars"
  | "au-gpk"
  | "au-wwe";

export const AU_AREAS: {
  key: string;
  view: AuAreaView;
  game: GameKey;
  label: string;
  art: string;
  artAlt: string;
}[] = [
  {
    key: "disneytopps",
    view: "au-disney",
    game: "disney-topps",
    label: "Disney Topps",
    art: collectionDisneyTopps,
    artAlt:
      "Disney Topps artwork: a dark vault arch framing a glowing castle, with a fan of chrome refractor Disney trading cards in front",
  },
  {
    key: "starwarstopps",
    view: "au-starwars",
    game: "starwars-topps",
    label: "Star Wars Topps",
    art: collectionStarwarsTopps,
    artAlt:
      "Star Wars Topps artwork: a hooded figure seen from behind looking up at a starship passing overhead in a dark starry sky",
  },
  {
    key: "gpk",
    view: "au-gpk",
    game: "gpk",
    label: "Garbage Pail Kids",
    art: collectionGpk,
    artAlt:
      "Garbage Pail Kids artwork: a mischievous cartoon kid character bursting out of a garbage pail with trading cards around",
  },
  {
    key: "wwetopps",
    view: "au-wwe",
    game: "wwe-topps",
    label: "WWE Topps",
    art: collectionWweTopps,
    artAlt:
      "WWE Topps artwork: a wrestler's silhouette standing at the ring ropes with a gold championship belt hanging beside him, crowd lights behind, a single spotlight",
  },
];

export function ToppsAlternateUniversePage({
  onBack,
  onOpenArea,
}: {
  /** Back to Home. */
  onBack: () => void;
  /** Opens one sub-area's section; the root records the
      view so its back returns to this page. */
  onOpenArea: (view: AuAreaView) => void;
}) {
  const visibility = useQuery({
    queryKey: ["collectionVisibility"],
    queryFn: () => api.getCollectionVisibility({}),
  });
  const hidden = new Set(visibility.data?.hidden ?? []);
  const order = visibility.data?.order ?? [];
  const areas = [...AU_AREAS].sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // Long-press drag reorder (Anthony, Nov 5, 2026): the
  // same shared mechanism as the TCG Universe tiles — hold
  // until a tile lifts, drag to swap, the drop saves this
  // page's own per-user order ("au-areas"), falling back to
  // the Home collection order until arranged here.
  const visibleAreas = areas.filter((a) => !hidden.has(a.key));
  const { ordered: orderedKeys, saveOrder } = useSavedOrder(
    "au-areas",
    visibleAreas.map((a) => a.key),
  );
  const drag = useDragReorder({
    keys: orderedKeys,
    onCommit: saveOrder,
  });
  const orderedAreas = orderedKeys
    .map((k) => visibleAreas.find((a) => a.key === k))
    .filter((a) => a != null);

  // No counts line under the tile names (Anthony, Nov 5,
  // 2026 — the AU counts bug, same rule as the TCG Universe
  // counts removal): the tiles are name only, all the same
  // size.
  return (
    <section aria-label="Topps Alternate Universe" className="pt-4">
      <button
        type="button"
        onClick={() => {
          hapticTick();
          onBack();
        }}
        aria-label="Back to Home"
        className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition active:scale-95"
      >
        <span aria-hidden="true">‹</span> Home
      </button>
      <h1 className="mt-3 font-album text-2xl text-[var(--text)]">
        Topps Alternate Universe
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Topps beyond the ballpark — its Disney, Star Wars,
        Garbage Pail Kids, and WWE cards, each its own
        section. Separate from Lorcana and from Star Wars
        Unlimited: these are Topps collectible cards, not
        game cards.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
        Hold a tile until it lifts, then drag it over another
        to swap places — the order saves as yours.
      </p>
      <div
        ref={drag.containerRef}
        className="mt-4 flex flex-wrap justify-center gap-3"
      >
        {orderedAreas.map((a) => (
            <div
              key={a.key}
              {...drag.itemProps(a.key)}
              className={`relative w-[calc((100%-1.5rem)/3)] ${
                drag.draggingKey === a.key ? "z-30" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (drag.suppressClick()) return;
                  hapticTick();
                  onOpenArea(a.view);
                }}
                aria-label={`Open your ${a.label} collection`}
                className="block w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <img
                  src={a.art}
                  alt={a.artAlt}
                  loading="lazy"
                  draggable={false}
                  className="block aspect-square w-full object-cover"
                />
                <span className="block px-1 py-2 text-center">
                  <span className="block text-xs font-semibold leading-tight text-[var(--text)] sm:text-sm">
                    {a.label}
                  </span>
                </span>
              </button>
            </div>
          ))}
      </div>
      {areas.every((a) => hidden.has(a.key)) ? (
        <p className="mt-4 rounded-xl bg-[var(--surface)] px-3 py-3 text-sm leading-relaxed text-[var(--dim)]">
          Every area is hidden right now. The eye beside Your
          Collections on Home brings them back — they live
          under &ldquo;Inside Topps Alternate Universe&rdquo;
          there.
        </p>
      ) : null}
    </section>
  );
}
