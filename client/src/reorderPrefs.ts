// Saved drag-reorder orders (Anthony, Nov 5, 2026): the
// app-wide long-press drag reorder persists each surface's
// tile order per user — a device mirror (localStorage) makes
// the saved order right from the first frame, and the
// profile copy (getReorderPrefs / setReorderPref on
// collector_profile.reorder_prefs) wins once fetched and
// follows the user across devices. The same plumbing pattern
// as the grid-density and Only-mine preferences.

import {
useMutation,
useQuery,
useQueryClient,
} from "@tanstack/react-query";
import { api } from "./api";

const MIRROR_PREFIX = "vaultx-reorder-";

export function readMirrorOrder(prefKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(MIRROR_PREFIX + prefKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeMirrorOrder(prefKey: string, order: string[]): void {
  try {
    window.localStorage.setItem(
      MIRROR_PREFIX + prefKey,
      JSON.stringify(order),
    );
  } catch {
    // Device mirror unavailable: the profile copy still saves.
  }
}

/** Applies a saved order to a surface's natural key list:
    saved keys first, in saved order (keys that no longer
    exist drop out); anything unlisted keeps its natural
    place after them, so new tiles append until arranged. */
export function applySavedOrder(
  natural: string[],
  saved: string[],
): string[] {
  const inNatural = new Set(natural);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of saved) {
    if (inNatural.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  for (const k of natural) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}

/** The saved order for one reorder surface, plus its saver.
    `naturalKeys` is the surface's fallback order (e.g. the
    Home collection order for the universe pages). */
export function useSavedOrder(
  prefKey: string,
  naturalKeys: string[],
): { ordered: string[]; saveOrder: (order: string[]) => void } {
  const queryClient = useQueryClient();
  const prefsQ = useQuery({
    queryKey: ["reorderPrefs"],
    queryFn: () => api.getReorderPrefs({}),
  });
  const save = useMutation({
    mutationFn: (order: string[]) =>
      api.setReorderPref({ key: prefKey, order }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["reorderPrefs"],
      });
    },
  });
  const serverOrder = prefsQ.data?.prefs[prefKey];
  const saved = serverOrder ?? readMirrorOrder(prefKey);
  const ordered = applySavedOrder(naturalKeys, saved);
  const saveOrder = (order: string[]) => {
    writeMirrorOrder(prefKey, order);
    save.mutate(order);
  };
  return { ordered, saveOrder };
}
