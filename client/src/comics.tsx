// Comics section — layout cleaned up Nov 2, 2026 to copy the
// established comic-catalog apps (CLZ Comics and similar): a
// statistics strip, a cover-forward Card View grid of the real
// items with folder lists for grouping, and a full-screen detail
// view per item with a blurred-art backdrop, a title/price block,
// and tabs.
//
// The data is Anthony's own graded comics collection: 8 CGC slabs
// logged by Jarvis from his label photos on Oct 29, 2026 (source:
// ~/workspace/goals/graded-comics-collection/files/Graded-Comics-
// Collection.md). Every book is CGC 9.8 with WHITE Pages. Values are
// the Oct 29, 2026 checks from that log (eBay sold prices via
// PriceCharting, plus guide data) — estimates, not live prices, and
// each comic's Performance tab carries the basis and confidence from
// the log. Cover art and CGC label photos are Anthony's own photos
// from his graded comics binder, copied in as build-time assets —
// no remote images are rendered.
//
// Unlike Lorcana cards, graded slabs have no missing-card universe
// to ghost and no per-copy counts to edit, so the grid shows his 8
// owned slabs only and the detail view shows the owned slab instead
// of a count editor.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { hapticTick } from "./haptics";
import {
pushWindowState,
readNavState,
replaceNavState,
scrubWindowKeys,
useOwnEntryWindow,
} from "./historyNav";
import { useDragReorder } from "./dragReorder";
import { GradedSlabVisual, GRADING_COMPANIES } from "./gradedScan";
import { Turntable } from "./turntable";
import { SearchScanRow } from "./searchScanRow";
import { OwnedLocationBar } from "./whereItLives";
import { PriceAlertBox } from "./priceAlerts";
import { WatchToggleButton } from "./portfolioTools";
import { UatSpark, useJarvisVision } from "./uatSpark";
import {
Area,
AreaChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import coverAliens from "./assets/comics/cover-aliens-1.jpg";
import coverBatman from "./assets/comics/cover-batman-136.jpg";
import coverDeadpoolWolverine from "./assets/comics/cover-deadpool-wolverine-3.jpg";
import coverMandalorian from "./assets/comics/cover-mandalorian-4.jpg";
import coverVenom2021 from "./assets/comics/cover-venom-31-2021.jpg";
import coverVenom2024 from "./assets/comics/cover-venom-31-2024.jpg";
import coverWolverine154 from "./assets/comics/cover-wolverine-154.jpg";
import coverWolverine21 from "./assets/comics/cover-wolverine-21.jpg";
import slabAliens from "./assets/comics/slab-aliens-1.jpg";
import slabBatman from "./assets/comics/slab-batman-136.jpg";
import slabDeadpoolWolverine from "./assets/comics/slab-deadpool-wolverine-3.jpg";
import slabMandalorian from "./assets/comics/slab-mandalorian-4.jpg";
import slabVenom2021 from "./assets/comics/slab-venom-31-2021.jpg";
import slabVenom2024 from "./assets/comics/slab-venom-31-2024.jpg";
import slabWolverine154 from "./assets/comics/slab-wolverine-154.jpg";
import slabWolverine21 from "./assets/comics/slab-wolverine-21.jpg";

function fmtUSD(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export type Comic = {
  id: string;
  /** Display title, e.g. "Batman #136". */
  title: string;
  /** Title exactly as printed on the CGC label — the label drops
      the year disambiguators the catalog titles carry ("Venom #31",
      not "Venom #31 (2021)"). Transcribed from his label photos. */
  labelTitle: string;
  publisher: string;
  /** Publisher name exactly as printed on the label — Batman's
      label reads "D.C. Comics", not "DC Comics". */
  labelPublisher: string;
  /** Publisher date as printed on the CGC label, e.g. "8/23". */
  date: string;
  /** Credit lines exactly as printed at the bottom-left of the
      label, in order, with full names ("Donny Cates story",
      "Iban Coello art", "Gabriele Dell'Otto cover") — his label
      photos, not the abbreviated log credits below. */
  labelCredits: string[];
  /** The centered signed line on Signature Series labels, e.g.
      "SIGNED & SKETCH BY TYLER KIRKHAM ON 7/19/23". */
  labelSigned?: string;
  /** The centered bold edition line above the cert number, e.g.
      "Whatnot Foil Edition". Absent when the real label has none. */
  labelEdition?: string;
  /** Right-aligned note lines printed beside the cert number,
      e.g. ["Venom #196", "Unknown Comics, Street Level Hero &",
      "Comic Traders exclusive."]. Absent when the label has none. */
  labelNote?: string[];
  /** Italic line at the left of Aliens #1's label, above its
      credits: "Celebrity Authentics Edition". Only that label
      carries one. */
  labelLeftNote?: string;
  /** "Signature Series" | "Universal" — the CGC label type. */
  label: "Signature Series" | "Universal";
  /** Variant / edition notes from the label. */
  variant: string;
  /** Story / art / cover credits from the label. */
  credits: string;
  /** CGC certification number. */
  cert: string;
  /** Estimated market value, USD — Oct 29, 2026 check. */
  value: number;
  /** Value range from the log, when one was recorded. */
  valueRange?: string;
  /** How the value was arrived at (from the collection log). */
  valueBasis: string;
  /** Confidence note from the log, e.g. "HIGH", "LOW–MEDIUM". */
  confidence: string;
  cover: string;
  slab: string;
};

export const COMICS: Comic[] = [
  {
    id: "aliens-1",
    title: "Aliens #1",
    labelTitle: "Aliens #1",
    publisher: "Dark Horse Comics",
    labelPublisher: "Dark Horse Comics",
    date: "5/09",
    labelCredits: [
      "John Arcudi story",
      "Zach Howard & Mark Irwin art",
      "Zach Howard cover",
    ],
    labelSigned: "SIGNED BY SIGOURNEY WEAVER ON 3/23/10 - C12447",
    labelLeftNote: "Celebrity Authentics Edition",
    labelNote: ['"Daylight version."'],
    label: "Signature Series",
    variant:
      'Celebrity Authentics Edition, "Daylight version." Signed by Sigourney Weaver, 3/23/10 (C12447).',
    credits: "Arcudi story; Howard & Irwin art; Howard cover.",
    cert: "0969448092",
    value: 1250,
    valueRange: "$1,000–$1,500",
    valueBasis:
      "No verified recent sold comp; live ask $2,046, GoCollect ceiling ~$1,500. Limited Celebrity Authentics release (Daylight version).",
    confidence: "LOW–MEDIUM",
    cover: coverAliens,
    slab: slabAliens,
  },
  {
    id: "batman-136",
    title: "Batman #136",
    labelTitle: "Batman #136",
    publisher: "DC Comics",
    labelPublisher: "D.C. Comics",
    date: "8/23",
    labelCredits: [
      "Chip Zdarsky story",
      "Belén Ortega & Jorge Corona art",
      "Tyler Kirkham cover",
    ],
    labelSigned: "SIGNED & SKETCH BY TYLER KIRKHAM ON 7/19/23",
    labelEdition: "Whatnot Foil Edition",
    labelNote: ["Batman #901", '"Virgin" cover.'],
    label: "Signature Series",
    variant:
      'Whatnot Foil Edition, "Virgin" cover (Batman #901 legacy). Signed & sketch by Tyler Kirkham, 7/19/23.',
    credits: "Zdarsky story; Ortega & Corona art; Kirkham cover.",
    cert: "2765929003",
    value: 400,
    valueRange: "$300–$500",
    valueBasis:
      "No sold comp for the exact signed+sketch book; signed-only copies are offered at $250–$470, sketch adds a premium. Unsigned 9.8 retailed ~$100.",
    confidence: "LOW",
    cover: coverBatman,
    slab: slabBatman,
  },
  {
    id: "wolverine-154",
    title: "Wolverine #154",
    labelTitle: "Wolverine #154",
    publisher: "Marvel Comics",
    labelPublisher: "Marvel Comics",
    date: "9/00",
    labelCredits: [
      "Rob Liefeld & Eric Stephenson story",
      "Rob Liefeld & Norm Rapmund cover & art",
    ],
    labelNote: ["Deadpool appearance."],
    label: "Universal",
    variant: "Deadpool appearance.",
    credits: "Liefeld & Stephenson story; Liefeld & Rapmund cover & art.",
    cert: "3996202002",
    value: 95,
    valueBasis:
      "7 eBay sales $67–$121; 2026 sales $80–$121. Assumes Direct Edition (Newsstand would be $350–$500).",
    confidence: "HIGH",
    cover: coverWolverine154,
    slab: slabWolverine154,
  },
  {
    id: "mandalorian-4",
    title: "Star Wars: The Mandalorian #4",
    labelTitle: "Star Wars: The Mandalorian #4",
    publisher: "Marvel Comics",
    labelPublisher: "Marvel Comics",
    date: "12/22",
    labelCredits: [
      "Rodney Barnes story",
      "Georges Jeanty & Karl Story art",
      "Patrick Zircher cover",
    ],
    labelEdition: 'Zircher "Virgin" Edition',
    label: "Universal",
    variant: 'Zircher "Virgin" Edition.',
    credits: "Barnes story; Jeanty & Story art; Zircher cover.",
    cert: "4299854012",
    value: 65,
    valueBasis: "Dec 2025 sales $56 and $80.",
    confidence: "GOOD",
    cover: coverMandalorian,
    slab: slabMandalorian,
  },
  {
    id: "venom-31-2021",
    title: "Venom #31 (2021)",
    labelTitle: "Venom #31",
    publisher: "Marvel Comics",
    labelPublisher: "Marvel Comics",
    date: "2/21",
    labelCredits: [
      "Donny Cates story",
      "Iban Coello art",
      "Gabriele Dell'Otto cover",
    ],
    labelEdition: "Dell'Otto Variant Cover A",
    labelNote: [
      "Venom #196",
      "Unknown Comics, Street Level Hero &",
      "Comic Traders exclusive.",
    ],
    label: "Universal",
    variant:
      "Dell'Otto Variant Cover A (Venom #196 legacy) — Unknown Comics / Street Level Hero / Comic Traders exclusive.",
    credits: "Cates story; Coello art; Dell'Otto cover.",
    cert: "4508151021",
    value: 50,
    valueBasis: "Exact CGC sale $60 (Dec 2023); CBCS comp $38.",
    confidence: "THIN / DATED",
    cover: coverVenom2021,
    slab: slabVenom2021,
  },
  {
    id: "wolverine-21",
    title: "Wolverine #21",
    labelTitle: "Wolverine #21",
    publisher: "Marvel Comics",
    labelPublisher: "Marvel Comics",
    date: "7/22",
    labelCredits: [
      "Benjamin Percy story",
      "Adam Kubert art",
      "Felipe Massafera cover",
    ],
    labelEdition: 'Massafera "Virgin" Edition',
    labelNote: [
      "Wolverine #363",
      "Unknown Comics, Street Level Hero",
      "& Comic Traders exclusive.",
    ],
    label: "Universal",
    variant:
      'Massafera "Virgin" Edition (Wolverine #363 legacy) — Unknown Comics / Street Level Hero / Comic Traders exclusive.',
    credits: "Percy story; Kubert art; Massafera cover.",
    cert: "4647611024",
    value: 45,
    valueBasis:
      "5 sales $38–$62, latest Jun 2026 at $38 — market cooling; asks ~$99 are above real sales.",
    confidence: "MEDIUM",
    cover: coverWolverine21,
    slab: slabWolverine21,
  },
  {
    id: "venom-31-2024",
    title: "Venom #31 (2024)",
    labelTitle: "Venom #31",
    publisher: "Marvel Comics",
    labelPublisher: "Marvel Comics",
    date: "5/24",
    labelCredits: [
      "Torunn Grønbekk story",
      "Ken Lashley art",
      "Greg & Tim Hildebrandt cover",
    ],
    labelEdition: "Hildebrandt Variant Cover",
    labelNote: ["Venom #231", '"Marvel Masterpieces III" variant cover.'],
    label: "Universal",
    variant:
      'Hildebrandt Variant Cover — "Marvel Masterpieces III" variant (Venom #231 legacy).',
    credits: "Grønbekk story; Lashley art; Greg & Tim Hildebrandt cover.",
    cert: "4468576022",
    value: 35,
    valueBasis: "9 sales in 2024, $27–$43; none tracked since Aug 2024. Ignore $130–$169 asks.",
    confidence: "DATED",
    cover: coverVenom2024,
    slab: slabVenom2024,
  },
  {
    id: "deadpool-wolverine-3",
    title: "Deadpool & Wolverine: WWIII #3",
    labelTitle: "Deadpool & Wolverine: WWIII #3",
    publisher: "Marvel Comics",
    labelPublisher: "Marvel Comics",
    date: "9/24",
    labelCredits: ["Joe Kelly story", "Adam Kubert cover & art"],
    label: "Universal",
    variant: "",
    credits: "Kelly story; Adam Kubert cover & art.",
    cert: "4654697025",
    value: 30,
    valueBasis: "One clean Cover A comp at $26 (Oct 2026).",
    confidence: "LOW",
    cover: coverDeadpoolWolverine,
    slab: slabDeadpoolWolverine,
  },
];

export const COMICS_TOTAL_VALUE = COMICS.reduce((s, c) => s + c.value, 0);
export const COMICS_VALUE_CHECKED = "Oct 29, 2026";

type ComicGroup = {
  key: string;
  name: string;
  section: string;
  comics: Comic[];
};

function buildGroups(): ComicGroup[] {
  const byPublisher = new Map<string, Comic[]>();
  const byLabel = new Map<string, Comic[]>();
  for (const c of COMICS) {
    byPublisher.set(c.publisher, [...(byPublisher.get(c.publisher) ?? []), c]);
    byLabel.set(c.label, [...(byLabel.get(c.label) ?? []), c]);
  }
  const groups: ComicGroup[] = [
    {
      key: "all",
      name: "All Comics",
      section: "By publisher",
      comics: COMICS,
    },
  ];
  // Publisher order: most books first (Marvel, then DC, then Dark Horse).
  for (const [name, list] of [...byPublisher.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    groups.push({
      key: `publisher:${name}`,
      name,
      section: "By publisher",
      comics: list,
    });
  }
  for (const [name, list] of byLabel.entries()) {
    groups.push({
      key: `label:${name}`,
      name: `CGC ${name}`,
      section: "By label",
      comics: list,
    });
  }
  return groups;
}

const COMIC_GROUPS = buildGroups();

function groupValue(group: ComicGroup): number {
  return group.comics.reduce((s, c) => s + c.value, 0);
}

/** Grade badge in the CGC label colors: gold for Signature Series,
    purple-blue for Universal. Every slab is a 9.8. */
function GradeBadge({ comic, className = "" }: { comic: Comic; className?: string }) {
  const signature = comic.label === "Signature Series";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow ${
        signature ? "bg-[#f2b705] text-black" : "bg-[#5b4bc4] text-white"
      } ${className}`}
      aria-label={`CGC ${comic.label} 9.8, white pages`}
    >
      CGC 9.8
    </span>
  );
}

/** One group in a browse list — the CLZ Comics folder pattern
    (Nov 2, 2026 layout cleanup): a full-width row with the group's
    most valuable cover as its thumbnail, the group name, its slab
    count and total value, and a chevron. Label groups carry the
    CGC label color dot (gold Signature Series, purple-blue
    Universal). Rows replaced the old 3-across group tiles, whose
    tiny cover strips and always-full progress bars were noise. */
function ComicFolderRow({
  group,
  onPick,
}: {
  group: ComicGroup;
  onPick: (key: string) => void;
}) {
  const rep = [...group.comics].sort((a, b) => b.value - a.value)[0];
  const labelName = group.key.startsWith("label:")
    ? group.key.slice("label:".length)
    : null;
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(group.key)}
        aria-label={`${group.name}: ${group.comics.length} graded comics, total value ${fmtUSD(groupValue(group), 0)}. View them.`}
        className="flex w-full items-center gap-3 py-2.5 text-left focus:outline-none"
      >
        {rep ? (
          <img
            src={rep.cover}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="aspect-[2/3] w-10 shrink-0 rounded object-cover"
          />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
            {labelName ? (
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  labelName === "Signature Series"
                    ? "bg-[#f2b705]"
                    : "bg-[#5b4bc4]"
                }`}
              />
            ) : null}
            <span className="truncate">{group.name}</span>
          </span>
          <span className="mt-0.5 block text-xs text-[var(--dim)]">
            {group.comics.length} slab{group.comics.length === 1 ? "" : "s"}{" "}
            · all CGC 9.8 ·{" "}
            <span className="font-medium text-[var(--gold-soft)]">
              {fmtUSD(groupValue(group), 0)} total
            </span>
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-[var(--dim)]">
          ›
        </span>
      </button>
    </li>
  );
}

