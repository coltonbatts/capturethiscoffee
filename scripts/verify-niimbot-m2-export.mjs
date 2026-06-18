import { readFile } from "node:fs/promises";
import sharp from "sharp";

const preset = JSON.parse(
  await readFile(new URL("../src/lib/niimbot-m2-preset.json", import.meta.url), "utf8"),
);

const expected = {
  pixelWidth: 591,
  pixelHeight: 354,
  safeMarginPx: 18,
  printableWidthPx: 567,
};

for (const [key, value] of Object.entries(expected)) {
  if (preset[key] !== value) {
    throw new Error(`Expected ${key} to be ${value}, got ${preset[key]}.`);
  }
}

const svg = renderSampleSvg();
const png = await sharp(Buffer.from(svg)).png().toBuffer();
const metadata = await sharp(png).metadata();

if (metadata.width !== preset.pixelWidth || metadata.height !== preset.pixelHeight) {
  throw new Error(
    `Expected PNG ${preset.pixelWidth}x${preset.pixelHeight}, got ${metadata.width}x${metadata.height}.`,
  );
}

const {
  data: raw,
  info,
} = await sharp(png).raw().toBuffer({ resolveWithObject: true });
assertWhiteEdge(raw, info.width, info.channels, 0, "top edge");
assertWhiteEdge(raw, info.width, info.channels, info.height - 1, "bottom edge");
assertSafeMarginHasInk(
  raw,
  info.width,
  info.channels,
  preset.safeMarginPx,
  preset.safeMarginPx,
);

console.log(
  `NIIMBOT M2 export verified: ${metadata.width}x${metadata.height}px PNG, ${preset.safeMarginPx}px safe margin, ${preset.printableWidthPx}px effective printable width.`,
);

function renderSampleSvg() {
  const main = "Jordan Lee";
  const body = "Iced oat latte / half sweet / cinnamon";
  const footerStart = "Camera Team #A1B2C3";
  const footerEnd = "Capture This Coffee";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${preset.pixelWidth}" height="${preset.pixelHeight}" viewBox="0 0 ${preset.pixelWidth} ${preset.pixelHeight}">
  <rect width="100%" height="100%" fill="#fff"/>
  <rect x="${preset.safeMarginPx}" y="${preset.safeMarginPx}" width="${preset.pixelWidth - preset.safeMarginPx * 2}" height="${preset.pixelHeight - preset.safeMarginPx * 2}" fill="none" stroke="#000" stroke-width="4"/>
  <rect x="42" y="42" width="80" height="80" fill="none" stroke="#000" stroke-width="4"/>
  <g transform="translate(82 82) rotate(-45)" stroke="#000" stroke-width="7">
    <path d="M-24 0H24M0 -24V24"/>
  </g>
  <text x="146" y="48" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="39" font-weight="900" dominant-baseline="hanging">${main}</text>
  <text x="42" y="154" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" dominant-baseline="hanging">${body}</text>
  <line x1="42" y1="282" x2="550" y2="282" stroke="#000" stroke-width="3"/>
  <text x="42" y="303" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" dominant-baseline="hanging">${footerStart}</text>
  <text x="250" y="303" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" dominant-baseline="hanging">${footerEnd}</text>
</svg>`;
}

function assertWhiteEdge(raw, width, channels, row, label) {
  for (let x = 0; x < width; x += 1) {
    const offset = (row * width + x) * channels;
    if (raw[offset] !== 255 || raw[offset + 1] !== 255 || raw[offset + 2] !== 255) {
      throw new Error(`${label} is not empty white space at x=${x}.`);
    }
  }
}

function assertSafeMarginHasInk(raw, width, channels, x, y) {
  const searchRadius = 4;
  for (let row = y - searchRadius; row <= y + searchRadius; row += 1) {
    for (let column = x - searchRadius; column <= x + searchRadius; column += 1) {
      const offset = (row * width + column) * channels;
      if (raw[offset] === 0 && raw[offset + 1] === 0 && raw[offset + 2] === 0) {
        return;
      }
    }
  }
  throw new Error("Expected border ink at the configured safe margin.");
}
