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

function renderCoffeeLabelPngBlob(label: CoffeeLabel) {
  const canvas = document.createElement("canvas");
  canvas.width = niimbotM2ExportPreset.pixelWidth;
  canvas.height = niimbotM2ExportPreset.pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available in this browser.");

  drawNiimbotM2Label(ctx, label);

  const dataUrl = canvas.toDataURL("image/png");
  const byteString = atob(dataUrl.split(",")[1] || "");
  const bytes = new Uint8Array(byteString.length);
  for (let index = 0; index < byteString.length; index += 1) {
    bytes[index] = byteString.charCodeAt(index);
  }

  return new Blob([bytes], { type: "image/png" });
}

function drawNiimbotM2Label(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth, pixelHeight, safeMarginPx } = niimbotM2ExportPreset;
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

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

  ctx.strokeRect(42, 42, 80, 80);
  drawCaptureMark(ctx, 82, 82, 48);

  ctx.fillStyle = "#000000";
  ctx.font = "900 39px Arial, Helvetica, sans-serif";
  drawWrappedText(ctx, main, 146, 48, 385, 42, 2);

  ctx.font = "900 28px Arial, Helvetica, sans-serif";
  drawWrappedText(ctx, body, 42, 154, 508, 34, 3);

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(42, 282);
  ctx.lineTo(550, 282);
  ctx.stroke();

  ctx.font = "900 17px Arial, Helvetica, sans-serif";
  drawEllipsisText(ctx, label.footerStart, 42, 316, 185);
  drawEllipsisText(ctx, label.footerEnd, 250, 316, 300);
}

function drawWrappedText(
  ctx: CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
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

  lines.slice(0, maxLines).forEach((value, index) => {
    drawEllipsisText(ctx, value, x, y + index * lineHeight, maxWidth);
  });
}

function drawEllipsisText(
  ctx: CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
) {
  let value = text;
  while (value && ctx.measureText(value).width > maxWidth) {
    value = `${value.slice(0, -2)}...`;
  }
  ctx.fillText(value, x, y);
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

function safeFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "label"
  );
}
