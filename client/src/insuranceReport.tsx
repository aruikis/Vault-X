// Insurance & Estate report (Anthony, Nov 5, 2026 —
// "Absolutely install this"): one tap assembles the
// collection Vault X already tracks — photos, identification,
// grade/cert numbers for slabs, what was paid (Money Tracker
// cost basis; unknown stays "Not recorded", never invented),
// current value with its basis, quantity, and Where it lives
// — into a real downloadable PDF an insurer or Liz as
// executor could actually use. Generated entirely in the app
// from the getInsuranceReport action's rows plus the client
// comics catalog; the PDF writer below is a small dependency-
// free builder in the same spirit as exportCollection.ts
// (which hand-writes its XLSX the same way). Generation shows
// progress (items + photos) per the app-wide progress rule.

import { useEffect, useRef, useState } from "react";
import { api, type ApiResponse } from "./api";
import { COMICS } from "./comics";
import { deliverFile } from "./exportCollection";
import {
pushWindowState,
readNavState,
scrubWindowKeys,
} from "./historyNav";
import { hapticConfirm } from "./haptics";

type ReportData = ApiResponse<typeof api, "getInsuranceReport">;
type ServerRow = ReportData["rows"][number];

type PdfRow = {
  category: string;
  name: string;
  idLine: string;
  detail: string;
  qty: number;
  unitValue: number | null;
  unitPaid: number | null;
  location: string | null;
  /** Resolves a displayable image URL for the photo
      appendix, or null when this item has no photo source. */
  photo: (() => Promise<string | null>) | null;
};

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ------------------------------------------------------------------ */
/* Minimal PDF writer (PDF 1.4, Helvetica family, JPEG photos)         */
/* ------------------------------------------------------------------ */

