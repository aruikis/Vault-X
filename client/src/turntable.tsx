import {
useRef,
useState,
type PointerEvent as ReactPointerEvent,
type ReactNode,
} from "react";

/** The floating turntable stage (Anthony's standing presentation
    rule, Nov 2, 2026): EVERY catalog item with a photo — Lorcana
    cards, sealed products, graded comics, and future item types —
    floats above its pedestal on its detail view, gently swaying
    back and forth, and can be turned by hand (drag sideways or the
    left/right arrow keys). Pure CSS 3D transforms over the item's
    own photo: no video, no extra downloads, nothing added to the
    on-device cache, and the sway respects prefers-reduced-motion
    via the .card-* classes in theme.css. */
export function Turntable({
  label,
  floatClassName,
  children,
}: {
  /** Accessible description of the stage, including how to turn it. */
  label: string;
  /** Width classes for the floating frame, e.g. "w-72 max-w-full sm:w-80". */
  floatClassName: string;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState<{ ry: number; rx: number } | null>(
    null,
  );
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const clampTurn = (ry: number, rx: number) => ({
    ry: Math.max(-52, Math.min(52, ry)),
    rx: Math.max(-8, Math.min(16, rx)),
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; move/up on the element still work.
    }
    setDrag({ ry: 0, rx: 5 });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    setDrag(
      clampTurn(
        (e.clientX - start.x) * 0.45,
        5 - (e.clientY - start.y) * 0.22,
      ),
    );
  };
  const endDrag = () => {
    startRef.current = null;
    setDrag(null);
  };

  return (
    <div
      className="card-stage"
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onBlur={() => setDrag(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const step = e.key === "ArrowRight" ? 9 : -9;
        setDrag((prev) =>
          clampTurn((prev?.ry ?? 0) + step, prev?.rx ?? 5),
        );
      }}
    >
      <div className={`card-float ${floatClassName}`}>
        <div
          className={`card-turn ${drag ? "is-drag" : ""}`}
          style={
            drag
              ? {
                  transform: `rotateX(${drag.rx}deg) rotateY(${drag.ry}deg)`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
      <div className="card-pedestal" aria-hidden="true" />
      <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--dim)]">
        Drag to turn
      </p>
    </div>
  );
}
