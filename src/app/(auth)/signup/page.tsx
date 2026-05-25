import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <AuthCard title="Kasanı oluştur" description="Dijital keylerini maskeli saklamak ve düzenli paylaşmak için hesabını aç.">
      <SignupForm />
    </AuthCard>
  );
}
