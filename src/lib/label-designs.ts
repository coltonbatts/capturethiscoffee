export const labelDesigns = [
  {
    id: "smiley",
    name: "Smiley",
    summary: "Name, drink, and the Capture This smiley. Nothing else.",
  },
  {
    id: "knockout",
    name: "Knockout",
    summary: "Full-bleed black with white type. Wordmark, name, drink.",
  },
] as const;

export type LabelDesignId = (typeof labelDesigns)[number]["id"];

export const defaultLabelDesignId: LabelDesignId = "smiley";

export function isLabelDesignId(value: string): value is LabelDesignId {
  return labelDesigns.some((design) => design.id === value);
}
