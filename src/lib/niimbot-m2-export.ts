import m2Preset from "@/lib/niimbot-m2-preset.json";
import type { LabelDesignId } from "@/lib/label-designs";
import type { CoffeeLabel } from "@/lib/label-copy";

export const niimbotM2ExportPreset = m2Preset;

type CanvasContext = CanvasRenderingContext2D;

export function niimbotM2ExportFileName(
  label: Pick<CoffeeLabel, "personName" | "title" | "orderId"> | string,
  designId?: LabelDesignId,
) {
  const title =
    typeof label === "string"
      ? label
      : [label.personName || label.title, label.orderId.replace(/^#/, "")]
          .filter(Boolean)
          .join("-");
  const designPart = designId && designId !== "classic" ? `-${designId}` : "";
  return `${safeFilePart(title)}${designPart}-niimbot-m2-50x30mm-300dpi.png`;
}

export async function renderNiimbotM2LabelPngBlob(
  label: CoffeeLabel,
  designId: LabelDesignId = "classic",
) {
  const canvas = document.createElement("canvas");
  canvas.width = niimbotM2ExportPreset.pixelWidth;
  canvas.height = niimbotM2ExportPreset.pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available in this browser.");

  drawNiimbotM2Label(ctx, label, designId);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the label PNG."));
    }, "image/png");
  });
}

function drawNiimbotM2Label(
  ctx: CanvasContext,
  label: CoffeeLabel,
  designId: LabelDesignId,
) {
  if (designId === "y2k-smiley-seal") {
    drawY2KSmileySealLabel(ctx, label);
    return;
  }
  if (designId === "brutalist-ticket-stub") {
    drawBrutalistTicketStubLabel(ctx, label);
    return;
  }
  if (designId === "cyber-cafe-receipt") {
    drawCyberCafeReceiptLabel(ctx, label);
    return;
  }

  drawClassicLabel(ctx, label);
}

function drawClassicLabel(ctx: CanvasContext, label: CoffeeLabel) {
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

function drawY2KSmileySealLabel(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth, pixelHeight, safeMarginPx } = niimbotM2ExportPreset;
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;
  const nameProfile = labelNameProfile(main);

  resetCanvas(ctx);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  roundedRectPath(
    ctx,
    safeMarginPx,
    safeMarginPx,
    pixelWidth - safeMarginPx * 2,
    pixelHeight - safeMarginPx * 2,
    90,
  );
  ctx.stroke();

  ctx.lineWidth = 3;
  roundedRectPath(ctx, 34, 34, pixelWidth - 68, pixelHeight - 68, 74);
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.fillRect(18, 70, 58, 214);
  drawVerticalBrand(ctx, 47, 177);

  drawSmileySeal(ctx, 508, 78, 48);

  ctx.fillStyle = "#000000";
  ctx.font = `900 ${Math.max(nameProfile.fontSize - 2, 34)}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(
    ctx,
    main.toUpperCase(),
    96,
    nameProfile.y + 2,
    358,
    nameProfile.lineHeight,
    2,
    nameProfile.minFontSize,
  );

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(96, 220);
  ctx.lineTo(538, 220);
  ctx.moveTo(96, 284);
  ctx.lineTo(538, 284);
  ctx.stroke();

  ctx.font = "900 22px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, body, 96, 231, 440, 22, 3, 17);

  ctx.font = "900 16px Arial, Helvetica, sans-serif";
  drawEllipsisText(ctx, label.footerStart.toUpperCase(), 96, 316, 172);
  drawEllipsisText(ctx, label.footerEnd.toUpperCase(), 292, 316, 244);
}

function drawBrutalistTicketStubLabel(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth, pixelHeight, safeMarginPx } = niimbotM2ExportPreset;
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;
  const nameProfile = labelNameProfile(main);

  resetCanvas(ctx);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.strokeRect(
    safeMarginPx,
    safeMarginPx,
    pixelWidth - safeMarginPx * 2,
    pixelHeight - safeMarginPx * 2,
  );

  ctx.fillStyle = "#000000";
  ctx.fillRect(18, 18, 70, 318);
  drawVerticalBrand(ctx, 46, 177);
  ctx.fillRect(91, 18, 8, 318);
  ctx.fillStyle = "#ffffff";
  for (let y = 30; y <= 322; y += 19) {
    ctx.beginPath();
    ctx.arc(95, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(500, 36, 52, 52);
  ctx.strokeStyle = "#ffffff";
  drawCaptureMark(ctx, 526, 62, 27, "#ffffff");

  ctx.fillStyle = "#000000";
  ctx.fillRect(116, 38, 174, 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 16px Arial, Helvetica, sans-serif";
  ctx.fillText("TICKETED COFFEE", 126, 58);

  ctx.fillStyle = "#000000";
  ctx.font = `900 ${Math.max(nameProfile.fontSize - 5, 31)}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(
    ctx,
    main.toUpperCase(),
    116,
    nameProfile.y + 8,
    370,
    Math.max(nameProfile.lineHeight - 3, 31),
    2,
    nameProfile.minFontSize,
  );

  ctx.lineWidth = 5;
  ctx.strokeRect(116, 222, 436, 61);
  ctx.font = "900 22px Arial, Helvetica, sans-serif";
  drawFittedWrappedText(ctx, body, 128, 235, 410, 22, 2, 17);

  ctx.beginPath();
  ctx.moveTo(116, 303);
  ctx.lineTo(552, 303);
  ctx.stroke();
  ctx.font = "900 16px Arial, Helvetica, sans-serif";
  drawEllipsisText(ctx, label.footerStart.toUpperCase(), 116, 323, 178);
  drawEllipsisText(ctx, label.footerEnd.toUpperCase(), 316, 323, 236);
}

