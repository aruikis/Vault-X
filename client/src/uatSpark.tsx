// The UAT graph, verbatim (Anthony, Nov 5, 2026 — exact-match
// correction): when he reviewed the landed New Vision 2.0 Beta
// theme he said even the graph was different from the UAT and
// directed "I want it to look exactly like how you had it in
// the UAT." The UAT (vault-x-uat-jarvis-vision-not-live) drew
// every value graph with ONE component — Spark: a bare SVG
// polyline, no fill under the line, no grid, no axes, no dots,
// no tooltip. Its recipe, copied exactly:
//   viewBox width 260, the points normalized with 3px of
//   headroom top and bottom (the (h - 6) - 3 mapping below),
//   stroke = the UAT's second accent, cyan #22d3ee
//   (--accent2 in the UAT's vault theme), strokeWidth 2.5,
//   strokeLinejoin round, preserveAspectRatio "none",
//   width 100%, and the height is the caller's: 44 in the UAT
//   Home hero, 64 in the UAT Portfolio hero, 56 in the UAT
//   card detail's Price history.
// Under New Vision 2.0 Beta the live app's value graphs render
// through this component on the collection's REAL tracked
// points; every other theme keeps its Recharts area charts.
// The only deviation from the UAT source: the UAT only ever
// had 7–9 sample points, so it never handled fewer than two —
// a single tracked point (a graded comic's one valuation)
// draws as a flat line at its own level, and zero points
// render an empty plot of the same height (callers show their
// own honest empty states).

import { useEffect, useState } from "react";

/** True while the New Vision presentation should render:
    the New Vision 2.0 Beta theme (data-theme "jarvis") is
    active, OR the New Vision LAYOUT is picked (data-layout
    "vision"). Since Nov 10, 2026 the layout is its own
    per-user choice in Settings, separate from the theme
    (Anthony's model: multiple layouts AND multiple themes);
    the Beta theme bundles the layout as it always has, so
    this follows either attribute live through a
    MutationObserver and any component can take the Vision
    presentation without threading both choices through
    every prop chain. */
export function useJarvisVision(): boolean {
  const [jarvis, setJarvis] = useState<boolean>(() => {
    try {
      return (
        document.documentElement.dataset.theme === "jarvis" ||
        document.documentElement.dataset.layout === "vision"
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const read = () => {
      try {
        setJarvis(
          document.documentElement.dataset.theme === "jarvis" ||
            document.documentElement.dataset.layout === "vision",
        );
      } catch {
        // No document: keep the last known value.
      }
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-layout"],
    });
    return () => observer.disconnect();
  }, []);
  return jarvis;
}

export function UatSpark({
  points,
  h = 44,
}: {
  points: number[];
  h?: number;
}) {
  const w = 260;
  const color = "#22d3ee";
  if (points.length === 0) {
    return (
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      />
    );
  }
  const series = points.length === 1 ? [points[0]!, points[0]!] : points;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const pts = series
    .map(
      (p, i) =>
        `${(i / (series.length - 1)) * w},${h - ((p - min) / Math.max(1, max - min)) * (h - 6) - 3}`,
    )
    .join(" ");
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
