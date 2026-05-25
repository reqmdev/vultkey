import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const passwordRecoveryCookie = "vultkey_password_recovery";
export const passwordRecoveryMaxAge = 10 * 60;

function readHmacKey() {
  const value = process.env.VULTKEY_HMAC_KEY;
  if (!value) throw new Error("VULTKEY_HMAC_KEY is not configured.");

  const key = Buffer.from(value, "base64");
  if (key.length < 32) throw new Error("VULTKEY_HMAC_KEY must be at least 32 bytes after base64 decoding.");
  return key;
}

function signRecoveryPayload(payload: string) {
  return createHmac("sha256", readHmacKey()).update(`password-recovery:${payload}`).digest("base64url");
}

function safeEqual(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function createPasswordRecoveryCookieValue(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + passwordRecoveryMaxAge;
  const nonce = randomBytes(18).toString("base64url");
  const payload = `${userId}.${expiresAt}.${nonce}`;
  return `${payload}.${signRecoveryPayload(payload)}`;
}

export function verifyPasswordRecoveryCookieValue(value: string | undefined, userId: string) {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 4) return false;

  const [cookieUserId, expiresAtValue, nonce, signature] = parts;
  if (cookieUserId !== userId || !nonce || !signature) return false;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const payload = `${cookieUserId}.${expiresAtValue}.${nonce}`;
  return safeEqual(signature, signRecoveryPayload(payload));
}

export function passwordRecoveryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: passwordRecoveryMaxAge
  };
}

export function expiredPasswordRecoveryCookieOptions() {
  return {
    ...passwordRecoveryCookieOptions(),
    maxAge: 0
  };
}
