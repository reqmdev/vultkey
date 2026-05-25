"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Copy, ExternalLink, Eye, Globe2, Hash, KeyRound, ListTree, Loader2, Mail, MailCheck, PackageOpen, Send, ShieldCheck, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PlatformLogo } from "@/components/platform-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildCategoryTree, flattenCategoryTree, getCategoryDescendantIds } from "@/features/keys/category-tree";
import type { VaultCategory, VaultKey } from "@/features/keys/types";
import { createPublicKeyLinkAction } from "@/features/public-links/actions";
import { cn } from "@/lib/utils";

type VisibilityConfig = {
  showTitle: boolean;
  showPlatform: boolean;
  showMask: boolean;
  showCategory: boolean;
  showTags: boolean;
  showStatus: boolean;
  showExpiresAt: boolean;
  showNotes: boolean;
  showSource: boolean;
};

type PermissionConfig = {
  canViewList: boolean;
  canReserve: boolean;
  canRevealAfterReserve: boolean;
  canConfirmRedeemed: boolean;
  canCopy: boolean;
  showUnavailable: boolean;
  maxClaimsPerRecipient: number;
};

const defaultVisibility: VisibilityConfig = {
  showTitle: true,
  showPlatform: true,
  showMask: true,
  showCategory: true,
  showTags: true,
  showStatus: true,
  showExpiresAt: true,
  showNotes: false,
  showSource: false
};

const defaultPermissions: PermissionConfig = {
  canViewList: true,
  canReserve: true,
  canRevealAfterReserve: true,
  canConfirmRedeemed: true,
  canCopy: true,
  showUnavailable: false,
  maxClaimsPerRecipient: 1
};

