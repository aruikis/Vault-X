// The ONE shared long-press drag-reorder mechanism
// (Anthony, Nov 5, 2026): every tile/tab grid in Vault X —
// the TCG Universe games, the Topps Alternate Universe
// areas, the Sports Cards sports, and any future grid —
// reorders through this hook, so the gesture can't work in
// one place and be broken in another. (Home's Your
// Collections tiles and the Library shelves predate it and
// keep their own proven sessions; this hook follows the
// exact contract they established.)
//
// The contract, from Home's on-device lessons:
// - Hold a tile ~400ms until it LIFTS (14px drift budget —
//   a resting thumb drifts more than the old 10px, and a
//   tight budget silently cancelled most real holds).
// - At the lift, the scroll lock goes on SYNCHRONOUSLY:
//   touch-action none on the tile and its grid, the nearest
//   scroll container's overflow locked, and a non-passive
//   touchmove block — pointermove's preventDefault cannot
//   stop native scrolling, and once a scroll latches the
//   browser fires pointercancel and the drag dies.
// - The dragged tile follows the finger by direct DOM
//   transform; other tiles GLIDE to their swapped slots by
//   direct transforms against the geometry cached at lift.
//   Swaps are position swaps, exactly like Home. No React
//   state writes between lift and drop.
// - Release commits the final order ONCE through onCommit
//   (which persists it per user), and the click that ends a
//   drag is swallowed by the suppress timestamp, so a drag
//   never also opens the tile. A normal tap still opens it.

import { useEffect, useRef, useState } from "react";
import { hapticTick } from "./haptics";

const HOLD_MS = 400;
const DRIFT_BUDGET = 14;

export interface DragReorder {
  /** Attach to the grid container. */
  containerRef: (el: HTMLElement | null) => void;
  /** The key currently lifted, or null — for styling. */
  draggingKey: string | null;
  /** Spread onto each item's wrapper element. */
  itemProps: (key: string) => {
    ref: (el: HTMLElement | null) => void;
    onPointerDown: (e: {
      clientX: number;
      clientY: number;
      button?: number;
    }) => void;
  };
  /** True when the tap that just ended was a drag — item
      click handlers call this first and bail when true. */
  suppressClick: () => boolean;
}

