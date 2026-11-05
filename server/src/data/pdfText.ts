/**
 * PDF checklist text extraction (Anthony, Nov 4, 2026 — the
 * Topps sports catalog): Topps publishes its official product
 * checklists as text PDFs (one per product, linked from
 * https://www.topps.com/pages/checklists). This module reads
 * those PDFs with no external dependency: it inflates the
 * FlateDecode streams, resolves the subset fonts' ToUnicode
 * CMaps, replays the content streams' text operators with
 * their transformation matrices (some producers position
 * every block with `cm`, others with `Tm`), groups the runs
 * into lines of cells, and parses checklist rows — card
 * number, player name, team, and flag (Rookie, Team Card, …)
 * — under each subset header. Text only: no artwork is read
 * or stored, matching the data-only direction for sports.
 */

type Run = { x: number; y: number; size: number; text: string };

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream("deflate");
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const out = await new Response(
      source.pipeThrough(ds),
    ).arrayBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

const latin1 = (b: Uint8Array): string => {
  let s = "";
  const CH = 32768;
  for (let i = 0; i < b.length; i += CH) {
    s += String.fromCharCode(...b.subarray(i, i + CH));
  }
  return s;
};

type PdfObj = {
  dict: string;
  stream: Uint8Array | null;
  plain: string;
  dataStart?: number;
  lenRef?: string;
};

async function parseObjects(bytes: Uint8Array): Promise<Map<string, PdfObj>> {
  const text = latin1(bytes);
  const objs = new Map<string, PdfObj>();
  const starts: { key: string; start: number; bodyStart: number }[] = [];
  for (const m of text.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)) {
    starts.push({
      key: `${m[1]} ${m[2]}`,
      start: m.index,
      bodyStart: m.index + m[0].length,
    });
  }
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]!.start : text.length;
    const body = text.slice(cur.bodyStart, end);
    const streamIdx = body.indexOf("stream");
    if (streamIdx >= 0) {
      const dict = body.slice(0, streamIdx);
      let dataStart = cur.bodyStart + streamIdx + 6;
      if (bytes[dataStart] === 13 && bytes[dataStart + 1] === 10) dataStart += 2;
      else if (bytes[dataStart] === 10 || bytes[dataStart] === 13) dataStart += 1;
      // Exact length from the dict when it is a direct integer
      // (the lookahead rejects both a longer digit run and an
      // indirect "/Length 14 0 R" reference).
      let len: number | null = null;
      const lm = dict.match(/\/Length\s+(\d+)(?![0-9]|\s+\d+\s+R)/);
      if (lm) len = parseInt(lm[1]!, 10);
      const lenRefM = dict.match(/\/Length\s+(\d+)\s+(\d+)\s+R/);
      const lenRef = lenRefM ? `${lenRefM[1]} ${lenRefM[2]}` : undefined;
      let raw: Uint8Array;
      if (len != null && dataStart + len <= bytes.length) {
        raw = bytes.slice(dataStart, dataStart + len);
      } else {
        const endTag = text.indexOf("endstream", dataStart);
        raw = bytes.slice(dataStart, endTag >= 0 ? endTag : bytes.length);
        while (
          raw.length > 0 &&
          (raw[raw.length - 1] === 10 || raw[raw.length - 1] === 13)
        ) {
          raw = raw.slice(0, raw.length - 1);
        }
      }
      let stream: Uint8Array | null = raw;
      if (/\/FlateDecode/.test(dict)) {
        stream = (await inflate(raw)) ?? raw;
      }
      objs.set(cur.key, { dict, stream, plain: "", dataStart, lenRef });
    } else {
      const endObj = body.indexOf("endobj");
      objs.set(cur.key, {
        dict: "",
        stream: null,
        plain: (endObj >= 0 ? body.slice(0, endObj) : body).trim(),
      });
    }
  }
  // Resolve indirect /Length references now that every object
  // is known: re-slice the exact stream bytes and re-inflate.
  for (const [, obj] of objs) {
    if (!obj.lenRef || obj.dataStart == null) continue;
    const lenObj = objs.get(obj.lenRef);
    const lenVal = lenObj ? parseInt(lenObj.plain, 10) : NaN;
    if (!Number.isFinite(lenVal) || lenVal <= 0) continue;
    const raw = bytes.slice(obj.dataStart, obj.dataStart + lenVal);
    if (/\/FlateDecode/.test(obj.dict)) {
      obj.stream = (await inflate(raw)) ?? raw;
    } else {
      obj.stream = raw;
    }
  }
  // Object streams: embedded objects (font dicts live here).
  for (const [, obj] of [...objs]) {
    if (!obj.stream || !/\/ObjStm/.test(obj.dict)) continue;
    const firstM = obj.dict.match(/\/First\s+(\d+)/);
    const nM = obj.dict.match(/\/N\s+(\d+)/);
    if (!firstM || !nM) continue;
    const first = parseInt(firstM[1]!, 10);
    const n = parseInt(nM[1]!, 10);
    const content = latin1(obj.stream);
    const header = content.slice(0, first);
    const nums = header.trim().split(/\s+/).map(Number);
    for (let k = 0; k < n; k++) {
      const num = nums[k * 2];
      const off = nums[k * 2 + 1];
      if (num == null || off == null) continue;
      const nextOff = k + 1 < n ? nums[k * 2 + 3]! : content.length - first;
      const key = `${num} 0`;
      if (!objs.has(key)) {
        objs.set(key, {
          dict: "",
          stream: null,
          plain: content.slice(first + off, first + nextOff).trim(),
        });
      }
    }
  }
  return objs;
}

