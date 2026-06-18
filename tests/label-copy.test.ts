import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCoffeeLabels,
  defaultLabelOptions,
  labelToText,
  type LabelFormatterOptions,
} from "../src/lib/label-copy";
import type { RosterOrder } from "../src/lib/types";

const rosterOrder: RosterOrder = {
  roster: {
    id: "roster-1",
    production_id: "prod-1",
    person_id: "person-1",
    group_label: "Camera",
    on_set_today: true,
    sort_order: 1,
  },
  person: {
    id: "person-1",
    name: "Ava Stone",
    type: "crew",
    department: "Camera",
    usual_order: "",
    active: true,
    created_at: "2026-06-18T12:00:00.000Z",
  },
  order: {
    id: "order-abcdef123456",
    production_id: "prod-1",
    roster_id: "roster-1",
    person_id: "person-1",
    size: "Medium",
    temperature: "Iced",
    drink_type: "Latte",
    milk_type: "Oat",
    sweetener: "Half sweet",
    caffeine: "Regular",
    special_notes: "No room",
    vendor: "",
    status: "confirmed",
    label_printed: false,
    created_at: "2026-06-18T12:00:00.000Z",
    updated_at: "2026-06-18T12:00:00.000Z",
  },
};

describe("label copy", () => {
  it("builds readable standard M2 label lines for an active order", () => {
    const [label] = buildCoffeeLabels(
      { name: "Wellness shoot" },
      { name: "Capture This" },
      [rosterOrder],
      defaultLabelOptions,
    );

    assert.equal(label.personName, "Ava Stone");
    assert.equal(label.title, "Ava Stone");
    assert.match(label.drink, /Medium/i);
    assert.match(label.drink, /Iced/i);
    assert.match(label.drink, /Latte/i);
    assert.match(label.drink, /Oat/i);
    assert.equal(label.footerStart, "Camera  #ABCDEF");
    assert.equal(label.footerEnd, "Wellness shoot / Capture This");
    assert.deepEqual(label.lines, [
      "Ava Stone",
      label.drink,
      "Camera  #ABCDEF - Wellness shoot / Capture This",
    ]);
  });

  it("keeps hidden fields out of copied label text", () => {
    const [label] = buildCoffeeLabels(
      { name: "Wellness shoot" },
      { name: "Capture This" },
      [rosterOrder],
      defaultLabelOptions,
    );
    const compactOptions: LabelFormatterOptions = {
      style: "compact",
      fields: {
        personName: false,
        drink: true,
        group: false,
        productionClient: false,
        notesStatus: false,
        orderId: false,
      },
    };

    assert.equal(labelToText(label, compactOptions), `${label.drink}\nCAPTURE THIS`);
  });

  it("does not build labels for people who are off set or have no order", () => {
    assert.deepEqual(
      buildCoffeeLabels(
        { name: "Wellness shoot" },
        undefined,
        [{ ...rosterOrder, roster: { ...rosterOrder.roster, on_set_today: false } }],
        defaultLabelOptions,
      ),
      [],
    );
    assert.deepEqual(
      buildCoffeeLabels(
        { name: "Wellness shoot" },
        undefined,
        [{ ...rosterOrder, order: undefined }],
        defaultLabelOptions,
      ),
      [],
    );
  });
});
