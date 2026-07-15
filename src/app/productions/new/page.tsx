import { NewProductionClient } from "./new-production-client";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { getNewProductionPageData } from "@/server/operator/queries";

export default async function NewProductionPage() {
  let initialError = "";
  try {
    await getNewProductionPageData();
  } catch (error) {
    initialError = sanitizedOperatorError(
      error,
      "Could not prepare a new day.",
    );
  }
  return <NewProductionClient initialError={initialError} />;
}
