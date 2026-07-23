import m2Preset from "@/lib/niimbot-m2-preset.json";
import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId, type LabelDesignId } from "@/lib/label-designs";

export const niimbotM2ExportPreset = m2Preset;

type CanvasContext = CanvasRenderingContext2D;

/** Six typographic compositions for 50x30mm, 300 DPI, 1-bit thermal output. */
export function drawNiimbotM2Label(
  ctx: CanvasContext,
  label: CoffeeLabel,
  designId: LabelDesignId = defaultLabelDesignId,
) {
  switch (designId) {
    case "grid-02":
      drawGrid02(ctx, label);
      return;
    case "instrument":
      drawInstrument(ctx, label);
      return;
    case "contact":
      drawContact(ctx, label);
      return;
    case "caption":
      drawCaption(ctx, label);
      return;
    case "block":
      drawBlock(ctx, label);
      return;
    default:
      drawGrid01(ctx, label);
  }
}

/** Swiss grid: asymmetric index rail and a strong left-aligned hierarchy. */
function drawGrid01(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelHeight } = niimbotM2ExportPreset;
  const left = 62;
  const right = 563;
  const width = right - left;

  resetCanvas(ctx);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 34, pixelHeight);
  drawRotatedRailText(ctx, "01", 23, pixelHeight - 24, "#ffffff");

  drawMetaRow(ctx, "CAPTURE THIS COFFEE", `NO. ${orderNumber(label)}`, left, right, 40);
  ctx.fillRect(left, 57, width, 2);

  ctx.font = "700 16px Arial, Helvetica, sans-serif";
  ctx.fillText("FOR", left, 94);
  drawResponsiveName(ctx, labelName(label), left, 151, width, {
    shortSize: 92,
    longSize: 62,
    longY: 139,
    lineHeight: 57,
    minSize: 29,
  });

  ctx.font = "700 28px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelDrink(label), left, 263, width, 29, 2, 18);
  ctx.fillRect(left, 293, width, 2);
  drawMetaRow(ctx, labelProduction(label), label.group || "ON SET", left, right, 327);
}

/** Swiss grid: a wide index column and more negative space. */
function drawGrid02(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelHeight } = niimbotM2ExportPreset;
  const railWidth = 104;
  const left = 132;
  const right = 562;
  const width = right - left;

  resetCanvas(ctx);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, railWidth, pixelHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px Arial, Helvetica, sans-serif";
  ctx.fillText("02", 19, 323);
  ctx.font = "700 14px Arial, Helvetica, sans-serif";
  drawRotatedRailText(ctx, "COFFEE SERVICE", 72, 35, "#ffffff", Math.PI / 2);

  ctx.fillStyle = "#000000";
  drawMetaRow(ctx, "CTC / GRID", `ORDER ${orderNumber(label)}`, left, right, 40);
  ctx.fillRect(left, 57, width, 2);
  drawResponsiveName(ctx, labelName(label), left, 157, width, {
    shortSize: 82,
    longSize: 56,
    longY: 132,
    lineHeight: 53,
    minSize: 27,
  });
  ctx.font = "700 27px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelDrink(label), left, 255, width, 29, 2, 17);
  ctx.fillRect(left, 292, width, 2);
  drawMetaRow(ctx, labelProduction(label), label.group || "ON SET", left, right, 326);
}

