// Money Tracker (Anthony, Nov 5, 2026 — competitor-gap
// review, his #1 pick: "Add it."): ADDED inside Portfolio —
// not a replacement, not a new tab. Three parts:
//   1. Cost vs value for what he holds: total value, total
//      recorded cost, unrealised profit/loss, and ROI —
//      computed ONLY over copies whose cost is actually
//      recorded; where no paid amount is known, the tracker
//      says so and never guesses (the trader's scoreboard
//      rule: a portfolio without cost basis is half a
//      scoreboard, but an invented cost is worse than none).
//   2. The Sold ledger (the Held/Sold flip from the approved
//      mockup): settled cash sales and completed trades out
//      of his collection, fed by the trade/marketplace
//      settlement records, with realised P&L where the cost
//      basis is known.
//   3. The Insurance & Estate PDF button at the foot.
// Per-copy cost itself lives on each item's page (cards:
// the Card Performance tab's per-finish paid; game items:
// the You paid row; slabs: their paid editor).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { InsuranceReportButton } from "./insuranceReport";

type Tracker = ApiResponse<typeof api, "getMoneyTracker">;

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SignedMoney({
  value,
  fmtM,
  className = "",
}: {
  value: number;
  fmtM: (n: number) => string;
  className?: string;
}) {
  return (
    <span
      className={`${value >= 0 ? "text-emerald-400" : "text-red-400"} ${className}`}
    >
      {value >= 0 ? "+" : "−"}
      {fmtM(Math.abs(value))}
    </span>
  );
}

