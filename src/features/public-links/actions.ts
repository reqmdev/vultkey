"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guards";
import { auditFingerprint, createPublicToken, decryptKeyMaterial, encryptKeyMaterial, publicTokenHash } from "@/lib/security/crypto";
import { RateLimitError, enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { assertServerActionSameOrigin } from "@/lib/security/server-action";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { idSchema, publicKeyLinkSchema, publicRecipientCheckSchema, publicRedeemSchema, publicReserveSchema, publicTokenSchema, type PublicKeyLinkInput, type PublicRecipientCheckInput, type PublicRedeemInput, type PublicReserveInput } from "@/lib/validations/domain";
import type { PublicKeyLinkAccessMode, PublicKeyLinkType } from "@/types/database";

type ActionResult = { ok: boolean; message: string };
type PublishResult = ActionResult & { url?: string; linkId?: string };
type ReserveResult = ActionResult & {
  secret?: string;
  claimToken?: string;
  keyTitle?: string;
  platform?: string;
  canConfirmRedeemed?: boolean;
  canCopy?: boolean;
};
type RecipientAccessResult = ActionResult & { blocked: boolean };
type MemberAccessResult = ActionResult & { requiresLogin: boolean; allowed: boolean; email: string | null };

type PublicListItem = {
  id: string;
  available: boolean;
  title: string | null;
  platform: string | null;
  keyMask: string | null;
  category: string | null;
  tags: string[];
  status: string | null;
  expiresAt: string | null;
  notes: string | null;
  source: string | null;
};

const claimDeviceCookie = "vultkey_claim_device";

const unknownEnvironment = "Bilinmiyor";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function fingerprintHash(parts: Array<string | number | boolean | null | undefined>) {
  const value = parts.filter((part) => part !== null && part !== undefined && part !== "").join("\n");
  return value ? auditFingerprint(value) : null;
}

function publicUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(`/k/${token}`, base).toString();
}

function normalizeEmailList(value: string[] | undefined) {
  return Array.from(new Set((value ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean)));
}

function cleanEnvironmentText(value: string | null | undefined, max = 80) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function countryFromHeaders(headerStore: { get(name: string): string | null }) {
  const value = headerStore.get("cf-ipcountry") ?? headerStore.get("x-vercel-ip-country");
  if (!value || value === "XX") return null;
  return value.slice(0, 2).toUpperCase();
}

function windowsFromPlatformVersion(value: string | null) {
  const major = Number(value?.replaceAll('"', "").split(".")[0]);
  if (!Number.isFinite(major)) return null;
  if (major >= 13) return { osName: "Windows 11", osVersion: null };
  if (major >= 1) return { osName: "Windows 10", osVersion: null };
  return null;
}

function windowsFromNtVersion(value: string | null) {
  if (!value) return null;

  const names: Record<string, string> = {
    "10.0": "Windows 10/11",
    "6.3": "Windows 8.1",
    "6.2": "Windows 8",
    "6.1": "Windows 7",
    "6.0": "Windows Vista",
    "5.2": "Windows XP/Server 2003",
    "5.1": "Windows XP"
  };

  return { osName: names[value] ?? "Windows", osVersion: names[value] ? null : value };
}

function browserFromUserAgent(ua: string) {
  const rules: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /EdgiOS\/([\d.]+)/, name: "Edge" },
    { pattern: /EdgA?\/([\d.]+)/, name: "Edge" },
    { pattern: /Vivaldi\/([\d.]+)/, name: "Vivaldi" },
    { pattern: /YaBrowser\/([\d.]+)/, name: "Yandex" },
    { pattern: /DuckDuckGo\/([\d.]+)/, name: "DuckDuckGo" },
    { pattern: /OPiOS\/([\d.]+)/, name: "Opera" },
    { pattern: /OPR\/([\d.]+)/, name: "Opera" },
    { pattern: /SamsungBrowser\/([\d.]+)/, name: "Samsung Internet" },
    { pattern: /UCBrowser\/([\d.]+)/, name: "UC Browser" },
    { pattern: /MiuiBrowser\/([\d.]+)/, name: "Mi Browser" },
    { pattern: /HuaweiBrowser\/([\d.]+)/, name: "Huawei Browser" },
    { pattern: /HeyTapBrowser\/([\d.]+)/, name: "HeyTap Browser" },
    { pattern: /CriOS\/([\d.]+)/, name: "Chrome" },
    { pattern: /Chrome\/([\d.]+)/, name: "Chrome" },
    { pattern: /FxiOS\/([\d.]+)/, name: "Firefox" },
    { pattern: /Firefox\/([\d.]+)/, name: "Firefox" },
    { pattern: /Version\/([\d.]+).*Safari/, name: "Safari" }
  ];

  for (const rule of rules) {
    const match = ua.match(rule.pattern);
    if (match) return { browserName: rule.name, browserVersion: match[1] ?? null };
  }

  return { browserName: unknownEnvironment, browserVersion: null };
}

