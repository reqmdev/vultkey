import { z } from "zod";
import { sanitizeMultiline, sanitizeOptionalText, sanitizeText } from "@/lib/security/sanitize";

export const categoryColors = ["slate", "violet", "blue", "emerald", "amber", "rose", "cyan"] as const;
export const keyStatuses = ["available", "reserved", "redeemed", "archived"] as const;

const nullableUuid = z.union([z.string().uuid(), z.literal(""), z.null(), z.undefined()]).transform((value) => value || null);
const tagIds = z.array(z.string().uuid()).max(12, "En fazla 12 etiket seçilebilir.").default([]);
const nullableDateTime = z.union([z.string(), z.null(), z.undefined()]).transform((value, ctx) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;

  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tarih geçerli değil." });
    return z.NEVER;
  }

  return new Date(timestamp).toISOString();
});

export const idSchema = z.string().uuid();
export const publicTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/, "Bağlantı geçersiz.");

export const categorySchema = z.object({
  id: idSchema.optional(),
  parentId: nullableUuid,
  name: z.string().min(1, "Kategori adı gerekli.").max(80).transform((value) => sanitizeText(value, 80)),
  color: z.enum(categoryColors).default("slate"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0)
});

export const moveCategorySchema = z.object({
  id: idSchema,
  parentId: nullableUuid
});

export const tagSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Etiket adı gerekli.").max(48).transform((value) => sanitizeText(value, 48))
});

export const createKeySchema = z.object({
  title: z.string().min(1, "Başlık gerekli.").max(120).transform((value) => sanitizeText(value, 120)),
  rawKey: z.string().min(8, "Key/kod çok kısa.").max(256, "Key/kod çok uzun.").transform((value) => sanitizeText(value, 256)),
  platform: z.string().min(1).max(60).default("Dijital key").transform((value) => sanitizeText(value, 60)),
  status: z.enum(keyStatuses).default("available"),
  categoryId: nullableUuid,
  tagIds,
  source: z.string().max(120).optional().transform((value) => sanitizeOptionalText(value, 120)),
  notes: z.string().max(1000).optional().transform((value) => sanitizeMultiline(value, 1000)),
  expiresAt: nullableDateTime
});

export const bulkCreateKeySchema = createKeySchema.omit({ rawKey: true }).extend({
  rawKeys: z
    .array(z.string().min(8, "Key/kod çok kısa.").max(256, "Key/kod çok uzun.").transform((value) => sanitizeText(value, 256)))
    .min(1, "En az bir key/kod gerekli.")
    .max(100, "Tek seferde en fazla 100 key/kod eklenebilir.")
});

export const updateKeySchema = createKeySchema
  .omit({ rawKey: true })
  .extend({
    id: idSchema,
    rawKey: z.string().max(256, "Key/kod çok uzun.").optional().transform((value) => (value ? sanitizeText(value, 256) : null))
  });

export const moveKeySchema = z.object({
  id: idSchema,
  categoryId: nullableUuid
});

const emailList = z
  .array(z.string().email().max(254).transform((value) => value.trim().toLowerCase()))
  .max(100, "En fazla 100 e-posta eklenebilir.")
  .default([])
  .transform((value) => Array.from(new Set(value)));

