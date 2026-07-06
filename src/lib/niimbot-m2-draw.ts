import m2Preset from "@/lib/niimbot-m2-preset.json";
import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId, type LabelDesignId } from "@/lib/label-designs";

export const niimbotM2ExportPreset = m2Preset;

type CanvasContext = CanvasRenderingContext2D;
type CaptureSmileyImage = CanvasImageSource;

/**
 * Capture This Coffee label designs, 50x30mm @ 300 DPI (591x354px),
 * monochrome-friendly. "smiley": smiley, name, drink on white.
 * "knockout": full-bleed black, white wordmark/name/drink.
 */
export function drawNiimbotM2Label(
  ctx: CanvasContext,
  label: CoffeeLabel,
  captureSmiley: CaptureSmileyImage | null,
  designId: LabelDesignId = defaultLabelDesignId,
) {
  if (designId === "knockout") {
    drawKnockoutLabel(ctx, label);
    return;
  }
  drawSmileyLabel(ctx, label, captureSmiley);
}

function drawSmileyLabel(
  ctx: CanvasContext,
  label: CoffeeLabel,
  captureSmiley: CaptureSmileyImage | null,
) {
  const { pixelHeight } = niimbotM2ExportPreset;
  const name = (label.personName || label.title).trim();
  const drink = (label.drink || label.bodyLines.join(" / ")).trim();
  const nameProfile = labelNameProfile(name);

  resetCanvas(ctx);

  const smileySize = 208;
  if (captureSmiley) {
    drawCaptureSmiley(ctx, captureSmiley, 34, (pixelHeight - smileySize) / 2, smileySize);
  }

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

/**
 * Knockout: full-bleed black, white type. Wordmark top-left, name as the
 * hero, rule, drink line, production + order id along the bottom.
 */
function drawKnockoutLabel(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth, pixelHeight } = niimbotM2ExportPreset;
  const name = (label.personName || label.title).trim();
  const drink = (label.drink || label.bodyLines.join(" / ")).trim();
  const footerStart = (label.productionClient || "CAPTURE THIS COFFEE").toUpperCase();
  const footerEnd = label.orderId.trim();

  const textX = 34;
  const textRight = pixelWidth - 34;
  const textWidth = textRight - textX;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";

  // Wordmark (placeholder for the brand script).
  ctx.font = "italic 900 40px Arial, Helvetica, sans-serif";
  drawEllipsisText(ctx, "Capture This", textX, 66, textWidth);

  // Name hero: single line, shrink to fit (floor low enough that even long
  // full names stay whole instead of truncating).
  ctx.font = "900 94px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, name.toUpperCase(), textX, 186, textWidth, 94, 1, 26);

  // Rule.
  ctx.fillRect(textX, 208, textWidth, 3);

  // Drink: single line, shrink to fit.
  ctx.font = "700 32px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, drink.toUpperCase(), textX, 262, textWidth, 34, 1, 18);

  // Footer: production/client left, order id right.
  ctx.font = "700 20px Arial, Helvetica, sans-serif";
  const footerY = pixelHeight - 30;
  const footerEndWidth = footerEnd ? ctx.measureText(footerEnd).width : 0;
  drawEllipsisText(
    ctx,
    footerStart,
    textX,
    footerY,
    textWidth - (footerEndWidth ? footerEndWidth + 24 : 0),
  );
  if (footerEnd) {
    ctx.fillText(footerEnd, textRight - footerEndWidth, footerY);
  }
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
