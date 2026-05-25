import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isInvalidRefreshTokenError, isSupabaseAuthCookie, supabaseAuthCookieName } from "@/lib/supabase/auth-session";
import type { Database } from "@/types/database";

const isDev = process.env.NODE_ENV !== "production";
const authSessionVersion = process.env.VULTKEY_AUTH_SESSION_VERSION ?? "20260525-db-reset";
const authSessionVersionCookie = "vultkey-auth-session-version";
const authCookieBaseOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: !isDev
};

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes));
}

function readSupabaseProxyConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;

  try {
    return { url: new URL(url).toString(), publishableKey };
  } catch {
    return null;
  }
}

function supabaseConnectOrigin() {
  const config = readSupabaseProxyConfig();
  return config ? new URL(config.url).origin : "https://*.supabase.co";
}

function buildContentSecurityPolicy(nonce: string) {
  const supabaseOrigin = supabaseConnectOrigin();
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://challenges.cloudflare.com https://www.google.com https://recaptcha.google.com",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} https://*.supabase.co https://*.upstash.io https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com${isDev ? " ws: http://localhost:*" : ""}`,
    "worker-src 'self' blob:"
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function serializedRequestCookies(request: NextRequest) {
  return request.cookies
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const supabaseConfig = readSupabaseProxyConfig();

  function createResponse() {
    const requestHeaders = new Headers(request.headers);
    const cookieHeader = serializedRequestCookies(request);

    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

    if (cookieHeader) {
      requestHeaders.set("cookie", cookieHeader);
    } else {
      requestHeaders.delete("cookie");
    }

    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });

    nextResponse.headers.set("Content-Security-Policy", contentSecurityPolicy);

    return nextResponse;
  }

  let response = createResponse();

  if (!supabaseConfig) return response;

  const { url, publishableKey } = supabaseConfig;
  const authCookieName = supabaseAuthCookieName(url);

  function writeSessionVersionCookie() {
    request.cookies.set(authSessionVersionCookie, authSessionVersion);
    response.cookies.set(authSessionVersionCookie, authSessionVersion, {
      ...authCookieBaseOptions,
      httpOnly: true,
      maxAge: 400 * 24 * 60 * 60
    });
  }

  function clearSupabaseAuthCookies() {
    const cookiesToClear = request.cookies.getAll().filter(({ name }) => isSupabaseAuthCookie(name, authCookieName));

    cookiesToClear.forEach(({ name }) => request.cookies.delete(name));
    response = createResponse();
    cookiesToClear.forEach(({ name }) => {
      response.cookies.set(name, "", { ...authCookieBaseOptions, maxAge: 0 });
    });
  }

  const hasSupabaseAuthCookies = request.cookies.getAll().some(({ name }) => isSupabaseAuthCookie(name, authCookieName));
  const currentAuthSessionVersion = request.cookies.get(authSessionVersionCookie)?.value;

  if (currentAuthSessionVersion !== authSessionVersion) {
    if (hasSupabaseAuthCookies) {
      clearSupabaseAuthCookies();
      writeSessionVersionCookie();
      return response;
    }

    writeSessionVersionCookie();
  }

  try {
    const supabase = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = createResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      },
      cookieOptions: {
        ...authCookieBaseOptions,
        name: authCookieName
      }
    });

    const { error } = await supabase.auth.getUser();
    if (isInvalidRefreshTokenError(error)) clearSupabaseAuthCookies();
  } catch (error) {
    if (!isInvalidRefreshTokenError(error)) throw error;
    clearSupabaseAuthCookies();
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};
