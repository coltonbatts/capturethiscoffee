export const labelPixelWidth = 591;
export const labelPixelHeight = 354;
export const labelTemplateSchemaVersion = 1;
export const maxLabelTemplateBytes = 64 * 1024;
export const maxLabelTemplateElements = 96;

export const labelBindings = [
  "personName",
  "drink",
  "productionName",
  "clientName",
  "productionClient",
  "group",
  "orderNumber",
] as const;

export type LabelBinding = (typeof labelBindings)[number];
export type LabelColor = "#000000" | "#ffffff";

export type LabelTextSegment =
  | { literal: string }
  | { binding: LabelBinding };

type Rotatable = {
  rotation?: number;
};

type Painted = {
  fill?: LabelColor;
  stroke?: LabelColor;
  strokeWidth?: number;
};

export type LabelTextElement = Rotatable & {
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  segments: LabelTextSegment[];
  fontFamily: "Arial";
  fontSize: number;
  minFontSize: number;
  fontWeight: "regular" | "bold";
  color: LabelColor;
  align: "left" | "center" | "right";
  uppercase?: boolean;
  maxLines: number;
  lineHeight: number;
};

export type LabelLineElement = {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: LabelColor;
  strokeWidth: number;
};

export type LabelRectElement = Rotatable &
  Painted & {
    type: "rect" | "roundedRect";
    x: number;
    y: number;
    width: number;
    height: number;
    radius?: number;
  };

export type LabelCircleElement = Rotatable &
  Painted & {
    type: "circle";
    cx: number;
    cy: number;
    radius: number;
  };

export type LabelEllipseElement = Rotatable &
  Painted & {
    type: "ellipse";
    cx: number;
    cy: number;
    radiusX: number;
    radiusY: number;
  };

export type LabelMarkElement = Rotatable &
  Painted & {
    type: "mark";
    mark: "orbitGlobe" | "sparkle4";
    x: number;
    y: number;
    width: number;
    height: number;
  };

export type LabelTemplateElement =
  | LabelTextElement
  | LabelLineElement
  | LabelRectElement
  | LabelCircleElement
  | LabelEllipseElement
  | LabelMarkElement;

export type LabelTemplateDefinition = {
  schemaVersion: 1;
  pixelWidth: 591;
  pixelHeight: 354;
  background: LabelColor;
  elements: LabelTemplateElement[];
};

export type LabelTemplateCatalogEntry = {
  id: string;
  name: string;
  summary: string;
  version: number;
  definition: LabelTemplateDefinition;
};

export type LabelTemplateCatalog = {
  schemaVersion: 1;
  pixelWidth: 591;
  pixelHeight: 354;
  templates: LabelTemplateCatalogEntry[];
};

export type ProductionLabelTemplateSelection = {
  label: string;
  definition: LabelTemplateDefinition;
};

export type LabelTemplateValidationResult =
  | { ok: true; value: LabelTemplateDefinition }
  | { ok: false; errors: string[] };

const colors = new Set<LabelColor>(["#000000", "#ffffff"]);
const bindings = new Set<string>(labelBindings);
const elementTypes = new Set([
  "text",
  "line",
  "rect",
  "roundedRect",
  "circle",
  "ellipse",
  "mark",
]);

export function validateLabelTemplateDefinition(
  input: unknown,
): LabelTemplateValidationResult {
  const errors: string[] = [];
  const root = objectValue(input, "definition", errors);
  if (!root) return { ok: false, errors };

  let serialized = "";
  try {
    serialized = JSON.stringify(input);
  } catch {
    errors.push("definition must be JSON serializable.");
  }
  if (byteLength(serialized) > maxLabelTemplateBytes) {
    errors.push(`definition must not exceed ${maxLabelTemplateBytes} bytes.`);
  }

  requireExactKeys(
    root,
    ["schemaVersion", "pixelWidth", "pixelHeight", "background", "elements"],
    "definition",
    errors,
  );
  if (root.schemaVersion !== labelTemplateSchemaVersion) {
    errors.push("definition.schemaVersion must be 1.");
  }
  if (root.pixelWidth !== labelPixelWidth || root.pixelHeight !== labelPixelHeight) {
    errors.push("definition dimensions must be exactly 591×354 pixels.");
  }
  if (!colors.has(root.background as LabelColor)) {
    errors.push("definition.background must be #000000 or #ffffff.");
  }
  if (!Array.isArray(root.elements)) {
    errors.push("definition.elements must be an array.");
    return { ok: false, errors };
  }
  if (root.elements.length < 1 || root.elements.length > maxLabelTemplateElements) {
    errors.push(
      `definition.elements must contain 1–${maxLabelTemplateElements} elements.`,
    );
  }

  root.elements.forEach((element, index) => {
    validateElement(element, `definition.elements[${index}]`, errors);
  });

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: input as LabelTemplateDefinition };
}

