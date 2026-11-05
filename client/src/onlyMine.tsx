// "Only mine" list filter (Anthony, Nov 5, 2026): on every
// list page whose DISPLAYED list runs longer than 15 entries
// (set/chapter tiles, a game catalog's set rows, a
// manufacturer's set list, the Sealed shelf), the page shows
// this toggle. ON hides every entry the user owns nothing
// from — zero owned in that set, or zero copies of that
// product — so the page shows only what they actually
// collect; OFF (the default) shows everything as always.
// It never hides anything owned ≥1, and it never applies
// inside a set's own card grid (missing cards stay ghostly
// there).
//
// PER-SECTION (Anthony, Nov 5, 2026, reversing the original
// shared-switch design the same day): each section's toggle
// is its OWN independent switch. Turning it on in Star Wars
// Topps must not change WWE, Disney Topps, Garbage Pail
// Kids, Pokémon, Lorcana, or any other section — he turned
// it on in one section and found it applied app-wide, which
// was wrong. Each section's position is remembered
// separately per user: a device mirror per section
// (localStorage) makes it right from the first frame, and
// the profile copy — one entry per section in the same
// reorder-prefs store every drag order uses, key
// "only-mine:<section>" — follows the user across devices.
// Named exceptions to the 15-entry threshold: Disney Topps
// and Garbage Pail Kids show the toggle even though their
// lists are shorter (Anthony directed it explicitly).

import { useSyncExternalStore } from "react";
import { api } from "./api";
import { hapticTick } from "./haptics";

/** Lists longer than this (in entries actually displayed)
    carry the toggle; at or under it, no toggle shows —
    except the named exception sections, which always show
    it. */
export const ONLY_MINE_THRESHOLD = 15;

/** Sections that carry the toggle regardless of list
    length (Anthony, Nov 5, 2026). */
export const ONLY_MINE_ALWAYS: ReadonlySet<string> = new Set([
  "disney-topps",
  "gpk",
]);

const MIRROR_PREFIX = "vaultx-only-mine:";
const PREF_PREFIX = "only-mine:";

function readMirror(section: string): boolean {
  try {
    return window.localStorage.getItem(MIRROR_PREFIX + section) === "1";
  } catch {
    return false;
  }
}

function writeMirror(section: string, on: boolean) {
  try {
    window.localStorage.setItem(MIRROR_PREFIX + section, on ? "1" : "0");
  } catch {
    // Device mirror unavailable: the profile copy still saves.
  }
}

const values = new Map<string, boolean>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function valueOf(section: string): boolean {
  let v = values.get(section);
  if (v == null) {
    v = readMirror(section);
    values.set(section, v);
  }
  return v;
}

// One profile fetch hydrates every section's saved position
// (the reorder-prefs map carries them all). Kicked off the
// first time any toggle is read; the server copy wins over
// the device mirror for sections it has a value for, the
// same rule the drag-reorder store follows.
let hydrateStarted = false;
function hydrateFromServer() {
  if (hydrateStarted) return;
  hydrateStarted = true;
  api
    .getReorderPrefs({})
    .then((res) => {
      let changed = false;
      for (const [key, order] of Object.entries(res.prefs)) {
        if (!key.startsWith(PREF_PREFIX)) continue;
        const section = key.slice(PREF_PREFIX.length);
        const on = order[0] === "1";
        if (valueOf(section) !== on) {
          values.set(section, on);
          writeMirror(section, on);
          changed = true;
        }
      }
      if (changed) emit();
    })
    .catch(() => {
      // Offline or server hiccup: device mirrors stand.
    });
}

/** One section's "Only mine" choice, reactive. Independent
    of every other section's. */
export function useOnlyMine(section: string): boolean {
  hydrateFromServer();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => valueOf(section),
    () => false,
  );
}

/** Flip one section's choice: applies to that section only,
    mirrors to the device, and saves to the profile under
    that section's own key. */
export function setOnlyMine(section: string, on: boolean) {
  if (valueOf(section) === on) return;
  values.set(section, on);
  writeMirror(section, on);
  emit();
  void api
    .setReorderPref({
      key: PREF_PREFIX + section,
      order: [on ? "1" : "0"],
    })
    .catch(() => {
      // Offline or server hiccup: the choice still applies
      // here and is mirrored on this device.
    });
}

/** The "Only mine" switch shown on long lists. One instance
    per section; `section` is that list's own key (a game
    key like "gpk", "lorcana", "sealed", …). */
export function OnlyMineToggle({ section }: { section: string }) {
  const on = useOnlyMine(section);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Only mine — show only the sets and products you own something from"
      onClick={() => {
        hapticTick();
        setOnlyMine(section, !on);
      }}
      className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 pr-3 pl-1.5 transition active:scale-95"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full transition-colors ${
          on ? "bg-[var(--gold)]" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      <span
        className={`text-xs font-bold ${
          on ? "text-[var(--gold-soft)]" : "text-[var(--dim)]"
        }`}
      >
        Only mine
      </span>
    </button>
  );
}
