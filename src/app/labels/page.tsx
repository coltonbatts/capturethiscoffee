import { LabelsClient } from "./labels-client";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { getLabelsPageData } from "@/server/operator/queries";

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
  let initialError = "";
  try {
    initialData = await getLabelsPageData();
  } catch (error) {
    initialError = sanitizedOperatorError(error, "Could not load labels.");
  }
  return (
    <LabelsClient
      initialData={initialData}
      initialError={initialError}
      requestedProductionId={firstSearchParam(query.production)}
      requestedOrderId={firstSearchParam(query.order)}
    />
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}
