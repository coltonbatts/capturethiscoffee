import { join } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId } from "@/lib/label-designs";
import {
  drawNiimbotM2Label,
  niimbotM2ExportPreset,
  type LabelTemplateSelection,
} from "@/lib/niimbot-m2-draw";

let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  try {
    const regularPath = join(process.cwd(), "public", "fonts", "Arial.ttf");
    const boldPath = join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");
    GlobalFonts.registerFromPath(regularPath, "Arial");
    GlobalFonts.registerFromPath(boldPath, "Arial");
    fontsRegistered = true;
  } catch (error) {
    console.error("Failed to register custom fonts:", error);
  }
}

export async function renderNiimbotM2LabelPngBuffer(
  label: CoffeeLabel,
  designId: LabelTemplateSelection = defaultLabelDesignId,
) {
  ensureFontsRegistered();
  const canvas = createCanvas(
    niimbotM2ExportPreset.pixelWidth,
    niimbotM2ExportPreset.pixelHeight,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available on the server.");

  drawNiimbotM2Label(
    ctx as unknown as CanvasRenderingContext2D,
    label,
    designId,
  );

  return canvas.toBuffer("image/png");
}
