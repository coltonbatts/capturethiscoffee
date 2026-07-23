"use client";

import type { CoffeeLabel } from "@/lib/label-copy";
import { defaultLabelDesignId, type LabelDesignId } from "@/lib/label-designs";

/** On-screen proof of the same compositions used by the print canvas. */
export function ScreenLabel({
  label,
  design = defaultLabelDesignId,
}: {
  label: CoffeeLabel;
  design?: LabelDesignId;
}) {
  const name = label.personName || label.title;
  const drink = label.drink || label.bodyLines.join(" / ");
  const order = displayOrderNumber(label.orderId);
  const production = label.productionClient || "Capture This Coffee";
  const group = label.group || "On set";
  const rootClass = `screen-label screen-label-${design} label-name-${labelNameSize(name)}`;

  if (design === "grid-02") {
    return (
      <div className={rootClass}>
        <div className="label-grid-rail" aria-hidden="true"><span>02</span></div>
        <div className="label-grid-02-copy">
          <LabelMeta left="Capture This Coffee" right={`Order ${order}`} />
          <h3 title={name}>{name}</h3>
          <p className="label-drink">{drink}</p>
          <LabelMeta left={production} right={group} />
        </div>
      </div>
    );
  }

  if (design === "instrument") {
    return (
      <div className={rootClass}>
        <LabelMeta left="CTC / Coffee service" right="System 03" />
        <div className="label-instrument-rule" />
        <div className="label-instrument-body">
          <div className="label-instrument-copy">
            <p className="label-index">01 / Person</p>
            <h3 title={name}>{name}</h3>
            <p className="label-index">02 / Order</p>
            <p className="label-drink">{drink}</p>
          </div>
          <div className="label-instrument-order">
            <span>03</span>
            <strong>{order}</strong>
          </div>
        </div>
        <LabelMeta left={production} right={group} />
      </div>
    );
  }

  if (design === "contact") {
    return (
      <div className={rootClass}>
        <span className="label-crop label-crop-tl" aria-hidden="true" />
        <span className="label-crop label-crop-tr" aria-hidden="true" />
        <span className="label-crop label-crop-bl" aria-hidden="true" />
        <span className="label-crop label-crop-br" aria-hidden="true" />
        <LabelMeta left={`Frame ${order}`} right="CTC / 50×30" />
        <div className="label-contact-copy">
          <h3 title={name}>{name}</h3>
          <p className="label-drink">{drink}</p>
        </div>
        <LabelMeta left={production} right={group} />
        <span className="label-contact-vertical" aria-hidden="true">Contact</span>
      </div>
    );
  }

  if (design === "caption") {
    return (
      <div className={rootClass}>
        <LabelMeta left="Capture This Coffee" right={`No. ${order}`} />
        <div className="label-caption-copy">
          <p className="label-caption-kicker">Coffee for</p>
          <h3 title={name}>{name}</h3>
          <p className="label-drink">{drink}</p>
        </div>
        <LabelMeta left={production} right={group} />
      </div>
    );
  }

  if (design === "block") {
    return (
      <div className={rootClass}>
        <LabelMeta left="CTC / Service label" right={`No. ${order}`} />
        <div className="label-block-name"><h3 title={name}>{name}</h3></div>
        <div className="label-block-footer">
          <p className="label-drink">{drink}</p>
          <span>{group}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="label-grid-index" aria-hidden="true">01</div>
      <div className="label-grid-01-copy">
        <LabelMeta left="Capture This Coffee" right={`No. ${order}`} />
        <div className="label-grid-01-name">
          <p>For</p>
          <h3 title={name}>{name}</h3>
        </div>
        <p className="label-drink">{drink}</p>
        <LabelMeta left={production} right={group} />
      </div>
    </div>
  );
}

function LabelMeta({ left, right }: { left: string; right: string }) {
  return (
    <p className="label-meta">
      <span>{left}</span>
      <span>{right}</span>
    </p>
  );
}

function displayOrderNumber(value: string) {
  return value.trim().replace(/^#/, "") || "—";
}

function labelNameSize(value: string) {
  const length = value.trim().replace(/\s+/g, " ").length;
  if (length <= 10) return "short";
  if (length <= 20) return "medium";
  if (length <= 24) return "long";
  return "compressed";
}
