import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitKind = "auth" | "passwordReset" | "mutation" | "reveal" | "copy" | "claim" | "publicRead" | "accountDelete";

const limiterConfig: Record<LimitKind, { requests: number; window: `${number} ${"s" | "m" | "h"}` }> = {
  auth: { requests: 5, window: "10 m" },
  passwordReset: { requests: 3, window: "15 m" },
  mutation: { requests: 80, window: "1 m" },
  reveal: { requests: 20, window: "1 m" },
  copy: { requests: 30, window: "1 m" },
  claim: { requests: 12, window: "1 m" },
  publicRead: { requests: 60, window: "1 m" },
  accountDelete: { requests: 3, window: "1 h" }
};

const limiters = new Map<LimitKind, Ratelimit>();

export class RateLimitError extends Error {
  constructor(public readonly reset?: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Upstash Redis environment variables are missing.");
    }

    return null;
  }

  return new Redis({ url, token });
}

function getLimiter(kind: LimitKind) {
  const existing = limiters.get(kind);
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  const config = limiterConfig[kind];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: true,
    prefix: `vultkey:${kind}`
  });

  limiters.set(kind, limiter);
  return limiter;
}

export async function getClientIp() {
  const headerStore = await headers();
  const configuredHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.toLowerCase();
  const configuredIp = configuredHeader ? headerStore.get(configuredHeader)?.split(",")[0]?.trim() : null;

  if (configuredIp) return configuredIp;

  if (process.env.TRUST_X_FORWARDED_FOR === "true") {
    const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }

  return "unknown";
}

function stableIdentifier(parts: Array<string | null | undefined>) {
  return createHash("sha256")
    .update(parts.filter(Boolean).join(":"))
    .digest("hex");
}

export async function enforceRateLimit(kind: LimitKind, parts: Array<string | null | undefined>) {
  const limiter = getLimiter(kind);
  if (!limiter) return;

  const ip = await getClientIp();
  const identifier = stableIdentifier([kind, ip, ...parts]);
  const result = await limiter.limit(identifier);

  if (!result.success) {
    throw new RateLimitError(result.reset);
  }
}
