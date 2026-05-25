import { NextResponse, type NextRequest } from "next/server";
import { sanitizeSafePath } from "@/lib/security/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupportedOAuthProvider = "google" | "discord";

function isSupportedProvider(value: string): value is SupportedOAuthProvider {
  return value === "google" || value === "discord";
}

function appOrigin(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return new URL(configuredUrl).origin;

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;

  return request.nextUrl.origin;
}

function loginRedirect(request: NextRequest, authError: string, next: string) {
  const redirectUrl = new URL("/login", request.nextUrl.origin);
  redirectUrl.searchParams.set("auth_error", authError);
  redirectUrl.searchParams.set("next", next);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const next = sanitizeSafePath(request.nextUrl.searchParams.get("next"), "/dashboard");

  if (!isSupportedProvider(provider)) {
    return loginRedirect(request, "oauth_provider", next);
  }

  const callbackUrl = new URL("/auth/callback", appOrigin(request));
  callbackUrl.searchParams.set("next", next);
  callbackUrl.searchParams.set("provider", provider);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString()
    }
  });

  if (error || !data.url) {
    return loginRedirect(request, "oauth_failed", next);
  }

  return NextResponse.redirect(data.url);
}
