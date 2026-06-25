import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  buildRunnerCoffeeData,
  hashProductionShareToken,
  sanitizeRunnerOrderPatch,
} from "../src/lib/production-share";

describe("production share access helpers", () => {
  it("hashes share tokens without storing the raw URL secret", () => {
    assert.equal(
      hashProductionShareToken("runner-token"),
      createHash("sha256").update("runner-token").digest("hex"),
    );
    assert.notEqual(hashProductionShareToken("runner-token"), "runner-token");
  });

  it("keeps token-scoped order writes to operational fields only", () => {
    assert.deepEqual(
      sanitizeRunnerOrderPatch({
        drink_type: "Latte",
        status: "confirmed",
        production_id: "other-production",
        person_id: "person-2",
        label_printed: true,
        created_at: "2026-06-01T00:00:00.000Z",
      }),
      {
        drink_type: "Latte",
        status: "confirmed",
      },
    );

    assert.deepEqual(sanitizeRunnerOrderPatch({ status: "archived" }), {});
  });

  it("omits private person fields from the runner payload", () => {
    const data = buildRunnerCoffeeData(
      {
        id: "prod-1",
        name: "Launch shoot",
        client_id: "client-1",
        shoot_date: "2026-06-24",
        location: "Studio",
        runner_name: "Luke",
        notes: "Internal production note",
        status: "active",
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "client-1",
        name: "Capture This",
        notes: "Client private note",
        active: true,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      [
        {
          id: "person-1",
          name: "Ava Stone",
          type: "crew",
          role: "DP",
          department: "Camera",
          company: "Freelance",
          photo_url: null,
          usual_order: "Iced latte",
          dietary_notes: "Private dietary note",
          notes: "Private person note",
          active: true,
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      [
        {
          id: "roster-1",
          production_id: "prod-1",
          person_id: "person-1",
          group_label: "Camera",
          on_set_today: true,
          sort_order: 1,
        },
      ],
      [
        {
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
          special_notes: null,
          vendor: null,
          status: "confirmed",
          label_printed: false,
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      ],
    );

    assert.equal(data.people[0].usual_order, "Iced latte");
    assert.equal(data.people[0].notes, "");
    assert.equal(data.people[0].dietary_notes, "");
    assert.equal(data.clients[0].notes, "");
    assert.equal(data.productions[0].notes, "");
  });
});
