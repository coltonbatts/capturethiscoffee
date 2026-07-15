import { requireServerOperatorUser } from "@/server/auth";

export default async function LabelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerOperatorUser("/labels");
  return children;
}
