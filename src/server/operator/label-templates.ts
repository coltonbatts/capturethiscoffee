import "server-only";

import type { Json } from "@/lib/supabase";
import {
  validateLabelTemplateDefinition,
  type LabelTemplateDefinition,
} from "@/lib/label-template-schema";
import type { ProductionStatus } from "@/lib/types";
import { requireOperatorContext } from "./context";
import {
  OperatorDataError,
  throwOperatorDatabaseError,
} from "./errors";
import { requireId } from "./validation";

export type LabelTemplateIdentityDto = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
};

export type LabelTemplateVersionDto = {
  id: string;
  templateId: string;
  templateSlug: string;
  templateName: string;
  version: number;
  status: "draft" | "published";
  definition: LabelTemplateDefinition;
  definitionChecksum: string;
  changelog: string;
  publishedAt: string;
};

export type LabelTemplateWorkspaceDto = {
  templates: LabelTemplateIdentityDto[];
  versions: LabelTemplateVersionDto[];
  defaultVersionId: string;
};

export type LabelTemplateDraftInput = {
  slug?: string;
  displayName: string;
  description?: string;
  definition: unknown;
  changelog?: string;
};

export async function getLabelTemplateWorkspace(): Promise<LabelTemplateWorkspaceDto> {
  const { supabase } = await requireOperatorContext();
  const [templatesResult, versionsResult, settingsResult] = await Promise.all([
    supabase
      .from("label_templates")
      .select("*")
      .order("display_name", { ascending: true }),
    supabase
      .from("label_template_versions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("label_template_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  throwOperatorDatabaseError(
    templatesResult.error,
    "Could not load label templates.",
  );
  throwOperatorDatabaseError(
    versionsResult.error,
    "Could not load label template versions.",
  );
  throwOperatorDatabaseError(
    settingsResult.error,
    "Could not load the label template default.",
  );

  const templates: LabelTemplateIdentityDto[] = (templatesResult.data || []).map(
    (template) => ({
      id: template.id,
      slug: template.slug,
      displayName: template.display_name,
      description: template.description || "",
    }),
  );
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const versions: LabelTemplateVersionDto[] = (versionsResult.data || []).map(
    (version) => {
      const validation = validateLabelTemplateDefinition(version.definition);
      if (!validation.ok) {
        throw new OperatorDataError(
          `Stored template v${version.version} is invalid: ${validation.errors[0]}`,
          "database",
        );
      }
      const template = templateById.get(version.template_id);
      if (!template) {
        throw new OperatorDataError(
          "A label template version has no matching template.",
          "database",
        );
      }
      return {
        id: version.id,
        templateId: version.template_id,
        templateSlug: template.slug,
        templateName: template.displayName,
        version: version.version,
        status: version.status,
        definition: validation.value,
        definitionChecksum: version.definition_checksum,
        changelog: version.changelog || "",
        publishedAt: version.published_at || "",
      };
    },
  );

  return {
    templates,
    versions,
    defaultVersionId: settingsResult.data?.default_version_id || "",
  };
}

export async function createLabelTemplateDraft(
  input: LabelTemplateDraftInput,
) {
  const { supabase } = await requireOperatorContext();
  const slug = requireSlug(input.slug || "");
  const displayName = requireText(input.displayName, "Template name", 80);
  const definition = requireDefinition(input.definition);
  const result = await supabase.rpc("create_label_template_draft", {
    p_slug: slug,
    p_display_name: displayName,
    p_description: optionalText(input.description, 500),
    p_definition: definition as Json,
    p_changelog: optionalText(input.changelog, 1000),
  });
  throwOperatorDatabaseError(result.error, "Could not create template draft.");
  return requireRpcId(result.data, "Could not create template draft.");
}

export async function duplicateLabelTemplateDraft(versionId: string) {
  const { supabase } = await requireOperatorContext();
  const id = requireId(versionId, "Template version ID");
  const sourceResult = await supabase
    .from("label_template_versions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwOperatorDatabaseError(
    sourceResult.error,
    "Could not load the template version.",
  );
  const source = sourceResult.data;
  if (!source || source.status !== "published") {
    throw new OperatorDataError(
      "Only a published template version can be duplicated.",
      "validation",
    );
  }
  const definition = requireDefinition(source.definition);
  const result = await supabase.rpc("create_label_template_draft", {
    p_template_id: source.template_id,
    p_definition: definition as Json,
    p_changelog: `Drafted from v${source.version}.`,
  });
  throwOperatorDatabaseError(result.error, "Could not duplicate template.");
  return requireRpcId(result.data, "Could not duplicate template.");
}

export async function updateLabelTemplateDraft(
  versionId: string,
  input: Omit<LabelTemplateDraftInput, "slug">,
) {
  const { supabase } = await requireOperatorContext();
  const id = requireId(versionId, "Template version ID");
  const definition = requireDefinition(input.definition);
  const result = await supabase.rpc("update_label_template_draft", {
    p_version_id: id,
    p_definition: definition as Json,
    p_display_name: requireText(input.displayName, "Template name", 80),
    p_description: optionalText(input.description, 500),
    p_changelog: optionalText(input.changelog, 1000),
  });
  throwOperatorDatabaseError(result.error, "Could not save template draft.");
  return requireRpcId(result.data, "Could not save template draft.");
}

export async function publishLabelTemplateVersion(versionId: string) {
  const { supabase } = await requireOperatorContext();
  const id = requireId(versionId, "Template version ID");
  const draftResult = await supabase
    .from("label_template_versions")
    .select("definition,status")
    .eq("id", id)
    .maybeSingle();
  throwOperatorDatabaseError(
    draftResult.error,
    "Could not load the template draft.",
  );
  if (!draftResult.data || draftResult.data.status !== "draft") {
    throw new OperatorDataError("Only a draft can be published.", "validation");
  }
  requireDefinition(draftResult.data.definition);
  const result = await supabase.rpc("publish_label_template_version", {
    p_version_id: id,
  });
  throwOperatorDatabaseError(result.error, "Could not publish template.");
  return requireRpcId(result.data, "Could not publish template.");
}

export async function setDefaultLabelTemplateVersion(versionId: string) {
  const { supabase } = await requireOperatorContext();
  const id = requireId(versionId, "Template version ID");
  const result = await supabase.rpc("set_default_label_template_version", {
    p_version_id: id,
  });
  throwOperatorDatabaseError(
    result.error,
    "Could not update the default template.",
  );
  return { id };
}

export async function assignLabelTemplateToProduction(
  productionId: string,
  versionId: string,
) {
  const { supabase } = await requireOperatorContext();
  const dayId = requireId(productionId, "Production ID");
  const templateVersionId = requireId(versionId, "Template version ID");
  const [dayResult, versionResult] = await Promise.all([
    supabase
      .from("productions")
      .select("status")
      .eq("id", dayId)
      .maybeSingle(),
    supabase
      .from("label_template_versions")
      .select("status")
      .eq("id", templateVersionId)
      .maybeSingle(),
  ]);
  throwOperatorDatabaseError(dayResult.error, "Could not load production.");
  throwOperatorDatabaseError(
    versionResult.error,
    "Could not load template version.",
  );
  requirePlanning(dayResult.data?.status);
  if (versionResult.data?.status !== "published") {
    throw new OperatorDataError(
      "A production can use only a published template.",
      "validation",
    );
  }
  const result = await supabase.rpc("assign_label_template_to_production", {
    p_production_id: dayId,
    p_version_id: templateVersionId,
  });
  throwOperatorDatabaseError(
    result.error,
    "Could not assign the production template.",
  );
  return { productionId: dayId, versionId: templateVersionId };
}

function requireDefinition(value: unknown) {
  const validation = validateLabelTemplateDefinition(value);
  if (!validation.ok) {
    throw new OperatorDataError(
      validation.errors.slice(0, 4).join(" "),
      "validation",
    );
  }
  return validation.value;
}

function requireSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(slug)) {
    throw new OperatorDataError(
      "Template slug must be 2–48 lowercase letters, numbers, or hyphens and begin with a letter.",
      "validation",
    );
  }
  return slug;
}

function requireText(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new OperatorDataError(
      `${label} must be 1–${max} characters.`,
      "validation",
    );
  }
  return normalized;
}

function optionalText(value: string | undefined, max: number) {
  const normalized = value?.trim() || "";
  if (normalized.length > max) {
    throw new OperatorDataError(
      `Text must not exceed ${max} characters.`,
      "validation",
    );
  }
  return normalized || null;
}

function requirePlanning(status: ProductionStatus | undefined) {
  if (status !== "planning") {
    throw new OperatorDataError(
      "Label templates can be assigned only while a production is Planning.",
      "validation",
    );
  }
}

function requireRpcId(value: Json, message: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OperatorDataError(message, "database");
  }
  const id = value.id;
  if (typeof id !== "string" || !id) {
    throw new OperatorDataError(message, "database");
  }
  return { id };
}