function sanitizeText(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/·/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function esc(s: string): string {
  return sanitizeText(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function latin1Bytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

type PageImage = { name: string; jpeg: Uint8Array; w: number; h: number };

class PdfPage {
  ops: string[] = [];
  images: PageImage[] = [];
  private imgCount = 0;

  text(x: number, y: number, size: number, bold: boolean, s: string) {
    this.ops.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`,
    );
  }
  textRight(xRight: number, y: number, size: number, bold: boolean, s: string) {
    // Helvetica average advance ≈ 0.52em for mixed case; close
    // enough for column alignment in a generated report.
    const w = sanitizeText(s).length * size * 0.52;
    this.text(xRight - w, y, size, bold, s);
  }
  color(r: number, g: number, b: number) {
    this.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.ops.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  }
  line(x1: number, y1: number, x2: number, y2: number, width: number) {
    this.ops.push(
      `${width} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`,
    );
  }
  addImage(jpeg: Uint8Array, w: number, h: number): string {
    this.imgCount += 1;
    const name = `Im${this.imgCount}`;
    this.images.push({ name, jpeg, w, h });
    return name;
  }
  drawImage(name: string, x: number, y: number, w: number, h: number) {
    this.ops.push(
      `q ${w.toFixed(1)} 0 0 ${h.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} cm /${name} Do Q`,
    );
  }
}

function buildPdf(pages: PdfPage[]): Uint8Array {
  // Object plan: 1 = Catalog, 2 = Pages, then per page a Page
  // object + content stream, then all image XObjects.
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];
  let next = 3;
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(next++);
    contentObjNums.push(next++);
  }
  const imageObjNums = new Map<PageImage, number>();
  for (const p of pages) {
    for (const img of p.images) imageObjNums.set(img, next++);
  }
  const totalObjects = next - 1;

  const bytes: number[] = [];
  const push = (s: string) => {
    for (const b of latin1Bytes(s)) bytes.push(b);
  };
  const pushRaw = (u8: Uint8Array) => {
    for (const b of u8) bytes.push(b);
  };
  const offsets: number[] = new Array(totalObjects + 1).fill(0);
  const beginObj = (n: number) => {
    offsets[n] = bytes.length;
    push(`${n} 0 obj\n`);
  };

  push("%PDF-1.4\n");
  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObj(2);
  push(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] >>\nendobj\n`,
  );
  pages.forEach((p, i) => {
    const pageNum = pageObjNums[i]!;
    const contentNum = contentObjNums[i]!;
    const xobjects = p.images
      .map((img) => `/${img.name} ${imageObjNums.get(img)} 0 R`)
      .join(" ");
    beginObj(pageNum);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> >>${xobjects ? ` /XObject << ${xobjects} >>` : ""} >> /Contents ${contentNum} 0 R >>\nendobj\n`,
    );
    const content = p.ops.join("\n");
    beginObj(contentNum);
    push(`<< /Length ${latin1Bytes(content).length} >>\nstream\n`);
    push(content);
    push("\nendstream\nendobj\n");
  });
  for (const [img, num] of imageObjNums) {
    beginObj(num);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
    );
    pushRaw(img.jpeg);
    push("\nendstream\nendobj\n");
  }
  const xrefAt = bytes.length;
  push(`xref\n0 ${totalObjects + 1}\n`);
  push("0000000000 65535 f \n");
  for (let n = 1; n <= totalObjects; n++) {
    push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  );
  return new Uint8Array(bytes);
}

/** Fetch an image (same-origin asset, blob URL, or CORS-open
    remote) and re-encode it as a bounded JPEG for the PDF. */
async function toJpeg(
  url: string,
  maxDim = 440,
): Promise<{ jpeg: Uint8Array; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image failed"));
    });
    img.src = url;
    await loaded;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return null;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, w, h);
    ctx2d.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) return null;
    return { jpeg: new Uint8Array(await blob.arrayBuffer()), w, h };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Report layout                                                       */
/* ------------------------------------------------------------------ */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

type Progress = { phase: string; done: number; total: number };

async function generateReportPdf(opts: {
  includePhotos: boolean;
  includePaid: boolean;
  sealedPhotoFor: (name: string) => string | undefined;
  comicPhotoFor: (id: string) => string | undefined;
  onProgress: (p: Progress) => void;
}): Promise<{ blob: Blob; filename: string; itemCount: number; photoCount: number }> {
  opts.onProgress({ phase: "Loading your collection", done: 0, total: 1 });
  const data: ReportData = await api.getInsuranceReport({});

  const rows: PdfRow[] = data.rows.map((r: ServerRow) => ({
    category: r.category,
    name: r.name,
    idLine: r.idLine,
    detail: r.detail,
    qty: r.qty,
    unitValue: r.unitValue,
    unitPaid: r.unitPaid,
    location: r.location,
    photo:
      r.category === "Sealed products"
        ? async () => opts.sealedPhotoFor(r.name) ?? null
        : r.artCardId != null
          ? async () => {
              try {
                const { url } = await api.cardImage({ cardId: r.artCardId! });
                return url;
              } catch {
                return null;
              }
            }
          : r.imageUrl
            ? async () => r.imageUrl
            : null,
  }));
  // Graded comics live in the client catalog (the export
  // precedent): append them here with their checked values,
  // certs, and the server's storage locations.
  for (const c of COMICS) {
    rows.push({
      category: "Graded comics",
      name: c.title,
      idLine: `CGC ${c.label} 9.8 · Cert ${c.cert}`,
      detail: `${c.publisher} · ${c.variant}`,
      qty: 1,
      unitValue: c.value,
      unitPaid: null,
      location: data.comicLocations[c.id] ?? null,
      photo: async () => opts.comicPhotoFor(c.id) ?? null,
    });
  }
  const catRank = (c: string) =>
    c === "Lorcana cards" ? 0 : c === "Sealed products" ? 1 : c === "Graded comics" ? 90 : c === "Graded slabs" ? 91 : 50;
  rows.sort(
    (a, b) =>
      catRank(a.category) - catRank(b.category) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name),
  );

  const totalValue = rows.reduce((s, r) => s + (r.unitValue ?? 0) * r.qty, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.unitPaid ?? 0) * r.qty, 0);
  const totalCopies = rows.reduce((s, r) => s + r.qty, 0);
  const paidKnownCopies = rows.reduce((s, r) => s + (r.unitPaid != null ? r.qty : 0), 0);
  const untrackedValueItems = rows.filter((r) => r.unitValue == null).length;

  const categories: { name: string; rows: PdfRow[]; value: number; paid: number }[] = [];
  for (const r of rows) {
    let c = categories.find((x) => x.name === r.category);
    if (!c) {
      c = { name: r.category, rows: [], value: 0, paid: 0 };
      categories.push(c);
    }
    c.rows.push(r);
    c.value += (r.unitValue ?? 0) * r.qty;
    c.paid += (r.unitPaid ?? 0) * r.qty;
  }

  const reportDate = new Date(data.generatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const pages: PdfPage[] = [];
  const footer = (p: PdfPage, n: number) => {
    p.color(0.45, 0.45, 0.45);
    p.text(MARGIN, 30, 7.5, false, `Vault X - Insurance & Estate Report · Prepared ${reportDate} · Owner ${data.username} (${data.collectorCode})`);
    p.textRight(PAGE_W - MARGIN, 30, 7.5, false, `Page ${n}`);
    p.color(0, 0, 0);
  };

  /* Cover page */
  const cover = new PdfPage();
  cover.color(0.035, 0.05, 0.1);
  cover.fillRect(0, PAGE_H - 170, PAGE_W, 170);
  cover.color(0.62, 0.83, 0.76);
  cover.text(MARGIN, PAGE_H - 84, 13, false, "VAULT X");
  cover.color(1, 1, 1);
  cover.text(MARGIN, PAGE_H - 118, 27, true, "Insurance & Estate Report");
  cover.color(0.75, 0.8, 0.9);
  cover.text(MARGIN, PAGE_H - 142, 11.5, false, `Prepared ${reportDate} · Owner: ${data.username} · Collector ID: ${data.collectorCode}`);
  cover.color(0, 0, 0);
  let y = PAGE_H - 220;
  const stat = (label: string, value: string, x: number) => {
    cover.color(0.42, 0.42, 0.42);
    cover.text(x, y, 9, true, label.toUpperCase());
    cover.color(0, 0, 0);
    cover.text(x, y - 20, 17, true, value);
  };
  stat("Total value", money(totalValue), MARGIN);
  if (opts.includePaid) stat("Total paid (recorded)", money(totalPaid), MARGIN + 190);
  stat("Items (copies)", totalCopies.toLocaleString("en-US"), MARGIN + 380);
  y -= 62;
  cover.color(0.3, 0.3, 0.3);
  cover.text(MARGIN, y, 9.5, false, `Cost is recorded for ${paidKnownCopies.toLocaleString("en-US")} of ${totalCopies.toLocaleString("en-US")} copies; every other item lists its cost as Not recorded — nothing is estimated.`);
  if (untrackedValueItems > 0) {
    y -= 14;
    cover.text(MARGIN, y, 9.5, false, `${untrackedValueItems} item${untrackedValueItems === 1 ? "" : "s"} (graded slabs) carry no tracked market value and count at $0 in the totals.`);
  }
  y -= 30;
  cover.color(0, 0, 0);
  cover.text(MARGIN, y, 13, true, "Totals by category");
  y -= 8;
  for (const c of categories) {
    y -= 17;
    cover.line(MARGIN, y + 12, PAGE_W - MARGIN, y + 12, 0.4);
    cover.text(MARGIN, y, 10.5, false, c.name);
    if (opts.includePaid) {
      cover.color(0.35, 0.35, 0.35);
      cover.textRight(PAGE_W - MARGIN - 120, y, 10.5, false, `Paid ${money(c.paid)}`);
      cover.color(0, 0, 0);
    }
    cover.textRight(PAGE_W - MARGIN, y, 10.5, true, money(c.value));
  }
  y -= 34;
  cover.color(0.3, 0.3, 0.3);
  cover.text(MARGIN, y, 9.5, true, "How to read this report");
  y -= 15;
  const notes = [
    "Each item lists its identification (printed number, finish, or grading cert), quantity,",
    "what was paid where a cost is recorded, its current value, and where it lives.",
    "Values are the values Vault X tracks on the report date: Lorcana market values refresh",
    "daily from TCGplayer pricing; other catalogs use their published market prices as last",
    "imported; graded comic values are the checked values recorded in the app (Oct 29, 2026).",
    "Photos of the most valuable items with an available photo follow the item list.",
  ];
  for (const n of notes) {
    cover.text(MARGIN, y, 9.5, false, n);
    y -= 13;
  }
  pages.push(cover);

  /* Item pages */
  let page = new PdfPage();
  let py = PAGE_H - 64;
  const newItemPage = () => {
    pages.push(page);
    page = new PdfPage();
    py = PAGE_H - 64;
  };
  page.color(0, 0, 0);
  page.text(MARGIN, py, 15, true, "Item list");
  py -= 22;
  for (const c of categories) {
    if (py < 130) newItemPage();
    page.color(0.92, 0.93, 0.96);
    page.fillRect(MARGIN, py - 5, CONTENT_W, 19);
    page.color(0, 0, 0);
    page.text(MARGIN + 6, py, 11, true, c.name);
    page.textRight(PAGE_W - MARGIN - 6, py, 10, true, money(c.value));
    py -= 26;
    // Column heads
    page.color(0.45, 0.45, 0.45);
    page.text(MARGIN, py, 7.5, true, "ITEM");
    page.textRight(408, py, 7.5, true, "QTY");
    if (opts.includePaid) page.textRight(486, py, 7.5, true, "PAID");
    page.textRight(PAGE_W - MARGIN, py, 7.5, true, "VALUE");
    page.color(0, 0, 0);
    py -= 6;
    for (const r of c.rows) {
      if (py < 84) newItemPage();
      page.text(MARGIN, py, 9.5, true, truncate(r.name, 44));
      page.textRight(408, py, 9.5, false, String(r.qty));
      if (opts.includePaid) {
        page.textRight(486, py, 9.5, false, r.unitPaid != null ? money(r.unitPaid * r.qty) : "Not recorded");
      }
      page.textRight(PAGE_W - MARGIN, py, 9.5, false, r.unitValue != null ? money(r.unitValue * r.qty) : "Not tracked");
      py -= 11;
      page.color(0.38, 0.38, 0.38);
      const sub = `${r.idLine}${r.detail ? ` · ${r.detail}` : ""} · ${r.location ? `Where it lives: ${r.location}` : "Location not recorded"}`;
      page.text(MARGIN, py, 8, false, truncate(sub, 96));
      page.color(0, 0, 0);
      py -= 15;
    }
    py -= 10;
  }
  pages.push(page);

  /* Photo appendix — the most valuable items first, capped so
     the file stays emailable; the cover notes the count. */
  let photoCount = 0;
  if (opts.includePhotos) {
    const candidates = rows
      .filter((r) => r.photo != null)
      .sort((a, b) => (b.unitValue ?? 0) * b.qty - (a.unitValue ?? 0) * a.qty)
      .slice(0, 48);
    const prepared: { row: PdfRow; img: { jpeg: Uint8Array; w: number; h: number } }[] = [];
    for (let i = 0; i < candidates.length; i++) {
      opts.onProgress({ phase: "Preparing photos", done: i, total: candidates.length });
      const url = await candidates[i]!.photo!().catch(() => null);
      if (!url) continue;
      const img = await toJpeg(url);
      if (img) prepared.push({ row: candidates[i]!, img });
    }
    photoCount = prepared.length;
    if (prepared.length > 0) {
      let ap = new PdfPage();
      let ay = PAGE_H - 64;
      ap.text(MARGIN, ay, 15, true, "Item photos");
      ay -= 18;
      ap.color(0.38, 0.38, 0.38);
      ap.text(MARGIN, ay, 9.5, false, "The most valuable items with a photo on file, most valuable first.");
      ap.color(0, 0, 0);
      ay -= 14;
      let col = 0;
      for (const p of prepared) {
        if (ay < 300) {
          pages.push(ap);
          ap = new PdfPage();
          ay = PAGE_H - 64;
          col = 0;
        }
        const cellX = MARGIN + col * (CONTENT_W / 2 + 6);
        const cellW = CONTENT_W / 2 - 6;
        const scale = Math.min(cellW / p.img.w, 218 / p.img.h);
        const dw = p.img.w * scale;
        const dh = p.img.h * scale;
        const name = ap.addImage(p.img.jpeg, p.img.w, p.img.h);
        ap.drawImage(name, cellX + (cellW - dw) / 2, ay - dh, dw, dh);
        ap.text(cellX, ay - dh - 13, 8.5, true, truncate(p.row.name, 40));
        ap.color(0.38, 0.38, 0.38);
        ap.text(cellX, ay - dh - 24, 8, false, truncate(`${p.row.idLine} · ${money((p.row.unitValue ?? 0) * p.row.qty)}`, 44));
        ap.color(0, 0, 0);
        col += 1;
        if (col === 2) {
          col = 0;
          ay -= 262;
        }
      }
      pages.push(ap);
    }
  }

  opts.onProgress({ phase: "Building the PDF", done: 1, total: 1 });
  pages.forEach((p, i) => footer(p, i + 1));
  const bytes = buildPdf(pages);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
    filename: `vault-x-insurance-report-${stamp}.pdf`,
    itemCount: totalCopies,
    photoCount,
  };
}

/* ------------------------------------------------------------------ */
/* Button + generation sheet                                           */
/* ------------------------------------------------------------------ */

export function InsuranceReportButton({
  sealedPhotoFor,
  comicPhotoFor,
  buttonClassName,
}: {
  sealedPhotoFor: (name: string) => string | undefined;
  comicPhotoFor: (id: string) => string | undefined;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pushedRef = useRef(false);
  const heldRef = useRef(false);

  const openSheet = () => {
    setOpen(true);
    pushedRef.current = pushWindowState(
      { ...(readNavState() ?? {}), lorcanaInsurance: true },
      "lorcanaInsurance",
    );
    heldRef.current = true;
  };
  const closeSheet = () => {
    if (pushedRef.current) {
      window.history.back();
    } else {
      heldRef.current = false;
      scrubWindowKeys(["lorcanaInsurance"]);
      setOpen(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    const onPopState = () => {
      if (heldRef.current && readNavState()?.lorcanaInsurance !== true) {
        heldRef.current = false;
        pushedRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open ]);

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="Generate the Insurance and Estate PDF report"
        className={
          buttonClassName ??
          "rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--gold-soft)]"
        }
      >
        Insurance &amp; Estate PDF
      </button>
      {open ? (
        <InsuranceReportSheet
          sealedPhotoFor={sealedPhotoFor}
          comicPhotoFor={comicPhotoFor}
          onClose={closeSheet}
        />
      ) : null}
    </>
  );
}

function InsuranceReportSheet({
  sealedPhotoFor,
  comicPhotoFor,
  onClose,
}: {
  sealedPhotoFor: (name: string) => string | undefined;
  comicPhotoFor: (id: string) => string | undefined;
  onClose: () => void;
}) {
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includePaid, setIncludePaid] = useState(true);
  const [state, setState] = useState<
    | { phase: "idle" }
    | { phase: "working"; progress: Progress }
    | { phase: "done"; filename: string; items: number; photos: number; outcome: string }
    | { phase: "error" }
  >({ phase: "idle" });

  const generate = async () => {
    if (state.phase === "working") return;
    setState({ phase: "working", progress: { phase: "Starting", done: 0, total: 1 } });
    try {
      const result = await generateReportPdf({
        includePhotos,
        includePaid,
        sealedPhotoFor,
        comicPhotoFor,
        onProgress: (progress) => setState({ phase: "working", progress }),
      });
      const outcome = await deliverFile(result.blob, result.filename);
      if (outcome === "aborted") {
        setState({ phase: "idle" });
        return;
      }
      hapticConfirm();
      setState({
        phase: "done",
        filename: result.filename,
        items: result.itemCount,
        photos: result.photoCount,
        outcome,
      });
    } catch {
      setState({ phase: "error" });
    }
  };

  const pct =
    state.phase === "working"
      ? Math.max(
          4,
          Math.min(
            100,
            Math.round(
              (state.progress.done / Math.max(1, state.progress.total)) * 100,
            ),
          ),
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Insurance and Estate report"
    >
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-10 items-center gap-0.5 rounded-full bg-white/[0.07] py-0 pr-3.5 pl-2 text-sm font-semibold text-[var(--text)] ring-1 ring-white/15 transition active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M14.5 5.5 8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <h2 className="font-album mt-5 text-2xl text-[var(--text)]">
          Insurance &amp; Estate Report
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--dim)]">
          One PDF of everything in your vault: every item&rsquo;s
          identification (printed number, finish, or grading cert),
          quantity, what you paid where it&rsquo;s recorded, its
          current value, and where it lives — with your name,
          Collector ID, and today&rsquo;s date on the cover. Built
          for an insurer after a fire, flood, or theft, and as an
          estate record for family.
        </p>

        <div className="mt-5 space-y-2.5">
          {(
            [
              [
                includePhotos,
                setIncludePhotos,
                "Include photos",
                "Photos of your most valuable items (up to 48) are appended — makes the file larger and a claim far stronger.",
              ],
              [
                includePaid,
                setIncludePaid,
                "Include what I paid",
                "Shows your recorded cost next to current value — useful for estate records. Costs that were never recorded stay listed as Not recorded.",
              ],
            ] as const
          ).map(([on, setOn, label, hint]) => (
            <button
              key={label}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={label}
              onClick={() => setOn(!on)}
              className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-[var(--text)]">
                  {label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--dim)]">
                  {hint}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                  on ? "bg-[var(--accent)]" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    on ? "left-[1.375rem]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          ))}
        </div>

        {state.phase === "working" ? (
          <div className="mt-6" role="status" aria-label="Report generation progress">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-[var(--text)]">
                {state.progress.phase}
                {state.progress.total > 1
                  ? ` — ${state.progress.done} of ${state.progress.total}`
                  : ""}
              </span>
              <span className="tabular-nums text-[var(--dim)]">{pct}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}

        {state.phase === "done" ? (
          <p className="mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3.5 py-3 text-sm leading-relaxed text-[var(--text)]" role="status">
            {state.outcome === "shared"
              ? `Sent — if you picked "Save to Files", ${state.filename} is on your phone now.`
              : `Download started — look for ${state.filename} in your downloads.`}{" "}
            It covers {state.items.toLocaleString("en-US")} items
            {state.photos > 0
              ? ` with ${state.photos} item photos appended.`
              : "."}
          </p>
        ) : null}
        {state.phase === "error" ? (
          <p className="mt-5 rounded-2xl border border-red-400/40 bg-red-400/10 px-3.5 py-3 text-sm text-[var(--text)]" role="alert">
            The report didn&rsquo;t go through. Check your connection
            and tap Generate again.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void generate()}
          disabled={state.phase === "working"}
          className="mt-6 w-full rounded-full bg-[var(--accent)] px-4 py-3 text-base font-bold text-[var(--on-accent)] disabled:opacity-60"
        >
          {state.phase === "working" ? "Generating…" : "Generate PDF"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-[var(--dim)]">
          The report is generated on this device from your live
          collection — nothing is uploaded anywhere new.
        </p>
      </div>
    </div>
  );
}
