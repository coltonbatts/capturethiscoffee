import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeLabelPrintJobStatuses,
  buildLabelPrintJobPayload,
  canClaimLabelPrintJob,
  canMarkLabelPrintJobPrinted,
  canStartLabelPrintAttempt,
  isLabelPrintJobPayloadV1,
  printJobFailureStatus,
  type LabelPrintJobStatus,
} from "../src/lib/print-jobs";
import type { CoffeeLabel } from "../src/lib/label-copy";

const sampleLabel: CoffeeLabel = {
  id: "order-abc123",
  personName: "Ava",
  drink: "Iced oat latte",
  group: "Set",
  productionClient: "Morning shoot / Capture This",
  notesStatus: "Confirmed",
  orderId: "#ABC123",
  title: "Ava",
  bodyLines: ["Iced oat latte"],
  footerStart: "Set  #ABC123",
  footerEnd: "Morning shoot / Capture This",
  lines: ["Ava", "Iced oat latte", "Set  #ABC123 - Morning shoot / Capture This"],
};

describe("print-job payloads", () => {
  it("builds the versioned NIIMBOT M2 payload used by the queue", () => {
    const payload = buildLabelPrintJobPayload({
      productionId: "prod-1",
      orderId: "order-abc123",
      personId: "person-1",
      label: sampleLabel,
      options: {
        style: "standard",
        fields: {
          personName: true,
          drink: true,
          group: true,
          productionClient: true,
          notesStatus: false,
          orderId: true,
        },
      },
    });

    assert.equal(payload.version, 1);
    assert.deepEqual(payload.label_size, { width_mm: 50, height_mm: 30 });
    assert.equal(payload.printer_family, "niimbot_m2");
    assert.equal(payload.dpi, 300);
    assert.deepEqual(payload.source, {
      production_id: "prod-1",
      order_id: "order-abc123",
      person_id: "person-1",
    });
    assert.equal(isLabelPrintJobPayloadV1(payload), true);
  });

  it("rejects malformed payloads before they enter the queue", () => {
    assert.equal(isLabelPrintJobPayloadV1({ ...sampleLabel }), false);
    assert.equal(
      isLabelPrintJobPayloadV1({
        version: 1,
        printer_family: "niimbot_m2",
        dpi: 203,
        label: sampleLabel,
        options: { style: "standard", fields: {} },
      }),
      false,
    );
  });
});

describe("print-job state helpers", () => {
  it("keeps active queue statuses aligned with station polling", () => {
    assert.deepEqual(activeLabelPrintJobStatuses, ["queued", "claimed", "printing"]);
  });

  it("only lets queued jobs be claimed", () => {
    const statuses: LabelPrintJobStatus[] = [
      "queued",
      "claimed",
      "printing",
      "printed",
      "failed",
      "cancelled",
    ];

    assert.deepEqual(
      statuses.filter(canClaimLabelPrintJob),
      ["queued"],
    );
  });

  it("requires a claimed job before recording a started attempt", () => {
    assert.equal(canStartLabelPrintAttempt("claimed"), true);
    assert.equal(canStartLabelPrintAttempt("queued"), false);
    assert.equal(canStartLabelPrintAttempt("printing"), false);
  });

  it("prevents queued jobs from being marked printed in the station UI", () => {
    assert.equal(canMarkLabelPrintJobPrinted("queued"), false);
    assert.equal(canMarkLabelPrintJobPrinted("claimed"), true);
    assert.equal(canMarkLabelPrintJobPrinted("printing"), true);
    assert.equal(canMarkLabelPrintJobPrinted("printed"), false);
  });

  it("maps release and fail actions to the exact stored statuses", () => {
    assert.equal(printJobFailureStatus(true), "queued");
    assert.equal(printJobFailureStatus(false), "failed");
  });
});
