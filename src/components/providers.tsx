"use client";

import type { ReactNode } from "react";
import { AppAuthProvider } from "@/components/app-auth-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <AppAuthProvider>{children}</AppAuthProvider>;
}