export function MoneyTrackerSection({
  fmtM,
  sealedPhotoFor,
  comicPhotoFor,
}: {
  fmtM: (n: number) => string;
  sealedPhotoFor: (name: string) => string | undefined;
  comicPhotoFor: (id: string) => string | undefined;
}) {
  const tracker = useQuery({
    queryKey: ["moneyTracker"],
    queryFn: () => api.getMoneyTracker({}),
    staleTime: 60_000,
  });
  const [tab, setTab] = useState<"held" | "sold">("held");
  const data: Tracker | undefined = tracker.data;

  return (
    <section
      aria-label="Money Tracker"
      className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-album text-xl text-[var(--text)]">
          Money Tracker
        </h2>
        <div
          className="flex gap-1"
          role="group"
          aria-label="Money Tracker view"
        >
          {(
            [
              ["held", "Held"],
              ["sold", "Sold"],
            ] as ["held" | "sold", string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              aria-label={`Show ${label === "Held" ? "what you hold" : "the sold ledger"}`}
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === key
                  ? "bg-[var(--accent)] text-black"
                  : "border border-[var(--accent)]/50 text-[var(--gold-soft)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tracker.isPending ? (
        <p className="mt-3 text-sm text-[var(--dim)]">
          Adding up what you paid…
        </p>
      ) : tracker.isError || !data ? (
        <p className="mt-3 text-sm text-red-400">
          The money figures couldn&rsquo;t load.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void tracker.refetch()}
          >
            Try again
          </button>
        </p>
      ) : tab === "held" ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
            {[
              { label: "Value now", value: fmtM(data.value), tone: "" },
              {
                label: "Total paid (recorded)",
                value: fmtM(data.costKnown),
                tone: "",
              },
            ].map((cell) => (
              <div key={cell.label} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
                  {cell.label}
                </p>
                <p className="mt-0.5 font-album text-lg font-bold tabular-nums text-[var(--text)]">
                  {cell.value}
                </p>
              </div>
            ))}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
                Unrealised P&amp;L
              </p>
              <p className="mt-0.5 font-album text-lg font-bold tabular-nums">
                <SignedMoney value={data.unrealised} fmtM={fmtM} />
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
                ROI
              </p>
              <p
                className={`mt-0.5 font-album text-lg font-bold tabular-nums ${
                  data.roiPct == null
                    ? "text-[var(--text)]"
                    : data.roiPct >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {data.roiPct == null
                  ? "—"
                  : `${data.roiPct >= 0 ? "+" : "−"}${Math.abs(data.roiPct).toFixed(1)}%`}
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-[var(--dim)]">
            Profit and ROI count only the{" "}
            {data.knownCopies.toLocaleString("en-US")} of{" "}
            {data.copies.toLocaleString("en-US")} copies whose cost
            is recorded — the rest honestly show as unknown cost,
            never a guess. Record what you paid on any item&rsquo;s
            page and it joins the math.
          </p>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {data.categories.map((c) => {
              const pl = c.valueKnown - c.costKnown;
              return (
                <li
                  key={c.key}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--text)]">
                      {c.label}
                    </span>
                    <span className="block text-xs tabular-nums text-[var(--dim)]">
                      {c.copies.toLocaleString("en-US")} copies · cost
                      known for {c.knownCopies.toLocaleString("en-US")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-[var(--text)]">
                      {fmtM(c.value)}
                    </span>
                    {c.knownCopies > 0 ? (
                      <span className="block text-xs tabular-nums">
                        <span className="text-[var(--dim)]">
                          paid {fmtM(c.costKnown)} ·{" "}
                        </span>
                        <SignedMoney value={pl} fmtM={fmtM} />
                      </span>
                    ) : (
                      <span className="block text-xs text-[var(--dim)]">
                        cost not recorded
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          {data.sold.rows.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
              Nothing has left your collection yet. When a sale or
              trade completes, it lands here automatically — what
              it was, who it went to, when, and what you made on
              it — instead of just vanishing.
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
                {data.sold.salesCount} sale{data.sold.salesCount === 1 ? "" : "s"} ·{" "}
                {data.sold.tradesCount} trade{data.sold.tradesCount === 1 ? "" : "s"} ·{" "}
                proceeds {fmtM(data.sold.proceeds)}
                {data.sold.realisedCostKnown > 0 ? (
                  <>
                    {" "}· realised{" "}
                    <SignedMoney value={data.sold.realisedKnown} fmtM={fmtM} />{" "}
                    on the sales whose cost is recorded
                  </>
                ) : null}
              </p>
              <ul className="mt-1 divide-y divide-[var(--border)]">
                {data.sold.rows.map((row, i) => (
                  <li key={`${row.kind}-${row.date ?? ""}-${i}`} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--text)]">
                          {row.title}
                        </span>
                        <span className="block truncate text-xs text-[var(--dim)]">
                          {row.kind === "sale"
                            ? `Sold to ${row.counterparty}`
                            : row.detail}
                          {row.date ? ` · ${fmtDate(row.date)}` : ""}
                        </span>
                      </span>
                      {row.kind === "sale" ? (
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold tabular-nums text-[var(--text)]">
                            {row.proceeds != null ? fmtM(row.proceeds) : ""}
                          </span>
                          {row.realised != null ? (
                            <span className="block text-xs tabular-nums">
                              <SignedMoney value={row.realised} fmtM={fmtM} />
                            </span>
                          ) : (
                            <span className="block text-xs text-[var(--dim)]">
                              cost unknown
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--dim)]">
                          Trade
                        </span>
                      )}
                    </div>
                    {row.kind === "sale" ? (
                      <p className="mt-0.5 text-xs text-[var(--dim)]">{row.detail}</p>
                    ) : (
                      <div className="mt-1 space-y-0.5 text-xs leading-relaxed text-[var(--dim)]">
                        {row.gave.length > 0 ? (
                          <p>
                            <span className="font-semibold text-[var(--text)]">Gave: </span>
                            {row.gave.join("; ")}
                          </p>
                        ) : null}
                        {row.got.length > 0 ? (
                          <p>
                            <span className="font-semibold text-[var(--text)]">Got: </span>
                            {row.got.join("; ")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="mt-4 border-t border-[var(--border)] pt-3.5">
        <InsuranceReportButton
          sealedPhotoFor={sealedPhotoFor}
          comicPhotoFor={comicPhotoFor}
          buttonClassName="w-full rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-semibold text-[var(--gold-soft)]"
        />
        <p className="mt-1.5 text-center text-xs text-[var(--dim)]">
          A print-ready PDF of the whole vault — photos, certs,
          values, and where everything lives — for your insurer
          or your family.
        </p>
      </div>
    </section>
  );
}
