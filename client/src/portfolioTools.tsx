// Portfolio — Track & Research (Anthony, Nov 4, 2026, approved
// from the "Portfolio Watchlist / Alerts / Research" mockup):
// ONE pill-format dropdown directly below Portfolio's Re-price
// pills, switching between three areas inside Portfolio —
// Watchlist, Alerts, and Research. The dropdown is built on the
// shared themed dropdown recipe (the VxSelect look: dark
// surface, rounded, accent glow — never a native menu); its rows
// are the ONE place icons live (eye / bell / chart, one per row
// with a short description), while the Re-price pills above stay
// completely icon-free. The Alerts menu row carries a red
// triggered-count badge when any alert has triggered.
//
// Data is all real and shared: the Watchlist reads getWatchlist
// (items are added from an item's detail view via the Watch
// action exported below), Alerts is the unified management home
// for the SAME price alerts the detail pages create (the shared
// PriceAlertsList from priceAlerts.tsx — one list, two doors),
// and Research reads getResearchCard for one card's homework.
// One canonical price per item everywhere: the binder card's
// market value / the sealed item's unit value, exactly what the
// detail pages and alerts already show.

import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { useCachedArt } from "./artCache";
import { hapticConfirm, hapticTick } from "./haptics";
import { VxSelect } from "./vxSelect";
import { PriceAlertsList, fmtUSD } from "./priceAlerts";

type WatchItem = ApiResponse<typeof api, "getWatchlist">["items"][number];
type ResearchData = ApiResponse<typeof api, "getResearchCard">;
type PanelKey = "watchlist" | "alerts" | "research";

const EYE_ICON = (
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const BELL_ICON = (
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
);
const CHART_ICON = (
  <>
    <path d="M3 3v18h18" />
    <path d="m19 9-5 5-4-4-3 3" />
  </>
);

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[19px] w-[19px]"
    >
      {children}
    </svg>
  );
}

/** Tiny trend line for a watchlist quote row, drawn from the
    item's real tracked price points. Green when the window
    ends at or above where it started, red below. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <span className="flex h-[34px] w-24 items-center justify-center text-[10px] text-[var(--dim)]">
        no trend yet
      </span>
    );
  }
  const w = 96;
  const h = 34;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 3;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map(
    (p) => h - pad - ((p - min) / (max - min || 1)) * (h - pad * 2),
  );
  const d = points
    .map((_, i) => `${i === 0 ? "M" : "L"}${xs[i]?.toFixed(1)},${ys[i]?.toFixed(1)}`)
    .join(" ");
  const up = (points[points.length - 1] ?? 0) >= (points[0] ?? 0);
  const color = up ? "#3ddc97" : "#ff6b7a";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-[34px] w-24 shrink-0"
    >
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity="0.10" stroke="none" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Inline price-alert setter (direction + threshold) used by
    the Watchlist rows and the Research view — creation through
    the same setPriceAlert action the item detail pages use, so
    an alert set here is the same alert everywhere. */
function AlertSetter({
  targetKind,
  cardId,
  sealedName,
  gameCardId,
  comicId,
  currentValue,
  onDone,
}: {
  targetKind: "card" | "sealed" | "game" | "comic";
  cardId: number | null;
  sealedName: string | null;
  gameCardId?: number | null;
  comicId?: string | null;
  currentValue: number | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [threshold, setThreshold] = useState<string>(
    currentValue != null ? currentValue.toFixed(2) : "",
  );
  const setAlert = useMutation({
    mutationFn: () =>
      api.setPriceAlert({
        targetKind,
        cardId,
        sealedName,
        comicId: comicId ?? null,
        gameCardId: gameCardId ?? null,
        direction,
        threshold: Number(threshold),
      }),
    onSuccess: () => {
      hapticConfirm();
      void queryClient.invalidateQueries({ queryKey: ["priceAlerts"] });
      onDone();
    },
  });
  const valid =
    threshold.trim() !== "" &&
    Number.isFinite(Number(threshold)) &&
    Number(threshold) > 0;
  return (
    <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <VxSelect
          ariaLabel="Alert direction"
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
            aria-label="Alert price in dollars"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--text)]"
          />
        </span>
        <button
          type="button"
          disabled={!valid || setAlert.isPending}
          onClick={() => setAlert.mutate()}
          className="rounded-full bg-[var(--gold)] px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {setAlert.isPending ? "Setting…" : "Set alert"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-[var(--border)] px-3 py-2 text-sm text-[var(--dim)]"
        >
          Cancel
        </button>
      </div>
      {setAlert.isError ? (
        <p className="mt-2 text-xs text-red-400">
          That alert didn&rsquo;t save — try again.
        </p>
      ) : null}
    </div>
  );
}

