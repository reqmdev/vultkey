"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const pageLabels: Record<string, string> = {
  "/dashboard": "Kasa",
  "/dashboard/audit": "Kayıtlar",
  "/dashboard/settings": "Ayarlar",
  "/en/dashboard": "Vault",
  "/en/dashboard/audit": "Audit",
  "/en/dashboard/settings": "Settings"
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const label = pageLabels[pathname] ?? "Vultkey";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background md:block">
      <div className="flex h-14 items-center justify-between px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <ThemeToggle className="size-9 border border-border bg-background" />
      </div>
    </header>
  );
}
