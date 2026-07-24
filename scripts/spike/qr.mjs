/**
 * QR versions 1-2, ECC level M, alphanumeric mode only.
 *
 * Spike-only. Versions 1 and 2 need no version information block (that starts
 * at version 7) and use a single Reed-Solomon block, which keeps this to the
 * essentials: encode, Reed-Solomon, place, mask, format info. Promoted to
 * src/lib with tests only if the physical spike picks QR.
 */

const EC_LEVEL_BITS = 0b00; // M

/** Single-block ECC-M parameters. Alphanumeric capacity in the comment. */
const VERSIONS = {
  1: { data: 16, ecc: 10, alignment: [] }, // 20 characters
  2: { data: 28, ecc: 16, alignment: [6, 18] }, // 38 characters
};

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const sizeForVersion = (version) => 17 + 4 * version;

// GF(256) for QR: x^8 + x^4 + x^3 + x^2 + 1
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = value;
    GF_LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function generatorPolynomial(count) {
  let poly = [1]; // ascending degree
  for (let i = 0; i < count; i += 1) {
    const root = GF_EXP[i];
    const next = new Array(poly.length + 1).fill(0);
    for (let k = 0; k < poly.length; k += 1) {
      next[k] ^= gfMul(poly[k], root);
      next[k + 1] ^= poly[k];
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data, eccCount) {
  const gen = generatorPolynomial(eccCount);
  const ecc = new Array(eccCount).fill(0);

  for (const byte of data) {
    const factor = byte ^ ecc[eccCount - 1];
    for (let k = eccCount - 1; k > 0; k -= 1) {
      ecc[k] = ecc[k - 1] ^ gfMul(gen[k], factor);
    }
    ecc[0] = gfMul(gen[0], factor);
  }

  return ecc.slice().reverse();
}

function encodeAlphanumeric(text, version) {
  const { data: dataCodewords } = VERSIONS[version];
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  for (const character of text) {
    if (!ALPHANUMERIC.includes(character)) {
      throw new Error(`"${character}" is not in the QR alphanumeric charset.`);
    }
  }

  push(0b0010, 4); // alphanumeric mode
  push(text.length, 9); // character count, versions 1-9

  for (let i = 0; i < text.length; i += 2) {
    if (i + 1 < text.length) {
      push(
        ALPHANUMERIC.indexOf(text[i]) * 45 + ALPHANUMERIC.indexOf(text[i + 1]),
        11,
      );
    } else {
      push(ALPHANUMERIC.indexOf(text[i]), 6);
    }
  }

  const capacityBits = dataCodewords * 8;
  if (bits.length > capacityBits) {
    throw new Error(
      `Payload needs ${bits.length} bits, V${version}-M holds ${capacityBits}.`,
    );
  }

  // Terminator, then pad to a byte boundary, then alternating pad bytes.
  for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | bits[i + b];
    codewords.push(byte);
  }

  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < dataCodewords) {
    codewords.push(padBytes[padIndex++ % 2]);
  }

  return codewords;
}

function blankMatrix(size) {
  return {
    modules: Array.from({ length: size }, () => new Uint8Array(size)),
    reserved: Array.from({ length: size }, () => new Uint8Array(size)),
  };
}

function placeFunctionPatterns({ modules, reserved }, version) {
  const SIZE = sizeForVersion(version);
  const finder = (top, left) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) continue;
        const inRing =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        modules[row][col] = inRing || inCore ? 1 : 0;
        reserved[row][col] = 1;
      }
    }
  };

  finder(0, 0);
  finder(0, SIZE - 7);
  finder(SIZE - 7, 0);

  // Timing patterns.
  for (let i = 8; i < SIZE - 8; i += 1) {
    const dark = i % 2 === 0 ? 1 : 0;
    modules[6][i] = dark;
    reserved[6][i] = 1;
    modules[i][6] = dark;
    reserved[i][6] = 1;
  }

  // Alignment patterns: 5x5, at every pairing of the version's centre
  // coordinates except the three that would sit on a finder pattern.
  const centres = VERSIONS[version].alignment;
  for (const row of centres) {
    for (const col of centres) {
      const onFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === SIZE - 7) ||
        (row === SIZE - 7 && col === 6);
      if (onFinder) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const ring = Math.max(Math.abs(r), Math.abs(c));
          modules[row + r][col + c] = ring === 1 ? 0 : 1;
          reserved[row + r][col + c] = 1;
        }
      }
    }
  }

  // Dark module.
  modules[4 * version + 9][8] = 1;
  reserved[4 * version + 9][8] = 1;

  // Reserve the format information areas.
  for (let i = 0; i <= 8; i += 1) {
    if (!reserved[8][i]) reserved[8][i] = 1;
    if (!reserved[i][8]) reserved[i][8] = 1;
  }
  for (let i = SIZE - 8; i < SIZE; i += 1) reserved[8][i] = 1;
  for (let i = SIZE - 7; i < SIZE; i += 1) reserved[i][8] = 1;
}

