// Collection export (Settings > Your data & backups, Nov 2, 2026):
// builds the user's full collection — every owned card by finish,
// every sealed product, every graded comic — as a CSV, a real
// Excel .xlsx, or JSON file, generated entirely in the app. The
// export is the backup a user keeps themselves, so the builders
// here are deliberately dependency-free: the CSV and JSON are
// plain text, and the XLSX is a minimal Office Open XML package
// (stored-zip) written by hand below — no library, no network.

export type ExportRow = {
  type: string;
  name: string;
  setOrPublisher: string;
  number: string;
  finishOrLabel: string;
  rarity: string;
  qty: number;
  unitValue: number | null;
  unitPaid: number | null;
  cert: string;
};

export const EXPORT_HEADERS = [
  "Type",
  "Name",
  "Set / Publisher",
  "Number",
  "Finish / Label",
  "Rarity",
  "Qty",
  "Unit Value (USD)",
  "Unit Paid (USD)",
  "Total Value (USD)",
  "CGC Cert",
] as const;

function rowValues(row: ExportRow): (string | number | null)[] {
  return [
    row.type,
    row.name,
    row.setOrPublisher,
    row.number,
    row.finishOrLabel,
    row.rarity,
    row.qty,
    row.unitValue,
    row.unitPaid,
    row.unitValue != null ? Math.round(row.unitValue * row.qty * 100) / 100 : null,
    row.cert,
  ];
}

function csvEscape(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function collectionToCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_HEADERS.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(rowValues(row).map(csvEscape).join(","));
  }
  // CRLF line endings + a BOM so Excel reads UTF-8 names correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function collectionToJson(rows: ExportRow[], exportedAt: string): string {
  return JSON.stringify(
    {
      app: "Vault X",
      exportedAt,
      itemCount: rows.reduce((s, r) => s + r.qty, 0),
      items: rows.map((r) => ({
        type: r.type,
        name: r.name,
        setOrPublisher: r.setOrPublisher,
        number: r.number,
        finishOrLabel: r.finishOrLabel,
        rarity: r.rarity,
        qty: r.qty,
        unitValue: r.unitValue,
        unitPaid: r.unitPaid,
        totalValue:
          r.unitValue != null
            ? Math.round(r.unitValue * r.qty * 100) / 100
            : null,
        cert: r.cert,
      })),
    },
    null,
    2,
  );
}

// --- Minimal XLSX writer (stored zip, no compression) ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  // Fixed DOS date (2026-01-01) — the zip metadata date is not data.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 filenames
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, file.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, file.data.length, true);
    cd.setUint32(24, file.data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + file.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let pos = 0;
  for (const chunk of [...chunks, ...central, new Uint8Array(eocd.buffer)]) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnRef(index: number): string {
  let n = index + 1;
  let ref = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    ref = String.fromCharCode(65 + rem) + ref;
    n = Math.floor((n - 1) / 26);
  }
  return ref;
}

export function collectionToXlsx(rows: ExportRow[]): Uint8Array {
  // Shared strings across every cell.
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();
  const sIdx = (s: string): number => {
    const found = sharedIndex.get(s);
    if (found != null) return found;
    const idx = shared.length;
    shared.push(s);
    sharedIndex.set(s, idx);
    return idx;
  };
  const allRows: (string | number | null)[][] = [
    [...EXPORT_HEADERS],
    ...rows.map(rowValues),
  ];
  let stringCellCount = 0;
  const sheetRows = allRows
    .map((cells, r) => {
      const rowNum = r + 1;
      const cellXml = cells
        .map((value, c) => {
          if (value == null || value === "") return "";
          const ref = `${columnRef(c)}${rowNum}`;
          if (typeof value === "number") {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          stringCellCount++;
          const style = r === 0 ? ` s="1"` : "";
          return `<c r="${ref}" t="s"${style}><v>${sIdx(value)}</v></c>`;
        })
        .join("");
      return `<row r="${rowNum}">${cellXml}</row>`;
    })
    .join("");
  const colWidths = [14, 44, 26, 10, 20, 14, 7, 15, 14, 15, 14];
  const cols = colWidths
    .map(
      (w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
    )
    .join("");
  const encoder = new TextEncoder();
  const files = [
    {
      name: "[Content_Types].xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Collection" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    {
      name: "xl/styles.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
      ),
    },
    {
      name: "xl/sharedStrings.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${stringCellCount}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join("")}</sst>`,
      ),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
      ),
    },
  ];
  return zipStored(files);
}

/** Hands a generated file to the phone the same way the fixed
    Save-icon-artwork button does (Settings, Nov 2, 2026): the
    system share sheet where file sharing works ("Save to Files"),
    falling back to a plain blob download — and the outcome is
    reported so the caller can settle its button state, which is
    what keeps repeated taps working. A dismissed share sheet
    reports "aborted" so the UI can settle quietly. */
export async function deliverFile(
  blob: Blob,
  filename: string,
): Promise<"shared" | "downloaded" | "aborted"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (
    typeof nav.canShare === "function" &&
    nav.canShare({ files: [file] }) &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "aborted";
      }
      // Any other share failure falls through to the download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
