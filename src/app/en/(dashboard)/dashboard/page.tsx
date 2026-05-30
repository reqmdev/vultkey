import { getDashboardData } from "@/features/keys/queries";
import { VaultPage } from "@/features/keys/vault-page";

export const dynamic = "force-dynamic";

export default async function EnglishDashboardPage() {
  const data = await getDashboardData();
  return <VaultPage {...data} locale="en" />;
}