export function useDragReorder(opts: {
  /** The committed order of the items on screen. */
  keys: string[];
  /** Called once at drop with the final order. */
  onCommit: (order: string[]) => void;
}): DragReorder {
  const [draggingKey, setDraggingKey] = useState<string | null>(
    null,
  );
  const keysRef = useRef(opts.keys);
  keysRef.current = opts.keys;
  const onCommitRef = useRef(opts.onCommit);
  onCommitRef.current = opts.onCommit;
  const containerElRef = useRef<HTMLElement | null>(null);
  const itemElsRef = useRef(new Map<string, HTMLElement>());
  const suppressUntilRef = useRef(0);
  const sessionRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(
    () => () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    },
    [],
  );

  const itemProps: DragReorder["itemProps"] = (key) => ({
    ref: (el) => {
      if (el) itemElsRef.current.set(key, el);
      else itemElsRef.current.delete(key);
    },
    onPointerDown: (e) => {
      if (e.button != null && e.button > 0) return;
      if (sessionRef.current) return;
      const el = itemElsRef.current.get(key);
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      let lifted = false;
      let dead = false;
      let holdTimer: number | null = null;
      let rafId = 0;
      let lastX = startX;
      let lastY = startY;
      // Drag-session state, set at lift.
      let slots: { left: number; top: number; width: number; height: number }[] =
        [];
      let logicalOrder: string[] = [];
      let scrollerEl: HTMLElement | null = null;
      let scrollerPrevOverflow = "";
      const blockTouchMove = (ev: TouchEvent) => {
        if (lifted) ev.preventDefault();
      };

      const clearTransforms = () => {
        for (const itemEl of itemElsRef.current.values()) {
          itemEl.style.transform = "";
          itemEl.style.transition = "";
          itemEl.style.zIndex = "";
          itemEl.style.position = "";
        }
      };

      const releaseScrollLock = () => {
        el.style.touchAction = "";
        if (containerElRef.current)
          containerElRef.current.style.touchAction = "";
        if (scrollerEl) {
          scrollerEl.style.overflow = scrollerPrevOverflow;
          scrollerEl = null;
        }
        window.removeEventListener("touchmove", blockTouchMove);
      };

      const glideOthers = () => {
        logicalOrder.forEach((k, pos) => {
          if (k === key) return;
          const itemEl = itemElsRef.current.get(k);
          const homePos = keysRef.current.indexOf(k);
          const home = slots[homePos];
          const dest = slots[pos];
          if (!itemEl || !home || !dest) return;
          itemEl.style.transition = "transform 180ms ease";
          itemEl.style.transform = `translate(${dest.left - home.left}px, ${dest.top - home.top}px)`;
        });
      };

      const lift = () => {
        if (dead) return;
        lifted = true;
        hapticTick();
        setDraggingKey(key);
        // Cache the grid geometry once: slot i is where the
        // i-th item sits right now.
        slots = keysRef.current.map((k) => {
          const itemEl = itemElsRef.current.get(k);
          const r = itemEl?.getBoundingClientRect();
          return {
            left: r?.left ?? 0,
            top: r?.top ?? 0,
            width: r?.width ?? 0,
            height: r?.height ?? 0,
          };
        });
        logicalOrder = [...keysRef.current];
        // Scroll lock, synchronously with the lift (see the
        // contract note at the top of this file).
        el.style.touchAction = "none";
        if (containerElRef.current)
          containerElRef.current.style.touchAction = "none";
        let node: HTMLElement | null = el;
        while (node && node !== document.body) {
          const cs = window.getComputedStyle(node);
          if (
            (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
            node.scrollHeight > node.clientHeight
          ) {
            scrollerEl = node;
            break;
          }
          node = node.parentElement;
        }
        if (scrollerEl) {
          scrollerPrevOverflow = scrollerEl.style.overflow;
          scrollerEl.style.overflow = "hidden";
        }
        window.addEventListener("touchmove", blockTouchMove, {
          passive: false,
        });
        el.style.position = "relative";
        el.style.zIndex = "30";
        el.style.transition = "none";
        el.style.transform = "translate(0px, 0px) scale(1.03)";
        el.style.filter =
          "drop-shadow(0 18px 28px rgba(0,0,0,0.55))";
      };

      const onMove = (ev: PointerEvent) => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        if (!lifted) {
          if (
            Math.abs(lastX - startX) > DRIFT_BUDGET ||
            Math.abs(lastY - startY) > DRIFT_BUDGET
          ) {
            cancel();
          }
          return;
        }
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = 0;
          if (dead || !lifted) return;
          const dx = lastX - startX;
          const dy = lastY - startY;
          el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
          // The target slot is the one whose center is
          // nearest the finger; swap positions with it.
          let target = -1;
          let best = Number.POSITIVE_INFINITY;
          slots.forEach((s, i) => {
            const cx = s.left + s.width / 2;
            const cy = s.top + s.height / 2;
            const d =
              (cx - lastX) * (cx - lastX) +
              (cy - lastY) * (cy - lastY);
            if (d < best) {
              best = d;
              target = i;
            }
          });
          const curPos = logicalOrder.indexOf(key);
          if (target >= 0 && target !== curPos) {
            const other = logicalOrder[target];
            if (other != null) {
              logicalOrder[target] = key;
              logicalOrder[curPos] = other;
              hapticTick();
              glideOthers();
            }
          }
        });
      };

      const finish = (commit: boolean) => {
        if (dead) return;
        dead = true;
        if (holdTimer != null) window.clearTimeout(holdTimer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        if (rafId) window.cancelAnimationFrame(rafId);
        sessionRef.current = null;
        if (!lifted) return;
        suppressUntilRef.current = Date.now() + 300;
        releaseScrollLock();
        el.style.filter = "";
        setDraggingKey(null);
        const finalOrder = logicalOrder;
        const changed =
          commit &&
          finalOrder.some((k, i) => k !== keysRef.current[i]);
        if (changed) onCommitRef.current(finalOrder);
        // Let the commit render land, then clear the drag
        // transforms — every item's transform already points
        // at the slot it now really occupies.
        window.setTimeout(clearTransforms, 30);
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);
      function cancel() {
        finish(false);
      }

      holdTimer = window.setTimeout(lift, HOLD_MS);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      sessionRef.current = { cancel };
    },
  });

  return {
    containerRef: (el) => {
      containerElRef.current = el;
    },
    draggingKey,
    itemProps,
    suppressClick: () => Date.now() < suppressUntilRef.current,
  };
}
