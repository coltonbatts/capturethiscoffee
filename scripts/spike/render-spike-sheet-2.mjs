/**
 * Physical scan spike sheet 2 — realistic QR.
 *
 * Sheet 1 tested QR against a short domain that does not exist. This sheet
 * tests QR carrying the real deployment host, coffee.capturethis.com, which
 * pushes the symbol to version 2.
 *
 *   E  QR version 2, ECC M, 6 dots/module
 *   F  Data Matrix ECC200 16x16, 8 dots/module — control, repeats sheet 1 C
 *
 * F lets results be compared across the two prints: if F decodes here but C
 * did not on sheet 1, the difference is print quality, not symbol design.
 *
 * Usage: node scripts/spike/render-spike-sheet-2.mjs [outputPath]
 */

import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import preset from "../../src/lib/niimbot-m2-preset.json" with { type: "json" };
import { encodeDataMatrix16, dataMatrixQuietModules } from "./datamatrix.mjs";
import { encodeQr, qrQuietModules } from "./qr.mjs";
import { buildVisionTool, decodeWithVision, visionToolAvailable } from "./vision.mjs";

// The real deployment host plus a 6-character code. A 4-character code encodes
// to the same version 2 symbol against this host, so the longer code is free.
const QR_PAYLOAD = "HTTPS://COFFEE.CAPTURETHIS.COM/K3M9QX";
const DATA_MATRIX_PAYLOAD = "1000281474970005"; // tail 0005 = F
const MM_PER_DOT = 25.4 / preset.dpi;

const outputPath = resolve(
  process.argv[2] || "docs/spike/scan-spike-sheet-2.png",
);

GlobalFonts.registerFromPath(
  join(process.cwd(), "public", "fonts", "Arial.ttf"),
  "Arial",
);
GlobalFonts.registerFromPath(
  join(process.cwd(), "public", "fonts", "Arial-Bold.ttf"),
  "Arial",
);

const qr = encodeQr(QR_PAYLOAD);
if (qr.version !== 2) {
  throw new Error(`Expected the realistic payload to need version 2, got ${qr.version}.`);
}

const symbols = [
  {
    letter: "E",
    symbol: qr,
    quiet: qrQuietModules,
    dots: 6,
    kind: `QR V${qr.version}-M`,
    short: `QR V${qr.version}-M`,
    payload: QR_PAYLOAD,
    expect: "VNBarcodeSymbologyQR",
    x: 20,
    y: 16,
  },
  {
    letter: "F",
    symbol: encodeDataMatrix16(DATA_MATRIX_PAYLOAD),
    quiet: dataMatrixQuietModules,
    dots: 8,
    kind: "DATA MATRIX",
    short: "DM",
    payload: DATA_MATRIX_PAYLOAD,
    expect: "VNBarcodeSymbologyDataMatrix",
    x: 250,
    y: 16,
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

ctx.font = "700 13px Arial, Helvetica, sans-serif";
ctx.fillText("E  QR V2-M 6D 0.51MM", 20, 234);
ctx.fillText("F  DM 8D 0.68MM (CONTROL)", 250, 180);

ctx.font = "700 12px Arial, Helvetica, sans-serif";
const legend = [
  "CTC SCAN SPIKE 2 - 300 DPI / 50 X 30 MM",
  "E  QR V2-M  6 DOTS  0.51MM  16.76MM",
  QR_PAYLOAD,
  "F  DATA MATRIX  8 DOTS  0.68MM  12.19MM",
  "F REPEATS SHEET 1 C - PAYLOAD ENDS 0005",
];
legend.forEach((line, index) => {
  const baseline = 206 + index * 18;
  const width = ctx.measureText(line).width;
  if (250 + width > preset.pixelWidth - preset.safeMarginPx) {
    throw new Error(`Legend line overruns the safe margin: "${line}"`);
  }
  ctx.fillText(line, 250, baseline);
});

const rendered = canvas.toBuffer("image/png");

mkdirSync(dirname(outputPath), { recursive: true });
await sharp(rendered).withMetadata({ density: preset.dpi }).toFile(outputPath);

const metadata = await sharp(outputPath).metadata();
if (
  metadata.width !== preset.pixelWidth ||
  metadata.height !== preset.pixelHeight ||
  metadata.density !== preset.dpi
) {
  throw new Error(
    `Expected ${preset.pixelWidth}x${preset.pixelHeight} @ ${preset.dpi} DPI, ` +
      `got ${metadata.width}x${metadata.height} @ ${metadata.density}.`,
  );
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
      `${entry.symbol.size}x${entry.symbol.size} symbol, ${entry.modules} modules ` +
      `-> ${entry.side}px / ${footprint}mm`,
  );
}

if (!visionToolAvailable()) {
  console.log("\nSkipped Vision verification (needs macOS + swiftc).");
} else {
  const workDir = mkdtempSync(join(tmpdir(), "ctc-spike2-verify-"));
  const binary = buildVisionTool(workDir);
  const results = decodeWithVision(binary, outputPath);

  console.log("\nApple Vision decode of the finished sheet:");
  for (const entry of symbols) {
    const found = results.some(
      (result) =>
        result.symbology === entry.expect && result.payload === entry.payload,
    );
    console.log(`  ${entry.letter}  ${found ? "decoded" : "NOT DECODED"}`);
  }
}