function objText(objs: Map<string, PdfObj>, key: string): string {
  const o = objs.get(key);
  if (!o) return "";
  return o.stream ? latin1(o.stream) : o.plain || o.dict;
}

/** Parse a ToUnicode CMap into code -> unicode string. */
function parseCMap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const hexToStr = (h: string): string => {
    let s = "";
    for (let i = 0; i + 4 <= h.length; i += 4) {
      s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    }
    return s;
  };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1]!.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g,
    )) {
      map.set(parseInt(pair[1]!, 16), hexToStr(pair[2]!));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const r of block[1]!.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g,
    )) {
      const lo = parseInt(r[1]!, 16);
      const hi = parseInt(r[2]!, 16);
      if (r[4]) {
        const base = parseInt(r[4], 16);
        for (let c = lo; c <= hi && c - lo < 300; c++) {
          map.set(c, String.fromCharCode(base + (c - lo)));
        }
      } else if (r[5]) {
        const vals = [...r[5].matchAll(/<([0-9A-Fa-f]+)>/g)];
        vals.forEach((v, i) => {
          if (lo + i <= hi) map.set(lo + i, hexToStr(v[1]!));
        });
      }
    }
  }
  return map;
}

type FontInfo = { cmap: Map<number, string> | null; cid: boolean };

function buildFonts(objs: Map<string, PdfObj>): Map<string, FontInfo> {
  const fonts = new Map<string, FontInfo>();
  for (const [key, o] of objs) {
    const body = o.plain || o.dict;
    if (!/\/BaseFont/.test(body)) continue;
    let cmap: Map<number, string> | null = null;
    const tu = body.match(/\/ToUnicode\s+(\d+)\s+(\d+)\s+R/);
    if (tu) {
      const cmapText = objText(objs, `${tu[1]} ${tu[2]}`);
      if (cmapText) cmap = parseCMap(cmapText);
    }
    fonts.set(key, { cmap, cid: /\/Type0/.test(body) || cmap != null });
  }
  return fonts;
}

/** Resolve a page's /Resources font name -> font object key
    map, walking /Parent for inherited resources. */
