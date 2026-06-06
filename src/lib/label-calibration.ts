export type PrintCalibration = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

const storageKey = "capture-this-m2-calibration-v1";

export const defaultPrintCalibration: PrintCalibration = {
  offsetX: 0,
  offsetY: 0,
  scale: 100,
};

export function loadPrintCalibration(): PrintCalibration {
  if (typeof window === "undefined") {
    return defaultPrintCalibration;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultPrintCalibration;

  try {
    return normalizePrintCalibration(JSON.parse(raw));
  } catch {
    return defaultPrintCalibration;
  }
}

export function savePrintCalibration(calibration: PrintCalibration) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(normalizePrintCalibration(calibration)),
  );
}

function normalizePrintCalibration(value: unknown): PrintCalibration {
  if (!value || typeof value !== "object") {
    return defaultPrintCalibration;
  }

  const input = value as Partial<PrintCalibration>;
  return {
    offsetX: clampNumber(input.offsetX, -3, 3, 0, 0.5),
    offsetY: clampNumber(input.offsetY, -3, 3, 0, 0.5),
    scale: clampNumber(input.scale, 90, 110, 100, 1),
  };
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  step: number,
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const clamped = Math.min(max, Math.max(min, parsed));
  const steps = Math.round(clamped / step);
  return steps * step;
}
