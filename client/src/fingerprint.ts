// On-device card fingerprints for the scanner rebuild (Anthony,
// Nov 3, 2026 — his decision after the slow/wrong vision scans:
// identification moves ON-DEVICE; Jarvis picked option 1 for the
// collector-number leg, so the fingerprint narrows a photo to the
// printings that share its artwork and the USER taps the exact
// printing in the candidates picker — no server OCR tie-break, no
// digit templates, no paid service).
//
// A fingerprint is three small signatures computed from a card's
// artwork on a canvas:
// - a 256-bit difference hash (16x16 gradient bits) — the shape
//   of the art and layout;
// - a 12-byte color signature (mean RGB of the art's four
//   quadrants) — separates same-layout printings in different
//   inks and catches what the gradient hash flattens;
// - a 192-value brightness grid (12x16 grayscale, normalized per
//   image) — added in the v2 recalibration below.
// Distance between two fingerprints is 0 (identical) to 1
// (unrelated): the hash/color pair contributes 35%, the grid 65%.
//
// V2 RECALIBRATION (Nov 3, 2026, later still — Anthony's live
// re-test of v1.54.2): auto capture fired fast, but a clear,
// straight-on, frame-filling photo of the blue Ink Drop STILL
// matched nothing on-device and burned the whole 10 seconds in
// the fallback reader. Measured against that exact photo (the
// screenshot he sent) and the two catalog Ink Drop scans, the
// v1 matcher was the problem, not the photo: the difference hash
// flips a bit wherever a gradient changes sign, so a few pixels
// of framing offset between the photo's best centered crop and
// the catalog scan swung the distance from 0.20 (perfectly
// hand-aligned crop) to 0.42 (the nearest crop the matcher
// actually tried) — past every threshold, for a photo a person
// identifies at a glance. The brightness grid compares LEVELS
// instead of gradient signs, so small offsets cost a little
// distance instead of flipping bits, and it is compared under
// ±1-cell shifts for the same reason. On that same photo, over
// the same coarse crop grid the matcher tries live, the grid
// scores the blue Ink Drop 0.169 against the gold design's
// 0.277 — a clear hit with clear separation, where the hash
// alone scored them 0.325 vs 0.334 (a coin flip). Thresholds
// below are set from those measurements.
//
// The index is built on the device from the artwork the app
// already downloads for browsing (client/src/artCache.ts grid
// thumbnails), one entry per catalog printing, and persisted in
// its own Cache Storage bucket so it survives restarts and only
// rebuilds what a catalog/artwork update changed. Matching a
// photo is a two-stage scan over ~3.7k tiny signatures — a few
// hundred milliseconds, comfortably inside the ~1 second
// target; the photo is tried under a grid of card-shaped crops
// (several widths x several center offsets) because a hand-held
// photo never frames the card exactly like the catalog scan.
//
// V4 REACH PASS (Nov 3, 2026, later still — Anthony re-scanned
// The Queen on the v3 build and she STILL never appeared; the
// result was one candidates group led by Lore Card 9 of 9).
// Verified offline against the real catalog artwork and this
// exact matcher: with her fingerprint IN the index, The Queen
// P3 ranks #1 for every simulated photo (clean, offset, 62%
// fill, simulated cold-foil sheen) — the matcher was never the
// problem; her entry simply was not on the phone yet. Three
// reach holes made that possible and are closed in this pass:
// (1) the index only built while the Scan panel was open, so a
// quick open-and-scan ran against whatever a previous short
// session had persisted — the build now also starts at app
// level next to the artwork warm-up (see App.tsx), so it
// progresses whenever the app is open; (2) "index complete"
// was judged by raw entry count, which a stale persisted index
// can satisfy while missing current printings — completeness
// is now counted against the plan's own ids (countIndexedIds
// below); (3) the full-catalog cross-check only ran AFTER the
// device leg and only while the index was incomplete, so it
// could be squeezed out by the 10-second ceiling or skipped
// outright — the scanner now starts the server reader in
// parallel and consults it whenever the on-device answer is
// anything less than a strong definite on a complete index
// (see beginIdentify in App.tsx). The picker also admits up
// to five distinct artworks (was three) inside its loose
// bound, so a true card sitting a few places behind a wrong
// best still makes the list.
//
// OPTION 2 — INTERNET ROUTE (Nov 3, 2026, later still —
// Anthony's pre-approved fallback, fired after The Queen P3
// #3 failed again on the v4 build): the on-device fingerprint
// no longer has the last word on anything short of a definite
// match on a provably complete index. Its ranked finalists
// (matchPhotoOnDevice's rankedIds) go to the server reader,
// which reads the photo's collector-number line verbatim
// (e.g. "3/P3") and resolves it among the finalists — and,
// because her fingerprint being unbuilt was the whole failure,
// against the full catalog by that line as well. The extra
// second or so is accepted by Anthony: it has to WORK.
//
// V3 ASSURANCE PASS (Nov 3, 2026, later still — Anthony scanned
// The Queen, Promo Set 3 #3, and she was "not even on the list
// at all", then asked what is being done to ENSURE she appears).
// She IS in the catalog (uid 9:2181) — the failure was reach,
// not data. Three silent-drop points are closed here and in the
// scanner flow: (1) a printing whose fingerprint had not been
// built yet could never appear, and the build order left
// unowned promos behind ~2,800 owned main-set cards — promo
// printings now build FIRST with the puzzle inserts (the
// server's priorityIds), and while the index is incomplete the
// scanner cross-checks every on-device result against the
// full-catalog server reader and merges the two, so an
// unbuilt printing is still findable; (2) the candidate window
// (best + 0.05) excluded the true card whenever it ranked a
// few hundredths behind — the nearest distinct artworks now
// always make the picker within a looser bound; (3) the
// coarse stage's 120-finalist cut could drop an off-center
// card before the offset-aware re-rank — now 240. And when a
// photo still places nothing, the nearest indexed printings
// come back as a closest-matches picker instead of an empty
// list.
//
// Thresholds below started as the trial calibration (Anthony,
// Nov 3: ship it, test on real cards, revise if it doesn't work
// in practice) and were recalibrated in v2 from his first real
// failure (see above). They stay deliberately conservative: a
// photo that doesn't clear them is NEVER named as a definite
// card — it becomes candidates to pick from, or falls through
// to the older reader, or lands on the no-match screen with
// search.

