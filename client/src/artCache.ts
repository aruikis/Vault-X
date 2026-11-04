// Persistent on-device caching of card artwork (Anthony asked for the
// photos to be saved locally on his device so they load instantly
// instead of re-downloading every open).
//
// THE UP-FRONT RULE (Anthony, Nov 3, 2026): download and cache ALL
// artwork up front, so nobody waits for images to build or load as
// they browse. A background warm-up fills the cache progressively —
// the user's own collection first, then the wider catalog set by
// set (the order the server's getArtworkWarmup action returns) —
// starting after the first-run Welcome tour completes, and again
// on any later open where the catalog has grown or the artwork
// generation has changed (an app update that adds artwork). The
// warm-up never blocks the app: it downloads a couple of images at
// a time in idle gaps, pauses while offline, and every view already
// displays cache-first through useCachedArt below. Honest progress
// ("Artwork cache: X of Y images saved on this device") lives in
// Settings > Your data & backups, fed by getArtCacheProgress /
// useArtCacheProgress.
//
// Design:
// - Cache Storage, one versioned cache ("lorcana-art-v2"); older
//   versions are deleted on startup so restyle/data updates never
//   serve stale art. When artwork itself is replaced (a re-scan, a
//   restyle pass like the sealed acrylic updates), bump CACHE_NAME
//   here AND the server's ARTWORK_VERSION together: the warm-up
//   sees the new generation, wipes the old cache, and re-downloads
//   everything. Sealed / comic / set-logo artwork ships inside the
//   app bundle as content-hashed files, so an app update replaces
//   those bytes directly — they are never in this cache.
// - The warm-up caches the BROWSING artwork for every printing:
//   a downscaled ~320px-wide JPEG (measured Nov 3, 2026: about
//   33-41 KB each, roughly 135 MB for the full 3,556-printing
//   catalog; the full-resolution scans average about 280 KB each —
//   near 1 GB for the whole catalog — so full resolution stays
//   cached only for cards whose detail view has been opened,
//   exactly as before, and backfills that card's grid copy).
// - A small localStorage index tracks insertion order and byte
//   size per kind; beyond the caps the oldest entries are evicted
//   first. The grid cap (4,200) sits above the full catalog
//   (3,556 printings) with headroom for future sets, so a complete
//   warm-up is never evicted; the full-res cap stays small (120).
// - Everything degrades gracefully: no Cache Storage (or any
//   failure) just falls back to loading the art from the server
//   as before.

import { useEffect, useState } from "react";
import { api } from "./api";

const CACHE_NAME = "lorcana-art-v2";
const CACHE_PREFIX = "lorcana-art-";
const INDEX_KEY = "lorcana-art-index-v2";
const WARMUP_META_KEY = "lorcana-art-warmup-v2";
const GRID_WIDTH = 320;
// Two-across browsing variant (Nov 4, 2026): the bigger tiles
// render roughly twice as wide as the four-across pockets, so
// they get a right-sized 640px copy of their own instead of
// upscaling the 320px grid thumbnail — Anthony's two-across
// scroll-jank report ("the bigger pictures need re-caching").
const LARGE_WIDTH = 640;
const CAPS = { grid: 4200, large: 4200, full: 120 } as const;

export type ArtKind = keyof typeof CAPS;

const keyFor = (id: number, kind: ArtKind) => `/__artcache/${kind}/${id}.jpg`;

type IndexEntry = { k: string; kind: ArtKind; t: number; s?: number };

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

