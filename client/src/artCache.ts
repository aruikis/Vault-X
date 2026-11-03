// Persistent on-device caching of card artwork (Anthony asked for the
// photos to be saved locally on his device so they load instantly
// instead of re-downloading every open).
//
// Design:
// - Cache Storage, one versioned cache ("lorcana-art-v1"); older
//   versions are deleted on startup so restyle/data updates never serve
//   stale art.
// - Grid pockets cache a downscaled ~320px-wide JPEG of the art (the
//   binder has 3,556 printings — full-res for all of them would be far
//   too much device storage). Full resolution is cached only when a
//   card's detail view is opened, and opening the detail also backfills
//   that card's grid thumbnail from the same download.
// - A small localStorage index tracks insertion order per kind; beyond
//   the caps (grid 1,600 / full 120) the oldest entries are evicted
//   first, so the cache can't grow without bound.
// - Everything degrades gracefully: no Cache Storage (or any failure)
//   just falls back to loading the art from the server as before.

import { useEffect, useState } from "react";
import { api } from "./api";

const CACHE_NAME = "lorcana-art-v1";
const CACHE_PREFIX = "lorcana-art-";
const INDEX_KEY = "lorcana-art-index-v1";
const GRID_WIDTH = 320;
const CAPS = { grid: 1600, full: 120 } as const;

export type ArtKind = keyof typeof CAPS;

const keyFor = (id: number, kind: ArtKind) => `/__artcache/${kind}/${id}.jpg`;

type IndexEntry = { k: string; kind: ArtKind; t: number };

function loadIndex(): IndexEntry[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIndex(entries: IndexEntry[]) {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/blocked: caching just becomes best-effort.
  }
}

/** Delete art caches from older versions. Called once on app start. */
export async function pruneOldArtCaches(): Promise<void> {
  try {
    if (!("caches" in window)) return;
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
        .map((n) => caches.delete(n)),
    );
  } catch {
    // Ignore: cache housekeeping must never break the binder.
  }
}

async function openCache(): Promise<Cache | null> {
  try {
    if (!("caches" in window)) return null;
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function recordAndEvict(kind: ArtKind, key: string): Promise<void> {
  const entries = loadIndex().filter((e) => e.k !== key);
  entries.push({ k: key, kind, t: Date.now() });
  const mine = entries.filter((e) => e.kind === kind);
  const overflow = mine.length - CAPS[kind];
  if (overflow > 0) {
    const doomed = mine.slice(0, overflow).map((e) => e.k);
    const cache = await openCache();
    if (cache) {
      await Promise.all(doomed.map((k) => cache.delete(k)));
    }
    const doomedSet = new Set(doomed);
    saveIndex(entries.filter((e) => !doomedSet.has(e.k)));
    return;
  }
  saveIndex(entries);
}

async function downscaleToGrid(blob: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    if (bmp.width <= GRID_WIDTH) {
      bmp.close();
      return blob;
    }
    const height = Math.round(bmp.height * (GRID_WIDTH / bmp.width));
    const canvas = document.createElement("canvas");
    canvas.width = GRID_WIDTH;
    canvas.height = height;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      bmp.close();
      return blob;
    }
    ctx2d.drawImage(bmp, 0, 0, GRID_WIDTH, height);
    bmp.close();
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? blob), "image/jpeg", 0.82);
    });
  } catch {
    return blob;
  }
}

async function cachePut(
  id: number,
  kind: ArtKind,
  sourceBlob: Blob,
): Promise<void> {
  try {
    const cache = await openCache();
    if (!cache) return;
    const toStore =
      kind === "grid" ? await downscaleToGrid(sourceBlob) : sourceBlob;
    await cache.put(
      keyFor(id, kind),
      new Response(toStore, {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    await recordAndEvict(kind, keyFor(id, kind));
  } catch {
    // Best-effort only.
  }
}

async function cacheGetObjectUrl(
  id: number,
  kind: ArtKind,
): Promise<string | null> {
  try {
    const cache = await openCache();
    if (!cache) return null;
    const hit = await cache.match(keyFor(id, kind));
    if (!hit) return null;
    const blob = await hit.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// One in-flight download per card, shared by the regular/foil pockets
// and the detail view, so the same art is never fetched twice at once.
const inflight = new Map<number, Promise<Blob | null>>();

function fetchSourceBlob(cardId: number): Promise<Blob | null> {
  const existing = inflight.get(cardId);
  if (existing) return existing;
  const p = (async (): Promise<Blob | null> => {
    try {
      const { url } = await api.cardImage({ cardId });
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    } finally {
      inflight.delete(cardId);
    }
  })();
  inflight.set(cardId, p);
  return p;
}

/**
 * Art URL for a card, served from the on-device cache when present.
 * - kind "grid": 320px-wide cached thumbnail (binder pockets, list rows)
 * - kind "full": full-resolution art, cached only from the detail view
 * On a miss the art downloads once, displays, and is cached (the detail
 * view also backfills the grid thumbnail from the same download).
 * Returns null while loading or when no card is requested.
 */
export function useCachedArt(
  cardId: number | null,
  kind: ArtKind,
  enabled: boolean,
): { url: string | null; settled: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  // settled = the lookup finished (hit, download, or failure), so the UI
  // can show a terminal "Art unavailable" instead of loading forever.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (cardId == null || !enabled) {
      setUrl(null);
      setSettled(false);
      return;
    }
    setSettled(false);
    let cancelled = false;
    let objectUrl: string | null = null;
    const show = (u: string, isObject: boolean) => {
      if (cancelled) {
        if (isObject) URL.revokeObjectURL(u);
        return;
      }
      objectUrl = isObject ? u : null;
      setUrl(u);
      setSettled(true);
    };
    void (async () => {
      const cached = await cacheGetObjectUrl(cardId, kind);
      if (cached) {
        show(cached, true);
        return;
      }
      if (cancelled) return;
      const blob = await fetchSourceBlob(cardId);
      if (cancelled) return;
      if (!blob) {
        // Download failed: fall back to the plain server URL so the
        // browser gets its own chance to load (and show) the art. If
        // there is no URL at all, settle so the UI can say the art is
        // unavailable instead of loading forever.
        try {
          const { url: src } = await api.cardImage({ cardId });
          if (src) {
            show(src, false);
          } else if (!cancelled) {
            setSettled(true);
          }
        } catch {
          if (!cancelled) setSettled(true);
        }
        return;
      }
      show(URL.createObjectURL(blob), true);
      void cachePut(cardId, kind, blob);
      if (kind === "full") {
        void cachePut(cardId, "grid", blob);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cardId, kind, enabled]);

  return { url, settled };
}
