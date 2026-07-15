import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCoffeeLabelForOrder } from "../src/lib/printer-queue";
import {
  toOrderLabelContext,
  toRunnerCoffeeData,
  type OrderLabelSource,
  type ProductionAggregate,
} from "../src/server/productions/dto";

const production = {
  id: "prod-1",
  name: "Launch shoot",
  client_id: "client-1",
  shoot_date: null,
  location: null,
  runner_name: null,
  notes: "PRIVATE PRODUCTION NOTE",
  status: "active" as const,
  created_at: "2026-06-01T00:00:00.000Z",
};

const client = {
  id: "client-1",
  name: "Capture This",
  notes: "PRIVATE CLIENT NOTE",
  active: true,
  created_at: "2026-06-01T00:00:00.000Z",
};

const person = {
  id: "person-1",
  name: "Ava Stone",
  type: "crew" as const,
  role: "DP",
  department: "Camera",
  company: "Freelance",
  photo_url: null,
  usual_order: "Iced oat latte",
  dietary_notes: "PRIVATE DIETARY NOTE",
  notes: "PRIVATE PERSON NOTE",
  active: true,
  created_at: "2026-06-01T00:00:00.000Z",
};

const roster = {
  id: "roster-1",
  production_id: "prod-1",
  person_id: "person-1",
  group_label: "Camera",
  on_set_today: true,
  sort_order: 1,
};

const order = {
  id: "order-1",
  production_id: "prod-1",
  roster_id: "roster-1",
  person_id: "person-1",
  drink_type: "Latte",
  size: null,
  temperature: "Iced",
  milk_type: "Oat",
  sweetener: null,
  caffeine: "Regular",
  special_notes: "No room",
  vendor: null,
  status: "confirmed" as const,
  label_printed: false,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

describe("production runner DTO", () => {
  it("constructs the public aggregate without private fields", () => {
    const aggregate: ProductionAggregate = {
      production,
      client,
      people: [person],
      roster: [roster],
      orders: [order],
    };

    const data = toRunnerCoffeeData(aggregate);
    const serialized = JSON.stringify(data);

    assert.equal(data.productions[0]?.shoot_date, "");
    assert.equal(data.productions[0]?.location, "");
    assert.equal(data.clients[0]?.notes, "");
    assert.equal(data.people[0]?.usual_order, "Iced oat latte");
    assert.equal(data.people[0]?.dietary_notes, "");
    assert.equal(data.people[0]?.notes, "");
    assert.equal(data.orders[0]?.special_notes, "No room");
    assert.deepEqual(data.client_people, []);
    assert.ok(!serialized.includes("PRIVATE PRODUCTION NOTE"));
    assert.ok(!serialized.includes("PRIVATE CLIENT NOTE"));
    assert.ok(!serialized.includes("PRIVATE DIETARY NOTE"));
    assert.ok(!serialized.includes("PRIVATE PERSON NOTE"));
  });
});

describe("order label context", () => {
  const source: OrderLabelSource = { production, client, person, roster, order };

  it("builds the same printable label from one scoped order", () => {
    const context = toOrderLabelContext(source);
    assert.ok(context);

    const label = buildCoffeeLabelForOrder(context);
    assert.ok(label);
    assert.equal(label.id, "order-1");
    assert.equal(label.personName, "Ava Stone");
    assert.equal(label.group, "Camera");
    assert.equal(label.productionClient, "Launch shoot / Capture This");
    assert.match(label.drink, /Iced/);
    assert.match(label.drink, /Latte/);
    assert.equal(label.notesStatus, "Confirmed");
  });

  it("rejects cross-production, off-set, and uncaptured orders", () => {
    assert.equal(
      toOrderLabelContext({
        ...source,
        order: { ...order, production_id: "prod-other" },
      }),
      null,
    );
    assert.equal(
      toOrderLabelContext({
        ...source,
        roster: { ...roster, on_set_today: false },
      }),
      null,
    );
    assert.equal(
      toOrderLabelContext({
        ...source,
        order: { ...order, status: "not_asked" },
      }),
      null,
    );
    assert.equal(
      toOrderLabelContext({
        ...source,
        order: { ...order, status: "no_order" },
      }),
      null,
    );
  });
});
