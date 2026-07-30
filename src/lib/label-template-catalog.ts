import catalogJson from "../../mobile/assets/label_templates/label-templates-v1.json";
import {
  validateLabelTemplateCatalog,
  type LabelTemplateCatalog,
  type LabelTemplateCatalogEntry,
  type LabelTemplateDefinition,
} from "./label-template-schema";

const validation = validateLabelTemplateCatalog(catalogJson);
if (!validation.ok) {
  throw new Error(
    `Bundled label template catalog is invalid:\n${validation.errors.join("\n")}`,
  );
}

export const bundledLabelTemplateCatalog: LabelTemplateCatalog =
  validation.value;

export const bundledLabelTemplates = bundledLabelTemplateCatalog.templates;
export const defaultLabelDesignId = "grid-01";
export type LabelDesignId = string;

export function isLabelDesignId(value: string): value is LabelDesignId {
  return bundledLabelTemplates.some((template) => template.id === value);
}

export function getBundledLabelTemplate(
  id: string,
): LabelTemplateCatalogEntry {
  return (
    bundledLabelTemplates.find((template) => template.id === id) ||
    bundledLabelTemplates.find((template) => template.id === defaultLabelDesignId) ||
    bundledLabelTemplates[0]
  );
}

export function resolveLabelTemplateDefinition(
  value: string | LabelTemplateDefinition | LabelTemplateCatalogEntry,
): LabelTemplateDefinition {
  if (typeof value === "string") return getBundledLabelTemplate(value).definition;
  return "definition" in value ? value.definition : value;
}