/** The Watch action for an item's detail view (Anthony, Nov 4,
    2026): adds the item to the Portfolio watchlist, or removes
    it when it's already watched. Lives beside the Price alerts
    box on card and sealed detail pages. */
export function WatchToggleButton({
  targetKind,
  cardId,
  sealedName,
  gameCardId,
  comicId,
}: {
  targetKind: "card" | "sealed" | "game" | "comic";
  cardId: number | null;
  sealedName: string | null;
  gameCardId?: number | null;
  comicId?: string | null;
}) {
  const queryClient = useQueryClient();
  const watchlist = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.getWatchlist({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const mine = (watchlist.data?.items ?? []).find((w) => {
    switch (targetKind) {
      case "card":
        return w.targetKind === "card" && w.cardId === cardId;
      case "sealed":
        return w.targetKind === "sealed" && w.sealedName === sealedName;
      case "game":
        return w.targetKind === "game" && w.gameCardId === gameCardId;
      case "comic":
        return w.targetKind === "comic" && w.comicId === comicId;
    }
  });
  const add = useMutation({
    mutationFn: () =>
      api.addToWatchlist({
        targetKind,
        cardId,
        sealedName,
        gameCardId: gameCardId ?? null,
        comicId: comicId ?? null,
      }),
    onSuccess: () => {
      hapticConfirm();
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.removeFromWatchlist({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
  const watched = mine != null;
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={watchlist.isPending || add.isPending || remove.isPending}
        aria-pressed={watched}
        aria-label={
          watched
            ? "Remove this item from your watchlist"
            : "Add this item to your watchlist"
        }
        onClick={() => {
          if (watched && mine) remove.mutate(mine.id);
          else add.mutate();
        }}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
          watched
            ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
            : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          {EYE_ICON}
        </svg>
        {watched ? "Watching — tap to remove" : "Watch this item"}
      </button>
      {add.isError || remove.isError ? (
        <p className="mt-1.5 text-xs text-red-400">
          That didn&rsquo;t save — try again.
        </p>
      ) : null}
    </div>
  );
}

function WatchThumb({
  item,
  sealedPhotoFor,
}: {
  item: WatchItem;
  sealedPhotoFor?: (name: string) => string | undefined;
}) {
  const { url } = useCachedArt(
    item.targetKind === "card" ? item.cardId : null,
    "grid",
    item.targetKind === "card" && item.cardId != null,
  );
  if (item.targetKind === "card") {
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
  if (item.targetKind === "game") {
    return item.imageUrl ? (
      <img
        src={item.imageUrl}
        alt=""
        loading="lazy"
        className="h-14 w-10 shrink-0 rounded-md object-cover"
      />
    ) : (
      <span className="block h-14 w-10 shrink-0 rounded-md bg-[var(--bg)]" />
    );
  }
  if (item.targetKind === "comic") {
    return (
      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-[var(--dim)]">
        Graded
      </span>
    );
  }
  const photo = item.sealedName ? sealedPhotoFor?.(item.sealedName) : undefined;
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

function WatchlistPanel({
  onOpenCard,
  onOpenSealed,
  sealedPhotoFor,
}: {
  onOpenCard: (id: number) => void;
  onOpenSealed: (name: string) => void;
  sealedPhotoFor?: (name: string) => string | undefined;
}) {
  const queryClient = useQueryClient();
  const watchlist = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.getWatchlist({}),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
  const [alertFor, setAlertFor] = useState<number | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => api.removeFromWatchlist({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
  const items = watchlist.data?.items ?? [];
  const upToday = items.filter((i) => (i.dayChangePct ?? 0) > 0).length;
  const downToday = items.filter((i) => (i.dayChangePct ?? 0) < 0).length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)]">
          <b className="text-[var(--text)]">{items.length}</b> items
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)]">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
          <b className="text-[var(--text)]">{upToday}</b> up today
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)]">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400 align-middle" />
          <b className="text-[var(--text)]">{downToday}</b> down today
        </span>
      </div>
      {watchlist.isPending ? (
        <p className="py-8 text-center text-sm text-[var(--dim)]">
          Loading your watchlist…
        </p>
      ) : watchlist.isError ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center">
          <p className="text-sm text-red-400">
            Your watchlist couldn&rsquo;t load.
          </p>
          <button
            type="button"
            onClick={() => void watchlist.refetch()}
            className="mt-3 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--text)]">
            Nothing on your watchlist yet
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
            Open any item — a card, a sealed product, a game or
            Funko figure, a Lego set, a graded comic — and tap{" "}
            <b>Watch this item</b> on its page. Watched items show
            up here with their price where one is tracked, whether
            you own them or not.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const chg = item.dayChangePct;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Open ${item.displayName}`}
                    onClick={() => {
                      if (item.targetKind === "card" && item.cardId != null)
                        onOpenCard(item.cardId);
                      else if (item.sealedName) onOpenSealed(item.sealedName);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <WatchThumb item={item} sealedPhotoFor={sealedPhotoFor} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                        {item.displayName.replace(/^Disney Lorcana: /, "")}
                      </span>
                      <span className="block truncate text-xs text-[var(--dim)]">
                        {item.subtitle}
                        {item.ownedQty > 0
                          ? ` · you own ${item.ownedQty}`
                          : " · not owned"}
                      </span>
                      <span className="mt-0.5 flex items-baseline gap-2">
                        {item.price != null ? (
                          <>
                            <span className="text-sm font-bold tabular-nums text-[var(--text)]">
                              {fmtUSD(item.price)}
                            </span>
                            {chg != null ? (
                              <span
                                className={`text-xs font-semibold tabular-nums ${
                                  chg >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(1)}%
                                today
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--dim)]">
                                no day change tracked yet
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs leading-snug text-[var(--dim)]">
                            Pricing isn&rsquo;t tracked for this item yet
                          </span>
                        )}
                      </span>
                    </span>
                    <Sparkline points={item.trend} />
                  </button>
                  <span className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      aria-label={`Set a price alert on ${item.displayName}`}
                      aria-expanded={alertFor === item.id}
                      onClick={() =>
                        setAlertFor((cur) => (cur === item.id ? null : item.id))
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)]"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        {BELL_ICON}
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Stop watching ${item.displayName}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--dim)] disabled:opacity-50"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        className="h-4 w-4"
                      >
                        <path d="M5 5l14 14M19 5L5 19" />
                      </svg>
                    </button>
                  </span>
                </div>
                {alertFor === item.id ? (
                  item.price == null ? (
                    <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
                      <p className="text-xs leading-relaxed text-[var(--dim)]">
                        Pricing isn&rsquo;t tracked for this item yet, so
                        it can&rsquo;t be alerted — no price source
                        (TCGplayer or eBay sold) covers it today. It
                        stays on your watchlist, and alerts light up
                        here if pricing ever lands.
                      </p>
                      <button
                        type="button"
                        onClick={() => setAlertFor(null)}
                        className="mt-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                      >
                        Got it
                      </button>
                    </div>
                  ) : (
                    <AlertSetter
                      targetKind={
                        item.targetKind === "sealed"
                          ? "sealed"
                          : item.targetKind === "game"
                            ? "game"
                            : item.targetKind === "comic"
                              ? "comic"
                              : "card"
                      }
                      cardId={item.cardId}
                      sealedName={item.sealedName}
                      gameCardId={item.gameCardId}
                      comicId={item.comicId}
                      currentValue={item.price}
                      onDone={() => setAlertFor(null)}
                    />
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 flex gap-2 text-xs leading-relaxed text-[var(--dim)]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-4 w-4 shrink-0"
        >
          {BELL_ICON}
        </svg>
        <span>
          <b className="text-[var(--text)]">Watching something dip?</b>{" "}
          Tap the bell on any row to set a price alert on it — the
          alert lands in the Alerts area, and creating one still
          works from the item&rsquo;s own page, exactly like today.
        </span>
      </p>
    </div>
  );
}

const RANGES = [
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "365", label: "1Y", days: 365 },
  { key: "0", label: "All", days: 0 },
] as const;