export function parseLabelTemplateDefinitionJson(input: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return {
      ok: false as const,
      errors: ["Definition is not valid JSON."],
    };
  }
  return validateLabelTemplateDefinition(parsed);
}

export function validateLabelTemplateCatalog(
  input: unknown,
): { ok: true; value: LabelTemplateCatalog } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const root = objectValue(input, "catalog", errors);
  if (!root) return { ok: false, errors };
  requireExactKeys(
    root,
    ["schemaVersion", "pixelWidth", "pixelHeight", "templates"],
    "catalog",
    errors,
  );
  if (root.schemaVersion !== 1) errors.push("catalog.schemaVersion must be 1.");
  if (root.pixelWidth !== labelPixelWidth || root.pixelHeight !== labelPixelHeight) {
    errors.push("catalog dimensions must be exactly 591×354 pixels.");
  }
  if (!Array.isArray(root.templates) || root.templates.length < 1) {
    errors.push("catalog.templates must be a non-empty array.");
    return { ok: false, errors };
  }

  const ids = new Set<string>();
  root.templates.forEach((entry, index) => {
    const path = `catalog.templates[${index}]`;
    const template = objectValue(entry, path, errors);
    if (!template) return;
    requireExactKeys(
      template,
      ["id", "name", "summary", "version", "definition"],
      path,
      errors,
    );
    if (
      typeof template.id !== "string" ||
      !/^[a-z][a-z0-9-]{1,47}$/.test(template.id)
    ) {
      errors.push(`${path}.id must be a lowercase slug of 2–48 characters.`);
    } else if (ids.has(template.id)) {
      errors.push(`${path}.id must be unique.`);
    } else {
      ids.add(template.id);
    }
    validateShortString(template.name, `${path}.name`, 80, errors);
    validateShortString(template.summary, `${path}.summary`, 300, errors);
    if (
      typeof template.version !== "number" ||
      !Number.isInteger(template.version) ||
      template.version < 1
    ) {
      errors.push(`${path}.version must be a positive integer.`);
    }
    const result = validateLabelTemplateDefinition(template.definition);
    if (!result.ok) {
      errors.push(...result.errors.map((error) => `${path}: ${error}`));
    }
  });

  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: input as LabelTemplateCatalog };
}

