import m2Preset from "@/lib/niimbot-m2-preset.json";
import type { CoffeeLabel } from "@/lib/label-copy";

export const niimbotM2ExportPreset = m2Preset;

type CanvasContext = CanvasRenderingContext2D;
type CaptureSmileyImage = CanvasImageSource;

/**
 * The one Capture This Coffee label: smiley, name, drink.
 * 50x30mm @ 300 DPI (591x354px), monochrome-friendly.
 */
export function drawNiimbotM2Label(
  ctx: CanvasContext,
  label: CoffeeLabel,
  captureSmiley: CaptureSmileyImage,
) {
  const { pixelHeight } = niimbotM2ExportPreset;
  const name = (label.personName || label.title).trim();
  const drink = (label.drink || label.bodyLines.join(" / ")).trim();
  const nameProfile = labelNameProfile(name);

  resetCanvas(ctx);

  const smileySize = 208;
  drawCaptureSmiley(ctx, captureSmiley, 34, (pixelHeight - smileySize) / 2, smileySize);

  const textX = 274;
  const textWidth = 283;

  ctx.fillStyle = "#000000";
  ctx.font = `900 ${nameProfile.fontSize}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(
    ctx,
    name.toUpperCase(),
    textX,
    nameProfile.y,
    textWidth,
    nameProfile.lineHeight,
    2,
    nameProfile.minFontSize,
  );

  ctx.font = "700 27px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, drink, textX, 262, textWidth, 29, 2, 18);
}

function resetCanvas(ctx: CanvasContext) {
  const { pixelWidth, pixelHeight } = niimbotM2ExportPreset;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawFittedWrappedText(
  ctx: CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  minFontSize: number,
) {
  const originalFont = ctx.font;
  const fontSize = Number(originalFont.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
  let nextFontSize = fontSize;
  let nextLineHeight = lineHeight;
  let lines = wrappedLines(ctx, text, maxWidth, maxLines);

  const overflowing = () =>
    lines.some((line) => ctx.measureText(line).width > maxWidth) ||
    wrappedLines(ctx, text, maxWidth, maxLines + 1).length > maxLines;

  while (nextFontSize > minFontSize && overflowing()) {
    nextFontSize -= 1;
    nextLineHeight = Math.max(nextLineHeight - 0.8, minFontSize * 0.84);
    ctx.font = originalFont.replace(/(\d+(?:\.\d+)?)px/, `${nextFontSize}px`);
    lines = wrappedLines(ctx, text, maxWidth, maxLines);
  }

  const truncated =
    wrappedLines(ctx, text, maxWidth, maxLines + 1).length > maxLines;

  lines.slice(0, maxLines).forEach((value, index) => {
    const isLast = index === Math.min(lines.length, maxLines) - 1;
    const line = truncated && isLast ? `${value}...` : value;
    drawEllipsisText(ctx, line, x, y + index * nextLineHeight, maxWidth);
  });

  ctx.font = originalFont;
}

function wrappedLines(
  ctx: CanvasContext,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  return lines.slice(0, maxLines);
}

function drawEllipsisText(
  ctx: CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  const value = ellipsizeToWidth(ctx, text, maxWidth);
  if (value) ctx.fillText(value, x, y);
}

function ellipsizeToWidth(ctx: CanvasContext, text: string, maxWidth: number) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;

  const ellipsis = "...";
  if (ctx.measureText(ellipsis).width > maxWidth) return "";

  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}${ellipsis}`;

    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function drawCaptureSmiley(
  ctx: CanvasContext,
  captureSmiley: CaptureSmileyImage,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(captureSmiley, x, y, size, size);
  ctx.restore();
}

function labelNameProfile(value: string) {
  const length = value.trim().replace(/\s+/g, " ").length;
  if (length <= 10) {
    return { fontSize: 64, lineHeight: 56, minFontSize: 42, y: 132 };
  }
  if (length <= 20) {
    return { fontSize: 52, lineHeight: 46, minFontSize: 36, y: 112 };
  }
  if (length <= 24) {
    return { fontSize: 44, lineHeight: 39, minFontSize: 30, y: 104 };
  }
  return { fontSize: 36, lineHeight: 33, minFontSize: 24, y: 98 };
}

export function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "label"
  );
}