export type Fingerprint = {
  /** 256 gradient bits, 32 bytes. */
  hash: Uint8Array;
  /** Mean RGB per quadrant (TL, TR, BL, BR), 12 bytes. */
  quad: Uint8Array;
  /** Brightness grid: 12x16 grayscale normalized per image
      (mean 0, unit variance), quantized to int8 x48 and stored
      offset by +128 so it persists as unsigned bytes. */
  grid: Uint8Array;
};

export type FpEntry = Fingerprint & { id: number };

/** Best distance at or under which a lone printing may be named
    definite (and only when no other artwork is close behind).
    V2 calibration: Anthony's real Ink Drop photo, measured
    through its dimmed, downscaled screenshot copy, scores 0.235
    combined against the blue design (grid alone 0.169) — just
    OVER this line, so that copy lands as the clear best
    candidate for him to tap, not a definite naming; the gold
    design sits at 0.306 and cannot reach either line. The live
    capture (brighter, sharper, full-resolution) should score
    lower than the screenshot copy did. */
export const DEFINITE_MAX = 0.23;
/** Best distance at or under which candidates are worth showing
    for the user to pick from. Beyond it: no on-device opinion. */
export const CANDIDATE_MAX = 0.3;
/** Two catalog fingerprints at or under this distance are the
    same artwork (reprints, promo re-issues, finish variants of
    one printing share a cluster). */
export const CLUSTER_EPS = 0.03;
/** How far behind the best a different artwork must be before
    the best can stand alone as definite. */
export const TIE_MARGIN = 0.025;

