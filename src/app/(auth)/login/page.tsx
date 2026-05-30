import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <AuthCard title="Kasana giriş yap" description="Keylerini, kategorilerini ve paylaşım linklerini yönetmeye devam et.">
      <LoginForm locale="tr" />
    </AuthCard>
  );
}
