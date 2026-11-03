// Minimal QR Code generator (byte mode, error-correction level L,
// versions 1–10) — just enough to encode the short Collector ID
// payload (username + collector code) as a real, scannable QR code
// with no external dependency. Follows the QR specification:
// bitstream assembly, Reed–Solomon over GF(256), block interleaving,
// function patterns, masking with penalty evaluation, format info.

/** ECC level L parameters per version: ECC codewords per block and
    the data-codeword length of each block. */
const ECC_L: Record<number, { ecc: number; blocks: number[] }> = {
  1: { ecc: 7, blocks: [19] },
  2: { ecc: 10, blocks: [34] },
  3: { ecc: 15, blocks: [55] },
  4: { ecc: 20, blocks: [80] },
  5: { ecc: 26, blocks: [108] },
  6: { ecc: 18, blocks: [68, 68] },
  7: { ecc: 20, blocks: [78, 78] },
  8: { ecc: 24, blocks: [97, 97] },
  9: { ecc: 30, blocks: [116, 116] },
  10: { ecc: 18, blocks: [68, 68, 69, 69] },
};

const TOTAL_CODEWORDS: Record<number, number> = {
  1: 26, 2: 44, 3: 70, 4: 100, 5: 134,
  6: 172, 7: 196, 8: 242, 9: 292, 10: 346,
};

const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const REMAINDER_BITS: Record<number, number> = {
  1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0,
};

// --- Galois field GF(256), primitive polynomial 0x11d ---

const GF_EXP = new Array<number>(512).fill(0);
const GF_LOG = new Array<number>(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255] ?? 0;
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0;
}

/** Reed–Solomon generator polynomial of the given degree:
    ∏(x + α^i) for i in 0..degree-1, coefficients stored
    highest-degree first with a leading 1. */
function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const root = GF_EXP[i] ?? 1;
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j <= poly.length; j++) {
      const fromX = j < poly.length ? (poly[j] ?? 0) : 0;
      const fromRoot = j > 0 ? gfMul(poly[j - 1] ?? 0, root) : 0;
      next[j] = fromX ^ fromRoot;
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], gen: number[]): number[] {
  const degree = gen.length - 1;
  const res = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ (res.shift() ?? 0);
    res.push(0);
    for (let i = 0; i < degree; i++) {
      res[i] = (res[i] ?? 0) ^ gfMul(gen[i + 1] ?? 0, factor);
    }
  }
  return res;
}

// --- Bitstream ---

class BitBuffer {
  bits: number[] = [];
  push(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
  get length() {
    return this.bits.length;
  }
}

export function encodeDataCodewords(text: string, version: number): number[] {
  const spec = ECC_L[version];
  if (!spec) throw new Error(`Unsupported QR version ${version}`);
  const dataCapacity = spec.blocks.reduce((s, n) => s + n, 0);
  const capacityBits = dataCapacity * 8;
  const bytes = new TextEncoder().encode(text);
  const buf = new BitBuffer();
  buf.push(0x4, 4); // byte mode
  buf.push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) buf.push(b, 8);
  // Terminator, pad to a byte boundary, then pad codewords.
  buf.push(0, Math.min(4, capacityBits - buf.length));
  while (buf.length % 8 !== 0) buf.push(0, 1);
  for (let pad = 0xec; buf.length < capacityBits; pad ^= 0xec ^ 0x11) {
    buf.push(pad, 8);
  }
  const codewords: number[] = [];
  for (let i = 0; i < buf.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (buf.bits[i + j] ?? 0);
    codewords.push(byte);
  }
  return codewords;
}

export function interleaveWithEcc(dataCodewords: number[], version: number): number[] {
  const spec = ECC_L[version];
  if (!spec) throw new Error(`Unsupported QR version ${version}`);
  const gen = rsGenerator(spec.ecc);
  const blocks: { data: number[]; ecc: number[] }[] = [];
  let offset = 0;
  for (const len of spec.blocks) {
    const data = dataCodewords.slice(offset, offset + len);
    offset += len;
    blocks.push({ data, ecc: rsRemainder(data, gen) });
  }
  const out: number[] = [];
  const maxData = Math.max(...spec.blocks);
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) {
      if (i < block.data.length) out.push(block.data[i] ?? 0);
    }
  }
  for (let i = 0; i < spec.ecc; i++) {
    for (const block of blocks) out.push(block.ecc[i] ?? 0);
  }
  return out;
}

// --- Matrix construction ---