// ---------------------------------------------------------------------
// Pure signature math (no DOM — unit-testable).
// ---------------------------------------------------------------------

const POPCOUNT = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let n = i;
    let c = 0;
    while (n) {
      c += n & 1;
      n >>= 1;
    }
    table[i] = c;
  }
  return table;
})();

export function hashDistance(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 1;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    bits += POPCOUNT[(a[i] ?? 0) ^ (b[i] ?? 0)] ?? 0;
  }
  return bits / (len * 8);
}

export function quadDistance(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 1;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return sum / len / 255;
}

/** Brightness-grid dimensions (columns x rows of the card). */
export const GRID_W = 12;
export const GRID_H = 16;
/** Quantization scale for the stored grid: a stored byte holds
    round(normalized * GRID_SCALE) + 128, clamped to 0..255. */
const GRID_SCALE = 48;

/** Distance between two brightness grids: the mean absolute
    difference of the normalized values, minimized over ±1-cell
    shifts (a hand-held photo is never framed cell-perfectly
    against the catalog scan) and scaled so identical grids are
    0 and unrelated layouts land around 0.3 or higher. */
export function gridDistance(a: Uint8Array, b: Uint8Array): number {
  if (a.length < GRID_W * GRID_H || b.length < GRID_W * GRID_H) return 1;
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < GRID_H; y++) {
        const by = y + dy;
        if (by < 0 || by >= GRID_H) continue;
        for (let x = 0; x < GRID_W; x++) {
          const bx = x + dx;
          if (bx < 0 || bx >= GRID_W) continue;
          sum += Math.abs(
            ((a[y * GRID_W + x] ?? 128) - 128) -
              ((b[by * GRID_W + bx] ?? 128) - 128),
          );
          n += 1;
        }
      }
      if (n > 0) {
        const d = sum / n / GRID_SCALE / 2.5;
        if (d < best) best = d;
      }
    }
  }
  return best === Infinity ? 1 : best;
}

export function fpDistance(a: Fingerprint, b: Fingerprint): number {
  const hashColor =
    0.7 * hashDistance(a.hash, b.hash) + 0.3 * quadDistance(a.quad, b.quad);
  return 0.35 * hashColor + 0.65 * gridDistance(a.grid, b.grid);
}

export type RankedHit = { id: number; dist: number };

/** How many coarse-stage finalists get the full crop re-rank.
    The outcome decision only ever reads the top few hits plus
    the winner's same-artwork cluster (computed separately), so
    finalists are all it needs. V3 (Nov 3, 2026, later still —
    The Queen, Promo Set 3 #3, never appeared on the results
    list at all): the coarse stage ranks on CENTERED crops
    only, so a card sitting off-center in the frame can rank
    its true printing below the old 120 cut and lose it before
    the offset-aware re-rank ever sees it. 240 finalists keep
    the re-rank at a few hundred milliseconds and make that
    silent drop far less likely. */
const FINALISTS = 240;

function bestDist(photoFps: Fingerprint[], entry: FpEntry): number {
  let best = Infinity;
  for (const photo of photoFps) {
    const d = fpDistance(photo, entry);
    if (d < best) best = d;
  }
  return best;
}

/** Rank the index against a photo, in two stages (an entry's
    distance is its best crop): the coarse centered crops rank
    every entry, then the full width x offset crop grid re-ranks
    the finalists. One stage over the full grid for ~3.6k
    entries would spend the scan's whole second on arithmetic;
    two stages land in a few hundred milliseconds and the
    finalists keep the full grid's alignment tolerance. */
export function rankEntries(
  photoFps: { coarse: Fingerprint[]; all: Fingerprint[] },
  entries: FpEntry[],
): RankedHit[] {
  const coarseHits: RankedHit[] = [];
  for (const entry of entries) {
    coarseHits.push({ id: entry.id, dist: bestDist(photoFps.coarse, entry) });
  }
  coarseHits.sort((a, b) => a.dist - b.dist);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const hits: RankedHit[] = [];
  for (const hit of coarseHits.slice(0, FINALISTS)) {
    const entry = byId.get(hit.id);
    if (!entry) continue;
    hits.push({ id: hit.id, dist: bestDist(photoFps.all, entry) });
  }
  hits.sort((a, b) => a.dist - b.dist);
  return hits;
}

