import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureProgress,
  isOrderCaptured,
  isOrderSkipped,
  needsOrder,
} from "../src/lib/order-progress";
import type { Order, OrderStatus, RosterOrder } from "../src/lib/types";

function order(status: OrderStatus, labelPrinted = false): Order {
  return {
    id: `order-${status}`,
    production_id: "prod-1",
    roster_id: `roster-${status}`,
    person_id: `person-${status}`,
    drink_type: "Latte",
    status,
    label_printed: labelPrinted,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  };
}

function item(
  status: OrderStatus,
  options: { onSet?: boolean; labelPrinted?: boolean } = {},
): RosterOrder {
  return {
    roster: {
      id: `roster-${status}`,
      production_id: "prod-1",
      person_id: `person-${status}`,
      group_label: "Camera",
      on_set_today: options.onSet ?? true,
      sort_order: 1,
    },
    person: {
      id: `person-${status}`,
      name: "Ava Stone",
      type: "crew",
      active: true,
      created_at: "2026-06-01T00:00:00.000Z",
    },
    order: order(status, options.labelPrinted),
  };
}

describe("order capture model", () => {
  it("treats every legacy pipeline status as captured", () => {
    for (const status of [
      "confirmed",
      "ordered",
      "picked_up",
      "delivered",
    ] as const) {
      assert.equal(isOrderCaptured(order(status)), true, status);
      assert.equal(needsOrder(order(status)), false, status);
      assert.equal(isOrderSkipped(order(status)), false, status);
    }
  });

  it("treats not_asked as needing an order and no_order as skipped", () => {
    assert.equal(isOrderCaptured(order("not_asked")), false);
    assert.equal(needsOrder(order("not_asked")), true);
    assert.equal(isOrderSkipped(order("no_order")), true);
    assert.equal(isOrderCaptured(order("no_order")), false);
    assert.equal(needsOrder(order("no_order")), false);
  });

  it("treats a missing order row as needing an order", () => {
    assert.equal(needsOrder(undefined), true);
    assert.equal(isOrderCaptured(undefined), false);
    assert.equal(isOrderSkipped(undefined), false);
  });
});

describe("captureProgress", () => {
  it("counts captured, skipped, needed, and printed drinks on set", () => {
    const progress = captureProgress([
      item("confirmed", { labelPrinted: true }),
      item("delivered"),
      item("no_order"),
      item("not_asked"),
    ]);

    assert.deepEqual(progress, {
      total: 4,
      captured: 2,
      skipped: 1,
      needed: 1,
      printed: 1,
      percent: 75,
    });
  });

  it("ignores people who are off set today", () => {
    const progress = captureProgress([
      item("confirmed"),
      item("delivered", { onSet: false }),
    ]);

    assert.equal(progress.total, 1);
    assert.equal(progress.captured, 1);
    assert.equal(progress.percent, 100);
  });

  it("reaches 100% when everyone is captured or skipped", () => {
    const progress = captureProgress([item("confirmed"), item("no_order")]);
    assert.equal(progress.percent, 100);
    assert.equal(progress.needed, 0);
  });

  it("handles an empty roster without dividing by zero", () => {
    assert.equal(captureProgress([]).percent, 0);
  });
});
