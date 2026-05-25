import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Vultkey beta terms of use, public-link rules, member allowlists, and user responsibilities."
};

const sections = [
  {
    title: "1. Acceptance and beta status",
    paragraphs: [
      "By using Vultkey, you agree to these terms. Vultkey is a beta product for organizing and distributing digital keys, codes, licenses, API credentials, coupons, and game keys. Product behavior, security controls, claim logs, and the data model may change during beta.",
      "The beta label does not mean the product is unusable. It means you should evaluate your own risk before relying on it for critical production secrets, regulated data, or high-value credentials."
    ]
  },
  {
    title: "2. Account responsibility",
    paragraphs: [
      "You are responsible for protecting your account, password, OAuth identities, and signed-in devices. Changes made from your account, including vault edits and public-link settings, are treated as actions performed by your account.",
      "You may not access another person’s account, bypass claim limits, abuse rate limits, or attempt to work around Vultkey security controls."
    ]
  },
  {
    title: "3. Vault content",
    paragraphs: [
      "Only store records that you have the right to store, manage, or distribute. You are responsible for the legality, accuracy, and sharing rights of licenses, API keys, game keys, coupons, and similar content.",
      "Vultkey encrypts raw key material, but it does not validate whether a third-party license is genuine, unused, transferable, or compliant with the issuing platform’s terms."
    ]
  },
  {
    title: "4. Public links",
    paragraphs: [
      "When you create a public link, you control who receives it, how many claims are allowed, whether raw reveal is enabled, whether the copy button is shown, what fields are visible, and when the link expires. If raw reveal is enabled, Vultkey cannot technically prevent the recipient from manually copying the code. Sharing the link with the wrong person or enabling raw reveal by mistake is your responsibility.",
      "A public link manages the distribution workflow. Vultkey does not directly verify whether the recipient used the code on a third-party platform. If the recipient presses the used confirmation, that is recorded as a user statement."
    ]
  },
  {
    title: "5. Member allowlists and claim limits",
    paragraphs: [
      "A link owner may restrict a public link to specific Vultkey members. In that mode, the recipient must sign in with a Vultkey account that matches an email selected by the owner.",
      "Claim limits may use email, member account, device cookies, browser fingerprints, request fingerprints, user-agent hashes, and IP hashes. These controls reduce abuse, but they are not a legal identity system and cannot guarantee perfect enforcement in every environment."
    ]
  },
  {
    title: "6. Logs and visibility",
    paragraphs: [
      "The link owner may see public claim logs. Those logs can include recipient-entered email, recipient note, Vultkey member email, country code, device type, operating system, browser, language, timezone, claim time, redemption time, and key snapshot information.",
      "By claiming a code through a public link, the recipient accepts that these distribution records may be shown to the link owner for tracking, abuse prevention, and audit purposes."
    ]
  },
  {
    title: "7. Prohibited use",
    paragraphs: [
      "You may not use Vultkey to distribute malware, store stolen credentials, share keys without permission, infringe third-party rights, run phishing campaigns, or abuse public links for spam or fraud.",
      "You may not mislead recipients, attempt to access other users’ data, or intentionally bypass rate limits, claim limits, or member allowlists."
    ]
  },
  {
    title: "8. Self-hosting",
    paragraphs: [
      "Vultkey can be self-hosted. If you run your own deployment, you are responsible for Supabase, Upstash, hosting, domains, backups, migrations, access policies, and production configuration.",
      "You must protect secrets such as `VULTKEY_ENCRYPTION_KEY`, `VULTKEY_HMAC_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Losing, rotating, or exposing these values incorrectly can cause data loss or security issues."
    ]
  },
  {
    title: "9. Deletion, liability, and changes",
    paragraphs: [
      "Account deletion is designed to remove application data and may not be reversible. Deleting a key removes the raw key material, but limited claim metadata or snapshots may remain for repeat-claim protection and audit integrity.",
      "Vultkey is provided as a beta product with reasonable security practices, but it does not guarantee uninterrupted service, absolute security, third-party license validity, or perfect claim enforcement. These terms may be updated as the product changes."
    ]
  }
];

export default function EnglishTermsPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/88">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/en" />
          <div className="flex items-center gap-2">
            <ThemeToggle className="size-9 border border-border bg-background/70" />
            <Link href="/en" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <article className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 md:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-muted-foreground">Last updated: May 24, 2026</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Terms of Use</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            These terms explain how Vultkey may be used, what public-link owners are responsible for, and what a beta product does not promise.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden text-sm text-muted-foreground md:block">
            <p className="font-semibold text-foreground/80">Contents</p>
            <p className="mt-2 leading-6">Beta use, account responsibility, public links, member allowlists, claim logs, self-hosting, and liability limits.</p>
          </aside>

          <div className="space-y-9">
            {sections.map((section) => (
              <section key={section.title} className="max-w-3xl">
                <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground md:text-[15px]">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