export type ScanOutcome =
  | { kind: "definite"; cardId: number; dist: number }
  | { kind: "candidates"; cardIds: number[]; dist: number }
  | { kind: "none"; dist: number | null };

/** Decide what a ranking means, the option-1 way:
    - One printing, clearly closest, and no other printing
      shares its artwork: definite.
    - The best artwork is shared by several printings (the
      fingerprint cannot tell reprints apart — that is exactly
      the collector-number leg): all of them go to the picker,
      plus any different artwork scoring suspiciously close.
    - A close-but-not-clear best, or a near tie between
      different artworks: the picker, never a guess.
    - Nothing within CANDIDATE_MAX: no opinion. */
export function selectOutcome(
  ranked: RankedHit[],
  byId: Map<number, FpEntry>,
): ScanOutcome {
  const best = ranked[0];
  if (!best) return { kind: "none", dist: null };
  if (best.dist > CANDIDATE_MAX) return { kind: "none", dist: best.dist };
  const bestEntry = byId.get(best.id);
  if (!bestEntry) return { kind: "none", dist: best.dist };
  // The best printing's same-artwork cluster.
  const cluster: number[] = [];
  for (const entry of byId.values()) {
    if (fpDistance(bestEntry, entry) <= CLUSTER_EPS) cluster.push(entry.id);
  }
  const clusterSet = new Set(cluster);
  // Closest printing whose artwork is NOT the best's artwork.
  const secondDistinct = ranked.find((h) => !clusterSet.has(h.id));
  if (
    best.dist <= DEFINITE_MAX &&
    cluster.length === 1 &&
    (secondDistinct == null ||
      secondDistinct.dist - best.dist >= TIE_MARGIN ||
      secondDistinct.dist > CANDIDATE_MAX)
  ) {
    return { kind: "definite", cardId: best.id, dist: best.dist };
  }
  // Candidates: the whole same-artwork cluster first (the user
  // is picking the exact printing of the card in their hand),
  // then any other artwork close enough to be a plausible
  // confusion, capped so the picker stays a short list.
  // V3 widening (Nov 3, 2026 — The Queen P3 #3 was not on the
  // list AT ALL, and the legendary Tiana #196 came back with
  // weak results): the old window only admitted artwork within
  // best + 2*TIE_MARGIN (0.05) of the best score, so the true
  // card — often second or third by a few hundredths on a real
  // photo — was silently excluded from the picker. The nearest
  // few DISTINCT artworks now always make the list while they
  // sit within a looser plausibility bound (best + 0.10, never
  // past 0.40), on top of the close-confusion window. The list
  // is still a picker, never a guess: nothing here is named
  // definite, the user taps the card in their hand.
  const ids: number[] = [...cluster];
  let distinctAdded = 0;
  for (const hit of ranked) {
    if (ids.length >= 8) break;
    if (clusterSet.has(hit.id)) continue;
    const closeWindow = Math.max(CANDIDATE_MAX, best.dist + 2 * TIE_MARGIN);
    const nearestBound = Math.min(
      0.4,
      Math.max(CANDIDATE_MAX, best.dist + 0.1),
    );
    if (hit.dist <= closeWindow || (distinctAdded < 5 && hit.dist <= nearestBound)) {
      ids.push(hit.id);
      distinctAdded += 1;
    }
  }
  return { kind: "candidates", cardIds: ids, dist: best.dist };
}

// ---------------------------------------------------------------------
// Signature extraction from images (DOM canvas).
// ---------------------------------------------------------------------

