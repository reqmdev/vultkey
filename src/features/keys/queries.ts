import "server-only";

import { requireUser } from "@/lib/auth/guards";
import type { AuditLog, PublicClaimLog, VaultCategory, VaultKey, VaultPublicLink, VaultTag } from "@/features/keys/types";
import type { CategoryColor, KeyStatus, PublicKeyLinkAccessMode, PublicKeyLinkStatus, PublicKeyLinkType, PublicKeyViewMode } from "@/types/database";

type KeyQueryRow = {
  id: string;
  title: string;
  platform: string;
  status: KeyStatus;
  key_mask: string;
  source: string | null;
  notes: string | null;
  category_id: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryQueryRow = { id: string; parent_id: string | null; name: string; color: CategoryColor; sort_order: number };
type TagQueryRow = { id: string; name: string };
type KeyTagQueryRow = { key_id: string; tag_id: string };
type PublicLinkQueryRow = {
  id: string;
  key_id: string | null;
  category_id: string | null;
  link_type: PublicKeyLinkType;
  view_mode: PublicKeyViewMode;
  access_mode: PublicKeyLinkAccessMode;
  status: PublicKeyLinkStatus;
  title: string | null;
  claim_count: number;
  max_claims: number;
  expires_at: string | null;
  disabled_at: string | null;
};

function throwSupabaseLoadError(scope: string, error: { code?: string; message?: string } | null) {
  const hint = error?.code ? `${scope}:${error.code}` : scope;
  const detail = error?.message ? ` ${error.message}` : "";
  throw new Error(`Dashboard data could not be loaded. ${hint}.${detail}`);
}

async function loadCategories(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const withParent = await supabase
    .from("categories")
    .select("id,parent_id,name,color,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (withParent.error?.code !== "42703") return withParent;

  const withoutParent = await supabase
    .from("categories")
    .select("id,name,color,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    ...withoutParent,
    data: withoutParent.data?.map((category) => ({ ...category, parent_id: null })) ?? null
  };
}

export async function getDashboardData() {
  const { supabase } = await requireUser();

  const [keysResult, categoriesResult, tagsResult, keyTagsResult, publicLinksResult] = await Promise.all([
    supabase
      .from("keys")
      .select("id,title,platform,status,key_mask,source,notes,category_id,redeemed_at,expires_at,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    loadCategories(supabase),
    supabase.from("tags").select("id,name").order("name", { ascending: true }),
    supabase.from("key_tags").select("key_id,tag_id"),
    supabase
      .from("public_key_links")
      .select("id,key_id,category_id,link_type,view_mode,access_mode,status,title,claim_count,max_claims,expires_at,disabled_at")
      .order("created_at", { ascending: false })
  ]);

  if (keysResult.error) throwSupabaseLoadError("keys", keysResult.error);
  if (categoriesResult.error) throwSupabaseLoadError("categories", categoriesResult.error);
  if (tagsResult.error) throwSupabaseLoadError("tags", tagsResult.error);
  if (keyTagsResult.error) throwSupabaseLoadError("key_tags", keyTagsResult.error);
  if (publicLinksResult.error && publicLinksResult.error.code !== "42P01") throwSupabaseLoadError("public_key_links", publicLinksResult.error);

  const rawKeys = (keysResult.data ?? []) as unknown as KeyQueryRow[];
  const rawCategories = (categoriesResult.data ?? []) as unknown as CategoryQueryRow[];
  const rawTags = (tagsResult.data ?? []) as unknown as TagQueryRow[];
  const rawKeyTags = (keyTagsResult.data ?? []) as unknown as KeyTagQueryRow[];
  const rawPublicLinks = (publicLinksResult.data ?? []) as unknown as PublicLinkQueryRow[];
  const categoryById = new Map(rawCategories.map((category) => [category.id, category]));
  const tagById = new Map(rawTags.map((tag) => [tag.id, tag]));
  const tagsByKeyId = new Map<string, VaultTag[]>();
  const publicLinkByKeyId = new Map<string, VaultPublicLink>();
  const publicLinkByCategoryId = new Map<string, VaultPublicLink>();

  rawKeyTags.forEach((keyTag) => {
    const tag = tagById.get(keyTag.tag_id);
    if (!tag) return;

    const current = tagsByKeyId.get(keyTag.key_id) ?? [];
    current.push({ id: tag.id, name: tag.name });
    tagsByKeyId.set(keyTag.key_id, current);
  });

  rawPublicLinks.forEach((link) => {
    const publicLink: VaultPublicLink = {
      id: link.id,
      type: link.link_type,
      viewMode: link.view_mode,
      accessMode: link.access_mode,
      status: link.status,
      title: link.title,
      claimCount: link.claim_count,
      maxClaims: link.max_claims,
      expiresAt: link.expires_at,
      disabledAt: link.disabled_at
    };

    if (link.link_type === "single" && link.key_id && !publicLinkByKeyId.has(link.key_id)) {
      publicLinkByKeyId.set(link.key_id, publicLink);
    }

    if (link.link_type === "category" && link.category_id && !publicLinkByCategoryId.has(link.category_id)) {
      publicLinkByCategoryId.set(link.category_id, publicLink);
    }
  });

  const keys: VaultKey[] = rawKeys.map((key) => ({
    id: key.id,
    title: key.title,
    platform: key.platform,
    status: key.status,
    keyMask: key.key_mask,
    source: key.source,
    notes: key.notes,
    categoryId: key.category_id,
    category: key.category_id && categoryById.has(key.category_id)
      ? {
          id: categoryById.get(key.category_id)!.id,
          parentId: categoryById.get(key.category_id)!.parent_id,
          name: categoryById.get(key.category_id)!.name,
          color: categoryById.get(key.category_id)!.color,
          sortOrder: categoryById.get(key.category_id)!.sort_order
        }
      : null,
    tags: tagsByKeyId.get(key.id) ?? [],
    redeemedAt: key.redeemed_at,
    expiresAt: key.expires_at,
    createdAt: key.created_at,
    updatedAt: key.updated_at,
    publicLink: publicLinkByKeyId.get(key.id) ?? null
  }));

  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  keys.forEach((key) => {
    if (key.categoryId) categoryCounts.set(key.categoryId, (categoryCounts.get(key.categoryId) ?? 0) + 1);
    key.tags.forEach((tag) => tagCounts.set(tag.id, (tagCounts.get(tag.id) ?? 0) + 1));
  });

  const categories: VaultCategory[] = rawCategories.map((category) => ({
    id: category.id,
    parentId: category.parent_id,
    name: category.name,
    color: category.color,
    sortOrder: category.sort_order,
    keyCount: categoryCounts.get(category.id) ?? 0,
    publicLink: publicLinkByCategoryId.get(category.id) ?? null
  }));

  const tags: VaultTag[] = rawTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    keyCount: tagCounts.get(tag.id) ?? 0
  }));

  return { keys, categories, tags };
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,event_type,entity_type,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    throw new Error("İşlem kayıtları yüklenemedi.");
  }

  return (data ?? []).map((log) => ({
    id: log.id,
    eventType: log.event_type,
    entityType: log.entity_type,
    entityId: log.entity_id,
    metadata: log.metadata,
    createdAt: log.created_at
  }));
}

