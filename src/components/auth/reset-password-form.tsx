"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, ShieldCheck } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatus } from "@/components/auth/form-status";
import type { AuthLocale } from "@/components/auth/auth-shell";

const copy = {
  tr: { password: "Yeni şifre", confirmPassword: "Yeni şifre tekrarı", passwordPlaceholder: "En az 12 karakter", confirmPlaceholder: "Şifreni tekrar yaz", submit: "Şifreyi güncelle", requestFailed: "Şifre güncelleme isteği tamamlanamadı." },
  en: { password: "New password", confirmPassword: "Repeat new password", passwordPlaceholder: "At least 12 characters", confirmPlaceholder: "Type your password again", submit: "Update password", requestFailed: "The password update request could not be completed." }
} satisfies Record<AuthLocale, Record<string, string>>;

export function ResetPasswordForm({ locale = "tr" }: { locale?: AuthLocale }) {
  const labels = copy[locale];
  const router = useRouter();
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });

  function onSubmit(values: ResetPasswordInput) {
    setStatus(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const result = (await response.json()) as { ok: boolean; message: string; redirectTo?: string };
        form.resetField("password");
        form.resetField("confirmPassword");
        if (result.ok) {
          router.replace(result.redirectTo ?? "/dashboard");
          router.refresh();
          return;
        }
        setStatus({ message: result.message, ok: false });
      } catch {
        form.resetField("password");
        form.resetField("confirmPassword");
        setStatus({ message: labels.requestFailed, ok: false });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
      <FormStatus message={status?.message ?? null} ok={status?.ok} />
      <Button type="submit" className="h-11 w-full" disabled={isPending}>{isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{labels.submit}</Button>
    </form>
  );
}
