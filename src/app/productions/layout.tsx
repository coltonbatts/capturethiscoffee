import { requireServerOperatorUser } from "@/server/auth";

export default async function ProductionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerOperatorUser("/productions");
  return children;
}
