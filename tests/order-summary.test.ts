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

  it("handles missing and declined orders with operator-readable copy", () => {
    assert.equal(formatDrink(undefined), "No order");
    assert.equal(formatDrink({ ...baseOrder, status: "no_order" }), "No order");
    assert.equal(
      formatDrink({ ...baseOrder, drink_type: "", special_notes: "  " }),
      "Order not entered",
    );
  });

  it("shows decaf but hides the default Regular caffeine", () => {
    assert.equal(
      formatDrink({ ...baseOrder, caffeine: "Decaf" }),
      "Latte, Decaf",
    );
    assert.equal(formatDrink({ ...baseOrder, caffeine: "Regular" }), "Latte");
  });

  it("collapses messy whitespace in sparse hand-typed fields", () => {
    assert.equal(
      formatDrink({
        ...baseOrder,
        drink_type: "  Flat   White ",
        milk_type: " oat ",
      }),
      "Flat White, Oat milk",
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
