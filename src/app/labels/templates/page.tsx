import { connection } from "next/server";
import { sanitizedOperatorError } from "@/server/operator/errors";
import {
  getLabelTemplateWorkspace,
  type LabelTemplateWorkspaceDto,
} from "@/server/operator/label-templates";
import { getLabelsPageData } from "@/server/operator/queries";
import type { Production } from "@/lib/types";
import { LabelTemplateWorkspaceClient } from "./template-workspace-client";

export default async function LabelTemplatesPage() {
  await connection();
  let workspace: LabelTemplateWorkspaceDto | null = null;
  let productions: Production[] = [];
  let initialError = "";
  try {
    const [templateData, coffeeData] = await Promise.all([
      getLabelTemplateWorkspace(),
      getLabelsPageData(),
    ]);
    workspace = templateData;
    productions = coffeeData.productions;
  } catch (error) {
    initialError = sanitizedOperatorError(
      error,
      "Could not load the label template workspace.",
    );
  }

  return (
    <LabelTemplateWorkspaceClient
      initialWorkspace={workspace}
      productions={productions}
      initialError={initialError}
    />
  );
}
