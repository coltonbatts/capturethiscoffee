import "server-only";

import { redirect } from "next/navigation";
import { requireOperatorContext } from "@/server/operator/context";

/** Performs the secure request-time user check used by operator routes. */
export async function getServerOperatorUser() {
  return (await requireOperatorContext()).user;
}

export async function requireServerOperatorUser(nextPath: string) {
  let user = null;

  try {
    user = await getServerOperatorUser();
  } catch {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
