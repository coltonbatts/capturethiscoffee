export const labelDesigns = [
  {
    id: "smiley",
    name: "Smiley",
    summary: "Name, drink, and the Capture This smiley. Nothing else.",
  },
] as const;

export type LabelDesignId = (typeof labelDesigns)[number]["id"];

export const defaultLabelDesignId: LabelDesignId = "smiley";

export function isLabelDesignId(value: string): value is LabelDesignId {
  return labelDesigns.some((design) => design.id === value);
}
