# Security Policy

## Reporting a Vulnerability

Please do not open public issues for vulnerabilities that expose user data, credentials, auth bypasses, or deployment secrets.

Report privately through GitHub Security Advisories if available, or contact the project maintainer through the repository contact channel.

Include:

- Affected version or commit.
- Reproduction steps.
- Expected and actual behavior.
- Impact assessment.
- Any relevant logs with secrets removed.

## Secret Handling

Never commit real values for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `UPSTASH_REDIS_REST_TOKEN`
- `VULTKEY_ENCRYPTION_KEY`
- `VULTKEY_HMAC_KEY`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `RECAPTCHA_SECRET_KEY`

Use `.env.local` for local development and Vercel Environment Variables for deployments. Keep `.env.example` placeholder-only.

## Release Checks

Before a public release or deployment, run:

```bash
pnpm security:check
pnpm preflight:prod
pnpm publish:check
pnpm lint
pnpm typecheck
pnpm build
pnpm clean:artifacts
```

Run deployed smoke checks after deployment:

```bash
SMOKE_BASE_URL=https://your-domain.example pnpm smoke:prod
```
