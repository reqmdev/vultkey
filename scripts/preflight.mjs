import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const production = process.argv.includes("--production");
const failures = [];
const warnings = [];

function parseEnv(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requireEnv(env, name) {
  if (!env[name]) fail(`${name} is required${production ? " in production" : ""}.`);
}

function isPlaceholderValue(value) {
  return /^(your_|base64_32|placeholder|change_me|example_|test_)/i.test(value) ||
    /your-|your_|placeholder|example\.com|your-domain|your-project-ref|your-db-password|aws-0-region/i.test(value);
}

function validateNotPlaceholder(env, name) {
  if (!env[name]) return;
  if (isPlaceholderValue(env[name])) fail(`${name} still contains placeholder text.`);
}

function validateBase64Length(env, name, expectedLength, minimumLength = expectedLength) {
  if (!env[name]) return;

  const length = Buffer.from(env[name], "base64").length;
  if (expectedLength && length !== expectedLength) fail(`${name} must decode to ${expectedLength} bytes.`);
  if (!expectedLength && length < minimumLength) fail(`${name} must decode to at least ${minimumLength} bytes.`);
}

function validateNumberRange(env, name, min, max) {
  if (!env[name]) return;

  const value = Number(env[name]);
  if (!Number.isFinite(value) || value < min || value > max) fail(`${name} must be a number between ${min} and ${max}.`);
}

const env = {
  ...parseEnv(join(root, ".env.local")),
  ...process.env
};

if (existsSync(join(root, ".env"))) fail("Root .env exists. Rename it to .env.local and keep it out of artifacts.");

for (const path of [".next/dev", ".next/trace", ".next/trace-build", ".next/diagnostics"]) {
  if (existsSync(join(root, path))) fail(`${path} exists. Run pnpm clean:artifacts before release.`);
}

for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "VULTKEY_ENCRYPTION_KEY", "VULTKEY_HMAC_KEY"]) {
  requireEnv(env, name);
}

if (production) {
  for (const name of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY",
    "CLOUDFLARE_TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_RECAPTCHA_SITE_KEY",
    "RECAPTCHA_SECRET_KEY"
  ])
    requireEnv(env, name);
  if (env.NEXT_PUBLIC_APP_URL?.startsWith("http://")) fail("NEXT_PUBLIC_APP_URL must use https in production.");
} else if (
  !env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ||
  !env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
  !env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
  !env.RECAPTCHA_SECRET_KEY
) {
  warn("Bot protection env is not fully configured. Login/signup CAPTCHA checks are skipped unless provider keys are set.");
}

validateBase64Length(env, "VULTKEY_ENCRYPTION_KEY", 32);
validateBase64Length(env, "VULTKEY_HMAC_KEY", undefined, 32);
validateNumberRange(env, "RECAPTCHA_MIN_SCORE", 0, 1);

if (production) {
  for (const name of [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VULTKEY_ENCRYPTION_KEY",
    "VULTKEY_HMAC_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY",
    "CLOUDFLARE_TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_RECAPTCHA_SITE_KEY",
    "RECAPTCHA_SECRET_KEY",
    "BOT_PROTECTION_EXPECTED_HOSTNAME"
  ]) {
    validateNotPlaceholder(env, name);
  }
}

for (const key of Object.keys(env)) {
  if (/^NEXT_PUBLIC_/.test(key) && /(SECRET|SERVICE|ROLE|TOKEN|PASSWORD|HMAC|ENCRYPTION|DB_URL)/i.test(key)) {
    fail(`${key} looks like a secret but is exposed with NEXT_PUBLIC_.`);
  }
}

if (!env.TRUSTED_CLIENT_IP_HEADER && env.TRUST_X_FORWARDED_FOR !== "true") {
  warn("No trusted client IP header configured. Rate limits will be token/user based plus unknown IP unless your platform sends cf-connecting-ip.");
}

if (warnings.length > 0) {
  console.warn("Preflight warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length > 0) {
  console.error("Preflight failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Preflight passed${production ? " for production" : ""}.`);
