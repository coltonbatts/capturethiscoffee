import { redirect } from "next/navigation";
import { getServerOperatorUser } from "@/server/auth";

export default async function OperatorProductionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getServerOperatorUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/productions/${id}`)}`);
  }

  return children;
}
