import m2Preset from "@/lib/niimbot-m2-preset.json";
import type { CoffeeLabel } from "@/lib/label-copy";
import type { LabelPrintJobPayloadV1 } from "@/lib/print-jobs";

export const niimbotM2ExportPreset = m2Preset;

type CanvasContext = CanvasRenderingContext2D;

export function niimbotM2ExportFileName(title: string) {
  return `${safeFilePart(title)}-niimbot-m2-50x30mm-300dpi.png`;
}

export function renderNiimbotM2LabelPngBlob(payload: LabelPrintJobPayloadV1) {
  return renderCoffeeLabelPngBlob(payload.label);
}

async function renderCoffeeLabelPngBlob(label: CoffeeLabel) {
  const canvas = document.createElement("canvas");
  canvas.width = niimbotM2ExportPreset.pixelWidth;
  canvas.height = niimbotM2ExportPreset.pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available in this browser.");

  drawNiimbotM2Label(ctx, label);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the label PNG."));
    }, "image/png");
  });
}

function drawNiimbotM2Label(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth, pixelHeight, safeMarginPx } = niimbotM2ExportPreset;
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;
  const nameProfile = labelNameProfile(main);

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    safeMarginPx,
    safeMarginPx,
    pixelWidth - safeMarginPx * 2,
    pixelHeight - safeMarginPx * 2,
  );

  ctx.fillStyle = "#000000";
  ctx.fillRect(18, 18, 56, 318);
  drawVerticalBrand(ctx, 46, 177);

  ctx.strokeRect(506, 38, 48, 48);
  drawCaptureMark(ctx, 530, 62, 27);

  ctx.fillStyle = "#000000";
  ctx.font = `900 ${nameProfile.fontSize}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(
    ctx,
    main.toUpperCase(),
    92,
    nameProfile.y,
    402,
    nameProfile.lineHeight,
    2,
    nameProfile.minFontSize,
  );

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(92, 218);
  ctx.lineTo(554, 218);
  ctx.moveTo(92, 282);
  ctx.lineTo(554, 282);
  ctx.stroke();

  ctx.font = "900 22px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, body, 92, 229, 462, 22, 3, 17);

  ctx.font = "900 17px Arial, Helvetica, sans-serif";
  drawEllipsisText(ctx, label.footerStart.toUpperCase(), 92, 314, 172);
  drawEllipsisText(ctx, label.footerEnd.toUpperCase(), 285, 314, 270);
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

  while (
    nextFontSize > minFontSize &&
    lines.some((line) => ctx.measureText(line).width > maxWidth)
  ) {
    nextFontSize -= 1;
    nextLineHeight = Math.max(nextLineHeight - 0.8, minFontSize * 0.84);
    ctx.font = originalFont.replace(/(\d+(?:\.\d+)?)px/, `${nextFontSize}px`);
    lines = wrappedLines(ctx, text, maxWidth, maxLines);
  }

  lines.slice(0, maxLines).forEach((value, index) => {
    drawEllipsisText(ctx, value, x, y + index * nextLineHeight, maxWidth);
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

function drawCaptureMark(
  ctx: CanvasContext,
  centerX: number,
  centerY: number,
  size: number,
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-Math.PI / 4);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(-size / 2, 0);
  ctx.lineTo(size / 2, 0);
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(0, size / 2);
  ctx.stroke();
  ctx.restore();
}

function drawVerticalBrand(ctx: CanvasContext, centerX: number, centerY: number) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 13px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CAPTURE  THIS  COFFEE", 0, 5);
  ctx.restore();
  ctx.textAlign = "start";
}

function labelNameProfile(value: string) {
  const length = value.trim().replace(/\s+/g, " ").length;
  if (length <= 10) {
    return { fontSize: 50, lineHeight: 45, minFontSize: 38, y: 112 };
  }
  if (length <= 20) {
    return { fontSize: 61, lineHeight: 52, minFontSize: 42, y: 89 };
  }
  if (length <= 24) {
    return { fontSize: 51, lineHeight: 44, minFontSize: 34, y: 83 };
  }
  return { fontSize: 38, lineHeight: 35, minFontSize: 26, y: 80 };
}

function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "label"
  );
}
