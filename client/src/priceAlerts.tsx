// Price alerts — the setter box on an item's detail view plus the
// dedicated management page behind its "Price alerts" heading
// (Anthony, Nov 3, 2026).
//
// The box lives at the bottom of every item detail (card, sealed
// product, graded comic): it sets alerts for THAT item and lists
// the ones already on it. Its heading reads "Price alerts" and is
// TAPPABLE: tapping it opens the management page, which lists
// EVERY alert the user has set across all of their items — each
// row with the item's artwork, its name, the alert they set, and
// the item's current price — and lets them edit any alert's target
// (direction + threshold) or delete it, in place.
//
// Alerts are strictly per-user: they live in the app's own
// database behind getPriceAlerts / setPriceAlert /
// updatePriceAlert / deletePriceAlert, and this page only ever
// reads and writes through those actions.
//
// Back behavior (the standing rule): the page is its own history
// layer over the item detail it was opened from. Opening pushes
// one history entry that MERGES the underlying detail's entry
// (the useHistorySheet pattern in App.tsx), so Back — the page's
// own Back button or the device/browser gesture — pops only this
// layer and lands right back on that item's detail, never out of
// the app. A refresh while the page is open reopens it in place:
// the box seeds its open state from the surviving history entry.

import { useEffect, useRef, useState } from "react";
import {
useMutation,
useQuery,
useQueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { useCachedArt } from "./artCache";
import { hapticConfirm, hapticTick } from "./haptics";
import {
  pushWindowState,
  readNavState,
  scrubWindowKeys,
} from "./historyNav";
import { VxSelect } from "./vxSelect";

type PriceAlert = ApiResponse<typeof api, "getPriceAlerts">["alerts"][number];

export type PriceAlertTargetKind = "card" | "sealed" | "comic";

export function fmtUSD(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Sealed names carry the "Disney Lorcana: " prefix in the
    catalog; rows read cleaner without it (the detail views trim
    it the same way). */
function displaySealedName(name: string): string {
  return name.replace(/^Disney Lorcana: /, "");
}

const HISTORY_KEY = "lorcanaPriceAlerts";

function historyStateHasAlertsPage(): boolean {
  try {
    return (
      (window.history.state as Record<string, unknown> | null)?.[
        HISTORY_KEY
      ] === true
    );
  } catch {
    return false;
  }
}

/** The management page's history layer (three-back rule,
    Anthony, Nov 4, 2026): open takes the window's one entry
    (layers when a window already holds the slot), close steps
    back through history when this open did the push (consuming
    the entry exactly once), and a device/browser Back that
    lands on an entry without the key closes only this page.
    Seeded from the surviving entry so a refresh reopens the
    page in place. */
function usePriceAlertsPage() {
  const [open, setOpen] = useState<boolean>(() =>
    historyStateHasAlertsPage(),
  );
  const pushedRef = useRef(historyStateHasAlertsPage());
  const heldRef = useRef(pushedRef.current);
  const openPage = () => {
    if (open) return;
    hapticTick();
    setOpen(true);
    if (heldRef.current) return;
    pushedRef.current = pushWindowState(
      { ...(readNavState() ?? {}), [HISTORY_KEY]: true },
      HISTORY_KEY,
    );
    heldRef.current = true;
  };
  const closePage = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      heldRef.current = false;
      scrubWindowKeys([HISTORY_KEY]);
      setOpen(false);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (heldRef.current && !historyStateHasAlertsPage()) {
        heldRef.current = false;
        pushedRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  return { open, openPage, closePage };
}

/** Artwork thumbnail for one alert row: the card's real art
    (on-device cached, like every card thumbnail in the app), the
    sealed product's own photo, or the comic's real cover — the
    hosts pass the photo resolvers in, since the sealed-photo map
    lives in App.tsx and the comic catalog in comics.tsx. When a
    photo can't be resolved the row keeps a clean labeled tile
    instead of a broken image. */
function AlertThumb({
  alert,
  sealedPhotoFor,
  comicCoverFor,
}: {
  alert: PriceAlert;
  sealedPhotoFor?: (name: string) => string | undefined;
  comicCoverFor?: (id: string) => string | undefined;
}) {
  const { url } = useCachedArt(
    alert.targetKind === "card" ? alert.cardId : null,
    "grid",
    alert.targetKind === "card" && alert.cardId != null,
  );
  if (alert.targetKind === "card") {
    return url ? (
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-14 w-10 shrink-0 rounded-md object-cover"
      />
    ) : (
      <span className="block h-14 w-10 shrink-0 rounded-md bg-[var(--bg)]" />
    );
  }
  if (alert.targetKind === "sealed" && alert.sealedName) {
    const photo = sealedPhotoFor?.(alert.sealedName);
    return photo ? (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)]">
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain p-0.5"
        />
      </span>
    ) : (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[var(--dim)]">
        Sealed
      </span>
    );
  }
  if (alert.targetKind === "comic" && alert.comicId) {
    const cover = comicCoverFor?.(alert.comicId);
    return cover ? (
      <img
        src={cover}
        alt=""
        loading="lazy"
        className="h-14 w-10 shrink-0 rounded-md object-cover"
      />
    ) : (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[var(--dim)]">
        Comic
      </span>
    );
  }
  if (alert.targetKind === "game") {
    return alert.imageUrl ? (
      <img
        src={alert.imageUrl}
        alt=""
        loading="lazy"
        className="h-14 w-10 shrink-0 rounded-md object-cover"
      />
    ) : (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[var(--dim)]">
        Item
      </span>
    );
  }
  return (
    <span className="block h-14 w-10 shrink-0 rounded-md bg-[var(--bg)]" />
  );
}

/** One alert on the management page: artwork + name + the alert +
    the current price, with Edit (in-place direction/threshold
    form) and Delete controls. */
function AlertRow({
  alert,
  sealedPhotoFor,
  comicCoverFor,
}: {
  alert: PriceAlert;
  sealedPhotoFor?: (name: string) => string | undefined;
  comicCoverFor?: (id: string) => string | undefined;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState<"below" | "above">(
    alert.direction === "above" ? "above" : "below",
  );
  const [threshold, setThreshold] = useState<string>(
    String(alert.threshold),
  );
  const updateAlert = useMutation({
    mutationFn: () =>
      api.updatePriceAlert({
        id: alert.id,
        direction,
        threshold: Number(threshold),
      }),
    onSuccess: () => {
      hapticConfirm();
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const deleteAlert = useMutation({
    mutationFn: () => api.deletePriceAlert({ id: alert.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const thresholdValid =
    threshold.trim() !== "" &&
    Number.isFinite(Number(threshold)) &&
    Number(threshold) > 0;
  const name =
    alert.targetKind === "sealed"
      ? displaySealedName(alert.displayName)
      : alert.displayName;
  const currentLabel =
    alert.currentValue != null
      ? `${alert.targetKind === "comic" ? "~" : ""}${fmtUSD(alert.currentValue, alert.targetKind === "comic" ? 0 : 2)}`
      : "—";
  return (
    <li
      className={`rounded-xl border px-3 py-2.5 ${
        alert.triggered
          ? "border-red-800/60 bg-red-900/20"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <AlertThumb
          alert={alert}
          sealedPhotoFor={sealedPhotoFor}
          comicCoverFor={comicCoverFor}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            {name}
          </p>
          {alert.subtitle ? (
            <p className="truncate text-xs text-[var(--dim)]">
              {alert.subtitle}
            </p>
          ) : null}
          <p
            className={`mt-0.5 text-xs font-medium ${
              alert.triggered ? "text-red-300" : "text-[var(--gold-soft)]"
            }`}
          >
            Alert: {alert.direction === "below" ? "at or below" : "at or above"}{" "}
            {fmtUSD(alert.threshold)}
            {alert.triggered ? " — triggered now" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dim)]">
            Now
          </p>
          <p className="text-sm font-bold text-[var(--text)]">
            {currentLabel}
          </p>
        </div>
      </div>
      {editing ? (
        <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <VxSelect
              ariaLabel={`Alert direction for ${name}`}
              value={direction}
              onChange={(v) =>
                setDirection(v as "below" | "above")
              }
              options={[
                { value: "below", label: "Drops to or below" },
                { value: "above", label: "Rises to or above" },
              ]}
            />
            <span className="flex items-center gap-1 text-sm text-[var(--dim)]">
              $
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                aria-label={`New alert threshold for ${name}, in dollars`}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
              />
            </span>
            <button
              type="button"
              disabled={!thresholdValid || updateAlert.isPending}
              onClick={() => updateAlert.mutate()}
              aria-label={`Save changes to the alert for ${name}`}
              className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {updateAlert.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDirection(
                  alert.direction === "above" ? "above" : "below",
                );
                setThreshold(String(alert.threshold));
              }}
              aria-label={`Cancel editing the alert for ${name}`}
              className="rounded-full border border-[var(--border)] px-3 py-2 text-sm text-[var(--dim)]"
            >
              Cancel
            </button>
          </div>
          {updateAlert.isError ? (
            <p className="mt-2 text-xs text-red-400">
              That change didn&rsquo;t save — try again.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDirection(alert.direction === "above" ? "above" : "below");
              setThreshold(String(alert.threshold));
              setEditing(true);
            }}
            aria-label={`Edit the alert for ${name}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={deleteAlert.isPending}
            onClick={() => deleteAlert.mutate()}
            aria-label={`Delete the alert for ${name}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-50"
          >
            {deleteAlert.isPending ? "Deleting…" : "Delete"}
          </button>
          {deleteAlert.isError ? (
            <span className="self-center text-xs text-red-400">
              Couldn&rsquo;t delete — try again.
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

/** The dedicated Price alerts management page: every alert this
    user has set, across cards, sealed products, and comics, each
    editable and deletable in place. Rendered as a full-screen
    layer over the item detail it was opened from; its Back and
    Close controls go through the history layer, so they land
    right back on that detail. */
function PriceAlertsPage({
  onClose,
  sealedPhotoFor,
  comicCoverFor,
}: {
  onClose: () => void;
  sealedPhotoFor?: (name: string) => string | undefined;
  comicCoverFor?: (id: string) => string | undefined;
}) {
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const all = alerts.data?.alerts ?? [];
  // Triggered alerts first (they are the ones asking for
  // attention), then alphabetical by item name.
  const sorted = [...all].sort((a, b) => {
    if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
  const triggeredCount = all.filter((a) => a.triggered).length;
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Price alerts — all your alerts"
      onClick={onClose}
    >
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the item you came from"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xl leading-none text-[var(--text)] shadow-lg"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close price alerts and return to the item"
            className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]"
          >
            Close
          </button>
        </div>
        <h2 className="mt-4 font-album text-[22px] font-bold leading-tight text-[var(--text)]">
          Price alerts
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
          Every alert you&rsquo;ve set — on a card, a sealed product,
          or a comic — in one place. Edit changes the price an alert
          watches for; Delete removes it. Your alerts are yours
          alone: nobody else sees this list.
        </p>
        {alerts.data != null && all.length > 0 ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
            {all.length} alert{all.length === 1 ? "" : "s"}
            {triggeredCount > 0
              ? ` · ${triggeredCount} triggered now`
              : ""}
          </p>
        ) : null}
        {alerts.isPending ? (
          <p className="py-10 text-center text-sm text-[var(--dim)]">
            Loading your alerts…
          </p>
        ) : alerts.isError ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center">
            <p className="text-sm text-red-400">
              Your alerts couldn&rsquo;t load.
            </p>
            <button
              type="button"
              onClick={() => void alerts.refetch()}
              className="mt-3 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black"
            >
              Try again
            </button>
          </div>
        ) : all.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--text)]">
              No price alerts yet
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
              Open any card, sealed product, or comic and set an
              alert from the Price alerts box on its page — every
              alert you set will be listed here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {sorted.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                sealedPhotoFor={sealedPhotoFor}
                comicCoverFor={comicCoverFor}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The alerts list itself — every alert with Edit/Delete in
    place, triggered first — shared by the management page above
    and Portfolio's Alerts area (Nov 4, 2026: Portfolio is the
    unified management home; both surfaces read and write the
    same getPriceAlerts data). Includes its own loading, error,
    and honest empty states. */
export function PriceAlertsList({
  sealedPhotoFor,
  comicCoverFor,
}: {
  sealedPhotoFor?: (name: string) => string | undefined;
  comicCoverFor?: (id: string) => string | undefined;
}) {
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const all = alerts.data?.alerts ?? [];
  const sorted = [...all].sort((a, b) => {
    if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
  if (alerts.isPending) {
    return (
      <p className="py-8 text-center text-sm text-[var(--dim)]">
        Loading your alerts…
      </p>
    );
  }
  if (alerts.isError) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center">
        <p className="text-sm text-red-400">
          Your alerts couldn&rsquo;t load.
        </p>
        <button
          type="button"
          onClick={() => void alerts.refetch()}
          className="mt-3 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black"
        >
          Try again
        </button>
      </div>
    );
  }
  if (all.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[var(--text)]">
          No price alerts yet
        </p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
          Open any card, sealed product, or comic and set an alert
          from the Price alerts box on its page — every alert you
          set will be listed here.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {sorted.map((a) => (
        <AlertRow
          key={a.id}
          alert={a}
          sealedPhotoFor={sealedPhotoFor}
          comicCoverFor={comicCoverFor}
        />
      ))}
    </ul>
  );
}

/** Price alert setter for an item's detail view (Anthony's design:
    the alert lives on the card/item itself; when a threshold is
    met, Home shows it in translucent red). The "Price alerts"
    heading is tappable and opens the management page listing ALL
    of the user's alerts (see PriceAlertsPage above). */
export function PriceAlertBox({
  targetKind,
  cardId,
  sealedName,
  comicId,
  currentValue,
  sealedPhotoFor,
  comicCoverFor,
}: {
  targetKind: PriceAlertTargetKind;
  cardId: number | null;
  sealedName: string | null;
  comicId: string | null;
  currentValue: number | null;
  sealedPhotoFor?: (name: string) => string | undefined;
  comicCoverFor?: (id: string) => string | undefined;
}) {
  const queryClient = useQueryClient();
  const alertsPage = usePriceAlertsPage();
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [threshold, setThreshold] = useState<string>(
    currentValue != null ? currentValue.toFixed(2) : "",
  );
  const mine = (alerts.data?.alerts ?? []).filter((a) =>
    targetKind === "card"
      ? a.targetKind === "card" && a.cardId === cardId
      : targetKind === "sealed"
        ? a.targetKind === "sealed" && a.sealedName === sealedName
        : a.targetKind === "comic" && a.comicId === comicId,
  );
  const totalCount = alerts.data?.alerts.length ?? 0;
  const setAlert = useMutation({
    mutationFn: () =>
      api.setPriceAlert({
        targetKind,
        cardId,
        sealedName,
        comicId,
        direction,
        threshold: Number(threshold),
      }),
    onSuccess: () => {
      hapticConfirm();
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const deleteAlert = useMutation({
    mutationFn: (id: number) => api.deletePriceAlert({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
    },
  });
  const thresholdValid =
    threshold.trim() !== "" &&
    Number.isFinite(Number(threshold)) &&
    Number(threshold) > 0;
  const noun =
    targetKind === "card"
      ? "card's"
      : targetKind === "comic"
        ? "comic's"
        : "item's";
  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
      <button
        type="button"
        onClick={alertsPage.openPage}
        aria-label={
          totalCount > 0
            ? `Price alerts — open the page listing all ${totalCount} of your price alerts`
            : "Price alerts — open the page listing all your price alerts"
        }
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-album text-base text-[var(--text)]">
          Price alerts
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--gold-soft)]">
          {totalCount > 0 ? (
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 tabular-nums text-[var(--dim)]">
              {totalCount} set
            </span>
          ) : null}
          All alerts
          <span aria-hidden="true">›</span>
        </span>
      </button>
      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
        Get flagged on Home, in red, when this {noun} value crosses
        your threshold.{" "}
        {currentValue != null
          ? `Currently ${targetKind === "comic" ? "~" : ""}${fmtUSD(currentValue, targetKind === "comic" ? 0 : 2)} each.`
          : ""}{" "}
        Tap Price alerts above to see, edit, or delete every alert
        you&rsquo;ve set.
      </p>
      {mine.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {mine.map((a) => (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                a.triggered
                  ? "bg-red-500/15 text-red-200"
                  : "bg-[var(--bg)] text-[var(--text)]"
              }`}
            >
              <span>
                {a.direction === "below" ? "At or below" : "At or above"}{" "}
                {fmtUSD(a.threshold)}
                {a.triggered ? " — triggered now" : ""}
              </span>
              <button
                type="button"
                aria-label={`Delete price alert at ${fmtUSD(a.threshold)}`}
                disabled={deleteAlert.isPending}
                onClick={() => deleteAlert.mutate(a.id)}
                className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--dim)]"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VxSelect
          ariaLabel="Alert when the value goes"
          value={direction}
          onChange={(v) => setDirection(v as "below" | "above")}
          options={[
            { value: "below", label: "Drops to or below" },
            { value: "above", label: "Rises to or above" },
          ]}
        />
        <span className="flex items-center gap-1 text-sm text-[var(--dim)]">
          $
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-label="Alert threshold in dollars"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
          />
        </span>
        <button
          type="button"
          disabled={!thresholdValid || setAlert.isPending}
          onClick={() => setAlert.mutate()}
          className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {setAlert.isPending ? "Setting…" : "Set alert"}
        </button>
      </div>
      {setAlert.isSuccess ? (
        <p className="mt-2 text-xs text-emerald-400">
          Alert set — it will show on Home in red once the price crosses.
        </p>
      ) : setAlert.isError ? (
        <p className="mt-2 text-xs text-red-400">
          That alert didn&rsquo;t save — try again.
        </p>
      ) : null}
      {alertsPage.open ? (
        <PriceAlertsPage
          onClose={alertsPage.closePage}
          sealedPhotoFor={sealedPhotoFor}
          comicCoverFor={comicCoverFor}
        />
      ) : null}
    </div>
  );
}
