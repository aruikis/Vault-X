// Graded cert scanning (Anthony, Nov 5, 2026 — the piece
// he un-parked from the Nov 3 grading-integration parking
// lot, widened the same day to the TOP FIVE companies):
// PSA, Beckett (BGS), SGC, CGC Cards, and TAG. A graded
// slab joins the vault by its CERT NUMBER, the one thing
// every graded card carries. Four ways in, all landing on
// the same confirm-before-save screen:
//   1. the slab's QR code — PSA, Beckett, CGC, and TAG
//      labels print codes that open the cert's page on the
//      company's own site, and the cert rides inside that
//      link (the company is read off the link too);
//   2. the slab's barcode — the number printed with it is
//      the cert number;
//   3. a photo of the label — the server reads the printed
//      cert, grade, and company off the label
//      (readGradedSlabPhoto);
//   4. typing the number, which works everywhere.
// Saving creates a graded copy of a catalog card (company,
// cert, grade, optional paid) and steps the card's owned
// count up by one. A cert already in the vault under the
// same company is a duplicate — within a company, one cert
// number is one physical slab — and the save is refused
// with the existing slab shown.
// THE UNIFIED SCANNER + ONLINE LOOKUP (Nov 5, 2026,
// later): slab capture lives in the SAME scanner as the
// Lorcana cards — ScanPanel's "Scan a slab (cert)" mode
// renders SlabCapturePanel, and the per-game panels open
// the same panel as an overlay. Slab mode reads codes only
// and never runs the artwork matcher; card mode never waits
// for codes. On the confirm screen the app now goes online
// to the grading company's own cert record (the
// lookupGradedCert action): PSA's pages carry the full
// record and its hosted slab photos, and a COPY of the
// photo served for THAT cert (front, and back when there
// is one) is imported into app storage — never hotlinked,
// never another cert's photo. Beckett, CGC, and TAG get one
// best-effort read each and report honestly when their
// sites can't be read from here; SGC publishes no online
// cert record at all. When no company photo exists for a
// cert, the slab shows the catalog card art in a slab frame
// labeled as a stand-in, replaceable with the collector's
// own photo — the UI never calls the stand-in their slab.
// No company pricing is fetched or claimed, ever. Saving
// lands the collector on the slab's Card / Slab View.
// Companies beyond the top five stay parked (Nov 3, 2026).

