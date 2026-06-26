export const labelDesigns = [
  {
    id: "y2k-smiley-seal",
    name: "Y2K Smiley Seal",
    summary: "Round smiley seal, bold name block, chunky monochrome brand rail.",
  },
  {
    id: "brutalist-ticket-stub",
    name: "Brutalist Ticket Stub",
    summary: "Perforated ticket language with hard rules and production-code energy.",
  },
  {
    id: "cyber-cafe-receipt",
    name: "Cyber Cafe Receipt",
    summary: "Receipt rows, mono details, and a cafe system label feel.",
  },
  {
    id: "classic",
    name: "Classic",
    summary: "Current Capture This Coffee export layout for continuity checks.",
  },
] as const;

export type LabelDesignId = (typeof labelDesigns)[number]["id"];

export const defaultLabelDesignId: LabelDesignId = "y2k-smiley-seal";

export function isLabelDesignId(value: string): value is LabelDesignId {
  return labelDesigns.some((design) => design.id === value);
}

export function labelDesignName(id: LabelDesignId) {
  return labelDesigns.find((design) => design.id === id)?.name || id;
}
