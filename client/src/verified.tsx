// Verified badge (Anthony, Nov 4, 2026 — his design; spec at
// research_notes/verified-badge-spec-20261104/spec.md): the
// small check seal that sits beside a username EVERYWHERE a
// name appears, earned only through a completed both-sides-
// confirmed trade with an already-verified counterparty (the
// chain flows down from the owner as root) or the owner's own
// manual grant. The badge is CLICKABLE: tapping it opens the
// explainer sheet (mounted once at the app root) with the
// plain-language earning rule, the honest limit — identity
// confirmed on the network, NEVER "safe to pay"; the
// in-person QR handshake stays the safety step — and THIS
// collector's own proof (which trade earned it, with whom,
// when; or "Verified by the owner" with the date; root and
// built-in accounts show their basis instead).
//
// One shared component + one shared event: any surface that
// renders a username drops <VerifiedBadge collectorCode=… />
// next to it and the badge appears exactly when the server's
// ledger says that collector is verified — nothing is
// asserted client-side.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { hapticTick } from "./haptics";
import {
  pushWindowState,
  readNavState,
  scrubWindowKeys,
} from "./historyNav";

type BadgeMap = Map<
  string,
  ApiResponse<typeof api, "getVerifiedBadges">["badges"][number]
>;

/** The shared badge ledger read: every component that renders
    a badge subscribes to the same cached query, so a grant or
    revocation lands everywhere at once. */
export function useVerifiedBadges(): BadgeMap {
  const q = useQuery({
    queryKey: ["verifiedBadges"],
    queryFn: () => api.getVerifiedBadges({}),
    staleTime: 60_000,
  });
  return new Map(
    (q.data?.badges ?? []).map((b) => [b.collectorCode, b] as const),
  );
}

/** The verified check seal beside a username. Renders
    nothing unless the server's ledger says this collector
    currently holds the badge. Tapping opens the explainer. */
export function VerifiedBadge({
  collectorCode,
  username,
  className = "h-4 w-4",
}: {
  collectorCode: string | null | undefined;
  username?: string;
  className?: string;
}) {
  const badges = useVerifiedBadges();
  if (!collectorCode) return null;
  const row = badges.get(collectorCode);
  if (!row || row.status !== "verified") return null;
  const open = () => {
    hapticTick();
    window.dispatchEvent(
      new CustomEvent("vaultx:verified-explainer", {
        detail: { collectorCode, username: username ?? row.username },
      }),
    );
  };
  return (
    // A span with button semantics, not a <button>: the badge
    // sits beside usernames inside rows and pills that are
    // themselves buttons, where a nested <button> is invalid.
    <span
      role="button"
      tabIndex={0}
      aria-label={`Verified collector${username ? ` — ${username}` : ""}. Tap to see how this badge is earned and this collector's proof.`}
      title="Verified — tap for proof"
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          open();
        }
      }}
      className="vx-verified-badge inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition active:scale-90"
    >
      <svg
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M12 1.7 14.5 4l3.3-.3 1 3.1 2.9 1.7-1.3 3 1.3 3-2.9 1.7-1 3.1-3.3-.3L12 22.3 9.5 20l-3.3.3-1-3.1L2.3 15.5l1.3-3-1.3-3L5.2 7.8l1-3.1 3.3.3Z" />
        <path
          d="m8.6 12.2 2.3 2.3 4.5-4.7"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/** The badge explainer sheet — mounted once at the app root.
    Two parts, per Anthony's spec: (1) how anyone earns this
    badge, in plain language, including what it does NOT
    mean; (2) this collector's own proof. A revoked badge
    says so plainly. */
