"use client";

import type { ReactNode } from "react";
import { StaffAuthProvider } from "@/components/staff-auth-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <StaffAuthProvider>{children}</StaffAuthProvider>;
}
