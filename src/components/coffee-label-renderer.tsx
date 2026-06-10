"use client";

import { CaptureAngle } from "@/components/capture-mark";
import type { CoffeeLabel } from "@/lib/label-copy";

export function ScreenLabel({ label }: { label: CoffeeLabel }) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;

  return (
    <div className="screen-label">
      <div className="screen-label-brand" aria-label="Capture This Coffee">
        <span>CAPTURE</span>
        <span>THIS</span>
        <span>COFFEE</span>
      </div>
      <div className="screen-label-mark">
        <CaptureAngle />
      </div>
      <div className="screen-label-main">
        <p className="screen-label-kicker">On-set coffee</p>
        <h3>{main}</h3>
      </div>
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
      <div className="m2-label-brand" aria-label="Capture This Coffee">
        <span>CAPTURE</span>
        <span>THIS</span>
        <span>COFFEE</span>
      </div>
      <div className="m2-label-mark">
        <CaptureAngle />
      </div>
      <div className="m2-label-main">
        <p className="m2-label-kicker">On-set coffee</p>
        <h2>{main}</h2>
      </div>
      <p className="m2-label-order">{body}</p>
      <div className="m2-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </article>
  );
}