function ResearchChart({ data, range }: { data: ResearchData; range: string }) {
  const all = data.priceHistory;
  const anchor = all.length > 0 ? Date.parse(all[all.length - 1]?.date ?? "") : 0;
  const days = RANGES.find((r) => r.key === range)?.days ?? 0;
  const points =
    days > 0 && Number.isFinite(anchor)
      ? all.filter((p) => anchor - Date.parse(p.date) <= days * 86_400_000)
      : all;
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
        <p className="text-sm text-[var(--dim)]">
          No tracked prices yet for this item — its chart starts
          with the next daily re-pricing.
        </p>
      </div>
    );
  }
  const w = 640;
  const h = 220;
  const padX = 8;
  const padTop = 14;
  const padBottom = 14;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xs = points.map(
    (_, i) => padX + (i / Math.max(1, points.length - 1)) * (w - padX * 2),
  );
  const ys = points.map(
    (p) => h - padBottom - ((p.value - min) / span) * (h - padTop - padBottom),
  );
  const d = points
    .map((_, i) => `${i === 0 ? "M" : "L"}${xs[i]?.toFixed(1)},${ys[i]?.toFixed(1)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const delta = first && last ? last.value - first.value : 0;
  const up = delta >= 0;
  const color = up ? "#3ddc97" : "#ff6b7a";
  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        role="img"
        aria-label={`Price history for ${data.fullName}: from ${first ? fmtUSD(first.value) : ""} to ${last ? fmtUSD(last.value) : ""}`}
      >
        <path
          d={`${d} L${xs[xs.length - 1]?.toFixed(1)},${h - padBottom} L${xs[0]?.toFixed(1)},${h - padBottom} Z`}
          fill={color}
          opacity="0.08"
          stroke="none"
        />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-[var(--dim)]">
        <span>
          {first?.label} · {first ? fmtUSD(first.value) : ""}
        </span>
        <span>
          high {fmtUSD(max)} · low {fmtUSD(min)}
        </span>
        <span>
          {last?.label} · {last ? fmtUSD(last.value) : ""}
        </span>
      </div>
    </div>
  );
}

function ResearchPanel({
  onOpenCard,
}: {
  onOpenCard: (id: number) => void;
}) {
  const watchlist = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.getWatchlist({}),
  });
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
  });
  const candidates = new Map<number, string>();
  for (const w of watchlist.data?.items ?? []) {
    if (w.targetKind === "card" && w.cardId != null)
      candidates.set(w.cardId, w.displayName);
  }
  for (const a of alerts.data?.alerts ?? []) {
    if (a.targetKind === "card" && a.cardId != null && !candidates.has(a.cardId))
      candidates.set(a.cardId, a.displayName);
  }
  const [picked, setPicked] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const search = useQuery({
    queryKey: ["search", searchText.trim()],
    queryFn: () => api.searchCards({ query: searchText.trim() }),
    // First-letter typeahead (standing search rule, Nov 5, 2026).
    enabled: searchText.trim().length >= 1,
    placeholderData: (prev) => prev,
  });
  const [range, setRange] = useState<string>("90");
  const [alertOpen, setAlertOpen] = useState(false);
  const selectedId =
    picked ?? (candidates.size > 0 ? [...candidates.keys()][0] ?? null : null);
  const research = useQuery({
    queryKey: ["researchCard", selectedId],
    queryFn: () => api.getResearchCard({ cardId: selectedId ?? 0 }),
    enabled: selectedId != null,
  });
  const data = research.data;
  const options = [...candidates.entries()].map(([id, name]) => ({
    value: String(id),
    label: name,
  }));
  return (
    <div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="font-album text-base text-[var(--text)]">
          Pick an item to research
        </h3>
        <p className="mt-0.5 text-xs text-[var(--dim)]">
          Starts with your watchlist &amp; alert items — or search
          for anything in the catalog.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {options.length > 0 ? (
            <VxSelect
              ariaLabel="Choose an item to research"
              value={selectedId != null ? String(selectedId) : ""}
              onChange={(v) => setPicked(Number(v))}
              options={options}
            />
          ) : null}
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search any card — name, or name + number…"
            aria-label="Search for a card to research"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--dim)]"
          />
        </div>
        {searchText.trim().length >= 1 ? (
          <div className="mt-2">
            {search.isPending ? (
              <p className="py-3 text-center text-xs text-[var(--dim)]">
                Searching…
              </p>
            ) : (search.data?.results ?? []).length === 0 ? (
              <p className="py-3 text-center text-xs text-[var(--dim)]">
                No cards match that search.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {(search.data?.results ?? []).slice(0, 12).map((r) => (
                  <li key={r.cardId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(r.cardId);
                        setSearchText("");
                      }}
                      aria-label={`Research ${r.fullName}`}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--text)]">
                          {r.fullName}
                        </span>
                        <span className="block truncate text-xs text-[var(--dim)]">
                          {r.groupName} #{r.printed}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]">
                        {r.marketValue != null ? fmtUSD(r.marketValue) : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {selectedId == null ? (
        <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[var(--text)]">
            Nothing picked yet
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
            Search above for any card and Research pulls its full
            price history, market compare, your position, and its
            set context into one page.
          </p>
        </div>
      ) : research.isPending ? (
        <p className="py-8 text-center text-sm text-[var(--dim)]">
          Pulling the homework together…
        </p>
      ) : research.isError || !data ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center">
          <p className="text-sm text-red-400">
            That item&rsquo;s research couldn&rsquo;t load.
          </p>
          <button
            type="button"
            onClick={() => void research.refetch()}
            className="mt-3 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-album text-lg leading-tight text-[var(--text)]">
                  {data.fullName}
                </h3>
                <p className="text-xs text-[var(--dim)]">
                  {data.groupName} #{data.printed}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenCard(data.cardId)}
                className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
              >
                Open item
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
              <p className="text-3xl font-bold tabular-nums text-[var(--text)]">
                {data.price != null ? fmtUSD(data.price) : "—"}
              </p>
              <div
                className="flex gap-1"
                role="group"
                aria-label="Price history range"
              >
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={range === r.key}
                    onClick={() => setRange(r.key)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      range === r.key
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                        : "border-[var(--border)] text-[var(--dim)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              <ResearchChart data={data} range={range} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                {
                  label: "You own",
                  value:
                    data.position.ownedQty > 0
                      ? `${data.position.ownedQty} cop${data.position.ownedQty === 1 ? "y" : "ies"}`
                      : "Not owned",
                },
                {
                  label: "Avg paid",
                  value:
                    data.position.avgPaid != null
                      ? fmtUSD(data.position.avgPaid)
                      : "—",
                },
                {
                  label: "Position value",
                  value:
                    data.position.ownedQty > 0
                      ? fmtUSD(data.position.valueTotal)
                      : "—",
                },
                {
                  label: "Gain / loss",
                  value:
                    data.position.ownedQty > 0
                      ? `${data.position.net < 0 ? "−" : "+"}${fmtUSD(Math.abs(data.position.net))}`
                      : "—",
                },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-xl bg-[var(--bg)] px-2 py-2.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dim)]">
                    {cell.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text)]">
                    {cell.value}
                  </p>
                </div>
              ))}
            </div>
            <WatchToggleButton
              targetKind="card"
              cardId={data.cardId}
              sealedName={null}
            />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="font-album text-base text-[var(--text)]">
              Market compare
            </h3>
            <p className="mt-0.5 text-xs text-[var(--dim)]">
              TCGplayer first, eBay sold listings second — the same
              order the app prices everything else by.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-2.5">
                <span className="text-sm font-semibold text-[var(--text)]">
                  TCGplayer
                </span>
                <span className="text-sm font-bold tabular-nums text-[var(--text)]">
                  {data.tcgplayerId &&
                  !(
                    data.ebay != null &&
                    data.price != null &&
                    data.price === data.ebay.usd
                  ) &&
                  data.price != null
                    ? fmtUSD(data.price)
                    : "Not tracked"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg)] px-3 py-2.5">
                <span className="text-sm font-semibold text-[var(--text)]">
                  eBay
                </span>
                <span className="text-right text-sm tabular-nums text-[var(--text)]">
                  {data.ebay
                    ? `last sold at ${fmtUSD(data.ebay.usd)} on eBay`
                    : "No recorded sales"}
                </span>
              </div>
              {data.ebay ? (
                <p className="text-xs leading-relaxed text-[var(--dim)]">
                  Recorded eBay sales {data.ebay.windowLabel}, most
                  recent in {data.ebay.lastSoldMonth}.
                  {data.ebay.stale
                    ? " That sale is over 90 days old, so treat it as a last-sold figure, not a live price."
                    : ""}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-[var(--dim)]">
                  No eBay sold listings are recorded for this
                  printing yet — eBay comps exist only where real
                  sales have been tracked.
                </p>
              )}
            </div>
            {alertOpen ? (
              <AlertSetter
                targetKind="card"
                cardId={data.cardId}
                sealedName={null}
                currentValue={data.price}
                onDone={() => setAlertOpen(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAlertOpen(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  {BELL_ICON}
                </svg>
                Set an alert from Research
              </button>
            )}
          </div>

          {data.printings.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="font-album text-base text-[var(--text)]">
                All printings of this card
              </h3>
              <ul className="mt-2 space-y-1.5">
                {data.printings.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(p.id)}
                      aria-label={`Research the ${p.groupName} printing of ${p.fullName}`}
                      className="flex w-full items-center justify-between gap-2 rounded-xl bg-[var(--bg)] px-3 py-2 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--text)]">
                          {p.fullName}
                        </span>
                        <span className="block truncate text-xs text-[var(--dim)]">
                          {p.groupName} #{p.printed}
                          {p.ownedQty > 0 ? ` · you own ${p.ownedQty}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]">
                        {p.price != null ? fmtUSD(p.price) : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.setContext ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="font-album text-base text-[var(--text)]">
                Set context — {data.setContext.groupName}
              </h3>
              <p className="mt-1 text-sm tabular-nums text-[var(--text)]">
                {data.setContext.ownedPockets} of{" "}
                {data.setContext.totalPockets} pockets owned (
                {data.setContext.totalPockets > 0
                  ? Math.round(
                      (data.setContext.ownedPockets /
                        data.setContext.totalPockets) *
                        100,
                    )
                  : 0}
                %)
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
                Finishing the complete set at today&rsquo;s prices
                would cost about {fmtUSD(data.setContext.costToComplete)}
                {data.setContext.unpricedMissing > 0
                  ? `, plus ${data.setContext.unpricedMissing} missing pocket${data.setContext.unpricedMissing === 1 ? "" : "s"} with no tracked price yet`
                  : ""}
                .
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const PANELS: {
  key: PanelKey;
  name: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "watchlist",
    name: "Watchlist",
    desc: "Cards & sealed you're eyeing — price, day change, trend line",
    icon: EYE_ICON,
  },
  {
    key: "alerts",
    name: "Alerts",
    desc: "Every price alert in one place — triggered ones flagged red",
    icon: BELL_ICON,
  },
  {
    key: "research",
    name: "Research",
    desc: "One item's homework — price history, sales comps, market compare",
    icon: CHART_ICON,
  },
];

