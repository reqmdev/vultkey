# Contributing

Thanks for your interest in Vultkey.

## Local Setup

```bash
pnpm install
pnpm dev
```

Create a local `.env.local` with your own Supabase, Upstash, Turnstile, and reCAPTCHA values. Do not commit `.env.local`.

## Development Checks

Run these before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm security:check
pnpm preflight
pnpm publish:check
```

For production release validation, also run:

```bash
pnpm preflight:prod
pnpm build
pnpm smoke:prod
```

## Pull Request Guidelines

- Keep changes focused and minimal.
- Include migrations for database changes.
- Do not weaken RLS, same-origin checks, rate limits, CSP, or bot protection without explaining the security tradeoff.
- Do not commit generated folders such as `.next/`, `node_modules/`, `.vercel/`, `supabase/.temp/`, or `backups/`.
- Do not commit screenshots, logs, or artifacts containing secrets.

## Security Changes

Security-sensitive changes should mention the affected flow, verification steps, and residual risks.
