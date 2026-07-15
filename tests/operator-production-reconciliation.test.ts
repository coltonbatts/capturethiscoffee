import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeProductionCoffeeData } from "../src/lib/operator-production-reconciliation";
import type { CoffeeData, Order, Person } from "../src/lib/types";

const order = (id: string, drink: string): Order => ({
  id,
  production_id: "08d08e2e-5318-40dc-a7ac-0f03eee60241",
  roster_id: `roster-${id}`,
  person_id: `person-${id}`,
  drink_type: drink,
  size: "",
  temperature: "",
  milk_type: "",
  sweetener: "",
  caffeine: "",
  special_notes: "",
  vendor: "",
  status: "confirmed",
  label_printed: false,
  created_at: "2026-07-15T00:00:00.000Z",
  updated_at: "2026-07-15T00:00:00.000Z",
});

const data = (orders: Order[]): CoffeeData => ({
  clients: [],
  people: [],
  client_people: [],
  productions: [],
  production_roster: [],
  orders,
});

describe("operator production prop reconciliation", () => {
  it("keeps pending optimistic orders while accepting refreshed server props", () => {
    const productionId = "08d08e2e-5318-40dc-a7ac-0f03eee60241";
    const current = data([
      order("pending", "Optimistic latte"),
      order("settled", "Old tea"),
    ]);
    const incoming = data([
      order("pending", "Stale server latte"),
      order("settled", "Fresh server tea"),
    ]);

    const next = mergeProductionCoffeeData(
      current,
      incoming,
      productionId,
      new Set(["pending"]),
    );

    assert.equal(next.orders.find((item) => item.id === "pending")?.drink_type, "Optimistic latte");
    assert.equal(next.orders.find((item) => item.id === "settled")?.drink_type, "Fresh server tea");
  });

  it("accepts the refreshed production people union as authoritative", () => {
    const productionId = "08d08e2e-5318-40dc-a7ac-0f03eee60241";
    const stalePickerPerson: Person = {
      id: "stale-picker-person",
      name: "Former picker candidate",
      type: "crew",
      active: true,
      created_at: "2026-07-15T00:00:00.000Z",
    };
    const current = { ...data([]), people: [stalePickerPerson] };
    const incoming = data([]);

    const next = mergeProductionCoffeeData(
      current,
      incoming,
      productionId,
      new Set(),
    );

    assert.deepEqual(next.people, []);
  });
});