function drawInto(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  w: number,
  h: number,
): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c2d = canvas.getContext("2d", { willReadFrequently: true });
  if (!c2d) return null;
  c2d.drawImage(source, 0, 0, sw, sh, 0, 0, w, h);
  try {
    return c2d.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

/** Fingerprint of an image that IS one card, full-frame (a
    catalog scan, or a photo crop already framed on the card). */
export function fingerprintOf(
  source: CanvasImageSource,
  sw: number,
  sh: number,
): Fingerprint | null {
  // Difference hash: grayscale at 17x16, bit = left pixel
  // brighter than its right neighbour, row-major.
  const hashData = drawInto(source, sw, sh, 17, 16);
  if (!hashData) return null;
  const gray = new Float32Array(17 * 16);
  for (let i = 0; i < gray.length; i++) {
    const r = hashData.data[i * 4] ?? 0;
    const g = hashData.data[i * 4 + 1] ?? 0;
    const b = hashData.data[i * 4 + 2] ?? 0;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const hash = new Uint8Array(32);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const bitIndex = y * 16 + x;
      if ((gray[y * 17 + x] ?? 0) > (gray[y * 17 + x + 1] ?? 0)) {
        hash[bitIndex >> 3] =
          (hash[bitIndex >> 3] ?? 0) | (1 << (7 - (bitIndex & 7)));
      }
    }
  }
  // Quadrant colors at 32x44 (roughly card aspect).
  const quadData = drawInto(source, sw, sh, 32, 44);
  if (!quadData) return null;
  const quad = new Uint8Array(12);
  const sums = new Float32Array(12);
  const counts = new Float32Array(4);
  for (let y = 0; y < 44; y++) {
    for (let x = 0; x < 32; x++) {
      const q = (y < 22 ? 0 : 2) + (x < 16 ? 0 : 1);
      const i = (y * 32 + x) * 4;
      sums[q * 3] = (sums[q * 3] ?? 0) + (quadData.data[i] ?? 0);
      sums[q * 3 + 1] = (sums[q * 3 + 1] ?? 0) + (quadData.data[i + 1] ?? 0);
      sums[q * 3 + 2] = (sums[q * 3 + 2] ?? 0) + (quadData.data[i + 2] ?? 0);
      counts[q] = (counts[q] ?? 0) + 1;
    }
  }
  for (let q = 0; q < 4; q++) {
    const n = counts[q] || 1;
    quad[q * 3] = Math.round((sums[q * 3] ?? 0) / n);
    quad[q * 3 + 1] = Math.round((sums[q * 3 + 1] ?? 0) / n);
    quad[q * 3 + 2] = Math.round((sums[q * 3 + 2] ?? 0) / n);
  }
  // Brightness grid at 12x16, normalized per image (mean 0, unit
  // variance) so a photo taken under different light than the
  // catalog scan still compares on layout and art levels.
  const gridData = drawInto(source, sw, sh, GRID_W, GRID_H);
  if (!gridData) return null;
  const cells = new Float32Array(GRID_W * GRID_H);
  let gMean = 0;
  for (let i = 0; i < cells.length; i++) {
    const v =
      0.299 * (gridData.data[i * 4] ?? 0) +
      0.587 * (gridData.data[i * 4 + 1] ?? 0) +
      0.114 * (gridData.data[i * 4 + 2] ?? 0);
    cells[i] = v;
    gMean += v;
  }
  gMean /= cells.length;
  let gVar = 0;
  for (let i = 0; i < cells.length; i++) {
    const d = (cells[i] ?? 0) - gMean;
    gVar += d * d;
  }
  const gStd = Math.sqrt(gVar / cells.length) || 1;
  const grid = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < cells.length; i++) {
    const q = Math.round((((cells[i] ?? 0) - gMean) / gStd) * GRID_SCALE);
    grid[i] = Math.min(255, Math.max(0, q + 128));
  }
  return { hash, quad, grid };
}

/** Fingerprints of a hand-held photo under card-shaped crops
    (card aspect 5:7) at several widths AND several center
    offsets, plus the whole frame. Two sets come back:
    - coarse: centered crops only — cheap enough to rank the
      whole index with;
    - all: every width x offset combination — used to re-rank
      the coarse stage's finalists, because the card in a real
      photo is never exactly centered (in Anthony's Ink Drop
      photo it sits measurably right and low of center, and the
      v1 centered-only crops were the miss). A crop box is
      clamped inside the frame; duplicates a clamp produces are
      dropped. Crop canvases are capped small — the signatures
      sample at 32x44 at most, so resolution beyond that only
      costs phone time. */