function placeData({ modules, reserved }, codewords) {
  const SIZE = modules.length;
  const bits = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);
  }

  let index = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        const row = upward ? SIZE - 1 - vertical : vertical;
        if (reserved[row][col]) continue;
        modules[row][col] = index < bits.length ? bits[index] : 0;
        index += 1;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

function applyMask(modules, reserved, mask) {
  const SIZE = modules.length;
  const masked = modules.map((row) => row.slice());
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (reserved[r][c]) continue;
      if (MASKS[mask](r, c)) masked[r][c] ^= 1;
    }
  }
  return masked;
}

function penalty(modules) {
  const SIZE = modules.length;
  let score = 0;

  // Rule 1: runs of five or more same-coloured modules in a row or column.
  for (let i = 0; i < SIZE; i += 1) {
    for (const readRow of [true, false]) {
      let run = 1;
      for (let j = 1; j < SIZE; j += 1) {
        const current = readRow ? modules[i][j] : modules[j][i];
        const previous = readRow ? modules[i][j - 1] : modules[j - 1][i];
        if (current === previous) {
          run += 1;
        } else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2: 2x2 blocks of the same colour.
  for (let r = 0; r < SIZE - 1; r += 1) {
    for (let c = 0; c < SIZE - 1; c += 1) {
      const value = modules[r][c];
      if (
        value === modules[r][c + 1] &&
        value === modules[r + 1][c] &&
        value === modules[r + 1][c + 1]
      ) {
        score += 3;
      }
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns with four light modules either side.
  const patternA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const patternB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (values, start, pattern) =>
    pattern.every((bit, offset) => values[start + offset] === bit);

  for (let i = 0; i < SIZE; i += 1) {
    const row = Array.from(modules[i]);
    const column = modules.map((line) => line[i]);
    for (const values of [row, column]) {
      for (let start = 0; start + 11 <= SIZE; start += 1) {
        if (matches(values, start, patternA)) score += 40;
        if (matches(values, start, patternB)) score += 40;
      }
    }
  }

  // Rule 4: deviation from an even balance of dark and light modules.
  let dark = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) dark += modules[r][c];
  }
  const percent = (dark * 100) / (SIZE * SIZE);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

function formatInformation(mask) {
  const value = (EC_LEVEL_BITS << 3) | mask;
  let remainder = value;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
  }
  return ((value << 10) | remainder) ^ 0x5412;
}

function placeFormatInformation(modules, mask) {
  const SIZE = modules.length;
  const format = formatInformation(mask);
  const bit = (i) => (format >> i) & 1;

  // First copy: down column 8, then left along row 8.
  for (let i = 0; i <= 5; i += 1) modules[i][8] = bit(i);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let i = 9; i <= 14; i += 1) modules[8][14 - i] = bit(i);

  // Second copy: up column 8 from the bottom, then right along row 8.
  for (let i = 0; i <= 7; i += 1) modules[SIZE - 1 - i][8] = bit(i);
  for (let i = 8; i <= 14; i += 1) modules[8][SIZE - 15 + i] = bit(i);

  // The dark module shares a cell with the second copy and always wins.
  modules[SIZE - 8][8] = 1;
}

/** Smallest supported version whose ECC-M capacity holds the payload. */
export function smallestQrVersion(text) {
  for (const version of Object.keys(VERSIONS).map(Number).sort((a, b) => a - b)) {
    try {
      encodeAlphanumeric(text, version);
      return version;
    } catch {
      // Try the next version up.
    }
  }
  throw new Error(`"${text}" does not fit any supported QR version.`);
}

/**
 * @param {string} text uppercase alphanumeric payload
 * @param {number} version QR version (1 or 2); defaults to the smallest that fits
 * @returns {{ size: number, bits: Uint8Array, version: number, mask: number }}
 */
export function encodeQr(text, version = smallestQrVersion(text)) {
  const SIZE = sizeForVersion(version);
  const data = encodeAlphanumeric(text, version);
  const codewords = [...data, ...reedSolomon(data, VERSIONS[version].ecc)];

  const matrix = blankMatrix(SIZE);
  placeFunctionPatterns(matrix, version);
  placeData(matrix, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const masked = applyMask(matrix.modules, matrix.reserved, mask);
    placeFormatInformation(masked, mask);
    const score = penalty(masked);
    if (!best || score < best.score) best = { score, mask, modules: masked };
  }

  const bits = new Uint8Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) bits[r * SIZE + c] = best.modules[r][c];
  }

  return { size: SIZE, bits, version, mask: best.mask };
}

/** Kept so the sheet 1 script keeps producing byte-identical output. */
export function encodeQrV1M(text) {
  return encodeQr(text, 1);
}

export const qrQuietModules = 4;
