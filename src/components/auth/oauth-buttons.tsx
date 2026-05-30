import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import type { AuthLocale } from "@/components/auth/auth-shell";

const providers = [
  { id: "google", label: "Google", icon: FaGoogle },
  { id: "discord", label: "Discord", icon: FaDiscord }
] as const;

const copy = {
  tr: { emailDivider: "E-posta ile devam et" },
  en: { emailDivider: "Continue with email" }
} satisfies Record<AuthLocale, { emailDivider: string }>;

function oauthHref(provider: (typeof providers)[number]["id"], next?: string) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  const query = params.toString();
  return `/api/auth/oauth/${provider}${query ? `?${query}` : ""}`;
}

export function OAuthButtons({ next, locale = "tr" }: { next?: string; locale?: AuthLocale }) {
  const labels = copy[locale];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map(({ id, label, icon: Icon }) => (
          <Button key={id} asChild type="button" variant="outline" className="h-11 bg-background/65">
            <a href={oauthHref(id, next)}>
              <Icon className="size-4" />
              {label}
            </a>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border/70" />
        <span>{labels.emailDivider}</span>
        <span className="h-px flex-1 bg-border/70" />
      </div>
    </div>
  );
}
