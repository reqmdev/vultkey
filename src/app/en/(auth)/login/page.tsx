import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function EnglishLoginPage() {
  return (
    <AuthCard title="Sign in to your vault" description="Keep managing your keys, categories, and sharing links.">
      <LoginForm locale="en" />
    </AuthCard>
  );
}