function parseUserAgent(userAgent: string | null, platformVersion: string | null = null) {
  const ua = userAgent ?? "";
  const browser = browserFromUserAgent(ua);

  const windowsVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] ?? null;
  const windowsHint = windowsVersion ? windowsFromPlatformVersion(platformVersion) : null;
  const windowsFromUa = windowsHint ?? windowsFromNtVersion(windowsVersion);
  const macVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replaceAll("_", ".") ?? null;
  const iosVersion = ua.match(/(?:iPhone OS|CPU OS) ([\d_]+)/)?.[1]?.replaceAll("_", ".") ?? null;
  const androidVersion = ua.match(/Android ([\d.]+)/)?.[1] ?? null;

  const osName = windowsFromUa?.osName ?? (windowsVersion
    ? "Windows"
    : iosVersion
      ? "iOS"
      : androidVersion
        ? "Android"
        : macVersion
          ? "macOS"
          : /CrOS/i.test(ua)
            ? "Chrome OS"
            : /Linux/i.test(ua)
              ? "Linux"
              : unknownEnvironment);
  const osVersion = windowsFromUa ? windowsFromUa.osVersion : (windowsVersion ?? iosVersion ?? androidVersion ?? macVersion ?? null);
  const deviceType = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "mobile" : "desktop";

  return {
    browserName: browser.browserName,
    browserVersion: browser.browserVersion,
    osName,
    osVersion,
    deviceType
  };
}

function clientFingerprintField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? cleanEnvironmentText(item) : null;
}

function clientFingerprintBool(value: unknown, key: string) {
  if (!value || typeof value !== "object") return false;
  return (value as Record<string, unknown>)[key] === true;
}

function browserFromClientFingerprint(value: unknown) {
  if (!value || typeof value !== "object") return null;
  if (clientFingerprintBool(value, "brave")) return { browserName: "Brave", browserVersion: null };

  const brands = (value as Record<string, unknown>).browserBrands;
  if (!Array.isArray(brands)) return null;

  const brandRules: Array<{ pattern: RegExp; name: string; generic?: boolean }> = [
    { pattern: /Brave/i, name: "Brave" },
    { pattern: /Microsoft\s*Edge|Edge/i, name: "Edge" },
    { pattern: /Opera|OPR/i, name: "Opera" },
    { pattern: /Vivaldi/i, name: "Vivaldi" },
    { pattern: /Yandex/i, name: "Yandex" },
    { pattern: /DuckDuckGo/i, name: "DuckDuckGo" },
    { pattern: /Samsung/i, name: "Samsung Internet" },
    { pattern: /Firefox/i, name: "Firefox" },
    { pattern: /Google\s*Chrome/i, name: "Chrome" },
    { pattern: /^Chrome$/i, name: "Chrome" },
    { pattern: /Safari/i, name: "Safari" },
    { pattern: /Chromium/i, name: "Chromium", generic: true }
  ];

  for (const item of brands) {
    if (!item || typeof item !== "object") continue;
    const brand = String((item as Record<string, unknown>).brand ?? "");
    if (!brand || /not/i.test(brand)) continue;
    const version = String((item as Record<string, unknown>).version ?? "") || null;
    const matched = brandRules.find((rule) => rule.pattern.test(brand) && !rule.generic);
    if (matched) return { browserName: matched.name, browserVersion: version };
  }

  return null;
}

