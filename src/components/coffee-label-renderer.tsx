"use client";

import Image from "next/image";
import { captureThisSmileyTransparentSrc } from "@/lib/brand-assets";
import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId, type LabelDesignId } from "@/lib/label-designs";

/** On-screen preview of the printed label, mirroring the PNG export designs. */
export function ScreenLabel({
  label,
  design = defaultLabelDesignId,
}: {
  label: CoffeeLabel;
  design?: LabelDesignId;
}) {
  const name = label.personName || label.title;
  const drink = label.drink || label.bodyLines.join(" / ");

  if (design === "knockout") {
    return (
      <div className={`screen-label screen-label-knockout label-name-${labelNameSize(name)}`}>
        <p className="screen-label-wordmark">Capture This</p>
        <h3 title={name}>{name}</h3>
        <hr className="screen-label-rule" />
        <p className="screen-label-order">{drink}</p>
        <p className="screen-label-footer">
          <span>{label.productionClient || "Capture This Coffee"}</span>
          <span>{label.orderId}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`screen-label label-name-${labelNameSize(name)}`}>
      <Image
        src={captureThisSmileyTransparentSrc}
        alt=""
        width={750}
        height={750}
        className="screen-label-smiley"
      />
      <div className="screen-label-text">
        <h3 title={name}>{name}</h3>
        <p className="screen-label-order">{drink}</p>
      </div>
    </div>
  );
}

function labelNameSize(value: string) {
  const length = value.trim().replace(/\s+/g, " ").length;
  if (length <= 10) return "short";
  if (length <= 20) return "medium";
  if (length <= 24) return "long";
  return "compressed";
}