export const publicKeyLinkSchema = z
  .object({
    targetType: z.enum(["single", "category"]),
    viewMode: z.enum(["single", "drop", "list"]).default("single"),
    keyId: nullableUuid,
    categoryId: nullableUuid,
    accessMode: z.enum(["anyone", "email_allowlist", "member_allowlist"]).default("anyone"),
    requireEmailVerification: z.coerce.boolean().default(false),
    allowedEmails: emailList,
    title: z.string().max(120).optional().transform((value) => sanitizeOptionalText(value, 120)),
    message: z.string().max(500).optional().transform((value) => sanitizeMultiline(value, 500)),
    expiresAt: nullableDateTime,
    maxClaims: z.coerce.number().int().min(1).max(1000).default(1),
    includeSubcategories: z.coerce.boolean().default(false),
    visibility: z
      .object({
        showTitle: z.coerce.boolean().default(true),
        showPlatform: z.coerce.boolean().default(true),
        showMask: z.coerce.boolean().default(true),
        showCategory: z.coerce.boolean().default(true),
        showTags: z.coerce.boolean().default(true),
        showStatus: z.coerce.boolean().default(true),
        showExpiresAt: z.coerce.boolean().default(true),
        showNotes: z.coerce.boolean().default(false),
        showSource: z.coerce.boolean().default(false)
      })
      .default({
        showTitle: true,
        showPlatform: true,
        showMask: true,
        showCategory: true,
        showTags: true,
        showStatus: true,
        showExpiresAt: true,
        showNotes: false,
        showSource: false
      }),
    permissions: z
      .object({
        canViewList: z.coerce.boolean().default(true),
        canReserve: z.coerce.boolean().default(true),
        canRevealAfterReserve: z.coerce.boolean().default(true),
        canConfirmRedeemed: z.coerce.boolean().default(true),
        canCopy: z.coerce.boolean().default(true),
        showUnavailable: z.coerce.boolean().default(false),
        maxClaimsPerRecipient: z.coerce.number().int().min(0).max(1000).default(1)
      })
      .default({
        canViewList: true,
        canReserve: true,
        canRevealAfterReserve: true,
        canConfirmRedeemed: true,
        canCopy: true,
        showUnavailable: false,
        maxClaimsPerRecipient: 1
      })
  })
  .superRefine((value, ctx) => {
    if (value.targetType === "single" && !value.keyId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["keyId"], message: "Kod seçilmeli." });
    }
    if (value.targetType === "category" && !value.categoryId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryId"], message: "Kategori seçilmeli." });
    }
    if ((value.accessMode === "email_allowlist" || value.accessMode === "member_allowlist") && value.allowedEmails.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedEmails"], message: "En az bir e-posta eklenmeli." });
    }
    if (value.viewMode === "single" && value.targetType !== "single") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["viewMode"], message: "Tek kod görünümü tek kod hedefi ister." });
    }
  });

const clientFingerprintSchema = z
  .object({
    timezone: z.string().max(80).optional(),
    language: z.string().max(80).optional(),
    languages: z.array(z.string().max(80)).max(12).optional(),
    platform: z.string().max(120).optional(),
    userAgentDataPlatform: z.string().max(120).optional(),
    userAgentDataMobile: z.boolean().optional(),
    browserBrands: z.array(z.object({ brand: z.string().max(80), version: z.string().max(30) })).max(12).optional(),
    cookieEnabled: z.boolean().optional(),
    doNotTrack: z.string().max(20).nullable().optional(),
    hardwareConcurrency: z.number().min(0).max(256).optional(),
    deviceMemory: z.number().min(0).max(1024).optional(),
    maxTouchPoints: z.number().min(0).max(64).optional(),
    screenWidth: z.number().min(0).max(20000).optional(),
    screenHeight: z.number().min(0).max(20000).optional(),
    availWidth: z.number().min(0).max(20000).optional(),
    availHeight: z.number().min(0).max(20000).optional(),
    colorDepth: z.number().min(0).max(128).optional(),
    pixelDepth: z.number().min(0).max(128).optional(),
    pixelRatio: z.number().min(0).max(20).optional(),
    viewportWidth: z.number().min(0).max(20000).optional(),
    viewportHeight: z.number().min(0).max(20000).optional(),
    touch: z.boolean().optional(),
    brave: z.boolean().optional()
  })
  .optional();

export const publicRecipientCheckSchema = z.object({
  token: publicTokenSchema,
  recipientEmail: z.union([z.string().email().max(254), z.literal(""), z.null(), z.undefined()]).transform((value) => (value ? value.trim().toLowerCase() : null)),
  clientFingerprint: clientFingerprintSchema
});

export const publicReserveSchema = publicRecipientCheckSchema.extend({
  keyId: nullableUuid,
  recipientLabel: z.string().max(80).optional().transform((value) => sanitizeOptionalText(value, 80))
});

export const publicRedeemSchema = z.object({
  claimToken: publicTokenSchema
});

export const keyStatusUpdateSchema = z.object({
  id: idSchema,
  status: z.enum(keyStatuses)
});

export type CategoryInput = z.input<typeof categorySchema>;
export type MoveCategoryInput = z.input<typeof moveCategorySchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type CreateKeyInput = z.input<typeof createKeySchema>;
export type BulkCreateKeyInput = z.input<typeof bulkCreateKeySchema>;
export type UpdateKeyInput = z.input<typeof updateKeySchema>;
export type MoveKeyInput = z.input<typeof moveKeySchema>;
export type PublicKeyLinkInput = z.input<typeof publicKeyLinkSchema>;
export type PublicRecipientCheckInput = z.input<typeof publicRecipientCheckSchema>;
export type PublicReserveInput = z.input<typeof publicReserveSchema>;
export type PublicRedeemInput = z.input<typeof publicRedeemSchema>;
export type KeyStatusUpdateInput = z.input<typeof keyStatusUpdateSchema>;
