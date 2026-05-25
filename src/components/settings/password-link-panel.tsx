"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { FormStatus } from "@/components/auth/form-status";
import { Button } from "@/components/ui/button";

const providerLabels: Record<string, string> = {
  email: "E-posta / şifre",
  google: "Google",
  discord: "Discord"
};

function providerLabel(provider: string) {
  return providerLabels[provider] ?? provider;
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google") return <FaGoogle className="size-3.5" />;
  if (provider === "discord") return <FaDiscord className="size-3.5" />;
  return <Mail className="size-3.5" />;
}

export function PasswordLinkPanel({ email, providers }: { email: string | null; providers: string[] }) {
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasPasswordProvider = providers.includes("email");
  const buttonText = hasPasswordProvider ? "Şifre sıfırlama bağlantısı gönder" : "Şifre belirleme bağlantısı gönder";

  function sendPasswordLink() {
    setStatus(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/password-link", { method: "POST" });
        const result = (await response.json()) as { ok: boolean; message: string };
        setStatus({ message: result.message, ok: result.ok });
      } catch {
        setStatus({ message: "Şifre bağlantısı gönderilemedi.", ok: false });
      }
    });
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {(providers.length > 0 ? providers : ["unknown"]).map((provider) => (
          <span key={provider} className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground">
            <ProviderIcon provider={provider} />
            {provider === "unknown" ? "Bilinmiyor" : providerLabel(provider)}
          </span>
        ))}
      </div>

      <div className="text-sm leading-6 text-muted-foreground">
        <p>{hasPasswordProvider ? "Şifre girişi aktif." : "Şifre eklemek için e-posta bağlantısı gönder."}</p>
        <p className="break-words">Hedef: <span className="font-medium text-foreground">{email ?? "E-posta yok"}</span></p>
      </div>

      <FormStatus message={status?.message ?? null} ok={status?.ok} />

      <Button type="button" variant="outline" className="h-9 w-full justify-start" disabled={isPending || !email} onClick={sendPasswordLink}>
        {isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
        {buttonText}
      </Button>
    </div>
  );
}
