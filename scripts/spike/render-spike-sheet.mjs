/**
 * Physical scan spike sheet.
 *
 * Renders one 50x30mm / 300 DPI label carrying four candidate symbols so the
 * module size and symbology can be chosen from a real print on real stock
 * instead of from dot-gain theory.
 *
 *   A  Data Matrix, 10 dots/module
 *   B  QR version 1-M, 6 dots/module
 *   C  Data Matrix, 8 dots/module
 *   D  Data Matrix, 6 dots/module
 *
 * B and D share a module size, so B vs D isolates symbology and A vs C vs D
 * isolates module size.
 *
 * Usage: node scripts/spike/render-spike-sheet.mjs [outputPath]
 */

import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import preset from "../../src/lib/niimbot-m2-preset.json" with { type: "json" };
import { encodeDataMatrix16, dataMatrixQuietModules } from "./datamatrix.mjs";
import { encodeQrV1M, qrQuietModules } from "./qr.mjs";
import { buildVisionTool, decodeWithVision, visionToolAvailable } from "./vision.mjs";

// Each Data Matrix carries a distinct tail digit so a scan on the cup reports
// which symbol actually decoded. Same 16-digit shape as the real scheme.
const DATA_MATRIX_PAYLOADS = {
  A: "1000281474970001",
  C: "1000281474970003",
  D: "1000281474970004",
};
const QR_PAYLOAD = "HTTP://CTC.CO/K3M9QX";
const MM_PER_DOT = 25.4 / preset.dpi;

const outputPath = resolve(
  process.argv[2] || "docs/spike/scan-spike-sheet-1.png",
);

GlobalFonts.registerFromPath(
  join(process.cwd(), "public", "fonts", "Arial.ttf"),
  "Arial",
);
GlobalFonts.registerFromPath(
  join(process.cwd(), "public", "fonts", "Arial-Bold.ttf"),
  "Arial",
);

const qr = encodeQrV1M(QR_PAYLOAD);

/** Each entry's `side` is the full footprint including the quiet zone. */
const symbols = [
  {
    letter: "A",
    symbol: encodeDataMatrix16(DATA_MATRIX_PAYLOADS.A),
    quiet: dataMatrixQuietModules,
    dots: 10,
    kind: "DATA MATRIX",
    short: "DM",
    payload: DATA_MATRIX_PAYLOADS.A,
    expect: "VNBarcodeSymbologyDataMatrix",
    x: 20,
    y: 18,
  },
  {
    letter: "B",
    symbol: qr,
    quiet: qrQuietModules,
    dots: 6,
    kind: "QR V1-M",
    short: "QR",
    payload: QR_PAYLOAD,
    expect: "VNBarcodeSymbologyQR",
    x: 224,
    y: 18,
  },
  {
    letter: "C",
    symbol: encodeDataMatrix16(DATA_MATRIX_PAYLOADS.C),
    quiet: dataMatrixQuietModules,
    dots: 8,
    kind: "DATA MATRIX",
    short: "DM",
    payload: DATA_MATRIX_PAYLOADS.C,
    expect: "VNBarcodeSymbologyDataMatrix",
    x: 422,
    y: 18,
  },
  {
    letter: "D",
    symbol: encodeDataMatrix16(DATA_MATRIX_PAYLOADS.D),
    quiet: dataMatrixQuietModules,
    dots: 6,
    kind: "DATA MATRIX",
    short: "DM",
    payload: DATA_MATRIX_PAYLOADS.D,
    expect: "VNBarcodeSymbologyDataMatrix",
    x: 440,
    y: 196,
  },
].map((entry) => {
  const modules = entry.symbol.size + entry.quiet * 2;
  return { ...entry, modules, side: modules * entry.dots };
});

const canvas = createCanvas(preset.pixelWidth, preset.pixelHeight);
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, preset.pixelWidth, preset.pixelHeight);
ctx.fillStyle = "#000000";
ctx.textAlign = "start";
ctx.textBaseline = "alphabetic";

