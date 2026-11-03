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
import { Turntable } from "./turntable";
import { OwnedLocationBar } from "./whereItLives";
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
    <span aria-hidden="true" className="mx-auto flex h-[9px] w-[64px] items-stretch justify-center overflow-hidden">
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
        <span className="flex h-[24px] w-[34px] flex-col items-center justify-center rounded-[4px] bg-gradient-to-br from-[#f6dc7d] via-[#dfae35] to-[#c1912a] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-black/25">
          <span className="text-[4.5px] font-bold italic leading-none text-[#6b4e08]">
            Celebrity
          </span>
          <span className="text-[4.5px] font-bold italic leading-none text-[#6b4e08]">
            Authentics
          </span>
          <span className="mt-0.5 text-[5px] font-semibold leading-none tracking-wide text-black/80">
            C12447
          </span>
        </span>
      ) : null}
      <span
        className={`flex h-[38px] w-[30px] flex-col items-center justify-between overflow-hidden rounded-[5px] py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_2px_rgba(0,0,0,0.25)] ring-1 ring-black/30 ${
          isAliens
            ? "bg-gradient-to-br from-[#8fb4ec] via-[#5b84cc] to-[#3c63a8] text-white"
            : isSignature
              ? "bg-[linear-gradient(135deg,#e8ecf2_0%,#b9c1cf_30%,#eef1f6_52%,#a5aebd_74%,#dde3ec_100%)] text-[#39445a]"
              : "bg-[linear-gradient(135deg,#ffd76e_0%,#ff9d5c_22%,#ff7eb0_42%,#b48cff_62%,#6ee7a0_82%,#7cc7ff_100%)] text-white"
        }`}
      >
        {isAliens ? (
          <svg viewBox="0 0 24 24" className="h-[11px] w-[11px] fill-current opacity-90">
            <path d="M11 3h2v2.2l5.6 1.9-2.9 6.1a3.9 3.9 0 0 1-7.2 0l-.9-1.9H5.7l-.9 1.9a3.9 3.9 0 0 1-7.2 0L.7 7.1 6.3 5.2V4H4V2h7v1zm-4.8 4.4L4 12h4.4L6.2 7.4zm11.6 0L15.6 12H20l-2.2-4.6zM11 13h2v6h4v2H7v-2h4v-6z" transform="scale(0.92) translate(1 -1)" />
          </svg>
        ) : (
          <span className="h-[9px]" />
        )}
        <span
          className={`text-[9px] font-black leading-none tracking-tight ${
            isAliens || !isSignature
              ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
              : ""
          }`}
        >
          CGC
        </span>
        <span
          className={`block h-[5px] w-full ${
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
    text with the grade on the right. The label now follows the
    anatomy of his real CGC labels: a top banner naming the grade
    type (CGC UNIVERSAL GRADE in white on the dark blue band;
    CGC Signature SERIES in script on the gold band); the grade
    9.8 huge in a white rounded box on the LEFT with WHITE Pages
    under it (Aliens #1's older label instead prints WHITE Pages
    in the middle, like his photo); the title and publisher/date
    centered and bold; the signed and edition lines centered under
    them; the credits small at the bottom-left; the cert number
    centered over a drawn barcode; the label's right-side note
    beside it; the holographic CGC sticker at the right end (plus
    Aliens' gold Celebrity Authentics sticker); and the faint CGC
    watermark washed behind the middle, as printed. The band stays
    tight — about 15% of the slab, a real holder's proportions —
    with the molded ridge and seam under it separating the label
    compartment from the comic compartment, and the cover inset
    inside the case like a real holder. The flip view pairs this
    slab front with his real label close-up photo. */
function SlabFront({ comic }: { comic: Comic }) {
  const isSignature = comic.label === "Signature Series";
  const isAliens = comic.id === "aliens-1";
  const longTitle = comic.labelTitle.length > 24;
  return (
    <div
      className="relative rounded-[14px] bg-gradient-to-br from-white/40 via-white/10 to-white/25 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_6px_rgba(255,255,255,0.12)] ring-1 ring-white/50"
      aria-label={`${comic.title} shown as its CGC slab — a mock-up built from the real cover art and the real label details`}
      role="img"
    >
      <div className="overflow-hidden rounded-[7px] bg-[#0c0d12] shadow-[inset_0_2px_12px_rgba(0,0,0,0.85)]">
        {/* The CGC label, rebuilt to the real labels' layout (see
            the note above): pale blue body for Universal, pale
            gold-cream for Signature Series, black print throughout,
            in a slim compartment of its own. */}
        <div
          className={`relative overflow-hidden text-black ${
            isSignature
              ? "bg-gradient-to-b from-[#fbf3cd] via-[#f7e7a1] to-[#f1d67c]"
              : "bg-gradient-to-b from-[#c3d6f2] via-[#aec8ec] to-[#9dbde6]"
          }`}
        >
          {/* Top banner: the grade type, exactly where CGC prints
              it — white spaced caps on the dark blue band for
              Universal; CGC + script "Signature" + SERIES on the
              gold band for Signature Series. */}
          <div
            className={`flex items-center justify-center px-2 py-[3px] ${
              isSignature
                ? "bg-gradient-to-b from-[#eed887] via-[#e3c95c] to-[#d4af37] text-[#221a04]"
                : "bg-gradient-to-b from-[#3d6dc0] to-[#2c56a3] text-white"
            }`}
          >
            {isSignature ? (
              <p className="flex items-baseline gap-1.5 leading-none">
                <span className="text-[9px] font-black tracking-[0.08em]">CGC</span>
                <span className="font-serif text-[11px] font-bold italic leading-none">
                  Signature
                </span>
                <span className="text-[9px] font-black tracking-[0.22em]">SERIES</span>
              </p>
            ) : (
              <p className="text-[9px] font-bold leading-none tracking-[0.3em]">
                CGC&nbsp;UNIVERSAL&nbsp;GRADE
              </p>
            )}
          </div>
          {/* Watermark: the faint oversized CGC washed behind the
              label's middle, as printed on the real labels. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[22px] select-none text-center text-[44px] font-black tracking-tight text-white/25"
          >
            CGC
          </span>
          <div className="relative flex gap-1 px-1.5 pb-1.5 pt-1">
            {/* Grade box: white, rounded, full label height — 9.8
                huge with WHITE Pages under it. Aliens #1's older
                label carries no page line in the box (it prints
                WHITE Pages in the middle instead). */}
            <div
              className={`flex w-[48px] shrink-0 flex-col items-center justify-center self-stretch rounded-[7px] bg-white px-0.5 py-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)] ${
                isSignature
                  ? "border-b-[3px] border-[#d4af37]"
                  : "border-b-[3px] border-[#2c56a3]"
              }`}
            >
              <span className="text-[26px] font-black leading-none tracking-tight">
                9.8
              </span>
              {!isAliens ? (
                <span className="mt-1 text-[6px] font-bold leading-none">
                  WHITE <span className="font-semibold">Pages</span>
                </span>
              ) : null}
            </div>
            {/* Right of the grade box: the centered title block
                with the holographic sticker at its right on top,
                and below it — spanning the full remaining width,
                the way the real labels run their small print edge
                to edge — credits at the bottom-left, the cert
                number centered over its barcode, and the label's
                note at the bottom-right. */}
            <div className="relative flex min-w-0 flex-1 flex-col">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-center font-extrabold leading-[1.08] ${
                      longTitle ? "text-[10.5px]" : "text-[12px]"
                    }`}
                  >
                    {comic.labelTitle}
                  </p>
                  <p className="mt-px text-center text-[8px] font-bold leading-tight">
                    {comic.labelPublisher}, {comic.date}
                  </p>
                  {comic.labelSigned ? (
                    <p className="mt-px text-center text-[6px] font-semibold leading-tight">
                      {comic.labelSigned}
                    </p>
                  ) : null}
                  {isAliens ? (
                    <p className="mt-px text-center text-[7px] font-semibold italic leading-tight">
                      WHITE Pages
                    </p>
                  ) : null}
                  {comic.labelEdition ? (
                    <p className="mt-0.5 text-center text-[7px] font-bold leading-tight">
                      {comic.labelEdition}
                    </p>
                  ) : null}
                </div>
                <CgcHologram comic={comic} />
              </div>
              <div className="mt-auto flex items-end justify-between gap-1 pt-1">
                <div className="min-w-0">
                  {comic.labelLeftNote ? (
                    <p className="text-[6.3px] font-bold italic leading-[1.3]">
                      {comic.labelLeftNote}
                    </p>
                  ) : null}
                  {comic.labelCredits.map((line) => (
                    <p key={line} className="whitespace-nowrap text-[6.3px] leading-[1.3]">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="shrink-0 px-0.5 text-center">
                  <p className="text-[8.5px] font-medium leading-none tracking-[0.06em]">
                    {comic.cert}
                  </p>
                  <div className="mt-[3px]">
                    <CertBarcode cert={comic.cert} />
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  {comic.labelNote
                    ? comic.labelNote.map((line, i) => (
                        <p
                          key={line}
                          className={`whitespace-nowrap text-[6.3px] leading-[1.3] ${
                            i === 0 && comic.labelNote!.length > 1
                              ? "font-bold"
                              : ""
                          }`}
                        >
                          {line}
                        </p>
                      ))
                    : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* The molded ridge under the label compartment, then the
            cover inset inside the case — a real holder's seam and
            clear border around the book. */}
        <div
          aria-hidden="true"
          className="h-[5px] bg-gradient-to-b from-white/50 via-white/10 to-black/60 shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
        />
        <div className="p-1.5">
          <img
            src={comic.cover}
            alt=""
            className="block w-full select-none rounded-[3px]"
            draggable={false}
          />
        </div>
      </div>
      {/* Glassy slab reflections over the case. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[14px] bg-gradient-to-br from-white/25 via-transparent to-transparent"
      />
      <span aria-hidden="true" className="card-glare" />
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
function ComicSheet({
  comic,
  onClose,
}: {
  comic: Comic;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState<"slabfront" | "label">("slabfront");
  const [sheetTab, setSheetTab] = useState<"comic" | "performance">("comic");
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
            aria-label="Back to comics"
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
            <SlabFront comic={comic} />
          ) : (
            <div className="relative overflow-hidden rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
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
                Value over time
              </p>
              <div
                role="img"
                aria-label={`Chart of this comic's tracked value: one valuation so far, about ${fmtUSD(comic.value, 0)} checked ${COMICS_VALUE_CHECKED}.`}
              >
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

type ComicsArea = "slabs" | "wall" | "keys" | "signed" | "wish";

const COMICS_AREAS: { key: ComicsArea; label: string }[] = [
  { key: "slabs", label: "Slabs" },
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
export function ComicsPanel() {
  // Comics areas (Anthony approved the researched CLZ-style areas,
  // Nov 2, 2026): Slabs (the binder itself), Cover Wall, Key Issues,
  // Signed, and Wish List — switched by the pill row, one page each,
  // like Social's areas.
  const [area, setArea] = useState<ComicsArea>("slabs");
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(true);
  // True while a comics group entry ({ mcView: "comics", comicsGroup })
  // is the current history entry — kept in sync by pickGroup and the
  // history listener below, so "← All comics" knows whether it can
  // step back through history or should just flip state locally.
  const groupPushedRef = useRef(false);
  // Area switches and group drill-ins are navigation steps (whole-app
  // back-gesture fix): each pushes a history entry carrying the
  // Comics navigation snapshot, and this listener syncs the panel
  // from whatever entry Back lands on — a Comics entry restores its
  // area/group (the plain Comics entry means Slabs + the group
  // picker), and pops landing on overlay entries (no mcView, e.g. the
  // comic sheet's own entry) are left to those overlays' traps. It
  // also runs once on mount, so returning to Comics via Back
  // restores the area/group its entry names.
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
        groupPushedRef.current = true;
        setGroupKey(st.comicsGroup);
        setShowPicker(false);
      } else {
        groupPushedRef.current = false;
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
    try {
      window.history.pushState(
        {
          mcView: "comics",
          comicsArea: key,
          ...(!showPicker && groupKey ? { comicsGroup: groupKey } : {}),
        },
        "",
      );
    } catch {
      // History unavailable: the area still switched.
    }
  };
  const group: ComicGroup | undefined = COMIC_GROUPS.find(
    (g) => g.key === groupKey,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheetPushedRef = useRef(false);
  const selected: Comic | undefined = COMICS.find((c) => c.id === selectedId);
  const openComic = (id: string) => {
    if (selectedId === id) return;
    setSelectedId(id);
    try {
      if (sheetPushedRef.current) {
        window.history.replaceState({ comicsSheet: id }, "");
      } else {
        window.history.pushState({ comicsSheet: id }, "");
        sheetPushedRef.current = true;
      }
    } catch {
      sheetPushedRef.current = false;
    }
  };
  const closeComic = () => {
    if (sheetPushedRef.current) {
      window.history.back();
    } else {
      setSelectedId(null);
    }
  };
  useEffect(() => {
    const onPopState = () => {
      if (sheetPushedRef.current) {
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
    // Drilling into a group is a navigation step: push one history
    // entry, so Back returns to the group-selection screen instead
    // of leaving the app.
    try {
      window.history.pushState(
        { mcView: "comics", comicsArea: "slabs", comicsGroup: key },
        "",
      );
      groupPushedRef.current = true;
    } catch {
      groupPushedRef.current = false;
    }
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
        Graded Comics
      </h1>
      <p className="mt-1 text-sm text-[var(--dim)]">
        Your graded comics, covers first — tap any cover to see the slab
        up close.
      </p>

      {/* Collection statistics strip — the CLZ Statistics pattern:
          the collection's headline numbers as three tidy stat
          blocks (slabs, total value, key issues), replacing the old
          always-full progress bar. */}
      <section
        aria-label="Comics collection summary"
        className="mt-4 grid grid-cols-3 gap-3"
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <p className="font-album text-2xl font-bold text-[var(--text)]">
            {COMICS.length}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dim)]">
            Slabs
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

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Comics areas"
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
          <section aria-label="All slabs" className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-album text-lg text-[var(--text)]">
                All Slabs
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
                // Step back through history when the group was opened
                // with a push (the history listener restores the
                // picker); otherwise just flip state locally.
                if (groupPushedRef.current) {
                  window.history.back();
                } else {
                  setShowPicker(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              aria-label="Back to comics group selection"
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
                  grid as All Slabs: 3 across on phone, 4 on wider
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
