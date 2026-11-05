// The sideways count dial (Anthony, Nov 3, 2026 — his exact
// design): long-holding a + stepper opens a small horizontal
// dial. Tapping a number submits IMMEDIATELY — the count
// becomes that number ("you own nine cards") — no confirm
// step, no scrolling list. Shared by every ownership stepper
// in the app: card-detail finishes, the Sealed shelf tiles,
// the Where-it-lives copies bar on card, sealed, and comic
// details.
//
// NUMBER RANGE REDESIGN (Anthony, Nov 4, 2026): the quick
// buttons are 1 through 6 ONLY — 7, 8, and 9 are deleted —
// and right after them sits an OPEN BOX: a type-in field
// that takes ANY number (his example: 15 copies) and saves
// it with its Set button. Big counts are typed, not tapped.
//
// PLACEMENT RULE (Anthony, Nov 3, 2026, ~2:59 AM, live test):
// the dial must open ABOVE the + button it belongs to — never
// below it, where the holding thumb covers it. Every call
// site renders this component directly above its stepper row.
//
// FULL RANGE EVERYWHERE (Anthony, Nov 3, 2026, ~3:08 AM, live
// test): on the Sealed shelf the dial "only goes up to 4" —
// the shelf tiles are narrow and the tile clips its content
// (overflow-hidden), so the higher numbers sat past the
// tile's edge, unreachable. The `overlay` mode fixes that
// for narrow hosts: the dial renders as a full-width
// floating panel (portaled to the document body, so no
// ancestor can clip it) anchored directly above the spot
// where it was opened, with the whole row in reach. Wide
// hosts (item details) keep the plain in-flow dial, which
// fits there.
//
// DISMISS RULE (Anthony, Nov 3, 2026, ~3:08 AM): if the dial
// was opened by accident, tapping anywhere else on the
// screen closes it WITHOUT changing or saving the count —
// and that tap is swallowed whole, so the thing tapped
// (another stepper included) does not also fire. Escape
// closes it too. The ✕ on the dial still closes it as
// before.
//
// BACK-BUTTON DISMISS (Anthony, Nov 3, 2026, ~10:17 AM): the
// phone's back button/gesture also closes the dial without
// saving, instead of navigating back. The dial pushes a
// history entry when it opens (the same pattern as the
// app's sheets): a back press pops that entry and the
// popstate listener closes the dial — the view underneath
// never moves. Programmatic closes (tap-outside, Escape,
// ✕, a pick) consume the pushed entry via history.back()
// so no stale entry is left behind.

import {
useEffect,
useLayoutEffect,
useRef,
useState,
} from "react";
import { createPortal } from "react-dom";
import { hapticConfirm } from "./haptics";
import {
  pushWindowState,
  readNavState,
  scrubWindowKeys,
} from "./historyNav";

