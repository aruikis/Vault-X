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

export function ScanPillButton({ onScan }: { onScan: () => void }) {
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
      Scan a card
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
}: {
  inputId: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onScan?: () => void;
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
          placeholder={placeholder}
          className="h-[38px] w-full rounded-full border border-[var(--accent)]/60 bg-[var(--surface)] pl-10 pr-4 text-sm font-medium text-[var(--text)] placeholder:font-normal placeholder:text-[var(--dim)]"
        />
      </form>
      {onScan ? <ScanPillButton onScan={onScan} /> : null}
    </div>
  );
}
