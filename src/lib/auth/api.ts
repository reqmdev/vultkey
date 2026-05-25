import "server-only";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { expiredPasswordRecoveryCookieOptions, passwordRecoveryCookie, verifyPasswordRecoveryCookieValue } from "@/lib/auth/recovery";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit";
import { sanitizeSafePath } from "@/lib/security/sanitize";
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-session";
import { BotProtectionError, enforceBotProtection, type BotProtectionTokens } from "@/lib/security/bot-protection";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema
} from "@/lib/validations/auth";

type AuthResponse = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

const invalidAuthResponse = "Giriş bilgilerini kontrol et.";
const rateLimitResponse = "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
const deleteAccountSchema = z.object({ confirmation: z.string().trim().min(1).max(254) });
const botProtectionSchema = z.object({
  turnstileToken: z.string().trim().min(1).max(4096).optional(),
  recaptchaToken: z.string().trim().min(1).max(4096).optional()
});

function json(payload: AuthResponse, status = 200) {
  return NextResponse.json(payload, { status });
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function hasSameOrigin(value: string | null, expectedOrigin: string) {
  if (!value) return false;

  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    if (origin !== request.nextUrl.origin) {
      return json({ ok: false, message: "İstek doğrulanamadı." }, 403);
    }

    return null;
  }

  if (!hasSameOrigin(referer, request.nextUrl.origin)) {
    return json({ ok: false, message: "İstek doğrulanamadı." }, 403);
  }

  return null;
}

async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function rateLimitError(error: unknown) {
  if (error instanceof RateLimitError) {
    return json({ ok: false, message: rateLimitResponse }, 429);
  }

  throw error;
}

function botProtectionError(error: unknown) {
  if (error instanceof BotProtectionError) {
    return json({ ok: false, message: error.message }, 403);
  }

  throw error;
}

function readBotProtectionTokens(body: unknown): BotProtectionTokens {
  const parsed = botProtectionSchema.safeParse(body);
  return parsed.success ? parsed.data : {};
}

async function getAuthUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try {
    return await supabase.auth.getUser();
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      return { data: { user: null }, error };
    }

    throw error;
  }
}

export async function loginRequest(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const body = await readJson(request);
  const parsed = loginSchema.extend({ next: z.string().optional() }).safeParse(body);

  if (!parsed.success) {
    return json({ ok: false, message: invalidAuthResponse }, 400);
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await enforceRateLimit("auth", [email]);
  } catch (error) {
    return rateLimitError(error);
  }

  try {
    await enforceBotProtection("login", request, readBotProtectionTokens(body));
  } catch (error) {
    return botProtectionError(error);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password
  });

  if (error || !data.user) {
    return json({ ok: false, message: "E-posta veya şifre hatalı." }, 401);
  }

  await recordAudit(supabase, data.user.id, {
    eventType: "auth.login_success",
    entityType: "user",
    entityId: data.user.id
  });

  return json({ ok: true, message: "Giriş başarılı.", redirectTo: sanitizeSafePath(parsed.data.next, "/dashboard") });
}

export async function signupRequest(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const body = await readJson(request);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return json({ ok: false, message: "Kayıt bilgilerini kontrol et." }, 400);
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await enforceRateLimit("auth", [email]);
  } catch (error) {
    return rateLimitError(error);
  }

  try {
    await enforceBotProtection("signup", request, readBotProtectionTokens(body));
  } catch (error) {
    return botProtectionError(error);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signUp({
    email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=/dashboard`
    }
  });

  return json({
    ok: true,
    message: "Doğrulama bağlantısı e-posta adresine gönderildi. Gelen kutunu kontrol et."
  });
}

export async function forgotPasswordRequest(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const body = await readJson(request);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return json({ ok: false, message: "E-posta adresini kontrol et." }, 400);
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await enforceRateLimit("passwordReset", [email]);
  } catch (error) {
    return rateLimitError(error);
  }

  try {
    await enforceBotProtection("forgot_password", request, readBotProtectionTokens(body));
  } catch (error) {
    return botProtectionError(error);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`
  });

  return json({
    ok: true,
    message: "Eğer bu e-posta kayıtlıysa kısa süreli sıfırlama bağlantısı gönderildi."
  });
}

