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
  <rect x="18" y="18" width="56" height="318" fill="#000"/>
  <text x="46" y="177" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="900" text-anchor="middle" transform="rotate(-90 46 177)">CAPTURE  THIS  COFFEE</text>
  <rect x="506" y="38" width="48" height="48" fill="#fff" stroke="#000" stroke-width="4"/>
  <g transform="translate(530 62) rotate(-45)" stroke="#000" stroke-width="7">
    <path d="M-13.5 0H13.5M0 -13.5V13.5"/>
  </g>
  <text x="92" y="100" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="900" dominant-baseline="hanging">${main.toUpperCase()}</text>
  <line x1="92" y1="218" x2="554" y2="218" stroke="#000" stroke-width="4"/>
  <line x1="92" y1="282" x2="554" y2="282" stroke="#000" stroke-width="4"/>
  <text x="92" y="229" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" dominant-baseline="hanging">${body}</text>
  <text x="92" y="314" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" dominant-baseline="hanging">${footerStart.toUpperCase()}</text>
  <text x="285" y="314" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900" dominant-baseline="hanging">${footerEnd.toUpperCase()}</text>
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
