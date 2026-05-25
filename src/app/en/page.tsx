import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Code2,
  EyeOff,
  FolderTree,
  Gamepad2,
  Gift,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogIn,
  MailCheck,
  LockKeyhole,
  Share2,
  ShieldCheck,
  Tags,
  UserRound,
  UsersRound
} from "lucide-react";
import { ProductStage, type HomeData, type HomePreviewKey } from "@/components/home/product-stage";
import { ScrollReveal } from "@/components/home/scroll-reveal";
import { BetaBadge, Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FaGithub } from "react-icons/fa6";

export const dynamic = "force-dynamic";

const githubUrl = "https://github.com/reqmdev/vultkey";

type HomeKeyRow = {
  id: string;
  title: string;
  platform: string;
  status: HomePreviewKey["status"];
  category_id: string | null;
  key_mask: string;
  updated_at: string;
};

type HomeCategoryRow = { id: string; name: string; parent_id: string | null };

function categoryPath(category: HomeCategoryRow, categoryById: Map<string, HomeCategoryRow>) {
  const names: string[] = [];
  const visited = new Set<string>();
  let current: HomeCategoryRow | undefined = category;

  while (current && !visited.has(current.id)) {
    names.unshift(current.name);
    visited.add(current.id);
    current = current.parent_id ? categoryById.get(current.parent_id) : undefined;
  }

  return names.join(" / ");
}

const disciplineRows = [
  {
    title: "Move keys out of scattered notes",
    text: "Licenses, API keys, coupons, gift cards, and Steam or Epic keys land in one vault.",
    icon: KeyRound
  },
  {
    title: "Keep lists masked by default",
    text: "Raw values do not float around in the list. Reveal and copy stay as explicit actions.",
    icon: EyeOff
  },
  {
    title: "Keep the last action visible",
    text: "Ready, claimed, used, and archived records stay in the same operational flow.",
    icon: Archive
  }
];

const permissionRows = [
  {
    title: "Plain link",
    text: "Use it when you want to hand off a code quickly without asking the recipient for extra details.",
    icon: Link2
  },
  {
    title: "Require email",
    text: "Ask for recipient information when you need a distribution trail.",
    icon: MailCheck
  },
  {
    title: "Member allowlist",
    text: "Limit a link to signed-in Vultkey members you selected by email.",
    icon: ShieldCheck
  },
  {
    title: "Control raw access",
    text: "Decide whether the recipient may reveal or copy the raw code after claiming it.",
    icon: LockKeyhole
  }
];

const audienceRows = [
  {
    title: "Personal vault",
    text: "Keep gift cards, coupons, license codes, and subscription keys in one quiet place.",
    icon: Gift
  },
  {
    title: "Team distribution",
    text: "Track who received a license, API credit, access code, or internal key.",
    icon: Code2
  },
  {
    title: "Games and communities",
    text: "Distribute Steam, Epic, beta, and giveaway keys, then archive the finished campaign.",
    icon: Gamepad2
  }
];

const flowRows = [
  { step: "01", title: "Add", text: "The raw code becomes a masked record.", icon: KeyRound },
  { step: "02", title: "Group", text: "Categories and tags keep it findable.", icon: FolderTree },
  { step: "03", title: "Share", text: "Open a single-code or category link.", icon: Share2 },
  { step: "04", title: "Track", text: "Claimed and used records stay separate.", icon: CheckCircle2 },
  { step: "05", title: "Archive", text: "Finished distribution stops cluttering the vault.", icon: Archive }
];

const openSourceRows = [
  { title: "Auditable code", text: "Encryption, public-link limits, claim records, and audit flows are visible instead of being a black box.", icon: Code2 },
  { title: "Self-hostable", text: "Designed to run with your own Supabase and Upstash setup when you want infrastructure control.", icon: LayoutDashboard },
  { title: "Beta with feedback", text: "Bug reports, product ideas, and security feedback are part of the product roadmap.", icon: UsersRound }
];

