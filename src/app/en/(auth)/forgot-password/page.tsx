import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const dynamic = "force-dynamic";

export default function EnglishForgotPasswordPage() {
  return (
    <AuthCard title="Get a password link" description="We will send a link to reset your password or add one to an OAuth account.">
      <ForgotPasswordForm locale="en" />
    </AuthCard>
  );
}
