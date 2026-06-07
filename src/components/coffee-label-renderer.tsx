"use client";

import { CaptureAngle } from "@/components/capture-mark";
import type { CoffeeLabel } from "@/lib/label-copy";

export function ScreenLabel({ label }: { label: CoffeeLabel }) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

  return (
    <div className="screen-label">
      <div className="screen-label-mark">
        <CaptureAngle />
      </div>
      <h3>{main}</h3>
      <p className="screen-label-order">{body}</p>
      <div className="screen-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </div>
  );
}

export function PrintableLabel({ label }: { label: CoffeeLabel }) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

  return (
    <article className="m2-label">
      <div className="m2-label-mark">
        <CaptureAngle />
      </div>
      <h2>{main}</h2>
      <p className="m2-label-order">{body}</p>
      <div className="m2-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </article>
  );
}
