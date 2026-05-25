import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="w-full rounded-lg border border-border bg-card/95 p-5 text-card-foreground shadow-panel sm:p-6">
      <div className="mb-6 flex items-start gap-3">
        <LogoMark className="mt-0.5 size-9 shrink-0 lg:hidden" />
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">{title}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
