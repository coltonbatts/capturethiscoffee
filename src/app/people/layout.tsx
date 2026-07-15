import { requireServerOperatorUser } from "@/server/auth";

export default async function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerOperatorUser("/people");
  return children;
}
