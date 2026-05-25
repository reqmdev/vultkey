"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-md border border-border bg-card p-8 shadow-panel">
      <p className="text-sm font-medium text-destructive">Pano yüklenemedi.</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Oturum veya veri kaynağı kontrol edilmeli.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Supabase ortam değişkenleri, oturum çerezi veya RLS policy yapılandırması eksik olabilir.
      </p>
      <Button className="mt-6" onClick={() => reset()}>
        Tekrar dene
      </Button>
    </div>
  );
}
