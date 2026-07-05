import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLabelExportSelection,
  initialLabelExportSelection,
  labelExportItemsForProduction,
  labelExportProductions,
  niimbotBatchCsv,
  unprintedOrderIds,
  type ActiveLabelExportItem,
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
    {
      id: "person-3",
      name: "Parker Plan",
      type: "crew",
      department: "Grip",
      usual_order: "",
      active: true,
      created_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "person-4",
      name: "Nell Notyet",
      type: "crew",
      department: "Art",
      usual_order: "",
      active: true,
      created_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "person-5",
      name: "Pat Printed",
      type: "crew",
      department: "Sound",
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
    {
      id: "roster-3",
      production_id: "prod-planning",
      person_id: "person-3",
      group_label: "Grip",
      on_set_today: true,
      sort_order: 1,
    },
    {
      id: "roster-4",
      production_id: "prod-active",
      person_id: "person-4",
      group_label: "Art",
      on_set_today: true,
      sort_order: 3,
    },
    {
      id: "roster-5",
      production_id: "prod-active",
      person_id: "person-5",
      group_label: "Sound",
      on_set_today: true,
      sort_order: 4,
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
    {
      id: "order-planning",
      production_id: "prod-planning",
      roster_id: "roster-3",
      person_id: "person-3",
      drink_type: "Cold brew",
      status: "confirmed",
      label_printed: false,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "order-not-asked",
      production_id: "prod-active",
      roster_id: "roster-4",
      person_id: "person-4",
      status: "not_asked",
      label_printed: false,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "order-printed",
      production_id: "prod-active",
      roster_id: "roster-5",
      person_id: "person-5",
      drink_type: "Drip",
      status: "delivered",
      label_printed: true,
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

  it("selects only captured drinks: no_order and not_asked stay out of the batch", () => {
    const items = labelExportItemsForProduction(data, "prod-active");

    assert.deepEqual(
      items.map((item) => item.order.id),
      ["order-ava", "order-printed"],
    );
  });

  it("builds labels for the selected order ids only", () => {
    const selection = buildLabelExportSelection(data, "prod-active", ["order-ava"]);

    assert.equal(selection?.production.name, "Active shoot");
    assert.equal(selection?.client?.name, "Capture This");
    assert.equal(selection?.labels.length, 1);
    assert.equal(selection?.labels[0]?.title, "Ava Stone");
    assert.match(selection?.labels[0]?.drink || "", /Iced/i);
  });

  it("uses a requested order id as the initial label selection", () => {
    assert.deepEqual(initialLabelExportSelection(data, "order-planning"), {
      productionId: "prod-planning",
      selectedOrderIds: ["order-planning"],
    });
  });

  it("falls back to the preferred production's full batch when the requested order cannot be exported", () => {
    assert.deepEqual(initialLabelExportSelection(data, "order-none"), {
      productionId: "prod-active",
      selectedOrderIds: ["order-ava", "order-printed"],
    });
  });

  it("selects a requested production's whole batch", () => {
    assert.deepEqual(initialLabelExportSelection(data, "", "prod-planning"), {
      productionId: "prod-planning",
      selectedOrderIds: ["order-planning"],
    });
  });

  it("selects the whole batch of the preferred production by default", () => {
    assert.deepEqual(initialLabelExportSelection(data), {
      productionId: "prod-active",
      selectedOrderIds: ["order-ava", "order-printed"],
    });
  });

  it("lists only unprinted labels for reprint-safe batch selection", () => {
    const items = labelExportItemsForProduction(data, "prod-active");
    assert.deepEqual(unprintedOrderIds(items), ["order-ava"]);
  });

  it("names exported files by person and order", () => {
    const selection = buildLabelExportSelection(data, "prod-active", ["order-ava"]);
    const fileName = niimbotM2ExportFileName(selection!.labels[0]!);

    assert.equal(fileName, "ava-stone-ava-niimbot-m2-50x30mm-300dpi.png");
  });

  it("keeps exported file names bounded and filesystem safe for long names", () => {
    const fileName = niimbotM2ExportFileName(
      "Anna-Louise Wojciechowski-Konstantinopoulos (2nd AC / B-Cam) ✨",
    );
    const [stem] = fileName.split("-niimbot-m2-");

    assert.ok(stem.length <= 48, `expected stem <= 48 chars, got ${stem.length}`);
    assert.match(stem, /^[a-z0-9-]+$/);
    assert.ok(fileName.endsWith("-niimbot-m2-50x30mm-300dpi.png"));
  });
});

describe("NIIMBOT batch CSV", () => {
  const items = labelExportItemsForProduction(data, "prod-active");

  it("writes a header row plus one quoted row per item, CRLF separated", () => {
    assert.equal(
      niimbotBatchCsv(items),
      '"crew name","drink"\r\n"Ava Stone","Medium, Iced, Latte, Oat milk, No room"\r\n"Pat Printed","Drip"',
    );
  });

  it("escapes quotes and flattens newlines so rows never split", () => {
    const awkward: ActiveLabelExportItem = {
      ...items[0]!,
      person: { ...items[0]!.person, name: 'Ava "Stoney" Stone' },
      order: {
        ...items[0]!.order,
        drink_type: "Latte",
        size: "",
        temperature: "",
        milk_type: "",
        special_notes: "extra hot\nno lid",
      },
    };

    const [header, row] = niimbotBatchCsv([awkward]).split("\r\n");
    assert.equal(header, '"crew name","drink"');
    assert.equal(row, '"Ava ""Stoney"" Stone","Latte, extra hot no lid"');
  });

  it("exports only the header when nothing is selected", () => {
    assert.equal(niimbotBatchCsv([]), '"crew name","drink"');
  });
});
