import { logoutAction } from "@/app/(auth)/actions";
import { DeleteAccountPanel } from "@/components/settings/delete-account-panel";
import { PasswordLinkPanel } from "@/components/settings/password-link-panel";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function authProviders(user: User) {
  const providers = new Set<string>();
  const metadataProviders = user.app_metadata?.providers;

  if (Array.isArray(metadataProviders)) {
    metadataProviders.forEach((provider) => {
      if (typeof provider === "string" && provider.length > 0) providers.add(provider);
    });
  }

  if (typeof user.app_metadata?.provider === "string") {
    providers.add(user.app_metadata.provider);
  }

  user.identities?.forEach((identity) => {
    if (identity.provider) providers.add(identity.provider);
  });

  return Array.from(providers).sort((a, b) => a.localeCompare(b));
}

export default async function SettingsPage() {
  const { user } = await requireUser();
  const email = user.email ?? "account";
  const providers = authProviders(user);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 space-y-1 text-sm text-muted-foreground">
          <a href="#account" className="block rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-foreground">Hesap</a>
          <a href="#security" className="block rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-foreground">Güvenlik</a>
          <a href="#session" className="block rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-foreground">Oturum</a>
          <a href="#danger" className="block rounded-md px-2 py-1.5 transition-colors hover:bg-accent hover:text-foreground">Tehlikeli bölge</a>
        </nav>
      </aside>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Hesap erişimi, oturum ve kalıcı işlemler.</p>
        </div>

        <section id="account" className="rounded-md border border-border bg-card shadow-panel">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold tracking-tight">Hesap</h2>
          </div>
          <div className="divide-y divide-border text-sm">
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:items-center">
              <span className="text-muted-foreground">E-posta</span>
              <span className="min-w-0 break-all font-medium">{email}</span>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:items-center">
              <span className="text-muted-foreground">Hesap açılışı</span>
              <span>{formatDateTime(user.created_at)}</span>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr] sm:items-center">
              <span className="text-muted-foreground">Son giriş</span>
              <span>{formatDateTime(user.last_sign_in_at)}</span>
            </div>
            <details className="px-4 py-3 text-sm [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">Kullanıcı ID</summary>
              <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{user.id}</p>
            </details>
          </div>
        </section>

        <section id="security" className="rounded-md border border-border bg-card shadow-panel">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold tracking-tight">Giriş ve güvenlik</h2>
          </div>
          <PasswordLinkPanel email={user.email ?? null} providers={providers} />
        </section>

        <section id="session" className="rounded-md border border-border bg-card shadow-panel">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold tracking-tight">Oturum</h2>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Bu tarayıcıdaki oturumu kapat.</p>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="h-9 w-full justify-start sm:w-auto">
                Çıkış yap
              </Button>
            </form>
          </div>
        </section>

        <section id="danger" className="rounded-md border border-destructive/30 bg-card shadow-panel">
          <div className="border-b border-destructive/20 px-4 py-3">
            <h2 className="font-semibold tracking-tight text-destructive">Tehlikeli bölge</h2>
          </div>
          <DeleteAccountPanel email={user.email ?? null} />
        </section>
      </div>
    </div>
  );
}