export function photoFingerprints(img: HTMLImageElement): {
  coarse: Fingerprint[];
  all: Fingerprint[];
} {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (W === 0 || H === 0) return { coarse: [], all: [] };
  const coarse: Fingerprint[] = [];
  const all: Fingerprint[] = [];
  const seen = new Set<string>();
  const crop = (cw: number, ch: number, dx: number, dy: number, coarseSet: boolean) => {
    const cx = W / 2 + dx * W;
    const cy = H / 2 + dy * H;
    const x0 = Math.min(Math.max(0, cx - cw / 2), Math.max(0, W - cw));
    const y0 = Math.min(Math.max(0, cy - ch / 2), Math.max(0, H - ch));
    const box = `${Math.round(x0)},${Math.round(y0)},${Math.round(cw)},${Math.round(ch)}`;
    if (seen.has(box)) return;
    seen.add(box);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 256 / Math.max(cw, ch));
    canvas.width = Math.max(8, Math.round(cw * scale));
    canvas.height = Math.max(8, Math.round(ch * scale));
    const c2d = canvas.getContext("2d");
    if (!c2d) return;
    c2d.drawImage(
      img,
      Math.round(x0),
      Math.round(y0),
      Math.round(cw),
      Math.round(ch),
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const fp = fingerprintOf(canvas, canvas.width, canvas.height);
    if (!fp) return;
    all.push(fp);
    if (coarseSet) coarse.push(fp);
  };
  for (const wf of [0.52, 0.6, 0.68, 0.76, 0.84, 0.92]) {
    let cw = W * wf;
    let ch = (cw * 7) / 5;
    if (ch > H * 0.98) {
      ch = H * 0.98;
      cw = (ch * 5) / 7;
    }
    for (const dx of [-0.08, 0, 0.08]) {
      for (const dy of [-0.08, 0, 0.08]) {
        crop(cw, ch, dx, dy, dx === 0 && dy === 0);
      }
    }
  }
  const whole = fingerprintOf(img, W, H);
  if (whole) {
    all.push(whole);
    coarse.push(whole);
  }
  return { coarse, all };
}

// ---------------------------------------------------------------------
// The persisted on-device index + background builder.
// ---------------------------------------------------------------------

// V2 (Nov 3, 2026): entries gained the brightness grid, which a
// v1 persisted index does not hold — a new cache bucket makes
// every device rebuild once instead of matching grid-less.
const FP_CACHE_NAME = "lorcana-fp-v2";
const FP_KEY = "/__fpcache/index.json";

const entriesById = new Map<number, FpEntry>();
let loadedVersion: string | null = null;
let loadPromise: Promise<void> | null = null;
let building = false;
/** The running build's queue (ids + how far the workers have
    claimed), shared so a later ensureFpIndex call can promote
    priority ids inside the tail the workers have not reached
    yet instead of being turned away by the building flag. */
let activeQueue: { ids: number[]; cursor: number } | null = null;
let planTotal = 0;

const listeners = new Set<() => void>();
function emit() {
  for (const fn of listeners) fn();
}

export type FpIndexSnapshot = {
  built: number;
  total: number;
  building: boolean;
};

export function getFpIndexSnapshot(): FpIndexSnapshot {
  return { built: entriesById.size, total: planTotal, building };
}

/** How many of the given plan ids the index actually holds.
    Completeness is judged against the plan's own ids (V4,
    Nov 3, 2026 — The Queen P3 #3 re-test): a raw entry count
    can look complete while a stale or shifted persisted index
    is missing the very printing being scanned, so the scanner
    only trusts its on-device answer alone when EVERY plan id
    is present. */
