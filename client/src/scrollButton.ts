// Which edge the floating scroll button rides (Anthony,
// Nov 10, 2026 — his pick of the mockup's Option 2, "One
// Smart Button"): ONE small translucent button instead of
// the old up/down circle pairs on both edges. RIGHT is the
// default — his words: most people are right-handed, and
// the button should sit under the thumb that's actually
// used, not across the screen. A left-handed user moves
// the same button to the left edge in Settings. ONE shared
// per-user preference, on the grid-density pattern: it
// starts from the device mirror so the choice is on from
// the first frame, the profile's saved choice wins once
// fetched (it follows the user across devices), and
// picking saves to the profile.

import { useSyncExternalStore } from "react";
import { api } from "./api";

export type ScrollSide = "left" | "right";

const STORAGE_KEY = "vaultx-scroll-side";

function readStoredScrollSide(): ScrollSide {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "left"
      ? "left"
      : "right";
  } catch {
    return "right";
  }
}

function storeScrollSide(side: ScrollSide) {
  try {
    window.localStorage.setItem(STORAGE_KEY, side);
  } catch {
    // Device mirror unavailable: the profile copy still saves.
  }
}

let current: ScrollSide = readStoredScrollSide();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** The current scroll-button edge, reactive app-wide. */
export function useScrollSide(): ScrollSide {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => "right" as ScrollSide,
  );
}

/** Pick an edge: applies at once, mirrors to the device,
    and saves to the profile. */
export function setScrollSide(side: ScrollSide) {
  if (side === current) return;
  current = side;
  storeScrollSide(side);
  emit();
  void api.setScrollSidePreference({ side }).catch(() => {
    // Offline or server hiccup: the choice still applies
    // here and is mirrored on this device.
  });
}

/** Adopt the profile's saved choice when it arrives (the
    root calls this from the same profile fetch that carries
    the theme and grid density). */
export function adoptServerScrollSide(
  saved: string | null | undefined,
) {
  if (
    (saved === "left" || saved === "right") &&
    saved !== current
  ) {
    current = saved;
    storeScrollSide(saved);
    emit();
  }
}
