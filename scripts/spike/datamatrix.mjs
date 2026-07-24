/**
 * Data Matrix ECC200, 16x16 symbol, ASCII encodation only.
 *
 * Spike-only. Scoped deliberately narrow: one symbol size (16x16 = 12 data
 * codewords + 12 error codewords) and one encodation mode (ASCII), which is all
 * the 16-digit numeric payload needs. Promoted to src/lib with tests only if the
 * physical spike picks Data Matrix.
 */

const SYMBOL_SIZE = 16;
const REGION_SIZE = 14; // data region inside the finder pattern
const DATA_CODEWORDS = 12;
const ECC_CODEWORDS = 12;

// GF(256) for ECC200: x^8 + x^5 + x^3 + x^2 + 1
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = value;
    GF_LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x12d;
  }
  for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** ECC200 uses alpha^1..alpha^n as generator roots. */
function generatorPolynomial(count) {
  let poly = [1]; // ascending degree
  for (let i = 1; i <= count; i += 1) {
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

  // Remainder is stored ascending; codewords are appended highest degree first.
  return ecc.slice().reverse();
}

/** ASCII encodation. Digit pairs pack into a single codeword. */
export function encodeAscii(text) {
  const codewords = [];
  let index = 0;

  while (index < text.length) {
    const isDigitPair =
      index + 1 < text.length &&
      text[index] >= "0" &&
      text[index] <= "9" &&
      text[index + 1] >= "0" &&
      text[index + 1] <= "9";

    if (isDigitPair) {
      codewords.push(130 + Number(text.slice(index, index + 2)));
      index += 2;
      continue;
    }

    const code = text.charCodeAt(index);
    if (code > 127) throw new Error(`Non-ASCII character at ${index}.`);
    codewords.push(code + 1);
    index += 1;
  }

  if (codewords.length > DATA_CODEWORDS) {
    throw new Error(
      `Payload needs ${codewords.length} codewords, 16x16 holds ${DATA_CODEWORDS}.`,
    );
  }

  // Pad: first pad is 129, the rest use the 253-state randomising algorithm.
  if (codewords.length < DATA_CODEWORDS) {
    codewords.push(129);
    while (codewords.length < DATA_CODEWORDS) {
      const position = codewords.length + 1; // 1-based
      const pseudoRandom = ((149 * position) % 253) + 1;
      const value = 129 + pseudoRandom;
      codewords.push(value <= 254 ? value : value - 254);
    }
  }

  return codewords;
}

/**
 * ISO/IEC 16022 Annex F symbol character placement.
 * `grid` holds codeword index + 1 so that 0 means "not yet placed".
 */
function placementGrid(rows, cols) {
  const grid = new Int32Array(rows * cols);

  const setBit = (row, col, codeword, bit) => {
    let r = row;
    let c = col;
    if (r < 0) {
      r += rows;
      c += 4 - ((rows + 4) % 8);
    }
    if (c < 0) {
      c += cols;
      r += 4 - ((cols + 4) % 8);
    }
    grid[r * cols + c] = codeword * 8 + bit + 1;
  };

  const block = (row, col, codeword) => {
    setBit(row - 2, col - 2, codeword, 7);
    setBit(row - 2, col - 1, codeword, 6);
    setBit(row - 1, col - 2, codeword, 5);
    setBit(row - 1, col - 1, codeword, 4);
    setBit(row - 1, col, codeword, 3);
    setBit(row, col - 2, codeword, 2);
    setBit(row, col - 1, codeword, 1);
    setBit(row, col, codeword, 0);
  };

  const corner1 = (codeword) => {
    setBit(rows - 1, 0, codeword, 7);
    setBit(rows - 1, 1, codeword, 6);
    setBit(rows - 1, 2, codeword, 5);
    setBit(0, cols - 2, codeword, 4);
    setBit(0, cols - 1, codeword, 3);
    setBit(1, cols - 1, codeword, 2);
    setBit(2, cols - 1, codeword, 1);
    setBit(3, cols - 1, codeword, 0);
  };

  const corner2 = (codeword) => {
    setBit(rows - 3, 0, codeword, 7);
    setBit(rows - 2, 0, codeword, 6);
    setBit(rows - 1, 0, codeword, 5);
    setBit(0, cols - 4, codeword, 4);
    setBit(0, cols - 3, codeword, 3);
    setBit(0, cols - 2, codeword, 2);
    setBit(0, cols - 1, codeword, 1);
    setBit(1, cols - 1, codeword, 0);
  };

  const corner3 = (codeword) => {
    setBit(rows - 3, 0, codeword, 7);
    setBit(rows - 2, 0, codeword, 6);
    setBit(rows - 1, 0, codeword, 5);
    setBit(0, cols - 2, codeword, 4);
    setBit(0, cols - 1, codeword, 3);
    setBit(1, cols - 1, codeword, 2);
    setBit(2, cols - 1, codeword, 1);
    setBit(3, cols - 1, codeword, 0);
  };

  const corner4 = (codeword) => {
    setBit(rows - 1, 0, codeword, 7);
    setBit(rows - 1, cols - 1, codeword, 6);
    setBit(0, cols - 3, codeword, 5);
    setBit(0, cols - 2, codeword, 4);
    setBit(0, cols - 1, codeword, 3);
    setBit(1, cols - 3, codeword, 2);
    setBit(1, cols - 2, codeword, 1);
    setBit(1, cols - 1, codeword, 0);
  };

  let codeword = 0;
  let row = 4;
  let col = 0;

  do {
    if (row === rows && col === 0) corner1(codeword++);
    if (row === rows - 2 && col === 0 && cols % 4) corner2(codeword++);
    if (row === rows - 2 && col === 0 && cols % 8 === 4) corner3(codeword++);
    if (row === rows + 4 && col === 2 && cols % 8 === 0) corner4(codeword++);

    // Diagonal sweep upward and to the right.
    do {
      if (row < rows && col >= 0 && !grid[row * cols + col]) {
        block(row, col, codeword++);
      }
      row -= 2;
      col += 2;
    } while (row >= 0 && col < cols);
    row += 1;
    col += 3;

    // Diagonal sweep downward and to the left.
    do {
      if (row >= 0 && col < cols && !grid[row * cols + col]) {
        block(row, col, codeword++);
      }
      row += 2;
      col -= 2;
    } while (row < rows && col >= 0);
    row += 3;
    col += 1;
  } while (row < rows || col < cols);

  // Unfilled bottom-right corner gets the fixed checkerboard.
  if (!grid[rows * cols - 1]) {
    grid[rows * cols - 1] = 1;
    grid[rows * cols - cols - 2] = 1;
  }

  return grid;
}

/**
 * @param {string} text ASCII payload
 * @returns {{ size: number, bits: Uint8Array }} 1 = dark module
 */
export function encodeDataMatrix16(text) {
  const data = encodeAscii(text);
  const codewords = [...data, ...reedSolomon(data, ECC_CODEWORDS)];

  const grid = placementGrid(REGION_SIZE, REGION_SIZE);
  const region = new Uint8Array(REGION_SIZE * REGION_SIZE);

  for (let i = 0; i < region.length; i += 1) {
    const marker = grid[i];
    if (marker === 1) {
      // Fixed corner checkerboard.
      const row = Math.floor(i / REGION_SIZE);
      const col = i % REGION_SIZE;
      region[i] = row === REGION_SIZE - 1 && col === REGION_SIZE - 1 ? 1 : 1;
      continue;
    }
    if (!marker) continue;
    const codewordIndex = Math.floor((marker - 1) / 8);
    const bit = (marker - 1) % 8;
    region[i] = (codewords[codewordIndex] >> bit) & 1;
  }

  // Wrap the data region in the ECC200 finder pattern.
  const bits = new Uint8Array(SYMBOL_SIZE * SYMBOL_SIZE);
  const at = (r, c) => r * SYMBOL_SIZE + c;

  for (let r = 0; r < SYMBOL_SIZE; r += 1) bits[at(r, 0)] = 1; // solid left
  for (let c = 0; c < SYMBOL_SIZE; c += 1) bits[at(SYMBOL_SIZE - 1, c)] = 1; // solid bottom
  for (let c = 0; c < SYMBOL_SIZE; c += 1) bits[at(0, c)] = c % 2 === 0 ? 1 : 0; // top clock
  for (let r = 0; r < SYMBOL_SIZE; r += 1) {
    bits[at(r, SYMBOL_SIZE - 1)] = (SYMBOL_SIZE - 1 - r) % 2 === 0 ? 1 : 0; // right clock
  }

  for (let r = 0; r < REGION_SIZE; r += 1) {
    for (let c = 0; c < REGION_SIZE; c += 1) {
      bits[at(r + 1, c + 1)] = region[r * REGION_SIZE + c];
    }
  }

  return { size: SYMBOL_SIZE, bits };
}

export const dataMatrixQuietModules = 1;