export function countIndexedIds(ids: number[]): number {
  let n = 0;
  for (const id of ids) {
    if (entriesById.has(id)) n += 1;
  }
  return n;
}

export function subscribeFpIndex(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(s);
}

function b64ToBytes(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function loadPersisted(version: string): Promise<void> {
  if (loadedVersion === version) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (!("caches" in window)) {
        loadedVersion = version;
        return;
      }
      const cache = await caches.open(FP_CACHE_NAME);
      const hit = await cache.match(FP_KEY);
      if (hit) {
        const parsed = (await hit.json()) as {
          v?: string;
          e?: Record<string, { h: string; q: string; g?: string }>;
        };
        if (parsed.v === version && parsed.e) {
          entriesById.clear();
          for (const [idText, sig] of Object.entries(parsed.e)) {
            const id = Number(idText);
            if (!Number.isFinite(id)) continue;
            // An entry without its grid (a pre-v2 save) cannot
            // take part in the combined distance — leave it out
            // so the build refills it.
            if (!sig.g) continue;
            entriesById.set(id, {
              id,
              hash: b64ToBytes(sig.h),
              quad: b64ToBytes(sig.q),
              grid: b64ToBytes(sig.g),
            });
          }
        }
      }
    } catch {
      // A lost index just rebuilds from the artwork cache.
    }
    loadedVersion = version;
    emit();
  })();
  return loadPromise;
}