import { useEffect, useRef, useState } from "react";
import {
useMutation,
useQuery,
useQueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { fmtMoneyUSD } from "./i18n";
import { hapticTick } from "./haptics";
import { VxSelect } from "./vxSelect";
import { Turntable } from "./turntable";
import { SidewaysCountDial } from "./countDial";
import {
pushWindowState,
readNavState,
scrubWindowKeys,
} from "./historyNav";
import type { GameKey } from "./games";

/** A catalog card as the scanner needs it — the game search
    result shape minus its section key, which is exactly the
    card detail sheet's card shape, so a card can arrive from
    either place. */
export type GradedCardPick = Omit<
  ApiResponse<typeof api, "searchGameCards">["results"][number],
  "sectionKey"
>;

export type GradedSlab = ApiResponse<
  typeof api,
  "listGradedSlabs"
>["slabs"][number];

export type GradingCompany = "PSA" | "BGS" | "SGC" | "CGC" | "TAG";

export const GRADING_COMPANIES: {
  key: GradingCompany;
  /** Short label for pills and slab bands. */
  short: string;
  /** Full label for sentences. */
  label: string;
  /** The cert's printed shape, for entry help. */
  certHint: string;
}[] = [
  {
    key: "PSA",
    short: "PSA",
    label: "PSA",
    certHint: "digits — leading zeros count, keep them",
  },
  {
    key: "BGS",
    short: "BGS",
    label: "Beckett (BGS)",
    certHint: "digits — 10 on modern labels, fewer on older ones",
  },
  {
    key: "SGC",
    short: "SGC",
    label: "SGC",
    certHint: "7 digits, or 11 characters like 1234567-890",
  },
  {
    key: "CGC",
    short: "CGC",
    label: "CGC Cards",
    certHint: "10 digits on modern labels",
  },
  {
    key: "TAG",
    short: "TAG",
    label: "TAG",
    certHint: "1 letter + 7 numbers, like F6396638",
  },
];

export function companyMeta(company: string) {
  return (
    GRADING_COMPANIES.find((c) => c.key === company) ??
    GRADING_COMPANIES[0]!
  );
}

const GRADE_NAMES: Record<string, string> = {
  "10": "Gem Mint",
  "9.5": "Gem Mint",
  "9": "Mint",
  "8.5": "Near Mint–Mint+",
  "8": "Near Mint–Mint",
  "7.5": "Near Mint+",
  "7": "Near Mint",
  "6.5": "Excellent–Mint+",
  "6": "Excellent–Mint",
  "5.5": "Excellent+",
  "5": "Excellent",
  "4.5": "Very Good–Excellent+",
  "4": "Very Good–Excellent",
  "3.5": "Very Good+",
  "3": "Very Good",
  "2.5": "Good+",
  "2": "Good",
  "1.5": "Fair",
  "1": "Poor",
};

/** The grades each company actually gives (researched from
    the companies' published scales when this was built):
    PSA and TAG have no 9.5; Beckett, SGC, and CGC do. CGC
    and TAG grade a Pristine 10 above Gem Mint 10, CGC also
    a Perfect 10; Beckett's 10 is Pristine. TAG gives no
    Authentic designation. */
export function gradeOptionsFor(
  company: GradingCompany,
): { value: string; label: string }[] {
  const numeric = (
    values: string[],
  ): { value: string; label: string }[] =>
    values.map((v) => ({
      value: v,
      label: `${v} — ${GRADE_NAMES[v] ?? ""}`.trim(),
    }));
  const with95 = [
    "10", "9.5", "9", "8.5", "8", "7.5", "7", "6.5", "6",
    "5.5", "5", "4.5", "4", "3.5", "3", "2.5", "2", "1.5", "1",
  ];
  const no95 = [
    "10", "9", "8.5", "8", "7.5", "7", "6.5", "6", "5.5",
    "5", "4.5", "4", "3.5", "3", "2.5", "2", "1.5", "1",
  ];
  const authentic = { value: "Authentic", label: "Authentic — no number grade" };
  switch (company) {
    case "PSA":
      return [
        { value: "", label: "Pick the grade on the label" },
        ...numeric(no95),
        authentic,
      ];
    case "BGS":
      return [
        { value: "", label: "Pick the grade on the label" },
        { value: "10", label: "10 — Pristine" },
        { value: "9.5", label: "9.5 — Gem Mint" },
        ...numeric(with95.filter((v) => v !== "10" && v !== "9.5")),
        authentic,
      ];
    case "SGC":
      return [
        { value: "", label: "Pick the grade on the label" },
        { value: "10", label: "10 — Pristine" },
        ...numeric(with95.filter((v) => v !== "10")),
        authentic,
      ];
    case "CGC":
      return [
        { value: "", label: "Pick the grade on the label" },
        { value: "Perfect 10", label: "Perfect 10" },
        { value: "Pristine 10", label: "Pristine 10" },
        ...numeric(with95),
        authentic,
      ];
    case "TAG":
      return [
        { value: "", label: "Pick the grade on the label" },
        { value: "Pristine 10", label: "Pristine 10" },
        ...numeric(no95),
      ];
  }
}

export function gradeLabelFor(
  company: string,
  grade: string,
): string {
  const opts = gradeOptionsFor(
    (GRADING_COMPANIES.some((c) => c.key === company)
      ? company
      : "PSA") as GradingCompany,
  );
  return opts.find((o) => o.value === grade)?.label ?? grade;
}

/** Normalizes a cert the way the server does (mirrored so
    the confirm screen validates and duplicate-checks the
    exact string that would be saved): uppercase, no spaces;
    digits only for the digit companies; SGC's 10 straight
    digits gain the printed hyphen of its 11-character
    format. */
export function normalizeCert(
  company: GradingCompany,
  raw: string,
): string {
  const cleaned = raw.toUpperCase().replace(/\s+/g, "");
  if (company === "TAG") return cleaned.replace(/[^A-Z0-9]/g, "");
  if (company === "SGC") {
    if (/^\d{7}$/.test(cleaned)) return cleaned;
    if (/^\d{7}-\d{3}$/.test(cleaned)) return cleaned;
    const digits = cleaned.replace(/\D/g, "");
    if (/^\d{10}$/.test(digits)) {
      return `${digits.slice(0, 7)}-${digits.slice(7)}`;
    }
    return cleaned;
  }
  return cleaned.replace(/\D/g, "");
}

export function certValidFor(
  company: GradingCompany,
  cert: string,
): boolean {
  switch (company) {
    case "PSA":
    case "BGS":
      return /^\d{5,12}$/.test(cert);
    case "CGC":
      return /^\d{7,12}$/.test(cert);
    case "SGC":
      return /^\d{7}$/.test(cert) || /^\d{7}-\d{3}$/.test(cert);
    case "TAG":
      return /^[A-Z0-9]{6,12}$/.test(cert) && /\d/.test(cert);
  }
}

/** The company's own record for one cert, linked — never
    fetched. Every shape below was verified against the
    company's live cert pages when this was built:
    PSA psacard.com/cert/<cert>/psa; Beckett
    beckett.com/grading/card-lookup?flag=1&item_id=<cert>;
    CGC cgccards.uk/certlookup/<cert>/; TAG
    my.taggrading.com/card/<cert> (its DIG report). SGC
    publishes no address that carries a cert — its lookup
    is a form — so SGC links the form itself. */
export function companyCertUrl(
  company: string,
  cert: string,
): string {
  switch (company) {
    case "BGS":
      return `https://beckett.com/grading/card-lookup?flag=1&item_id=${cert}`;
    case "CGC":
      return `https://www.cgccards.uk/certlookup/${cert}/`;
    case "TAG":
      return `https://my.taggrading.com/card/${cert}`;
    case "SGC":
      return "https://www.gosgc.com/cert-code-lookup";
    default:
      return `https://www.psacard.com/cert/${cert}/psa`;
  }
}

export function companyCertLinkLabel(company: string): string {
  switch (company) {
    case "BGS":
      return "Beckett's record for this cert";
    case "CGC":
      return "CGC's record for this cert";
    case "TAG":
      return "TAG's DIG report for this cert";
    case "SGC":
      return "SGC's cert lookup — enter the number there";
    default:
      return "PSA's record for this cert";
  }
}

/** Pulls a cert (and, when the code is a company link, the
    company) out of whatever a slab code scan returns:
    a psacard.com/cert/<number> link, a Beckett card-lookup
    link with its item_id, a CGC certlookup link, a TAG
    my.taggrading.com/card/<cert> or tagd.co link, or a bare
    run of characters (the barcode beside the printed cert —
    company unknown, the picked company applies; a lone
    letter + 7 digits is TAG's shape and says so). Anything
    else is not a cert read and returns null. */
export function extractGradedCert(
  rawValue: string,
): { company: GradingCompany | null; cert: string } | null {
  const psa = rawValue.match(/psacard\.com\/cert\/(\d+)/i);
  if (psa?.[1]) return { company: "PSA", cert: psa[1] };
  const bgs = rawValue.match(/beckett\.com\/.*item_id=(\d+)/i);
  if (bgs?.[1]) return { company: "BGS", cert: bgs[1] };
  const cgc = rawValue.match(/cgccards\.(?:com|uk)\/certlookup\/(\d+)/i);
  if (cgc?.[1]) return { company: "CGC", cert: cgc[1] };
  const tag = rawValue.match(
    /(?:my\.taggrading\.com\/card\/|tagd\.co\/)([A-Za-z0-9]+)/i,
  );
  if (tag?.[1]) return { company: "TAG", cert: tag[1].toUpperCase() };
  const cleaned = rawValue.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (/^[A-Z]\d{7}$/.test(cleaned)) {
    return { company: "TAG", cert: cleaned };
  }
  if (/^\d{7}-\d{3}$/.test(cleaned)) {
    return { company: "SGC", cert: cleaned };
  }
  const digits = rawValue.replace(/\D/g, "");
  if (digits.length >= 5 && digits.length <= 12) {
    return { company: null, cert: digits };
  }
  if (/^[A-Z0-9]{6,12}$/.test(cleaned) && /\d/.test(cleaned)) {
    return { company: null, cert: cleaned };
  }
  return null;
}

/** One graded slab, drawn as a slab: the clear case edge
    around the company's label band — PSA's white band with
    the red wordmark, Beckett's gold/silver/black by grade,
    SGC's black tuxedo band, CGC's blue, TAG's dark case
    printing — the grade big at the right, the cert under a
    drawn barcode strip (pattern derived from the cert's own
    characters, like the CGC comic slabs). */
export function GradedSlabVisual({
  slab,
  cardName,
  onRemove,
  removing,
  onOpen,
}: {
  slab: GradedSlab;
  cardName?: string;
  onRemove?: () => void;
  removing?: boolean;
  /** Opens the slab's Card / Slab View. When set, the slab
      photo is the tap target. */
  onOpen?: () => void;
}) {
  const meta = companyMeta(slab.company);
  const band = ((): {
    wrap: string;
    word: string;
    sub: string;
    wordmark: string;
  } => {
    switch (slab.company) {
      case "BGS":
        if (slab.grade === "Perfect 10") {
          return {
            wrap: "bg-[#17181c] text-white",
            word: "text-white",
            sub: "text-white/60",
            wordmark: "BECKETT",
          };
        }
        if (slab.grade === "10" || slab.grade === "9.5") {
          return {
            wrap:
              "bg-gradient-to-b from-[#e8cd7a] to-[#c9a227] text-[#221a04]",
            word: "text-[#221a04]",
            sub: "text-[#221a04]/60",
            wordmark: "BECKETT",
          };
        }
        return {
          wrap:
            "bg-gradient-to-b from-[#e3e5e8] to-[#b9bdc4] text-[#191919]",
          word: "text-[#191919]",
          sub: "text-[#191919]/55",
          wordmark: "BECKETT",
        };
      case "SGC":
        return {
          wrap: "bg-[#101014] text-white",
          word: "text-[#e8cd7a]",
          sub: "text-white/55",
          wordmark: "SGC",
        };
      case "CGC":
        return {
          wrap: "bg-[#005eb8] text-white",
          word: "text-white",
          sub: "text-white/65",
          wordmark: "CGC",
        };
      case "TAG":
        return {
          wrap: "bg-[#1c1f24] text-white",
          word: "text-white",
          sub: "text-white/55",
          wordmark: "TAG",
        };
      default:
        return {
          wrap: "bg-[#f4f1ea] text-[#191919]",
          word: "text-[#c8102e]",
          sub: "text-[#191919]/55",
          wordmark: "PSA",
        };
    }
  })();
  const chars = slab.cert
    .split("")
    .map((ch) => ch.charCodeAt(0));
  return (
    <div className="overflow-hidden rounded-xl border border-white/25 bg-gradient-to-b from-white/[0.14] to-white/[0.04] shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
      <div className={`px-3 pb-2 pt-2.5 ${band.wrap}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[15px] font-black leading-none tracking-tight ${band.word} ${
                slab.company === "PSA" ? "italic" : ""
              }`}
            >
              {band.wordmark}
            </p>
            <p className="mt-1 truncate text-[11px] font-semibold leading-tight">
              {cardName ?? "Graded copy"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`text-[9px] font-bold uppercase tracking-wider ${band.sub}`}
            >
              Grade
            </p>
            <p className="text-xl font-black leading-none tabular-nums">
              {slab.grade === "Authentic" ? "AUTH" : slab.grade}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p
            className={`text-[10px] font-medium leading-tight ${band.sub}`}
          >
            {gradeLabelFor(slab.company, slab.grade)}
          </p>
          <div className="text-right">
            <p className="text-[11px] font-bold tabular-nums leading-tight">
              Cert {slab.cert}
            </p>
            <div
              aria-hidden="true"
              className="mt-0.5 flex h-3 items-stretch justify-end gap-[1.5px]"
            >
              {chars.map((code, i) => (
                <span
                  key={i}
                  className={
                    slab.company === "SGC" ||
                    slab.company === "CGC" ||
                    slab.company === "TAG" ||
                    (slab.company === "BGS" &&
                      slab.grade === "Perfect 10")
                      ? "bg-white"
                      : "bg-[#191919]"
                  }
                  style={{ width: `${1 + ((code + i) % 3)}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {slab.imageUrl ? (
        onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open the Card / Slab View for the ${meta.label} slab, cert ${slab.cert}`}
            className="block w-full"
          >
            <img
              src={slab.imageUrl}
              alt={`Photo of the ${meta.label} slab, cert ${slab.cert}`}
              className="block max-h-64 w-full object-cover"
              draggable={false}
            />
          </button>
        ) : (
          <img
            src={slab.imageUrl}
            alt={`Photo of the ${meta.label} slab, cert ${slab.cert}`}
            className="block max-h-64 w-full object-cover"
            draggable={false}
          />
        )
      ) : null}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-[11px] leading-snug text-[var(--dim)]">
          {slab.paid != null
            ? `Paid ${fmtMoneyUSD(slab.paid)}`
            : "No paid amount recorded"}
          {slab.qty > 1 ? ` · ${slab.qty} copies` : ""}
          {" · "}
          <a
            href={companyCertUrl(slab.company, slab.cert)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--gold-soft)] underline"
          >
            {companyCertLinkLabel(slab.company)}
          </a>
          {slab.imageSource === "company" ? (
            <>
              {" · "}
              Slab photo from {meta.short}&rsquo;s cert record
            </>
          ) : slab.imageSource === "user" ? (
            <>
              {" · "}
              Your photo of this slab
            </>
          ) : null}
        </p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            aria-label={`Remove the ${meta.label} slab with cert ${slab.cert}`}
            className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)] disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The graded-copies block on a catalog card's page: every
    graded slab saved against the card, drawn as a slab,
    plus the door into the cert scanner with this card
    already chosen. Removing a slab steps the owned count
    back down (the server keeps the two in step). */
export function GradedSlabsBox({
  game,
  cardId,
  cardName,
  onAddSlab,
  onOpenSlab,
}: {
  game: GameKey;
  cardId: number;
  cardName: string;
  onAddSlab: () => void;
  /** Opens a saved slab's Card / Slab View (tap its photo). */
  onOpenSlab?: (slab: GradedSlab) => void;
}) {
  const queryClient = useQueryClient();
  const slabs = useQuery({
    queryKey: ["gradedSlabs", cardId],
    queryFn: () => api.listGradedSlabs({ gameCardId: cardId }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.removeGradedSlab({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["gradedSlabs", cardId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameCatalog", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSection", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSearch", game],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameOwnedItems", game],
      });
    },
  });
  const [confirmRemoveId, setConfirmRemoveId] = useState<
    number | null
  >(null);
  const rows = slabs.data?.slabs ?? [];
  return (
    <div className="w-full max-w-sm">
      <h3 className="text-center text-sm font-bold text-[var(--text)]">
        Graded copies
      </h3>
      {rows.length > 0 ? (
        <div className="mt-3 flex w-full flex-col gap-2.5">
          {rows.map((slab) => (
            <div key={slab.id}>
              <GradedSlabVisual
                slab={slab}
                cardName={cardName}
                removing={remove.isPending}
                onRemove={() => setConfirmRemoveId(slab.id)}
                onOpen={
                  onOpenSlab ? () => onOpenSlab(slab) : undefined
                }
              />
              {confirmRemoveId === slab.id ? (
                <div className="mt-1.5 flex items-center justify-center gap-2">
                  <span className="text-xs text-[var(--dim)]">
                    Remove this slab? Its copy comes off the
                    owned count too.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmRemoveId(null);
                      remove.mutate(slab.id);
                    }}
                    className="rounded-full bg-[#c8102e] px-3 py-1 text-xs font-bold text-white"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(null)}
                    className="rounded-full px-2 py-1 text-xs text-[var(--dim)]"
                  >
                    Keep
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-center text-xs leading-relaxed text-[var(--dim)]">
          No graded copies yet — if this card sits in a PSA,
          Beckett, SGC, CGC, or TAG slab, scan its cert number
          and the slab lives here.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          hapticTick();
          onAddSlab();
        }}
        aria-label={`Scan a grading cert number for ${cardName}`}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-semibold text-[var(--gold-soft)]"
      >
        <BarcodeGlyph />
        Add a graded slab — scan its cert
      </button>
    </div>
  );
}

function BarcodeGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-4.5 w-4.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M4 5v14M8 5v14M11 5v14M15 5v14M17.5 5v14M21 5v14" />
    </svg>
  );
}

function CompanyPills({
  value,
  onChange,
}: {
  value: GradingCompany;
  onChange: (c: GradingCompany) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Grading company"
    >
      {GRADING_COMPANIES.map((c) => {
        const active = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(c.key);
            }}
            aria-pressed={active}
            aria-label={`Grading company: ${c.label}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
              active
                ? "bg-[var(--gold)] text-black"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}

/** JPEG-encode an image source at at most 1280px, returning
    the bare base64 the label-read action takes (same helper
    shape as the card scanner's). */
function drawToJpegBase64(
  source: CanvasImageSource,
  w: number,
  h: number,
): string {
  const max = 1280;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("Canvas unavailable");
  ctx2d.drawImage(source, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function imageFileToJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () =>
          reject(new Error("Could not read that photo"));
        el.src = url;
      },
    );
    return drawToJpegBase64(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A pick-list row for the card-in-the-slab search: the
    catalog card shape plus, in the unified scanner (game
    "any"), which catalog it came from. */
export type GradedPickRow = GradedCardPick & {
  gameLabel?: string;
};

/** Catalog display names for the unified scanner's pick
    list (keys are the server's game keys). */
function gameDisplayName(key: string): string {
  switch (key) {
    case "pokemon":
      return "Pokémon";
    case "magic":
      return "Magic: The Gathering";
    case "starwars":
      return "Star Wars: Unlimited";
    case "topps":
      return "Topps Baseball";
    case "bowman":
      return "Bowman Baseball";
    case "topps-basketball":
      return "Topps Basketball";
    case "disney-topps":
      return "Disney Topps";
    case "starwars-topps":
      return "Star Wars Topps";
    case "gpk":
      return "Garbage Pail Kids";
    case "wwe-topps":
      return "WWE Topps";
    default:
      return key;
  }
}

export type CertLookup = ApiResponse<
  typeof api,
  "lookupGradedCert"
>;

/** The graded slab capture panel — ONE panel with two
    hostings (Anthony, Nov 5, 2026): inside the unified
    scanner as its slab mode (embedded — the scanner
    supplies the chrome and the mode switch), and as a
    full-screen overlay from a game section's pill or a
    card's own page. Codes only: QR, barcode, a photo of the
    label, or typing — it never runs the card artwork
    matcher. Opened from a section (or the unified scanner)
    no card is chosen yet, so after the cert is read the
    collector picks which catalog card the slab is; opened
    from a card's page that card is fixed. On the confirm
    screen the online lookup runs against the company's own
    cert record and pre-fills what it actually read. Nothing
    is saved until the confirm screen's Save — a read can be
    wrong, and the collector is the check. Saving hands the
    saved slab back so the caller lands the collector on its
    Card / Slab View. */
export function SlabCapturePanel({
  game,
  fixedCard,
  embedded = false,
  onClose,
  onSavedSlab,
  onOpenExistingSlab,
}: {
  game: GameKey | "any";
  fixedCard: GradedCardPick | null;
  /** Rendered inside the unified scanner: no fixed overlay
      chrome and no header of its own. */
  embedded?: boolean;
  onClose: () => void;
  /** Saved: the new slab and its card — the caller opens
      the slab's Card / Slab View. */
  onSavedSlab: (slab: GradedSlab, card: GradedCardPick) => void;
  /** The cert already lives in the vault: its slab and
      card, so the caller can open that slab's view. */
  onOpenExistingSlab: (
    slab: GradedSlab,
    card: GradedCardPick,
  ) => void;
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const doneRef = useRef(false);
  const [phase, setPhase] = useState<"scan" | "confirm">("scan");
  const [cameraState, setCameraState] = useState<
    "starting" | "live" | "unavailable"
  >("starting");
  const [note, setNote] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [company, setCompany] = useState<GradingCompany>("PSA");
  const [cert, setCert] = useState("");
  const [grade, setGrade] = useState("");
  const [paid, setPaid] = useState("");
  const [labelRead, setLabelRead] = useState<string | null>(null);
  const [picked, setPicked] = useState<GradedPickRow | null>(
    fixedCard,
  );
  /** The online cert lookup's result for the cert on the
      confirm screen (null until it lands). */
  const [lookup, setLookup] = useState<CertLookup | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const meta = companyMeta(company);
  const normalizedCert = normalizeCert(company, cert);
  const certValid = certValidFor(company, normalizedCert);
  const gradeOptions = gradeOptionsFor(company);

  const changeCompany = (c: GradingCompany) => {
    setCompany(c);
    // A grade one company gives may not exist at another
    // (PSA and TAG have no 9.5; TAG has no Authentic) —
    // clear it rather than carry an impossible grade over.
    if (
      grade !== "" &&
      !gradeOptionsFor(c).some((o) => o.value === grade)
    ) {
      setGrade("");
    }
  };

  const dupCheck = useQuery({
    queryKey: ["gradedSlabByCert", company, normalizedCert],
    queryFn: () =>
      api.findGradedSlabByCert({ company, cert: normalizedCert }),
    enabled: phase === "confirm" && certValid,
  });
  const existing = dupCheck.data?.existing ?? null;

  const pickSearch = useQuery({
    queryKey: ["gradedPickSearch", game, pickQuery.trim()],
    queryFn: async (): Promise<{ results: GradedPickRow[] }> => {
      const q = pickQuery.trim();
      if (game === "any") {
        // The unified scanner doesn't know which catalog the
        // slab belongs to, so the pick rides the universal
        // search across every card catalog; Funko figures
        // and Lego sets never take slabs and are filtered
        // out (the standing search rule applies as-is:
        // typeahead from the first letter).
        const r = await api.searchAllCollectibles({ query: q });
        return {
          results: r.games
            .filter((g) => g.game !== "funko" && g.game !== "lego")
            .map((g) => ({
              id: g.id,
              name: g.name,
              printed: g.printed,
              sectionName: g.sectionName,
              rarity: g.rarity,
              finish: g.finish,
              imageUrl: g.imageUrl,
              price: g.price,
              ownedQty: g.ownedQty,
              ownedSealedQty: g.ownedSealedQty,
              gameLabel: g.game,
            })),
        };
      }
      const r = await api.searchGameCards({ game, query: q });
      return { results: r.results };
    },
    // The standing search rule: typeahead from the first
    // letter, previous results stay while typing.
    enabled: !fixedCard && pickQuery.trim().length >= 1,
    placeholderData: (prev) => prev,
  });

  // The online cert lookup (Anthony's flow: scan → cert
  // recognized → company site → slab photo imported →
  // confirm). Runs once per company+cert when the confirm
  // screen opens with a well-formed cert. A record that was
  // actually read pre-fills the grade; the imported photo
  // rides the save. A lookup that found nothing — or could
  // not reach the company — changes nothing: the label read
  // and the collector's own entry rule, and the confirm
  // screen says which happened, plainly.
  const lookupMut = useMutation({
    mutationFn: (a: { company: GradingCompany; cert: string }) =>
      api.lookupGradedCert(a),
    onSuccess: (r, a) => {
      setLookup(r);
      if (
        r.status === "found" &&
        r.grade &&
        gradeOptionsFor(a.company).some((o) => o.value === r.grade)
      ) {
        setGrade(r.grade);
      }
    },
    onError: () => {
      // The confirm screen's lookup line falls back to its
      // "couldn't check" wording via lookup staying null
      // with the mutation settled.
    },
  });
  const lookupMutRef = useRef(lookupMut);
  lookupMutRef.current = lookupMut;
  const lookupKeyRef = useRef("");
  useEffect(() => {
    if (phase !== "confirm" || !certValid) return;
    const key = `${company}:${normalizedCert}`;
    if (lookupKeyRef.current === key) return;
    lookupKeyRef.current = key;
    setLookup(null);
    lookupMutRef.current.mutate({ company, cert: normalizedCert });
  }, [phase, certValid, company, normalizedCert]);

  const readPhoto = useMutation({
    mutationFn: (imageBase64: string) =>
      api.readGradedSlabPhoto({ imageBase64, company }),
    onSuccess: (r) => {
      if (r.cert || r.grade || r.labelText || r.company) {
        const effective = r.company ?? company;
        if (r.company && r.company !== company) {
          changeCompany(r.company);
        }
        if (r.cert) setCert(r.cert);
        if (
          r.grade &&
          gradeOptionsFor(effective).some((o) => o.value === r.grade)
        ) {
          setGrade(r.grade);
        }
        setLabelRead(r.labelText);
        setNote(null);
        setPhase("confirm");
      } else {
        setNote(
          "That photo didn't give up its label — try again closer and straight-on, or type the cert number below.",
        );
      }
    },
    onError: () => {
      setNote(
        "The label read didn't go through — type the cert number below instead.",
      );
    },
  });
  const readPhotoRef = useRef(readPhoto);
  readPhotoRef.current = readPhoto;

  const save = useMutation({
    mutationFn: (args: {
      gameCardId: number;
      company: GradingCompany;
      cert: string;
      grade: string;
      paid: number | null;
      imageKey: string | null;
      imageBackKey: string | null;
      onlineLine: string | null;
    }) =>
      api.addGradedSlab({
        ...args,
        ...(args.imageKey
          ? { imageSource: "company" as const }
          : {}),
      }),
    onSuccess: (r, args) => {
      if (r.added && r.slab) {
        const card = picked ?? fixedCard;
        void queryClient.invalidateQueries({
          queryKey: ["gradedSlabs", args.gameCardId],
        });
        if (game !== "any") {
          void queryClient.invalidateQueries({
            queryKey: ["gameCatalog", game],
          });
          void queryClient.invalidateQueries({
            queryKey: ["gameSection", game],
          });
          void queryClient.invalidateQueries({
            queryKey: ["gameSearch", game],
          });
          void queryClient.invalidateQueries({
            queryKey: ["gameOwnedItems", game],
          });
        }
        if (card) onSavedSlab(r.slab, card);
      } else if (r.duplicate) {
        // Lost a race with the duplicate check — the check
        // query refetches and the warning takes over.
        setSaveError(null);
        void dupCheck.refetch();
      } else {
        setSaveError(
          r.error ?? "That slab didn't save — try again.",
        );
      }
    },
    onError: () => {
      setSaveError(
        "That slab didn't save — check the connection and try again.",
      );
    },
  });

  useEffect(() => {
    if (phase !== "scan") {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    let timer: number | null = null;
    const stop = () => {
      if (timer != null) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
    const start = async () => {
      const BD = (
        window as unknown as {
          BarcodeDetector?: new (opts?: {
            formats?: string[];
          }) => {
            detect: (
              src: HTMLVideoElement,
            ) => Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;
      if (!BD || !navigator.mediaDevices?.getUserMedia) {
        setCameraState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const detector = new BD({
          formats: [
            "qr_code",
            "code_128",
            "code_39",
            "code_93",
            "upc_a",
            "ean_13",
            "ean_8",
          ],
        });
        setCameraState("live");
        timer = window.setInterval(() => {
          if (doneRef.current || cancelled) return;
          void detector
            .detect(video)
            .then((codes) => {
              for (const code of codes) {
                const found = extractGradedCert(code.rawValue ?? "");
                if (found) {
                  doneRef.current = true;
                  hapticTick();
                  if (found.company) changeCompany(found.company);
                  setCert(found.cert);
                  setPhase("confirm");
                  return;
                }
              }
            })
            .catch(() => undefined);
        }, 350);
      } catch {
        if (!cancelled) setCameraState("unavailable");
      }
    };
    void start();
    return () => {
      cancelled = true;
      stop();
    };
    // changeCompany is state setters only — stable in
    // practice; the camera restarts per phase, not per pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const captureLabelPhoto = () => {
    const video = videoRef.current;
    if (
      cameraState === "live" &&
      video &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      try {
        readPhoto.mutate(
          drawToJpegBase64(
            video,
            video.videoWidth,
            video.videoHeight,
          ),
        );
        return;
      } catch {
        // Fall through to the file picker.
      }
    }
    fileRef.current?.click();
  };

  const submitTyped = () => {
    const normalized = normalizeCert(company, typed);
    if (!certValidFor(company, normalized)) {
      setNote(
        `That doesn't match a ${meta.label} cert number — ${meta.certHint}. Check the slab's label and try again.`,
      );
      return;
    }
    setNote(null);
    setCert(normalized);
    setPhase("confirm");
  };

  const paidValue =
    paid.trim() === "" ? null : Number(paid.replace(/[^0-9.]/g, ""));
  const canSave =
    certValid &&
    grade !== "" &&
    (fixedCard != null || picked != null) &&
    !existing &&
    !save.isPending;

  return (
    <div
      className={
        embedded
          ? "relative"
          : "fixed inset-0 z-[75] overflow-y-auto bg-[var(--bg)]"
      }
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-label="Scan a grading cert number"
    >
      <div
        className={
          embedded
            ? "w-full"
            : "mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        }
      >
        {embedded ? null : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the cert scanner"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
            >
              ←
            </button>
            <div>
              <h2 className="font-album text-xl text-[var(--text)]">
                Scan graded cert
              </h2>
              <p className="text-xs text-[var(--dim)]">
                The cert number on the slab&rsquo;s label — QR
                code, barcode, or the printed characters
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <CompanyPills value={company} onChange={changeCompany} />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Take or pick a photo of the slab label"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void imageFileToJpegBase64(file)
              .then((b64) => readPhotoRef.current.mutate(b64))
              .catch(() =>
                setNote(
                  "That photo couldn't be read — type the cert number instead.",
                ),
              );
          }}
        />

        {phase === "scan" ? (
          <>
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
                aria-label="Camera view for scanning a graded slab code"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-[var(--gold)]/80"
              />
            </div>
            <p
              className="mt-3 text-center text-sm text-[var(--dim)]"
              role="status"
            >
              {cameraState === "live"
                ? "Point the camera at the slab's QR code or barcode."
                : cameraState === "unavailable"
                  ? "Live code scanning isn't available here — photograph the label or type the number."
                  : "Starting the camera…"}
            </p>
            <button
              type="button"
              onClick={captureLabelPhoto}
              disabled={readPhoto.isPending}
              className="mt-3 w-full rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
            >
              {readPhoto.isPending
                ? "Reading the label…"
                : "Photograph the label instead"}
            </button>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={`…or type the ${meta.short} cert number`}
                aria-label={`Type the ${meta.label} cert number`}
                className="h-11 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold tabular-nums text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
              />
              <button
                type="submit"
                disabled={typed.trim().length < 4}
                className="h-11 shrink-0 rounded-full bg-[var(--accent)] px-4 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
              >
                Continue
              </button>
            </form>
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              {meta.label} certs: {meta.certHint}.
            </p>
            {note ? (
              <p
                className="mt-2 text-xs leading-relaxed text-[var(--dim)]"
                role="status"
              >
                {note}
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-5">
            <GradedSlabVisual
              slab={{
                id: 0,
                company,
                cert: normalizedCert || "····",
                grade: grade || "?",
                paid: paidValue,
                qty: 1,
                imageUrl:
                  lookup?.status === "found"
                    ? lookup.imageUrl
                    : null,
                imageBackUrl:
                  lookup?.status === "found"
                    ? lookup.imageBackUrl
                    : null,
                imageSource:
                  lookup?.status === "found" && lookup.imageKey
                    ? "company"
                    : null,
                onlineLine:
                  lookup?.status === "found" ? lookup.line : null,
                createdAt: 0,
              }}
              cardName={
                (fixedCard ?? picked)?.name ??
                (labelRead ?? "Pick the card below")
              }
            />
            {labelRead ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                The label reads: {labelRead}. Check the company,
                cert, and grade against the slab before saving —
                a misread character saves the wrong cert.
              </p>
            ) : null}
            {certValid ? (
              <div
                className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
                role="status"
              >
                {lookup == null ? (
                  <p className="text-xs leading-relaxed text-[var(--dim)]">
                    {lookupMut.isPending
                      ? `Checking ${meta.label}'s online record for cert ${normalizedCert}…`
                      : `Couldn't check ${meta.label}'s online record just now — the record below is from the label itself.`}
                  </p>
                ) : lookup.status === "found" ? (
                  <div>
                    <p className="text-xs leading-relaxed text-[var(--text)]">
                      <span className="font-bold">
                        Found on {meta.label}&rsquo;s site.
                      </span>{" "}
                      {lookup.line
                        ? `Their record reads: ${lookup.line}. `
                        : ""}
                      {lookup.grade
                        ? "The grade above was filled in from their record — check it against the label. "
                        : ""}
                      {lookup.imageUrl
                        ? "Their slab photo for this cert was imported below and saves with the slab."
                        : `${meta.label} hosts no slab photo for this cert, so the card's catalog art will stand in on its page — labeled as a stand-in, and you can replace it with your own photo.`}
                    </p>
                    {lookup.imageUrl ? (
                      <img
                        src={lookup.imageUrl}
                        alt={`The slab photo ${meta.label} hosts for cert ${normalizedCert}`}
                        className="mt-2 max-h-56 w-full rounded-lg object-cover"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                ) : lookup.status === "not-found" ? (
                  <p className="text-xs leading-relaxed text-[var(--dim)]">
                    {meta.label} has no record under cert{" "}
                    {normalizedCert} — double-check the number
                    against the label. You can still save exactly
                    what the label shows.
                  </p>
                ) : lookup.status === "no-online-record" ? (
                  <p className="text-xs leading-relaxed text-[var(--dim)]">
                    {meta.label} publishes no online cert record
                    to check against — the record below is from
                    the label itself.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed text-[var(--dim)]">
                    {meta.label}&rsquo;s site couldn&rsquo;t be
                    read from here just now, so nothing was filled
                    in or imported — the record below is from the
                    label itself.
                  </p>
                )}
              </div>
            ) : null}

            <label
              htmlFor="graded-cert-input"
              className="mt-4 block text-xs font-bold uppercase tracking-wide text-[var(--dim)]"
            >
              Cert number
            </label>
            <input
              id="graded-cert-input"
              type="text"
              value={cert}
              onChange={(e) =>
                setCert(
                  e.target.value.toUpperCase().replace(/\s+/g, ""),
                )
              }
              aria-label={`${meta.label} cert number`}
              className="mt-1.5 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-base font-bold tabular-nums text-[var(--text)]"
            />
            {cert !== "" && !certValid ? (
              <p className="mt-1.5 text-xs text-[var(--dim)]">
                {meta.label} certs: {meta.certHint}.
              </p>
            ) : null}

            <label
              htmlFor="graded-grade-select"
              className="mt-4 block text-xs font-bold uppercase tracking-wide text-[var(--dim)]"
            >
              Grade on the label
            </label>
            <VxSelect
              id="graded-grade-select"
              ariaLabel={`Grade on the ${meta.label} label`}
              value={grade}
              onChange={setGrade}
              options={gradeOptions}
              className="mt-1.5 w-full"
            />

            <label
              htmlFor="graded-paid-input"
              className="mt-4 block text-xs font-bold uppercase tracking-wide text-[var(--dim)]"
            >
              Paid (optional)
            </label>
            <input
              id="graded-paid-input"
              type="text"
              inputMode="decimal"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="What this slab cost, if you want it kept"
              aria-label="What was paid for this slab, optional"
              className="mt-1.5 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
            />

            {existing ? (
              <div className="mt-4 rounded-2xl border border-[#c8102e]/60 bg-[var(--surface)] p-4">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {meta.label} cert {existing.slab.cert} is
                  already in the vault.
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
                  It sits on {existing.card.name} (
                  {existing.card.sectionName}) as a{" "}
                  {companyMeta(existing.slab.company).label}{" "}
                  {existing.slab.grade}. Within one company, one
                  cert number is one physical slab, so it
                  can&rsquo;t be added twice — if this slab was
                  recorded against the wrong card, remove it from
                  that card first.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onOpenExistingSlab(
                      existing.slab,
                      existing.card,
                    )
                  }
                  className="mt-3 w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--on-accent)]"
                >
                  Open its Card / Slab View
                </button>
              </div>
            ) : (
              <>
                {fixedCard ? (
                  <p className="mt-4 text-sm leading-relaxed text-[var(--dim)]">
                    This slab goes on{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {fixedCard.name}
                    </span>{" "}
                    ({fixedCard.sectionName}
                    {fixedCard.printed
                      ? ` · #${fixedCard.printed}`
                      : ""}
                    ) and counts as one owned copy.
                  </p>
                ) : (
                  <div className="mt-4">
                    <label
                      htmlFor="graded-pick-search"
                      className="block text-xs font-bold uppercase tracking-wide text-[var(--dim)]"
                    >
                      Which card is in the slab?
                    </label>
                    {picked ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-2xl border border-[var(--accent)]/60 bg-[var(--surface)] px-3.5 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--text)]">
                            {picked.name}
                          </span>
                          <span className="block text-xs text-[var(--dim)]">
                            {picked.sectionName}
                            {picked.printed
                              ? ` · #${picked.printed}`
                              : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPicked(null)}
                          className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-[var(--dim)]"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          id="graded-pick-search"
                          type="search"
                          value={pickQuery}
                          onChange={(e) =>
                            setPickQuery(e.target.value)
                          }
                          placeholder="Search this catalog by name, or name + number…"
                          aria-label="Search the catalog for the card in the slab"
                          className="mt-1.5 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
                        />
                        {pickQuery.trim().length >= 1 ? (
                          (pickSearch.data?.results ?? [])
                            .length > 0 ? (
                            <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
                              {(
                                pickSearch.data?.results ?? []
                              ).map((r) => (
                                <li key={r.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      hapticTick();
                                      setPicked(r);
                                    }}
                                    aria-label={`The slab is ${r.name}, ${r.sectionName} number ${r.printed}`}
                                    className="flex w-full items-center gap-3 py-2.5 text-left"
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold text-[var(--text)]">
                                        {r.name}
                                      </span>
                                      <span className="block text-xs text-[var(--dim)]">
                                        {r.gameLabel
                                          ? `${gameDisplayName(r.gameLabel)} · `
                                          : ""}
                                        {r.sectionName}
                                        {r.printed
                                          ? ` · #${r.printed}`
                                          : ""}
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-xs font-semibold text-[var(--gold-soft)]">
                                      Pick
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
                              {pickSearch.isPending
                                ? "Searching…"
                                : "No card matches yet — if this catalog is still downloading, the card may not have landed."}
                            </p>
                          )
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canSave}
                  onClick={() => {
                    const card = fixedCard ?? picked;
                    if (!card) return;
                    setSaveError(null);
                    save.mutate({
                      gameCardId: card.id,
                      company,
                      cert: normalizedCert,
                      grade,
                      paid:
                        paidValue != null &&
                        Number.isFinite(paidValue)
                          ? paidValue
                          : null,
                      imageKey:
                        lookup?.status === "found"
                          ? lookup.imageKey
                          : null,
                      imageBackKey:
                        lookup?.status === "found"
                          ? lookup.imageBackKey
                          : null,
                      onlineLine:
                        lookup?.status === "found"
                          ? lookup.line
                          : null,
                    });
                  }}
                  className="mt-4 w-full rounded-full bg-[var(--gold)] px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
                >
                  {save.isPending
                    ? "Saving the slab…"
                    : `Save this ${meta.short} slab`}
                </button>
                {saveError ? (
                  <p
                    className="mt-2 text-xs leading-relaxed text-[var(--dim)]"
                    role="status"
                  >
                    {saveError}
                  </p>
                ) : null}
                <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
                  Saving keeps the cert number with the card.
                  The online check above reads {meta.label}
                  &rsquo;s own record when it can be reached —
                  it never fetches or estimates a slab price from{" "}
                  {meta.label}.{" "}
                  {certValid ? (
                    <a
                      href={companyCertUrl(company, normalizedCert)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--gold-soft)] underline"
                    >
                      {companyCertLinkLabel(company)}
                      {company === "SGC" ? "" : ` — cert ${normalizedCert}`}
                    </a>
                  ) : (
                    "The company's own cert page can verify any number."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    doneRef.current = false;
                    setPhase("scan");
                    setSaveError(null);
                  }}
                  className="mt-2 w-full rounded-full px-4 py-2 text-sm text-[var(--dim)]"
                >
                  Scan again
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The Card / Slab View (Anthony's name, Nov 5, 2026): a
    saved slab's own full detail page, the destination after
    a scan saves and whenever a slab's photo is tapped. The
    slab photo hovers and turns on the turntable like a card
    (with a front-to-back flip when a back photo exists),
    the owned copies under this company+cert step with the
    same plus/minus stepper and long-press count picker as
    the cards — plus adds to inventory, minus removes, saved
    immediately — and the record's financials sit in tabs.
    Photo honesty is structural: a company-imported photo is
    captioned as the company's photo for this cert, the
    collector's own photo as theirs, and when neither exists
    the catalog card art stands in inside a slab frame,
    labeled a stand-in — never presented as their slab. */
export function SlabDetailView({
  slabId,
  onClose,
}: {
  slabId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["gradedSlabDetail", slabId],
    queryFn: () => api.getGradedSlab({ id: slabId }),
  });
  const slab = detail.data?.slab ?? null;
  const card = detail.data?.card ?? null;
  const meta = companyMeta(slab?.company ?? "PSA");

  // Back-gesture trap, the CardDetailSheet pattern: this
  // full-screen view takes the window's one history entry;
  // Back pops it and closes the view first.
  const pushedRef = useRef(false);
  const heldRef = useRef(false);
  useEffect(() => {
    pushedRef.current = pushWindowState(
      { ...(readNavState() ?? {}), lorcanaSlabView: true },
      "lorcanaSlabView",
    );
    heldRef.current = true;
    const onPopState = () => {
      if (
        heldRef.current &&
        readNavState()?.lorcanaSlabView !== true
      ) {
        heldRef.current = false;
        pushedRef.current = false;
        onClose();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current) {
        pushedRef.current = false;
        heldRef.current = false;
        if (readNavState()?.lorcanaSlabView === true) {
          window.history.back();
        }
      } else if (heldRef.current) {
        heldRef.current = false;
        scrubWindowKeys(["lorcanaSlabView"]);
      }
    };
    // Mount-only: one entry per view opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeView = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      heldRef.current = false;
      scrubWindowKeys(["lorcanaSlabView"]);
      onClose();
    }
  };

  const [qty, setQty] = useState<number | null>(null);
  useEffect(() => {
    if (slab && qty == null) setQty(slab.qty);
  }, [slab, qty]);
  const shownQty = qty ?? slab?.qty ?? 0;

  const invalidateSlab = () => {
    void queryClient.invalidateQueries({
      queryKey: ["gradedSlabDetail", slabId],
    });
    if (card) {
      void queryClient.invalidateQueries({
        queryKey: ["gradedSlabs", card.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameCatalog"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSection"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameSearch"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["gameOwnedItems"],
      });
    }
  };
  const setQtyMut = useMutation({
    mutationFn: (next: number) =>
      api.setGradedSlabQty({ id: slabId, qty: next }),
    onSuccess: (r) => {
      if (r.removed) {
        invalidateSlab();
        closeView();
      } else {
        setQty(r.qty);
        invalidateSlab();
      }
    },
  });
  const stepQty = (next: number) => {
    const clamped = Math.max(0, Math.min(999, next));
    setQty(clamped);
    setQtyMut.mutate(clamped);
  };

  const [dialOpen, setDialOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const beginPress = () => {
    longPressedRef.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressedRef.current = true;
      setDialOpen(true);
    }, 450);
  };
  const endPress = () => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const [tab, setTab] = useState<"details" | "performance">(
    "details",
  );
  const [flipped, setFlipped] = useState(false);
  const [paidDraft, setPaidDraft] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const frontFileRef = useRef<HTMLInputElement | null>(null);
  const backFileRef = useRef<HTMLInputElement | null>(null);

  const savePaid = useMutation({
    mutationFn: (paid: number | null) =>
      api.updateGradedSlabPaid({ id: slabId, paid }),
    onSuccess: () => {
      setPaidDraft(null);
      invalidateSlab();
    },
  });
  const savePhoto = useMutation({
    mutationFn: (a: { side: "front" | "back"; b64: string }) =>
      api.saveGradedSlabPhoto({
        id: slabId,
        side: a.side,
        imageBase64: a.b64,
      }),
    onSuccess: () => invalidateSlab(),
  });
  const removeMut = useMutation({
    mutationFn: () => api.removeGradedSlab({ id: slabId }),
    onSuccess: () => {
      invalidateSlab();
      closeView();
    },
  });

  const hasSlabPhoto = slab?.imageUrl != null;
  const heroFront =
    slab?.imageUrl ?? card?.imageUrl ?? null;
  const heroBack = slab?.imageBackUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={
        card
          ? `Card / Slab View — ${card.name}, ${meta.label} cert ${slab?.cert ?? ""}`
          : "Card / Slab View"
      }
    >
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeView}
            aria-label="Back from the Card / Slab View"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text)]"
          >
            ←
          </button>
          <div className="min-w-0">
            <h2 className="font-album text-xl text-[var(--text)]">
              Card / Slab View
            </h2>
            <p className="truncate text-xs text-[var(--dim)]">
              {card
                ? `${card.name} · ${meta.label} ${slab?.grade ?? ""} · Cert ${slab?.cert ?? ""}`
                : "Loading the slab…"}
            </p>
          </div>
        </div>

        {detail.isPending ? (
          <p
            className="mt-10 text-center text-sm text-[var(--dim)]"
            role="status"
          >
            Loading this slab…
          </p>
        ) : !slab || !card ? (
          <p className="mt-10 text-center text-sm leading-relaxed text-[var(--dim)]">
            That slab isn&rsquo;t in the vault anymore — it may
            have been removed.
          </p>
        ) : (
          <>
            <div className="mt-5 flex flex-col items-center">
              <Turntable
                label={`${card.name} in its ${meta.label} slab, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
                floatClassName="w-64 max-w-full sm:w-72"
              >
                <div
                  className="relative aspect-[3/4] w-full"
                  style={{ perspective: "900px" }}
                >
                  <div
                    className="absolute inset-0 transition-transform duration-500"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: flipped
                        ? "rotateY(180deg)"
                        : "rotateY(0deg)",
                    }}
                  >
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[10px] shadow-[0_28px_55px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      {heroFront ? (
                        <img
                          src={heroFront}
                          alt={
                            hasSlabPhoto
                              ? `Front of the ${meta.label} slab holding ${card.name}`
                              : `${card.name} catalog artwork standing in for the slab photo`
                          }
                          className="block h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] px-4 text-center text-sm text-[var(--dim)]">
                          No artwork or slab photo for this card
                          yet.
                        </div>
                      )}
                    </div>
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[10px] shadow-[0_28px_55px_rgba(0,0,0,0.6)] ring-1 ring-white/15"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      {heroBack ? (
                        <img
                          src={heroBack}
                          alt={`Back of the ${meta.label} slab holding ${card.name}`}
                          className="block h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--surface)] px-4 text-center text-sm text-[var(--dim)]">
                          No back photo for this slab.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Turntable>
              {heroBack ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticTick();
                    setFlipped((f) => !f);
                  }}
                  aria-label={
                    flipped
                      ? "Turn the slab back to its front"
                      : "Turn the slab over to its back"
                  }
                  className="mt-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--text)]"
                >
                  {flipped ? "See the front" : "See the back"}
                </button>
              ) : null}
              <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-[var(--dim)]">
                {slab.imageSource === "company"
                  ? `Slab photo imported from ${meta.label}'s cert record for cert ${slab.cert}.`
                  : slab.imageSource === "user"
                    ? "Your own photo of this slab."
                    : `${meta.label} hosts no photo for this cert, so this is the card's catalog artwork standing in — not a photo of your slab. Add your own photo below and it takes this place.`}
              </p>
            </div>

            <div className="mt-5 text-center">
              <h3 className="text-lg font-bold leading-tight text-[var(--text)]">
                {card.name}
              </h3>
              <p className="mt-0.5 text-sm text-[var(--dim)]">
                {card.sectionName} · #{card.printed}
                {card.rarity ? ` · ${card.rarity}` : ""} ·{" "}
                {gradeLabelFor(slab.company, slab.grade)} (
                {meta.label} {slab.grade})
              </p>
            </div>

            {/* The owned-copies stepper: the same plus/minus
                and long-press count picker as the cards,
                tied to this company+cert. */}
            <div className="relative mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="text-center text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                Copies under this cert
              </p>
              {dialOpen ? (
                <SidewaysCountDial
                  overlay
                  label={`Pick how many copies of this ${meta.label} slab (cert ${slab.cert}) you own`}
                  current={shownQty}
                  onPick={(n) => {
                    setDialOpen(false);
                    stepQty(n);
                  }}
                  onClose={() => setDialOpen(false)}
                />
              ) : null}
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => stepQty(shownQty - 1)}
                  disabled={shownQty <= 0 || setQtyMut.isPending}
                  aria-label={`Remove one copy of this slab (cert ${slab.cert}) from inventory`}
                  className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
                >
                  <span aria-hidden="true" className="stepper-ring flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-[var(--text)]">−</span>
                </button>
                <span className="text-base font-semibold tabular-nums text-[var(--text)]">
                  {shownQty} owned
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!longPressedRef.current) {
                      stepQty(shownQty + 1);
                    }
                    longPressedRef.current = false;
                  }}
                  onPointerDown={beginPress}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={setQtyMut.isPending}
                  aria-label={`Add one copy of this slab (cert ${slab.cert}) to inventory — hold to pick a count`}
                  className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
                >
                  <span aria-hidden="true" className="stepper-ring flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-[var(--text)]">+</span>
                </button>
              </div>
              <p className="mt-1 text-center text-[11px] leading-snug text-[var(--dim)]">
                Saves right away, and the card&rsquo;s owned
                count moves with it.
              </p>
            </div>

            <div
              className="mt-5 flex gap-1.5"
              role="tablist"
              aria-label="Slab information"
            >
              {(
                [
                  ["details", "Details"],
                  ["performance", "Card Performance"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-95 ${
                    tab === key
                      ? "bg-[var(--gold)] text-black"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "details" ? (
              <div className="mt-4 flex flex-col gap-3">
                <dl className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4">
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Grading company
                    </dt>
                    <dd className="text-sm font-semibold text-[var(--text)]">
                      {meta.label}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Cert number
                    </dt>
                    <dd className="text-sm font-bold tabular-nums text-[var(--text)]">
                      {slab.cert}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Grade
                    </dt>
                    <dd className="text-sm font-semibold text-[var(--text)]">
                      {gradeLabelFor(slab.company, slab.grade)}
                    </dd>
                  </div>
                  {slab.onlineLine ? (
                    <div className="py-2.5">
                      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                        {meta.label}&rsquo;s record
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-[var(--text)]">
                        {slab.onlineLine}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <a
                  href={companyCertUrl(slab.company, slab.cert)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center text-sm font-semibold text-[var(--gold-soft)] underline"
                >
                  {companyCertLinkLabel(slab.company)}
                  {slab.company === "SGC"
                    ? ""
                    : ` — cert ${slab.cert}`}
                </a>

                <div>
                  <label
                    htmlFor="slab-paid-input"
                    className="block text-xs font-bold uppercase tracking-wide text-[var(--dim)]"
                  >
                    Paid for this slab
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id="slab-paid-input"
                      type="text"
                      inputMode="decimal"
                      value={
                        paidDraft ??
                        (slab.paid != null ? String(slab.paid) : "")
                      }
                      onChange={(e) => setPaidDraft(e.target.value)}
                      placeholder="Not recorded"
                      aria-label="What was paid for this slab"
                      className="h-11 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
                    />
                    <button
                      type="button"
                      disabled={
                        paidDraft == null || savePaid.isPending
                      }
                      onClick={() => {
                        const v = (paidDraft ?? "").replace(
                          /[^0-9.]/g,
                          "",
                        );
                        savePaid.mutate(
                          v === "" ? null : Number(v),
                        );
                      }}
                      className="h-11 shrink-0 rounded-full bg-[var(--accent)] px-4 text-sm font-bold text-[var(--on-accent)] disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <input
                  ref={frontFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Pick your own photo of this slab's front"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void imageFileToJpegBase64(file).then(
                      (b64) =>
                        savePhoto.mutate({ side: "front", b64 }),
                    );
                  }}
                />
                <input
                  ref={backFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Pick your own photo of this slab's back"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void imageFileToJpegBase64(file).then(
                      (b64) =>
                        savePhoto.mutate({ side: "back", b64 }),
                    );
                  }}
                />
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => frontFileRef.current?.click()}
                    disabled={savePhoto.isPending}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
                  >
                    {hasSlabPhoto
                      ? "Replace the front photo with yours"
                      : "Add your photo of the front"}
                  </button>
                  <button
                    type="button"
                    onClick={() => backFileRef.current?.click()}
                    disabled={savePhoto.isPending}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
                  >
                    {heroBack
                      ? "Replace the back photo with yours"
                      : "Add your photo of the back"}
                  </button>
                </div>

                {confirmRemove ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-[var(--dim)]">
                      Remove this slab? Its{" "}
                      {slab.qty === 1
                        ? "copy comes"
                        : `${slab.qty} copies come`}{" "}
                      off the owned count too.
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMut.mutate()}
                      disabled={removeMut.isPending}
                      className="rounded-full bg-[#c8102e] px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="rounded-full px-2 py-1 text-xs text-[var(--dim)]"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    className="mx-auto rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--dim)]"
                  >
                    Remove this slab from the vault
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <dl className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4">
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Paid (per slab)
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      {slab.paid != null
                        ? fmtMoneyUSD(slab.paid)
                        : "Not recorded"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Copies
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      {slab.qty}
                    </dd>
                  </div>
                  {slab.paid != null ? (
                    <div className="flex items-baseline justify-between gap-3 py-2.5">
                      <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                        Total paid
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums text-[var(--text)]">
                        {fmtMoneyUSD(slab.paid * slab.qty)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Card&rsquo;s catalog price (raw)
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      {card.price != null
                        ? fmtMoneyUSD(card.price)
                        : "Not priced"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      Total owned (all copies)
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      {card.ownedQty}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs leading-relaxed text-[var(--dim)]">
                  The catalog price above is the ungraded
                  card&rsquo;s price — Vault X doesn&rsquo;t
                  fetch or estimate graded-slab prices from{" "}
                  {meta.label} or anywhere else, so no slab
                  value is claimed here.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
