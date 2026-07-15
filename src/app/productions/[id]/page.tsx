import { randomUUID } from "node:crypto";
import { ProductionDashboardClient } from "./production-dashboard-client";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { getProductionPageData } from "@/server/operator/queries";

export default async function ProductionDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let initialData = null;
  let initialError = "";
  try {
    initialData = await getProductionPageData(id);
  } catch (error) {
    initialError = sanitizedOperatorError(
      error,
      "Could not load this production.",
    );
  }
  return (
    <ProductionDashboardClient
      productionId={id}
      initialData={initialData}
      initialError={initialError}
      refreshKey={randomUUID()}
    />
  );
}
