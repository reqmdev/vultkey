"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { FormStatus } from "@/components/auth/form-status";
import { Button } from "@/components/ui/button";

const providerLabels = {
  tr: { email: "E-posta / şifre", unknown: "Bilinmiyor" },
  en: { email: "Email / password", unknown: "Unknown" }
};

const fallbackProviderLabels: Record<string, string> = {
  email: "E-posta / şifre",
  google: "Google",
  discord: "Discord"
};

function providerLabel(provider: string, locale: "tr" | "en") {
  if (provider === "email") return providerLabels[locale].email;
  return fallbackProviderLabels[provider] ?? provider;
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google") return <FaGoogle className="size-3.5" />;
  if (provider === "discord") return <FaDiscord className="size-3.5" />;
  return <Mail className="size-3.5" />;
}

export function PasswordLinkPanel({ email, providers, locale = "tr" }: { email: string | null; providers: string[]; locale?: "tr" | "en" }) {
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasPasswordProvider = providers.includes("email");
  const copy = locale === "en"
    ? { reset: "Send password reset link", set: "Send password setup link", failed: "Password link could not be sent.", active: "Password sign-in is active.", add: "Send an email link to add a password.", target: "Target", noEmail: "No email" }
    : { reset: "Şifre sıfırlama bağlantısı gönder", set: "Şifre belirleme bağlantısı gönder", failed: "Şifre bağlantısı gönderilemedi.", active: "Şifre girişi aktif.", add: "Şifre eklemek için e-posta bağlantısı gönder.", target: "Hedef", noEmail: "E-posta yok" };
  const buttonText = hasPasswordProvider ? copy.reset : copy.set;

  function sendPasswordLink() {
    setStatus(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/password-link", { method: "POST" });
        const result = (await response.json()) as { ok: boolean; message: string };
        setStatus({ message: result.message, ok: result.ok });
      } catch {
        setStatus({ message: copy.failed, ok: false });
      }
    });
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {(providers.length > 0 ? providers : ["unknown"]).map((provider) => (
          <span key={provider} className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground">
            <ProviderIcon provider={provider} />
            {provider === "unknown" ? providerLabels[locale].unknown : providerLabel(provider, locale)}
          </span>
        ))}
      </div>

      <div className="text-sm leading-6 text-muted-foreground">
        <p>{hasPasswordProvider ? copy.active : copy.add}</p>
        <p className="break-words">{copy.target}: <span className="font-medium text-foreground">{email ?? copy.noEmail}</span></p>
      </div>

      <FormStatus message={status?.message ?? null} ok={status?.ok} />

      <Button type="button" variant="outline" className="h-9 w-full justify-start" disabled={isPending || !email} onClick={sendPasswordLink}>
        {isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
        {buttonText}
      </Button>
    </div>
  );
}
