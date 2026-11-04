// Set-page grid density (Anthony, Nov 4, 2026, ~12:54 AM):
// every set/chapter card grid in every collection gets a
// TWO-ACROSS / FOUR-ACROSS toggle, DEFAULTING to two-across
// — his cataloging view: the card big enough to see, the
// foil pocket beside it, and the count stepper right there
// on the grid. Four-across stays for fast hunting. ONE
// shared per-user preference: it starts from the device
// mirror so the choice is on from the first frame, the
// profile's saved choice wins once fetched (it follows the
// user across devices), and picking saves to the profile —
// the same pattern as the theme preference.

import { useSyncExternalStore } from "react";
import { api } from "./api";
import { hapticTick } from "./haptics";

export type GridCols = 2 | 4;

const STORAGE_KEY = "vaultx-grid-cols";

function readStoredGridCols(): GridCols {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "4" ? 4 : 2;
  } catch {
    return 2;
  }
}

function storeGridCols(cols: GridCols) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(cols));
  } catch {
    // Device mirror unavailable: the profile copy still saves.
  }
}

let current: GridCols = readStoredGridCols();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** The current grid density, reactive across every grid in
    the app at once. */
export function useGridCols(): GridCols {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => 2 as GridCols,
  );
}

/** Pick a density: applies everywhere at once, mirrors to
    the device, and saves to the profile. */
export function setGridCols(cols: GridCols) {
  if (cols === current) return;
  current = cols;
  storeGridCols(cols);
  emit();
  void api.setGridColsPreference({ cols }).catch(() => {
    // Offline or server hiccup: the choice still applies
    // here and is mirrored on this device.
  });
}

/** Adopt the profile's saved choice when it arrives (the
    root calls this from the same profile fetch that carries
    the theme). */
export function adoptServerGridCols(saved: number | null | undefined) {
  if ((saved === 2 || saved === 4) && saved !== current) {
    current = saved;
    storeGridCols(saved);
    emit();
  }
}

/** The two-across / four-across segmented toggle shown on
    set pages. */
export function GridColsToggle() {
  const cols = useGridCols();
  return (
    <div
      role="group"
      aria-label="Grid density — cards across"
      className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
    >
      {([2, 4] as const).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={cols === n}
          aria-label={`${n === 2 ? "Two" : "Four"} cards across`}
          onClick={() => {
            hapticTick();
            setGridCols(n);
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold tabular-nums ${
            cols === n
              ? "bg-[var(--accent)] text-[var(--on-accent)]"
              : "text-[var(--dim)]"
          }`}
        >
          {n} across
        </button>
      ))}
    </div>
  );
}
