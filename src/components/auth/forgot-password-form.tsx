"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, MailCheck } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatus } from "@/components/auth/form-status";
import { BotProtection, getBotProtectionTokens, RecaptchaNotice } from "@/components/auth/bot-protection";
import type { AuthLocale } from "@/components/auth/auth-shell";

const copy = {
  tr: { email: "E-posta", submit: "Sıfırlama bağlantısı gönder", back: "Girişe dön", requestFailed: "Sıfırlama isteği tamamlanamadı.", loginHref: "/login" },
  en: { email: "Email", submit: "Send reset link", back: "Back to sign in", requestFailed: "The reset request could not be completed.", loginHref: "/en/login" }
} satisfies Record<AuthLocale, Record<string, string>>;

export function ForgotPasswordForm({ locale = "tr" }: { locale?: AuthLocale }) {
  const labels = copy[locale];
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [botResetSignal, setBotResetSignal] = useState(0);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  function resetBotProtection() {
    setTurnstileToken(null);
    setBotResetSignal((value) => value + 1);
  }

  function onSubmit(values: ForgotPasswordInput) {
    setStatus(null);
    startTransition(async () => {
      try {
        const botTokens = await getBotProtectionTokens("forgot_password", turnstileToken);
        const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, ...botTokens }) });
        const result = (await response.json()) as { ok: boolean; message: string };
        resetBotProtection();
        setStatus({ message: result.message, ok: result.ok });
      } catch (error) {
        resetBotProtection();
        const message = error instanceof Error ? error.message : labels.requestFailed;
        setStatus({ message, ok: false });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="hello@vultkey.app" {...form.register("email")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <FormStatus message={status?.message ?? null} ok={status?.ok} />
      <BotProtection action="forgot_password" resetSignal={botResetSignal} onTurnstileTokenChange={setTurnstileToken} />
      <Button type="submit" className="h-11 w-full" disabled={isPending}>{isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}{labels.submit}</Button>
      <p className="text-center text-sm text-muted-foreground"><Link href={labels.loginHref} className="font-medium text-primary hover:underline">{labels.back}</Link></p>
      <RecaptchaNotice locale={locale} />
    </form>
  );
}
