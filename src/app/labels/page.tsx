import { LabelsClient } from "./labels-client";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { getLabelsPageData } from "@/server/operator/queries";
import {
  getLabelTemplateWorkspace,
} from "@/server/operator/label-templates";
import type { ProductionLabelTemplateSelection } from "@/lib/label-template-schema";

type LabelsSearchParams = Promise<{
  production?: string | string[];
  order?: string | string[];
}>;

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: LabelsSearchParams;
}) {
  const query = await searchParams;
  let initialData = null;
  let initialProductionTemplates: Record<
    string,
    ProductionLabelTemplateSelection
  > = {};
  let initialError = "";
  try {
    const [coffeeData, templateWorkspace] = await Promise.all([
      getLabelsPageData(),
      getLabelTemplateWorkspace(),
    ]);
    initialData = coffeeData;
    const publishedById = new Map(
      templateWorkspace.versions
        .filter((version) => version.status === "published")
        .map((version) => [version.id, version]),
    );
    initialProductionTemplates = Object.fromEntries(
      coffeeData.productions.flatMap((production) => {
        const version = publishedById.get(
          production.label_template_version_id || "",
        );
        return version
          ? [
              [
                production.id,
                {
                  label: `${version.templateName} / v${version.version}`,
                  definition: version.definition,
                },
              ] as const,
            ]
          : [];
      }),
    );
  } catch (error) {
    initialError = sanitizedOperatorError(error, "Could not load labels.");
  }
  return (
    <LabelsClient
      initialData={initialData}
      initialProductionTemplates={initialProductionTemplates}
      initialError={initialError}
      requestedProductionId={firstSearchParam(query.production)}
      requestedOrderId={firstSearchParam(query.order)}
    />
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}
