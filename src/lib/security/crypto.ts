import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { normalizeGameKey } from "@/lib/security/sanitize";

function readBase64Secret(name: "VULTKEY_ENCRYPTION_KEY" | "VULTKEY_HMAC_KEY", expectedLength?: number) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  const key = Buffer.from(value, "base64");

  if (expectedLength && key.length !== expectedLength) {
    throw new Error(`${name} must be ${expectedLength} bytes after base64 decoding.`);
  }

  if (!expectedLength && key.length < 32) {
    throw new Error(`${name} must be at least 32 bytes after base64 decoding.`);
  }

  return key;
}

export function encryptKeyMaterial(plainText: string) {
  const key = readBase64Secret("VULTKEY_ENCRYPTION_KEY", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptKeyMaterial(payload: { ciphertext: string; iv: string; tag: string }) {
  const key = readBase64Secret("VULTKEY_ENCRYPTION_KEY", 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function keyFingerprint(rawKey: string) {
  const key = readBase64Secret("VULTKEY_HMAC_KEY");
  return createHmac("sha256", key).update(normalizeGameKey(rawKey)).digest("hex");
}

export function createPublicToken() {
  return randomBytes(24).toString("base64url");
}

export function publicTokenHash(token: string) {
  const key = readBase64Secret("VULTKEY_HMAC_KEY");
  return createHmac("sha256", key).update(token).digest("hex");
}

export function auditFingerprint(value: string | null | undefined) {
  if (!value) return null;
  const key = readBase64Secret("VULTKEY_HMAC_KEY");
  return createHmac("sha256", key).update(value).digest("hex");
}
