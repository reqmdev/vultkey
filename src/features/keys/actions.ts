"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guards";
import { decryptKeyMaterial, encryptKeyMaterial, keyFingerprint } from "@/lib/security/crypto";
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit";
import { createKeyMask } from "@/lib/security/sanitize";
import { assertServerActionSameOrigin } from "@/lib/security/server-action";
import {
  bulkCreateKeySchema,
  createKeySchema,
  idSchema,
  keyStatusUpdateSchema,
  moveKeySchema,
  updateKeySchema,
  type BulkCreateKeyInput,
  type CreateKeyInput,
  type KeyStatusUpdateInput,
  type MoveKeyInput,
  type UpdateKeyInput
} from "@/lib/validations/domain";
import type { Database, KeyStatus } from "@/types/database";

type ActionResult = { ok: boolean; message: string };
type SecretResult = ActionResult & { secret?: string; revealUntil?: number };

function mutationLimitMessage(): ActionResult {
  return { ok: false, message: "Çok fazla işlem yapıldı. Biraz bekleyip tekrar dene." };
}

function revalidateVaultData() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/tags");
}

async function validateCategory(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, categoryId: string | null) {
  if (!categoryId) return true;
  const { data, error } = await supabase.from("categories").select("id").eq("id", categoryId).eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}

async function validateTags(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, tagIds: string[]) {
  if (tagIds.length === 0) return true;
  const uniqueTagIds = Array.from(new Set(tagIds));
  const { data, error } = await supabase.from("tags").select("id").eq("user_id", userId).in("id", uniqueTagIds);
  return !error && (data?.length ?? 0) === uniqueTagIds.length;
}

function redeemedAtFor(status: KeyStatus) {
  return status === "redeemed" ? new Date().toISOString() : null;
}

