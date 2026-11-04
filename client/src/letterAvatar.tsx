/** The ONE letter avatar (Anthony, Nov 4, 2026): the Best
    Matches rendering is the standard, applied app-wide, so a
    letter avatar looks identical everywhere it appears — a
    circle with a white extra-bold letter; Jarvis's variant
    carries the blue radial glow ring from Best Matches, and
    everyone else sits on the plain accent fill, exactly as
    Best Matches renders them. Size/type scale ride in via
    className (the rendering — shape, colors, ring, weight —
    never varies). */
export function LetterAvatar({
  initial,
  jarvis = false,
  className = "",
}: {
  initial: string;
  jarvis?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${className}`}
      style={
        jarvis
          ? {
              background:
                "radial-gradient(circle at 32% 30%, #2c4a8f, #131c3f 68%)",
              border: "1.5px solid rgba(96,165,255,0.75)",
              boxShadow:
                "0 0 0 2px rgba(96,165,255,0.15), 0 0 12px rgba(79,140,255,0.5), inset 0 0 8px rgba(96,165,255,0.55)",
            }
          : { background: "var(--accent)" }
      }
    >
      {initial}
    </span>
  );
}
