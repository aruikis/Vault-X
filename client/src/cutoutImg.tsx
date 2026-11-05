import { useEffect, useState, type CSSProperties } from "react";
import { api } from "./api";

/**
 * Studio-background removal for product photos (Anthony,
 * Nov 4, 2026; matte rebuilt the same night after his live
 * report that the Millennium Falcon STILL wore its white
 * box on the Library shelf): a displayed Funko figure must
 * stand on the shelf — and everywhere else its photo
 * renders: grid, search, detail — as the product itself,
 * never inside the white/studio backdrop baked into its
 * catalog photo.
 *
 * How it works now: the photo's own background colour is
 * SAMPLED from its four corners (a real studio backdrop is
 * one light, low-chroma colour — white, off-white, or the
 * light warm/grey gradient the catalogs use; the first
 * version's fixed near-white gate rejected those and kept
 * the box). The matte floods inward from the edges through
 * pixels close to that sampled colour, so gradients go
 * too; a soft product shadow under the figure survives as
 * a faint contact shadow, the way a figure really sits,
 * and the silhouette edge is feathered one pixel.
 *
 * When the direct load cannot be read at all — the source
 * host sends no CORS headers, or hotlink-blocks the photo —
 * the SAME pixels are fetched through the app's own server
 * (getGameImageProxy: the catalog row's stored URL, fetched
 * once and cached), and the matte runs on that copy. If the
 * photo still is not a studio shot, or anything fails, the
 * ORIGINAL photo is used untouched — a real photo always
 * beats a mangled cutout. Nothing here ever invents pixels.
 */

const cutoutCache = new Map<string, Promise<string | null>>();
const proxyCache = new Map<
  number,
  Promise<{ url: string; cut: string | null } | null>
>();

function loadImage(
  src: string,
  cors: boolean,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    // A blackholed connection (a host that accepts and
    // never answers) fires neither load nor error — without
    // a deadline the whole rescue chain hangs on it and
    // the photo never appears. Seven seconds is generous
    // for a catalog photo; past it, the proxied copy gets
    // its turn.
    const timer = setTimeout(
      () => reject(new Error("image load timed out")),
      7000,
    );
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("image load failed"));
    };
    img.src = src;
  });
}

/**
 * Runs the matte on an already-loaded image. `readable` is
 * false only when the canvas itself refused the pixels
 * (a tainted canvas) — the signal that the server-proxied
 * copy is worth trying; a readable photo that simply is
 * not a studio shot reports readable with a null url.
 */
