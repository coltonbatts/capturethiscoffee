import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activePeopleNotOnProductionRoster,
  mergeProductionPeople,
  productionRosterItems,
} from "../src/lib/operator-production-people";
import type { CoffeeData, Person } from "../src/lib/types";

const productionId = "production-1";
const person = (id: string, active: boolean): Person => ({
  id,
  name: id,
  type: "crew",
  active,
  created_at: "2026-07-15T00:00:00.000Z",
});

const inactiveRostered = person("inactive-rostered", false);
const inactiveUnrostered = person("inactive-unrostered", false);
const activeRostered = person("active-rostered", true);
const activeUnrostered = person("active-unrostered", true);

function productionData(people: Person[]): CoffeeData {
  return {
    clients: [],
    people,
    client_people: [],
    productions: [],
    production_roster: [
      {
        id: "roster-inactive",
        production_id: productionId,
        person_id: inactiveRostered.id,
        on_set_today: true,
        sort_order: 1,
      },
      {
        id: "roster-active",
        production_id: productionId,
        person_id: activeRostered.id,
        on_set_today: true,
        sort_order: 2,
      },
    ],
    orders: [],
  };
}

describe("production-scoped people", () => {
  const merged = mergeProductionPeople(
    [inactiveRostered, activeRostered],
    [activeRostered, activeUnrostered],
  );
  const data = productionData([
    ...merged,
    inactiveUnrostered,
  ]);

  it("keeps an inactive person who is already rostered visible", () => {
    assert.deepEqual(
      productionRosterItems(data, productionId).map((item) => item.person.id),
      [inactiveRostered.id, activeRostered.id],
    );
  });

  it("offers active non-rostered people but not inactive non-rostered people", () => {
    assert.deepEqual(
      activePeopleNotOnProductionRoster(data, productionId).map(
        (candidate) => candidate.id,
      ),
      [activeUnrostered.id],
    );
  });

  it("deduplicates people returned by both roster and active queries", () => {
    assert.equal(merged.filter((candidate) => candidate.id === activeRostered.id).length, 1);
    assert.equal(new Set(merged.map((candidate) => candidate.id)).size, merged.length);
  });
});