async function recordAndEvict(
  kind: ArtKind,
  key: string,
  size: number,
): Promise<void> {
  const entries = loadIndex().filter((e) => e.k !== key);
  entries.push({ k: key, kind, t: Date.now(), s: size });
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

async function downscaleToWidth(blob: Blob, width: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    if (bmp.width <= width) {
      bmp.close();
      return blob;
    }
    const height = Math.round(bmp.height * (width / bmp.width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      bmp.close();
      return blob;
    }
    ctx2d.drawImage(bmp, 0, 0, width, height);
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
      kind === "grid"
        ? await downscaleToWidth(sourceBlob, GRID_WIDTH)
        : kind === "large"
          ? await downscaleToWidth(sourceBlob, LARGE_WIDTH)
          : sourceBlob;
    await cache.put(
      keyFor(id, kind),
      new Response(toStore, {
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    await recordAndEvict(kind, keyFor(id, kind), toStore.size);
    if (kind === "grid") emitProgress(warmupRunning);
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

/**
 * Raw artwork blob for the scanner's on-device fingerprint index
 * (client/src/fingerprint.ts): the cached grid copy when this
 * device already holds it, otherwise one download that also
 * fills the grid cache — the scanner's index build and the
 * browsing warm-up share the same bytes and never fetch twice.
 */
export async function getArtBlobForIndex(
  cardId: number,
): Promise<Blob | null> {
  try {
    const cache = await openCache();
    if (cache) {
      const hit = await cache.match(keyFor(cardId, "grid"));
      if (hit) return await hit.blob();
    }
  } catch {
    // Fall through to the download.
  }
  const blob = await fetchSourceBlob(cardId);
  if (blob) void cachePut(cardId, "grid", blob);
  return blob;
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

// ---------------------------------------------------------------------------
// Artwork warm-up (the up-front rule): progress reporting + the
// background downloader. Progress is read from the real on-device
// index — the Settings line never estimates a count it hasn't seen.
// ---------------------------------------------------------------------------

export type ArtCacheProgress = {
  /** Grid (browsing) images actually saved on this device. */
  cached: number;
  /** Bytes those saved grid images take on this device. */
  bytes: number;
  /** A warm-up pass is downloading right now. */
  running: boolean;
};

function readProgress(running: boolean): ArtCacheProgress {
  const grid = loadIndex().filter((e) => e.kind === "grid");
  return {
    cached: grid.length,
    bytes: grid.reduce((sum, e) => sum + (e.s ?? 0), 0),
    running,
  };
}

const progressListeners = new Set<() => void>();

function emitProgress(_running: boolean) {
  for (const fn of progressListeners) fn();
}

/** Synchronous snapshot of what is actually saved on this device. */
export function getArtCacheProgress(): ArtCacheProgress {
  return readProgress(warmupRunning);
}

/** Live progress for the Settings line: re-reads the on-device index
    whenever the warm-up (or any art view) saves something new, and
    polls gently while Settings is open so counts stay honest. */
export function useArtCacheProgress(): ArtCacheProgress {
  const [progress, setProgress] = useState<ArtCacheProgress>(() =>
    typeof window === "undefined"
      ? { cached: 0, bytes: 0, running: false }
      : readProgress(warmupRunning),
  );
  useEffect(() => {
    const update = () => setProgress(readProgress(warmupRunning));
    progressListeners.add(update);
    update();
    const timer = window.setInterval(update, 3000);
    return () => {
      progressListeners.delete(update);
      window.clearInterval(timer);
    };
  }, []);
  return progress;
}

type WarmupMeta = { version: string; total: number };

function readWarmupMeta(): WarmupMeta | null {
  try {
    const raw = window.localStorage.getItem(WARMUP_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WarmupMeta;
    return typeof parsed.version === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function saveWarmupMeta(meta: WarmupMeta) {
  try {
    window.localStorage.setItem(WARMUP_META_KEY, JSON.stringify(meta));
  } catch {
    // Best-effort: the next open just re-checks the cache itself.
  }
}

/** Wipe the current cache generation (artwork was replaced). */
async function clearArtCache(): Promise<void> {
  try {
    if ("caches" in window) await caches.delete(CACHE_NAME);
    saveIndex([]);
  } catch {
    // Best-effort: stale entries are still version-pruned on start.
  }
}

let warmupRunning = false;

const idleYield = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 30);
  });

async function waitUntilOnline(): Promise<boolean> {
  // Pause (don't spin) while offline; give up for this open after
  // about a minute — the next open resumes where this one stopped,
  // because progress is the cache itself.
  for (let i = 0; i < 30; i++) {
    if (typeof navigator === "undefined" || navigator.onLine) return true;
    await new Promise((r) => window.setTimeout(r, 2000));
  }
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/**
 * Start the background artwork warm-up for one server plan (the
 * getArtworkWarmup response). Safe to call on every app open: it
 * no-ops when a pass for the same plan is already running or the
 * cache already holds every image, downloads only what's missing,
 * and — when the plan's artwork generation differs from the one
 * last completed here — wipes the old cache first so replaced
 * artwork is re-downloaded instead of served stale.
 *
 * Order is the plan's order: the user's own collection first, then
 * the wider catalog set by set. Two downloads at a time, yielding
 * between batches, so browsing is never blocked.
 */
export function startArtworkWarmup(plan: {
  ids: number[];
  total: number;
  ownedTotal?: number;
  priorityIds?: number[];
  artworkVersion: string;
}): void {
  if (warmupRunning) return;
  warmupRunning = true;
  emitProgress(true);
  void (async () => {
    try {
      const meta = readWarmupMeta();
      if (meta && meta.version !== plan.artworkVersion) {
        // Artwork generation changed (an update replaced art):
        // drop the old copies so the warm-up re-downloads fresh.
        await clearArtCache();
      }
      const cache = await openCache();
      if (!cache) return;
      const present = new Set<string>();
      try {
        const keys = await cache.keys();
        for (const req of keys) present.add(new URL(req.url).pathname);
      } catch {
        // Fall through with an empty set: downloads are idempotent.
      }
      const missing = plan.ids.filter(
        (id) => !present.has(keyFor(id, "grid")),
      );
      if (missing.length > 0) {
        let cursor = 0;
        const worker = async (): Promise<void> => {
          while (cursor < missing.length) {
            if (!(await waitUntilOnline())) return;
            const id = missing[cursor];
            cursor += 1;
            if (id == null) continue;
            const blob = await fetchSourceBlob(id);
            if (blob) await cachePut(id, "grid", blob);
            if (cursor % 4 === 0) {
              emitProgress(true);
              await idleYield();
            }
          }
        };
        await Promise.all([worker(), worker()]);
      }
      // Two-across copies (Nov 4, 2026): the 640px variant is
      // pre-cached for the priority printings and the user's
      // own collection — the segment at the head of the plan —
      // so cataloging at two-across never decodes full-res art
      // mid-scroll. The wider catalog at this size would run to
      // hundreds of MB on-device, so the rest cache on demand
      // as their pockets render, exactly like full-res art.
      const largeWanted = [
        ...new Set([
          ...(plan.priorityIds ?? []),
          ...plan.ids.slice(0, plan.ownedTotal ?? 0),
        ]),
      ];
      const missingLarge = largeWanted.filter(
        (id) => !present.has(keyFor(id, "large")),
      );
      if (missingLarge.length > 0) {
        let cursor = 0;
        const largeWorker = async (): Promise<void> => {
          while (cursor < missingLarge.length) {
            if (!(await waitUntilOnline())) return;
            const id = missingLarge[cursor];
            cursor += 1;
            if (id == null) continue;
            const blob = await fetchSourceBlob(id);
            if (blob) await cachePut(id, "large", blob);
            if (cursor % 4 === 0) await idleYield();
          }
        };
        await Promise.all([largeWorker(), largeWorker()]);
      }
      saveWarmupMeta({ version: plan.artworkVersion, total: plan.total });
    } catch {
      // Best-effort: whatever was saved stays saved, and the next
      // open resumes from the cache's own state.
    } finally {
      warmupRunning = false;
      emitProgress(false);
    }
  })();
}
