import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { hapticTick } from "./haptics";
import { useDragReorder } from "./dragReorder";
import { useSavedOrder } from "./reorderPrefs";
import collectionLorcana from "./assets/media-generation-collection-lorcana-storybook-0-ce9f8aac-6d85-4014-8b24-b93a46fdc1ed.webp";
import collectionPokemon from "./assets/collection-pokemon.webp";
import collectionMagic from "./assets/collection-magic.webp";
import collectionStarwars from "./assets/collection-starwars.webp";

/**
 * TCG Universe (Anthony, Nov 4, 2026 — the Home
 * condensation): Home's four separate TCG tiles became ONE
 * "TCG Universe" tile, and this page is what it opens — the
 * four tracked trading-card games as subfolders, each with
 * its own existing tile artwork and its live counts.
 * Tapping a game opens that game's section exactly as it
 * always has (the root wires the openers); nothing inside
 * the four games changes. The page's Back returns to Home,
 * and a game opened from here returns HERE on its back —
 * the root tracks that origin. Order and show/hide follow
 * the same per-user tile settings as Home: the games keep
 * their relative order from the saved tile order, and a
 * game hidden in the Your Collections window is hidden
 * here too.
 */
export type TcgGameView = "binder" | "pokemon" | "magic" | "starwars";

const GAME_KEYS: {
  key: string;
  view: TcgGameView;
  label: string;
  art: string;
  artAlt: string;
}[] = [
  {
    key: "lorcana",
    view: "binder",
    label: "Lorcana",
    art: collectionLorcana,
    artAlt:
      "Lorcana collection artwork: an open storybook with illustrated cards around it and golden magical light rising off the pages",
  },
  {
    key: "pokemon",
    view: "pokemon",
    label: "Pokémon",
    art: collectionPokemon,
    artAlt:
      "Pokémon collection artwork: a glossy red-and-white capture ball in tall grass at sunset with fireflies",
  },
  {
    key: "starwars",
    view: "starwars",
    label: "Star Wars Unlimited",
    art: collectionStarwars,
    artAlt:
      "Star Wars Unlimited collection artwork: starfighters in a deep-space battle over a glowing planet, laser fire and a space station",
  },
  {
    key: "magic",
    view: "magic",
    label: "Magic: The Gathering",
    art: collectionMagic,
    artAlt:
      "Magic: The Gathering collection artwork: a flame vortex over a rune-carved stone altar in a dark arcane landscape",
  },
];

export function TcgUniversePage({
  onBack,
  onOpenGame,
}: {
  /** Back to Home. */
  onBack: () => void;
  /** Opens one game's section, exactly as its Home tile
      used to; the root records that it was opened from
      here so the game's back returns to this page. */
  onOpenGame: (view: TcgGameView) => void;
}) {
  const visibility = useQuery({
    queryKey: ["collectionVisibility"],
    queryFn: () => api.getCollectionVisibility({}),
  });

  const hidden = new Set(visibility.data?.hidden ?? []);
  const order = visibility.data?.order ?? [];
  const games = [...GAME_KEYS].sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // Long-press drag reorder (Anthony, Nov 5, 2026): the
  // four game tiles reorder exactly like Home's Your
  // Collections tiles — hold until a tile lifts, drag it
  // over another, they swap; the drop saves. The order is
  // this page's own per-user saved order ("tcg-games"),
  // falling back to the Home collection order until he
  // arranges it here. Hidden games keep their saved place
  // but are not rendered, so they take no part in a drag.
  const visibleGames = games.filter((g) => !hidden.has(g.key));
  const { ordered: orderedKeys, saveOrder } = useSavedOrder(
    "tcg-games",
    visibleGames.map((g) => g.key),
  );
  const drag = useDragReorder({
    keys: orderedKeys,
    onCommit: saveOrder,
  });
  const orderedGames = orderedKeys
    .map((k) => visibleGames.find((g) => g.key === k))
    .filter((g) => g != null);

  // NO counts line on these tiles (Anthony, Nov 5, 2026):
  // the per-game counts line (binders/sets · owned) is
  // REMOVED — it threw off the tiles' look and made the
  // loaded ones taller than the others. Every tile is now
  // art + name only, uniform size and layout, and the
  // counts are not moved anywhere else on this page. (The
  // catalog queries that fed the line went with it.)

  return (
    <section aria-label="TCG Universe" className="pt-4">
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
        TCG Universe
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
        Your four trading-card games, one doorway. Each opens
        exactly as it always has — its own binders, sets, and
        releases, untouched.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
        Hold a tile until it lifts, then drag it over another
        to swap places — the order saves as yours.
      </p>
      <div
        ref={drag.containerRef}
        className="mt-4 flex flex-wrap justify-center gap-3"
      >
        {orderedGames.map((g) => (
            <div
              key={g.key}
              {...drag.itemProps(g.key)}
              className={`relative w-[calc((100%-1.5rem)/3)] ${
                drag.draggingKey === g.key ? "z-30" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (drag.suppressClick()) return;
                  hapticTick();
                  onOpenGame(g.view);
                }}
                aria-label={`Open your ${g.label} collection`}
                className="block w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <img
                  src={g.art}
                  alt={g.artAlt}
                  loading="lazy"
                  draggable={false}
                  className="block aspect-square w-full object-cover"
                />
                <span className="block px-1 py-2 text-center">
                  <span className="block text-xs font-semibold leading-tight text-[var(--text)] sm:text-sm">
                    {g.label}
                  </span>
                </span>
              </button>
            </div>
          ))}
      </div>
      {games.every((g) => hidden.has(g.key)) ? (
        <p className="mt-4 rounded-xl bg-[var(--surface)] px-3 py-3 text-sm leading-relaxed text-[var(--dim)]">
          Every game is hidden right now. The eye beside Your
          Collections on Home brings them back — the games
          live under &ldquo;Inside TCG Universe&rdquo; there.
        </p>
      ) : null}
    </section>
  );
}
