"use client";

import { CaptureMark } from "@/components/capture-mark";
import type { LabelDesignId } from "@/lib/label-designs";
import type { CoffeeLabel } from "@/lib/label-copy";

export function ScreenLabel({
  label,
  designId = "classic",
}: {
  label: CoffeeLabel;
  designId?: LabelDesignId;
}) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;
  const nameSize = labelNameSize(main);

  return (
    <div className={`screen-label screen-label-design-${designId} label-name-${nameSize}`}>
      <div className="screen-label-brand" aria-label="Capture This Coffee">
        <span>CAPTURE</span>
        <span>THIS</span>
        <span>COFFEE</span>
      </div>
      <div className="screen-label-mark">
        <CaptureMark className="screen-label-capture-mark" title="Capture This Coffee" />
      </div>
      <div className="screen-label-main">
        <p className="screen-label-kicker">{labelKicker(designId)}</p>
        <h3 title={main}>{main}</h3>
      </div>
      <p className="screen-label-order">{body}</p>
      <div className="screen-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </div>
  );
}

export function PrintableLabel({
  label,
  designId = "classic",
}: {
  label: CoffeeLabel;
  designId?: LabelDesignId;
}) {
  const main = label.title || label.personName;
  const body = label.bodyLines.join(" / ") || label.drink;
  const nameSize = labelNameSize(main);

  return (
    <article className={`m2-label m2-label-design-${designId} label-name-${nameSize}`}>
      <div className="m2-label-brand" aria-label="Capture This Coffee">
        <span>CAPTURE</span>
        <span>THIS</span>
        <span>COFFEE</span>
      </div>
      <div className="m2-label-mark">
        <CaptureMark className="m2-label-capture-mark" title="Capture This Coffee" />
      </div>
      <div className="m2-label-main">
        <p className="m2-label-kicker">{labelKicker(designId)}</p>
        <h2 title={main}>{main}</h2>
      </div>
      <p className="m2-label-order">{body}</p>
      <div className="m2-label-footer">
        <span>{label.footerStart}</span>
        <span>{label.footerEnd}</span>
      </div>
    </article>
  );
}

function labelKicker(designId: LabelDesignId) {
  if (designId === "smiley-test") return "Print test";
  if (designId === "production-sticker-sheet") return "Run label";
  if (designId === "brutalist-ticket-stub") return "Ticketed coffee";
  if (designId === "cyber-cafe-receipt") return "Cafe receipt";
  if (designId === "y2k-smiley-seal") return "Smiley service";
  return "On-set coffee";
}

function labelNameSize(value: string) {
  const length = value.trim().replace(/\s+/g, " ").length;
  if (length <= 10) return "short";
  if (length <= 20) return "medium";
  if (length <= 24) return "long";
  return "compressed";
}