function emptyHomeData(email: string | null = null): HomeData {
  return {
    email,
    previewKeys: [],
    total: 0,
    available: 0,
    finished: 0
  };
}

async function getHomeData(): Promise<HomeData> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) return emptyHomeData();

    const [keysResult, totalResult, availableResult, finishedResult, categoriesResult] = await Promise.all([
      supabase.from("keys").select("id,title,platform,status,category_id,key_mask,updated_at").order("updated_at", { ascending: false }).limit(3),
      supabase.from("keys").select("id", { count: "exact", head: true }),
      supabase.from("keys").select("id", { count: "exact", head: true }).eq("status", "available"),
      supabase.from("keys").select("id", { count: "exact", head: true }).in("status", ["redeemed", "archived"]),
      supabase.from("categories").select("id,name,parent_id")
    ]);

    const categories = categoriesResult.error ? [] : ((categoriesResult.data ?? []) as unknown as HomeCategoryRow[]);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const categoryNameById = new Map(categories.map((category) => [category.id, categoryPath(category, categoryById)]));

    const previewKeys = keysResult.error
      ? []
      : ((keysResult.data ?? []) as unknown as HomeKeyRow[]).map((key) => ({
          id: key.id,
          title: key.title,
          platform: key.platform,
          status: key.status,
          categoryId: key.category_id,
          categoryName: key.category_id ? categoryNameById.get(key.category_id) ?? null : null,
          keyMask: key.key_mask,
          updatedAt: key.updated_at
        }));

    return {
      email: user.email,
      previewKeys,
      total: totalResult.count ?? previewKeys.length,
      available: availableResult.count ?? 0,
      finished: finishedResult.count ?? 0
    };
  } catch {
    return emptyHomeData();
  }
}

