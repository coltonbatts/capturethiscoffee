import type { Person, PersonType } from "./types";

export const personTypes: PersonType[] = [
  "client_contact",
  "agency",
  "crew",
  "guest",
];

export const groupSuggestions = [
  "Client",
  "Agency",
  "Director / Creative",
  "Production",
  "Camera",
  "G&E",
  "Art",
  "HMU / Wardrobe",
  "Talent",
  "Other",
];

export type PersonForm = {
  name: string;
  type: PersonType;
  role: string;
  department: string;
  company: string;
  photo_url: string;
  usual_order: string;
  dietary_notes: string;
  notes: string;
  active: boolean;
};

export const emptyPersonForm = (type: PersonType = "crew"): PersonForm => ({
  name: "",
  type,
  role: "",
  department: "",
  company: "",
  photo_url: "",
  usual_order: "",
  dietary_notes: "",
  notes: "",
  active: true,
});

export const personToForm = (person: Person): PersonForm => ({
  name: person.name,
  type: person.type,
  role: person.role || "",
  department: person.department || "",
  company: person.company || "",
  photo_url: person.photo_url || "",
  usual_order: person.usual_order || "",
  dietary_notes: person.dietary_notes || "",
  notes: person.notes || "",
  active: person.active,
});

export const personTypeLabel = (type: PersonType) => type.replace("_", " ");