function makeMatte(img: HTMLImageElement): {
  url: string | null;
  readable: boolean;
} {
  const maxDim = 560;
  const scale = Math.min(
    1,
    maxDim / Math.max(img.naturalWidth, img.naturalHeight),
  );
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) return { url: null, readable: false };
  g.drawImage(img, 0, 0, w, h);
  let imageData: ImageData;
  try {
    imageData = g.getImageData(0, 0, w, h);
  } catch {
    // Canvas tainted despite the load mode: the pixels are
    // unreadable from here.
    return { url: null, readable: false };
  }
  const d = imageData.data;
  const total = w * h;
  const ch = (p: number, o: number) => d[p * 4 + o] ?? 0;
  const minC = (p: number) => Math.min(ch(p, 0), ch(p, 1), ch(p, 2));
  const chroma = (p: number) =>
    Math.max(ch(p, 0), ch(p, 1), ch(p, 2)) - minC(p);
  // Sample the background from 5x5 patches at the four
  // corners and average them into one reference colour.
  const patchAvg = (x0: number, y0: number): [number, number, number] => {
    let r = 0;
    let gg = 0;
    let b = 0;
    let n = 0;
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const x = Math.min(w - 1, x0 + dx);
        const y = Math.min(h - 1, y0 + dy);
        const p = y * w + x;
        r += ch(p, 0);
        gg += ch(p, 1);
        b += ch(p, 2);
        n++;
      }
    }
    return [r / n, gg / n, b / n];
  };
  const corners = [
    patchAvg(0, 0),
    patchAvg(Math.max(0, w - 5), 0),
    patchAvg(0, Math.max(0, h - 5)),
    patchAvg(Math.max(0, w - 5), Math.max(0, h - 5)),
  ];
  const avgOf = (
    ps: [number, number, number][],
  ): [number, number, number] => [
    ps.reduce((a, c) => a + c[0], 0) / ps.length,
    ps.reduce((a, c) => a + c[1], 0) / ps.length,
    ps.reduce((a, c) => a + c[2], 0) / ps.length,
  ];
  const agreesWith = (
    ps: [number, number, number][],
    ref: [number, number, number],
  ) =>
    ps.every((c) =>
      [0, 1, 2].every((i) => Math.abs((c[i] ?? 0) - (ref[i] ?? 0)) <= 42),
    );
  let bg = avgOf(corners);
  // A studio backdrop is uniform: if the corners disagree
  // with each other, this is a scene photo — keep it whole.
  if (!agreesWith(corners, bg)) {
    // Salvage path (Nov 5, 2026): the full frame does not
    // sit on one sweep when the BOTTOM corners hold
    // something else — a price sticker, a hand, the edge of
    // a box — while the TOP edge is a clean studio sweep.
    // Trust the
    // two top corners alone when they agree with each other:
    // the flood below only ever removes pixels matching
    // this background that stay connected to the frame's
    // edge (the box's pixels never seed it), and every
    // product-protection guard further down still applies,
    // so a wrong call here keeps the photo whole anyway.
    const topBg = avgOf([corners[0]!, corners[1]!]);
    if (!agreesWith([corners[0]!, corners[1]!], topBg)) {
      return { url: null, readable: true };
    }
    bg = topBg;
  }
  const bgMin = Math.min(bg[0], bg[1], bg[2]);
  const bgChroma = Math.max(bg[0], bg[1], bg[2]) - bgMin;
  // …and light and near-neutral. Anything darker or more
  // colourful is a real backdrop, not a studio sweep.
  if (bgMin < 185 || bgChroma > 48) {
    return { url: null, readable: true };
  }
  const dist = (p: number) =>
    Math.max(
      Math.abs(ch(p, 0) - bg[0]),
      Math.abs(ch(p, 1) - bg[1]),
      Math.abs(ch(p, 2) - bg[2]),
    );
  const bgLike = (p: number) => dist(p) <= 30;
  // The soft shadow a product throws on the sweep: darker
  // than the backdrop, still near-neutral, not far from it.
  // NARROWED HARD (Anthony, Nov 5, 2026 — the Millennium
  // Falcon failure): the old band (any neutral pixel at
  // least 10 darker than the backdrop and up to 130 away
  // from it) matched LIGHT-GRAY PRODUCT — the Falcon's hull
  // is neutral light gray, so the flood ate the whole ship
  // as "shadow" and rendered it at ~12% opacity, a black
  // silhouette over the dark detail page. A real contact
  // shadow hugs the backdrop's own value: never more than
  // ~55 levels darker and never far from its color.
  // Anything darker or further away is product, not shadow.
  const shadowLike = (p: number) =>
    chroma(p) <= 26 &&
    minC(p) >= bgMin - 55 &&
    minC(p) <= bgMin - 8 &&
    dist(p) <= 55;
  const removed = new Uint8Array(total);
  const shadow = new Uint8Array(total);
  const stack: number[] = [];
  const seed = (p: number) => {
    if (!removed[p] && (bgLike(p) || shadowLike(p))) stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  let removedCount = 0;
  let shadowCount = 0;
  while (stack.length > 0) {
    const p = stack.pop();
    if (p === undefined || removed[p]) continue;
    if (bgLike(p)) {
      removed[p] = 1;
    } else if (shadowLike(p)) {
      removed[p] = 1;
      shadow[p] = 1;
      shadowCount++;
    } else {
      continue;
    }
    removedCount++;
    const x = p % w;
    const y = Math.floor(p / w);
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // PRODUCT-PROTECTION GUARD (same Falcon fix): a contact
  // shadow is a thin pool under a product — a small share
  // of the frame. If the "shadow" class claims a big share
  // of the picture, it is eating the product itself (a
  // light-gray hull, a white costume, a pale set), no
  // matter how the thresholds were tuned. Restore every
  // shadow-classified pixel to the full-color product and
  // keep only the true-background removal: the figure must
  // NEVER be ghosted or silhouetted by its own matte.
  if (shadowCount > total * 0.05 || shadowCount > removedCount * 0.35) {
    for (let p = 0; p < total; p++) {
      if (shadow[p]) {
        shadow[p] = 0;
        removed[p] = 0;
      }
    }
    removedCount -= shadowCount;
    shadowCount = 0;
  }
  // PRODUCT-MASS GUARD (Anthony, Nov 5, 2026 — the Falcon
  // cases, again): even with the shadow band narrowed, a
  // flood that tunnels through a faint edge into a
  // light-gray product (a Falcon hull, a pale figure)
  // shatters the product into islands of surviving pixels
  // with transparent holes between them — on the dark page
  // that reads as a black, mangled silhouette. A real
  // product is ONE connected mass (plus maybe a small
  // loose accessory): if the largest connected run of
  // surviving pixels is under half of everything that
  // survived, the matte ate the product — reject it whole
  // and keep the real photo, per this file's standing rule
  // that a real photo always beats a mangled cutout.
  {
    const seen = new Uint8Array(total);
    const stack2: number[] = [];
    let largestMass = 0;
    let surviving = 0;
    const masses: number[] = [];
    for (let p0 = 0; p0 < total; p0++) {
      if (removed[p0] || seen[p0]) continue;
      let mass = 0;
      seen[p0] = 1;
      stack2.push(p0);
      while (stack2.length > 0) {
        const p = stack2.pop();
        if (p === undefined) break;
        mass++;
        const x = p % w;
        const y = Math.floor(p / w);
        if (x > 0 && !removed[p - 1] && !seen[p - 1]) {
          seen[p - 1] = 1;
          stack2.push(p - 1);
        }
        if (x < w - 1 && !removed[p + 1] && !seen[p + 1]) {
          seen[p + 1] = 1;
          stack2.push(p + 1);
        }
        if (y > 0 && !removed[p - w] && !seen[p - w]) {
          seen[p - w] = 1;
          stack2.push(p - w);
        }
        if (y < h - 1 && !removed[p + w] && !seen[p + w]) {
          seen[p + w] = 1;
          stack2.push(p + w);
        }
      }
      surviving += mass;
      masses.push(mass);
      if (mass > largestMass) largestMass = mass;
    }
    if (surviving > 0 && largestMass < surviving * 0.5) {
      // Multi-part products (Nov 5, 2026 — the Dr. Peter
      // Venkman with Firehouse case, measured on the real
      // photo): a Pop! Town set is a building, a SEPARATE
      // figure, and its own box — three substantial masses,
      // none of them half the whole, so the single-mass
      // rule rejected a perfectly clean matte and the white
      // box stayed. What this guard actually protects
      // against is a SHATTERED product: surviving pixels
      // scattered across many small fragments. A multi-part
      // product instead keeps almost everything in a few
      // substantial masses (each at least 5 percent of what
      // survived, together at least 85 percent) — accept
      // that shape; still reject the shattered one.
      const substantial = masses
        .filter((m) => m >= surviving * 0.05)
        .reduce((a, m) => a + m, 0);
      if (substantial < surviving * 0.85) {
        return { url: null, readable: true };
      }
    }
  }
  // Sanity: a matte that removes almost nothing changed
  // nothing, and one that removes almost everything was
  // never a product photo to begin with.
  if (removedCount < total * 0.02 || removedCount > total * 0.9) {
    return { url: null, readable: true };
  }
  for (let p = 0; p < total; p++) {
    if (removed[p]) {
      // Shadow pixels keep a whisper of alpha so the figure
      // grounds itself instead of floating; true background
      // goes fully transparent.
      d[p * 4 + 3] = shadow[p]
        ? Math.max(
            10,
            Math.min(85, Math.round((bgMin - minC(p)) * 0.5)),
          )
        : 0;
    }
  }
  // One-pixel feather: a surviving light pixel touching the
  // cut edge goes slightly translucent, softening the halo
  // the studio lighting leaves around a silhouette.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (removed[p] || minC(p) < 175) continue;
      const touches =
        (x > 0 && removed[p - 1] === 1) ||
        (x < w - 1 && removed[p + 1] === 1) ||
        (y > 0 && removed[p - w] === 1) ||
        (y < h - 1 && removed[p + w] === 1);
      if (touches) {
        d[p * 4 + 3] = Math.min(ch(p, 3), 150);
      }
    }
  }
  g.putImageData(imageData, 0, 0);
  try {
    return { url: canvas.toDataURL("image/png"), readable: true };
  } catch {
    return { url: null, readable: false };
  }
}

