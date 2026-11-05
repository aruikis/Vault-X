// Search + Scan top row for the collection sections
// (Anthony, Nov 3, 2026, ~11:14 PM): the Lorcana chapters
// page is the model — a search bar spanning the width to
// the LEFT of the Scan pill, both pieces in the Scan pill's
// own theme (full pill shape, accent border, gold-soft ink)
// so the two read as a matched pair on one row. The search
// bar carries a magnifier drawn in the same 1.8-stroke
// family as the Scan pill's camera glyph. Every collection
// section renders this same row and wires the bar to its
// OWN catalog search; the Scan pill opens the app's card
// scanner.
//
// FOCUS FLASH FIX (Anthony, Nov 5, 2026, on-device in
// Funko Pop, reproducible every tap): tapping the search
// field brought the keyboard up but ALSO flashed a screen
// of something he could not make out. The field itself has
// no focus behavior — nothing in this row (or in the
// panels consuming it) changes state, view, or scroll on
// focus. The flash was the browser's own tap response: on
// focus, the mobile browser scrolls the page so the field
// sits above the rising keyboard, and on a long page that
// animated scroll paints the stretch of page it travels
// across for a few frames — a full-screen flash of the
// content between the old and new scroll positions. The
// fix takes over the tap: when the field is not already
// focused, the press is claimed in onPointerDown and the
// field is focused with preventScroll, so the page never
// moves at all — the tap does exactly two things, focus
// the field and open the keyboard. This row is the ONE
// in-section search field shared by every collection
// section (Lorcana chapters, Comics, and every GamePanel —
// Pokémon, Magic, Star Wars Unlimited, Funko, Lego, and
// all the Topps sports / Alternate Universe catalogs all
// render this same component), so the fix and the audit
// cover them all at once: there is no other in-section
// search input in those sections to flash.

export function ScanPillButton({
  onScan,
  label = "Scan a card",
}: {
  onScan: () => void;
  /** What the pill says: card sections scan cards; the
      Funko section scans a box barcode instead (Anthony,
      Nov 4, 2026), so its pill reads "Scan barcode". */
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onScan}
      className="flex h-[38px] shrink-0 items-center gap-2 rounded-full border border-[var(--accent)]/60 px-3.5 text-sm font-semibold text-[var(--gold-soft)]"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4.5 w-4.5 shrink-0"
        aria-hidden="true"
      >
        <path d="M4 8h2.2l1.6-2.4A1 1 0 0 1 8.6 5h6.8a1 1 0 0 1 .8.6L17.8 8H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13.5" r="3.4" />
      </svg>
      {label}
    </button>
  );
}

export function SearchScanRow({
  inputId,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onScan,
  scanLabel,
}: {
  inputId: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onScan?: () => void;
  scanLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <form
        className="relative min-w-0 flex-1"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[var(--gold-soft)]"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPointerDown={(e) => {
            // Focus flash fix (see the file header): claim
            // the press and focus WITHOUT the browser's
            // scroll-into-view, so tapping the field never
            // scrolls or repaints the page — it only focuses
            // the field and opens the keyboard. A press on
            // the already-focused field (placing the cursor,
            // selecting text) is left completely alone.
            if (document.activeElement !== e.currentTarget) {
              e.preventDefault();
              e.currentTarget.focus({ preventScroll: true });
            }
          }}
          placeholder={placeholder}
          className="h-[38px] w-full rounded-full border border-[var(--accent)]/60 bg-[var(--surface)] pl-10 pr-4 text-sm font-medium text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
        />
      </form>
      {onScan ? <ScanPillButton onScan={onScan} label={scanLabel} /> : null}
    </div>
  );
}
