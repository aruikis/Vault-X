// History discipline for the three-back rule (Anthony, Nov 4, 2026):
// pressing Back three times from anywhere in Vault X must exit the
// app back to Muse/Jarvis, no matter how many actions were taken.
//
// The discipline:
// - Main-flow navigation (tab switches, set pages, card pages,
//   search is a window, profile pages, admin drills, area picks)
//   REPLACES the single app history entry — it never stacks.
// - A true overlay window (sheet, dialog, explainer, scanner,
//   inbox, tickets, QR, …) may hold ONE pushed entry, so the
//   first Back closes the window and the next Back exits.
// - A window opened while another window already holds that one
//   entry does NOT stack a further entry: it layers into the
//   same entry instead. Every layered window's popstate trap
//   still closes it when the entry is popped.
// - A depth cap (vxDepth) is kept as a safety net so no bug can
//   ever stack past the three-press budget again.

import { useCallback, useEffect, useRef } from "react";

/** The raw history.state, or null when unavailable. */
export function readNavState(): Record<string, unknown> | null {
  try {
    const s = window.history.state;
    return s !== null && typeof s === "object"
      ? (s as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Main-flow navigation: replace the current entry, never push.
    The passed object becomes the entry's state verbatim — call
    sites keep building the exact state objects they use today,
    so refresh-in-place and saved-view restore are untouched. */
export function replaceNavState(next: Record<string, unknown>): void {
  try {
    window.history.replaceState(next, "");
  } catch {
    // History unavailable: the view still switched.
  }
}

/**
 * True overlay window: push ONE entry holding this window's key.
 * When a window already holds the slot (vxWin names its key),
 * or the depth budget is spent, the window layers into the
 * current entry with replaceState instead of stacking — and
 * becomes the slot holder, so closing it releases the slot
 * again. Returns true when a new entry was actually pushed.
 */
export function pushWindowState(
  next: Record<string, unknown>,
  key: string,
): boolean {
  const cur = readNavState();
  const depth =
    typeof cur?.vxDepth === "number" && Number.isFinite(cur.vxDepth)
      ? cur.vxDepth
      : 0;
  try {
    if (typeof cur?.vxWin === "string" || depth >= 2) {
      window.history.replaceState(
        { ...cur, ...next, vxWin: key, vxDepth: Math.max(depth, 1) },
        "",
      );
      return false;
    }
    window.history.pushState(
      {
        ...next,
        vxWin: key,
        vxDepth: depth + 1,
      },
      "",
    );
    return true;
  } catch {
    return false;
  }
}

/** Drop window keys from the current entry in place — used when
    a layered (non-pushed) window closes via its own control, so
    no stale key reseeds it open on a later refresh. When the
    closing window holds the slot, the slot is released with it. */
export function scrubWindowKeys(keys: string[]): void {
  const cur = readNavState();
  if (!cur) return;
  let changed = false;
  const next: Record<string, unknown> = { ...cur };
  for (const k of keys) {
    if (k in next) {
      delete next[k];
      changed = true;
    }
  }
  if (typeof next.vxWin === "string" && keys.includes(next.vxWin)) {
    delete next.vxWin;
    changed = true;
  }
  if (changed) replaceNavState(next);
}

/**
 * A window that lives ABOVE another window and must peel on
 * its own (Anthony, Nov 4, 2026, app-wide back audit): the
 * mail view above the Inbox, deck mail above the Inbox, the
 * tickets window opened from the Inbox, the welcome review
 * above the Admin hub. For these, the shared layering rule
 * backfires — parent and child share ONE entry, so a single
 * Back pops both and lands on whatever sits under the PARENT
 * (Home), not on the parent itself. This variant's open()
 * therefore ALWAYS takes its own pushed entry (the Library
 * flip-binder's proven pattern): base entry + parent entry +
 * this entry is exactly the three-back budget — Back 1 lands
 * on the parent, Back 2 closes the parent, Back 3 exits.
 * Everything else mirrors useWindowHistory: close() goes
 * through history.back() when this open did the push, and a
 * popstate trap closes the window whenever its key leaves
 * the top entry.
 */
export function useOwnEntryWindow(
  key: string,
  setOpen: (v: boolean) => void,
  seededOpen = false,
) {
  const pushedRef = useRef(seededOpen);
  const heldRef = useRef(seededOpen);
  const open = useCallback(() => {
    if (heldRef.current) {
      setOpen(true);
      return;
    }
    setOpen(true);
    const cur = readNavState() ?? {};
    let pushed = false;
    try {
      window.history.pushState(
        {
          ...cur,
          [key]: true,
          vxWin: key,
          vxDepth:
            (typeof cur.vxDepth === "number" &&
            Number.isFinite(cur.vxDepth)
              ? cur.vxDepth
              : 0) + 1,
        },
        "",
      );
      pushed = true;
    } catch {
      // History unavailable: the window still opened; its
      // close will flip state in place.
      pushed = false;
    }
    pushedRef.current = pushed;
    heldRef.current = true;
  }, [key, setOpen]);
  const close = useCallback(() => {
    if (pushedRef.current) {
      try {
        window.history.back();
      } catch {
        pushedRef.current = false;
        heldRef.current = false;
        setOpen(false);
      }
    } else {
      scrubWindowKeys([key]);
      heldRef.current = false;
      setOpen(false);
    }
  }, [key, setOpen]);
  useEffect(() => {
    const onPopState = () => {
      if (heldRef.current && readNavState()?.[key] == null) {
        heldRef.current = false;
        pushedRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key, setOpen]);
  return { open, close };
}

/**
 * The window side of the discipline, mirroring the old
 * useHistorySheet contract: open() shows the window and takes
 * the one history entry (or layers into it); close() goes
 * through history.back() when this open did the push, and
 * otherwise just closes in place. A popstate trap closes the
 * window whenever its key leaves the top entry — pushed or
 * layered alike — so Back never strands it open.
 */
export function useWindowHistory(
  key: string,
  setOpen: (v: boolean) => void,
  seededOpen = false,
) {
  const pushedRef = useRef(seededOpen);
  const heldRef = useRef(seededOpen);
  const open = useCallback(() => {
    if (heldRef.current) {
      setOpen(true);
      return;
    }
    setOpen(true);
    const pushed = pushWindowState({ ...readNavState(), [key]: true }, key);
    pushedRef.current = pushed;
    heldRef.current = true;
  }, [key, setOpen]);
  const close = useCallback(() => {
    if (pushedRef.current) {
      try {
        window.history.back();
      } catch {
        pushedRef.current = false;
        heldRef.current = false;
        setOpen(false);
      }
    } else {
      scrubWindowKeys([key]);
      heldRef.current = false;
      setOpen(false);
    }
  }, [key, setOpen]);
  useEffect(() => {
    const onPopState = () => {
      if (heldRef.current && readNavState()?.[key] == null) {
        heldRef.current = false;
        pushedRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [key, setOpen]);
  return { open, close };
}
