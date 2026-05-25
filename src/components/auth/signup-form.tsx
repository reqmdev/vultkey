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

export function SignupForm() {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [botResetSignal, setBotResetSignal] = useState(0);
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" }
  });

  function resetBotProtection() {
    setTurnstileToken(null);
    setBotResetSignal((value) => value + 1);
  }

  function onSubmit(values: SignupInput) {
    setStatus(null);
    startTransition(async () => {
      try {
        const botTokens = await getBotProtectionTokens("signup", turnstileToken);
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, ...botTokens })
        });
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
        setStatus({ message: error instanceof Error ? error.message : "Kayıt isteği tamamlanamadı.", ok: false });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <OAuthButtons />

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="ornek@vultkey.app" {...form.register("email")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input id="password" type="password" autoComplete="new-password" placeholder="En az 12 karakter" {...form.register("password")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.password?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Şifre tekrarı</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Şifreni tekrar yaz" {...form.register("confirmPassword")} />
        <p className="min-h-4 text-xs text-destructive">{form.formState.errors.confirmPassword?.message}</p>
      </div>

      <BotProtection action="signup" resetSignal={botResetSignal} onTurnstileTokenChange={setTurnstileToken} />

      <FormStatus message={status?.message ?? null} ok={status?.ok} />

      <Button type="submit" className="h-11 w-full" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Hesap oluştur
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Zaten hesabın var mı?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Giriş yap
        </Link>
      </p>

      <RecaptchaNotice />
    </form>
  );
}
