import { join } from "node:path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId, type LabelDesignId } from "@/lib/label-designs";
import { drawNiimbotM2Label, niimbotM2ExportPreset } from "@/lib/niimbot-m2-draw";

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

let captureSmileyPromise: ReturnType<typeof loadImage> | undefined;

export async function renderNiimbotM2LabelPngBuffer(
  label: CoffeeLabel,
  designId: LabelDesignId = defaultLabelDesignId,
) {
  ensureFontsRegistered();
  const canvas = createCanvas(
    niimbotM2ExportPreset.pixelWidth,
    niimbotM2ExportPreset.pixelHeight,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available on the server.");

  const captureSmiley =
    designId === "smiley" ? await loadCaptureSmileyImage() : null;
  drawNiimbotM2Label(
    ctx as unknown as CanvasRenderingContext2D,
    label,
    captureSmiley as unknown as CanvasImageSource | null,
    designId,
  );

  return canvas.toBuffer("image/png");
}

function loadCaptureSmileyImage() {
  captureSmileyPromise ??= loadImage(
    join(process.cwd(), "public", "capture-this-smiley-transparent.png"),
  );
  return captureSmileyPromise;
}