/**
 * The server-proxied copy of a catalog item's photo
 * (getGameImageProxy), with its matte when one applies.
 * The proxied URL is same-origin, so its pixels are always
 * readable here — this is the path that rescues photos
 * whose hosts send no CORS headers or block hotlinking.
 */
function resolveProxied(
  proxyId: number,
): Promise<{ url: string; cut: string | null } | null> {
  let pending = proxyCache.get(proxyId);
  if (!pending) {
    pending = (async () => {
      try {
        const r = await api.getGameImageProxy({ id: proxyId });
        if (!r.ok || !r.url) return null;
        let cut: string | null = null;
        try {
          const img = await loadImage(r.url, false);
          cut = makeMatte(img).url;
        } catch {
          cut = null;
        }
        return { url: r.url, cut };
      } catch {
        return null;
      }
    })();
    proxyCache.set(proxyId, pending);
  }
  return pending;
}

/** The proxied display URL for a catalog item's photo, or
    null when the server could not fetch it either. */
export function getProxiedUrl(proxyId: number): Promise<string | null> {
  return resolveProxied(proxyId).then((p) => p?.url ?? null);
}

async function computeCutout(
  src: string,
  proxyId?: number | null,
): Promise<string | null> {
  let readable = false;
  try {
    const img = await loadImage(src, true);
    const m = makeMatte(img);
    if (m.url) return m.url;
    readable = m.readable;
  } catch {
    readable = false;
  }
  // The photo was readable and simply is not a studio shot:
  // the same pixels through the proxy would matte no
  // better. Only an unreadable photo earns the proxy trip.
  if (readable || proxyId == null) return null;
  const prox = await resolveProxied(proxyId);
  return prox?.cut ?? null;
}

