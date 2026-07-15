import { ProductionsClient } from "./productions-client";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { getProductionsPageData } from "@/server/operator/queries";

export default async function ProductionsPage() {
  let initialData = null;
  let initialError = "";
  try {
    initialData = await getProductionsPageData();
  } catch (error) {
    initialError = sanitizedOperatorError(error, "Could not load days.");
  }
  return <ProductionsClient initialData={initialData} initialError={initialError} />;
}
