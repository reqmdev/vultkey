import "server-only";

import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/security/rate-limit";

type BotAction = "login" | "signup" | "forgot_password";

export type BotProtectionTokens = {
  turnstileToken?: string;
  recaptchaToken?: string;
};

type TurnstileResult = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

type RecaptchaResult = {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export class BotProtectionError extends Error {
  constructor(message = "Bot doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar dene.") {
    super(message);
    this.name = "BotProtectionError";
  }
}

function expectedHostname() {
  if (process.env.BOT_PROTECTION_EXPECTED_HOSTNAME) return process.env.BOT_PROTECTION_EXPECTED_HOSTNAME;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;

  try {
    const hostname = new URL(appUrl).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" ? null : hostname;
  } catch {
    return null;
  }
}

function recaptchaMinScore() {
  const parsed = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.5;
}

function isConfigured(siteKey: string | undefined, secretKey: string | undefined) {
  if (siteKey && secretKey) return true;
  if (!siteKey && !secretKey) return false;

  throw new BotProtectionError("Bot doğrulaması eksik yapılandırılmış.");
}

function assertHostname(hostname: string | undefined, expected: string | null) {
  if (!expected || hostname === expected) return;
  throw new BotProtectionError();
}

function assertAction(action: string | undefined, expected: BotAction) {
  if (action === expected) return;
  throw new BotProtectionError();
}

async function verifyTurnstile(action: BotAction, token: string | undefined, remoteIp: string, expectedHost: string | null) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new BotProtectionError();

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("idempotency_key", crypto.randomUUID());
  if (remoteIp !== "unknown") formData.append("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(8000)
  });

  const result = (await response.json()) as TurnstileResult;
  if (!result.success) throw new BotProtectionError();

  assertAction(result.action, action);
  assertHostname(result.hostname, expectedHost);
}

async function verifyRecaptcha(action: BotAction, token: string | undefined, remoteIp: string, expectedHost: string | null) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new BotProtectionError();

  const body = new URLSearchParams({
    secret,
    response: token
  });
  if (remoteIp !== "unknown") body.set("remoteip", remoteIp);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000)
  });

  const result = (await response.json()) as RecaptchaResult;
  if (!result.success || typeof result.score !== "number" || result.score < recaptchaMinScore()) throw new BotProtectionError();

  assertAction(result.action, action);
  assertHostname(result.hostname, expectedHost);
}

export async function enforceBotProtection(action: BotAction, _request: NextRequest, tokens: BotProtectionTokens) {
  const turnstileConfigured = isConfigured(process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY, process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY);
  const recaptchaConfigured = isConfigured(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, process.env.RECAPTCHA_SECRET_KEY);

  if (!turnstileConfigured && !recaptchaConfigured) {
    if (process.env.NODE_ENV === "production") throw new BotProtectionError("Bot doğrulaması production ortamında zorunlu.");
    return;
  }

  const remoteIp = await getClientIp();
  const host = expectedHostname();

  await Promise.all([
    turnstileConfigured ? verifyTurnstile(action, tokens.turnstileToken, remoteIp, host) : Promise.resolve(),
    recaptchaConfigured ? verifyRecaptcha(action, tokens.recaptchaToken, remoteIp, host) : Promise.resolve()
  ]);
}
