"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, KeyRound, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Kasa", icon: KeyRound },
  { href: "/dashboard/audit", label: "Kayıtlar", icon: History },
  { href: "/dashboard/settings", label: "Ayarlar", icon: Settings }
];

export function DashboardNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex gap-1", compact ? "overflow-x-auto no-scrollbar" : "flex-col")}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
               "group inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
               active && "bg-accent text-foreground shadow-[inset_0_0_0_1px_oklch(var(--border))]",
               compact && "shrink-0"
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
