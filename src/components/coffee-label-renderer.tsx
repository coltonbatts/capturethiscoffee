"use client";

import Image from "next/image";
import { captureThisSmileyTransparentSrc } from "@/lib/brand-assets";
import type { CoffeeLabel } from "@/lib/label-copy";

/** On-screen preview of the printed label: smiley, name, drink. */
export function ScreenLabel({ label }: { label: CoffeeLabel }) {
  const name = label.personName || label.title;
  const drink = label.drink || label.bodyLines.join(" / ");

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