async function requestFingerprints({ ensureDeviceCookie = true }: { ensureDeviceCookie?: boolean } = {}) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const userAgent = headerStore.get("user-agent");
  const ip = await getClientIp();
  const knownIp = ip === "unknown" ? null : ip;
  let deviceId = cookieStore.get(claimDeviceCookie)?.value ?? null;
  const parsedUserAgent = parseUserAgent(userAgent, headerStore.get("sec-ch-ua-platform-version"));

  if (ensureDeviceCookie && (!deviceId || deviceId.length < 16 || deviceId.length > 160)) {
    deviceId = createPublicToken();
    cookieStore.set(claimDeviceCookie, deviceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  return {
    ipHash: auditFingerprint(knownIp),
    userAgentHash: auditFingerprint(userAgent),
    deviceHash: auditFingerprint(deviceId),
    countryCode: countryFromHeaders(headerStore),
    ...parsedUserAgent,
    requestHash: fingerprintHash([
      knownIp,
      userAgent,
      headerStore.get("accept-language"),
      headerStore.get("accept-encoding"),
      headerStore.get("sec-ch-ua"),
      headerStore.get("sec-ch-ua-mobile"),
      headerStore.get("sec-ch-ua-platform"),
      headerStore.get("sec-ch-ua-platform-version"),
      headerStore.get("sec-fetch-site"),
      headerStore.get("cf-ipcountry"),
      headerStore.get("x-vercel-ip-country"),
      headerStore.get("x-vercel-ip-city"),
      headerStore.get("x-vercel-ip-timezone")
    ])
  };
}

function clientFingerprintHash(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return auditFingerprint(stableJson(value));
}

async function validateOwnerTarget(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  targetType: PublicKeyLinkType,
  keyId: string | null,
  categoryId: string | null
) {
  if (targetType === "single") {
    if (!keyId) return false;
    const { data, error } = await supabase.from("keys").select("id").eq("id", keyId).eq("user_id", userId).maybeSingle();
    return !error && Boolean(data);
  }

  if (!categoryId) return false;
  const { data, error } = await supabase.from("categories").select("id").eq("id", categoryId).eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}

function publicRecipientBlockedMessage(message: string | null | undefined) {
  return message || "Bu bağlantıdan bu cihaz veya oturum için daha önce kod alınmış.";
}

function normalizeReserveFailure(message: string | null | undefined) {
  const value = message ?? "Kod alınamadı.";
  if (/daha fazla kod alamaz|cihaz|ağ|tarayıcı|e-posta bu linkten/i.test(value)) {
    return "Bu bağlantıdan bu cihaz veya oturum için daha önce kod alınmış.";
  }

  return value;
}

async function getRecipientAccessStatus({ token, recipientEmail, clientFingerprint, ensureDeviceCookie }: { token: string; recipientEmail?: string | null; clientFingerprint?: unknown; ensureDeviceCookie: boolean }): Promise<RecipientAccessResult> {
  const fingerprints = await requestFingerprints({ ensureDeviceCookie });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_link_recipient_status", {
    p_token_hash: publicTokenHash(token),
    p_ip_hash: fingerprints.ipHash,
    p_user_agent_hash: fingerprints.userAgentHash,
    p_recipient_device_hash: fingerprints.deviceHash,
    p_recipient_browser_hash: clientFingerprintHash(clientFingerprint),
    p_recipient_request_hash: fingerprints.requestHash,
    p_recipient_email: recipientEmail ?? null
  });

  const result = data?.[0];
  if (error || !result) return { ok: false, blocked: true, message: "Bağlantı erişimi kontrol edilemedi." };
  if (result.blocked) return { ok: false, blocked: true, message: publicRecipientBlockedMessage(result.message) };
  return { ok: true, blocked: false, message: "" };
}

async function getMemberAccessStatus(token: string, accessMode: PublicKeyLinkAccessMode, requireEmailVerification: boolean): Promise<MemberAccessResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_link_member_status", { p_token_hash: publicTokenHash(token) });
  const result = data?.[0];
  const loginMessage = accessMode === "email_allowlist" || requireEmailVerification
    ? "Bu bağlantı için doğrulanmış Vultkey e-postasıyla giriş yapmak gerekli."
    : "Bu bağlantı için Vultkey hesabıyla giriş yapmak gerekli.";
  const deniedMessage = accessMode === "email_allowlist"
    ? "Bu Vultkey hesabının e-postası bu bağlantının allowlist'inde yok."
    : "Bu Vultkey hesabının bu bağlantıya erişimi yok.";

  if (error || !result) return { ok: false, requiresLogin: false, allowed: false, email: null, message: "Üye erişimi kontrol edilemedi." };
  if (result.requires_login) return { ok: false, requiresLogin: true, allowed: false, email: null, message: loginMessage };
  if (!result.allowed) return { ok: false, requiresLogin: false, allowed: false, email: result.member_email, message: deniedMessage };
  return { ok: true, requiresLogin: false, allowed: true, email: result.member_email, message: "" };
}

