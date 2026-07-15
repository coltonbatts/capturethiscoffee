import { PeopleClient } from "./people-client";
import { sanitizedOperatorError } from "@/server/operator/errors";
import { getPeoplePageData } from "@/server/operator/queries";

export default async function PeoplePage() {
  let initialData = null;
  let initialError = "";
  try {
    initialData = await getPeoplePageData();
  } catch (error) {
    initialError = sanitizedOperatorError(error, "Could not load people.");
  }
  return <PeopleClient initialData={initialData} initialError={initialError} />;
}