/** German industrial information design: numbered functions and a control dial. */
function drawInstrument(ctx: CanvasContext, label: CoffeeLabel) {
  const left = 29;
  const right = 562;

  resetCanvas(ctx);
  ctx.fillStyle = "#000000";
  drawMetaRow(ctx, "CTC / COFFEE SERVICE", "SYSTEM 03", left, right, 39);
  ctx.fillRect(left, 56, right - left, 2);

  drawIndexLabel(ctx, "01 / PERSON", left, 91);
  ctx.font = "900 58px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelName(label).toUpperCase(), left, 151, 384, 55, 1, 27);

  drawIndexLabel(ctx, "02 / ORDER", left, 199);
  ctx.font = "700 27px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelDrink(label), left, 238, 384, 29, 2, 17);

  const dialX = 499;
  const dialY = 164;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(dialX, dialY, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillRect(dialX - 1, 90, 2, 16);
  ctx.font = "700 13px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("03", dialX, dialY - 12);
  ctx.font = "900 34px Arial, Helvetica, sans-serif";
  drawEllipsisText(ctx, orderNumber(label), dialX, dialY + 25, 94);
  ctx.textAlign = "start";

  ctx.fillRect(left, 293, right - left, 2);
  drawMetaRow(ctx, labelProduction(label), label.group || "ON SET", left, right, 327);
}

/** Fashion contact sheet: crop marks, frame data, and an editorial name block. */
function drawContact(ctx: CanvasContext, label: CoffeeLabel) {
  const left = 45;
  const right = 548;
  const width = right - left;

  resetCanvas(ctx);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  drawCropMarks(ctx, 19, 19, 553, 316);
  drawMetaRow(ctx, `FRAME ${orderNumber(label)}`, "CTC / 50X30", left, right, 45);
  ctx.fillRect(left, 62, width, 2);

  drawResponsiveName(ctx, labelName(label), left, 162, 445, {
    shortSize: 86,
    longSize: 59,
    longY: 135,
    lineHeight: 55,
    minSize: 27,
  });
  ctx.font = "700 27px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelDrink(label), left, 260, 445, 29, 2, 17);
  drawMetaRow(ctx, labelProduction(label), label.group || "ON SET", left, right, 316);

  ctx.save();
  ctx.translate(566, 177);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.font = "700 13px Arial, Helvetica, sans-serif";
  ctx.fillText("CONTACT", 0, 0);
  ctx.restore();
}

/** Editorial caption: generous white space and gallery-label precision. */
function drawCaption(ctx: CanvasContext, label: CoffeeLabel) {
  const left = 34;
  const right = 557;
  const width = right - left;

  resetCanvas(ctx);
  ctx.fillStyle = "#000000";
  drawMetaRow(ctx, "CAPTURE THIS COFFEE", `NO. ${orderNumber(label)}`, left, right, 41);

  ctx.font = "700 15px Arial, Helvetica, sans-serif";
  ctx.fillText("COFFEE FOR", left, 118);
  drawResponsiveName(ctx, labelName(label), left, 199, width, {
    shortSize: 78,
    longSize: 54,
    longY: 177,
    lineHeight: 50,
    minSize: 26,
  });
  ctx.font = "700 27px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelDrink(label), left, 263, width, 29, 2, 17);
  ctx.fillRect(left, 294, width, 2);
  drawMetaRow(ctx, labelProduction(label), label.group || "ON SET", left, right, 327);
}

/** Brutalist field: raw scale, hard contrast, no decoration. */
function drawBlock(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth } = niimbotM2ExportPreset;
  const left = 27;
  const right = pixelWidth - 27;
  const width = right - left;

  resetCanvas(ctx);
  ctx.fillStyle = "#000000";
  drawMetaRow(ctx, "CTC / SERVICE LABEL", `NO. ${orderNumber(label)}`, left, right, 39);
  ctx.fillRect(0, 62, pixelWidth, 190);

  ctx.fillStyle = "#ffffff";
  const name = labelName(label).toUpperCase();
  const longName = name.length > 18;
  ctx.font = `900 ${longName ? 58 : 86}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(ctx, name, left, longName ? 145 : 176, width, longName ? 55 : 86, longName ? 2 : 1, 28);

  ctx.fillStyle = "#000000";
  ctx.font = "900 30px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, labelDrink(label).toUpperCase(), left, 301, width, 31, 1, 18);
  drawMetaRow(ctx, labelProduction(label), label.group || "ON SET", left, right, 335);
}

function resetCanvas(ctx: CanvasContext) {
  const { pixelWidth, pixelHeight } = niimbotM2ExportPreset;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  ctx.setLineDash([]);
}

function drawResponsiveName(
  ctx: CanvasContext,
  value: string,
  x: number,
  shortY: number,
  maxWidth: number,
  profile: {
    shortSize: number;
    longSize: number;
    longY: number;
    lineHeight: number;
    minSize: number;
  },
) {
  const name = value.toUpperCase();
  const isLong = name.length > 18;
  ctx.font = `900 ${isLong ? profile.longSize : profile.shortSize}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(
    ctx,
    name,
    x,
    isLong ? profile.longY : shortY,
    maxWidth,
    isLong ? profile.lineHeight : profile.shortSize,
    isLong ? 2 : 1,
    profile.minSize,
  );
}

