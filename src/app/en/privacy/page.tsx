import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Vultkey privacy policy covering vault data, public links, claim logs, and security signals."
};

const sections = [
  {
    title: "1. Scope",
    paragraphs: [
      "This policy explains what Vultkey processes when you create an account, store keys in your vault, publish a public link, or claim a code through a public link. Vultkey is designed for digital keys, licenses, API credentials, coupon codes, game keys, and similar records.",
      "Vultkey is currently in beta. Security behavior, public-link rules, claim logs, and the data model may change as the product is hardened. When behavior changes in a meaningful way, this policy should be updated to match the product."
    ]
  },
  {
    title: "2. Account and identity data",
    paragraphs: [
      "When you create an account, Vultkey stores your email address, Supabase Auth session state, and profile record. Your email is used for sign-in, account ownership, member allowlists, and account settings.",
      "If OAuth providers such as Google or Discord are enabled, Supabase may use the basic account data returned by those providers to create a session. Vultkey does not control the privacy practices of those providers."
    ]
  },
  {
    title: "3. Vault data",
    paragraphs: [
      "Vultkey stores metadata such as title, platform, category, tags, source, notes, status, expiration date, and timestamps so the vault can list, filter, archive, audit, and publish records.",
      "Raw key material is not stored as plain text. Key values are encrypted server-side with AES-GCM. A HMAC-SHA256 fingerprint may be stored for duplicate detection. That fingerprint is used for comparison and is not intended to recover the original key."
    ]
  },
  {
    title: "4. Public links and recipient data",
    paragraphs: [
      "A public link stores its target, type, claim limits, recipient limits, visible fields, raw reveal permission, copy-button visibility, expiration date, and related access settings. Link lookup uses a HMAC token hash. The owner can copy the link again because token material is stored encrypted.",
      "When a recipient claims a code, Vultkey creates a claim record. If the recipient enters an email or note, that information is stored with the claim. If the link is restricted to Vultkey members, the signed-in member email may be shown to the link owner. Raw keys are only shown after claim when the owner allowed raw reveal."
    ]
  },
  {
    title: "5. Device, session, and repeat-claim protection",
    paragraphs: [
      "Vultkey may use a server-set device cookie, browser fingerprint, request fingerprint, user-agent hash, IP hash, and signed-in member account to reduce repeat claims from the same recipient. These signals help enforce per-recipient limits and reduce abuse.",
      "Raw IP addresses, raw user agents, and raw browser fingerprint payloads are not stored as claim history. They are converted to HMAC hashes for comparison. These signals are not perfect identity proof. VPNs, browser settings, privacy extensions, and different devices can affect them."
    ]
  },
  {
    title: "6. Claim environment logs",
    paragraphs: [
      "The link owner can see public-claim logs. Those logs may include the key title, platform, masked key snapshot, claim time, redemption confirmation time, recipient-entered email, recipient note, Vultkey member email, country code, device type, operating system, browser, language, and timezone.",
      "Country data depends on geo headers from the production hosting provider. It may be empty in local development or on infrastructure that does not forward geo headers. If the recipient uses a VPN, the country may reflect the VPN exit location. Browser and operating-system names are inferred from browser-provided signals and may be approximate."
    ]
  },
  {
    title: "7. Cookies and local storage",
    paragraphs: [
      "Vultkey uses Supabase cookies for authentication. Public-claim protection may use an additional httpOnly device cookie. That cookie does not contain the raw key and exists to help recognize a device or session for claim-limit enforcement.",
      "The public claim page does not store raw codes in sessionStorage. It may keep claim metadata during the same browser session; if the page is closed before the code is copied and the owner disabled repeat raw reveal, the raw code may not be shown again."
    ]
  },
  {
    title: "8. Audit records and infrastructure",
    paragraphs: [
      "Vultkey may record audit events for creating, updating, deleting, revealing, copying, public-link creation, public claims, public redemptions, and sign-ins. Audit metadata is intended for owner visibility, troubleshooting, and security review. Raw keys, tokens, secrets, and passwords should not be written into audit metadata.",
      "Vultkey uses Supabase for authentication and database storage. Upstash Redis may be used for rate limiting and short-term abuse protection. In self-hosted deployments, the operator is responsible for environment variables, database access, backups, retention, and provider configuration."
    ]
  },
  {
    title: "9. Deletion and security limits",
    paragraphs: [
      "Account deletion is designed to remove application data. Some technical, audit, backup, or infrastructure records may remain for a limited time depending on deployment and retention settings. When a key is deleted, claim history may keep limited metadata or snapshots so repeat-claim protection and audit integrity continue to work.",
      "Vultkey is built to avoid storing raw keys in plain text and to keep sensitive actions server-side. It is still a beta product. You should evaluate your own risk before storing high-value production credentials or regulated secrets."
    ]
  }
];

export default function EnglishPrivacyPage() {
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Privacy Policy</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            This policy describes the data Vultkey stores, why it is stored, and what link owners may see when public links are used.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden text-sm text-muted-foreground md:block">
            <p className="font-semibold text-foreground/80">Contents</p>
            <p className="mt-2 leading-6">Account data, vault records, public links, claim logs, cookies, infrastructure, deletion, and security limits.</p>
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
