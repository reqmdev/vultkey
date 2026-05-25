import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-background px-3 py-4 md:flex md:flex-col">
        <div className="flex h-10 items-center px-2">
          <Logo />
        </div>
        <div className="mt-5">
          <DashboardNav />
        </div>
        <div className="mt-auto flex items-center gap-1 border-t border-border pt-3">
          <Link href="/dashboard/settings" className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <UserRound className="size-4 shrink-0" />
            <span className="truncate">{email}</span>
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label="Çıkış yap" title="Çıkış yap">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-60">
        <DashboardTopbar />

        <header className="sticky top-0 z-40 border-b border-border bg-background md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button asChild variant="ghost" size="icon" aria-label="Ayarlar">
                <Link href="/dashboard/settings">
                  <UserRound className="size-4" />
                </Link>
              </Button>
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Çıkış yap">
                  <LogOut className="size-4" />
                </Button>
              </form>
            </div>
          </div>
          <div className="border-t border-border px-3 py-2">
            <DashboardNav compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-6">{children}</main>
        <SiteFooter className="shrink-0" />
      </div>
    </div>
  );
}
