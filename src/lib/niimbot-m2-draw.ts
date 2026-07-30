import m2Preset from "@/lib/niimbot-m2-preset.json";
import type { CoffeeLabel } from "@/lib/label-copy";
import {
  defaultLabelDesignId,
  resolveLabelTemplateDefinition,
} from "@/lib/label-template-catalog";
import type {
  LabelBinding,
  LabelMarkElement,
  LabelTemplateDefinition,
  LabelTemplateElement,
  LabelTextElement,
} from "@/lib/label-template-schema";
import type { LabelDesignId } from "@/lib/label-designs";

export const niimbotM2ExportPreset = m2Preset;

type CanvasContext = CanvasRenderingContext2D;
export type LabelTemplateSelection =
  | LabelDesignId
  | LabelTemplateDefinition;

/** Draws both screen proofs and print PNGs through the same declarative interpreter. */
export function drawNiimbotM2Label(
  ctx: CanvasContext,
  label: CoffeeLabel,
  selection: LabelTemplateSelection = defaultLabelDesignId,
) {
  drawLabelTemplate(
    ctx,
    resolveLabelTemplateDefinition(selection),
    labelBindingsFromCoffeeLabel(label),
  );
}

export function drawLabelTemplate(
  ctx: CanvasContext,
  definition: LabelTemplateDefinition,
  bindings: Partial<Record<LabelBinding, string>>,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, definition.pixelWidth, definition.pixelHeight);
  ctx.fillStyle = definition.background;
  ctx.fillRect(0, 0, definition.pixelWidth, definition.pixelHeight);
  ctx.setLineDash([]);

  for (const element of definition.elements) {
    drawElement(ctx, element, bindings);
  }
}

export function labelBindingsFromCoffeeLabel(
  label: CoffeeLabel,
): Record<LabelBinding, string> {
  const productionClient =
    label.productionClient.trim() || "Capture This Coffee";
  return {
    personName: (label.personName || label.title).trim(),
    drink: (label.drink || label.bodyLines.join(" / ")).trim(),
    productionName: productionClient,
    clientName: "",
    productionClient,
    group: label.group.trim() || "On set",
    orderNumber: label.orderId.trim().replace(/^#/, "") || "—",
  };
}

function drawElement(
  ctx: CanvasContext,
  element: LabelTemplateElement,
  bindings: Partial<Record<LabelBinding, string>>,
) {
  ctx.save();
  applyRotation(ctx, element);
  switch (element.type) {
    case "text":
      drawText(ctx, element, bindings);
      break;
    case "line":
      ctx.beginPath();
      ctx.strokeStyle = element.stroke;
      ctx.lineWidth = element.strokeWidth;
      ctx.moveTo(element.x1, element.y1);
      ctx.lineTo(element.x2, element.y2);
      ctx.stroke();
      break;
    case "rect":
      drawPaintedPath(
        ctx,
        element,
        () => ctx.rect(element.x, element.y, element.width, element.height),
      );
      break;
    case "roundedRect":
      drawPaintedPath(ctx, element, () => {
        roundedRectPath(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          element.radius || 0,
        );
      });
      break;
    case "circle":
      drawPaintedPath(ctx, element, () => {
        ctx.arc(element.cx, element.cy, element.radius, 0, Math.PI * 2);
      });
      break;
    case "ellipse":
      drawPaintedPath(ctx, element, () => {
        ctx.ellipse(
          element.cx,
          element.cy,
          element.radiusX,
          element.radiusY,
          0,
          0,
          Math.PI * 2,
        );
      });
      break;
    case "mark":
      drawMark(ctx, element);
      break;
  }
  ctx.restore();
}

function drawText(
  ctx: CanvasContext,
  element: LabelTextElement,
  bindings: Partial<Record<LabelBinding, string>>,
) {
  const rawValue = element.segments
    .map((segment) =>
      "literal" in segment ? segment.literal : bindings[segment.binding] || "",
    )
    .join("");
  const value = element.uppercase ? rawValue.toUpperCase() : rawValue;
  if (!value) return;

  const layout = fitLabelTemplateText(ctx, element, value);
  const { fontSize, lineHeight, lines } = layout;
  setFont(ctx, element, fontSize);
  ctx.fillStyle = element.color;
  ctx.textAlign =
    element.align === "left"
      ? "start"
      : element.align === "right"
        ? "end"
        : "center";
  ctx.textBaseline = "top";
  const textX =
    element.align === "left"
      ? element.x
      : element.align === "right"
        ? element.x + element.width
        : element.x + element.width / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, textX, element.y + index * lineHeight);
  });
}

