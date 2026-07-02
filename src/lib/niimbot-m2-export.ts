import type { CoffeeLabel } from "@/lib/label-copy";
import { captureThisSmileyTransparentSrc } from "@/lib/brand-assets";
import {
  drawNiimbotM2Label,
  niimbotM2ExportPreset,
  safeFilePart,
} from "@/lib/niimbot-m2-draw";

export { niimbotM2ExportPreset };

let captureThisSmileyImagePromise: Promise<HTMLImageElement> | undefined;

export function niimbotM2ExportFileName(
  label: Pick<CoffeeLabel, "personName" | "title" | "orderId"> | string,
) {
  const title =
    typeof label === "string"
      ? label
      : [label.personName || label.title, label.orderId.replace(/^#/, "")]
          .filter(Boolean)
          .join("-");
  return `${safeFilePart(title)}-niimbot-m2-50x30mm-300dpi.png`;
}

export async function renderNiimbotM2LabelPngBlob(label: CoffeeLabel) {
  const canvas = document.createElement("canvas");
  canvas.width = niimbotM2ExportPreset.pixelWidth;
  canvas.height = niimbotM2ExportPreset.pixelHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available in this browser.");

  const captureSmiley = await loadCaptureThisSmileyImage();
  drawNiimbotM2Label(ctx, label, captureSmiley);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the label PNG."));
    }, "image/png");
  });
}

function loadCaptureThisSmileyImage() {
  captureThisSmileyImagePromise ??= new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Image loading is not available in this browser."));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load Capture This smiley artwork."));
    image.src = captureThisSmileyTransparentSrc;
  });

  return captureThisSmileyImagePromise;
}
