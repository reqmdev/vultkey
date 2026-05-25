"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BetaBadge, LogoMark } from "@/components/logo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FaGithub } from "react-icons/fa6";

type SiteLocale = "tr" | "en";

const footerLinks = {
  tr: [
    { href: "/tr/privacy", label: "Gizlilik Sözleşmesi" },
    { href: "/tr/terms", label: "Kullanım Şartları" }
  ],
  en: [
    { href: "/en/privacy", label: "Privacy Policy" },
    { href: "/en/terms", label: "Terms of Use" }
  ]
};

const socialLinks = [
  { href: "https://github.com/reqmdev/vultkey", label: "GitHub", icon: FaGithub }
];

const languageOptions = {
  tr: { label: "Türkçe" },
  en: { label: "English" }
};

function currentLocale(pathname: string): SiteLocale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr";
}

function localizedPath(pathname: string, locale: SiteLocale) {
  if (pathname === "/" || pathname === "") return `/${locale}`;
  if (pathname === "/privacy") return `/${locale}/privacy`;
  if (pathname === "/terms") return `/${locale}/terms`;
  if (pathname === "/tr") return locale === "tr" ? "/tr" : "/en";
  if (pathname === "/en") return locale === "en" ? "/en" : "/tr";
  if (pathname.startsWith("/tr/")) return locale === "tr" ? pathname : `/en/${pathname.slice(4)}`;
  if (pathname.startsWith("/en/")) return locale === "en" ? pathname : `/tr/${pathname.slice(4)}`;
  return `/${locale}`;
}

function TurkishFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={className} aria-hidden="true">
      <rect width="36" height="24" fill="#e30a17" />
      <circle cx="14" cy="12" r="6" fill="#fff" />
      <circle cx="16" cy="12" r="4.8" fill="#e30a17" />
      <polygon fill="#fff" points="23,8.2 23.9,10.7 26.5,10.7 24.4,12.3 25.2,14.8 23,13.3 20.8,14.8 21.6,12.3 19.5,10.7 22.1,10.7" />
    </svg>
  );
}

function UnitedKingdomFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={className} aria-hidden="true">
      <rect width="36" height="24" fill="#012169" />
      <path d="M0 0L36 24M36 0L0 24" stroke="#fff" strokeWidth="5" />
      <path d="M0 0L36 24M36 0L0 24" stroke="#c8102e" strokeWidth="2.4" />
      <rect x="15" width="6" height="24" fill="#fff" />
      <rect y="9" width="36" height="6" fill="#fff" />
      <rect x="16.5" width="3" height="24" fill="#c8102e" />
      <rect y="10.5" width="36" height="3" fill="#c8102e" />
    </svg>
  );
}

function LocaleFlag({ locale, className }: { locale: SiteLocale; className?: string }) {
  return locale === "tr" ? <TurkishFlag className={className} /> : <UnitedKingdomFlag className={className} />;
}

export function SiteFooter({ className }: { className?: string }) {
  const pathname = usePathname();
  const locale = currentLocale(pathname);

  return (
    <footer className={cn("bg-background text-muted-foreground", className)}>
      <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-col justify-center gap-3 px-4 py-3 text-sm sm:px-6 md:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={`/${locale}`} className="inline-flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={locale === "en" ? "Vultkey home" : "Vultkey ana sayfa"}>
            <LogoMark className="size-6" />
            <span className="text-sm font-semibold text-foreground/90">Vultkey</span>
            <BetaBadge className="h-5 bg-primary/15 text-primary" />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Footer">
            {footerLinks[locale].map((link) => (
              <Link key={link.href} href={link.href} className="whitespace-nowrap font-semibold text-foreground/85 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-1.5 transition-colors hover:border-primary/45 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={locale === "en" ? "Select language" : "Dil seç"}>
              <LocaleFlag locale={locale} className="h-[18px] w-7 rounded-sm shadow-[inset_0_0_0_1px_oklch(0_0_0/0.16)]" />
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-24">
              {(["tr", "en"] as const).map((item) => (
                <DropdownMenuItem key={item} asChild className={cn("p-1.5", locale === item && "bg-accent text-accent-foreground")}>
                  <Link href={localizedPath(pathname, item)} className="flex items-center gap-2" aria-label={languageOptions[item].label} aria-current={locale === item ? "true" : undefined}>
                    <LocaleFlag locale={item} className="h-[18px] w-7 rounded-sm shadow-[inset_0_0_0_1px_oklch(0_0_0/0.16)]" />
                    <span className="text-xs font-semibold text-foreground/85">{item.toUpperCase()}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="inline-flex min-w-0 items-center">
            <span className="whitespace-nowrap font-semibold text-foreground/80">© Requiem Development</span>
          </div>
          <div className="flex items-center gap-1.5" aria-label="Sosyal bağlantılar">
            {socialLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="inline-flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={link.label}>
                  <Icon className="size-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