export function VerifiedExplainerSheet() {
  const [target, setTarget] = useState<{
    collectorCode: string;
    username: string;
  } | null>(null);
  // Back-gesture trap (Anthony, Nov 4, 2026 — his live bug
  // report: tapping the badge opened this sheet, but the
  // phone's Back acted on the app BEHIND it instead of
  // closing the sheet). The sheet follows the app's standing
  // overlay pattern: opening takes the window's one history
  // entry (three-back rule: layers when a window already
  // holds the slot), the popstate trap closes the sheet when
  // Back pops that entry, and every on-screen close goes
  // through history.back() when this open did the push so
  // the entry is consumed exactly once. An open window
  // always eats Back before the app underneath ever sees it.
  const pushedRef = useRef(false);
  const heldRef = useRef(false);
  const closeExplainer = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      heldRef.current = false;
      scrubWindowKeys(["lorcanaVerified"]);
      setTarget(null);
    }
  };
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (
        e as CustomEvent<{ collectorCode: string; username: string }>
      ).detail;
      if (detail?.collectorCode) {
        setTarget(detail);
        if (!heldRef.current) {
          // Merge the current entry's state forward, the
          // shared useHistorySheet way: the pushed entry
          // names the whole stack, so a refresh with this
          // sheet open still restores the view underneath.
          pushedRef.current = pushWindowState(
            { ...(readNavState() ?? {}), lorcanaVerified: true },
            "lorcanaVerified",
          );
          heldRef.current = true;
        }
      }
    };
    window.addEventListener("vaultx:verified-explainer", onOpen);
    return () =>
      window.removeEventListener("vaultx:verified-explainer", onOpen);
  }, []);
  useEffect(() => {
    const onPopState = () => {
      if (
        heldRef.current &&
        readNavState()?.lorcanaVerified !== true
      ) {
        heldRef.current = false;
        pushedRef.current = false;
        setTarget(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const proof = useQuery({
    queryKey: ["verifiedProof", target?.collectorCode],
    queryFn: () =>
      api.getVerifiedProof({ collectorCode: target!.collectorCode }),
    enabled: target != null,
  });
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExplainer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target]);
  if (!target) return null;
  const p = proof.data;
  const revoked = p?.status === "revoked";
  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="How the verified badge works"
      onClick={closeExplainer}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-album text-lg text-[var(--text)]">
            Verified on Vault X
          </h2>
          <button
            type="button"
            onClick={closeExplainer}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[var(--text)] ring-1 ring-white/15 transition active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text)]">
            @{p?.username ?? target.username}
            {p?.found && !revoked ? (
              <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wider text-[var(--gold-soft)]">
                Verified
              </span>
            ) : null}
            {revoked ? (
              <span className="ml-2 align-middle text-xs font-bold uppercase tracking-wider text-red-300">
                Revoked
              </span>
            ) : null}
          </p>
          {proof.isPending ? (
            <p className="mt-1.5 text-sm text-[var(--dim)]">
              Loading the proof…
            </p>
          ) : p?.found ? (
            <>
              {p.proofTrade ? (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  Earned through a confirmed{" "}
                  {p.proofTrade.kind === "trade"
                    ? "trade"
                    : p.proofTrade.kind === "cash"
                      ? "purchase"
                      : "Marketplace sale"}{" "}
                  with @{p.proofTrade.withUsername} — both sides
                  confirmed and both left feedback. Completed{" "}
                  {fmtDay(p.proofTrade.completedAt)}.
                </p>
              ) : p.basis === "owner" ? (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  Verified by the owner
                  {p.grantedAt ? ` on ${fmtDay(p.grantedAt)}` : ""} —
                  granted directly by Anthony, no trade involved.
                </p>
              ) : p.proofLabel ? (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  {p.proofLabel}
                  {p.grantedAt ? ` · since ${fmtDay(p.grantedAt)}` : ""}.
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  Verified{p.grantedAt ? ` since ${fmtDay(p.grantedAt)}` : ""}.
                </p>
              )}
              {revoked && p.revokedAt ? (
                <p className="mt-1.5 text-sm leading-relaxed text-red-300">
                  This badge was revoked by the owner on{" "}
                  {fmtDay(p.revokedAt)}. It no longer counts —
                  including for forum roles, which need a
                  currently verified badge.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1.5 text-sm text-[var(--dim)]">
              No badge record for this collector.
            </p>
          )}
        </div>

        <h3 className="mt-4 text-sm font-bold text-[var(--text)]">
          How you earn this badge
        </h3>
        <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-[var(--dim)]">
          <p>
            Complete a trade with a collector who is{" "}
            <span className="text-[var(--text)]">
              already verified
            </span>
            , where both of you confirm the trade and both of
            you leave feedback. That is the moment the badge is
            granted — by the server, never by tapping anything.
          </p>
          <p>
            Verification flows downhill from the owner, who is
            the root of the chain: only a verified collector can
            pass it on, a pair of accounts can pass it only
            once, and the collector passing it on has to have a
            real account history. Two brand-new accounts trading
            with each other earn nothing — neither one touches
            the chain. There is no way to grant it to yourself,
            and an invite from a friend doesn&rsquo;t count:
            being invited is not being verified.
          </p>
          <p>
            The owner can also verify someone directly — when
            that happens, the proof above says so honestly
            instead of naming a trade. The owner can revoke the
            badge on a substantiated report, and a revocation
            shows here too.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-100">
            What the badge means — and only this:{" "}
            <span className="font-semibold">
              this person&rsquo;s identity is confirmed on the
              Vault X network.
            </span>{" "}
            It never means &ldquo;safe to pay.&rdquo; The
            in-person QR Collector ID handshake when you meet
            is still the safety step, badge or no badge.
          </p>
        </div>
      </div>
    </div>
  );
}