function HeaderActions({ email }: { email: string | null }) {
  if (email) {
    return (
      <div className="flex items-center gap-2">
        <ThemeToggle className="size-9 border border-border/80 bg-background/55 text-muted-foreground hover:border-primary/25 hover:bg-primary/10 hover:text-primary" />
        <Button asChild variant="outline" className="h-9 border-border/80 bg-background/55 px-3 text-foreground/85 hover:border-primary/25 hover:bg-primary/10 hover:text-primary">
          <Link href="/dashboard">
            <LayoutDashboard className="size-4" />
            <span className="hidden sm:inline">Vault</span>
          </Link>
        </Button>
        <Link href="/dashboard/settings" className="inline-flex h-9 max-w-[220px] items-center gap-2 rounded-md border border-border/80 bg-background/55 px-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/10 hover:text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserRound className="size-4" />
          </span>
          <span className="hidden truncate sm:inline">{email}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle className="size-9 border border-border/80 bg-background/55 text-muted-foreground hover:border-primary/25 hover:bg-primary/10 hover:text-primary" />
      <Button asChild variant="outline" className="hidden h-9 border-border/80 bg-background/55 px-3 text-foreground/85 hover:border-primary/25 hover:bg-primary/10 hover:text-primary sm:inline-flex">
        <Link href="/login">
          <LogIn className="size-4" />
          Sign in
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-9 border-primary/35 bg-primary/15 px-3.5 text-primary shadow-none hover:border-primary/55 hover:bg-primary/22 hover:text-primary">
        <Link href="/signup">
          <KeyRound className="size-4" />
          <span className="sm:hidden">Start</span>
          <span className="hidden sm:inline">Create vault</span>
        </Link>
      </Button>
    </div>
  );
}

function PrimaryCta({ email, className }: { email: string | null; className?: string }) {
  return (
    <Button asChild size="lg" className={className}>
      <Link href={email ? "/dashboard" : "/signup"}>
        {email ? "Open vault" : "Create vault"}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

export default async function EnglishHomePage() {
  const homeData = await getHomeData();
  const { email } = homeData;

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="vultkey-gradient-wallpaper" aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-border bg-background/88">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/en" />
          <HeaderActions email={email} />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col">
        <section className="relative z-10 bg-background/54">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <h1 className="text-[clamp(2.7rem,5.4vw,5.6rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-balance">
                Put digital keys and game codes in a vault, then keep distribution <span className="text-primary">accountable</span>.
              </h1>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <BetaBadge className="h-5" />
                <a href={githubUrl} target="_blank" rel="noreferrer" className="inline-flex h-5 items-center gap-1.5 rounded border border-primary/20 bg-primary/10 px-2 font-medium text-primary transition-colors hover:border-primary/35 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <FaGithub className="size-3.5" />
                  Open source
                </a>
                <span>Code, security choices, and the self-host path can be reviewed.</span>
              </div>
              <p className="mt-5 max-w-3xl bg-card/35 text-base leading-7 text-muted-foreground">
                Vultkey stores license keys, API keys, coupon codes, gift cards, and Steam, Epic, or GOG keys as masked records. You can track what is ready, claimed, used, or archived without turning a spreadsheet into a security problem.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta email={email} />
                <Button asChild size="lg" variant="outline">
                  <a href="#flow">See the product</a>
                </Button>
              </div>
            </div>

            <ScrollReveal className="mx-auto w-full max-w-6xl" delay={80} revealOnMount>
              <ProductStage {...homeData} locale="en" />
            </ScrollReveal>
          </div>
        </section>

        <div className="vultkey-branding-field relative z-10 flex flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background via-background/60 to-transparent" aria-hidden="true" />

          <section className="vultkey-tone-amber relative">
            <ScrollReveal className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:px-8">
              <div className="max-w-lg">
                <div className="vultkey-section-label flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="size-4" />
                  Digital key vault
                </div>
                <h2 className="mt-4 max-w-xl text-[clamp(2.1rem,3.8vw,4.2rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-balance">
                  Take keys out of notes.
                  <span className="block text-muted-foreground">Keep them in a <span className="vultkey-section-text">vault</span>.</span>
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  Vultkey treats keys like inventory. Every record carries its purpose, status, category, and last movement.
                </p>
              </div>

              <div className="grid gap-3">
                {disciplineRows.map(({ title, text, icon: Icon }, index) => (
                  <div key={title} className="vultkey-branding-card grid gap-4 rounded-md border border-border p-5 sm:grid-cols-[44px_minmax(0,1fr)] sm:items-start">
                    <div className="flex items-center gap-2 sm:block">
                      <span className="vultkey-icon-mark flex size-10 items-center justify-center rounded-md border">
                        <Icon className="size-4" />
                      </span>
                      <span className="vultkey-section-text-muted font-mono text-xs sm:mt-3 sm:block">0{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </section>

          <section className="vultkey-tone-brass relative">
            <ScrollReveal className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:px-8">
              <div className="max-w-lg">
                <div className="vultkey-section-label flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4" />
                  Controlled sharing
                </div>
                <h2 className="mt-4 max-w-xl text-[clamp(2.1rem,3.8vw,4.2rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-balance">
                  Share the key, keep <span className="vultkey-section-text">control</span> in the vault.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  Open a single-key link or a category list. You decide what the recipient sees, what they must provide, and whether raw access is allowed.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {permissionRows.map(({ title, text, icon: Icon }) => (
                  <div key={title} className="vultkey-branding-card rounded-md border border-border p-4">
                    <div className="flex items-center gap-2">
                      <Icon className="vultkey-section-text size-4" />
                      <h3 className="font-semibold text-foreground">{title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </section>

          <section className="vultkey-tone-copper relative">
            <ScrollReveal className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:px-8">
              <div className="max-w-lg">
                <div className="vultkey-section-label flex items-center gap-2 text-sm font-medium">
                  <UsersRound className="size-4" />
                  One flow, different scale
                </div>
                <h2 className="mt-4 max-w-xl text-[clamp(2.1rem,3.8vw,4.2rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-balance">
                  One key is fine. A <span className="vultkey-section-text">campaign list</span> is fine too.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  Add the key, group it, share it, and later see which record went where.
                </p>
              </div>

              <div className="grid gap-3">
                {audienceRows.map(({ title, text, icon: Icon }) => (
                  <div key={title} className="vultkey-branding-card grid gap-3 rounded-md border border-border p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start">
                    <div className="flex items-center gap-3">
                      <span className="vultkey-icon-mark flex size-9 shrink-0 items-center justify-center rounded-md border">
                        <Icon className="size-4" />
                      </span>
                      <h3 className="font-semibold text-foreground">{title}</h3>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </section>

          <section id="flow" className="vultkey-tone-umber relative">
            <ScrollReveal className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:px-8">
              <div className="max-w-lg">
                <div className="vultkey-section-label flex items-center gap-2 text-sm font-medium">
                  <Tags className="size-4" />
                  Workflow
                </div>
                <h2 className="mt-4 max-w-xl text-[clamp(2.1rem,3.8vw,4.2rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-balance">
                  Add the key, then <span className="vultkey-section-text">do not lose it.</span>
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  The vault can start small. When keys, categories, and distribution needs grow, the workflow stays the same.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {flowRows.map(({ step, title, text, icon: Icon }) => (
                  <div key={step} className="vultkey-branding-card rounded-md border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{step}</span>
                      <span className="vultkey-icon-mark flex size-8 items-center justify-center rounded-md border">
                        <Icon className="size-3.5" />
                      </span>
                    </div>
                    <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </section>

          <section className="vultkey-tone-stone relative">
            <ScrollReveal className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
              <div className="vultkey-branding-card grid gap-8 rounded-md border border-border p-5 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
                <div className="max-w-xl">
                  <a href={githubUrl} target="_blank" rel="noreferrer" className="vultkey-section-label inline-flex flex-wrap items-center gap-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <FaGithub className="size-4" />
                    Open source
                    <BetaBadge className="vultkey-section-badge h-5" />
                  </a>
                  <h2 className="mt-4 max-w-2xl text-[clamp(2.1rem,3.8vw,4.2rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-balance">
                    Open beta, open code.
                  </h2>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                    Vultkey is built as an open-source product. The encryption approach, data model, public-link logic, and claim limits can be reviewed or self-hosted.
                  </p>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    During beta, the goal is not only adding features. It is also making security decisions and distribution behavior clearer through community feedback.
                  </p>
                </div>

                <div className="divide-y divide-border rounded-md border border-border bg-background/35">
                  {openSourceRows.map(({ title, text, icon: Icon }) => (
                    <div key={title} className="p-4">
                      <div className="flex items-center gap-2">
                        <Icon className="vultkey-section-text size-4" />
                        <h3 className="font-semibold text-foreground">{title}</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </section>

          <section className="vultkey-final-cta relative overflow-hidden">
            <ScrollReveal className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
              <h2 className="mx-auto max-w-4xl text-[clamp(2.55rem,5vw,5.35rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-balance">
                Stop losing codes. Keep control where it belongs.
              </h2>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6 text-base">
                  <Link href={email ? "/dashboard" : "/signup"}>
                    <KeyRound className="size-5" />
                    {email ? "Open vault" : "Add your first key"}
                  </Link>
                </Button>
                {!email ? (
                  <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
                    <Link href="/login">
                      <LockKeyhole className="size-5" />
                      Sign in
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
                  <a href={githubUrl} target="_blank" rel="noreferrer">
                    <FaGithub className="size-5" />
                    GitHub / Open source
                  </a>
                </Button>
              </div>
            </ScrollReveal>
          </section>
        </div>
      </div>
      <SiteFooter className="relative z-10 shrink-0" />
    </main>
  );
}
