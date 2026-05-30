import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

export default function EnglishSignupPage() {
  return (
    <AuthCard title="Create your vault" description="Open an account to keep digital keys masked and share them in an organized way.">
      <SignupForm locale="en" />
    </AuthCard>
  );
}