function drawIndexLabel(ctx: CanvasContext, value: string, x: number, y: number) {
  ctx.font = "700 14px Arial, Helvetica, sans-serif";
  ctx.fillText(value, x, y);
}

function drawMetaRow(
  ctx: CanvasContext,
  leftText: string,
  rightText: string,
  left: number,
  right: number,
  y: number,
) {
  const width = right - left;
  ctx.font = "700 14px Arial, Helvetica, sans-serif";
  ctx.textAlign = "start";
  drawEllipsisText(ctx, leftText.toUpperCase(), left, y, width * 0.68);
  ctx.textAlign = "right";
  drawEllipsisText(ctx, rightText.toUpperCase(), right, y, width * 0.28);
  ctx.textAlign = "start";
}

function drawRotatedRailText(
  ctx: CanvasContext,
  value: string,
  x: number,
  y: number,
  color: string,
  rotation = -Math.PI / 2,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.font = "900 18px Arial, Helvetica, sans-serif";
  ctx.fillText(value, 0, 0);
  ctx.restore();
}

function drawCropMarks(
  ctx: CanvasContext,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  const length = 20;
  drawLine(ctx, left, top, left + length, top);
  drawLine(ctx, left, top, left, top + length);
  drawLine(ctx, left + width, top, left + width - length, top);
  drawLine(ctx, left + width, top, left + width, top + length);
  drawLine(ctx, left, top + height, left + length, top + height);
  drawLine(ctx, left, top + height, left, top + height - length);
  drawLine(ctx, left + width, top + height, left + width - length, top + height);
  drawLine(ctx, left + width, top + height, left + width, top + height - length);
}

function drawLine(
  ctx: CanvasContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
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
    nextLineHeight = Math.max(nextLineHeight - 0.8, minFontSize * 0.9);
    ctx.font = originalFont.replace(/(\d+(?:\.\d+)?)px/, `${nextFontSize}px`);
    lines = wrappedLines(ctx, text, maxWidth, maxLines);
  }

  const truncated = wrappedLines(ctx, text, maxWidth, maxLines + 1).length > maxLines;
  lines.slice(0, maxLines).forEach((line, index) => {
    const isLast = index === Math.min(lines.length, maxLines) - 1;
    drawEllipsisText(
      ctx,
      truncated && isLast ? `${line}...` : line,
      x,
      y + index * nextLineHeight,
      maxWidth,
    );
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
  if (ctx.measureText("...").width > maxWidth) return "";

  let low = 0;
  let high = text.length;
  let best = "";
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}...`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function labelName(label: CoffeeLabel) {
  return (label.personName || label.title).trim();
}

function labelDrink(label: CoffeeLabel) {
  return (label.drink || label.bodyLines.join(" / ")).trim();
}

function labelProduction(label: CoffeeLabel) {
  return (label.productionClient || "Capture This Coffee").trim();
}

function orderNumber(label: CoffeeLabel) {
  return label.orderId.trim().replace(/^#/, "") || "—";
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
