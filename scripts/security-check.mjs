import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function includes(path, text) {
  return read(path).includes(text);
}

function existingSources(paths) {
  return paths.filter((path) => existsSync(join(root, path))).map((path) => read(path));
}

const packageJson = JSON.parse(read("package.json"));
const dependencyGroups = [packageJson.dependencies ?? {}, packageJson.devDependencies ?? {}];
const latestDependencies = dependencyGroups.flatMap((dependencies) =>
  Object.entries(dependencies).filter(([, version]) => version === "latest").map(([name]) => name)
);

assert(!existsSync(join(root, ".env")), "Root .env must not exist. Use .env.local for local secrets.");
assert(!existsSync(join(root, ".next/dev")), ".next/dev artifacts must be cleaned before release.");
assert(!existsSync(join(root, ".next/trace")), ".next trace must be cleaned before release.");
assert(!existsSync(join(root, ".next/trace-build")), ".next trace-build must be cleaned before release.");
assert(!existsSync(join(root, ".next/diagnostics")), ".next diagnostics must be cleaned before release.");
assert(latestDependencies.length === 0, `Dependencies must not use latest: ${latestDependencies.join(", ")}`);
assert(includes(".gitignore", "supabase/.temp/"), ".gitignore must ignore Supabase local link state.");
assert(includes(".gitignore", "backups/"), ".gitignore must ignore database backups.");
assert(includes(".gitignore", "*.tsbuildinfo"), ".gitignore must ignore TypeScript build info.");
assert(includes("package.json", "publish:check"), "package.json is missing publish:check.");
assert(existsSync(join(root, "LICENSE")), "LICENSE file is missing.");

assert(
  existingSources(["next.config.ts", "src/middleware.ts", "src/proxy.ts"]).some((source) => source.includes("Content-Security-Policy") && source.includes("nonce-")),
  "Nonce-based CSP header is missing."
);
assert(includes("src/proxy.ts", "challenges.cloudflare.com") && includes("src/proxy.ts", "recaptcha.google.com"), "CSP is missing CAPTCHA script/frame origins.");
assert(includes("src/lib/auth/api.ts", "verifyPasswordRecoveryCookieValue"), "Password reset is not recovery-cookie bound.");
assert(includes("src/app/auth/callback/route.ts", "createPasswordRecoveryCookieValue"), "Auth callback does not issue recovery cookie.");
assert(includes("src/lib/auth/api.ts", "enforceBotProtection(\"login\"") && includes("src/lib/auth/api.ts", "enforceBotProtection(\"signup\""), "Login/signup are missing bot protection verification.");
assert(includes("src/lib/auth/api.ts", "enforceBotProtection(\"forgot_password\""), "Forgot-password is missing bot protection verification.");
assert(includes("src/components/auth/login-form.tsx", "BotProtection") && includes("src/components/auth/signup-form.tsx", "BotProtection"), "Auth forms are missing bot protection widgets.");
assert(includes("src/components/auth/forgot-password-form.tsx", "BotProtection"), "Forgot-password form is missing bot protection widget.");

for (const path of [
  "src/features/keys/actions.ts",
  "src/features/taxonomy/actions.ts",
  "src/features/public-links/actions.ts",
  "src/app/(auth)/actions.ts"
]) {
  assert(includes(path, "assertServerActionSameOrigin"), `${path} is missing Server Action same-origin guard.`);
}

assert(includes("src/lib/security/rate-limit.ts", "TRUST_X_FORWARDED_FOR"), "Rate limit IP extraction still lacks explicit X-Forwarded-For opt-in.");
assert(!includes("src/features/public-links/public-key-claim.tsx", "secret: result.secret"), "Raw public claim secret must not be persisted in sessionStorage.");
assert(!includes("src/features/public-links/public-key-claim.tsx", "setSecret(storedClaim"), "Stored claim must not hydrate raw secret.");

const followupMigration = "supabase/migrations/20260524008000_security_hardening_followup.sql";
assert(existsSync(join(root, followupMigration)), "Security follow-up migration is missing.");
assert(includes(followupMigration, "member_required"), "Restricted public preview must return member_required before metadata.");
assert(includes(followupMigration, "restore_reserved_claims_before_link_delete"), "Public link delete cleanup trigger is missing.");
assert(!includes(followupMigration, "'recipientEmail', p_recipient"), "Follow-up audit metadata must not duplicate raw recipient email.");

if (failures.length > 0) {
  console.error("Security check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Security check passed.");