/** Browse-by-group lists for comics — CLZ-style folders: one list
    by publisher, one by CGC label, each a headed divided list of
    folder rows. Tapping a row opens that group's shelf (the same
    group view the old tiles opened). */
function ComicFolderLists({
  onPick,
}: {
  onPick: (key: string) => void;
}) {
  const sections = [...new Set(COMIC_GROUPS.map((g) => g.section))].map(
    (title) => ({
      title,
      items: COMIC_GROUPS.filter((g) => g.section === title),
    }),
  );
  return (
    <div className="mt-7 space-y-6">
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dim)]">
            Browse {section.title.replace(/^By /, "by ")}
          </h3>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
            {section.items.map((g) => (
              <ComicFolderRow key={g.key} group={g} onPick={onPick} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The barcode under a CGC cert number, drawn as black bars whose
    widths and gaps derive deterministically from the cert digits
    themselves — so each book's barcode pattern is its own, the way
    the real printed barcodes differ per cert. Pure decoration
    evoking the printed barcode; the number above it is the real
    cert. */
function CertBarcode({ cert }: { cert: string }) {
  const bars: { w: number; gap: number }[] = [];
  const digits = cert.split("").map((ch) => Number(ch));
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i] ?? 0;
    const next = digits[i + 1] ?? ((d * 3 + 1) % 10);
    bars.push({ w: 1 + (d % 3), gap: 1 + (next % 2) });
    bars.push({ w: 1 + ((d + next) % 2), gap: 1 + ((d + 1) % 3 === 0 ? 1 : 0) });
  }
  return (
    <span
      aria-hidden="true"
      className="mx-auto flex h-[5px] w-[44px] items-stretch justify-center overflow-hidden"
    >
      {bars.map((b, i) => (
        <span
          key={i}
          className="bg-black"
          style={{ width: `${b.w}px`, marginRight: i === bars.length - 1 ? 0 : `${b.gap}px` }}
        />
      ))}
    </span>
  );
}

/** The holographic CGC sticker at the right end of a real label:
    an iridescent rounded square with CGC across it (blue with the
    scales mark on Aliens #1's older label, rainbow foil on the
    modern Universal labels, silver foil on Batman's Signature
    label), plus — only on Aliens — the small gold Celebrity
    Authentics sticker printed with its C12447 number. Drawn in
    CSS; no CGC artwork is copied. */
function CgcHologram({ comic }: { comic: Comic }) {
  const isAliens = comic.id === "aliens-1";
  const isSignature = comic.label === "Signature Series";
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-1 self-center">
      {isAliens ? (
        <span
          className="flex h-[14px] w-[20px] flex-col items-center justify-center rounded-[3px] bg-gradient-to-br from-[#f6dc7d] via-[#dfae35] to-[#c1912a] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-black/25"
        >
          <span className="text-[2.8px] font-bold italic leading-none text-[#6b4e08]">
            Celebrity
          </span>
          <span className="text-[2.8px] font-bold italic leading-none text-[#6b4e08]">
            Authentics
          </span>
          <span className="mt-px text-[3.2px] font-semibold leading-none tracking-wide text-black/80">
            C12447
          </span>
        </span>
      ) : null}
      <span
        className={`flex h-[21px] w-[17px] flex-col items-center justify-between overflow-hidden rounded-[4px] py-px shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_2px_rgba(0,0,0,0.25)] ring-1 ring-black/30 ${
          isAliens
            ? "bg-gradient-to-br from-[#8fb4ec] via-[#5b84cc] to-[#3c63a8] text-white"
            : isSignature
              ? "bg-[linear-gradient(135deg,#e8ecf2_0%,#b9c1cf_30%,#eef1f6_52%,#a5aebd_74%,#dde3ec_100%)] text-[#39445a]"
              : "bg-[linear-gradient(135deg,#ffd76e_0%,#ff9d5c_22%,#ff7eb0_42%,#b48cff_62%,#6ee7a0_82%,#7cc7ff_100%)] text-white"
        }`}
      >
        {isAliens ? (
          <svg
            viewBox="0 0 24 24"
            className="h-[6px] w-[6px] fill-current opacity-90"
          >
            <path d="M11 3h2v2.2l5.6 1.9-2.9 6.1a3.9 3.9 0 0 1-7.2 0l-.9-1.9H5.7l-.9 1.9a3.9 3.9 0 0 1-7.2 0L.7 7.1 6.3 5.2V4H4V2h7v1zm-4.8 4.4L4 12h4.4L6.2 7.4zm11.6 0L15.6 12H20l-2.2-4.6zM11 13h2v6h4v2H7v-2h4v-6z" transform="scale(0.92) translate(1 -1)" />
          </svg>
        ) : (
          <span className="h-[5px]" />
        )}
        <span
          className={`text-[6px] font-black leading-none tracking-tight ${
            isAliens || !isSignature
              ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
              : ""
          }`}
        >
          CGC
        </span>
        <span
          className={`block h-[3px] w-full ${
            isAliens ? "bg-black/25" : isSignature ? "bg-black/20" : "bg-black/30"
          }`}
        />
      </span>
    </span>
  );
}

