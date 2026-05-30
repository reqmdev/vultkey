import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default function EnglishResetPasswordPage() {
  return (
    <AuthCard title="Set a new password" description="Use this password to sign in without Google or Discord.">
      <ResetPasswordForm locale="en" />
    </AuthCard>
  );
}