/** The Track & Research block for Portfolio: the pill dropdown
    plus the selected area below it. */
export function PortfolioTools({
  onOpenCard,
  onOpenSealed,
  sealedPhotoFor,
  comicCoverFor,
}: {
  onOpenCard: (id: number) => void;
  onOpenSealed: (name: string) => void;
  sealedPhotoFor?: (name: string) => string | undefined;
  comicCoverFor?: (id: string) => string | undefined;
}) {
  const [panel, setPanel] = useState<PanelKey>("watchlist");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const watchlist = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.getWatchlist({}),
  });
  const alerts = useQuery({
    queryKey: ["priceAlerts"],
    queryFn: () => api.getPriceAlerts({}),
  });
  const triggeredCount = (alerts.data?.alerts ?? []).filter(
    (a) => a.triggered,
  ).length;
  const watchCount = watchlist.data?.items.length ?? 0;
  const active = PANELS.find((p) => p.key === panel) ?? PANELS[0]!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const subFor = (key: PanelKey): string => {
    if (key === "watchlist")
      return `${watchCount} item${watchCount === 1 ? "" : "s"} · prices, day change & trend`;
    if (key === "alerts")
      return `${alerts.data?.alerts.length ?? 0} active · ${triggeredCount} triggered`;
    return "Price history · sales comps · market compare";
  };

  return (
    /* Boxed like the page's other sections (Anthony, Nov 5,
       2026): Track & Research gets the same bordered section
       treatment as the Portfolio Value box and the Movers —
       a proper border around the whole area, dropdown and
       panel alike, in the active theme's tokens. */
    <section
      aria-label="Track and research"
      className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
    >
      <h2 className="font-album text-lg text-[var(--text)]">
        Track &amp; Research
      </h2>
      <div ref={rootRef} className="relative mt-2">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Portfolio tools — currently showing ${active.name}. Choose Watchlist, Alerts, or Research.`}
          onClick={() => {
            hapticTick();
            setOpen((v) => !v);
          }}
          className={`flex w-full items-center gap-3 rounded-full border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
            open
              ? "border-[var(--accent)] bg-[var(--surface)]"
              : "border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <MenuIcon>{active.icon}</MenuIcon>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight text-[var(--text)]">
              {active.name}
            </span>
            <span className="block truncate text-xs text-[var(--dim)]">
              {subFor(panel)}
            </span>
          </span>
          {panel === "alerts" && triggeredCount > 0 ? (
            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {triggeredCount} triggered
            </span>
          ) : null}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-[19px] w-[19px] shrink-0 text-[var(--dim)] transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open ? (
          <div
            role="listbox"
            aria-label="Portfolio tools"
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.6)]"
          >
            {PANELS.map((p) => {
              const isSel = p.key === panel;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    hapticTick();
                    setPanel(p.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isSel
                      ? "bg-[var(--accent)]/15"
                      : "hover:bg-white/5 active:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                      isSel
                        ? "border-transparent bg-[var(--accent)] text-white"
                        : "border-[var(--border)] text-[var(--accent)]"
                    }`}
                  >
                    <MenuIcon>{p.icon}</MenuIcon>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold leading-tight text-[var(--text)]">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-[var(--dim)]">
                      {p.desc}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.key === "watchlist" && watchCount > 0 ? (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--dim)]">
                        {watchCount}
                      </span>
                    ) : null}
                    {p.key === "alerts" && triggeredCount > 0 ? (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
                        {triggeredCount} triggered
                      </span>
                    ) : null}
                    {isSel ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-[17px] w-[17px] text-[var(--accent)]"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="mt-3">
        {panel === "watchlist" ? (
          <WatchlistPanel
            onOpenCard={onOpenCard}
            onOpenSealed={onOpenSealed}
            sealedPhotoFor={sealedPhotoFor}
          />
        ) : panel === "alerts" ? (
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)]">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                <b className="text-[var(--text)]">{triggeredCount}</b>{" "}
                triggered
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)]">
                <b className="text-[var(--text)]">
                  {alerts.data?.alerts.length ?? 0}
                </b>{" "}
                active
              </span>
              <span className="text-[11px] text-[var(--dim)]">
                Every alert you own, in one place — new alerts are
                still created on an item&rsquo;s own page.
              </span>
            </div>
            <div className="mt-3">
              <PriceAlertsList
                sealedPhotoFor={sealedPhotoFor}
                comicCoverFor={comicCoverFor}
              />
            </div>
          </div>
        ) : (
          <ResearchPanel onOpenCard={onOpenCard} />
        )}
      </div>
    </section>
  );
}