for (const entry of symbols) {
  const { symbol, quiet, dots, x, y } = entry;
  for (let row = 0; row < symbol.size; row += 1) {
    for (let col = 0; col < symbol.size; col += 1) {
      if (!symbol.bits[row * symbol.size + col]) continue;
      ctx.fillRect(
        x + (col + quiet) * dots,
        y + (row + quiet) * dots,
        dots,
        dots,
      );
    }
  }
}

// Per-symbol captions, placed clear of every quiet zone.
ctx.font = "700 13px Arial, Helvetica, sans-serif";
const captions = [
  { entry: symbols[0], x: 20, baseline: 218 },
  { entry: symbols[1], x: 224, baseline: 218 },
  { entry: symbols[2], x: 422, baseline: 182 },
  { entry: symbols[3], x: 440, baseline: 324 },
];
for (const { entry, x, baseline } of captions) {
  const mm = (entry.dots * MM_PER_DOT).toFixed(2);
  ctx.fillText(`${entry.letter}  ${entry.short} ${entry.dots}D ${mm}MM`, x, baseline);
}

// Legend.
ctx.font = "700 12px Arial, Helvetica, sans-serif";
const legend = [
  "CTC SCAN SPIKE 1 - 300 DPI / 50 X 30 MM",
  "DATA MATRIX PAYLOAD ENDS 0001=A 0003=C 0004=D",
  `QR B = ${QR_PAYLOAD}`,
  "B AND D SHARE A MODULE SIZE (0.51MM)",
  "RECORD WHICH LETTERS SCAN ON A CURVED CUP",
];
legend.forEach((line, index) => {
  ctx.fillText(line, 20, 248 + index * 18);
});

const rendered = canvas.toBuffer("image/png");

mkdirSync(dirname(outputPath), { recursive: true });
await sharp(rendered).withMetadata({ density: preset.dpi }).toFile(outputPath);

const metadata = await sharp(outputPath).metadata();
if (
  metadata.width !== preset.pixelWidth ||
  metadata.height !== preset.pixelHeight
) {
  throw new Error(
    `Expected ${preset.pixelWidth}x${preset.pixelHeight}, got ${metadata.width}x${metadata.height}.`,
  );
}
if (metadata.density !== preset.dpi) {
  throw new Error(`Expected ${preset.dpi} DPI, got ${metadata.density}.`);
}

console.log(`Wrote ${outputPath}`);
console.log(
  `  ${metadata.width}x${metadata.height}px @ ${metadata.density} DPI ` +
    `(${preset.widthMm}x${preset.heightMm}mm)`,
);
console.log("");
for (const entry of symbols) {
  const mm = (entry.dots * MM_PER_DOT).toFixed(3);
  const footprint = (entry.side * MM_PER_DOT).toFixed(2);
  console.log(
    `  ${entry.letter}  ${entry.kind.padEnd(11)} ` +
      `${String(entry.dots).padStart(2)} dots (${mm}mm) ` +
      `${entry.modules} modules -> ${String(entry.side).padStart(3)}px / ${footprint}mm`,
  );
}

// Confirm every symbol still decodes at final sheet scale.
if (!visionToolAvailable()) {
  console.log("\nSkipped Vision verification (needs macOS + swiftc).");
} else {
  const workDir = mkdtempSync(join(tmpdir(), "ctc-spike-verify-"));
  const binary = buildVisionTool(workDir);
  const results = decodeWithVision(binary, outputPath);

  console.log("\nApple Vision decode of the finished sheet:");
  let missing = 0;
  for (const entry of symbols) {
    const found = results.filter(
      (result) =>
        result.symbology === entry.expect && result.payload === entry.payload,
    ).length;
    if (!found) missing += 1;
    console.log(`  ${entry.letter}  ${found ? "decoded" : "NOT DECODED"}`);
  }
  console.log(`  ${results.length} symbol(s) detected in total.`);

  if (missing) {
    console.log(
      `\nNote: ${missing} symbol(s) did not decode from the flat digital sheet.`,
    );
  }
}