function drawCyberCafeReceiptLabel(ctx: CanvasContext, label: CoffeeLabel) {
  const { pixelWidth, pixelHeight, safeMarginPx } = niimbotM2ExportPreset;
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;
  const nameProfile = labelNameProfile(main);

  resetCanvas(ctx);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    safeMarginPx,
    safeMarginPx,
    pixelWidth - safeMarginPx * 2,
    pixelHeight - safeMarginPx * 2,
  );

  ctx.fillStyle = "#000000";
  ctx.fillRect(18, 18, 48, 318);
  drawVerticalBrand(ctx, 42, 177);

  ctx.font = "900 17px Courier New, monospace";
  ctx.fillStyle = "#000000";
  ctx.fillText("CTC/OPEN  50X30  CAFE RECEIPT", 86, 49);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(86, 62);
  ctx.lineTo(552, 62);
  ctx.moveTo(86, 212);
  ctx.lineTo(552, 212);
  ctx.moveTo(86, 286);
  ctx.lineTo(552, 286);
  ctx.stroke();

  ctx.strokeRect(508, 78, 42, 42);
  drawCaptureMark(ctx, 529, 99, 24);

  ctx.font = `900 ${Math.max(nameProfile.fontSize - 8, 30)}px Arial, Helvetica, sans-serif`;
  drawFittedWrappedText(
    ctx,
    main.toUpperCase(),
    86,
    nameProfile.y + 12,
    408,
    Math.max(nameProfile.lineHeight - 4, 30),
    2,
    nameProfile.minFontSize,
  );

  ctx.font = "900 21px Courier New, monospace";
  drawFittedWrappedText(ctx, body.toUpperCase(), 86, 229, 462, 22, 2, 16);

  drawReceiptBlocks(ctx, 88, 306);

  ctx.font = "900 15px Courier New, monospace";
  drawEllipsisText(ctx, label.footerStart.toUpperCase(), 188, 318, 168);
  drawEllipsisText(ctx, label.footerEnd.toUpperCase(), 378, 318, 174);
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
  color = "#000000",
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-Math.PI / 4);
  ctx.lineWidth = 7;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size / 2, 0);
  ctx.lineTo(size / 2, 0);
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(0, size / 2);
  ctx.stroke();
  ctx.restore();
}

function drawSmileySeal(
  ctx: CanvasContext,
  centerX: number,
  centerY: number,
  radius: number,
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(-15, -10, 5, 0, Math.PI * 2);
  ctx.arc(15, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 2, 22, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawReceiptBlocks(ctx: CanvasContext, x: number, y: number) {
  const widths = [7, 3, 11, 5, 4, 13, 3, 8, 5, 10, 3, 6];
  let cursor = x;
  ctx.fillStyle = "#000000";
  widths.forEach((width) => {
    ctx.fillRect(cursor, y, width, 22);
    cursor += width + 4;
  });
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

function roundedRectPath(
  ctx: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + nextRadius, y);
  ctx.lineTo(x + width - nextRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  ctx.lineTo(x + width, y + height - nextRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  ctx.lineTo(x + nextRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  ctx.lineTo(x, y + nextRadius);
  ctx.quadraticCurveTo(x, y, x + nextRadius, y);
  ctx.closePath();
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