export function SidewaysCountDial({
  label,
  current,
  onPick,
  onClose,
  overlay = false,
}: {
  /** Accessible name for the dial, e.g. "Pick how many copies of X you own". */
  label: string;
  /** The count currently in force (highlighted when it is 1-6). */
  current: number;
  /** Tapping a number: the count becomes that number, saved at once. */
  onPick: (n: number) => void;
  onClose: () => void;
  /** Narrow hosts (Sealed shelf tiles): float the dial as a
      full-width panel above the opening spot instead of
      squeezing it into the host's width. */
  overlay?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Back-button dismiss (see BACK-BUTTON DISMISS above):
  // pushedRef tracks whether this dial did the push; heldRef
  // tracks whether its key is live in the top entry (three-back
  // rule: the dial layers into the open window's entry when one
  // already holds the slot). dismiss() is the close path every
  // programmatic dismissal uses, so the entry is always
  // consumed exactly once.
  const pushedRef = useRef(false);
  const heldRef = useRef(false);
  const dismissRef = useRef<() => void>(() => {});
  dismissRef.current = () => {
    if (pushedRef.current) {
      try {
        // The popstate listener below sees the pushed entry
        // gone, clears the flag, and closes the dial.
        window.history.back();
        return;
      } catch {
        pushedRef.current = false;
      }
    }
    heldRef.current = false;
    scrubWindowKeys(["lorcanaCountDial"]);
    closeRef.current();
  };
  useEffect(() => {
    pushedRef.current = pushWindowState(
      { lorcanaCountDial: true },
      "lorcanaCountDial",
    );
    heldRef.current = true;
    const onPopState = () => {
      if (
        heldRef.current &&
        readNavState()?.lorcanaCountDial !== true
      ) {
        heldRef.current = false;
        pushedRef.current = false;
        closeRef.current();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Tap-outside-to-dismiss (see DISMISS RULE above): a
  // capture-phase pointerdown anywhere outside the panel
  // closes the dial, and the click that follows that same
  // tap is swallowed too, so nothing underneath fires.
  useEffect(() => {
    let dismissedAt = 0;
    const isInside = (t: EventTarget | null) => {
      if (!(t instanceof Node)) return false;
      if (panelRef.current?.contains(t)) return true;
      if (anchorRef.current?.contains(t)) return true;
      return false;
    };
    const onDown = (e: PointerEvent) => {
      if (isInside(e.target)) return;
      dismissedAt = Date.now();
      dismissRef.current();
      e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (dismissedAt !== 0 && Date.now() - dismissedAt < 700) {
        dismissedAt = 0;
        if (!isInside(e.target)) {
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Overlay anchoring: the in-flow anchor marks the spot the
  // dial was opened from (directly above the stepper); the
  // fixed panel floats just above that spot, as wide as the
  // screen allows (up to 350px), aligned to the anchor's
  // right edge and clamped inside the screen.
  const [pos, setPos] = useState<{ bottom: number; left: number; width: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    if (!overlay) return;
    const measure = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const width = Math.min(350, window.innerWidth - 16);
      const left = Math.min(
        Math.max(8, r.right - width),
        window.innerWidth - width - 8,
      );
      setPos({ bottom: window.innerHeight - r.top + 8, left, width });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [overlay]);

  const [typed, setTyped] = useState("");
  const submitTyped = () => {
    const n = Number.parseInt(typed.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) return;
    hapticConfirm();
    onPick(n);
    dismissRef.current();
  };

  const row = (compact: boolean) => (
    <>
      <div
        role="listbox"
        aria-label={label}
        className={`flex items-center justify-between rounded-full border border-[var(--border)] bg-[var(--bg)] ${
          compact ? "gap-0.5 p-1" : "gap-1 p-1.5"
        }`}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={n === current}
            aria-label={`Set the count to ${n}`}
            onClick={() => {
              hapticConfirm();
              onPick(n);
              dismissRef.current();
            }}
            className={`flex items-center justify-center rounded-full tabular-nums ${
              compact
                ? "h-8 min-w-0 flex-1 text-[13px]"
                : "h-9 w-9 shrink-0 text-sm"
            } ${
              n === current
                ? "bg-[var(--gold)] font-bold text-black shadow-[0_0_14px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                : "border border-[var(--border)] bg-[var(--surface)] font-semibold text-[var(--text)]"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dismissRef.current()}
          aria-label="Close the count dial"
          className={`flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] leading-none text-[var(--dim)] ${
            compact
              ? "h-8 min-w-0 flex-1 text-sm"
              : "h-9 w-9 shrink-0 text-base"
          }`}
        >
          ✕
        </button>
      </div>
      {/* The open box (Anthony, Nov 4, 2026): any count at
          all, typed — for the collector with 15 copies, not
          just the 1–6 the quick buttons cover. Enter or the
          Set button saves it, exactly like tapping a number. */}
      <form
        className="mt-1.5 flex items-center gap-1.5 px-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          submitTyped();
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Any number — e.g. 15"
          aria-label="Type any number of copies"
          className="h-9 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 text-sm font-semibold tabular-nums text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
        />
        <button
          type="submit"
          disabled={typed.trim() === ""}
          className="h-9 shrink-0 rounded-full bg-[var(--gold)] px-4 text-sm font-bold text-black disabled:opacity-50"
        >
          Set
        </button>
      </form>
      <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-[var(--dim)]">
        Tap a number, or type any count and tap Set — saved right away.
      </p>
    </>
  );

  if (overlay) {
    return (
      <>
        <div ref={anchorRef} aria-hidden="true" />
        {pos
          ? createPortal(
              <div
                ref={panelRef}
                className="count-dial-panel fixed z-[80] rounded-[26px] p-2"
                style={{
                  bottom: pos.bottom,
                  left: pos.left,
                  width: pos.width,
                }}
              >
                {row(true)}
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <div ref={panelRef} className="count-dial-panel mb-2.5 rounded-[26px] p-2">
      {row(false)}
    </div>
  );
}
