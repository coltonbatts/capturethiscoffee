import type {
  CoffeeLabel,
  LabelContentStyle,
  LabelFieldOptions,
} from "./label-copy";

export type LabelPrintJobStatus =
  | "queued"
  | "claimed"
  | "printing"
  | "printed"
  | "failed"
  | "cancelled";

export type LabelPrintAttemptStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "cancelled";

export type LabelPrintTransport =
  | "ios_ble"
  | "laptop_browser"
  | "laptop_usb"
  | "bridge";

export type LabelPrintJobPayloadV1 = {
  version: 1;
  label_size: {
    width_mm: 50;
    height_mm: 30;
  };
  printer_family: "niimbot_m2";
  dpi: 300;
  source: {
    production_id: string | null;
    order_id: string | null;
    person_id: string | null;
  };
  label: CoffeeLabel;
  options: {
    style: LabelContentStyle;
    fields: LabelFieldOptions;
  };
};

export type BuildLabelPrintJobPayloadInput = {
  productionId?: string | null;
  orderId?: string | null;
  personId?: string | null;
  label: CoffeeLabel;
  options: LabelPrintJobPayloadV1["options"];
};

export function buildLabelPrintJobPayload({
  productionId,
  orderId,
  personId,
  label,
  options,
}: BuildLabelPrintJobPayloadInput): LabelPrintJobPayloadV1 {
  return {
    version: 1,
    label_size: {
      width_mm: 50,
      height_mm: 30,
    },
    printer_family: "niimbot_m2",
    dpi: 300,
    source: {
      production_id: productionId || null,
      order_id: orderId || null,
      person_id: personId || null,
    },
    label,
    options,
  };
}

export function isLabelPrintJobPayloadV1(
  value: unknown,
): value is LabelPrintJobPayloadV1 {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<LabelPrintJobPayloadV1>;
  return (
    payload.version === 1 &&
    payload.printer_family === "niimbot_m2" &&
    payload.dpi === 300 &&
    isCoffeeLabel(payload.label) &&
    Boolean(payload.options?.style) &&
    Boolean(payload.options?.fields)
  );
}

function isCoffeeLabel(value: unknown): value is CoffeeLabel {
  if (!value || typeof value !== "object") return false;
  const label = value as Partial<CoffeeLabel>;
  return (
    typeof label.id === "string" &&
    typeof label.personName === "string" &&
    typeof label.drink === "string" &&
    typeof label.group === "string" &&
    typeof label.productionClient === "string" &&
    Array.isArray(label.lines)
  );
}