export async function getPublicClaimLogs(): Promise<PublicClaimLog[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("public_key_claims")
    .select("id,link_id,key_id,status,recipient_email,recipient_label,recipient_user_id,recipient_member_email,country_code,device_type,os_name,os_version,browser_name,browser_version,client_platform,timezone,language,key_title_snapshot,platform_snapshot,key_mask_snapshot,reserved_at,redeemed_at")
    .order("reserved_at", { ascending: false })
    .limit(120);

  if (error) {
    throw new Error("Kod alım kayıtları yüklenemedi.");
  }

  return (data ?? []).map((claim) => ({
    id: claim.id,
    linkId: claim.link_id,
    keyId: claim.key_id,
    status: claim.status,
    recipientEmail: claim.recipient_email,
    recipientLabel: claim.recipient_label,
    recipientUserId: claim.recipient_user_id,
    recipientMemberEmail: claim.recipient_member_email,
    countryCode: claim.country_code,
    deviceType: claim.device_type,
    osName: claim.os_name,
    osVersion: claim.os_version,
    browserName: claim.browser_name,
    browserVersion: claim.browser_version,
    clientPlatform: claim.client_platform,
    timezone: claim.timezone,
    language: claim.language,
    keyTitle: claim.key_title_snapshot,
    platform: claim.platform_snapshot,
    keyMask: claim.key_mask_snapshot,
    reservedAt: claim.reserved_at,
    redeemedAt: claim.redeemed_at
  }));
}
