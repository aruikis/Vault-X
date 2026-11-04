// "Where it lives", merged into the Copies owned bar (Anthony,
// Nov 2, 2026, his placement change after reviewing the first
// version): there is NO standalone section at the bottom of the
// detail page anymore. Instead the Copies owned bar itself is
// split in half — the LEFT half is "Where it lives", the RIGHT
// half is "Copies owned" with its stepper — and tapping the left
// half opens a dropdown: pick a preset spot (Binder, Deck box,
// Trade box, Bulk box), pick a place you have used before (your
// custom entries are remembered and offered on every item), or
// "Create custom…" and type your own. Each spot keeps its own
// copy count, the placed-vs-owned line shows compactly under the
// bar, and a spot's count can be changed or the spot removed
// from inside the dropdown. Locations are only ever what the
// user typed in; nothing is pre-filled or guessed.

import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { hapticConfirm, hapticTick } from "./haptics";
import { SidewaysCountDial } from "./countDial";

type LocType = "binder" | "deck_box" | "trade_box" | "bulk_box" | "other";

const PRESETS: ReadonlyArray<{ value: LocType; label: string }> = [
  { value: "binder", label: "Binder" },
  { value: "deck_box", label: "Deck box" },
  { value: "trade_box", label: "Trade box" },
  { value: "bulk_box", label: "Bulk box" },
];

const TYPE_LABEL: Record<string, string> = {
  binder: "Binder",
  deck_box: "Deck box",
  trade_box: "Trade box",
  bulk_box: "Bulk box",
  other: "Custom",
};

function placeHint(locType: LocType): { label: string; placeholder: string } {
  switch (locType) {
    case "binder":
      return {
        label: "Binder",
        placeholder: "e.g. Vault X XL — Binder 3 (Sets 13–14)",
      };
    case "deck_box":
      return {
        label: "Deck box / deck",
        placeholder: "e.g. Blue deck box — Clue Crew Tempo",
      };
    case "trade_box":
      return { label: "Trade box", placeholder: "e.g. Trade Box A" };
    case "bulk_box":
      return { label: "Bulk box", placeholder: "e.g. Bulk Box 2" };
    default:
      return {
        label: "Your location",
        placeholder: "e.g. Glass display case in the office",
      };
  }
}

function spotHint(locType: LocType): { label: string; placeholder: string } {
  switch (locType) {
    case "binder":
      return {
        label: "Page / pocket",
        placeholder: "e.g. Hyperia City page, pocket next to the foil",
      };
    case "bulk_box":
      return {
        label: "Row / section",
        placeholder: "e.g. Row 3, rares section",
      };
    default:
      return { label: "Spot (optional)", placeholder: "e.g. Top row" };
  }
}

/** Stepper button with the same oversized touch target as the
    app's other steppers (Anthony's thumb rule): the visible
    circle stays neat, the tappable box is 56px, and negative
    margins keep the layout footprint at the circle's size. */
function BarStepperButton({
  label,
  onClick,
  disabled,
  glyph,
  onLongPress,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  glyph: string;
  /** Long-hold behavior (Anthony, Nov 3, 2026): holding the
      button opens the scrollable count picker instead of
      stepping once. The click that follows a long hold is
      swallowed so the count doesn't also step. */
  onLongPress?: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);
  const endPress = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => {
        if (!onLongPress || disabled) return;
        longFired.current = false;
        endPress();
        timer.current = window.setTimeout(() => {
          longFired.current = true;
          hapticConfirm();
          onLongPress();
        }, 450);
      }}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
      onClick={() => {
        if (longFired.current) {
          longFired.current = false;
          return;
        }
        hapticTick();
        onClick();
      }}
      className="relative -m-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-35"
    >
      <span
        aria-hidden="true"
        data-dir={glyph === "+" ? "plus" : "minus"}
        className="stepper-ring flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none"
      >
        {glyph}
      </span>
    </button>
  );
}

