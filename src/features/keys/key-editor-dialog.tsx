"use client";

import { useEffect, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { createKeyAction, createKeysAction, updateKeyAction } from "@/features/keys/actions";
import { buildCategoryTree, flattenCategoryTree } from "@/features/keys/category-tree";
import type { VaultCategory, VaultKey, VaultTag } from "@/features/keys/types";
import { categoryColorTone, statusLabels } from "@/features/keys/constants";
import { keyStatuses } from "@/lib/validations/domain";
import type { KeyStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { PlatformLogo } from "@/components/platform-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const keyFormSchema = z.object({
  title: z.string().min(1, "Başlık gerekli.").max(120),
  rawKey: z.string().max(12000),
  platform: z.string().min(1, "Tür / platform gerekli.").max(60),
  status: z.enum(keyStatuses),
  categoryId: z.string(),
  tagIds: z.array(z.string()),
  source: z.string().max(120),
  notes: z.string().max(1000),
  expiresAt: z.string()
});

type KeyFormValues = z.infer<typeof keyFormSchema>;

const platformGroups = [
  { label: "Genel", options: ["Dijital key", "Lisans anahtarı", "API key", "Kupon kodu", "Hediye kartı", "Seri numarası"] },
  { label: "Oyun", options: ["Steam", "Epic Games", "GOG", "PlayStation", "Xbox", "Nintendo", "Itch.io", "Battle.net", "Ubisoft Connect", "EA app", "Rockstar Games", "Riot Games"] },
  { label: "Yazılım", options: ["Microsoft", "Windows", "Office", "Adobe", "JetBrains", "Autodesk", "Canva", "Figma", "Notion", "Slack", "Discord"] },
  { label: "Geliştirici / API", options: ["OpenAI", "Anthropic", "GitHub", "GitLab", "Docker", "npm", "Stripe", "Twilio", "SendGrid", "Mailgun", "Resend"] },
  { label: "Cloud / hosting", options: ["AWS", "Azure", "Google Cloud", "Cloudflare", "Vercel", "Netlify", "Supabase", "Firebase", "DigitalOcean", "Heroku"] },
  { label: "Güvenlik / abonelik", options: ["1Password", "Bitwarden", "NordVPN", "Proton", "Apple", "Google Play", "Amazon", "Spotify", "Netflix", "YouTube"] }
];
const platformOptions = platformGroups.flatMap((group) => group.options);
const knownPlatformValues = new Set(platformOptions);

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function parseRawKeys(value: string) {
  const seen = new Set<string>();

  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const normalized = item.toUpperCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function defaultsFor(key: VaultKey | null, initialCategoryId: string | null): KeyFormValues {
  return {
    title: key?.title ?? "",
    rawKey: "",
    platform: key?.platform ?? "Dijital key",
    status: key?.status ?? "available",
    categoryId: key?.categoryId ?? initialCategoryId ?? "",
    tagIds: key?.tags.map((tag) => tag.id) ?? [],
    source: key?.source ?? "",
    notes: key?.notes ?? "",
    expiresAt: dateInputValue(key?.expiresAt ?? null)
  };
}

export function KeyEditorDialog({
  open,
  onOpenChange,
  keyRecord,
  initialCategoryId = null,
  categories,
  tags,
  locale = "tr"
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyRecord: VaultKey | null;
  initialCategoryId?: string | null;
  categories: VaultCategory[];
  tags: VaultTag[];
  locale?: "tr" | "en";
}) {
  const labels = locale === "en"
    ? { editTitle: "Edit key/code", createTitle: "Add new key/code", description: "The raw key/code is sent to the server only during this action, encrypted with AES-GCM, and never stored as plain text.", title: "Title", titlePlaceholder: "OpenAI API credit, Windows license, discount coupon", raw: "Key / code", emptyRaw: "Leave blank if you do not want to change it", rawHelpEdit: "List view only shows the mask.", rawHelpPaste: "You can paste multiple keys or codes on separate lines.", platform: "Type / platform", custom: "Custom", customPlatform: "Custom platform", platformName: "Platform name", status: "Status", category: "Category", noCategory: "No category / root", expires: "Expiration", source: "Source", sourcePlaceholder: "Purchase source, customer, campaign", notes: "Notes", notesPlaceholder: "Activation, usage, or delivery notes", tags: "Tags", noTags: "No tags yet. You can add them quickly from the tags area.", cancel: "Cancel", update: "Update", save: "Save" }
    : { editTitle: "Key/kod düzenle", createTitle: "Yeni key/kod ekle", description: "Ham key/kod yalnızca bu işlem sırasında sunucuya gider, AES-GCM ile şifrelenir ve düz metin olarak saklanmaz.", title: "Başlık", titlePlaceholder: "OpenAI API kredisi, Windows lisansı, indirim kuponu", raw: "Key / kod", emptyRaw: "Değiştirmeyeceksen boş bırak", rawHelpEdit: "Liste görünümü sadece maskeyi gösterir.", rawHelpPaste: "Birden fazla keyi veya kodu alt alta yapıştırabilirsin.", platform: "Tür / platform", custom: "Özel", customPlatform: "Özel platform", platformName: "Platform adı", status: "Durum", category: "Kategori", noCategory: "Kategorisiz / en dış", expires: "Son kullanım", source: "Kaynak", sourcePlaceholder: "Satın alma yeri, müşteri, kampanya", notes: "Not", notesPlaceholder: "Aktivasyon, kullanım veya teslim notları", tags: "Etiketler", noTags: "Henüz etiket yok. Etiketler sayfasından hızlıca ekleyebilirsin.", cancel: "Vazgeç", update: "Güncelle", save: "Kaydet" };
  const [isPending, startTransition] = useTransition();
  const form = useForm<KeyFormValues>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: defaultsFor(keyRecord, initialCategoryId)
  });
  const selectedTags = useWatch({ control: form.control, name: "tagIds" }) ?? [];
  const rawKeyValue = useWatch({ control: form.control, name: "rawKey" }) ?? "";
  const selectedPlatform = useWatch({ control: form.control, name: "platform" }) ?? "";
  const isEditing = Boolean(keyRecord);
  const categoryOptions = flattenCategoryTree(buildCategoryTree(categories));
  const parsedRawKeys = parseRawKeys(rawKeyValue);
  const usesCustomPlatform = !knownPlatformValues.has(selectedPlatform);

  useEffect(() => {
    if (open) form.reset(defaultsFor(keyRecord, initialCategoryId));
  }, [form, initialCategoryId, keyRecord, open]);

  function toggleTag(tagId: string) {
    const current = form.getValues("tagIds") ?? [];
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    form.setValue("tagIds", next, { shouldDirty: true });
  }

  function onSubmit(values: KeyFormValues) {
    const rawKeys = parseRawKeys(values.rawKey);

    if (isEditing && rawKeys.length > 1) {
      form.setError("rawKey", { message: "Düzenlerken tek key/kod girilebilir." });
      return;
    }

    if (!isEditing && rawKeys.length === 0) {
      form.setError("rawKey", { message: "Key/kod gerekli." });
      return;
    }

    if (!isEditing && rawKeys.some((rawKey) => rawKey.length < 8)) {
      form.setError("rawKey", { message: "Key/kod en az 8 karakter olmalı." });
      return;
    }

    if (rawKeys.some((rawKey) => rawKey.length > 256)) {
      form.setError("rawKey", { message: "Her key/kod en fazla 256 karakter olabilir." });
      return;
    }

    if (!isEditing && rawKeys.length > 100) {
      form.setError("rawKey", { message: "Tek seferde en fazla 100 key/kod eklenebilir." });
      return;
    }

    startTransition(async () => {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        source: values.source || undefined,
        notes: values.notes || undefined,
        expiresAt: values.expiresAt || null
      };

      const result = keyRecord
        ? await updateKeyAction({ ...payload, id: keyRecord.id, rawKey: rawKeys[0] || undefined })
        : rawKeys.length > 1
          ? await createKeysAction({ ...payload, rawKeys })
          : await createKeyAction({ ...payload, rawKey: rawKeys[0] });

      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-4xl">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="border-b border-border bg-popover p-5">
            <DialogHeader>
              <DialogTitle>{isEditing ? labels.editTitle : labels.createTitle}</DialogTitle>
              <DialogDescription>
                {labels.description}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">{labels.title}</Label>
                <Input id="title" placeholder={labels.titlePlaceholder} {...form.register("title")} />
                <p className="text-xs text-destructive">{form.formState.errors.title?.message}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rawKey">{labels.raw}</Label>
                <Textarea
                  id="rawKey"
                  placeholder={isEditing ? labels.emptyRaw : "AAAAA-BBBBB-CCCCC\nDDDDD-EEEEE-FFFFF"}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-24 font-mono"
                  {...form.register("rawKey")}
                />
                <p className="text-xs text-muted-foreground">
                  {isEditing
                    ? labels.rawHelpEdit
                    : parsedRawKeys.length > 1
                      ? `${parsedRawKeys.length} key/kod algılandı. Hepsi aynı başlık, kategori ve etiketlerle kaydedilir.`
                      : labels.rawHelpPaste}
                </p>
                <p className="text-xs text-destructive">{form.formState.errors.rawKey?.message}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{labels.platform}</Label>
                <input type="hidden" {...form.register("platform")} />
                <div className="space-y-3 rounded-md border border-border bg-background/40 p-3">
                  {platformGroups.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">{group.label}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {group.options.map((platform) => {
                          const active = selectedPlatform === platform;
                          return (
                            <button
                              key={platform}
                              type="button"
                              aria-pressed={active}
                              onClick={() => form.setValue("platform", platform, { shouldDirty: true, shouldValidate: true })}
                              className={cn(
                                "flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-left text-sm transition-colors hover:border-ring/55 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "border-primary/45 bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                              )}
                            >
                              <PlatformLogo platform={platform} className="size-6 shrink-0 rounded-sm" />
                              <span className="truncate font-medium">{platform}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={usesCustomPlatform}
                    onClick={() => form.setValue("platform", usesCustomPlatform ? "Dijital key" : "Diğer", { shouldDirty: true, shouldValidate: true })}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition-colors hover:border-ring/55 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      usesCustomPlatform ? "border-primary/45 bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    <PlatformLogo platform={usesCustomPlatform ? selectedPlatform : "other"} className="size-5 rounded-sm" />
                    {labels.custom}
                  </button>
                  {usesCustomPlatform ? (
                    <Input
                      aria-label="{labels.custom} platform"
                      value={selectedPlatform}
                      onChange={(event) => form.setValue("platform", event.target.value, { shouldDirty: true, shouldValidate: true })}
                      placeholder={labels.platformName}
                      className="h-9"
                    />
                  ) : null}
                </div>
                <p className="text-xs text-destructive">{form.formState.errors.platform?.message}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{labels.status}</Label>
                <select
                  id="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-ring/55 focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register("status")}
                >
                  {keyStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status as KeyStatus]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">{labels.category}</Label>
                <select
                  id="categoryId"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-ring/55 focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register("categoryId")}
                >
                  <option value="">{labels.noCategory}</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {`${"  ".repeat(category.depth)}${category.depth > 0 ? "- " : ""}${category.name}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">{labels.expires}</Label>
                <Input id="expiresAt" type="date" {...form.register("expiresAt")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="source">{labels.source}</Label>
                <Input id="source" placeholder={labels.sourcePlaceholder} {...form.register("source")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">{labels.notes}</Label>
                <Textarea id="notes" placeholder={labels.notesPlaceholder} {...form.register("notes")} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{labels.tags}</Label>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                          active ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {labels.noTags}
                </p>
              )}
            </div>

            {categoryOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {categoryOptions.slice(0, 5).map((category) => (
                  <Badge key={category.id} variant="outline" className="gap-1.5">
                    <span className={cn("size-2 rounded-sm", categoryColorTone[category.color])} />
                    {category.depth > 0 ? `${"/ ".repeat(category.depth)}${category.name}` : category.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border bg-popover p-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {isEditing ? labels.update : labels.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
