import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPrinterQueue, parseProductionShareUrl } from "../src/lib/printer-queue";
import type { CoffeeData } from "../src/lib/types";

const sampleData: CoffeeData = {
  clients: [
    {
      id: "client-1",
      name: "Capture This",
      notes: "",
      active: true,
      created_at: "2026-06-01T00:00:00.000Z",
    },
  ],
  people: [
    {
      id: "person-1",
      name: "Ava Stone",
      type: "crew",
      role: "DP",
      department: "Camera",
      company: "",
      photo_url: "",
      usual_order: "",
      dietary_notes: "",
      notes: "",
      active: true,
      created_at: "2026-06-01T00:00:00.000Z",
    },
  ],
  client_people: [],
  productions: [
    {
      id: "prod-1",
      name: "Launch shoot",
      client_id: "client-1",
      shoot_date: "",
      location: "",
      runner_name: "",
      notes: "",
      status: "active",
      created_at: "2026-06-01T00:00:00.000Z",
    },
  ],
  production_roster: [
    {
      id: "roster-1",
      production_id: "prod-1",
      person_id: "person-1",
      group_label: "Camera",
      on_set_today: true,
      sort_order: 1,
    },
  ],
  orders: [
    {
      id: "order-1",
      production_id: "prod-1",
      roster_id: "roster-1",
      person_id: "person-1",
      drink_type: "Latte",
      size: "",
      temperature: "Iced",
      milk_type: "Oat",
      sweetener: "",
      caffeine: "",
      special_notes: "",
      vendor: "",
      status: "confirmed",
      label_printed: false,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    },
  ],
};

describe("printer queue helpers", () => {
  it("builds a queue from runner-scoped production data", () => {
    const queue = buildPrinterQueue(sampleData, "prod-1");
    assert.ok(queue);
    assert.equal(queue.labels.length, 1);
    assert.equal(queue.labels[0].personName, "Ava Stone");
    assert.equal(queue.labels[0].labelPrinted, false);
    assert.equal(queue.designId, "production-sticker-sheet");
  });

  it("parses a production share URL into API session fields", () => {
    assert.deepEqual(
      parseProductionShareUrl(
        "https://capturethis.coffee/productions/prod-1?token=runner-secret",
      ),
      {
        productionId: "prod-1",
        token: "runner-secret",
        origin: "https://capturethis.coffee",
      },
    );
    assert.equal(parseProductionShareUrl("not-a-url"), null);
  });
});
