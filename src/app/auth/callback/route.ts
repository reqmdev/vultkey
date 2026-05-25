import { NextResponse, type NextRequest } from "next/server";
import { recordAudit } from "@/lib/audit";
import { createPasswordRecoveryCookieValue, passwordRecoveryCookie, passwordRecoveryCookieOptions } from "@/lib/auth/recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeSafePath } from "@/lib/security/sanitize";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorCode = requestUrl.searchParams.get("error_code");
  const provider = requestUrl.searchParams.get("provider");
  const next = sanitizeSafePath(requestUrl.searchParams.get("next"), "/dashboard");
  let passwordRecoveryCookieValue: string | null = null;

  if (authError) {
    const redirectUrl = new URL("/login", requestUrl.origin);
    redirectUrl.searchParams.set("auth_error", authErrorCode ?? authError);
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const redirectUrl = new URL("/login", requestUrl.origin);
      redirectUrl.searchParams.set("auth_error", "callback_failed");
      return NextResponse.redirect(redirectUrl);
    }

    if ((provider === "google" || provider === "discord") && data.user) {
      await recordAudit(supabase, data.user.id, {
        eventType: "auth.oauth_success",
        entityType: "user",
        entityId: data.user.id,
        metadata: { provider }
      });
    }

    if (!provider && next === "/reset-password" && data.user) {
      passwordRecoveryCookieValue = createPasswordRecoveryCookieValue(data.user.id);
    }
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));
  if (passwordRecoveryCookieValue) {
    response.cookies.set(passwordRecoveryCookie, passwordRecoveryCookieValue, passwordRecoveryCookieOptions());
  }

  return response;
}
