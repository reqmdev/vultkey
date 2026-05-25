# Security Runbook

## Release Gate

Run these commands before any public release or shared build artifact:

```bash
pnpm security:check
pnpm publish:check
pnpm preflight:prod
pnpm lint
pnpm typecheck
pnpm build
pnpm clean:artifacts
```

Run a deployed smoke test after deployment:

```bash
SMOKE_BASE_URL=https://your-domain.example pnpm smoke:prod
```

## Secret Rotation

Rotate immediately if `.env.local`, terminal output, backups, traces, or provider logs expose secrets.

Rotate in this order:

1. Supabase database password and pooler URI.
2. Upstash Redis REST token.
3. Supabase service-role key.
4. `VULTKEY_HMAC_KEY` only with a migration plan for stored hashes.
5. `VULTKEY_ENCRYPTION_KEY` only with a re-encryption plan for stored ciphertext.

Do not blindly rotate `VULTKEY_ENCRYPTION_KEY`; existing encrypted keys and public-link tokens will become unreadable. Do not blindly rotate `VULTKEY_HMAC_KEY`; public-link lookups, duplicate detection, claim tokens, and audit/recipient fingerprints rely on existing hashes.

## HMAC V2 Plan

Current production data keeps v1 hashes for compatibility. A safe domain-separated v2 cutover requires a maintenance window:

1. Add nullable v2 hash columns for keys, public links, claims, and recipient fingerprints.
2. Backfill rows whose raw material can be recovered server-side, such as encrypted key material and encrypted public-link tokens.
3. Store both v1 and v2 for new writes.
4. Update RPCs to look up by v2 first and fall back to v1.
5. Wait for old public claim tokens and recipient fingerprints to age out or force reissue.
6. Enforce v2-only uniqueness and remove v1 only after no active v1 links/claims remain.

Until that migration is complete, keep `VULTKEY_HMAC_KEY` protected as a high-value secret.

## Backups

Create a backup before migrations:

```powershell
pnpm backup:db
```

Restore is intentionally guarded and requires explicit project confirmation:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-supabase.ps1 -BackupFile backups\file.sql -ConfirmProjectRef your-project-ref -ConfirmRestore RESTORE_DATABASE
```

## Artifact Hygiene

Never publish or attach these paths in support bundles:

- `.env`
- `.env.local`
- `.next/dev`
- `.next/trace`
- `.next/trace-build`
- `.next/diagnostics`
- `.next/dev/logs`
- database backups
- `supabase/.temp`
- `tsconfig.tsbuildinfo`

Use `pnpm clean:artifacts` before sharing the workspace.
