import type { CoffeeData } from "./types";

const now = new Date().toISOString();

export const seedData: CoffeeData = {
  clients: [
    {
      id: "client-capture",
      name: "Northstar Outdoor",
      notes: "Prefers oat milk availability and clear cup labels.",
      active: true,
      created_at: now,
    },
    {
      id: "client-agency",
      name: "Frame & Field Agency",
      notes: "Agency team often joins video village mid-morning.",
      active: true,
      created_at: now,
    },
  ],
  people: [
    {
      id: "person-noah",
      name: "Noah Kim",
      type: "crew",
      role: "Sound Mixer",
      department: "Sound",
      company: "Capture This",
      photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=faces",
      usual_order: "Matcha latte, medium, almond milk",
      dietary_notes: "Almond milk",
      active: true,
      created_at: now,
    },
  ],
  client_people: [],
  productions: [
    {
      id: "prod-demo",
      name: "Northstar Trail Launch",
      client_id: "client-capture",
      shoot_date: new Date().toISOString().slice(0, 10),
      location: "Studio B / South Lot",
      runner_name: "Taylor",
      notes: "Coffee run before first client review.",
      status: "active",
      created_at: now,
    },
  ],
  production_roster: [],
  orders: [],
};
