import {
  bundledLabelTemplates,
  defaultLabelDesignId,
  isLabelDesignId,
  type LabelDesignId,
} from "./label-template-catalog";

export const labelDesigns = bundledLabelTemplates.map(
  ({ id, name, summary, version }) => ({
    id,
    name,
    summary,
    version,
  }),
);

export { defaultLabelDesignId, isLabelDesignId };
export type { LabelDesignId };
