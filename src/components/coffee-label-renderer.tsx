"use client";

import { useEffect, useRef } from "react";
import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId } from "@/lib/label-designs";
import {
  drawNiimbotM2Label,
  niimbotM2ExportPreset,
  type LabelTemplateSelection,
} from "@/lib/niimbot-m2-draw";

/** Screen proof rendered by the exact same 591×354 interpreter as exported PNGs. */
export function ScreenLabel({
  label,
  design = defaultLabelDesignId,
}: {
  label: CoffeeLabel;
  design?: LabelTemplateSelection;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    drawNiimbotM2Label(context, label, design);
  }, [design, label]);

  return (
    <canvas
      ref={canvasRef}
      className="screen-label"
      width={niimbotM2ExportPreset.pixelWidth}
      height={niimbotM2ExportPreset.pixelHeight}
      role="img"
      aria-label={`Print preview for ${label.personName || label.title || "coffee label"}`}
    />
  );
}