function pageFonts(
  objs: Map<string, PdfObj>,
  pageKey: string,
): Map<string, string> {
  const out = new Map<string, string>();
  let cur: string | null = pageKey;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const o = objs.get(cur);
    if (!o) break;
    const body = o.plain || o.dict;
    const resM = body.match(/\/Resources\s+(\d+)\s+(\d+)\s+R/);
    const resText = resM ? objText(objs, `${resM[1]} ${resM[2]}`) : body;
    const fontDictM = resText.match(/\/Font\s*<<([\s\S]*?)>>/);
    const fontRefM = resText.match(/\/Font\s+(\d+)\s+(\d+)\s+R/);
    const fontText = fontDictM
      ? fontDictM[1]!
      : fontRefM
        ? objText(objs, `${fontRefM[1]} ${fontRefM[2]}`)
        : "";
    for (const fm of fontText.matchAll(
      /\/([A-Za-z0-9]+)\s+(\d+)\s+(\d+)\s+R/g,
    )) {
      if (!out.has(fm[1]!)) out.set(fm[1]!, `${fm[2]} ${fm[3]}`);
    }
    if (out.size > 0) break;
    const parentM = body.match(/\/Parent\s+(\d+)\s+(\d+)\s+R/);
    cur = parentM ? `${parentM[1]} ${parentM[2]}` : null;
  }
  return out;
}

function decodeLiteral(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === "\\" && i + 1 < raw.length) {
      const n = raw[++i]!;
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else if (n === "(" || n === ")" || n === "\\") out += n;
      else if (n >= "0" && n <= "7") {
        let oct = n;
        while (
          i + 1 < raw.length &&
          /[0-7]/.test(raw[i + 1]!) &&
          oct.length < 3
        ) {
          oct += raw[++i]!;
        }
        out += String.fromCharCode(parseInt(oct, 8));
      } else if (n !== "\n" && n !== "\r") out += n;
    } else {
      out += ch;
    }
  }
  return out;
}

function decodeHex(hex: string, font: FontInfo | undefined): string {
  const clean = hex.replace(/\s+/g, "");
  if (font?.cmap) {
    let out = "";
    // The subset fonts' ToUnicode codespace is 2 bytes wide
    // (<0000>-<FFFF>), so codes read as 4 hex digits.
    for (let i = 0; i + 4 <= clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      out += font.cmap.get(code) ?? "";
    }
    return out;
  }
  let out = "";
  for (let i = 0; i + 2 <= clean.length; i += 2) {
    const c = parseInt(clean.slice(i, i + 2), 16);
    if (c >= 32) out += String.fromCharCode(c);
  }
  return out;
}

