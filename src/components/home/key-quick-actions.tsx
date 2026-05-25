"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { copyKeyAction, revealKeyAction } from "@/features/keys/actions";
import { Button } from "@/components/ui/button";

type KeyQuickActionsProps = {
  id: string;
  keyMask: string;
  signedIn: boolean;
  demoSecret?: string;
  locale?: "tr" | "en";
};

export function KeyQuickActions({ id, keyMask, signedIn, demoSecret, locale = "tr" }: KeyQuickActionsProps) {
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"reveal" | "copy" | null>(null);
  const timerRef = useRef<number | null>(null);
  const visibleValue = secret ?? keyMask;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleHide() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setSecret(null), 30_000);
  }

  async function reveal() {
    if (secret) {
      setSecret(null);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }

    if (!signedIn) {
      setSecret(demoSecret ?? keyMask);
      scheduleHide();
      return;
    }

    setPendingAction("reveal");
    const result = await revealKeyAction(id);
    setPendingAction(null);

    if (!result.ok || !result.secret) {
      toast.error(result.message);
      return;
    }

    setSecret(result.secret);
    scheduleHide();
  }

  async function copy() {
    if (!signedIn) {
      try {
        await navigator.clipboard.writeText(demoSecret ?? keyMask);
        toast.success(locale === "en" ? "Demo code copied." : "Demo kod panoya kopyalandı.");
      } catch {
        toast.error(locale === "en" ? "Clipboard access failed." : "Pano erişimi başarısız oldu.");
      }
      return;
    }

    setPendingAction("copy");
    const result = await copyKeyAction(id);
    setPendingAction(null);

    if (!result.ok || !result.secret) {
      toast.error(result.message);
      return;
    }

    try {
      await navigator.clipboard.writeText(result.secret);
      toast.success(locale === "en" ? "Code copied." : "Kod panoya kopyalandı.");
    } catch {
      toast.error(locale === "en" ? "Clipboard access failed. Check HTTPS or browser permission." : "Pano erişimi başarısız oldu. HTTPS veya tarayıcı iznini kontrol et.");
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <span
        title={visibleValue}
        className="hidden h-8 min-w-44 max-w-72 items-center justify-center overflow-hidden rounded-md border border-border bg-background px-3 font-mono text-[12px] font-medium tracking-[0.02em] text-foreground/80 shadow-sm md:inline-flex xl:min-w-56"
      >
        {visibleValue}
      </span>
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={reveal} disabled={pendingAction !== null} aria-label={secret ? (locale === "en" ? "Hide code" : "Kodu gizle") : (locale === "en" ? "Reveal code" : "Kodu göster")}>
        {pendingAction === "reveal" ? <Loader2 className="animate-spin" /> : secret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={copy} disabled={pendingAction !== null} aria-label={locale === "en" ? "Copy code" : "Kodu kopyala"}>
        {pendingAction === "copy" ? <Loader2 className="animate-spin" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