export async function resetPasswordRequest(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const body = await readJson(request);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return json({ ok: false, message: "Yeni şifreyi kontrol et." }, 400);
  }

  try {
    await enforceRateLimit("passwordReset", ["reset-session"]);
  } catch (error) {
    return rateLimitError(error);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await getAuthUser(supabase);

  if (userError || !user) {
    return json({ ok: false, message: "Sıfırlama oturumu geçersiz veya süresi dolmuş." }, 401);
  }

  const cookieStore = await cookies();
  const recoveryCookie = cookieStore.get(passwordRecoveryCookie)?.value;

  if (!verifyPasswordRecoveryCookieValue(recoveryCookie, user.id)) {
    cookieStore.set(passwordRecoveryCookie, "", expiredPasswordRecoveryCookieOptions());
    return json({ ok: false, message: "Sıfırlama bağlantısı doğrulanamadı veya süresi doldu." }, 401);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return json({ ok: false, message: "Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir." }, 400);
  }

  await recordAudit(supabase, user.id, {
    eventType: "auth.password_updated",
    entityType: "user",
    entityId: user.id
  });

  cookieStore.set(passwordRecoveryCookie, "", expiredPasswordRecoveryCookieOptions());

  return json({ ok: true, message: "Şifre güncellendi.", redirectTo: "/dashboard" });
}

export async function passwordLinkRequest(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await getAuthUser(supabase);

  if (userError || !user) {
    return json({ ok: false, message: "Oturum doğrulanamadı." }, 401);
  }

  const email = user.email?.toLowerCase();

  if (!email) {
    return json({ ok: false, message: "Bu hesapta şifre bağlantısı gönderecek e-posta yok." }, 400);
  }

  try {
    await enforceRateLimit("passwordReset", [user.id, email]);
  } catch (error) {
    return rateLimitError(error);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`
  });

  if (error) {
    return json({ ok: false, message: "Şifre bağlantısı gönderilemedi." }, 400);
  }

  await recordAudit(supabase, user.id, {
    eventType: "auth.password_link_requested",
    entityType: "user",
    entityId: user.id
  });

  return json({ ok: true, message: "Şifre bağlantısı hesap e-postana gönderildi." });
}

export async function deleteAccountRequest(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const body = await readJson(request);
  const parsed = deleteAccountSchema.safeParse(body);

  if (!parsed.success) {
    return json({ ok: false, message: "Hesap silme onayını kontrol et." }, 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await getAuthUser(supabase);

  if (userError || !user) {
    return json({ ok: false, message: "Oturum doğrulanamadı." }, 401);
  }

  const expectedConfirmation = user.email?.toLowerCase() ?? "hesabi sil";

  if (parsed.data.confirmation.toLowerCase() !== expectedConfirmation) {
    return json({ ok: false, message: "Onay metni eşleşmiyor." }, 400);
  }

  try {
    await enforceRateLimit("accountDelete", [user.id]);
  } catch (error) {
    return rateLimitError(error);
  }

  await recordAudit(supabase, user.id, {
    eventType: "auth.account_delete_requested",
    entityType: "user",
    entityId: user.id
  });

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return json({ ok: false, message: "Hesap silme şu anda tamamlanamadı." }, 500);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id, false);

  if (error) {
    return json({ ok: false, message: "Hesap silinemedi. Daha sonra tekrar dene." }, 400);
  }

  await supabase.auth.signOut({ scope: "local" });

  return json({ ok: true, message: "Hesap silindi.", redirectTo: "/login?account_deleted=1" });
}
