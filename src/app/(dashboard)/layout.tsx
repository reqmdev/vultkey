import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";
import { AppShell } from "@/components/dashboard/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();

  return <AppShell email={user.email ?? "account"}>{children}</AppShell>;
}