function validateElement(input: unknown, path: string, errors: string[]) {
  const element = objectValue(input, path, errors);
  if (!element) return;
  if (typeof element.type !== "string" || !elementTypes.has(element.type)) {
    errors.push(`${path}.type is not supported.`);
    return;
  }

  switch (element.type) {
    case "text":
      requireExactKeys(
        element,
        [
          "type",
          "x",
          "y",
          "width",
          "height",
          "segments",
          "fontFamily",
          "fontSize",
          "minFontSize",
          "fontWeight",
          "color",
          "align",
          "uppercase",
          "maxLines",
          "lineHeight",
          "rotation",
        ],
        path,
        errors,
      );
      validateBox(element, path, errors);
      if (!Array.isArray(element.segments) || element.segments.length < 1) {
        errors.push(`${path}.segments must be a non-empty array.`);
      } else if (element.segments.length > 8) {
        errors.push(`${path}.segments must contain at most 8 segments.`);
      } else {
        element.segments.forEach((segment, segmentIndex) => {
          validateSegment(segment, `${path}.segments[${segmentIndex}]`, errors);
        });
      }
      if (element.fontFamily !== "Arial") {
        errors.push(`${path}.fontFamily must be Arial.`);
      }
      validateRange(element.fontSize, `${path}.fontSize`, 6, 128, errors);
      validateRange(element.minFontSize, `${path}.minFontSize`, 6, 128, errors);
      if (
        typeof element.fontSize === "number" &&
        typeof element.minFontSize === "number" &&
        element.minFontSize > element.fontSize
      ) {
        errors.push(`${path}.minFontSize must not exceed fontSize.`);
      }
      if (element.fontWeight !== "regular" && element.fontWeight !== "bold") {
        errors.push(`${path}.fontWeight must be regular or bold.`);
      }
      validateColor(element.color, `${path}.color`, errors);
      if (!["left", "center", "right"].includes(String(element.align))) {
        errors.push(`${path}.align must be left, center, or right.`);
      }
      if (
        element.uppercase !== undefined &&
        typeof element.uppercase !== "boolean"
      ) {
        errors.push(`${path}.uppercase must be boolean.`);
      }
      validateIntegerRange(element.maxLines, `${path}.maxLines`, 1, 4, errors);
      validateRange(element.lineHeight, `${path}.lineHeight`, 6, 128, errors);
      if (
        typeof element.lineHeight === "number" &&
        typeof element.fontSize === "number" &&
        element.lineHeight < element.fontSize
      ) {
        errors.push(`${path}.lineHeight must be at least fontSize.`);
      }
      validateRotation(element.rotation, path, errors);
      return;
    case "line":
      requireExactKeys(
        element,
        ["type", "x1", "y1", "x2", "y2", "stroke", "strokeWidth"],
        path,
        errors,
      );
      validateCoordinate(element.x1, `${path}.x1`, labelPixelWidth, errors);
      validateCoordinate(element.x2, `${path}.x2`, labelPixelWidth, errors);
      validateCoordinate(element.y1, `${path}.y1`, labelPixelHeight, errors);
      validateCoordinate(element.y2, `${path}.y2`, labelPixelHeight, errors);
      validateColor(element.stroke, `${path}.stroke`, errors);
      validateRange(element.strokeWidth, `${path}.strokeWidth`, 0.01, 12, errors);
      return;
    case "rect":
    case "roundedRect":
      requireExactKeys(
        element,
        [
          "type",
          "x",
          "y",
          "width",
          "height",
          "radius",
          "fill",
          "stroke",
          "strokeWidth",
          "rotation",
        ],
        path,
        errors,
      );
      validateBox(element, path, errors);
      validatePaint(element, path, errors);
      if (element.type === "roundedRect") {
        validateRange(
          element.radius,
          `${path}.radius`,
          0,
          Math.min(numberOrZero(element.width), numberOrZero(element.height)) / 2,
          errors,
        );
      } else if (element.radius !== undefined) {
        errors.push(`${path}.radius is only allowed on roundedRect.`);
      }
      validateRotation(element.rotation, path, errors);
      return;
    case "circle":
      requireExactKeys(
        element,
        [
          "type",
          "cx",
          "cy",
          "radius",
          "fill",
          "stroke",
          "strokeWidth",
          "rotation",
        ],
        path,
        errors,
      );
      validateRange(element.radius, `${path}.radius`, 0.01, 295.5, errors);
      validateCoordinate(element.cx, `${path}.cx`, labelPixelWidth, errors);
      validateCoordinate(element.cy, `${path}.cy`, labelPixelHeight, errors);
      if (
        isFiniteNumber(element.cx) &&
        isFiniteNumber(element.cy) &&
        isFiniteNumber(element.radius) &&
        (element.cx - element.radius < 0 ||
          element.cx + element.radius > labelPixelWidth ||
          element.cy - element.radius < 0 ||
          element.cy + element.radius > labelPixelHeight)
      ) {
        errors.push(`${path} must stay inside the 591×354 canvas.`);
      }
      validatePaint(element, path, errors);
      validateRotation(element.rotation, path, errors);
      return;
    case "ellipse":
      requireExactKeys(
        element,
        [
          "type",
          "cx",
          "cy",
          "radiusX",
          "radiusY",
          "fill",
          "stroke",
          "strokeWidth",
          "rotation",
        ],
        path,
        errors,
      );
      validateRange(element.radiusX, `${path}.radiusX`, 0.01, 295.5, errors);
      validateRange(element.radiusY, `${path}.radiusY`, 0.01, 177, errors);
      validateCoordinate(element.cx, `${path}.cx`, labelPixelWidth, errors);
      validateCoordinate(element.cy, `${path}.cy`, labelPixelHeight, errors);
      if (
        isFiniteNumber(element.cx) &&
        isFiniteNumber(element.cy) &&
        isFiniteNumber(element.radiusX) &&
        isFiniteNumber(element.radiusY) &&
        (element.cx - element.radiusX < 0 ||
          element.cx + element.radiusX > labelPixelWidth ||
          element.cy - element.radiusY < 0 ||
          element.cy + element.radiusY > labelPixelHeight)
      ) {
        errors.push(`${path} must stay inside the 591×354 canvas.`);
      }
      validatePaint(element, path, errors);
      validateRotation(element.rotation, path, errors);
      return;
    case "mark":
      requireExactKeys(
        element,
        [
          "type",
          "mark",
          "x",
          "y",
          "width",
          "height",
          "fill",
          "stroke",
          "strokeWidth",
          "rotation",
        ],
        path,
        errors,
      );
      validateBox(element, path, errors);
      if (element.mark !== "orbitGlobe" && element.mark !== "sparkle4") {
        errors.push(`${path}.mark is not supported.`);
      }
      validatePaint(element, path, errors);
      validateRotation(element.rotation, path, errors);
      return;
  }
}

