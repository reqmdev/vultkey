"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, LogIn } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
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
    forgot: "Şifremi unuttum",
    passwordPlaceholder: "Şifren",
    submit: "Giriş yap",
    noAccount: "Hesabın yok mu?",
    signup: "Hesap oluştur",
    accountDeleted: "Hesap silindi.",
    expired: "E-posta doğrulama bağlantısının süresi dolmuş. Tekrar hesap oluşturmayı veya yeni bağlantı istemeyi dene.",
    authError: "Oturum bağlantısı doğrulanamadı. Lütfen tekrar dene.",
    requestFailed: "Giriş isteği tamamlanamadı.",
    forgotHref: "/forgot-password",
    signupHref: "/signup"
  },
  en: {
    email: "Email",
    password: "Password",
    forgot: "Forgot password",
    passwordPlaceholder: "Your password",
    submit: "Sign in",
    noAccount: "No account yet?",
    signup: "Create account",
    accountDeleted: "Account deleted.",
    expired: "The email verification link has expired. Try creating the account again or requesting a new link.",
    authError: "The session link could not be verified. Please try again.",
    requestFailed: "The sign-in request could not be completed.",
    forgotHref: "/en/forgot-password",
    signupHref: "/en/signup"
  }
} satisfies Record<AuthLocale, Record<string, string>>;

export function LoginForm({ locale = "tr" }: { locale?: AuthLocale }) {
  const labels = copy[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const authError = searchParams.get("auth_error");
  const accountDeleted = searchParams.get("account_deleted") === "1";
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [botResetSignal, setBotResetSignal] = useState(0);
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  function resetBotProtection() {
    setTurnstileToken(null);
    setBotResetSignal((value) => value + 1);
  }

  function onSubmit(values: LoginInput) {
    setStatus(null);
    startTransition(async () => {
      try {
        const botTokens = await getBotProtectionTokens("login", turnstileToken);
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, next, ...botTokens }) });
        const result = (await response.json()) as { ok: boolean; message: string; redirectTo?: string };

        if (result.ok) {
          form.resetField("password");
          router.replace(result.redirectTo ?? "/dashboard");
          router.refresh();
          return;
        }

        form.resetField("password");
        resetBotProtection();
        setStatus({ message: result.message, ok: false });
      } catch (error) {
        form.resetField("password");
        resetBotProtection();
        setStatus({ message: error instanceof Error ? error.message : labels.requestFailed, ok: false });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <OAuthButtons next={next} locale={locale} />

      <div className="space-y-2">
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="hello@vultkey.app" {...form.register("email")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">{labels.password}</Label>
          <Link href={labels.forgotHref} className="text-xs font-medium text-primary hover:underline">{labels.forgot}</Link>
        </div>
        <Input id="password" type="password" autoComplete="current-password" placeholder={labels.passwordPlaceholder} {...form.register("password")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.password?.message}</p>
      </div>

      <BotProtection action="login" resetSignal={botResetSignal} onTurnstileTokenChange={setTurnstileToken} />

      <FormStatus message={status?.message ?? null} ok={status?.ok} />
      <FormStatus message={!status && accountDeleted ? labels.accountDeleted : null} ok />
      <FormStatus message={status ? null : authError === "otp_expired" ? labels.expired : authError ? labels.authError : null} ok={false} />

      <Button type="submit" className="h-11 w-full" disabled={isPending}>{isPending ? <Loader2 className="animate-spin" /> : <LogIn />}{labels.submit}</Button>

      <p className="text-center text-sm text-muted-foreground">
        {labels.noAccount}{" "}
        <Link href={labels.signupHref} className="font-medium text-primary hover:underline">{labels.signup}</Link>
      </p>

      <RecaptchaNotice locale={locale} />
    </form>
  );
}