export async function createPublicKeyLinkAction(input: PublicKeyLinkInput): Promise<PublishResult> {
  const parsed = publicKeyLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Link ayarlarını kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "public-link:create"]);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, message: "Çok fazla işlem yapıldı. Biraz bekle." };
    throw error;
  }

  const targetOk = await validateOwnerTarget(supabase, user.id, parsed.data.targetType, parsed.data.keyId, parsed.data.categoryId);
  if (!targetOk) return { ok: false, message: "Yayınlanacak kod veya kategori bulunamadı." };

  if (parsed.data.targetType === "single" && parsed.data.keyId) {
    await supabase
      .from("public_key_links")
      .update({ status: "disabled", disabled_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("key_id", parsed.data.keyId)
      .eq("status", "active");
  }

  if (parsed.data.targetType === "category" && parsed.data.categoryId) {
    await supabase
      .from("public_key_links")
      .update({ status: "disabled", disabled_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("category_id", parsed.data.categoryId)
      .eq("status", "active");
  }

  const token = createPublicToken();
  const encryptedToken = encryptKeyMaterial(token);
  const maxClaims = parsed.data.targetType === "single" ? 1 : parsed.data.maxClaims;
  const viewMode = parsed.data.targetType === "single" ? "single" : parsed.data.viewMode;

  const { data, error } = await supabase
    .from("public_key_links")
    .insert({
      user_id: user.id,
      key_id: parsed.data.targetType === "single" ? parsed.data.keyId : null,
      category_id: parsed.data.targetType === "category" ? parsed.data.categoryId : null,
      link_type: parsed.data.targetType,
      view_mode: viewMode,
      access_mode: parsed.data.accessMode,
      require_email_verification: parsed.data.requireEmailVerification,
      token_hash: publicTokenHash(token),
      token_ciphertext: encryptedToken.ciphertext,
      token_iv: encryptedToken.iv,
      token_tag: encryptedToken.tag,
      title: parsed.data.title,
      message: parsed.data.message,
      expires_at: parsed.data.expiresAt,
      max_claims: maxClaims,
      include_subcategories: parsed.data.targetType === "category" ? parsed.data.includeSubcategories : false,
      visibility_config: parsed.data.visibility,
      permission_config: parsed.data.permissions
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: "Yayın linki oluşturulamadı." };

  const allowedEmails = normalizeEmailList(parsed.data.allowedEmails);
  if ((parsed.data.accessMode === "email_allowlist" || parsed.data.accessMode === "member_allowlist") && allowedEmails.length > 0) {
    let memberByEmail = new Map<string, { id: string; email: string }>();

    if (parsed.data.accessMode === "member_allowlist") {
      try {
        const admin = createSupabaseAdminClient();
        const { data: profiles, error: profilesError } = await admin.from("profiles").select("id,email").in("email", allowedEmails);
        if (profilesError) return { ok: false, message: "Vultkey üyeleri doğrulanamadı." };

        memberByEmail = new Map((profiles ?? []).map((profile) => [profile.email.trim().toLowerCase(), profile]));
      } catch {
        await supabase.from("public_key_links").delete().eq("id", data.id).eq("user_id", user.id);
        return { ok: false, message: "Üye listesi doğrulanamadı." };
      }

      const missingEmails = allowedEmails.filter((email) => !memberByEmail.has(email));
      if (missingEmails.length > 0) {
        await supabase.from("public_key_links").delete().eq("id", data.id).eq("user_id", user.id);
        return { ok: false, message: "Üye listesinde doğrulanamayan alıcılar var." };
      }
    }

    const rows = allowedEmails.map((email) => ({ link_id: data.id, user_id: user.id, email, recipient_user_id: memberByEmail.get(email)?.id ?? null }));
    const emailInsert = await supabase.from("public_key_link_emails").insert(rows);
    if (emailInsert.error) {
      await supabase.from("public_key_links").delete().eq("id", data.id).eq("user_id", user.id);
      return { ok: false, message: "E-posta listesi kaydedilemedi." };
    }
  }

  await recordAudit(supabase, user.id, {
    eventType: "public_link.created",
    entityType: "public_key_link",
    entityId: data.id,
    metadata: { targetType: parsed.data.targetType, viewMode, accessMode: parsed.data.accessMode, maxClaims }
  });

  revalidatePath("/dashboard");
  return { ok: true, message: "Yayın linki oluşturuldu.", url: publicUrl(token), linkId: data.id };
}

export async function copyPublicKeyLinkAction(id: string): Promise<PublishResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Link bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("public_key_links")
    .select("id,token_ciphertext,token_iv,token_tag")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { ok: false, message: "Link bulunamadı." };

  const token = decryptKeyMaterial({ ciphertext: data.token_ciphertext, iv: data.token_iv, tag: data.token_tag });
  await recordAudit(supabase, user.id, { eventType: "public_link.copied", entityType: "public_key_link", entityId: data.id });
  return { ok: true, message: "Link hazır.", url: publicUrl(token), linkId: data.id };
}

export async function disablePublicKeyLinkAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Link bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("public_key_links")
    .update({ status: "disabled", disabled_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, message: "Link kapatılamadı." };

  await recordAudit(supabase, user.id, { eventType: "public_link.disabled", entityType: "public_key_link", entityId: data.id });
  revalidatePath("/dashboard");
  return { ok: true, message: "Yayın linki kapatıldı." };
}

export async function checkPublicRecipientAccessAction(input: PublicRecipientCheckInput): Promise<RecipientAccessResult> {
  const parsed = publicRecipientCheckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, blocked: false, message: "Bağlantı kontrol edilemedi." };
  await assertServerActionSameOrigin();

  try {
    await enforceRateLimit("publicRead", [parsed.data.token, "recipient-status"]);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, blocked: true, message: "Çok fazla deneme yapıldı. Biraz bekle." };
    throw error;
  }

  return getRecipientAccessStatus({
    token: parsed.data.token,
    recipientEmail: null,
    clientFingerprint: parsed.data.clientFingerprint,
    ensureDeviceCookie: true
  });
}

export async function reservePublicKeyAction(input: PublicReserveInput): Promise<ReserveResult> {
  const parsed = publicReserveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Bilgileri kontrol et." };
  await assertServerActionSameOrigin();

  try {
    await enforceRateLimit("claim", [parsed.data.token]);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, message: "Çok fazla deneme yapıldı. Biraz bekle." };
    throw error;
  }

  const claimToken = createPublicToken();
  const fingerprints = await requestFingerprints();
  const clientPlatform = clientFingerprintField(parsed.data.clientFingerprint, "userAgentDataPlatform") ?? clientFingerprintField(parsed.data.clientFingerprint, "platform");
  const timezone = clientFingerprintField(parsed.data.clientFingerprint, "timezone");
  const language = clientFingerprintField(parsed.data.clientFingerprint, "language");
  const clientBrowser = browserFromClientFingerprint(parsed.data.clientFingerprint);
  const browserName = clientBrowser?.browserName ?? fingerprints.browserName;
  const browserVersion = clientBrowser?.browserVersion ?? fingerprints.browserVersion;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reserve_public_key", {
    p_token_hash: publicTokenHash(parsed.data.token),
    p_claim_token_hash: publicTokenHash(claimToken),
    p_recipient_email: parsed.data.recipientEmail,
    p_recipient_label: parsed.data.recipientLabel ?? null,
    p_ip_hash: fingerprints.ipHash,
    p_user_agent_hash: fingerprints.userAgentHash,
    p_recipient_device_hash: fingerprints.deviceHash,
    p_recipient_browser_hash: clientFingerprintHash(parsed.data.clientFingerprint),
    p_recipient_request_hash: fingerprints.requestHash,
    p_key_id: parsed.data.keyId,
    p_country_code: fingerprints.countryCode,
    p_device_type: fingerprints.deviceType,
    p_os_name: fingerprints.osName,
    p_os_version: fingerprints.osVersion,
    p_browser_name: browserName,
    p_browser_version: browserVersion,
    p_client_platform: clientPlatform,
    p_timezone: timezone,
    p_language: language
  });

  const result = data?.[0];
  if (error || !result) {
    const detail = process.env.NODE_ENV !== "production" && error?.message ? ` ${error.message}` : "";
    return { ok: false, message: `Rezervasyon işlemi tamamlanamadı.${detail}` };
  }
  if (!result.ok) return { ok: false, message: normalizeReserveFailure(result.message) };
  if (!result.can_reveal) {
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: "Kod alındı.",
      claimToken,
      keyTitle: result.key_title ?? undefined,
      platform: result.platform ?? undefined,
      canConfirmRedeemed: Boolean(result.can_confirm_redeemed),
      canCopy: Boolean(result.can_copy)
    };
  }
  if (!result.encrypted_key || !result.encryption_iv || !result.encryption_tag) return { ok: false, message: "Kod çözülemedi." };

  const secret = decryptKeyMaterial({ ciphertext: result.encrypted_key, iv: result.encryption_iv, tag: result.encryption_tag });
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: "Kod alındı.",
    secret,
    claimToken,
    keyTitle: result.key_title ?? undefined,
    platform: result.platform ?? undefined,
    canConfirmRedeemed: Boolean(result.can_confirm_redeemed),
    canCopy: Boolean(result.can_copy)
  };
}

