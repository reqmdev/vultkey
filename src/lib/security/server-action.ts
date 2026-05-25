import "server-only";

import { headers } from "next/headers";

function sameOrigin(value: string | null, expectedOrigin: string | null) {
  if (!value || !expectedOrigin) return false;

  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

async function expectedOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) return null;

  const proto = headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export async function assertServerActionSameOrigin() {
  const headerStore = await headers();
  const expected = await expectedOrigin();
  const origin = headerStore.get("origin");
  const referer = headerStore.get("referer");

  if (origin) {
    if (origin === expected) return;
    throw new Error("Server action origin check failed.");
  }

  if (sameOrigin(referer, expected)) return;

  throw new Error("Server action origin check failed.");
}