export function fitLabelTemplateText(
  ctx: CanvasContext,
  element: LabelTextElement,
  value: string,
) {
  let fontSize = element.fontSize;
  let lines: string[] = [];
  let lineHeight = element.lineHeight;
  const oneLineFloor = Math.max(
    element.minFontSize,
    Math.ceil(element.fontSize * 0.6),
  );
  let oneLineSize = element.fontSize;
  while (oneLineSize >= oneLineFloor) {
    setFont(ctx, element, oneLineSize);
    if (
      oneLineSize <= element.height &&
      ctx.measureText(value).width <= element.width
    ) {
      fontSize = oneLineSize;
      lineHeight = element.lineHeight * (fontSize / element.fontSize);
      lines = [value];
      break;
    }
    oneLineSize -= 1;
  }

  if (!lines.length) {
    while (fontSize >= element.minFontSize) {
      setFont(ctx, element, fontSize);
      lineHeight = element.lineHeight * (fontSize / element.fontSize);
      lines = wrapText(ctx, value, element.width);
      const paintedHeight =
        fontSize + Math.max(lines.length - 1, 0) * lineHeight;
      const fits =
        lines.length <= element.maxLines &&
        paintedHeight <= element.height &&
        lines.every((line) => ctx.measureText(line).width <= element.width);
      if (fits || fontSize === element.minFontSize) break;
      fontSize = Math.max(element.minFontSize, fontSize - 1);
    }
  }

  const visible = lines.slice(0, element.maxLines);
  if (lines.length > element.maxLines && visible.length) {
    visible[visible.length - 1] = ellipsizeToWidth(
      ctx,
      visible[visible.length - 1],
      element.width,
    );
  } else {
    for (let index = 0; index < visible.length; index += 1) {
      visible[index] = ellipsizeToWidth(ctx, visible[index], element.width);
    }
  }

  return { fontSize, lineHeight, lines: visible };
}

function setFont(
  ctx: CanvasContext,
  element: LabelTextElement,
  fontSize: number,
) {
  const weight = element.fontWeight === "bold" ? 700 : 400;
  ctx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
}

function wrapText(ctx: CanvasContext, value: string, width: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= width) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsizeToWidth(ctx: CanvasContext, value: string, width: number) {
  if (!value || ctx.measureText(value).width <= width) return value;
  if (ctx.measureText("…").width > width) return "";
  let low = 0;
  let high = value.length;
  let best = "";
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, middle).trimEnd()}…`;
    if (ctx.measureText(candidate).width <= width) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

function drawPaintedPath(
  ctx: CanvasContext,
  paint: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  },
  path: () => void,
) {
  ctx.beginPath();
  path();
  if (paint.fill) {
    ctx.fillStyle = paint.fill;
    ctx.fill();
  }
  if (paint.stroke) {
    ctx.strokeStyle = paint.stroke;
    ctx.lineWidth = paint.strokeWidth || 1;
    ctx.stroke();
  }
}

function drawMark(ctx: CanvasContext, mark: LabelMarkElement) {
  if (mark.mark === "sparkle4") {
    const cx = mark.x + mark.width / 2;
    const cy = mark.y + mark.height / 2;
    const halfWidth = mark.width / 2;
    const halfHeight = mark.height / 2;
    const innerX = halfWidth * 0.16;
    const innerY = halfHeight * 0.16;
    drawPaintedPath(ctx, mark, () => {
      ctx.moveTo(cx, cy - halfHeight);
      ctx.lineTo(cx + innerX, cy - innerY);
      ctx.lineTo(cx + halfWidth, cy);
      ctx.lineTo(cx + innerX, cy + innerY);
      ctx.lineTo(cx, cy + halfHeight);
      ctx.lineTo(cx - innerX, cy + innerY);
      ctx.lineTo(cx - halfWidth, cy);
      ctx.lineTo(cx - innerX, cy - innerY);
      ctx.closePath();
    });
    return;
  }

  const cx = mark.x + mark.width / 2;
  const cy = mark.y + mark.height / 2;
  const rx = mark.width / 2;
  const ry = mark.height / 2;
  ctx.strokeStyle = mark.stroke || "#000000";
  ctx.lineWidth = mark.strokeWidth || 1;
  const strokeEllipse = (ellipseRx: number, ellipseRy: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, ellipseRx, ellipseRy, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
  strokeEllipse(rx, ry);
  strokeEllipse(rx * 0.34, ry);
  strokeEllipse(rx * 0.7, ry);
  for (const fraction of [0, 0.45, 0.8]) {
    const dy = ry * fraction;
    const halfWidth = rx * Math.sqrt(Math.max(1 - fraction * fraction, 0));
    for (const sign of fraction === 0 ? [1] : [-1, 1]) {
      const y = cy + sign * dy;
      ctx.beginPath();
      ctx.moveTo(cx - halfWidth, y);
      ctx.lineTo(cx + halfWidth, y);
      ctx.stroke();
    }
  }
}

function applyRotation(ctx: CanvasContext, element: LabelTemplateElement) {
  if (!("rotation" in element) || !element.rotation) return;
  const bounds = rotationBounds(element);
  if (!bounds) return;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((element.rotation * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);
}

function rotationBounds(element: LabelTemplateElement) {
  switch (element.type) {
    case "text":
    case "rect":
    case "roundedRect":
    case "mark":
      return {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      };
    case "circle":
      return {
        x: element.cx - element.radius,
        y: element.cy - element.radius,
        width: element.radius * 2,
        height: element.radius * 2,
      };
    case "ellipse":
      return {
        x: element.cx - element.radiusX,
        y: element.cy - element.radiusY,
        width: element.radiusX * 2,
        height: element.radiusY * 2,
      };
    case "line":
      return null;
  }
}

function roundedRectPath(
  ctx: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
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
