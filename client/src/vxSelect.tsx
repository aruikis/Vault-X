// The ONE dropdown style for the whole app (Anthony, Nov 3,
// 2026): the native <select> popups rendered as flat grey
// system panels with radio circles on his phone — "ugly and
// old" — so every dropdown in Vault X is now this in-app
// component instead: an on-theme pill trigger (Vault Dark
// surface, rounded, chevron) opening a rounded dark panel
// whose selected row carries the accent wash and a check
// mark. Options and behavior are exactly what the old
// selects offered — same values, same change handlers —
// only the presentation is shared and modern. Used by the
// profile filters, sort menus, Viewing/group selectors,
// marketplace browse, deck editor, listing form, and price
// alerts; any future dropdown uses this too.

import { useEffect, useId, useRef, useState } from "react";
import { hapticTick } from "./haptics";
import {
readNavState,
scrubWindowKeys,
useWindowHistory,
} from "./historyNav";

export interface VxOption {
  value: string;
  label: string;
}

export function VxSelect({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  className,
  dense = false,
  align = "left",
}: {
  value: string;
  onChange: (value: string) => void;
  options: VxOption[];
  ariaLabel?: string;
  id?: string;
  /** Sizing/width classes for the wrapper (the trigger fills it). */
  className?: string;
  /** Compact text/padding for tight rows (profile header). */
  dense?: boolean;
  /** Which edge the panel hugs when it outgrows the trigger. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value);

  // Back-button discipline (Anthony, Nov 5, 2026 — the
  // Settings back report): an open dropdown is a window, so
  // it takes the window slot like every sheet in the app —
  // the phone's Back then CLOSES the dropdown and stays on
  // the page, instead of popping the app's own entry and
  // leaving Vault X. This is the Settings case he kept
  // hitting (the Theme and Language pickers live there),
  // and because every dropdown in the app is this one
  // component, the fix covers all of them at once. Closing
  // by selection, outside tap, or Escape consumes the entry
  // through the same contract (history.back() when this
  // open pushed, an in-place scrub when it layered).
  const winKey = `vxSelect-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const win = useWindowHistory(winKey, setOpen);
  const winRef = useRef(win);
  winRef.current = win;
  // Unmount while open (a parent sheet closed around it):
  // drop the key in place so nothing stale reseeds it.
  useEffect(
    () => () => {
      if (readNavState()?.[winKey] != null) {
        scrubWindowKeys([winKey]);
      }
    },
    [winKey],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as Node)
      ) {
        winRef.current.close();
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") winRef.current.close();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          hapticTick();
          if (open) win.close();
          else win.open();
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-full border text-left font-medium text-[var(--text)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
          dense ? "px-3 py-2 text-xs" : "px-3.5 py-2 text-sm"
        } ${
          open
            ? "border-[var(--accent)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        <span className="min-w-0 truncate">
          {selected?.label ?? value}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 shrink-0 text-[var(--dim)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute top-full z-50 mt-2 max-h-64 min-w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.6)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ width: "max-content", maxWidth: "82vw" }}
        >
          {options.map((o) => {
            const isSel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  hapticTick();
                  if (!isSel) onChange(o.value);
                  win.close();
                }}
                className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 text-left transition ${
                  dense ? "py-2 text-xs" : "py-2.5 text-sm"
                } ${
                  isSel
                    ? "bg-[var(--accent)]/15 font-semibold text-[var(--text)]"
                    : "text-[var(--text)] hover:bg-white/5 active:bg-white/5"
                }`}
              >
                <span>{o.label}</span>
                {isSel ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-[var(--accent)]"
                  >
                    <path d="m4.5 12.5 5 5 10-11" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
