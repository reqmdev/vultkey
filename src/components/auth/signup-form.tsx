"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { KeyRound, Loader2 } from "lucide-react";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatus } from "@/components/auth/form-status";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { BotProtection, getBotProtectionTokens, RecaptchaNotice } from "@/components/auth/bot-protection";
import type { AuthLocale } from "@/components/auth/auth-shell";

const copy = {
  tr: {
    email: "E-posta",
    password: "Şifre",
    confirmPassword: "Şifre tekrarı",
    passwordPlaceholder: "En az 12 karakter",
    confirmPlaceholder: "Şifreni tekrar yaz",
    submit: "Hesap oluştur",
    hasAccount: "Zaten hesabın var mı?",
    login: "Giriş yap",
    requestFailed: "Kayıt isteği tamamlanamadı.",
    loginHref: "/login"
  },
  en: {
    email: "Email",
    password: "Password",
    confirmPassword: "Repeat password",
    passwordPlaceholder: "At least 12 characters",
    confirmPlaceholder: "Type your password again",
    submit: "Create account",
    hasAccount: "Already have an account?",
    login: "Sign in",
    requestFailed: "The signup request could not be completed.",
    loginHref: "/en/login"
  }
} satisfies Record<AuthLocale, Record<string, string>>;

export function SignupForm({ locale = "tr" }: { locale?: AuthLocale }) {
  const labels = copy[locale];
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [botResetSignal, setBotResetSignal] = useState(0);
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignupInput>({ resolver: zodResolver(signupSchema), defaultValues: { email: "", password: "", confirmPassword: "" } });

  function resetBotProtection() {
    setTurnstileToken(null);
    setBotResetSignal((value) => value + 1);
  }

  function onSubmit(values: SignupInput) {
    setStatus(null);
    startTransition(async () => {
      try {
        const botTokens = await getBotProtectionTokens("signup", turnstileToken);
        const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, ...botTokens }) });
        const result = (await response.json()) as { ok: boolean; message: string };
        setStatus({ message: result.message, ok: result.ok });
        resetBotProtection();

        if (result.ok) form.reset();
        else {
          form.resetField("password");
          form.resetField("confirmPassword");
        }
      } catch (error) {
        form.resetField("password");
        form.resetField("confirmPassword");
        resetBotProtection();
        setStatus({ message: error instanceof Error ? error.message : labels.requestFailed, ok: false });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <OAuthButtons locale={locale} />
      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="hello@vultkey.app" {...form.register("email")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input id="password" type="password" autoComplete="new-password" placeholder={labels.passwordPlaceholder} {...form.register("password")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.password?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{labels.confirmPassword}</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder={labels.confirmPlaceholder} {...form.register("confirmPassword")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.confirmPassword?.message}</p>
      </div>
      <BotProtection action="signup" resetSignal={botResetSignal} onTurnstileTokenChange={setTurnstileToken} />
      <FormStatus message={status?.message ?? null} ok={status?.ok} />
      <Button type="submit" className="h-11 w-full" disabled={isPending}>{isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}{labels.submit}</Button>
      <p className="text-center text-sm text-muted-foreground">
        {labels.hasAccount}{" "}<Link href={labels.loginHref} className="font-medium text-primary hover:underline">{labels.login}</Link>
      </p>
      <RecaptchaNotice locale={locale} />
    </form>
  );
}
