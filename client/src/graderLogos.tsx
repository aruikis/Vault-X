// The official logos of the five grading companies Vault X slab
// scanning supports (Anthony, Nov 5, 2026: the Search tab's "We
// support:" row). These are the companies' real logos, used as
// served by their own sites — never redrawn. Presentation is
// Anthony's approved mockup Option 3 (Nov 5, 2026): the marks
// stand directly on the app's dark background in bright,
// readable editions with a soft colored spotlight glow pooled
// under each one — see GraderSupportRow below:
//   PSA     — official SVG from psacard.com brand assets
//             (psacard.com/psa/images/brand/favicons/psa-favicon.svg)
//   SGC     — official SVG from gosgc.com (gosgc.com/assets/img/logo.svg)
//   CGC     — official CGC Cards SVG served as the cgccards.uk site
//             header logo
//   Beckett — Beckett's current official wordmark, taken from
//             beckett.com's own site header asset
//             (beckett.com/_next/static/media/beckett.eed9cbf2.png,
//             512x134) and keyed to its light edition (white on
//             transparent) for the dark background, the same
//             treatment the other dark marks get. It replaces
//             the old 103px Beckett Media emblem (Nov 5, 2026:
//             Anthony reported it BLURRY — it was a tiny raster
//             stretched into the row; this wordmark is five
//             times its width and renders tack sharp).
//   TAG     — official logo PNG from TAG's own store CDN
//             (taggrading.com/cdn/shop/files/TAG_Logo_Official__NoText_Black_Outlined_260x.png)
// The SVGs and the Beckett PNG ship as bundled asset files; the
// TAG PNG rides as a data URI so its bytes stay owned either way.

import psaLogo from "./assets/graders/psa.svg";
import sgcLogo from "./assets/graders/sgc.svg";
import cgcLogo from "./assets/graders/cgc.svg";
import beckettLogo from "./assets/graders/beckett.png";

const tagLogo =
  "data:image/png;base64," +
  "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";

export const GRADER_LOGOS: { name: string; src: string }[] = [
  { name: "PSA", src: psaLogo },
  { name: "Beckett (BGS)", src: beckettLogo },
  { name: "SGC", src: sgcLogo },
  { name: "CGC Cards", src: cgcLogo },
  { name: "TAG", src: tagLogo },
];

/** The spotlight pool under each logo in the support row:
    a soft ellipse of the brand's own color(s) lying on the
    dark background beneath the mark, like a little stage
    light — PSA's pool blends its red and its blue, the two
    colors of its mark. */
const GRADER_GLOWS: Record<string, string> = {
  PSA:
    "radial-gradient(ellipse 55% 100% at 26% 50%, rgba(238,4,3,0.55), transparent 70%), " +
    "radial-gradient(ellipse 55% 100% at 76% 50%, rgba(38,92,220,0.55), transparent 70%)",
  "Beckett (BGS)":
    "radial-gradient(ellipse 70% 100% at 50% 50%, rgba(64,156,255,0.50), transparent 70%)",
  SGC: "radial-gradient(ellipse 70% 100% at 50% 50%, rgba(150,96,255,0.50), transparent 70%)",
  "CGC Cards":
    "radial-gradient(ellipse 70% 100% at 50% 50%, rgba(255,84,112,0.48), transparent 70%)",
  TAG: "radial-gradient(ellipse 70% 100% at 50% 50%, rgba(164,110,255,0.50), transparent 70%)",
};

/** Marks whose official artwork is a single dark colorway
    (SGC near-black, CGC red, TAG black) render in their
    light edition here — the same artwork, shown white, the
    way these companies themselves print the mark on dark
    material. Beckett's wordmark asset already ships in its
    white edition (see the header note), so it needs no
    filter. PSA is NOT in this set (Anthony's Option 3,
    re-confirmed Nov 5, 2026 after he reported the row still
    did not match the mockup): PSA keeps its official color
    — the mark renders exactly as PSA's own brand asset
    ships it, never whitened. */
const LIGHT_EDITION = new Set(["SGC", "CGC Cards", "TAG"]);

/** The Search tab's "We support:" row (Anthony, Nov 5, 2026):
    the five grading companies' real logos in one clean row at
    the very bottom of the Search tab.
    FINAL PRESENTATION — MOCKUP OPTION 3, picked and approved
    by Anthony on Nov 5, 2026 after on-device review of three
    mockups (superseding the light backing plates of v1.98.3,
    which he judged a light format, not a dark one, and the
    Option 2 gunmetal pill he picked first and then replaced
    with this one): NO tiles, NO bar, NO light background of
    any kind. The five marks stand directly on the app's dark
    background in bright, readable editions — the dark
    single-color marks in their white edition (see
    LIGHT_EDITION above) — each with a soft colored spotlight
    glow pooled underneath it, PSA's glow carrying its red
    and blue. The artwork files remain the companies' own,
    never redrawn.
    SIZE + CENTERING (Anthony, Nov 5, 2026 — re-reported
    the same day: the row STILL did not match the mockup.
    The equal-HEIGHT pass was not enough: at one shared
    height the wide wordmarks (Beckett ~99px) dwarfed the
    compact marks (PSA's square mark at 26px), so the five
    still read at five different sizes, and PSA rendered
    WHITE under the light-edition filter, losing the
    official color the mockup keeps). FINAL FORM: every
    logo stands in the SAME fixed slot — one width, one
    height (the TAG footprint) — with its artwork contained
    inside it, centered both ways, so all five carry the
    exact same size and visual weight; the row is a single
    no-wrap line of identical slots with one even gap,
    centered as a group; PSA renders in its official
    color; the dark single-color marks render in their
    white edition; Beckett's sharp 512px wordmark ships in
    its white edition; and each slot pools its brand glow
    directly underneath its logo. */
export function GraderSupportRow() {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-xs font-semibold tracking-wide text-[var(--dim)]">
        We support:
      </p>
      <div className="flex items-start justify-center gap-2 px-1 pb-2">
        {GRADER_LOGOS.map((logo) => (
          <span
            key={logo.name}
            className="relative flex h-[52px] w-[68px] shrink-0 flex-col items-center"
          >
            <span className="flex h-[34px] w-full items-center justify-center">
              <img
                src={logo.src}
                alt={`${logo.name} logo`}
                className={`max-h-full max-w-full object-contain ${
                  LIGHT_EDITION.has(logo.name)
                    ? "[filter:brightness(0)_invert(1)]"
                    : ""
                }`}
                draggable={false}
              />
            </span>
            <span
              aria-hidden="true"
              className="mt-[3px] h-[10px] w-[54px] shrink-0 rounded-full blur-[6px]"
              style={{ background: GRADER_GLOWS[logo.name] }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
