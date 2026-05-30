import type { ReactNode } from "react";
import { ArrowLeft, FolderTree, KeyRound, Link2, ListChecks } from "lucide-react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export type AuthLocale = "tr" | "en";

const authCopy = {
  tr: {
    homeHref: "/",
    homeLabel: "Ana sayfa",
    headline: "Key kasana gir, dağıtımı kaldığın yerden yönet.",
    description: "Vultkey, dijital keyleri ve oyun kodlarını saklamak, paylaşmak ve durumlarını temiz tutmak için sade bir çalışma alanı sunar.",
    steps: [
      { step: "01", title: "Kaydet", text: "Keyi maskeli ekle.", icon: KeyRound },
      { step: "02", title: "Grupla", text: "Kategori ve etiket ver.", icon: FolderTree },
      { step: "03", title: "Paylaş", text: "Link kurallarını seç.", icon: Link2 },
      { step: "04", title: "Takip et", text: "Alındı mı, kullanıldı mı gör.", icon: ListChecks }
    ]
  },
  en: {
    homeHref: "/en",
    homeLabel: "Home",
    headline: "Open your key vault and keep distribution under control.",
    description: "Vultkey gives you a simple workspace for storing digital keys and game codes, sharing them when needed, and keeping their status clear.",
    steps: [
      { step: "01", title: "Save", text: "Add the key masked.", icon: KeyRound },
      { step: "02", title: "Group", text: "Assign category and tags.", icon: FolderTree },
      { step: "03", title: "Share", text: "Choose link rules.", icon: Link2 },
      { step: "04", title: "Track", text: "See claims and usage.", icon: ListChecks }
    ]
  }
} satisfies Record<AuthLocale, { homeHref: string; homeLabel: string; headline: string; description: string; steps: Array<{ step: string; title: string; text: string; icon: typeof KeyRound }> }>;

export function AuthShell({ children, locale = "tr" }: { children: ReactNode; locale?: AuthLocale }) {
  const copy = authCopy[locale];

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="vultkey-auth-field" aria-hidden="true" />
      <header className="relative z-10 border-b border-border bg-background/88">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href={copy.homeHref} />
          <div className="flex items-center gap-2">
            <Link href={copy.homeHref} className="hidden h-10 items-center gap-2 rounded-md border border-border bg-background/70 px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex">
              <ArrowLeft className="size-4" />
              {copy.homeLabel}
            </Link>
            <ThemeToggle className="size-10 border border-border bg-background/70" />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.96fr)_minmax(380px,460px)] lg:px-8 lg:py-12">
        <section className="hidden max-w-xl lg:block">
          <LogoMark className="mb-7 size-14" />
          <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-[-0.035em] text-foreground">{copy.headline}</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{copy.description}</p>
          <ol className="mt-8 grid max-w-lg gap-2 rounded-lg border border-border/70 bg-card/55 p-3">
            {copy.steps.map(({ step, title, text, icon: Icon }) => (
              <li key={step} className="grid grid-cols-[34px_36px_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-background/45">
                <span className="font-mono text-[11px] text-muted-foreground">{step}</span>
                <span className="flex size-9 items-center justify-center rounded-md bg-background text-primary shadow-[inset_0_0_0_1px_oklch(var(--border))]">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{title}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="w-full justify-self-center lg:justify-self-end">{children}</div>
      </div>
      <SiteFooter className="relative z-10 shrink-0" />
    </main>
  );
}