function uniqueRawKeys(rawKeys: string[]) {
  const seen = new Set<string>();
  return rawKeys.filter((rawKey) => {
    const normalized = rawKey.toUpperCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export async function createKeyAction(input: CreateKeyInput): Promise<ActionResult> {
  const parsed = createKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kod bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "key:create"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const [categoryOk, tagsOk] = await Promise.all([
    validateCategory(supabase, user.id, parsed.data.categoryId),
    validateTags(supabase, user.id, parsed.data.tagIds)
  ]);

  if (!categoryOk || !tagsOk) {
    return { ok: false, message: "Seçilen kategori veya etiket erişilebilir değil." };
  }

  const encrypted = encryptKeyMaterial(parsed.data.rawKey);
  const hash = keyFingerprint(parsed.data.rawKey);

  const { data, error } = await supabase
    .from("keys")
    .insert({
      user_id: user.id,
      category_id: parsed.data.categoryId,
      title: parsed.data.title,
      platform: parsed.data.platform,
      status: parsed.data.status,
      encrypted_key: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_tag: encrypted.tag,
      key_hash: hash,
      key_mask: createKeyMask(parsed.data.rawKey),
      source: parsed.data.source,
      notes: parsed.data.notes,
      redeemed_at: redeemedAtFor(parsed.data.status),
      expires_at: parsed.data.expiresAt
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.code === "23505" ? "Bu kod zaten kasada kayıtlı." : "Kod kaydedilemedi." };
  }

  if (parsed.data.tagIds.length > 0) {
    const uniqueTagIds = Array.from(new Set(parsed.data.tagIds));
    const tagRows = uniqueTagIds.map((tagId) => ({ key_id: data.id, tag_id: tagId, user_id: user.id }));
    const tagInsert = await supabase.from("key_tags").insert(tagRows);

    if (tagInsert.error) {
      await supabase.from("keys").delete().eq("id", data.id).eq("user_id", user.id);
      return { ok: false, message: "Kod etiketleri bağlanamadı." };
    }
  }

  await recordAudit(supabase, user.id, {
    eventType: "key.created",
    entityType: "key",
    entityId: data.id,
    metadata: { status: parsed.data.status, platform: parsed.data.platform }
  });

  revalidateVaultData();
  return { ok: true, message: "Kod kasaya eklendi." };
}

export async function createKeysAction(input: BulkCreateKeyInput): Promise<ActionResult> {
  const parsed = bulkCreateKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kod bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "key:bulk-create"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const rawKeys = uniqueRawKeys(parsed.data.rawKeys);
  const [categoryOk, tagsOk] = await Promise.all([
    validateCategory(supabase, user.id, parsed.data.categoryId),
    validateTags(supabase, user.id, parsed.data.tagIds)
  ]);

  if (!categoryOk || !tagsOk) {
    return { ok: false, message: "Seçilen kategori veya etiket erişilebilir değil." };
  }

  const createdIds: string[] = [];
  let duplicateCount = parsed.data.rawKeys.length - rawKeys.length;
  let failedCount = 0;

  for (const rawKey of rawKeys) {
    const encrypted = encryptKeyMaterial(rawKey);
    const hash = keyFingerprint(rawKey);
    const { data, error } = await supabase
      .from("keys")
      .insert({
        user_id: user.id,
        category_id: parsed.data.categoryId,
        title: parsed.data.title,
        platform: parsed.data.platform,
        status: parsed.data.status,
        encrypted_key: encrypted.ciphertext,
        encryption_iv: encrypted.iv,
        encryption_tag: encrypted.tag,
        key_hash: hash,
        key_mask: createKeyMask(rawKey),
        source: parsed.data.source,
        notes: parsed.data.notes,
        redeemed_at: redeemedAtFor(parsed.data.status),
        expires_at: parsed.data.expiresAt
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") duplicateCount += 1;
      else failedCount += 1;
      continue;
    }

    createdIds.push(data.id);
  }

  if (createdIds.length === 0) {
    return { ok: false, message: duplicateCount > 0 ? "Yeni kod eklenmedi. Kodlar zaten kasada olabilir." : "Kodlar kaydedilemedi." };
  }

  if (parsed.data.tagIds.length > 0) {
    const uniqueTagIds = Array.from(new Set(parsed.data.tagIds));
    const tagRows = createdIds.flatMap((keyId) => uniqueTagIds.map((tagId) => ({ key_id: keyId, tag_id: tagId, user_id: user.id })));
    const tagInsert = await supabase.from("key_tags").insert(tagRows);

    if (tagInsert.error) failedCount += 1;
  }

  await recordAudit(supabase, user.id, {
    eventType: "key.bulk_created",
    entityType: "key",
    metadata: { count: createdIds.length, duplicates: duplicateCount, failed: failedCount, platform: parsed.data.platform }
  });

  revalidateVaultData();

  const details = [
    `${createdIds.length} kod eklendi`,
    duplicateCount > 0 ? `${duplicateCount} tekrar atlandı` : null,
    failedCount > 0 ? `${failedCount} kayıt başarısız` : null
  ].filter(Boolean);

  return { ok: true, message: `${details.join(". ")}.` };
}

export async function updateKeyAction(input: UpdateKeyInput): Promise<ActionResult> {
  const parsed = updateKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kod bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "key:update"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const [categoryOk, tagsOk] = await Promise.all([
    validateCategory(supabase, user.id, parsed.data.categoryId),
    validateTags(supabase, user.id, parsed.data.tagIds)
  ]);

  if (!categoryOk || !tagsOk) {
    return { ok: false, message: "Seçilen kategori veya etiket erişilebilir değil." };
  }

  const updatePayload: Database["public"]["Tables"]["keys"]["Update"] = {
    category_id: parsed.data.categoryId,
    title: parsed.data.title,
    platform: parsed.data.platform,
    status: parsed.data.status,
    source: parsed.data.source,
    notes: parsed.data.notes,
    redeemed_at: redeemedAtFor(parsed.data.status),
    expires_at: parsed.data.expiresAt
  };

  if (parsed.data.rawKey) {
    const encrypted = encryptKeyMaterial(parsed.data.rawKey);
    updatePayload.encrypted_key = encrypted.ciphertext;
    updatePayload.encryption_iv = encrypted.iv;
    updatePayload.encryption_tag = encrypted.tag;
    updatePayload.key_hash = keyFingerprint(parsed.data.rawKey);
    updatePayload.key_mask = createKeyMask(parsed.data.rawKey);
  }

  const { error } = await supabase.from("keys").update(updatePayload).eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) {
    return { ok: false, message: error.code === "23505" ? "Bu kod zaten kasada kayıtlı." : "Kod güncellenemedi." };
  }

  await supabase.from("key_tags").delete().eq("key_id", parsed.data.id).eq("user_id", user.id);

  if (parsed.data.tagIds.length > 0) {
    const uniqueTagIds = Array.from(new Set(parsed.data.tagIds));
    const tagRows = uniqueTagIds.map((tagId) => ({ key_id: parsed.data.id, tag_id: tagId, user_id: user.id }));
    const tagInsert = await supabase.from("key_tags").insert(tagRows);
    if (tagInsert.error) return { ok: false, message: "Etiketler güncellenemedi." };
  }

  await recordAudit(supabase, user.id, {
    eventType: "key.updated",
    entityType: "key",
    entityId: parsed.data.id,
    metadata: { status: parsed.data.status, platform: parsed.data.platform }
  });

  revalidateVaultData();
  return { ok: true, message: "Kod güncellendi." };
}

export async function deleteKeyAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Kod bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "key:delete"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const { error } = await supabase.from("keys").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, message: "Kod silinemedi." };

  await recordAudit(supabase, user.id, { eventType: "key.deleted", entityType: "key", entityId: parsed.data });
  revalidateVaultData();
  return { ok: true, message: "Kod silindi." };
}

export async function moveKeyToCategoryAction(input: MoveKeyInput): Promise<ActionResult> {
  const parsed = moveKeySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kod bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "key:move"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const categoryOk = await validateCategory(supabase, user.id, parsed.data.categoryId);
  if (!categoryOk) return { ok: false, message: "Seçilen kategori erişilebilir değil." };

  const { data, error } = await supabase
    .from("keys")
    .update({ category_id: parsed.data.categoryId })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id,title")
    .maybeSingle();

  if (error || !data) return { ok: false, message: "Kod taşınamadı." };

  await recordAudit(supabase, user.id, {
    eventType: "key.moved",
    entityType: "key",
    entityId: data.id,
    metadata: { title: data.title, categoryId: parsed.data.categoryId }
  });

  revalidateVaultData();
  return { ok: true, message: parsed.data.categoryId ? "Kod kategoriye taşındı." : "Kod kategorisiz alana taşındı." };
}

export async function setKeyStatusAction(input: KeyStatusUpdateInput): Promise<ActionResult> {
  const parsed = keyStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kod durumu geçerli değil." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "key:status"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const { data, error } = await supabase
    .from("keys")
    .update({ status: parsed.data.status, redeemed_at: redeemedAtFor(parsed.data.status) })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id,title,status")
    .maybeSingle();

  if (error || !data) return { ok: false, message: "Kod durumu güncellenemedi." };

  await recordAudit(supabase, user.id, {
    eventType: "key.status_changed",
    entityType: "key",
    entityId: data.id,
    metadata: { title: data.title, status: parsed.data.status }
  });

  revalidateVaultData();
  if (parsed.data.status === "redeemed") return { ok: true, message: "Kod kullanıldı olarak işaretlendi." };
  if (parsed.data.status === "reserved") return { ok: true, message: "Kod alındı olarak işaretlendi." };
  return { ok: true, message: "Kod durumu güncellendi." };
}

async function revealSecret(id: string, eventType: "key.revealed" | "key.copied", limitKind: "reveal" | "copy"): Promise<SecretResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Kod bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit(limitKind, [user.id, parsed.data]);
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, message: "Çok fazla güvenli görüntüleme denemesi yapıldı." };
    throw error;
  }

  const { data, error } = await supabase
    .from("keys")
    .select("id,title,encrypted_key,encryption_iv,encryption_tag")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return { ok: false, message: "Kod bulunamadı." };

  const secret = decryptKeyMaterial({
    ciphertext: data.encrypted_key,
    iv: data.encryption_iv,
    tag: data.encryption_tag
  });

  await recordAudit(supabase, user.id, {
    eventType,
    entityType: "key",
    entityId: data.id,
    metadata: { title: data.title }
  });

  return { ok: true, message: "Kod çözüldü.", secret, revealUntil: Date.now() + 30_000 };
}

export async function revealKeyAction(id: string) {
  return revealSecret(id, "key.revealed", "reveal");
}

export async function copyKeyAction(id: string) {
  return revealSecret(id, "key.copied", "copy");
}