/** Tokenize + interpret one page content stream into runs. */
function contentRuns(
  content: string,
  fontNames: Map<string, string>,
  fonts: Map<string, FontInfo>,
): Run[] {
  const runs: Run[] = [];
  let font: FontInfo | undefined;
  let size = 10;
  let leading = 12;
  type Mat = [number, number, number, number, number, number];
  let ctm: Mat = [1, 0, 0, 1, 0, 0];
  const ctmStack: Mat[] = [];
  let tm: Mat = [1, 0, 0, 1, 0, 0];
  const mul = (m1: Mat, m2: Mat): Mat => [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
  const tokens: { t: string; v: string }[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const ch = content[i]!;
    if (ch === "%") {
      while (i < n && content[i] !== "\n") i++;
    } else if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      let raw = "";
      while (j < n && depth > 0) {
        const c = content[j]!;
        if (c === "\\") {
          raw += c + (content[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (c === "(") depth++;
        if (c === ")") {
          depth--;
          if (depth === 0) break;
        }
        raw += c;
        j++;
      }
      tokens.push({ t: "str", v: raw });
      i = j + 1;
    } else if (ch === "<" && content[i + 1] !== "<") {
      const j = content.indexOf(">", i);
      if (j < 0) break;
      tokens.push({ t: "hex", v: content.slice(i + 1, j) });
      i = j + 1;
    } else if (ch === "[") {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (content[j] === "(") {
          let d = 1;
          j++;
          while (j < n && d > 0) {
            if (content[j] === "\\") j++;
            else if (content[j] === "(") d++;
            else if (content[j] === ")") d--;
            j++;
          }
          continue;
        }
        if (content[j] === "[") depth++;
        if (content[j] === "]") depth--;
        j++;
      }
      tokens.push({ t: "arr", v: content.slice(i + 1, j - 1) });
      i = j;
    } else if (ch === "/") {
      let j = i + 1;
      while (j < n && !/[\s<>\[\]{}()/%]/.test(content[j]!)) j++;
      tokens.push({ t: "name", v: content.slice(i + 1, j) });
      i = j;
    } else if (/[+\-0-9.]/.test(ch)) {
      let j = i;
      while (j < n && /[+\-0-9.]/.test(content[j]!)) j++;
      tokens.push({ t: "num", v: content.slice(i, j) });
      i = j;
    } else if (/[A-Za-z*'"]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z*]/.test(content[j]!)) j++;
      if (j === i) j++;
      tokens.push({ t: "op", v: content.slice(i, j) });
      i = j;
    } else {
      i++;
    }
  }
  const stack: { t: string; v: string }[] = [];
  const showText = (text: string) => {
    if (text.length === 0) return;
    const eff = mul(tm, ctm);
    runs.push({ x: eff[4], y: eff[5], size, text });
  };
  const decodeTok = (tok: { t: string; v: string }): string =>
    tok.t === "hex" ? decodeHex(tok.v, font) : decodeLiteral(tok.v);
  const decodeArr = (raw: string): string => {
    let out = "";
    for (const mm of raw.matchAll(
      /\((?:\\.|[^()\\])*\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g,
    )) {
      if (mm[1] != null) out += decodeHex(mm[1], font);
      else if (mm[2] != null) {
        if (parseFloat(mm[2]) < -180) out += " ";
      } else {
        out += decodeLiteral(mm[0].slice(1, -1));
      }
    }
    return out;
  };
  for (const tok of tokens) {
    if (tok.t !== "op") {
      stack.push(tok);
      continue;
    }
    const op = tok.v;
    const nums = stack
      .filter((s) => s.t === "num")
      .map((s) => parseFloat(s.v));
    switch (op) {
      case "q": {
        ctmStack.push([...ctm] as Mat);
        break;
      }
      case "Q": {
        const prev = ctmStack.pop();
        if (prev) ctm = prev;
        break;
      }
      case "cm": {
        if (nums.length >= 6) {
          ctm = mul(
            [nums[0]!, nums[1]!, nums[2]!, nums[3]!, nums[4]!, nums[5]!] as Mat,
            ctm,
          );
        }
        break;
      }
      case "BT": {
        tm = [1, 0, 0, 1, 0, 0];
        break;
      }
      case "Tf": {
        const nameTok = stack.find((s) => s.t === "name");
        const sizeTok = stack[stack.length - 1];
        if (nameTok) {
          const key = fontNames.get(nameTok.v);
          font = key ? fonts.get(key) : undefined;
        }
        if (sizeTok?.t === "num") size = parseFloat(sizeTok.v);
        break;
      }
      case "Tm": {
        if (nums.length >= 6) {
          tm = [
            nums[0]!,
            nums[1]!,
            nums[2]!,
            nums[3]!,
            nums[4]!,
            nums[5]!,
          ] as Mat;
        }
        break;
      }
      case "Td":
      case "TD": {
        if (nums.length >= 2) {
          tm = mul([1, 0, 0, 1, nums[0]!, nums[1]!] as Mat, tm);
          if (op === "TD" && nums[1]! !== 0) leading = -nums[1]!;
        }
        break;
      }
      case "TL": {
        if (nums.length >= 1) leading = nums[0]!;
        break;
      }
      case "T*": {
        tm = mul([1, 0, 0, 1, 0, -leading] as Mat, tm);
        break;
      }
      case "Tj": {
        const s = stack[stack.length - 1];
        if (s && (s.t === "str" || s.t === "hex")) showText(decodeTok(s));
        break;
      }
      case "TJ": {
        const s = stack[stack.length - 1];
        if (s?.t === "arr") showText(decodeArr(s.v));
        else if (s && (s.t === "str" || s.t === "hex")) {
          showText(decodeTok(s));
        }
        break;
      }
      case "'":
      case '"': {
        const s = stack[stack.length - 1];
        tm = mul([1, 0, 0, 1, 0, -leading] as Mat, tm);
        if (s && (s.t === "str" || s.t === "hex")) showText(decodeTok(s));
        break;
      }
    }
    stack.length = 0;
  }
  return runs;
}

/** Extract a PDF's text as pages -> lines -> cells. */
export async function extractPdfLines(
  bytes: Uint8Array,
): Promise<string[][][]> {
  const objs = await parseObjects(bytes);
  const fonts = buildFonts(objs);
  const pages: string[][][] = [];
  const ordered: string[] = [];
  const walkKids = (key: string) => {
    const o = objs.get(key);
    if (!o) return;
    const body = o.plain || o.dict;
    const kidsM = body.match(/\/Kids\s*\[([\s\S]*?)\]/);
    if (/\/Type\s*\/Page\b/.test(body) && !kidsM) {
      ordered.push(key);
      return;
    }
    if (kidsM) {
      for (const km of kidsM[1]!.matchAll(/(\d+)\s+(\d+)\s+R/g)) {
        walkKids(`${km[1]} ${km[2]}`);
      }
    }
  };
  for (const [k, o] of objs) {
    if (/\/Type\s*\/Pages\b/.test(o.plain || o.dict)) walkKids(k);
  }
  const pageKeys = [...objs.entries()]
    .filter(([, o]) => /\/Type\s*\/Page\b/.test(o.plain || o.dict))
    .map(([k]) => k);
  const pageOrder = [...new Set(ordered.length > 0 ? ordered : pageKeys)];
  for (const pk of pageOrder.slice(0, 400)) {
    const o = objs.get(pk);
    if (!o) continue;
    const body = o.plain || o.dict;
    const fontNames = pageFonts(objs, pk);
    const contentKeys: string[] = [];
    const arrM = body.match(/\/Contents\s*\[([\s\S]*?)\]/);
    const singleM = body.match(/\/Contents\s+(\d+)\s+(\d+)\s+R/);
    if (arrM) {
      for (const cm of arrM[1]!.matchAll(/(\d+)\s+(\d+)\s+R/g)) {
        contentKeys.push(`${cm[1]} ${cm[2]}`);
      }
    } else if (singleM) {
      contentKeys.push(`${singleM[1]} ${singleM[2]}`);
    }
    let runs: Run[] = [];
    for (const ck of contentKeys) {
      const co = objs.get(ck);
      if (co?.stream) {
        runs = runs.concat(
          contentRuns(latin1(co.stream), fontNames, fonts),
        );
      }
    }
    const lines: { y: number; runs: Run[] }[] = [];
    for (const r of runs) {
      const line = lines.find((l) => Math.abs(l.y - r.y) <= 2.5);
      if (line) line.runs.push(r);
      else lines.push({ y: r.y, runs: [r] });
    }
    const pageLines: string[][] = lines
      .map((l) => {
        const sorted = [...l.runs].sort((a, b) => a.x - b.x);
        return sorted
          .map((r) => r.text.replace(/\s+/g, " ").trim())
          .filter((t) => t.length > 0);
      })
      .filter((cells) => cells.length > 0);
    pages.push(pageLines);
  }
  return pages;
}

// ---------- Topps checklist row parsing ----------

export type ChecklistRow = {
  number: string;
  name: string;
  team: string | null;
  flag: string | null;
  subset: string;
};

const FLAG_WORDS = new Set([
  "rookie",
  "future stars",
  "team card",
  "league leaders",
  "combo card",
  "checklist",
  "combo card/checklist",
  "rookie card",
  "all-star",
  "all star",
  "world series",
  "award winner",
]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(
      /(^|[\s\-/&])(\p{L})/gu,
      (_, p: string, c: string) => p + c.toUpperCase(),
    );
}

const NUM_RE =
  /^([A-Za-z]{0,5}-?\d+[A-Za-z0-9.\-]*|[A-Za-z]{1,5}-[A-Za-z]{1,4}\d*)$/;

/** Parse extracted checklist lines into card rows. Subset
    headers are the ALL-CAPS section lines Topps prints above
    each subset ("BASE CARD SET", "AUTOGRAPH RELICS", …);
    rows under a header belong to that subset until the next
    header. */
export function parseChecklist(pages: string[][][]): ChecklistRow[] {
  const rows: ChecklistRow[] = [];
  let subset = "Base Set";
  for (const page of pages) {
    for (const cells of page) {
      if (cells.length === 1) {
        const t = cells[0]!;
        const letters = t.replace(/[^A-Za-z]/g, "");
        if (
          letters.length >= 3 &&
          letters === letters.toUpperCase() &&
          !NUM_RE.test(t.split(" ")[0] ?? "")
        ) {
          subset = titleCase(t.replace(/\s+/g, " ").trim());
          continue;
        }
      }
      /* Multi-column checklists (some entertainment sets,
         e.g. Star Wars Finest, print two or three card
         columns side by side): one extracted line then
         carries several cards. Segment the line into one
         group per card — a new group starts at a cell that
         is a card number (or a merged "number name" cell)
         once the current group already holds number+name.
         Single-column lines never contain a second number
         cell (teams and flags are words), so they pass
         through as exactly one group. */
      const groups: string[][] = [];
      {
        let cur: string[] = [];
        const startsGroup = (c: string): boolean => {
          if (NUM_RE.test(c)) return true;
          const m = c.match(/^(\S+)\s+(.+)$/);
          return m != null && NUM_RE.test(m[1]!);
        };
        for (const c of cells) {
          if (cur.length >= 2 && startsGroup(c)) {
            groups.push(cur);
            cur = [c];
          } else {
            cur.push(c);
          }
        }
        if (cur.length > 0) groups.push(cur);
      }
      for (const group of groups) {
        let num: string | null = null;
        let rest: string[] = [];
        const first = group[0] ?? "";
        if (NUM_RE.test(first) && group.length >= 2) {
          num = first;
          rest = group.slice(1);
        } else {
          const merged = first.match(/^(\S+)\s+(.+)$/);
          if (merged && NUM_RE.test(merged[1]!)) {
            num = merged[1]!;
            rest = [merged[2]!, ...group.slice(1)];
          }
        }
        if (!num || rest.length === 0) continue;
        // ®/™ print as ¨/ª under the older subset-font encoding.
        const name = (rest[0] ?? "").replace(/[®™¨ª]/g, "").trim();
        if (!name) continue;
        // Document title lines ("2026 Bowman Baseball
        // Checklist") split into a year + name: not cards.
        if (/^\d{4}$/.test(num) && /checklist/i.test(name)) continue;
        // Repeated page headers ("2018 Topps Star Wars
        // Finest - Base Cards") also split into a year + a
        // product line: not cards either.
        if (/^\d{4}$/.test(num) && /^topps\b/i.test(name)) continue;
        let team: string | null = null;
        let flag: string | null = null;
        const extras = rest
          .slice(1)
          .map((c) => c.replace(/[®™¨ª]/g, "").trim())
          .filter(Boolean);
        for (const e of extras) {
          if (FLAG_WORDS.has(e.toLowerCase())) {
            flag = flag ? `${flag} · ${e}` : e;
          } else if (!team) {
            team = e;
          } else {
            flag = flag ? `${flag} · ${e}` : e;
          }
        }
        rows.push({ number: num, name, team, flag, subset });
      }
    }
  }
  return rows;
}