export function getCutout(
  src: string,
  proxyId?: number | null,
): Promise<string | null> {
  const key = `${proxyId ?? ""}|${src}`;
  let pending = cutoutCache.get(key);
  if (!pending) {
    pending = computeCutout(src, proxyId).catch(() => null);
    cutoutCache.set(key, pending);
  }
  return pending;
}

/**
 * The best display state for a photo: its cutout once one
 * is ready (isCutout true), the original src until then
 * (and forever, when no cutout is possible).
 */
export function useCutoutState(
  src: string | null,
  proxyId?: number | null,
): { url: string | null; isCutout: boolean } {
  const [state, setState] = useState<{
    url: string | null;
    isCutout: boolean;
  }>({ url: src, isCutout: false });
  useEffect(() => {
    setState({ url: src, isCutout: false });
    if (!src) return;
    let live = true;
    void getCutout(src, proxyId).then((cut) => {
      if (live && cut) setState({ url: cut, isCutout: true });
    });
    return () => {
      live = false;
    };
  }, [src, proxyId]);
  return state;
}

/**
 * The cutout URL for a photo once it is ready; the original
 * src until then (and forever, when no cutout is possible).
 */
export function useCutoutUrl(
  src: string | null,
  proxyId?: number | null,
): string | null {
  return useCutoutState(src, proxyId).url;
}

