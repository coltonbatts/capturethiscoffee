import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDrink } from "../src/lib/order-summary";
import type { Order } from "../src/lib/types";

const baseOrder: Order = {
  id: "order-1",
  production_id: "prod-1",
  roster_id: "roster-1",
  person_id: "person-1",
  drink_type: "Latte",
  status: "confirmed",
  label_printed: false,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-06-01T12:00:00.000Z",
};

describe("order summaries", () => {
  it("removes duplicate modifiers already present in the drink name", () => {
    assert.equal(
      formatDrink({
        ...baseOrder,
        drink_type: "Iced Oat Milk Latte",
        temperature: "Iced",
        milk_type: "oat",
      }),
      "Iced Oat Milk Latte",
    );
  });

  it("recovers a drink name from legacy parsed usual-order notes", () => {
    assert.equal(
      formatDrink({
        ...baseOrder,
        drink_type: "Medium",
        size: "medium",
        milk_type: "oat",
        special_notes: "Oat Milk Latte",
      }),
      "Medium, Oat Milk Latte",
    );
  });

  it("keeps true preparation notes in the summary", () => {
    assert.equal(
      formatDrink({
        ...baseOrder,
        size: "Medium",
        temperature: "Iced",
        milk_type: "Oat",
        special_notes: "No room",
      }),
      "Medium, Iced, Latte, Oat milk, No room",
    );
  });
});
