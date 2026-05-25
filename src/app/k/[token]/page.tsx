import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { PublicKeyClaim } from "@/features/public-links/public-key-claim";
import { getPublicKeyLinkData } from "@/features/public-links/actions";

export const dynamic = "force-dynamic";

export default async function PublicKeyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicKeyLinkData(token);

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="vultkey-auth-field" aria-hidden="true" />
      <header className="relative z-10 border-b border-border bg-background/88">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center px-4 sm:px-6">
          <Logo href="/" />
        </div>
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-start px-4 py-5 sm:px-6 lg:py-6">
        <PublicKeyClaim token={token} data={data} />
      </div>
      <SiteFooter className="relative z-10 shrink-0" />
    </main>
  );
}
