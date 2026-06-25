import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLabelExportSelection,
  labelExportItemsForProduction,
  labelExportProductions,
} from "../src/lib/label-export";
import { niimbotM2ExportFileName } from "../src/lib/niimbot-m2-export";
import type { CoffeeData } from "../src/lib/types";

const data: CoffeeData = {
  clients: [
    {
      id: "client-1",
      name: "Capture This",
      active: true,
      created_at: "2026-06-01T12:00:00.000Z",
    },
  ],
  people: [
    {
      id: "person-1",
      name: "Ava Stone",
      type: "crew",
      department: "Camera",
      usual_order: "",
      active: true,
      created_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "person-2",
      name: "No Order",
      type: "crew",
      department: "Production",
      usual_order: "",
      active: true,
      created_at: "2026-06-01T12:00:00.000Z",
    },
  ],
  client_people: [],
  productions: [
    {
      id: "prod-planning",
      client_id: "client-1",
      name: "Planning shoot",
      status: "planning",
      created_at: "2026-06-02T12:00:00.000Z",
    },
    {
      id: "prod-active",
      client_id: "client-1",
      name: "Active shoot",
      status: "active",
      created_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "prod-complete",
      client_id: "client-1",
      name: "Wrapped shoot",
      status: "complete",
      created_at: "2026-06-03T12:00:00.000Z",
    },
  ],
  production_roster: [
    {
      id: "roster-1",
      production_id: "prod-active",
      person_id: "person-1",
      group_label: "Camera",
      on_set_today: true,
      sort_order: 2,
    },
    {
      id: "roster-2",
      production_id: "prod-active",
      person_id: "person-2",
      group_label: "Production",
      on_set_today: true,
      sort_order: 1,
    },
  ],
  orders: [
    {
      id: "order-ava",
      production_id: "prod-active",
      roster_id: "roster-1",
      person_id: "person-1",
      size: "Medium",
      temperature: "Iced",
      drink_type: "Latte",
      milk_type: "Oat",
      sweetener: "",
      caffeine: "Regular",
      special_notes: "No room",
      vendor: "",
      status: "confirmed",
      label_printed: false,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "order-none",
      production_id: "prod-active",
      roster_id: "roster-2",
      person_id: "person-2",
      status: "no_order",
      label_printed: false,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
    },
  ],
};

describe("label export helpers", () => {
  it("lists active productions before planning productions and excludes complete ones", () => {
    assert.deepEqual(
      labelExportProductions(data).map((production) => production.id),
      ["prod-active", "prod-planning"],
    );
  });

  it("selects only on-set orders with active label content", () => {
    const items = labelExportItemsForProduction(data, "prod-active");

    assert.equal(items.length, 1);
    assert.equal(items[0]?.person.name, "Ava Stone");
    assert.equal(items[0]?.order?.id, "order-ava");
  });

  it("builds labels for the selected order ids only", () => {
    const selection = buildLabelExportSelection(data, "prod-active", ["order-ava"]);

    assert.equal(selection?.production.name, "Active shoot");
    assert.equal(selection?.client?.name, "Capture This");
    assert.equal(selection?.labels.length, 1);
    assert.equal(selection?.labels[0]?.title, "Ava Stone");
    assert.match(selection?.labels[0]?.drink || "", /Iced/i);
  });

  it("names exported files by person and order", () => {
    const selection = buildLabelExportSelection(data, "prod-active", ["order-ava"]);
    const fileName = niimbotM2ExportFileName(selection!.labels[0]!);

    assert.equal(fileName, "ava-stone-ava-niimbot-m2-50x30mm-300dpi.png");
  });
});