function formatBits(mask: number): number {
  // ECC level L has format indicator 0b01.
  const data = (0b01 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

interface QrMatrix {
  size: number;
  modules: boolean[][];
}

function buildMatrix(codewords: number[], version: number): boolean[][] {
  const size = 17 + 4 * version;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    modules[y]![x] = dark;
    isFunction[y]![x] = true;
  };

  // Timing patterns.
  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Finder patterns with separators (7x7 plus the light ring around).
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Alignment patterns.
  const centers = ALIGNMENT_CENTERS[version] ?? [];
  for (const cy of centers) {
    for (const cx of centers) {
      // Skip the three corners that overlap finder patterns.
      const nearCorner =
        (cx < 10 && cy < 10) ||
        (cx > size - 11 && cy < 10) ||
        (cx < 10 && cy > size - 11);
      if (nearCorner) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunction(cx + dx, cy + dy, dist === 2 || (dx === 0 && dy === 0));
        }
      }
    }
  }

  // Reserve the format-information areas (values drawn after masking).
  for (let i = 0; i <= 5; i++) setFunction(8, i, true);
  setFunction(8, 7, true);
  setFunction(8, 8, true);
  setFunction(7, 8, true);
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, true);
  for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, true);
  for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, true);
  setFunction(8, size - 8, true); // dark module

  // Data bits, MSB first, plus remainder bits.
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  }
  for (let i = 0; i < (REMAINDER_BITS[version] ?? 0); i++) bits.push(0);

  const dataPositions: [number, number][] = [];
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (isFunction[y]?.[x]) continue;
        modules[y]![x] = (bits[bitIndex] ?? 0) === 1;
        dataPositions.push([x, y]);
        bitIndex++;
      }
    }
  }

  const maskFns: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const drawFormat = (target: boolean[][], mask: number) => {
    const bitsVal = formatBits(mask);
    const getBit = (i: number) => ((bitsVal >>> i) & 1) === 1;
    const set = (x: number, y: number, dark: boolean) => {
      target[y]![x] = dark;
    };
    for (let i = 0; i <= 5; i++) set(8, i, getBit(i));
    set(8, 7, getBit(6));
    set(8, 8, getBit(7));
    set(7, 8, getBit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, getBit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, getBit(i));
    set(8, size - 8, true);
  };

  // Penalty evaluation (spec rules 1–4).
  const penalty = (m: boolean[][]): number => {
    let score = 0;
    // Rule 1: long runs in rows and columns.
    for (let i = 0; i < size; i++) {
      const lines: boolean[][] = [m[i] ?? [], m.map((row) => row[i] ?? false)];
      for (const line of lines) {
        let runColor = line[0] ?? false;
        let runLen = 1;
        for (let j = 1; j < size; j++) {
          if (line[j] === runColor) {
            runLen++;
          } else {
            if (runLen >= 5) score += 3 + (runLen - 5);
            runColor = line[j] ?? false;
            runLen = 1;
          }
        }
        if (runLen >= 5) score += 3 + (runLen - 5);
      }
    }
    // Rule 2: 2x2 blocks of one color.
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = m[y]?.[x];
        if (
          c === m[y]?.[x + 1] &&
          c === m[y + 1]?.[x] &&
          c === m[y + 1]?.[x + 1]
        ) {
          score += 3;
        }
      }
    }
    // Rule 3: finder-like patterns with a four-module light surround.
    const pattern = [true, false, true, true, true, false, true];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const rowMatch =
          x + 7 <= size &&
          pattern.every((p, k) => m[y]?.[x + k] === p);
        const colMatch =
          y + 7 <= size &&
          pattern.every((p, k) => m[y + k]?.[x] === p);
        const lightBefore = (get: (k: number) => boolean | undefined) =>
          [1, 2, 3, 4].every((k) => get(k) === false);
        const lightAfter = (get: (k: number) => boolean | undefined) =>
          [0, 1, 2, 3].every((k) => get(k) === false);
        if (
          rowMatch &&
          (lightBefore((k) => m[y]?.[x - k]) ||
            lightAfter((k) => m[y]?.[x + 7 + k]))
        ) {
          score += 40;
        }
        if (
          colMatch &&
          (lightBefore((k) => m[y - k]?.[x]) ||
            lightAfter((k) => m[y + 7 + k]?.[x]))
        ) {
          score += 40;
        }
      }
    }
    // Rule 4: dark-module proportion away from 50%.
    let dark = 0;
    for (const row of m) for (const cell of row) if (cell) dark++;
    const total = size * size;
    const k = Math.floor(Math.abs(dark * 20 - total * 10) / total);
    score += k * 10;
    return score;
  };

  let best: boolean[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row) => [...row]);
    const maskFn = maskFns[mask]!;
    for (const [x, y] of dataPositions) {
      if (maskFn(x, y)) candidate[y]![x] = !(candidate[y]?.[x] ?? false);
    }
    drawFormat(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best ?? modules;
}

/** Encodes text as a QR module matrix (true = dark). Picks the
    smallest version 1–10 (ECC level L) that fits. */
export function qrMatrix(text: string): QrMatrix {
  const byteLen = new TextEncoder().encode(text).length;
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const spec = ECC_L[v];
    if (!spec) continue;
    const capacity = spec.blocks.reduce((s, n) => s + n, 0);
    // Data bits: mode (4) + length field + payload, within capacity.
    const lengthBits = v >= 10 ? 16 : 8;
    if (4 + lengthBits + byteLen * 8 <= capacity * 8) {
      version = v;
      break;
    }
  }
  if (version === 0) throw new Error("QR payload too long");
  const dataCodewords = encodeDataCodewords(text, version);
  const all = interleaveWithEcc(dataCodewords, version);
  if (all.length !== (TOTAL_CODEWORDS[version] ?? -1)) {
    throw new Error("QR codeword count mismatch");
  }
  const modules = buildMatrix(all, version);
  return { size: 17 + 4 * version, modules };
}