/** The merged bar: "Where it lives" (left, dropdown) + "Copies
    owned" (right, stepper). Extra rows (a card's per-finish
    steppers) can ride underneath inside the same cell via
    children. The bar's background follows the host sheet —
    sealed sheets pass their surface tone, card/comic sheets the
    page tone. */
export function OwnedLocationBar({
  targetKind,
  cardId,
  sealedName,
  comicId,
  ownedQty,
  copiesQty,
  onCopiesMinus,
  onCopiesPlus,
  onCopiesSet,
  copiesMinusDisabled,
  copiesPlusDisabled,
  copiesItemName,
  barClassName,
  children,
}: {
  targetKind: "card" | "sealed" | "comic";
  cardId: number | null;
  sealedName: string | null;
  comicId: string | null;
  /** How many copies exist in total, for the placed line. */
  ownedQty: number | null;
  /** The number the right half shows (total copies owned). */
  copiesQty: number;
  /** Omit both steppers for a fixed count (a graded slab is 1). */
  onCopiesMinus?: () => void;
  onCopiesPlus?: () => void;
  /** Set the count directly (the long-press count picker):
      picking a number sets it and saves automatically. */
  onCopiesSet?: (qty: number) => void;
  copiesMinusDisabled?: boolean;
  copiesPlusDisabled?: boolean;
  /** Item name used in the stepper aria-labels. */
  copiesItemName: string;
  barClassName: string;
  children?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const queryKey = [
    "itemLocations",
    targetKind,
    cardId ?? sealedName ?? comicId ?? "",
  ] as const;
  const locations = useQuery({
    queryKey,
    queryFn: () =>
      api.listItemLocations({ targetKind, cardId, sealedName, comicId }),
    retry: 2,
  });
  const known = useQuery({
    queryKey: ["knownLocations"],
    queryFn: () => api.listKnownLocations({}),
    retry: 2,
  });
  const rows = locations.data?.locations ?? [];
  const placed = rows.reduce((s, r) => s + r.qty, 0);

  const [open, setOpen] = useState(false);
  const [countPickerOpen, setCountPickerOpen] = useState(false);
  const [formType, setFormType] = useState<LocType | null>(null);
  const [place, setPlace] = useState("");
  const [spot, setSpot] = useState("");
  const [qty, setQty] = useState("1");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["itemLocations"] });
    void queryClient.invalidateQueries({ queryKey: ["knownLocations"] });
  };

  const add = useMutation({
    mutationFn: (args: {
      locType: LocType;
      place: string;
      spot: string | null;
      qty: number;
    }) =>
      api.addItemLocation({
        targetKind,
        cardId,
        sealedName,
        comicId,
        locType: args.locType,
        place: args.place,
        spot: args.spot,
        qty: args.qty,
      }),
    onSuccess: () => {
      hapticConfirm();
      setFormType(null);
      setPlace("");
      setSpot("");
      setQty("1");
      invalidate();
    },
  });
  const changeQty = useMutation({
    mutationFn: (args: { id: number; qty: number }) =>
      api.setItemLocationQty(args),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteItemLocation({ id }),
    onSuccess: invalidate,
  });

  const rowKey = (locType: string, p: string, s: string | null) =>
    `${locType}|${p}|${s ?? ""}`;
  const onThisItem = new Set(rows.map((r) => rowKey(r.locType, r.place, r.spot)));
  const knownChoices = (known.data?.locations ?? []).filter(
    (k) => !onThisItem.has(rowKey(k.locType, k.place, k.spot)),
  );

  const summary =
    rows.length === 0
      ? "Add a spot"
      : rows.length === 1
        ? (rows[0]?.place ?? "1 spot")
        : `${rows.length} spots`;

  const startForm = (t: LocType) => {
    setFormType(t);
    setPlace("");
    setSpot("");
    setQty("1");
  };

  const placeField = formType ? placeHint(formType) : null;
  const spotField = formType ? spotHint(formType) : null;
  const qtyValid =
    qty.trim() !== "" &&
    Number.isFinite(Number(qty)) &&
    Number(qty) >= 1 &&
    Number(qty) <= 999;
  const canSave =
    formType != null && place.trim() !== "" && qtyValid && !add.isPending;

  return (
    <div
      className={`overflow-hidden rounded-lg ${barClassName}`}
    >
      {/* Long-press count dial (Anthony, Nov 3, 2026 — his
          exact design): hold the + stepper and a SIDEWAYS dial
          opens, numbers 1-9 in a row; tapping one makes that
          the count and saves it right away, no confirm step.
          It renders ABOVE the bar (Nov 3, ~2:59 AM fix): below
          the bar it opened under his thumb and got covered. */}
      {countPickerOpen && onCopiesSet ? (
        <div className="border-b border-[var(--border)] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
            How many copies?
          </p>
          <SidewaysCountDial
            overlay
            label={`Pick how many copies of ${copiesItemName} you own`}
            current={copiesQty}
            onPick={(n) => {
              setCountPickerOpen(false);
              onCopiesSet(n);
            }}
            onClose={() => setCountPickerOpen(false)}
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2">
        {/* LEFT half — Where it lives (dropdown trigger) */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Where it lives: ${summary}. Tap to ${open ? "close" : "open"} the location menu.`}
          onClick={() => {
            hapticTick();
            setOpen((v) => !v);
          }}
          className="flex min-w-0 items-center gap-2 border-r border-[var(--border)] px-3 py-2.5 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
              Where it lives
            </span>
            <span
              className={`block truncate text-sm font-medium leading-snug ${
                rows.length === 0
                  ? "text-[var(--gold-soft)]"
                  : "text-[var(--text)]"
              }`}
            >
              {summary}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`ml-auto shrink-0 text-xs text-[var(--dim)] transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        {/* RIGHT half — Copies owned with its stepper */}
        <div className="flex items-center justify-between gap-1 px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
              Copies owned
            </span>
            <span
              className={`block text-sm font-medium leading-snug text-[var(--text)] ${
                copiesQty === 0 ? "zero-owned" : ""
              }`}
            >
              {copiesQty} {copiesQty === 1 ? "copy" : "copies"}
            </span>
          </span>
          {onCopiesMinus && onCopiesPlus ? (
            <span className="flex shrink-0 items-center gap-2">
              <BarStepperButton
                label={`Remove one ${copiesItemName}`}
                disabled={copiesMinusDisabled}
                onClick={onCopiesMinus}
                glyph="−"
              />
              <span
                className={`min-w-6 text-center text-base font-semibold leading-none tabular-nums text-[var(--text)] ${
                  copiesQty === 0 ? "zero-owned" : ""
                }`}
              >
                {copiesQty}
              </span>
              <BarStepperButton
                label={`Add one ${copiesItemName} — hold to pick a count`}
                disabled={copiesPlusDisabled}
                onClick={onCopiesPlus}
                onLongPress={
                  onCopiesSet
                    ? () => setCountPickerOpen((v) => !v)
                    : undefined
                }
                glyph="+"
              />
            </span>
          ) : null}
        </div>
      </div>

      {/* Placed-vs-owned line, compact under the bar */}
      {ownedQty != null && rows.length > 0 ? (
        <p className="border-t border-[var(--border)] px-3 py-1.5 text-[11px] leading-relaxed text-[var(--dim)]">
          {placed} of {ownedQty}{" "}
          {ownedQty === 1 ? "copy" : "copies"} placed
          {placed < ownedQty ? ` — ${ownedQty - placed} not placed yet` : ""}
          {placed > ownedQty ? " — that's more than you own, worth a look" : ""}
          .
        </p>
      ) : null}

      {/* The dropdown panel */}
      {open ? (
        <div className="border-t border-[var(--border)] px-3 py-3">
          {rows.length > 0 ? (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-[var(--bg)] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-snug text-[var(--text)]">
                      <span className="font-semibold">
                        {TYPE_LABEL[r.locType] ?? "Custom"}:
                      </span>{" "}
                      {r.place}
                    </p>
                    <button
                      type="button"
                      aria-label={`Remove location ${r.place}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(r.id)}
                      className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--dim)]"
                    >
                      Remove
                    </button>
                  </div>
                  {r.spot ? (
                    <p className="mt-0.5 text-xs leading-snug text-[var(--dim)]">
                      {r.spot}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-[var(--dim)]">
                      {r.qty === 1 ? "Copy" : "Copies"} here
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`One fewer copy at ${r.place}`}
                        disabled={r.qty <= 1 || changeQty.isPending}
                        onClick={() =>
                          changeQty.mutate({ id: r.id, qty: r.qty - 1 })
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-base text-[var(--text)] disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-sm font-semibold tabular-nums text-[var(--text)]">
                        {r.qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`One more copy at ${r.place}`}
                        disabled={changeQty.isPending}
                        onClick={() =>
                          changeQty.mutate({ id: r.id, qty: r.qty + 1 })
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-base text-[var(--text)] disabled:opacity-40"
                      >
                        +
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-[var(--dim)]">
              No storage spot yet for this{" "}
              {targetKind === "comic"
                ? "slab"
                : targetKind === "sealed"
                  ? "item"
                  : "card"}
              . Pick a spot below and you&rsquo;ll find it in seconds
              later.
            </p>
          )}

          {formType == null ? (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
                Add a spot
              </p>
              <div
                className="mt-1.5 flex flex-wrap gap-1.5"
                role="group"
                aria-label="Add a storage spot"
              >
                {PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => startForm(p.value)}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold-soft)]"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => startForm("other")}
                  className="rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold-soft)]"
                >
                  Create custom…
                </button>
              </div>
              {knownChoices.length > 0 ? (
                <>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--dim)]">
                    Places you have used before
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {knownChoices.map((k) => (
                      <button
                        key={rowKey(k.locType, k.place, k.spot)}
                        type="button"
                        disabled={add.isPending}
                        aria-label={`Put this item in ${k.place}`}
                        onClick={() =>
                          add.mutate({
                            locType: (k.locType as LocType) ?? "other",
                            place: k.place,
                            spot: k.spot,
                            qty: 1,
                          })
                        }
                        className="rounded-full bg-[var(--bg)] px-3 py-1.5 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--border)] disabled:opacity-50"
                      >
                        {TYPE_LABEL[k.locType] ?? "Custom"}: {k.place}
                        {k.spot ? ` — ${k.spot}` : ""}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="mt-3 rounded-lg bg-[var(--bg)] p-3">
              <p className="text-sm font-semibold text-[var(--text)]">
                {formType === "other"
                  ? "Create a custom spot"
                  : `Add a ${TYPE_LABEL[formType] ?? "spot"}`}
              </p>
              <label className="mt-2.5 block text-xs font-medium text-[var(--dim)]">
                {placeField?.label}
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder={placeField?.placeholder}
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text)]"
                />
              </label>
              <label className="mt-2.5 block text-xs font-medium text-[var(--dim)]">
                {spotField?.label}
                <input
                  type="text"
                  value={spot}
                  onChange={(e) => setSpot(e.target.value)}
                  placeholder={spotField?.placeholder}
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text)]"
                />
              </label>
              <label className="mt-2.5 block text-xs font-medium text-[var(--dim)]">
                Copies there
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="999"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="mt-1 w-24 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text)]"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => {
                    if (formType == null) return;
                    add.mutate({
                      locType: formType,
                      place: place.trim(),
                      spot: spot.trim() === "" ? null : spot.trim(),
                      qty: Math.max(1, Math.min(999, Number(qty) || 1)),
                    });
                  }}
                  className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  {add.isPending ? "Saving…" : "Save location"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormType(null)}
                  className="rounded-full border border-[var(--border)] px-3.5 py-2 text-sm text-[var(--dim)]"
                >
                  Cancel
                </button>
              </div>
              {add.isError ? (
                <p className="mt-2 text-xs text-red-400">
                  That location didn&rsquo;t save — try again.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {children ? (
        <div className="border-t border-[var(--border)] px-3 py-2.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
