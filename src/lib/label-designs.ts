export const labelDesigns = [
  {
    id: "grid-01",
    name: "Grid 01",
    summary: "Asymmetric Swiss hierarchy with a strict baseline.",
  },
  {
    id: "grid-02",
    name: "Grid 02",
    summary: "A quieter modular composition with more air.",
  },
  {
    id: "instrument",
    name: "Instrument",
    summary: "German industrial labeling, reduced to essentials.",
  },
  {
    id: "contact",
    name: "Contact",
    summary: "Fashion contact-sheet language with frame metadata.",
  },
  {
    id: "caption",
    name: "Caption",
    summary: "Editorial restraint with gallery-label precision.",
  },
  {
    id: "block",
    name: "Block",
    summary: "A severe brutalist field built for instant recognition.",
  },
] as const;

export type LabelDesignId = (typeof labelDesigns)[number]["id"];

export const defaultLabelDesignId: LabelDesignId = "grid-01";

export function isLabelDesignId(value: string): value is LabelDesignId {
  return labelDesigns.some((design) => design.id === value);
}
