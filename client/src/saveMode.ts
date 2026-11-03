// "Save collection count" mode (Anthony, Nov 2, 2026): a Settings
// toggle with both modes. ON (the default, and how the app has
// always worked): on a card's page the Regular / Cold Foil +/−
// steppers only stage the new count, and the "Save collection
// count" button commits it. OFF (auto-save): the button is gone
// and every +/− tap saves immediately — 14 taps to 15 and it is
// recorded, no second step. Stored on the device like the
// Haptics choice; every stepper call site reads it live through
// the hook, so flipping the switch takes effect at once.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "vaultx-manual-save-count";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

export function manualSaveCount(): boolean {
  if (cached != null) return cached;
  try {
    cached = localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    cached = true;
  }
  return cached;
}

export function setManualSaveCount(on: boolean): void {
  cached = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable — the in-memory choice still applies.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useManualSaveCount(): boolean {
  return useSyncExternalStore(subscribe, manualSaveCount, () => true);
}