function validateSegment(input: unknown, path: string, errors: string[]) {
  const segment = objectValue(input, path, errors);
  if (!segment) return;
  const keys = Object.keys(segment);
  if (keys.length !== 1 || (keys[0] !== "literal" && keys[0] !== "binding")) {
    errors.push(`${path} must contain exactly one literal or binding.`);
    return;
  }
  if (keys[0] === "literal") {
    if (
      typeof segment.literal !== "string" ||
      segment.literal.length > 256 ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(segment.literal)
    ) {
      errors.push(`${path}.literal must be safe text of at most 256 characters.`);
    }
    if (/(?:https?:\/\/|javascript:|<script|data:text\/html)/i.test(
      String(segment.literal),
    )) {
      errors.push(`${path}.literal cannot contain executable or remote content.`);
    }
  } else if (!bindings.has(String(segment.binding))) {
    errors.push(`${path}.binding is not supported.`);
  }
}

function validateBox(
  value: Record<string, unknown>,
  path: string,
  errors: string[],
) {
  validateCoordinate(value.x, `${path}.x`, labelPixelWidth, errors);
  validateCoordinate(value.y, `${path}.y`, labelPixelHeight, errors);
  validateRange(value.width, `${path}.width`, 0.01, labelPixelWidth, errors);
  validateRange(value.height, `${path}.height`, 0.01, labelPixelHeight, errors);
  if (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    (value.x + value.width > labelPixelWidth ||
      value.y + value.height > labelPixelHeight)
  ) {
    errors.push(`${path} must stay inside the 591×354 canvas.`);
  }
}

function validatePaint(
  value: Record<string, unknown>,
  path: string,
  errors: string[],
) {
  if (value.fill === undefined && value.stroke === undefined) {
    errors.push(`${path} requires fill or stroke.`);
  }
  if (value.fill !== undefined) validateColor(value.fill, `${path}.fill`, errors);
  if (value.stroke !== undefined) {
    validateColor(value.stroke, `${path}.stroke`, errors);
    validateRange(value.strokeWidth, `${path}.strokeWidth`, 0.01, 12, errors);
  } else if (value.strokeWidth !== undefined) {
    errors.push(`${path}.strokeWidth requires stroke.`);
  }
}

function validateRotation(value: unknown, path: string, errors: string[]) {
  if (value !== undefined) validateRange(value, `${path}.rotation`, -360, 360, errors);
}

function validateColor(value: unknown, path: string, errors: string[]) {
  if (!colors.has(value as LabelColor)) {
    errors.push(`${path} must be #000000 or #ffffff.`);
  }
}

function validateShortString(
  value: unknown,
  path: string,
  maxLength: number,
  errors: string[],
) {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.length > maxLength
  ) {
    errors.push(`${path} must be 1–${maxLength} characters.`);
  }
}

function validateCoordinate(
  value: unknown,
  path: string,
  max: number,
  errors: string[],
) {
  validateRange(value, path, 0, max, errors);
}

function validateRange(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: string[],
) {
  if (!isFiniteNumber(value) || value < min || value > max) {
    errors.push(`${path} must be a finite number from ${min} to ${max}.`);
  }
}

function validateIntegerRange(
  value: unknown,
  path: string,
  min: number,
  max: number,
  errors: string[],
) {
  if (
    !isFiniteNumber(value) ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    errors.push(`${path} must be an integer from ${min} to ${max}.`);
  }
}

function objectValue(
  value: unknown,
  path: string,
  errors: string[],
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  errors: string[],
) {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key} is not supported.`);
  }
}

function numberOrZero(value: unknown) {
  return isFiniteNumber(value) ? value : 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function byteLength(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}
