import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  reconcileProductionBoard,
  replaceProductionBoardOrder,
  type ProductionBoardDTO,
} from "../src/lib/production-board";

const board: ProductionBoardDTO = {
  production: {
    id: "prod-1",
    name: "Shoot",
    shoot_date: "",
    location: "",
    runner_name: "",
    status: "active",
    client_name: "Client",
  },
  roster: [
    {
      roster_id: "roster-1",
      group_label: "Camera",
      on_set_today: true,
      sort_order: 1,
      person: {
        id: "person-1",
        name: "Ava",
        role: "DP",
        department: "Camera",
        company: "",
        photo_url: "",
        usual_order: "Latte",
      },
      order: {
        id: "order-1",
        drink_type: "Latte",
        size: "",
        temperature: "",
        milk_type: "",
        sweetener: "",
        caffeine: "Regular",
        special_notes: "",
        vendor: "",
        status: "not_asked",
        label_printed: false,
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    },
    {
      roster_id: "roster-2",
      group_label: "Art",
      on_set_today: true,
      sort_order: 2,
      person: {
        id: "person-2",
        name: "Ben",
        role: "",
        department: "Art",
        company: "",
        photo_url: "",
        usual_order: "Tea",
      },
      order: {
        id: "order-2",
        drink_type: "Tea",
        size: "",
        temperature: "",
        milk_type: "",
        sweetener: "",
        caffeine: "",
        special_notes: "",
        vendor: "",
        status: "confirmed",
        label_printed: false,
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    },
  ],
};

describe("runner board order reconciliation", () => {
  it("replaces only the affected joined order", () => {
    const originalOtherOrder = board.roster[1]!.order;
    const replacement = {
      ...board.roster[0]!.order!,
      status: "confirmed" as const,
    };
    const next = replaceProductionBoardOrder(board, "order-1", replacement);

    assert.equal(next.roster[0]?.order, replacement);
    assert.equal(next.roster[1]?.order, originalOtherOrder);
  });

  it("keeps an optimistic order while accepting the rest of a poll snapshot", () => {
    const optimistic = replaceProductionBoardOrder(board, "order-1", {
      ...board.roster[0]!.order!,
      status: "confirmed",
      drink_type: "Optimistic latte",
    });
    const incoming = {
      ...board,
      roster: board.roster.map((item) => ({
        ...item,
        order: item.order ? { ...item.order, drink_type: "Server value" } : null,
      })),
    };
    const next = reconcileProductionBoard(
      optimistic,
      incoming,
      new Set(["order-1"]),
    );

    assert.equal(next.roster[0]?.order?.drink_type, "Optimistic latte");
    assert.equal(next.roster[1]?.order?.drink_type, "Server value");
  });
});