let persistTimer: number | null = null;
function persistSoon(version: string) {
  if (persistTimer != null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void (async () => {
      try {
        if (!("caches" in window)) return;
        const e: Record<string, { h: string; q: string; g: string }> = {};
        for (const entry of entriesById.values()) {
          e[String(entry.id)] = {
            h: bytesToB64(entry.hash),
            q: bytesToB64(entry.quad),
            g: bytesToB64(entry.grid),
          };
        }
        const cache = await caches.open(FP_CACHE_NAME);
        await cache.put(
          FP_KEY,
          new Response(JSON.stringify({ v: version, e }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch {
        // Persistence is best-effort; the in-memory index works
        // for this session regardless.
      }
    })();
  }, 1200);
}

/**
 * Make sure the fingerprint index exists for this catalog plan,
 * building whatever is missing from the on-device artwork (the
 * caller's getBlob supplies a card's art — the art cache's grid
 * copy when present, downloading it when not). Safe to call on
 * every scanner open: it no-ops once complete, resumes where a
 * previous pass stopped, and never blocks the caller.
 */
export function ensureFpIndex(
  plan: {
    ids: number[];
    total: number;
    artworkVersion: string;
    /** Ids to fingerprint before everything else (the server's
        imaged puzzle inserts — the Ink Drop counters and the one
        assembled-puzzle photo). They are few, they sit at the
        very end of the plan's warm-up order, and they are the
        items with no collector number / ink / cost for any
        other identification path to read, so leaving them to
        the end of a ~3,600-image build left them unrecognizable
        in Anthony's first live test (Nov 3, 2026). */
    priorityIds?: number[];
  },
  getBlob: (cardId: number) => Promise<Blob | null>,
): void {
  planTotal = plan.total;
  void loadPersisted(plan.artworkVersion).then(() => {
    emit();
    if (building && activeQueue) {
      // A build is already running (started by an earlier
      // scanner open, possibly by a build of this app whose plan
      // had no priorities): promote this plan's priority ids to
      // the front of the UNPROCESSED tail and append anything
      // the running queue never heard of. Without this, the
      // v1.54.2 priority fix silently did nothing whenever the
      // index build from a previous open was still in flight —
      // the Ink Drops stayed at the end of a queue that takes
      // minutes to drain.
      const queued = new Set(activeQueue.ids.slice(activeQueue.cursor));
      const promote: number[] = [];
      for (const id of plan.priorityIds ?? []) {
        if (!entriesById.has(id) && queued.has(id)) promote.push(id);
      }
      if (promote.length > 0) {
        const promoteSet = new Set(promote);
        const tail = activeQueue.ids
          .slice(activeQueue.cursor)
          .filter((id) => !promoteSet.has(id));
        activeQueue.ids.splice(
          activeQueue.cursor,
          activeQueue.ids.length - activeQueue.cursor,
          ...promote,
          ...tail,
        );
      }
      for (const id of plan.ids) {
        if (!entriesById.has(id) && !queued.has(id)) {
          activeQueue.ids.push(id);
        }
      }
      return;
    }
    if (building) return;
    const missingSet = new Set(
      plan.ids.filter((id) => !entriesById.has(id)),
    );
    if (missingSet.size === 0) return;
    // Priority ids first (in the server's order), then the rest
    // of the plan in its own order — own collection first.
    const missing: number[] = [];
    for (const id of plan.priorityIds ?? []) {
      if (missingSet.delete(id)) missing.push(id);
    }
    for (const id of plan.ids) {
      if (missingSet.delete(id)) missing.push(id);
    }
    if (missing.length === 0) return;
    building = true;
    const queue = { ids: missing, cursor: 0 };
    activeQueue = queue;
    emit();
    void (async () => {
      try {
        let sincePersist = 0;
        const worker = async (): Promise<void> => {
          while (queue.cursor < queue.ids.length) {
            const id = queue.ids[queue.cursor];
            queue.cursor += 1;
            if (id == null) continue;
            try {
              const blob = await getBlob(id);
              if (blob) {
                const bmp = await createImageBitmap(blob);
                const fp = fingerprintOf(bmp, bmp.width, bmp.height);
                bmp.close();
                if (fp) {
                  entriesById.set(id, { id, ...fp });
                  sincePersist += 1;
                  if (sincePersist >= 120) {
                    sincePersist = 0;
                    persistSoon(plan.artworkVersion);
                    emit();
                  }
                }
              }
            } catch {
              // One bad image never stops the build.
            }
          }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        persistSoon(plan.artworkVersion);
      } finally {
        building = false;
        if (activeQueue === queue) activeQueue = null;
        emit();
      }
    })();
  });
}

/** Match a photo (already loaded as an image) against the
    on-device index. Null when the index is still empty. Runs in
    a few hundred milliseconds once the photo's own signatures
    are drawn — well inside the scan's 5-second ceiling. */
export function matchPhotoOnDevice(img: HTMLImageElement): {
  outcome: ScanOutcome;
  coverage: number;
  /** The index's ranked finalists for this photo, best first
      (OPTION 2 internet route, Nov 3, 2026, later still —
      Anthony pre-approved the pivot and it fired after The
      Queen P3 #3 failed AGAIN on the v4 build: "even if it
      takes us another second, I just need it to work"). The
      scanner hands these ids to the server reader, which reads
      the photo's collector-number LINE and resolves it among
      these finalists first — the fingerprint narrows, the
      server's line read decides. Advisory only: the server
      also checks the full catalog by that same line, so a
      printing whose fingerprint is not built yet (the exact
      hole The Queen kept falling through) is still findable. */
  rankedIds: number[];
  /** When the outcome is "none", the nearest printings the
      index DID have, best first, within a loose plausibility
      bound — the caller's last-resort picker, so a scan that
      cannot place a card shows its closest matches instead of
      an empty list (V3, Nov 3, 2026 — The Queen P3 #3 miss:
      "not even on the list at all" must never be the outcome
      when the device had near matches sitting in the index). */
  closestIds: number[];
} | null {
  if (entriesById.size === 0) return null;
  const photoFps = photoFingerprints(img);
  if (photoFps.all.length === 0) return null;
  const entries = [...entriesById.values()];
  const ranked = rankEntries(photoFps, entries);
  const outcome = selectOutcome(ranked, entriesById);
  const closestIds =
    outcome.kind === "none"
      ? ranked
          .filter((h) => h.dist <= 0.4)
          .slice(0, 5)
          .map((h) => h.id)
      : [];
  return {
    outcome,
    coverage: entriesById.size,
    closestIds,
    rankedIds: ranked.slice(0, 40).map((h) => h.id),
  };
}
