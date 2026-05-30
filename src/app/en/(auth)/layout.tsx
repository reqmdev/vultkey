import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function EnglishAuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell locale="en">{children}</AuthShell>;
}