/** The front of a graded slab, mocked up in the app (Anthony's
    option B, Nov 2, 2026): no official CGC photo of his exact slabs
    is published anywhere, so the detail hero renders the book AS
    its slab — the real cover art sealed inside a clear slab case,
    topped by the CGC label rendered from his real label data.
    Nothing is invented — every line on the label is transcribed
    from his own label photos (the labelTitle / labelPublisher /
    labelCredits / labelSigned / labelEdition / labelNote fields).

    Rebuilt Nov 2, 2026 (v1.13.0) at Anthony's direction — "rebuild
    the slab label to match your actual labels, as best as
    possible" — because the first mock-up read as generic stacked
    text with the grade on the right. The label follows the
    anatomy of his real CGC labels: a top banner naming the grade
    type (CGC UNIVERSAL GRADE in white on the dark blue band;
    CGC Signature SERIES in script on the gold band); the grade
    9.8 alone in a solid square white box on the LEFT (Anthony,
    Nov 3, 2026: the box is an equal square, and "WHITE Pages"
    does not sit under the grade on Universal labels — Aliens
    #1's older label and the Signature Series books print it on
    the centered line instead); the title and
    publisher/date centered and bold, with the signed / edition
    lines sharing the title block's second line; the credits run
    as one wrapping small-print line at the bottom-left; the
    cert number centered over a drawn barcode; the label's
    right-side note beside it; the holographic CGC sticker at
    the right end (plus Aliens' gold Celebrity Authentics
    sticker); and the faint CGC watermark washed behind the
    middle, as printed.

    Slimmed again Nov 3, 2026 (~2:08 PM) at Anthony's direction:
    the band is now a true slim strip — roughly a tenth of the
    slab's height, inside the 15%-or-less a real holder runs —
    for EVERY slab, and the case around it carries the full
    clear-acrylic treatment the Sealed cases use: beveled rim
    rings, a molded ridge and sonic-weld seam under the label,
    the cover recessed behind the front face with its own
    shading and sheen, and light streaks down the thick case
    walls. The molded ridge and seam separate the label
    compartment from the comic compartment, and the cover sits
    inset inside the case like a real holder. The flip view
    pairs this slab front with his real label close-up photo. */