function parseEmails(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function clampMaxClaimsDefault(count: number) {
  return Math.min(1000, Math.max(1, count));
}

function Toggle({ checked, onChange, label, description, icon: Icon }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; icon?: LucideIcon }) {
  return (
    <label className="flex min-h-9 items-start gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm transition-colors hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" />
      {Icon ? <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : null}
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-4 text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

export function PublishLinkDialog({
  open,
  onOpenChange,
  keyRecord,
  initialCategoryId = null,
  categories,
  keys
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyRecord: VaultKey | null;
  initialCategoryId?: string | null;
  categories: VaultCategory[];
  keys: VaultKey[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<"single" | "category">("single");
  const [viewMode, setViewMode] = useState<"single" | "drop" | "list">("single");
  const [categoryId, setCategoryId] = useState("");
  const [accessMode, setAccessMode] = useState<"anyone" | "email_allowlist" | "member_allowlist">("anyone");
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClaims, setMaxClaims] = useState(10);
  const [maxClaimsTouched, setMaxClaimsTouched] = useState(false);
  const [includeSubcategories, setIncludeSubcategories] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityConfig>(defaultVisibility);
  const [permissions, setPermissions] = useState<PermissionConfig>(defaultPermissions);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const categoryAvailability = useMemo(() => {
    const counts = new Map<string, { direct: number; total: number }>();

    categories.forEach((category) => {
      const descendantIds = getCategoryDescendantIds(categories, category.id);
      let direct = 0;
      let total = 0;

      keys.forEach((key) => {
        if (key.status !== "available" || !key.categoryId) return;
        if (key.categoryId === category.id) direct += 1;
        if (descendantIds.has(key.categoryId)) total += 1;
      });

      counts.set(category.id, { direct, total });
    });

    return counts;
  }, [categories, keys]);
  const categoryOptions = useMemo(() => flattenCategoryTree(buildCategoryTree(categories)), [categories]);
  const selectedCategory = useMemo(() => categoryOptions.find((category) => category.id === categoryId) ?? null, [categoryId, categoryOptions]);
  const accessRule = accessMode === "member_allowlist" ? "member" : accessMode === "email_allowlist" ? "allowlist" : requireEmailVerification ? "email" : "url";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const nextTargetType = keyRecord ? "single" : "category";
      setTargetType(nextTargetType);
      setViewMode(keyRecord ? "single" : "list");
      const nextCategoryId = keyRecord?.categoryId ?? initialCategoryId ?? categoryOptions[0]?.id ?? "";
      const nextCategory = categoryOptions.find((category) => category.id === nextCategoryId) ?? null;
      const nextIncludeSubcategories = Boolean(nextCategory?.children.length);
      const nextCategoryAvailability = categoryAvailability.get(nextCategoryId);
      setCategoryId(nextCategoryId);
      setAccessMode("anyone");
      setRequireEmailVerification(false);
      setAllowedEmails("");
      setTitle(keyRecord?.title ?? nextCategory?.name ?? "");
      setMessage("");
      setExpiresAt("");
      setMaxClaims(nextTargetType === "single" ? 1 : clampMaxClaimsDefault(nextIncludeSubcategories ? (nextCategoryAvailability?.total ?? 0) : (nextCategoryAvailability?.direct ?? 0)));
      setMaxClaimsTouched(false);
      setIncludeSubcategories(nextIncludeSubcategories);
      setVisibility(defaultVisibility);
      setPermissions(defaultPermissions);
      setCreatedUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryAvailability, categoryOptions, initialCategoryId, keyRecord, open]);

  function updateVisibility(key: keyof VisibilityConfig, checked: boolean) {
    setVisibility((current) => ({ ...current, [key]: checked }));
  }

  function updatePermission(key: keyof PermissionConfig, checked: boolean) {
    setPermissions((current) => ({ ...current, [key]: checked }));
  }

  function selectTarget(nextTargetType: "single" | "category", nextViewMode: "single" | "drop" | "list") {
    if (nextTargetType === "single" && !keyRecord) return;
    setTargetType(nextTargetType);
    setViewMode(nextViewMode);
    if (nextTargetType === "category" && categoryId && !maxClaimsTouched) {
      const counts = categoryAvailability.get(categoryId);
      setMaxClaims(clampMaxClaimsDefault(includeSubcategories ? (counts?.total ?? 0) : (counts?.direct ?? 0)));
    }
  }

  function selectAccessRule(rule: "url" | "email" | "allowlist" | "member") {
    if (rule === "url") {
      setAccessMode("anyone");
      setRequireEmailVerification(false);
      return;
    }

    if (rule === "email") {
      setAccessMode("anyone");
      setRequireEmailVerification(true);
      return;
    }

    if (rule === "allowlist") {
      setAccessMode("email_allowlist");
      setRequireEmailVerification(true);
      return;
    }

    setAccessMode("member_allowlist");
    setRequireEmailVerification(false);
  }

  function pickCategory(nextCategory: (typeof categoryOptions)[number]) {
    const previousName = selectedCategory?.name ?? "";
    const nextIncludeSubcategories = nextCategory.children.length > 0;
    setCategoryId(nextCategory.id);
    setIncludeSubcategories(nextIncludeSubcategories);
    if (!maxClaimsTouched) {
      const counts = categoryAvailability.get(nextCategory.id);
      setMaxClaims(clampMaxClaimsDefault(nextIncludeSubcategories ? (counts?.total ?? 0) : (counts?.direct ?? 0)));
    }
    setTitle((current) => (current.trim().length === 0 || current === previousName ? nextCategory.name : current));
  }

  function updateIncludeSubcategories(checked: boolean) {
    setIncludeSubcategories(checked);
    if (!maxClaimsTouched && categoryId) {
      const counts = categoryAvailability.get(categoryId);
      setMaxClaims(clampMaxClaimsDefault(checked ? (counts?.total ?? 0) : (counts?.direct ?? 0)));
    }
  }

  function createLink() {
    startTransition(async () => {
      const result = await createPublicKeyLinkAction({
        targetType,
        viewMode,
        keyId: targetType === "single" ? keyRecord?.id : null,
        categoryId: targetType === "category" ? categoryId : null,
        accessMode,
        requireEmailVerification,
        allowedEmails: parseEmails(allowedEmails),
        title,
        message,
        expiresAt,
        maxClaims: targetType === "single" ? 1 : maxClaims,
        includeSubcategories,
        visibility,
        permissions
      });

      if (result.ok && result.url) {
        setCreatedUrl(result.url);
        router.refresh();
        try {
          await navigator.clipboard.writeText(result.url);
          toast.success("Yayın linki oluşturuldu ve kopyalandı.");
        } catch {
          toast.success(result.message);
        }
      } else {
        toast.error(result.message);
      }
    });
  }

  async function copyUrl() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      toast.success("Yayın linki kopyalandı.");
    } catch {
      toast.error("Pano erişimi başarısız oldu.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-5xl">
        <div className="border-b border-border bg-popover p-5">
          <DialogHeader>
            <DialogTitle>Yayın linki oluştur</DialogTitle>
            <DialogDescription>Link tipi, erişim ve alıcının göreceği alanları buradan ayarla.</DialogDescription>
          </DialogHeader>
        </div>

        {createdUrl ? (
          <div className="border-b border-border bg-background p-4">
            <Label htmlFor="created-public-link">Hazır link</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input id="created-public-link" value={createdUrl} readOnly className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={copyUrl}>
                <Copy className="size-4" />
                Kopyala
              </Button>
              <Button asChild variant="outline">
                <a href={createdUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Aç
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-5 border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-r">
            <section className="space-y-2">
              <SectionTitle icon={SlidersHorizontal} title="Link tipi" detail={viewMode === "single" ? "Tek kayıt" : viewMode === "drop" ? "Sıradaki kayıt" : "Liste"} />
              <div className="space-y-1.5">
                <ModeButton icon={KeyRound} active={viewMode === "single"} disabled={!keyRecord} title="Tek kod" text="Bir kaydı paylaşır." onClick={() => selectTarget("single", "single")} compact>
                  {keyRecord ? (
                    <span className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
                      <PlatformLogo platform={keyRecord.platform} className="size-5 rounded-sm" />
                      <span className="truncate">{keyRecord.title}</span>
                    </span>
                  ) : null}
                </ModeButton>
                <ModeButton icon={PackageOpen} active={viewMode === "drop"} title="Drop" text="Sıradaki uygun kodu verir." onClick={() => selectTarget("category", "drop")} compact />
                <ModeButton icon={ListTree} active={viewMode === "list"} title="Liste" text="Kanal listesi gibi gösterir." onClick={() => selectTarget("category", "list")} compact />
              </div>
            </section>

            <section className="space-y-2">
              <SectionTitle icon={ShieldCheck} title="Erişim" detail={accessRule === "url" ? "URL yeter" : accessRule === "email" ? "E-posta ister" : accessRule === "member" ? "Vultkey üyesi" : "Allowlist"} />
              <div className="space-y-1.5">
                <ModeButton icon={Globe2} active={accessRule === "url"} title="Sadece URL yeter" text="Linki açan devam eder." onClick={() => selectAccessRule("url")} compact />
                <ModeButton icon={Mail} active={accessRule === "email"} title="E-posta yazsın" text="Kod alırken e-posta ister." onClick={() => selectAccessRule("email")} compact />
                <ModeButton icon={MailCheck} active={accessRule === "allowlist"} title="Özel e-postalar" text="Sadece listedekiler geçer." onClick={() => selectAccessRule("allowlist")} compact />
                <ModeButton icon={UserRound} active={accessRule === "member"} title="Vultkey üyeleri" text="Giriş yapmış seçili üyeler geçer." onClick={() => selectAccessRule("member")} compact />
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle icon={Hash} title="Limitler" />
              <div className="space-y-2">
                <div className="space-y-2">
                  <IconLabel icon={Clock3} htmlFor="publish-expires">Süre sonu</IconLabel>
                  <Input id="publish-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <IconLabel icon={PackageOpen} htmlFor="publish-max">Maksimum alma</IconLabel>
                  <Input
                    id="publish-max"
                    type="number"
                    min={1}
                    max={1000}
                    disabled={targetType === "single"}
                    value={targetType === "single" ? 1 : maxClaims}
                    onChange={(event) => {
                      setMaxClaimsTouched(true);
                      setMaxClaims(Number(event.target.value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <IconLabel icon={Mail} htmlFor="publish-per-recipient">Kişi/cihaz/oturum başına</IconLabel>
                  <Input id="publish-per-recipient" type="number" min={0} max={1000} value={permissions.maxClaimsPerRecipient} onChange={(event) => setPermissions((current) => ({ ...current, maxClaimsPerRecipient: Number(event.target.value) }))} />
                  <p className="text-xs leading-5 text-muted-foreground">E-posta değişse bile aynı cihaz veya oturum tekrar sınıra takılır.</p>
                </div>
              </div>
            </section>
          </aside>

          <div className="space-y-5 p-5">
            <section className="space-y-3">
              <SectionTitle icon={ListTree} title="Hedef ve metin" detail={targetType === "category" ? "Kategori yayını" : "Tek kod"} />
              {targetType === "category" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <IconLabel icon={ListTree}>Kategori</IconLabel>
                    {selectedCategory ? <span className="truncate text-xs text-muted-foreground">{selectedCategory.totalKeyCount} kod</span> : null}
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-background p-1">
                    {categoryOptions.length > 0 ? (
                      categoryOptions.map((category) => {
                        const active = category.id === categoryId;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => pickCategory(category)}
                            style={{ paddingLeft: 10 + category.depth * 18 }}
                            className={cn(
                              "flex h-9 w-full items-center justify-between gap-3 rounded px-2 text-left text-sm transition-colors",
                              active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            <span className="truncate font-medium">{category.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{category.totalKeyCount}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded border border-dashed border-border p-3 text-sm text-muted-foreground">Önce kasa ekranında kategori ekle.</div>
                    )}
                  </div>
                  <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground">
                    <input type="checkbox" checked={includeSubcategories} onChange={(event) => updateIncludeSubcategories(event.target.checked)} />
                    Alt kategorileri dahil et
                  </label>
                </div>
              ) : null}
              <div className="space-y-2">
                <IconLabel icon={KeyRound} htmlFor="publish-title">Başlık</IconLabel>
                <Input id="publish-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Link başlığı" />
              </div>
              <div className="space-y-2">
                <IconLabel icon={Mail} htmlFor="publish-message">Mesaj</IconLabel>
                <Textarea id="publish-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Alıcının göreceği kısa not" className="min-h-20" />
              </div>
              {accessMode === "email_allowlist" || accessMode === "member_allowlist" ? (
                <div className="space-y-2">
                  <IconLabel icon={accessMode === "member_allowlist" ? UserRound : MailCheck} htmlFor="publish-emails">{accessMode === "member_allowlist" ? "Vultkey üye e-postaları" : "İzinli e-postalar"}</IconLabel>
                  <Textarea id="publish-emails" value={allowedEmails} onChange={(event) => setAllowedEmails(event.target.value)} placeholder="mail@example.com, ikinci@example.com" className="min-h-20" />
                  {accessMode === "member_allowlist" ? <p className="text-xs leading-5 text-muted-foreground">Bu adreslerin Vultkey hesabı olmalı. Alıcı kod almak için giriş yapar.</p> : null}
                </div>
              ) : null}
            </section>

            <section className="space-y-3">
              <SectionTitle icon={ShieldCheck} title="Temel izinler" detail="Alıcının yapabilecekleri" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle icon={PackageOpen} checked={permissions.canReserve} onChange={(checked) => updatePermission("canReserve", checked)} label="Kod alabilsin" />
                <Toggle icon={Eye} checked={permissions.canRevealAfterReserve} onChange={(checked) => updatePermission("canRevealAfterReserve", checked)} label="Alınca raw kodu görsün" />
                <Toggle icon={ShieldCheck} checked={permissions.canConfirmRedeemed} onChange={(checked) => updatePermission("canConfirmRedeemed", checked)} label="Kullandım diye onaylasın" />
                <Toggle icon={Copy} checked={permissions.canCopy} onChange={(checked) => updatePermission("canCopy", checked)} label="Kopyala butonu görünsün" />
              </div>
            </section>

            <details className="rounded-md border border-border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Gösterilecek alanlar</summary>
              <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-3">
                <Toggle icon={KeyRound} checked={visibility.showTitle} onChange={(checked) => updateVisibility("showTitle", checked)} label="Başlık" />
                <Toggle icon={PackageOpen} checked={visibility.showPlatform} onChange={(checked) => updateVisibility("showPlatform", checked)} label="Platform" />
                <Toggle icon={Hash} checked={visibility.showMask} onChange={(checked) => updateVisibility("showMask", checked)} label="Maske" />
                <Toggle icon={ListTree} checked={visibility.showCategory} onChange={(checked) => updateVisibility("showCategory", checked)} label="Kategori" />
                <Toggle icon={Hash} checked={visibility.showTags} onChange={(checked) => updateVisibility("showTags", checked)} label="Etiketler" />
                <Toggle icon={ShieldCheck} checked={visibility.showStatus} onChange={(checked) => updateVisibility("showStatus", checked)} label="Durum" />
                <Toggle icon={Clock3} checked={visibility.showExpiresAt} onChange={(checked) => updateVisibility("showExpiresAt", checked)} label="Son kullanım" />
                <Toggle icon={Mail} checked={visibility.showNotes} onChange={(checked) => updateVisibility("showNotes", checked)} label="Not" />
                <Toggle icon={Globe2} checked={visibility.showSource} onChange={(checked) => updateVisibility("showSource", checked)} label="Kaynak" />
              </div>
            </details>

            <details className="rounded-md border border-border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Ek kurallar</summary>
              <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
                <Toggle icon={ListTree} checked={permissions.canViewList} onChange={(checked) => updatePermission("canViewList", checked)} label="Listeyi görsün" />
                <Toggle icon={Eye} checked={permissions.showUnavailable} onChange={(checked) => updatePermission("showUnavailable", checked)} label="Hazır olmayanları görsün" />
              </div>
            </details>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-popover p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button>
          <Button type="button" onClick={createLink} disabled={isPending || (targetType === "category" && !categoryId)}>
            {isPending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
            Link oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconLabel({ icon: Icon, htmlFor, children }: { icon: LucideIcon; htmlFor?: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </Label>
  );
}

function SectionTitle({ icon: Icon, title, detail }: { icon?: LucideIcon; title: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        {title}
      </p>
      {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  icon: Icon,
  title,
  text,
  onClick,
  children,
  compact = false
}: {
  active: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  title: string;
  text: string;
  onClick: () => void;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-md border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        compact ? "px-3 py-2" : "p-3",
        active ? "border-primary/45 bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted/50"
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {Icon ? (
          <span className={cn("flex shrink-0 items-center justify-center rounded-sm border", active ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground", compact ? "size-7" : "size-8")}>
            <Icon className="size-4" />
          </span>
        ) : null}
        <span>{title}</span>
      </span>
      <span className={cn("block text-xs leading-5", compact && Icon ? "mt-1 pl-9" : compact ? "mt-0.5" : "mt-2")}>{text}</span>
      {children}
    </button>
  );
}
