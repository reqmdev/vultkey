"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guards";
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit";
import { assertServerActionSameOrigin } from "@/lib/security/server-action";
import {
  categorySchema,
  idSchema,
  moveCategorySchema,
  tagSchema,
  type CategoryInput,
  type MoveCategoryInput,
  type TagInput
} from "@/lib/validations/domain";

type ActionResult = { ok: boolean; message: string };

function mutationLimitMessage(): ActionResult {
  return { ok: false, message: "Çok fazla işlem yapıldı. Biraz bekleyip tekrar dene." };
}

function revalidateCategoryPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/categories");
}

function revalidateTagPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/tags");
}

async function validateParentCategory(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  parentId: string | null,
  categoryId?: string
) {
  if (!parentId) return true;
  if (categoryId && parentId === categoryId) return false;

  const { data, error } = await supabase.from("categories").select("id,parent_id").eq("user_id", userId);
  if (error || !data?.some((category) => category.id === parentId)) return false;

  const categoryById = new Map(data.map((category) => [category.id, category.parent_id]));
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  while (currentId) {
    if (categoryId && currentId === categoryId) return false;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    currentId = categoryById.get(currentId) ?? null;
  }

  return true;
}

export async function createCategoryAction(input: CategoryInput): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kategori bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "category:create"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const parentOk = await validateParentCategory(supabase, user.id, parsed.data.parentId);
  if (!parentOk) return { ok: false, message: "Üst kategori erişilebilir değil." };

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, parent_id: parsed.data.parentId, name: parsed.data.name, color: parsed.data.color, sort_order: parsed.data.sortOrder })
    .select("id")
    .single();

  if (error) return { ok: false, message: "Kategori oluşturulamadı. Aynı isim zaten kullanılıyor olabilir." };

  await recordAudit(supabase, user.id, { eventType: "category.created", entityType: "category", entityId: data.id });
  revalidateCategoryPaths();
  return { ok: true, message: "Kategori oluşturuldu." };
}

export async function updateCategoryAction(input: CategoryInput): Promise<ActionResult> {
  const parsed = categorySchema.extend({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kategori bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "category:update"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const parentOk = await validateParentCategory(supabase, user.id, parsed.data.parentId, parsed.data.id);
  if (!parentOk) return { ok: false, message: "Üst kategori seçimi geçerli değil." };

  const { error } = await supabase
    .from("categories")
    .update({ parent_id: parsed.data.parentId, name: parsed.data.name, color: parsed.data.color, sort_order: parsed.data.sortOrder })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: "Kategori güncellenemedi." };

  await recordAudit(supabase, user.id, { eventType: "category.updated", entityType: "category", entityId: parsed.data.id });
  revalidateCategoryPaths();
  return { ok: true, message: "Kategori güncellendi." };
}

export async function moveCategoryAction(input: MoveCategoryInput): Promise<ActionResult> {
  const parsed = moveCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kategori bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "category:move"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const parentOk = await validateParentCategory(supabase, user.id, parsed.data.parentId, parsed.data.id);
  if (!parentOk) return { ok: false, message: "Kategori buraya taşınamaz." };

  const { data, error } = await supabase
    .from("categories")
    .update({ parent_id: parsed.data.parentId })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, message: "Kategori taşınamadı." };

  await recordAudit(supabase, user.id, {
    eventType: "category.moved",
    entityType: "category",
    entityId: data.id,
    metadata: { parentId: parsed.data.parentId }
  });
  revalidateCategoryPaths();
  return { ok: true, message: "Kategori taşındı." };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Kategori bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "category:delete"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const { error } = await supabase.from("categories").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, message: "Kategori silinemedi." };

  await recordAudit(supabase, user.id, { eventType: "category.deleted", entityType: "category", entityId: parsed.data });
  revalidateCategoryPaths();
  return { ok: true, message: "Kategori silindi." };
}

export async function createTagAction(input: TagInput): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Etiket bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "tag:create"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const { data, error } = await supabase.from("tags").insert({ user_id: user.id, name: parsed.data.name }).select("id").single();
  if (error) return { ok: false, message: "Etiket oluşturulamadı. Aynı isim zaten kullanılıyor olabilir." };

  await recordAudit(supabase, user.id, { eventType: "tag.created", entityType: "tag", entityId: data.id });
  revalidateTagPaths();
  return { ok: true, message: "Etiket oluşturuldu." };
}

export async function updateTagAction(input: TagInput): Promise<ActionResult> {
  const parsed = tagSchema.extend({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Etiket bilgilerini kontrol et." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "tag:update"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const { error } = await supabase.from("tags").update({ name: parsed.data.name }).eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Etiket güncellenemedi." };

  await recordAudit(supabase, user.id, { eventType: "tag.updated", entityType: "tag", entityId: parsed.data.id });
  revalidateTagPaths();
  return { ok: true, message: "Etiket güncellendi." };
}

export async function deleteTagAction(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Etiket bulunamadı." };
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  try {
    await enforceRateLimit("mutation", [user.id, "tag:delete"]);
  } catch (error) {
    if (error instanceof RateLimitError) return mutationLimitMessage();
    throw error;
  }

  const { error } = await supabase.from("tags").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, message: "Etiket silinemedi." };

  await recordAudit(supabase, user.id, { eventType: "tag.deleted", entityType: "tag", entityId: parsed.data });
  revalidateTagPaths();
  return { ok: true, message: "Etiket silindi." };
}
