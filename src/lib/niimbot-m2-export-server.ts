import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type { LabelDesignId } from "@/lib/label-designs";
import type { CoffeeLabel } from "@/lib/label-copy";
import { drawNiimbotM2Label, niimbotM2ExportPreset } from "@/lib/niimbot-m2-draw";

let captureSmileyPromise: ReturnType<typeof loadImage> | undefined;

export async function renderNiimbotM2LabelPngBuffer(
  label: CoffeeLabel,
  designId: LabelDesignId = "production-sticker-sheet",
) {
  const canvas = createCanvas(
    niimbotM2ExportPreset.pixelWidth,
    niimbotM2ExportPreset.pixelHeight,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available on the server.");

  const captureSmiley = await loadCaptureSmileyImage();
  drawNiimbotM2Label(
    ctx as unknown as CanvasRenderingContext2D,
    label,
    designId,
    captureSmiley as unknown as CanvasImageSource,
  );

  return canvas.toBuffer("image/png");
}

function loadCaptureSmileyImage() {
  captureSmileyPromise ??= loadImage(
    join(process.cwd(), "public", "capture-this-smiley.png"),
  );
  return captureSmileyPromise;
}