export function SlabFront({
  comic,
  uniformLabel = false,
}: {
  comic: Comic;
  /** Library display wall (Anthony, Nov 4, 2026): every slab on
      the wall renders with IDENTICAL geometry — the label band
      is locked to one slim fixed height (extra small print
      clips; readability there does not matter) and the cover
      inset is locked to one fixed aspect ratio — so slabs with
      different labels and different cover-photo aspects line
      up evenly, like real slabs on a shelf. The detail view
      keeps the natural variable layout. */
  uniformLabel?: boolean;
}) {
  const isSignature = comic.label === "Signature Series";
  const isAliens = comic.id === "aliens-1";
  // Anthony, Nov 3, 2026, ~2:08 PM: the label band STILL reads
  // too tall — on a real CGC slab the label is a SLIM band at
  // the top of the case, roughly 15% or less of the total
  // height, with compact small print. The condensed layout is
  // now the ONE layout for every slab (it used to apply only
  // to the two Signature Series books): a hairline banner, the
  // title block compressed to two tight lines (publisher/date
  // shares a line with the signed / edition / WHITE Pages
  // line), and ALL of the small print — credits, cert over its
  // barcode, the label's note — run together in a single
  // shallow strip under the title instead of stacking in
  // their own rows. Every word of label information is still
  // there (grade 9.8, signed line, cert, credits,
  // notes); it is simply set at true small-print size, and all
  // of it is repeated in the text below the slab anyway, so
  // realistic proportion wins over readability.
  // Mandalorian #4 keeps its one approved tweak (Nov 3, 2026,
  // 1:33 PM): its grade sits a touch lower than the rest.
  const isMandalorian = comic.id === "mandalorian-4";
  const longTitle = comic.labelTitle.length > 24;
  // The label's second centered line: the signed line when the
  // book is signed, plus the edition line and the WHITE Pages
  // line on the labels that print it there — Aliens #1's older
  // label, and the Signature Series books (whose grade box
  // carries no page line). Universal labels carry no WHITE
  // Pages line anywhere on the band (Anthony, Nov 3, 2026:
  // it does not belong under the grade there).
  const labelSubLine = [
    comic.labelSigned,
    comic.labelEdition,
    isAliens || isSignature ? "WHITE Pages" : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <div
      className="relative rounded-[16px] bg-[linear-gradient(135deg,rgba(255,255,255,0.55)_0%,rgba(210,226,248,0.14)_28%,rgba(160,185,220,0.10)_55%,rgba(255,255,255,0.30)_82%,rgba(190,210,238,0.38)_100%)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.75),inset_0_-3px_8px_rgba(255,255,255,0.20),inset_3px_0_6px_rgba(255,255,255,0.24),inset_-3px_0_6px_rgba(0,0,0,0.20),inset_0_0_0_2px_rgba(238,246,255,0.50),inset_0_0_0_4px_rgba(12,18,32,0.28),inset_0_0_0_6px_rgba(205,226,255,0.16)] ring-1 ring-white/60"
      aria-label={`${comic.title} shown as its CGC slab — a mock-up built from the real cover art and the real label details`}
      role="img"
    >
      <div className="relative overflow-hidden rounded-[8px] bg-[#0c0d12] shadow-[inset_0_2px_12px_rgba(0,0,0,0.85),inset_0_0_0_1px_rgba(255,255,255,0.28)] ring-1 ring-black/50">
        {/* The CGC label, rebuilt to the real labels' layout (see
            the note above): pale blue body for Universal, pale
            gold-cream for Signature Series, black print throughout,
            in a slim compartment of its own — a thin band across
            the top of the case, about a tenth of the slab's
            height, the way a real holder's label sits. */}
        <div
          className={`relative overflow-hidden text-black ${
            uniformLabel ? "h-[54px] shrink-0" : ""
          } ${
            isSignature
              ? "bg-gradient-to-b from-[#fbf3cd] via-[#f7e7a1] to-[#f1d67c]"
              : "bg-gradient-to-b from-[#c3d6f2] via-[#aec8ec] to-[#9dbde6]"
          }`}
        >
          {/* Top banner: the grade type, exactly where CGC prints
              it — white spaced caps on the dark blue band for
              Universal; CGC + script "Signature" + SERIES on the
              gold band for Signature Series. A hairline band now:
              no vertical padding to speak of. */}
          <div
            className={`flex items-center justify-center px-2 py-px ${
              isSignature
                ? "bg-gradient-to-b from-[#eed887] via-[#e3c95c] to-[#d4af37] text-[#221a04]"
                : "bg-gradient-to-b from-[#3d6dc0] to-[#2c56a3] text-white"
            }`}
          >
            {isSignature ? (
              <p className="flex items-baseline gap-1 leading-none">
                <span className="text-[6px] font-black tracking-[0.08em]">
                  CGC
                </span>
                <span className="font-serif text-[7.5px] font-bold italic leading-none">
                  Signature
                </span>
                <span className="text-[6px] font-black tracking-[0.22em]">
                  SERIES
                </span>
              </p>
            ) : (
              <p className="text-[6px] font-bold leading-none tracking-[0.3em]">
                CGC&nbsp;UNIVERSAL&nbsp;GRADE
              </p>
            )}
          </div>
          {/* Watermark: the faint oversized CGC washed behind the
              label's middle, as printed on the real labels. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[9px] select-none text-center text-[24px] font-black tracking-tight text-white/25"
          >
            CGC
          </span>
          {/* Plastic sheen over the label paper: the label sits
              UNDER the case's clear front, so a faint diagonal
              light wash crosses it just like the cover below. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/25 via-white/5 to-transparent"
          />
          <div className="relative px-1 pb-[3px] pt-[2px]">
            {/* Label body (Anthony, Nov 4, 2026, evening —
                supersedes the same day's "grade in the middle"
                placement): the GRADE sits at the LEFT end of
                the label band, where it sits on a real CGC
                label — a three-column grid (grade box | title
                block | hologram). The title block's text stays
                centered in its column. The grade box itself is
                unchanged: a solid EQUAL SQUARE around the
                9.8 alone (Anthony, Nov 3, 2026, ~4:05–4:06 PM:
                on his real CGC labels the white grade box is a
                square, on every slab), no "WHITE Pages" line
                under the grade on the non-signature (Universal)
                labels — those words do not belong there;
                Signature Series books and Aliens #1's older
                label print WHITE Pages on the centered line
                instead (see labelSubLine). Mandalorian #4's box
                keeps its one approved tweak: nudged a pixel
                DOWN via a transform. Beneath the grid —
                spanning the full width, the way the real labels
                run their small print edge to edge — ONE shallow
                small-print strip: credits at the left, the cert
                number centered over its barcode, and the
                label's note at the right, each allowed to wrap
                inside its own third so nothing is cut off. */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
              <div
                className={`flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[4px] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)] ${
                  isSignature
                    ? "border-b-2 border-[#d4af37]"
                    : "border-b-2 border-[#2c56a3]"
                }`}
                style={
                  isMandalorian
                    ? { transform: "translateY(1px)" }
                    : undefined
                }
              >
                <span className="text-[14px] font-black leading-none tracking-tight">
                  9.8
                </span>
              </div>
              <div className="min-w-0">
                  <p
                    className={`text-center font-extrabold leading-[1.05] ${
                      longTitle ? "text-[7.5px]" : "text-[8.5px]"
                    }`}
                  >
                    {comic.labelTitle}
                  </p>
                  <p className="mt-px text-center text-[5px] font-bold leading-[1.1]">
                    {comic.labelPublisher}, {comic.date}
                  </p>
                  {labelSubLine ? (
                    <p className="mt-px text-center text-[4.3px] font-semibold leading-[1.1]">
                      {labelSubLine}
                    </p>
                  ) : null}
              </div>
              <div className="flex items-center justify-end">
                <CgcHologram comic={comic} />
              </div>
            </div>
            <div className="flex items-end justify-between gap-1 pt-px">
                <div className="min-w-0 flex-1">
                  <p className="text-[4px] leading-[1.2]">
                    {comic.labelLeftNote ? (
                      <span className="font-bold italic">
                        {comic.labelLeftNote}.{" "}
                      </span>
                    ) : null}
                    {comic.labelCredits.join("  ·  ")}
                  </p>
                </div>
                <div className="shrink-0 px-0.5 text-center">
                  <p className="text-[6px] font-medium leading-none tracking-[0.06em]">
                    {comic.cert}
                  </p>
                  <div className="mt-px">
                    <CertBarcode cert={comic.cert} />
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-right">
                  {comic.labelNote ? (
                    <p className="text-[4px] leading-[1.2]">
                      {comic.labelNote.map((line, i) => (
                        <span
                          key={line}
                          className={
                            i === 0 && comic.labelNote!.length > 1
                              ? "font-bold"
                              : ""
                          }
                        >
                          {i > 0 ? " " : ""}
                          {line}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              </div>
          </div>
        </div>
        {/* The molded ridge under the label compartment, then the
            cover inset inside the case — a real holder's seam and
            clear border around the book. Every slab gets the
            full treatment now (Anthony, Nov 3, 2026, ~2:08 PM:
            the case must read as clear rigid acrylic like the
            Sealed cases — beveled edges, seams, realistic light
            and reflection — not a flat frame): a bright molded
            ridge, the dark sonic-weld seam line under it, and
            the book recessed behind the case front with its own
            inner shadow and a sheen that stops at the recess,
            so the cover reads as UNDER plastic. */}
        <div
          aria-hidden="true"
          className="h-[6px] bg-gradient-to-b from-white/55 via-white/12 to-black/60 shadow-[0_1px_2px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.5)]"
        />
        <div
          aria-hidden="true"
          className="h-[2px] bg-black/70 shadow-[0_1px_0_rgba(255,255,255,0.28)]"
        />
        <div className="p-1.5 pt-1">
          <div
            className={`relative overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_2px_10px_rgba(0,0,0,0.5)] ${
              uniformLabel ? "aspect-[0.66]" : ""
            }`}
          >
            <img
              src={comic.cover}
              alt=""
              className={`block w-full select-none ${
                uniformLabel ? "h-full object-cover" : ""
              }`}
              draggable={false}
            />
            {/* The recess shading + a soft diagonal reflection
                confined to the cover compartment, so the book
                sits visibly behind the case's front face. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 shadow-[inset_0_0_16px_rgba(0,0,0,0.38),inset_0_2px_6px_rgba(0,0,0,0.45)]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/14 via-transparent to-transparent"
            />
          </div>
        </div>
        {/* Inner case-wall shading: light pooled along the left
            and right walls of the comic compartment and a darker
            well at its base — the depth cue of a thick clear
            holder around the book. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 shadow-[inset_3px_0_7px_rgba(255,255,255,0.14),inset_-3px_0_7px_rgba(0,0,0,0.22),inset_0_-10px_18px_rgba(0,0,0,0.30)]"
        />
      </div>
      {/* Glassy slab reflections over the case, for EVERY slab:
          the broad diagonal sheen, a sharper secondary streak,
          and the acrylic-style vertical light streaks down the
          thick case walls plus the light catch along the base —
          the same language as the Sealed acrylic cases. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[16px] bg-gradient-to-br from-white/25 via-transparent to-transparent"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[16px] bg-[linear-gradient(112deg,transparent_38%,rgba(255,255,255,0.13)_47%,rgba(255,255,255,0.03)_53%,transparent_62%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-2 left-[3px] w-[3px] rounded-full bg-gradient-to-b from-white/60 via-white/20 to-white/35 blur-[0.5px]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-2 right-[3px] w-[3px] rounded-full bg-gradient-to-b from-white/45 via-white/12 to-white/28 blur-[0.5px]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 bottom-[3px] h-[3px] rounded-full bg-gradient-to-r from-white/10 via-white/30 to-white/10 blur-[0.5px]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-[3px] h-[2px] rounded-full bg-gradient-to-r from-white/15 via-white/45 to-white/15 blur-[0.5px]"
      />
      <span aria-hidden="true" className="card-glare" />
    </div>
  );
}

/** The slab in its turn view, with REAL THICKNESS (Anthony,
    Nov 3, 2026, 1:34 PM): turning a comic side to side must
    SHOW the slab's thick rigid edge, not a flat card flipping.
    This wraps SlabFront in a CSS 3D box (the .slab-3d classes
    in theme.css): the front face sits half the depth forward,
    a plain case back sits half the depth behind it, and four
    clear molded edges — left, right, top, bottom, 18px deep
    with ridged plastic shading — join them, so as the
    Turntable sways or is dragged the side profile reads as a
    thick holder turning in space. Used only in the detail
    turn view; the Library flip-binder pages keep the flat
    SlabFront so their page-flip animation is unchanged. */
export function SlabTurnSlab({ comic }: { comic: Comic }) {
  return (
    <div className="slab-3d">
      <div className="slab-3d-face slab-3d-front">
        <SlabFront comic={comic} />
      </div>
      <div className="slab-3d-face slab-3d-back" aria-hidden="true">
        <span className="slab-3d-back-label">CGC</span>
      </div>
      <div className="slab-3d-edge slab-3d-edge-right" aria-hidden="true" />
      <div className="slab-3d-edge slab-3d-edge-left" aria-hidden="true" />
      <div className="slab-3d-edge slab-3d-edge-top" aria-hidden="true" />
      <div className="slab-3d-edge slab-3d-edge-bottom" aria-hidden="true" />
    </div>
  );
}

/** Full-screen comic detail — the CardSheet pattern: blurred cover
    backdrop, back/close controls, the book large and centered AS
    its graded slab (SlabFront mocked up from the real cover art
    and label data), with a Slab / Label photo toggle — the two
    sides of his graded comics binder — a title/price block, and
    Comic / Performance tabs. The Performance tab shows the value,
    its basis, and its confidence from the Oct 29, 2026 check —
    there is no paid amount or price history recorded for the
    slabs, so none is shown. */
/** A comic's full slab detail page. Exported so the
    Library's comics flip-binder can open a slab into this
    same detail view (Anthony, Nov 3, 2026, ~12:08 PM). */
export function ComicSheet({
  comic,
  onClose,
}: {
  comic: Comic;
  onClose: () => void;
}) {
  const jarvisVision = useJarvisVision();
  const [photo, setPhoto] = useState<"slabfront" | "label">("slabfront");
  // A refresh with the Price alerts page open over this comic
  // reopens on the Performance tab — the alerts box lives there,
  // and the box reopens the alerts page from the same surviving
  // history entry, so the refresh stays in place.
  const [sheetTab, setSheetTab] = useState<"comic" | "performance">(() => {
    try {
      return (
          (window.history.state as { lorcanaPriceAlerts?: unknown } | null)
            ?.lorcanaPriceAlerts === true
        )
        ? "performance"
        : "comic";
    } catch {
      return "comic";
    }
  });
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${comic.title}`}
      onClick={onClose}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <img
          src={comic.cover}
          alt=""
          className="h-full w-full scale-125 object-cover opacity-45 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-[#05070d]/40 to-[#05070d]" />
      </div>
      <div
        className="relative mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to SLABS"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-xl leading-none text-white shadow-lg backdrop-blur"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comic details"
            className="shrink-0 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            Close
          </button>
        </div>

        {/* Standing rule (Anthony, Nov 2, 2026): every item with a
            photo floats and turns on its detail view — graded comics
            included, on both the slab front and the label photo. */}
        <Turntable
          label={`${comic.title}, shown hovering and slowly turning. Drag sideways or use the left and right arrow keys to turn it.`}
          floatClassName={
            photo === "slabfront"
              ? "w-72 max-w-full sm:w-80"
              : "w-full max-w-md"
          }
        >
          {photo === "slabfront" ? (
            <SlabTurnSlab comic={comic} />
          ) : (
            <div className="relative overflow-hidden rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/15">
              <img
                src={comic.slab}
                alt={`${comic.title} CGC slab label photo`}
                className="block w-full select-none"
                draggable={false}
              />
              <span aria-hidden="true" className="card-glare" />
            </div>
          )}
        </Turntable>

        {/* The two sides of the slab, like flipping it over in the
            graded comics binder: the slab front (mocked up from the
            real cover and label details) and Anthony's real photo
            of the slab's label. */}
        <div
          className="mx-auto mt-3 flex w-72 max-w-full rounded-full border border-[var(--border)] bg-[var(--bg)] p-1"
          role="group"
          aria-label="Comic photo"
        >
          {(
            [
              ["slabfront", "Slab"],
              ["label", "Label photo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={photo === value}
              onClick={() => setPhoto(value)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm ${
                photo === value
                  ? "bg-[var(--gold)] font-bold text-black"
                  : "text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Title block: title and the checked value, publisher in
            blue + label/grade under — the card sheet's pattern. */}
        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-album text-[22px] font-bold leading-tight text-white">
              {comic.title}
            </h2>
            <p className="mt-1 text-[15px]">
              <span className="font-medium text-[var(--accent)]">
                {comic.publisher}
              </span>
              <span className="text-white">
                {" "}
                • CGC {comic.label} 9.8
              </span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-bold leading-tight text-white">
              ~{fmtUSD(comic.value, 0)}
            </p>
            <p className="mt-0.5 text-[11px] font-normal text-[var(--dim)]">
              checked {COMICS_VALUE_CHECKED}
            </p>
          </div>
        </div>

        <div
          className="mt-4 flex rounded-full border border-[var(--border)] bg-[var(--bg)] p-1"
          role="group"
          aria-label="Comic detail view"
        >
          {(
            [
              ["comic", "Comic"],
              ["performance", "Performance"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sheetTab === value}
              onClick={() => setSheetTab(value)}
              className={`flex-1 rounded-full px-3.5 py-1.5 text-sm ${
                sheetTab === value
                  ? "bg-[var(--gold)] font-bold text-black"
                  : "text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sheetTab === "comic" ? (
          <>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Grade / Pages
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">9.8 · WHITE</dd>
              </div>
              <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  Publisher / Date
                </dt>
                <dd className="mt-0.5 text-[var(--text)]">
                  {comic.publisher.replace(" Comics", "")} · {comic.date}
                </dd>
              </div>
              <div className="rounded-lg bg-[var(--bg)] px-2 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  CGC Cert #
                </dt>
                <dd className="mt-0.5 tabular-nums text-[var(--text)]">
                  {comic.cert}
                </dd>
              </div>
            </dl>

            {comic.variant ? (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-[var(--bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)]">
                {comic.variant}
              </p>
            ) : null}
            <p className="mt-3 rounded-lg bg-[var(--bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)]">
              {comic.credits}
            </p>

            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-album text-base text-[var(--text)]">
                  In your collection
                </h3>
                <span className="text-sm font-semibold text-[var(--gold-soft)]">
                  1 slab
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--dim)]">
                Graded and slabbed by CGC — logged from your label photos
                on Oct 29, 2026.
              </p>
              {/* Merged bar (Anthony's placement change, Nov 2,
                  2026): split in half — Where it lives (dropdown)
                  on the left, Copies owned on the right. A slab is
                  a single copy, so the right half is a fixed count
                  with no stepper. */}
              <div className="mt-3">
                <OwnedLocationBar
                  targetKind="comic"
                  cardId={null}
                  sealedName={null}
                  comicId={comic.id}
                  ownedQty={1}
                  copiesQty={1}
                  copiesItemName={comic.title}
                  barClassName="bg-[var(--surface)]"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-album text-base text-[var(--text)]">
                This comic&rsquo;s performance
              </h3>
              <span className="text-sm font-semibold text-[var(--gold-soft)]">
                ~{fmtUSD(comic.value, 0)}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[var(--bg)] px-3 py-2">
                <dt className="text-[var(--dim)]">Estimated value</dt>
                <dd className="font-semibold text-[var(--text)]">
                  ~{fmtUSD(comic.value, 0)}
                  {comic.valueRange ? (
                    <span className="ml-1.5 text-xs font-normal text-[var(--dim)]">
                      (range {comic.valueRange})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[var(--bg)] px-3 py-2">
                <dt className="text-[var(--dim)]">What you paid</dt>
                <dd className="text-[var(--text)]">
                  Not recorded
                  <span className="ml-1.5 text-xs font-normal text-[var(--dim)]">
                    (no paid amount was ever logged for this slab, so
                    the Money Tracker counts its cost as unknown)
                  </span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[var(--bg)] px-3 py-2">
                <dt className="text-[var(--dim)]">Checked</dt>
                <dd className="text-[var(--text)]">{COMICS_VALUE_CHECKED}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[var(--bg)] px-3 py-2">
                <dt className="text-[var(--dim)]">Confidence</dt>
                <dd className="text-[var(--text)]">{comic.confidence}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-[var(--bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)]">
              <span className="font-semibold">Value basis: </span>
              {comic.valueBasis}
            </p>
            {/* Best Offer — every item detail carries the where-to-
                buy/sell element (Anthony's rule). Graded comics trade
                on eBay, not TCGplayer — his own values here come from
                eBay sold prices — so the element points there, with
                the slab's title and cert number to search by. */}
            <a
              href="https://www.ebay.com"
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
            >
              <span>
                <span className="block text-sm font-semibold text-[var(--text)]">
                  Best Offer — eBay
                </span>
                <span className="block text-xs text-[var(--dim)]">
                  See live listings and sold prices for this slab —
                  search “{comic.title} CGC 9.8” or cert {comic.cert}.
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold text-[var(--gold-soft)]">
                View ↗
              </span>
            </a>
            {/* Value over time — every item detail carries the chart
                (Anthony's rule). The comics have exactly one real
                valuation so far, the Oct 29, 2026 check, so the chart
                honestly shows that single tracked point; it grows
                each time values are re-checked. No earlier or
                invented points. */}
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-sm font-semibold text-[var(--text)]">
                {jarvisVision ? "Price history" : "Value over time"}
              </p>
              <div
                role="img"
                aria-label={`Chart of this comic's tracked value: one valuation so far, about ${fmtUSD(comic.value, 0)} checked ${COMICS_VALUE_CHECKED}.`}
              >
                {jarvisVision ? (
                  /* New Vision 2.0 Beta (exact-match correction,
                     Nov 5, 2026): the UAT Price history drawing —
                     the bare cyan Spark at 56. One tracked
                     valuation draws as the flat line at its own
                     level, exactly what the single point means. */
                  <UatSpark points={[comic.value]} h={56} />
                ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart
                    data={[{ label: "Oct 29", value: comic.value }]}
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="comicValueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#7aa5ff" stopOpacity={0.38} />
                        <stop offset="100%" stopColor="#7aa5ff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#24365e" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#8b9bb8", fontSize: 10 }}
                      axisLine={{ stroke: "#24365e" }}
                      tickLine={false}
                      height={24}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#8b9bb8", fontSize: 11 }}
                      tickFormatter={(v: number) => `$${v}`}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      label={{
                        value: "USD",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#8b9bb8",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0e1526",
                        border: "1px solid #24365e",
                        borderRadius: 8,
                        color: "#eef2ff",
                        fontSize: 13,
                      }}
                      formatter={(v: number) => [
                        `~${fmtUSD(v, 0)}`,
                        "Tracked value",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Tracked value"
                      stroke="#7aa5ff"
                      strokeWidth={2.5}
                      fill="url(#comicValueFill)"
                      dot={{ r: 4, fill: "#7aa5ff", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#7aa5ff", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--dim)]">
                One valuation tracked so far — the {COMICS_VALUE_CHECKED}{" "}
                check. The line grows each time the slabs&rsquo; values
                are re-checked.
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              Values were checked on {COMICS_VALUE_CHECKED} from eBay sold
              prices via PriceCharting, plus guide data. They are
              estimates from that check, not live prices — no amount paid
              was recorded for the slabs, so there is no gain/loss figure
              here.
            </p>
            {/* Watch — graded comics join the Portfolio
                Watchlist like every cataloged item (Anthony,
                Nov 4, 2026): the watch tracks the slab's
                checked value. */}
            <div className="mt-4">
              <WatchToggleButton
                targetKind="comic"
                cardId={null}
                sealedName={null}
                comicId={comic.id}
              />
            </div>
            {/* Price alerts — every item detail carries the box
                (Anthony's rule), graded comics included: its
                heading opens the all-alerts management page. The
                alert watches the slab's checked value above. */}
            <PriceAlertBox
              targetKind="comic"
              cardId={null}
              sealedName={null}
              comicId={comic.id}
              currentValue={comic.value}
              comicCoverFor={(id) => COMICS.find((c) => c.id === id)?.cover}
            />
            {/* No standalone "Where it lives" section at the
                bottom anymore (Anthony's placement change,
                Nov 2, 2026): it is merged into the Copies owned
                bar on the Comic tab — see OwnedLocationBar in
                the "In your collection" block. */}
          </div>
        )}
      </div>
    </div>
  );
}

/** The key issues in the collection — the same three standouts as
    KEY_ISSUES below (kept as an id set here because the pocket is
    defined before that list). CLZ Comics marks key comics with a
    key icon on the cover; this is the same idea. */
const KEY_IDS: ReadonlySet<string> = new Set([
  "aliens-1",
  "batman-136",
  "wolverine-154",
]);

/** One slab in the collection grid — CLZ Comics "Card View" style
    (Nov 2, 2026 layout cleanup): the cover big and forward, the
    CGC 9.8 badge in label colors on the cover, then the tidy info
    lines a catalog app shows — title, publisher · date, value.
    The variant/edition detail lives on the comic's own page, not
    in the grid. (The amber KEY pill that used to ride on key
    covers was removed Nov 2, 2026 at Anthony's direction — he
    didn't think it was necessary. The Key Issues page itself
    stays.) */
function ComicPocket({
  comic,
  onOpen,
}: {
  comic: Comic;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(comic.id)}
      aria-label={`${comic.title}, CGC ${comic.label} 9.8, valued at about ${fmtUSD(comic.value, 0)}. View its details.`}
      className="group block w-full text-left focus:outline-none"
    >
      <span className="relative block overflow-hidden rounded-[8px] border border-[var(--pocket-edge)] shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
        <img
          src={comic.cover}
          alt={`${comic.title} cover art`}
          loading="lazy"
          className="block aspect-[2/3] w-full object-cover"
        />
        <GradeBadge comic={comic} className="absolute left-1.5 top-1.5" />
      </span>
      <span className="mt-1.5 block truncate text-[13px] font-semibold leading-tight text-[var(--text)]">
        {comic.title}
      </span>
      <span className="block truncate text-[11px] leading-tight text-[var(--dim)]">
        {comic.publisher.replace(" Comics", "")} · {comic.date}
      </span>
      <span className="mt-0.5 block text-[12px] font-semibold text-[var(--gold-soft)]">
        ~{fmtUSD(comic.value, 0)}
      </span>
    </button>
  );
}

/** The standouts from Anthony's log, with the reason each stands
    out — every reason is taken from the collection log itself
    (a notable appearance, a signature, a sketch), nothing added. */
const KEY_ISSUES: { id: string; reason: string }[] = [
  {
    id: "aliens-1",
    reason:
      "Signed by Sigourney Weaver (Celebrity Authentics Edition, Daylight version) — the most valuable slab in the collection.",
  },
  {
    id: "batman-136",
    reason:
      "Signed & sketch by Tyler Kirkham — Whatnot Foil Edition, virgin cover.",
  },
  {
    id: "wolverine-154",
    reason: "Deadpool appearance.",
  },
];

type ComicsArea = "slabs" | "cards" | "wall" | "keys" | "signed" | "wish";

const COMICS_AREAS: { key: ComicsArea; label: string }[] = [
  { key: "slabs", label: "Comics" },
  { key: "cards", label: "Graded Cards" },
  { key: "wall", label: "Cover Wall" },
  { key: "keys", label: "Key Issues" },
  { key: "signed", label: "Signed" },
  { key: "wish", label: "Wish List" },
];

/** Comics view — CLZ Comics-style layout (Nov 2, 2026 cleanup,
    copying the established comic-catalog apps' patterns): a
    statistics strip (slabs / total value / key issues), then the
    collection cover-forward in a Card View grid (big covers, grade
    badge + KEY marker on the cover, title / publisher · date /
    value under each, sortable by value, title, or publisher),
    CLZ-style folder lists for browsing by publisher and by CGC
    label into per-group shelves with a "← All comics" return, and
    a Most Valuable Comics ranked list. The five areas (Slabs,
    Cover Wall, Key Issues, Signed, Wish List) are unchanged.
    Comic detail opens with the same one-history-entry trap as the
    card sheet, so the device Back button closes it onto the grid
    he was viewing. */
/** Library display wall picker (MOVED here Nov 5, 2026):
    choosing which graded slabs (max five) hang on the
    Library's Comics display wall used to live ON the
    Library page itself, under an "Edit display" button —
    Anthony did not like the control sitting there, so the
    Library wall is display-only now and the picker lives
    here in the Comics section, where the slabs themselves
    live. Same setting underneath (getLibraryComicDisplay /
    setLibraryComicDisplay), same default when never chosen
    (his two signed comics: Aliens #1 and Batman #136), so
    the Library wall shows exactly what is picked here. */
export type SlabsSlabRow = ApiResponse<
  typeof api,
  "listAllGradedSlabs"
>["slabs"][number];

/** The standing default for the SLABS comics shelf
    (Anthony, Nov 9, 2026 — preserved from the Comics wall
    before it): his two signed comics, Aliens #1 and Batman
    #136. Used only until he picks his own in the display
    picker (max five, as before). */
export const SLABS_DEFAULT_COMICS = ["aliens-1", "batman-136"];

/** Dispatches the app-wide "open this graded slab" event —
    the root owns the Card / Slab View and already listens
    for slab-scan events the same way (the Sports Cards
    shortcut's pattern), so shelves anywhere in the app open
    a slab the one way. */
export function openSlabsSlab(slabId: number) {
  window.dispatchEvent(
    new CustomEvent("vaultx:open-slab-view", { detail: slabId }),
  );
}

/** A comic slab on a display shelf, at shelf size: SlabFront
    rendered at a natural width and scaled down to fit, so
    its label keeps a real slab's slim proportion (the
    Library wall's proven approach, Nov 4, 2026). */
function ShelfComicSlab({ comic }: { comic: Comic }) {
  const NATURAL_WIDTH = 264;
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [naturalHeight, setNaturalHeight] = useState(400);
  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const w = outer.clientWidth;
      if (w > 0) setScale(w / NATURAL_WIDTH);
      const h = inner.offsetHeight;
      if (h > 0) setNaturalHeight(h);
    };
    update();
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(update);
      ro.observe(outer);
      ro.observe(inner);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);
  return (
    <div
      ref={outerRef}
      className="relative w-full overflow-hidden"
      style={{ height: naturalHeight * scale }}
    >
      <div
        ref={innerRef}
        className="absolute left-0 top-0"
        style={{
          width: NATURAL_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <SlabFront comic={comic} uniformLabel />
      </div>
    </div>
  );
}

/** One graded slab CARD on SLABS's small upper shelf:
    a compact slab — the grading company's band with the
    grade, the slab's own photo when one was imported (the
    catalog card art stands in when no photo exists, and the
    caption says which it is), and the card name with its
    company, grade, and cert under it. */
function ShelfSlabCard({
  slab,
  onOpen,
}: {
  slab: SlabsSlabRow;
  onOpen: (id: number) => void;
}) {
  const img = slab.imageUrl ?? slab.cardImageUrl;
  return (
    <button
      type="button"
      onClick={() => onOpen(slab.id)}
      aria-label={`Open ${slab.cardName} — ${slab.company} ${slab.grade}, cert ${slab.cert}`}
      className="block w-full text-left focus:outline-none"
    >
      <span className="relative block overflow-hidden rounded-[7px] bg-[linear-gradient(135deg,rgba(255,255,255,0.5)_0%,rgba(210,226,248,0.12)_30%,rgba(160,185,220,0.10)_55%,rgba(255,255,255,0.28)_85%,rgba(190,210,238,0.35)_100%)] p-[3px] shadow-[0_8px_20px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_rgba(238,246,255,0.5)] ring-1 ring-white/50">
        <span
          className={`flex items-center justify-between gap-1 px-1.5 py-[3px] ${
            slab.company === "PSA"
              ? "bg-[#f4f1ea] text-[#191919]"
              : slab.company === "CGC"
                ? "bg-[#005eb8] text-white"
                : slab.company === "BGS"
                  ? "bg-gradient-to-b from-[#e8cd7a] to-[#c9a227] text-[#221a04]"
                  : "bg-[#14161a] text-white"
          }`}
        >
          <span
            className={`text-[8px] font-black leading-none tracking-tight ${
              slab.company === "PSA" ? "italic text-[#c8102e]" : ""
            }`}
          >
            {slab.company}
          </span>
          <span className="text-[11px] font-black leading-none tabular-nums">
            {slab.grade === "Authentic" ? "AUTH" : slab.grade}
          </span>
        </span>
        {img ? (
          <img
            src={img}
            alt=""
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            className="block aspect-[2.5/3.2] w-full object-cover"
          />
        ) : (
          <span className="flex aspect-[2.5/3.2] w-full items-center justify-center bg-[#101623] px-1.5 text-center text-[9px] font-semibold leading-tight text-[var(--dim)]">
            {slab.cardName}
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-center text-[10px] font-semibold leading-tight text-[var(--text)]">
        {slab.cardName}
      </span>
      <span className="block truncate text-center text-[9px] leading-tight text-[var(--dim)]">
        {slab.company} {slab.grade} · #{slab.cert}
        {slab.imageUrl == null ? " · catalog art" : ""}
      </span>
    </button>
  );
}

/** The Graded Cards area of SLABS (Anthony, Nov 9, 2026):
    every graded slab CARD saved in the vault — all five
    companies (PSA, BGS, SGC, CGC, TAG), filterable by
    company — each rendered with the existing slab visual
    and tapping through to its Card / Slab View. Adding a
    slab reuses the existing cert capture / confirm-before-
    save flow (the scanner in slab mode); nothing here
    changes the per-card graded flow or its owned-count
    coupling. */
function GradedCardsArea() {
  const [company, setCompany] = useState<
    "PSA" | "BGS" | "SGC" | "CGC" | "TAG" | null
  >(null);
  const slabsQ = useQuery({
    queryKey: ["allGradedSlabs", company],
    queryFn: () => api.listAllGradedSlabs({ company }),
  });
  const rows = slabsQ.data?.slabs ?? [];
  return (
    <section aria-label="Graded Cards" className="mt-5">
      <h2 className="font-album text-lg text-[var(--text)]">
        Graded Cards
      </h2>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every graded card slab you&rsquo;ve saved, from any of
        the five grading companies. Tap a slab to open its
        Card / Slab View.
      </p>
      <div
        className="mt-3 flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter graded cards by grading company"
      >
        <button
          type="button"
          aria-pressed={company === null}
          onClick={() => setCompany(null)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
            company === null
              ? "bg-[var(--gold)] text-black"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
          }`}
        >
          All companies
        </button>
        {GRADING_COMPANIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={company === c.key}
            onClick={() => setCompany(c.key)}
            aria-label={`Show only ${c.label} graded cards`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
              company === c.key
                ? "bg-[var(--gold)] text-black"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            {c.short}
          </button>
        ))}
      </div>
      {slabsQ.isPending ? (
        <p
          role="status"
          className="mt-4 animate-pulse text-center text-sm text-[var(--dim)]"
        >
          Lining up your graded cards…
        </p>
      ) : slabsQ.isError ? (
        <div className="mt-4 text-center">
          <p role="alert" className="text-sm text-[var(--dim)]">
            Your graded cards couldn&rsquo;t load.
          </p>
          <button
            type="button"
            onClick={() => {
              hapticTick();
              void slabsQ.refetch();
            }}
            aria-label="Try loading your graded cards again"
            className="mt-2 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--text)]"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center">
          <p className="text-sm font-medium text-[var(--text)]">
            {company
              ? `No ${company} slabs saved yet`
              : "No graded cards saved yet"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
            Scan a slab&rsquo;s cert number — QR code, barcode,
            a photo of its label, or the typed number — and
            after you confirm it, the slab lives here and on
            the small shelf above your comics.
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-4 flex w-full max-w-sm flex-col gap-3">
          {rows.map((slab) => (
            <GradedSlabVisual
              key={slab.id}
              slab={slab}
              cardName={slab.cardName}
              onOpen={() => openSlabsSlab(slab.id)}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          hapticTick();
          window.dispatchEvent(new Event("vaultx:open-slab-scan"));
        }}
        aria-label="Add a graded slab — scan its cert number"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)]/60 px-4 py-2.5 text-sm font-semibold text-[var(--gold-soft)]"
      >
        Add a graded slab — scan its cert
      </button>
    </section>
  );
}

/** SLABS's two display shelves (Anthony, Nov 9, 2026):
    the section that used to be just Comics is now SLABS —
    a SMALL shelf of graded slab CARDS (up to four) standing
    centered above a BIG shelf of graded COMICS, the small
    shelf offset in the middle over the big one, like a
    display case over a bookcase. Both shelves show the
    owner's own pieces only: comics from the COMICS catalog,
    slab cards from his saved graded slabs (any game, any of
    the five grading companies). Which pieces stand on each
    shelf is chosen in the SLABS section's display picker;
    until he chooses, the comics shelf shows his two signed
    comics (his standing Comics-wall default, max five
    selectable as before) and the cards shelf his four most
    recently saved slabs. Hold any piece a moment, then drag
    to rearrange its shelf — the order saves as his own.
    Used on the Library page (under the SLABS sign) and at
    the top of the SLABS section itself. */
export function SlabsShelves({
  onOpenComic,
}: {
  /** Opens a comic's detail sheet. When omitted (the
      Library), the shelves open the sheet themselves with
      their own Back-trapped window. */
  onOpenComic?: (comic: Comic) => void;
}) {
  const queryClient = useQueryClient();
  const comicDisplay = useQuery({
    queryKey: ["libraryComicDisplay"],
    queryFn: () => api.getLibraryComicDisplay({}),
  });
  const slabDisplay = useQuery({
    queryKey: ["librarySlabCardDisplay"],
    queryFn: () => api.getLibrarySlabCardDisplay({}),
  });
  const allSlabs = useQuery({
    queryKey: ["allGradedSlabs"],
    queryFn: () => api.listAllGradedSlabs({}),
  });

  // The Library's own comic sheet window (used only when no
  // opener was handed in): one Back press closes the comic
  // and lands back on the Library.
  const [ownComic, setOwnComic] = useState<Comic | null>(null);
  const comicWin = useOwnEntryWindow("libraryComicSheet", (v) => {
    if (!v) setOwnComic(null);
  });
  const openComic = (comic: Comic) => {
    hapticTick();
    if (onOpenComic) {
      onOpenComic(comic);
    } else {
      setOwnComic(comic);
      comicWin.open();
    }
  };

  const chosenComicIds =
    comicDisplay.data?.ids ?? SLABS_DEFAULT_COMICS;
  const [comicOrder, setComicOrder] = useState<string[] | null>(
    null,
  );
  useEffect(() => {
    const saved = comicDisplay.data?.ids;
    if (
      comicOrder &&
      saved &&
      saved.join() === comicOrder.join()
    ) {
      setComicOrder(null);
    }
  }, [comicDisplay.data, comicOrder]);
  const saveComicDisplay = useMutation({
    mutationFn: (ids: string[]) =>
      api.setLibraryComicDisplay({ ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["libraryComicDisplay"],
      });
    },
  });
  const effectiveComicIds = comicOrder ?? chosenComicIds;
  const shownComics = effectiveComicIds
    .map((id) => COMICS.find((c) => c.id === id))
    .filter((c): c is Comic => Boolean(c))
    .slice(0, 5);
  const comicDrag = useDragReorder({
    keys: shownComics.map((c) => c.id),
    onCommit: (order) => {
      const rest = effectiveComicIds.filter(
        (id) => !order.includes(id),
      );
      const next = [...order, ...rest].slice(0, 5);
      setComicOrder(next);
      saveComicDisplay.mutate(next);
    },
  });

  const slabRows = allSlabs.data?.slabs ?? [];
  const chosenSlabIds =
    slabDisplay.data?.ids ?? slabRows.slice(0, 4).map((s) => s.id);
  const [slabOrder, setSlabOrder] = useState<number[] | null>(
    null,
  );
  useEffect(() => {
    const saved = slabDisplay.data?.ids;
    if (
      slabOrder &&
      saved &&
      saved.join() === slabOrder.join()
    ) {
      setSlabOrder(null);
    }
  }, [slabDisplay.data, slabOrder]);
  const saveSlabDisplay = useMutation({
    mutationFn: (ids: number[]) =>
      api.setLibrarySlabCardDisplay({ ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["librarySlabCardDisplay"],
      });
    },
  });
  const effectiveSlabIds = slabOrder ?? chosenSlabIds;
  const shownSlabs = effectiveSlabIds
    .map((id) => slabRows.find((s) => s.id === id))
    .filter((s): s is SlabsSlabRow => Boolean(s))
    .slice(0, 4);
  const slabDrag = useDragReorder({
    keys: shownSlabs.map((s) => String(s.id)),
    onCommit: (order) => {
      const orderIds = order.map((k) => Number(k));
      const rest = effectiveSlabIds.filter(
        (id) => !orderIds.includes(id),
      );
      const next = [...orderIds, ...rest].slice(0, 4);
      setSlabOrder(next);
      saveSlabDisplay.mutate(next);
    },
  });

  return (
    <div>
      {/* The small upper shelf: graded slab cards, centered
          and narrower than the comics shelf below it, offset
          in the middle above the comics. */}
      <div className="mx-auto w-[78%] max-w-[430px]">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--gold-soft)]">
          Graded Cards
        </p>
        {allSlabs.isPending ? (
          <p
            role="status"
            className="mt-2 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-5 text-center text-xs text-[var(--dim)]"
          >
            Lining up your graded cards…
          </p>
        ) : shownSlabs.length > 0 ? (
          <>
            <div
              ref={slabDrag.containerRef}
              className="mt-2 flex items-start justify-center gap-2"
            >
              {shownSlabs.map((slab) => (
                <div
                  key={slab.id}
                  {...slabDrag.itemProps(String(slab.id))}
                  className={`w-[23%] max-w-[96px] shrink-0 ${
                    slabDrag.draggingKey === String(slab.id)
                      ? "z-30"
                      : ""
                  }`}
                >
                  <ShelfSlabCard
                    slab={slab}
                    onOpen={(id) => {
                      if (slabDrag.suppressClick()) return;
                      openSlabsSlab(id);
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="slabs-board mt-2"
            />
          </>
        ) : (
          <div className="mt-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center">
            <p className="text-xs leading-relaxed text-[var(--dim)]">
              No graded cards on this shelf yet — the first
              slab you scan by its cert number stands here.
            </p>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                window.dispatchEvent(
                  new Event("vaultx:open-slab-scan"),
                );
              }}
              aria-label="Scan a graded slab's cert number"
              className="mt-2 rounded-full bg-[var(--gold)] px-4 py-1.5 text-xs font-bold text-black"
            >
              Scan a slab
            </button>
            <div
              aria-hidden="true"
              className="slabs-board mt-3"
            />
          </div>
        )}
        {allSlabs.isError ? (
          <div className="mt-1.5 text-center">
            <p role="alert" className="text-[11px] text-[var(--dim)]">
              Your graded cards couldn&rsquo;t load just now.
            </p>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                void allSlabs.refetch();
              }}
              aria-label="Try loading your graded cards again"
              className="mt-1 rounded-full border border-[var(--border)] px-3.5 py-1 text-[11px] font-semibold text-[var(--text)]"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {/* The big lower shelf: graded comics, full width. */}
      <div className="mt-4">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--gold-soft)]">
          Comics
        </p>
        {shownComics.length > 0 ? (
          <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 pb-3 pt-3">
            <div
              ref={comicDrag.containerRef}
              className="flex flex-wrap items-start justify-center gap-2.5"
            >
              {shownComics.map((comic) => (
                <button
                  key={comic.id}
                  type="button"
                  {...comicDrag.itemProps(comic.id)}
                  onClick={() => {
                    if (comicDrag.suppressClick()) return;
                    openComic(comic);
                  }}
                  aria-label={`Open ${comic.title}`}
                  className={`w-[22%] max-w-[120px] shrink-0 transition active:scale-[0.98] ${
                    comicDrag.draggingKey === comic.id ? "z-30" : ""
                  }`}
                >
                  <ShelfComicSlab comic={comic} />
                </button>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="slabs-board mt-3"
            />
          </div>
        ) : (
          <p className="mt-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--dim)]">
            No comics on display — choose up to five of your
            graded comics to stand here from Edit display in
            the SLABS section.
          </p>
        )}
        {comicDisplay.isError ? (
          <div className="mt-2 text-center">
            <p role="alert" className="text-xs leading-relaxed text-[var(--dim)]">
              Your saved shelf choice couldn&rsquo;t load —
              showing the default comics for now.
            </p>
            <button
              type="button"
              onClick={() => {
                hapticTick();
                void comicDisplay.refetch();
              }}
              aria-label="Try loading your saved SLABS shelf choice again"
              className="mt-1.5 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--text)] transition active:scale-[0.97]"
            >
              Try again
            </button>
          </div>
        ) : null}
        {shownComics.length > 1 || shownSlabs.length > 1 ? (
          <p className="mt-2 text-center text-[11px] leading-relaxed text-[var(--dim)]">
            Hold a piece a moment, then drag to rearrange its
            shelf — the order saves as yours.
          </p>
        ) : null}
      </div>

      {ownComic ? (
        /* The Library overlay sits at z-70 and ComicSheet's
            own root is z-50 — this wrapper's stacking context
            lifts the sheet above the Library it opened from. */
        <div className="fixed inset-0 z-[80]">
          <ComicSheet
            comic={ownComic}
            onClose={() => comicWin.close()}
          />
        </div>
      ) : null}
    </div>
  );
}

/** SLABS display picker (Anthony, Nov 9, 2026 —
    reworked from the Library display wall picker of Nov 5,
    2026): choosing which pieces stand on SLABS's two
    shelves lives here in the SLABS section, where the
    pieces themselves live. The big comics shelf holds at
    most FOUR comics; the small graded-cards shelf holds at
    most FOUR saved graded slabs. Same settings underneath
    (getLibraryComicDisplay / setLibraryComicDisplay and
    getLibrarySlabCardDisplay / setLibrarySlabCardDisplay),
    same defaults when never chosen. */
export function SlabsPicker() {
  const queryClient = useQueryClient();
  const comicDisplay = useQuery({
    queryKey: ["libraryComicDisplay"],
    queryFn: () => api.getLibraryComicDisplay({}),
  });
  const slabDisplay = useQuery({
    queryKey: ["librarySlabCardDisplay"],
    queryFn: () => api.getLibrarySlabCardDisplay({}),
  });
  const allSlabs = useQuery({
    queryKey: ["allGradedSlabs"],
    queryFn: () => api.listAllGradedSlabs({}),
  });
  const [editing, setEditing] = useState(false);
  const [comicDraft, setComicDraft] = useState<string[]>([]);
  const [slabDraft, setSlabDraft] = useState<number[]>([]);
  const saveComics = useMutation({
    mutationFn: (ids: string[]) =>
      api.setLibraryComicDisplay({ ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["libraryComicDisplay"],
      });
    },
  });
  const saveSlabs = useMutation({
    mutationFn: (ids: number[]) =>
      api.setLibrarySlabCardDisplay({ ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["librarySlabCardDisplay"],
      });
      setEditing(false);
    },
  });
  const chosenComics =
    comicDisplay.data?.ids ?? SLABS_DEFAULT_COMICS;
  const slabRows = allSlabs.data?.slabs ?? [];
  const chosenSlabs =
    slabDisplay.data?.ids ?? slabRows.slice(0, 4).map((s) => s.id);
  const chosenComicTitles = chosenComics
    .map((id) => COMICS.find((c) => c.id === id)?.title)
    .filter((t): t is string => Boolean(t));
  const chosenSlabNames = chosenSlabs
    .map((id) => slabRows.find((s) => s.id === id)?.cardName)
    .filter((t): t is string => Boolean(t));
  const toggleComic = (id: string) => {
    setComicDraft((d) =>
      d.includes(id)
        ? d.filter((x) => x !== id)
        : d.length >= 5
          ? d
          : [...d, id],
    );
  };
  const toggleSlab = (id: number) => {
    setSlabDraft((d) =>
      d.includes(id)
        ? d.filter((x) => x !== id)
        : d.length >= 4
          ? d
          : [...d, id],
    );
  };
  const saving = saveComics.isPending || saveSlabs.isPending;
  const saveFailed = saveComics.isError || saveSlabs.isError;
  return (
    <section
      aria-label="SLABS display shelves"
      className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-album text-base text-[var(--text)]">
            Display shelves
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--dim)]">
            Comics:{" "}
            {chosenComicTitles.length > 0
              ? chosenComicTitles.join(" · ")
              : "none chosen"}
            . Graded cards:{" "}
            {chosenSlabNames.length > 0
              ? chosenSlabNames.join(" · ")
              : "none yet"}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            hapticTick();
            setComicDraft(chosenComics);
            setSlabDraft(chosenSlabs);
            setEditing((v) => !v);
          }}
          aria-expanded={editing}
          className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--gold-soft)]"
        >
          {editing ? "Close the display picker" : "Edit display"}
        </button>
      </div>
      {editing ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm font-semibold text-[var(--text)]">
            On the comics shelf — {comicDraft.length} of 5
          </p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            Tap your comics to add or remove them. The big
            shelf holds at most five.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {COMICS.map((comic) => {
              const on = comicDraft.includes(comic.id);
              const full = !on && comicDraft.length >= 5;
              return (
                <button
                  key={comic.id}
                  type="button"
                  disabled={full}
                  onClick={() => toggleComic(comic.id)}
                  aria-pressed={on}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    on
                      ? "bg-[var(--gold)] text-black"
                      : "border border-[var(--border)] text-[var(--text)] disabled:opacity-40"
                  }`}
                >
                  {comic.title}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--text)]">
            On the graded cards shelf — {slabDraft.length} of 4
          </p>
          <p className="mt-0.5 text-xs text-[var(--dim)]">
            Tap your graded slabs to add or remove them. The
            small shelf holds at most four.
          </p>
          {slabRows.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {slabRows.map((slab) => {
                const on = slabDraft.includes(slab.id);
                const full = !on && slabDraft.length >= 4;
                return (
                  <button
                    key={slab.id}
                    type="button"
                    disabled={full}
                    onClick={() => toggleSlab(slab.id)}
                    aria-pressed={on}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      on
                        ? "bg-[var(--gold)] text-black"
                        : "border border-[var(--border)] text-[var(--text)] disabled:opacity-40"
                    }`}
                  >
                    {slab.cardName} · {slab.company} {slab.grade}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[var(--dim)]">
              No graded slabs saved yet — scan a slab by its
              cert number and it can stand on this shelf.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                saveComics.mutate(comicDraft);
                saveSlabs.mutate(slabDraft);
              }}
              className="flex-1 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save display"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
          {saveFailed ? (
            <p role="alert" className="mt-2 text-xs text-red-400">
              That didn&rsquo;t save — try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ComicsPanel({ onScan }: { onScan?: () => void }) {
  // Section search (Nov 3, 2026, ~11:14 PM): the search bar
  // in the section's Search + Scan row filters his graded
  // comics by title, issue, or publisher right here.
  const [comicQuery, setComicQuery] = useState("");
  // First-letter filtering (standing search rule, Anthony,
  // Nov 5, 2026): matches start at the first typed letter,
  // never a two-character minimum.
  const comicMatches =
    comicQuery.trim().length >= 1
      ? COMICS.filter((c) => {
          const q = comicQuery.trim().toLowerCase();
          return (
            c.title.toLowerCase().includes(q) ||
            c.labelTitle.toLowerCase().includes(q) ||
            c.publisher.toLowerCase().includes(q)
          );
        })
      : [];
  // Comics areas (Anthony approved the researched CLZ-style areas,
  // Nov 2, 2026): Slabs (the binder itself), Cover Wall, Key Issues,
  // Signed, and Wish List — switched by the pill row, one page each,
  // like Social's areas.
  const [area, setArea] = useState<ComicsArea>("slabs");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(true);
  // Area switches and group drill-ins are main-flow navigation
  // (three-back rule, Anthony, Nov 4, 2026): each REPLACES the
  // single app entry carrying the Comics navigation snapshot,
  // and this listener syncs the panel from whatever entry Back
  // lands on — a Comics entry restores its area/group (the plain
  // Comics entry means Slabs + the group picker). It also runs
  // once on mount, so returning to Comics restores the
  // area/group its entry names.
  useEffect(() => {
    const syncFromHistory = () => {
      const st = window.history.state as {
        mcView?: string;
        comicsArea?: string;
        comicsGroup?: string;
      } | null;
      if (!st || st.mcView !== "comics") return;
      const a = COMICS_AREAS.find((x) => x.key === st.comicsArea);
      setArea(a ? a.key : "slabs");
      if (typeof st.comicsGroup === "string") {
        setGroupKey(st.comicsGroup);
        setShowPicker(false);
      } else {
        setGroupKey(null);
        setShowPicker(true);
      }
    };
    syncFromHistory();
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);
  const pickArea = (key: ComicsArea) => {
    if (key === area) return;
    setArea(key);
    // Three-back rule (Anthony, Nov 4, 2026): area switches are
    // main-flow navigation — replace, never push.
    replaceNavState({
      mcView: "comics",
      comicsArea: key,
      ...(!showPicker && groupKey ? { comicsGroup: groupKey } : {}),
    });
  };
  const group: ComicGroup | undefined = COMIC_GROUPS.find(
    (g) => g.key === groupKey,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheetPushedRef = useRef(false);
  const sheetHeldRef = useRef(false);
  const selected: Comic | undefined = COMICS.find((c) => c.id === selectedId);
  const openComic = (id: string) => {
    if (selectedId === id) return;
    setSelectedId(id);
    // Window (three-back rule, Anthony, Nov 4, 2026): one entry;
    // layers into the open window's entry when one already holds
    // the slot instead of stacking. The entry carries the whole
    // stack beneath it (the useHistorySheet pattern), so a
    // refresh restores everything in place.
    const next: Record<string, unknown> = {
      ...(readNavState() ?? {}),
      comicsSheet: id,
    };
    if (sheetHeldRef.current) {
      replaceNavState(next);
    } else {
      sheetPushedRef.current = pushWindowState(next, "comicsSheet");
      sheetHeldRef.current = true;
    }
  };
  const closeComic = () => {
    if (sheetPushedRef.current) {
      window.history.back();
    } else {
      sheetHeldRef.current = false;
      scrubWindowKeys(["comicsSheet"]);
      setSelectedId(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      // Close ONLY when the entry Back landed on no longer
      // names this sheet — a pop that merely closes a page
      // layered over it (e.g. Price alerts) still carries
      // comicsSheet and must leave the sheet open.
      if (
        sheetHeldRef.current &&
        typeof readNavState()?.comicsSheet !== "string"
      ) {
        sheetHeldRef.current = false;
        sheetPushedRef.current = false;
        setSelectedId(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const pickGroup = (key: string) => {
    setShowPicker(false);
    setGroupKey(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Drilling into a group is main-flow navigation
    // (three-back rule, Anthony, Nov 4, 2026): replace the
    // single app entry — the device Back exits the app, and
    // "← All comics" returns to the picker in place.
    replaceNavState({ mcView: "comics", comicsArea: "slabs", comicsGroup: key });
  };

  const ranked = [...COMICS].sort((a, b) => b.value - a.value);

  // Slabs-grid sort (CLZ lets you sort the collection by value,
  // series/issue, or publisher — the three that mean anything for
  // 8 slabs). Local view state only; the data never changes.
  const [sort, setSort] = useState<"value" | "title" | "publisher">("value");
  const sortedComics = [...COMICS].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "publisher")
      return (
        a.publisher.localeCompare(b.publisher) ||
        a.title.localeCompare(b.title)
      );
    return b.value - a.value;
  });
  const keyCount = COMICS.filter((c) => KEY_IDS.has(c.id)).length;
  const signedCount = COMICS.filter(
    (c) => c.label === "Signature Series",
  ).length;

  return (
    <div className="pt-4">
      <h1 className="font-album text-2xl leading-tight text-[var(--text)]">
        SLABS
      </h1>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Every slab you own, in one place: your graded cards on
        the small shelf up top, your graded comics on the big
        shelf below — tap any piece to see it up close.
      </p>

      {/* Search + Scan row (Anthony, Nov 3, 2026, ~11:14 PM):
          the same top row every collection section carries.
          The bar searches his graded comics (title, issue,
          publisher); a match opens that slab. */}
      <div className="mt-4">
        <SearchScanRow
          inputId="comics-section-search"
          label="Search your graded comics by title, issue, or publisher"
          placeholder="Search title, issue, publisher…"
          value={comicQuery}
          onChange={setComicQuery}
          onScan={onScan}
        />
      </div>
      {comicQuery.trim().length >= 1 ? (
        <div className="mt-3">
          {comicMatches.length === 0 ? (
            <p className="text-sm text-[var(--dim)]">
              No graded comics match that search.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
              {comicMatches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openComic(c.id)}
                    aria-label={`Open ${c.title}`}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <img
                      src={c.cover}
                      alt=""
                      loading="lazy"
                      className="h-14 w-10 shrink-0 rounded-md object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">
                        {c.title}
                      </span>
                      <span className="block truncate text-xs text-[var(--dim)]">
                        {c.publisher}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Collection statistics strip — the CLZ Statistics pattern:
          the collection's headline numbers as three tidy stat
          blocks (slabs, total value, key issues), replacing the old
          always-full progress bar. */}
      <section
        aria-label="SLABS comics summary"
        className="mt-4 grid grid-cols-3 gap-3"
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="font-album text-2xl font-bold text-[var(--text)]">
            {COMICS.length}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
            Comic slabs
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--dim)]">
            All CGC 9.8 · WHITE Pages
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="font-album text-2xl font-bold text-[var(--gold-soft)]">
            ~{fmtUSD(COMICS_TOTAL_VALUE, 0)}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
            Total value
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--dim)]">
            Checked {COMICS_VALUE_CHECKED}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="font-album text-2xl font-bold text-[var(--text)]">
            {keyCount}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
            Key issues
          </p>
          <p className="mt-1 text-xs leading-snug text-[var(--dim)]">
            {signedCount} of them signed
          </p>
        </div>
      </section>

      {/* SLABS's display shelves (Anthony, Nov 9,
          2026): the small graded-cards shelf centered above
          the big comics shelf — the same two shelves that
          stand in the Library under the SLABS sign. */}
      <section aria-label="SLABS display shelves" className="mt-5">
        <SlabsShelves
          onOpenComic={(comic) => openComic(comic.id)}
        />
      </section>

      {/* The display shelves are managed HERE, in the SLABS
          section (the picker moved off the Library page,
          Anthony, Nov 5, 2026). */}
      <SlabsPicker />

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="SLABS areas"
      >
        {COMICS_AREAS.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-pressed={area === a.key}
            onClick={() => pickArea(a.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              area === a.key
                ? "bg-[var(--gold)] font-bold text-black"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {area === "wall" ? (
        <section aria-label="Cover Wall" className="mt-5">
          <h2 className="font-album text-lg text-[var(--text)]">Cover Wall</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Every cover, wall to wall. Tap one to see the slab up close.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {COMICS.map((comic) => (
              <button
                key={comic.id}
                type="button"
                onClick={() => openComic(comic.id)}
                aria-label={`${comic.title} cover. View its details.`}
                className="block focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <img
                  src={comic.cover}
                  alt={`${comic.title} cover art`}
                  loading="lazy"
                  className="block aspect-[2/3] w-full rounded-[4px] object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      ) : area === "keys" ? (
        <section aria-label="Key Issues" className="mt-5">
          <h2 className="font-album text-lg text-[var(--text)]">Key Issues</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            The standouts in your slabs, and why — from your collection log.
          </p>
          <ol className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
            {KEY_ISSUES.map((entry, i) => {
              const comic = COMICS.find((c) => c.id === entry.id);
              if (!comic) return null;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => openComic(comic.id)}
                    aria-label={`${comic.title}. View its details.`}
                    className="flex w-full items-center gap-3 py-2.5 text-left focus:outline-none"
                  >
                    <img
                      src={comic.cover}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="aspect-[2/3] w-10 shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">
                        <span className="mr-1.5 text-[var(--dim)]">
                          {i + 1}.
                        </span>
                        {comic.title}
                      </span>
                      <span className="block text-xs leading-snug text-[var(--gold-soft)]">
                        {entry.reason}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-[var(--text)]">
                      ~{fmtUSD(comic.value, 0)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : area === "signed" ? (
        <section aria-label="Signed comics" className="mt-5">
          <h2 className="font-album text-lg text-[var(--text)]">Signed</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Your CGC Signature Series slabs — signed books, verified by CGC.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-4">
            {COMICS.filter((c) => c.label === "Signature Series").map(
              (comic) => (
                <ComicPocket key={comic.id} comic={comic} onOpen={openComic} />
              ),
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--dim)]">
            Aliens #1 is signed by Sigourney Weaver; Batman #136 is signed
            with a sketch by Tyler Kirkham. Both signatures are detailed on
            each slab&rsquo;s own page.
          </p>
        </section>
      ) : area === "cards" ? (
        <GradedCardsArea />
      ) : area === "wish" ? (
        <section aria-label="Wish List" className="mt-5">
          <h2 className="font-album text-lg text-[var(--text)]">Wish List</h2>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Books you&rsquo;re hunting, kept apart from the slabs you own.
          </p>
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--text)]">
              Nothing on your wish list yet
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[var(--dim)]">
              When you name a book you&rsquo;re after, it will sit here —
              nothing has been added, so nothing is shown.
            </p>
          </div>
        </section>
      ) : showPicker ? (
        <>
          {/* The collection itself, cover-forward — CLZ's Card View:
              big covers three across with the grade badge and KEY
              marker on the cover and title / publisher · date /
              value under each. This is the Slabs home now; grouping
              lives in the browse lists below it. */}
          <section aria-label="All comics" className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-album text-lg text-[var(--text)]">
                All Comics
              </h2>
              <div
                className="flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
                role="group"
                aria-label="Sort slabs"
              >
                {(
                  [
                    ["value", "Value"],
                    ["title", "Title"],
                    ["publisher", "Publisher"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      sort === key
                        ? "bg-[var(--gold)] font-bold text-black"
                        : "text-[var(--text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4">
              {sortedComics.map((comic) => (
                <ComicPocket
                  key={comic.id}
                  comic={comic}
                  onOpen={openComic}
                />
              ))}
            </div>
          </section>

          <ComicFolderLists onPick={pickGroup} />

          {/* Most Valuable Comics — the ranked-list pattern from Card
              Performance's Most Valuable Cards page. */}
          <section aria-label="Most valuable comics" className="mt-8">
            <h2 className="font-album text-lg text-[var(--text)]">
              Most Valuable Comics
            </h2>
            <ol className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3">
              {ranked.map((comic, i) => (
                <li key={comic.id}>
                  <button
                    type="button"
                    onClick={() => openComic(comic.id)}
                    aria-label={`${comic.title}, valued at about ${fmtUSD(comic.value, 0)}. View its details.`}
                    className="flex w-full items-center gap-3 py-2.5 text-left focus:outline-none"
                  >
                    <img
                      src={comic.cover}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="aspect-[2/3] w-10 shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text)]">
                        <span className="mr-1.5 text-[var(--dim)]">
                          {i + 1}.
                        </span>
                        {comic.title}
                      </span>
                      <span className="block truncate text-xs text-[var(--gold-soft)]">
                        {comic.publisher} · CGC {comic.label}
                      </span>
                      <span className="block text-xs text-[var(--dim)]">
                        Cert {comic.cert}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-[var(--text)]">
                        ~{fmtUSD(comic.value, 0)}
                      </span>
                      <span className="block text-xs text-[var(--dim)]">
                        CGC 9.8
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                // Three-back rule (Anthony, Nov 4, 2026): groups
                // replace the single app entry, so this always
                // flips state locally — the device Back exits.
                setShowPicker(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label="Back to SLABS group selection"
              className="rounded-full border border-[var(--accent)]/50 px-3.5 py-1.5 text-sm font-medium text-[var(--gold-soft)]"
            >
              ← All comics
            </button>
          </div>

          {group ? (
            <section aria-label={group.name} className="mt-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-album text-2xl leading-tight text-[var(--text)]">
                    {group.name}
                  </h2>
                  <p className="text-sm text-[var(--dim)]">
                    {group.comics.length} slab
                    {group.comics.length === 1 ? "" : "s"} ·{" "}
                    {fmtUSD(groupValue(group), 0)} total value — scroll to
                    see them all
                  </p>
                </div>
              </div>

              {/* One continuous shelf in the same cover-forward
                  grid as All Comics: 3 across on phone, 4 on wider
                  screens. */}
              <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4">
                {group.comics.map((comic) => (
                  <ComicPocket
                    key={comic.id}
                    comic={comic}
                    onOpen={openComic}
                  />
                ))}
              </div>
              <p className="mt-4 text-center font-album text-sm text-[var(--dim)]">
                End of {group.name} — {group.comics.length} slab
                {group.comics.length === 1 ? "" : "s"}
              </p>
            </section>
          ) : null}
        </>
      )}

      <footer className="mt-8 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--dim)]">
        Logged from your CGC label photos on Oct 29, 2026. Values were
        checked that day from eBay sold prices via PriceCharting, plus
        guide data — about $1,650 of the total sits in the two signature
        books, which have the thinnest sold data; the six unsigned books
        (~$320 combined) rest on real sales.
      </footer>

      {selected ? (
        <ComicSheet comic={selected} onClose={closeComic} />
      ) : null}
    </div>
  );
}