/**
 * An <img> that swaps its studio background for the cutout
 * as soon as the cutout is ready. With a proxyId (the
 * catalog item's id), a photo that will not even LOAD from
 * its source host falls back to the server-proxied copy of
 * the same photo before giving up. A photo that fails every
 * path renders the same clean dashed placeholder the game
 * catalog uses — never a broken-image icon.
 */
export function CutoutImg({
  src,
  alt,
  className,
  style,
  placeholderText,
  proxyId,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  placeholderText: string;
  /** game_cards id: enables the server-proxied copy of this
      photo when the source host blocks reading or loading
      it directly. */
  proxyId?: number | null;
}) {
  const { url, isCutout } = useCutoutState(src, proxyId);
  const [rescued, setRescued] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // The img stays invisible until its pixels actually
  // arrive: a dead source URL must never paint the
  // browser's broken-image glyph into the box while the
  // proxy rescue is still in flight (seen live in the
  // Funko search rows, Nov 5, 2026 — rows flashed the
  // broken icon for seconds before the rescue landed).
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setRescued(null);
    setFailed(false);
    setLoaded(false);
  }, [src, proxyId]);
  // A finished cutout always wins; the rescued (proxied,
  // uncut) copy only stands in while no cutout exists.
  const shown = isCutout ? url : (rescued ?? url);
  useEffect(() => {
    setLoaded(false);
  }, [shown]);
  // Watchdog, in two stages so a slow-but-working rescue
  // is never latched off early: if the shown photo neither
  // loads nor errors within seven seconds (a blackholed
  // host), stage one takes the proxied copy for display;
  // if there is still nothing seven seconds after that,
  // the clean placeholder settles it. A tile must never
  // sit empty forever on a hung connection — and a
  // finished cutout always overrides a latched failure,
  // because it still may land after the placeholder.
  const [watchdogStage, setWatchdogStage] = useState(0);
  useEffect(() => {
    setWatchdogStage(0);
  }, [src, proxyId]);
  useEffect(() => {
    if (isCutout) setFailed(false);
  }, [isCutout]);
  useEffect(() => {
    if (loaded || failed || !shown || isCutout) return;
    const timer = setTimeout(() => {
      if (watchdogStage === 0 && proxyId != null && rescued == null) {
        void getProxiedUrl(proxyId).then((u) => {
          if (u) setRescued(u);
        });
        setWatchdogStage(1);
      } else {
        setFailed(true);
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [shown, loaded, failed, proxyId, rescued, isCutout, watchdogStage]);
  if (failed || !shown) {
    return (
      <span
        className={`flex items-center justify-center border border-dashed border-[var(--border)] bg-black/20 px-1 text-center text-[10px] text-[var(--dim)] ${className ?? ""}`}
        style={style}
        aria-label={alt}
        role="img"
      >
        {placeholderText}
      </span>
    );
  }
  return (
    <img
      src={shown}
      alt={alt}
      loading="lazy"
      ref={(el) => {
        // A cached copy can finish before the load event
        // is observed; never leave a loaded photo invisible.
        if (el && el.complete && el.naturalWidth > 0) {
          setLoaded(true);
        }
      }}
      className={`${className ?? ""} ${loaded ? "" : "opacity-0"}`}
      style={style}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (proxyId != null && rescued == null) {
          // The source host refused the photo itself: show
          // the app's own proxied copy of the same photo.
          void getProxiedUrl(proxyId).then((u) => {
            if (u) setRescued(u);
            else setFailed(true);
          });
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