export async function confirmPublicRedeemedAction(input: PublicRedeemInput): Promise<ActionResult> {
  const parsed = publicRedeemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Rezervasyon bulunamadı." };
  await assertServerActionSameOrigin();

  try {
    await enforceRateLimit("claim", [parsed.data.claimToken, "redeem"]);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, message: "Çok fazla deneme yapıldı. Biraz bekle." };
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("confirm_public_redeemed", {
    p_claim_token_hash: publicTokenHash(parsed.data.claimToken)
  });

  const result = data?.[0];
  if (error || !result) return { ok: false, message: "Onay işlemi tamamlanamadı." };
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/dashboard");
  return { ok: true, message: result.message };
}

export async function getPublicKeyLinkData(token: string) {
  if (!publicTokenSchema.safeParse(token).success) {
    return { state: "invalid" as const, message: "Bağlantı geçersiz." };
  }

  try {
    await enforceRateLimit("publicRead", [token, "preview"]);
  } catch (error) {
    if (error instanceof RateLimitError) return { state: "rate_limited" as const, message: "Çok fazla deneme yapıldı. Biraz bekle." };
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("public_link_preview", { p_token_hash: publicTokenHash(token) });
  const link = data?.[0];

  if (error || !link) return { state: "invalid" as const, message: "Bağlantı okunamadı." };
  if (link.state === "member_required") return { state: "member_required" as const, message: link.message };
  if (link.state === "member_denied") return { state: "member_denied" as const, message: link.message };
  if (link.state !== "active") return { state: link.state as "invalid" | "disabled" | "expired" | "claimed", message: link.message };

  const items = Array.isArray(link.items) ? (link.items as PublicListItem[]) : [];
  const visibility = typeof link.visibility_config === "object" && link.visibility_config ? link.visibility_config : {};
  const permissions = typeof link.permission_config === "object" && link.permission_config ? link.permission_config : {};
  const accessMode = (link.access_mode ?? "anyone") as PublicKeyLinkAccessMode;
  const requireEmailVerification = Boolean(link.require_email_verification);
  let viewerEmail: string | null = null;

  if (accessMode !== "anyone" || requireEmailVerification) {
    const memberStatus = await getMemberAccessStatus(token, accessMode, requireEmailVerification);
    viewerEmail = memberStatus.email;
    if (memberStatus.requiresLogin) return { state: "member_required" as const, message: memberStatus.message };
    if (!memberStatus.allowed) return { state: "member_denied" as const, message: memberStatus.message };
  }

  const recipientStatus = await getRecipientAccessStatus({ token, ensureDeviceCookie: false });
  if (recipientStatus.blocked) {
    return { state: "recipient_blocked" as const, message: recipientStatus.message };
  }

  return {
    state: "active" as const,
    link: {
      title: link.title,
      message: link.link_message,
      type: link.link_type ?? "single",
      viewMode: link.view_mode ?? "single",
      accessMode,
      requireEmailVerification,
      requiresEmail: false,
      requiresMember: accessMode !== "anyone" || requireEmailVerification,
      viewerEmail,
      maxClaims: link.max_claims ?? 1,
      claimCount: link.claim_count ?? 0,
      expiresAt: link.expires_at,
      visibility,
      permissions
    },
    preview: link.preview_title
      ? {
          title: link.preview_title,
          platform: link.preview_platform ?? "Dijital key",
          keyMask: link.preview_key_mask
        }
      : null,
    items
  };
}
