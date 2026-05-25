# Vultkey

Production-oriented MVP for securely organizing digital keys, codes, licenses, API credentials, coupons, and game keys in a focused Next.js dashboard. Vultkey does not validate third-party keys externally; users manage their own inventory manually.

## Stack

- Next.js App Router, TypeScript, pnpm
- Tailwind CSS, shadcn/ui-style primitives, next-themes
- Supabase Auth, PostgreSQL, RLS
- Upstash Redis rate limiting
- Cloudflare Turnstile and Google reCAPTCHA v3 bot protection for email/password auth and password reset requests
- AES-GCM encryption, HMAC-SHA256 duplicate detection
- TanStack Table, React Hook Form, Zod, Framer Motion, Sonner, Lucide React

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Generate production secrets:

```bash
openssl rand -base64 32
```

Set both `VULTKEY_ENCRYPTION_KEY` and `VULTKEY_HMAC_KEY` to strong base64 values. Do not rotate these without a migration plan, because encrypted keys and duplicate fingerprints depend on them.

## Supabase

Apply all SQL files in `supabase/migrations/` to your Supabase project in timestamp order, or run the project migration script.

Required Supabase Auth settings:

- Enable email/password auth.
- Enable email confirmations for production.
- Set Site URL to `NEXT_PUBLIC_APP_URL`.
- Enable Google and Discord providers if OAuth buttons should work.
- Add redirect URLs for local and production: `http://localhost:3000/auth/callback` and `https://your-domain.com/auth/callback`.

## Security Model

- Raw key material is never stored directly.
- AES-256-GCM encryption runs only in server actions.
- HMAC-SHA256 duplicate detection runs only server-side.
- RLS isolates `profiles`, `keys`, `categories`, `tags`, `key_tags`, and `audit_logs` by `auth.uid()`.
- Reveal/copy decrypts server-side, returns plaintext only to the active client interaction, and records audit events.
- Auth, reset, mutation, reveal, copy, public claim, and account deletion flows use Upstash Redis throttling in production.
- Email/password login, signup, and password reset requests require configured Cloudflare Turnstile and Google reCAPTCHA v3 verification in production.
- Auth authorization uses Supabase `getUser()` server-side, not unverified client state.
- Credential-bearing auth requests use route handlers instead of Server Actions to avoid sensitive form payloads appearing in development Server Action diagnostics.
- Public link token lookup uses HMAC hashes; plaintext tokens are encrypted for owner copy actions.
- Public claims enforce strict per-recipient limits with e-mail, server-set device cookie, browser fingerprint, request headers, user agent, and IP/network hashes when available.
- Account deletion uses `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never expose it with a `NEXT_PUBLIC_` prefix.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm security:check
pnpm publish:check
pnpm preflight:prod
pnpm build
pnpm clean:artifacts
```

## Deployment

Vultkey is intended to run as a normal Vercel Next.js deployment. Do not use static export.

Recommended Vercel import settings:

- Framework Preset: `Next.js`
- Install Command: `pnpm install` or Vercel default
- Build Command: `pnpm build`
- Output Directory: leave empty/default
- Root Directory: repository root

Deploy to Vercel with these Production environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `VULTKEY_ENCRYPTION_KEY`
- `VULTKEY_HMAC_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`
- `RECAPTCHA_MIN_SCORE` (optional, default `0.5`)
- `BOT_PROTECTION_EXPECTED_HOSTNAME` (optional, defaults to `NEXT_PUBLIC_APP_URL` hostname)
- `SUPABASE_SERVICE_ROLE_KEY`
- `TRUSTED_CLIENT_IP_HEADER` (optional; only set to a header your platform/proxy controls)

`VULTKEY_ENCRYPTION_KEY` must decode to exactly 32 bytes from base64. `VULTKEY_HMAC_KEY` must decode to at least 32 bytes. Do not rotate either key without a data migration plan.

Upstash Redis variables are required in production. Development falls back to no-op rate limiting when they are absent.

Turnstile and reCAPTCHA keys are required by `pnpm preflight:prod`. If both provider secrets are set, both checks must pass before login/signup/password-reset requests proceed.

Most server actions use the authenticated Supabase session and RLS remains active. The service-role key is reserved for admin-only account deletion.

### Beta Vercel Flow

1. Push the repository to GitHub/GitLab/Bitbucket.
2. Import it in Vercel and let the first deployment create a `*.vercel.app` URL.
3. Set `NEXT_PUBLIC_APP_URL` to that Vercel URL.
4. Add the same hostname to Supabase Auth redirect URLs, Cloudflare Turnstile domains, and Google reCAPTCHA domains.
5. Add all Production environment variables in Vercel.
6. Redeploy after adding environment variables.
7. Run `SMOKE_BASE_URL=https://your-beta.vercel.app pnpm smoke:prod`.

For Supabase Auth, configure:

- Site URL: `NEXT_PUBLIC_APP_URL`
- Redirect URL: `https://your-beta.vercel.app/auth/callback`
- Email/password auth enabled
- Email confirmations enabled for production
- Google/Discord providers only if OAuth buttons should be active

For bot protection, the hostname in Turnstile, reCAPTCHA, `NEXT_PUBLIC_APP_URL`, and `BOT_PROTECTION_EXPECTED_HOSTNAME` must match the deployed hostname.

Only set `TRUSTED_CLIENT_IP_HEADER` when a trusted edge/proxy controls that header. For example, use `cf-connecting-ip` only when traffic is actually behind Cloudflare.

### Open Source Safety

Safe to commit:

- `src/`
- `public/`
- `supabase/migrations/`
- `scripts/`
- `.env.example`
- `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`
- `package.json`, `pnpm-lock.yaml`, config files

Never commit or manually upload:

- `.env`, `.env.local`, `.env.production`, or any real env file
- `.vercel/`
- `.next/`
- `node_modules/`
- `supabase/.temp/`
- `backups/`
- database dumps, logs, trace files, `.pem` files, or `*.tsbuildinfo`

Before pushing a public repository, run:

```bash
pnpm publish:check
git status --short
```

Before packaging or sharing a zip/tarball, either remove local-only files manually or run the stricter check:

```bash
pnpm publish:check --strict
```

Before packaging or sharing a workspace, run `pnpm clean:artifacts` and never include `.env`, `.next/dev`, trace files, backups, Supabase temp state, or logs in release/support artifacts.

See `docs/SECURITY_RUNBOOK.md` for release gates, smoke checks, backup/restore, and secret-rotation procedures.
