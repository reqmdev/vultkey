import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Şifre bağlantısı al" description="Şifreni sıfırlamak veya OAuth hesabına şifre eklemek için e-postana bağlantı göndeririz.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
