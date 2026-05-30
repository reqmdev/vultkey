import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Yeni şifre belirle" description="Bu şifreyle Google veya Discord olmadan da hesabına giriş yapabilirsin.">
      <ResetPasswordForm locale="tr" />
    </AuthCard>
  );
}
