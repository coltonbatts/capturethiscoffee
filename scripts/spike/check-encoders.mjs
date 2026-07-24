/**
 * Encoder self-check: renders each symbol at high magnification and asks
 * Apple's Vision framework to decode it. This validates the hand-rolled
 * Data Matrix and QR encoders against an independent, real-world detector
 * before any of it reaches a label.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { encodeDataMatrix16, dataMatrixQuietModules } from "./datamatrix.mjs";
import { encodeQrV1M, qrQuietModules } from "./qr.mjs";
import { buildVisionTool, decodeWithVision, visionToolAvailable } from "./vision.mjs";

const dataMatrixPayload = "1000281474976710";
const qrPayload = "HTTP://CTC.CO/K3M9QX";

if (!visionToolAvailable()) {
  console.log(
    "Skipped: encoder verification needs macOS with the Swift toolchain (swiftc).",
  );
  console.log("The render scripts still work; they skip the Vision check too.");
  process.exit(0);
}

const workDir = mkdtempSync(join(tmpdir(), "ctc-spike-"));
const visionTool = buildVisionTool(workDir);

function renderSymbol({ size, bits }, quietModules, modulePx) {
  const total = (size + quietModules * 2) * modulePx;
  const canvas = createCanvas(total, total);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = "#000000";

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!bits[r * size + c]) continue;
      ctx.fillRect(
        (c + quietModules) * modulePx,
        (r + quietModules) * modulePx,
        modulePx,
        modulePx,
      );
    }
  }

  return canvas.toBuffer("image/png");
}

let failures = 0;

function check(name, buffer, expectedSymbology, expectedPayload) {
  const file = join(workDir, `${name}.png`);
  writeFileSync(file, buffer);
  const results = decodeWithVision(visionTool, file);
  const match = results.find(
    (result) =>
      result.symbology === expectedSymbology && result.payload === expectedPayload,
  );

  if (match) {
    console.log(`  PASS  ${name} -> ${expectedSymbology} "${expectedPayload}"`);
    return;
  }

  failures += 1;
  console.log(`  FAIL  ${name} (${file})`);
  console.log(`        expected ${expectedSymbology} "${expectedPayload}"`);
  console.log(
    `        vision returned ${results.length ? JSON.stringify(results) : "nothing"}`,
  );
}

console.log("Data Matrix ECC200 16x16, ASCII encodation");
const dm = encodeDataMatrix16(dataMatrixPayload);
check(
  "datamatrix-x20",
  renderSymbol(dm, dataMatrixQuietModules, 20),
  "VNBarcodeSymbologyDataMatrix",
  dataMatrixPayload,
);

console.log("QR version 1, ECC M, alphanumeric");
const qr = encodeQrV1M(qrPayload);
console.log(`  (mask ${qr.mask} selected)`);
check(
  "qr-x20",
  renderSymbol(qr, qrQuietModules, 20),
  "VNBarcodeSymbologyQR",
  qrPayload,
);

if (failures) {
  console.error(`\n${failures} encoder check(s) failed. Artifacts in ${workDir}`);
  process.exit(1);
}
console.log("\nBoth encoders verified against Apple Vision.");

export {};
