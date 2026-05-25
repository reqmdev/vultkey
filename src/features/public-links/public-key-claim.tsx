"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Copy, Hash, KeyRound, LockKeyhole, LogIn, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PlatformLogo } from "@/components/platform-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusLabels, statusTone } from "@/features/keys/constants";
import { checkPublicRecipientAccessAction, confirmPublicRedeemedAction, getPublicKeyLinkData, reservePublicKeyAction } from "@/features/public-links/actions";
import type { KeyStatus } from "@/types/database";
import { cn, formatDate } from "@/lib/utils";

type PublicLinkData = Awaited<ReturnType<typeof getPublicKeyLinkData>>;
type ActivePublicLinkData = Extract<PublicLinkData, { state: "active" }>;
type PublicKeyItem = ActivePublicLinkData["items"][number];
type StoredClaim = {
  claimToken: string;
  title: string | null;
  platform: string | null;
  canConfirmRedeemed: boolean;
  canCopySecret: boolean;
  redeemed: boolean;
};
type ClientClaimFingerprint = {
  timezone?: string;
  language?: string;
  languages?: string[];
  platform?: string;
  userAgentDataPlatform?: string;
  userAgentDataMobile?: boolean;
  browserBrands?: Array<{ brand: string; version: string }>;
  cookieEnabled?: boolean;
  doNotTrack?: string | null;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  screenWidth?: number;
  screenHeight?: number;
  availWidth?: number;
  availHeight?: number;
  colorDepth?: number;
  pixelDepth?: number;
  pixelRatio?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  touch?: boolean;
  brave?: boolean;
};
type PublicDetailField = {
  label: string;
  value: string;
  mono?: boolean;
};

function claimStorageKey(token: string) {
  return `vultkey:claim:${token}`;
}

function loadStoredClaim(token: string): StoredClaim | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(claimStorageKey(token));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredClaim>;
    if (!value.claimToken || typeof value.claimToken !== "string") return null;

    return {
      claimToken: value.claimToken,
      title: typeof value.title === "string" ? value.title : null,
      platform: typeof value.platform === "string" ? value.platform : null,
      canConfirmRedeemed: value.canConfirmRedeemed !== false,
      canCopySecret: value.canCopySecret !== false,
      redeemed: value.redeemed === true
    };
  } catch {
    return null;
  }
}

function storeClaim(token: string, claim: StoredClaim) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(claimStorageKey(token), JSON.stringify(claim));
  } catch {
    // Session storage is a convenience fallback; the in-memory state still works.
  }
}

function collectClientFingerprint(): ClientClaimFingerprint | undefined {
  if (typeof window === "undefined") return undefined;

  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    brave?: unknown;
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>;
      mobile?: boolean;
      platform?: string;
    };
  };
  const screen = window.screen;

  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: nav.language,
    languages: Array.from(nav.languages ?? []).slice(0, 12),
    platform: nav.platform,
    userAgentDataPlatform: nav.userAgentData?.platform,
    userAgentDataMobile: nav.userAgentData?.mobile,
    browserBrands: nav.userAgentData?.brands?.map((brand) => ({ brand: brand.brand, version: brand.version })).slice(0, 12),
    cookieEnabled: nav.cookieEnabled,
    doNotTrack: nav.doNotTrack,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
    screenWidth: screen.width,
    screenHeight: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    pixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    touch: "ontouchstart" in window || nav.maxTouchPoints > 0,
    brave: Boolean(nav.brave)
  };
}

function configBool(config: unknown, key: string, fallback: boolean) {
  if (!config || typeof config !== "object" || !(key in config)) return fallback;
  return Boolean((config as Record<string, unknown>)[key]);
}

function configNumber(config: unknown, key: string, fallback: number) {
  if (!config || typeof config !== "object" || !(key in config)) return fallback;
  const value = Number((config as Record<string, unknown>)[key]);
  return Number.isFinite(value) ? value : fallback;
}

function itemTitle(item: PublicKeyItem | null, fallback: string) {
  return item?.title || fallback;
}

function modeLabel(mode: ActivePublicLinkData["link"]["viewMode"]) {
  if (mode === "list") return "Seçerek al";
  if (mode === "drop") return "Sıradaki uygun kod";
  return "Tek kod";
}

function modeDescription(mode: ActivePublicLinkData["link"]["viewMode"], canViewList: boolean) {
  if (mode === "list") return canViewList ? "Listeden uygun kaydı seçebilirsin." : "Liste gizli, gönderici yalnızca alma izni verdi.";
  if (mode === "drop") return "Sistem sıradaki uygun kaydı verir.";
  return "Bu bağlantı tek bir kayıt için hazırlandı.";
}

function claimLabel(mode: ActivePublicLinkData["link"]["viewMode"], canRevealAfterReserve: boolean) {
  if (!canRevealAfterReserve) return "Alındı yap";
  if (mode === "drop") return "Sıradaki kodu al";
  return "Kodu al";
}

export function PublicKeyClaim({ token, data }: { token: string; data: PublicLinkData }) {
  const [checkedStoredClaim, setCheckedStoredClaim] = useState(false);
  const [checkedRecipientAccess, setCheckedRecipientAccess] = useState(data.state !== "active");
  const [recipientBlockMessage, setRecipientBlockMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [claimedTitle, setClaimedTitle] = useState<string | null>(null);
  const [claimedPlatform, setClaimedPlatform] = useState<string | null>(null);
  const [canConfirmRedeemed, setCanConfirmRedeemed] = useState(true);
  const [canCopySecret, setCanCopySecret] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedClaim = loadStoredClaim(token);
      if (storedClaim) {
        setClaimToken(storedClaim.claimToken);
        setRedeemed(storedClaim.redeemed);
        setClaimedTitle(storedClaim.title);
        setClaimedPlatform(storedClaim.platform);
        setCanConfirmRedeemed(storedClaim.canConfirmRedeemed);
        setCanCopySecret(storedClaim.canCopySecret);
      }
      setCheckedStoredClaim(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [token]);

  useEffect(() => {
    if (data.state !== "active") {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      if (loadStoredClaim(token)) {
        if (!cancelled) setCheckedRecipientAccess(true);
        return;
      }

      const result = await checkPublicRecipientAccessAction({ token, recipientEmail: null, clientFingerprint: collectClientFingerprint() });
      if (cancelled) return;
      setRecipientBlockMessage(result.blocked ? result.message : null);
      setCheckedRecipientAccess(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [data.state, token]);

  function confirmRedeemed() {
    if (!claimToken) return;
    startTransition(async () => {
      const result = await confirmPublicRedeemedAction({ claimToken });
      if (result.ok) {
        setRedeemed(true);
        if (claimToken) {
          storeClaim(token, {
            claimToken,
            title: claimedTitle,
            platform: claimedPlatform,
            canConfirmRedeemed,
            canCopySecret,
            redeemed: true
          });
        }
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Kod panoya kopyalandı.");
    } catch {
      toast.error("Pano erişimi başarısız oldu.");
    }
  }

  if (data.state !== "active") {
    if (claimToken) {
      return (
        <ClaimResult
          title={claimedTitle ?? "Kod alındı"}
          platform={claimedPlatform ?? "Dijital key"}
          secret={secret}
          canCopySecret={canCopySecret}
          canConfirmRedeemed={canConfirmRedeemed}
          redeemed={redeemed}
          isPending={isPending}
          onCopy={copySecret}
          onConfirm={confirmRedeemed}
        />
      );
    }

    if (!checkedStoredClaim) {
      return (
        <div className="mx-auto w-full max-w-xl rounded-md border border-border bg-card p-6 text-center shadow-panel">
          <div className="mx-auto flex size-11 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
            <KeyRound className="size-5" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Kod kontrol ediliyor</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Bu oturumda alınan kod varsa burada gösterilecek.</p>
        </div>
      );
    }

    const isRecipientBlocked = data.state === "recipient_blocked";

    if (data.state === "member_required") {
      return (
        <div className="mx-auto w-full max-w-xl rounded-md border border-border bg-card p-6 text-center shadow-panel">
          <div className="mx-auto flex size-11 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
            <LockKeyhole className="size-5" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Vultkey hesabıyla giriş gerekli</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.message}</p>
          <Button asChild className="mt-5 h-10">
            <Link href={`/login?next=${encodeURIComponent(`/k/${token}`)}`}>
              <LogIn className="size-4" />
              Giriş yap
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-xl rounded-md border border-border bg-card p-6 text-center shadow-panel">
        <div className="mx-auto flex size-11 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
          <LockKeyhole className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{isRecipientBlocked ? "Bu linkten tekrar kod alınamaz" : "Link geçerli değil"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.message}</p>
      </div>
    );
  }

  const activeData = data as ActivePublicLinkData;
  const permissions = activeData.link.permissions;
  const canViewList = configBool(permissions, "canViewList", true);
  const canReserve = configBool(permissions, "canReserve", true);
  const canRevealAfterReserve = configBool(permissions, "canRevealAfterReserve", true);
  const maxClaimsPerRecipient = configNumber(permissions, "maxClaimsPerRecipient", 1);
  const items = activeData.items;
  const showList = activeData.link.viewMode === "list" && canViewList && items.length > 0;
  const selectedItem = items.find((item) => item.id === selectedKeyId) ?? items[0] ?? null;
  const previewTitle = claimedTitle ?? itemTitle(selectedItem, activeData.link.title ?? activeData.preview?.title ?? "Yayınlanan kod");
  const platform = claimedPlatform ?? selectedItem?.platform ?? activeData.preview?.platform ?? "Dijital key";
  const requiresEmail = activeData.link.requiresEmail || activeData.link.requireEmailVerification;
  const selectedUnavailable = activeData.link.viewMode === "list" && !selectedItem?.available;
  const missingRequiredEmail = requiresEmail && email.trim().length === 0;
  const reserveDisabled = isPending || !canReserve || missingRequiredEmail || selectedUnavailable || !selectedItem;
  const showClaimHint = !claimToken && selectedUnavailable;
  const expiresAt = activeData.link.expiresAt ? formatDate(activeData.link.expiresAt) : null;
  const detailFields: PublicDetailField[] = selectedItem
    ? [
        selectedItem.category ? { label: "Kategori", value: selectedItem.category } : null,
        selectedItem.keyMask ? { label: "Maske", value: selectedItem.keyMask, mono: true } : null,
        selectedItem.source ? { label: "Kaynak", value: selectedItem.source } : null,
        selectedItem.expiresAt ? { label: "Son kullanım", value: formatDate(selectedItem.expiresAt) } : null,
        selectedItem.tags.length > 0 ? { label: "Etiket", value: selectedItem.tags.join(", ") } : null
      ].filter((field): field is PublicDetailField => Boolean(field))
    : [];

  if (!claimToken && (!checkedStoredClaim || !checkedRecipientAccess)) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-md border border-border bg-card p-6 text-center shadow-panel">
        <div className="mx-auto flex size-11 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
          <KeyRound className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Link kontrol ediliyor</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Bu bağlantıdan daha önce kod alınıp alınmadığı kontrol ediliyor.</p>
      </div>
    );
  }

  if (!claimToken && recipientBlockMessage) {
    return (
      <div className="mx-auto w-full max-w-xl rounded-md border border-border bg-card p-6 text-center shadow-panel">
        <div className="mx-auto flex size-11 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
          <LockKeyhole className="size-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Bu linkten tekrar kod alınamaz</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{recipientBlockMessage}</p>
      </div>
    );
  }

  function reserve(item?: PublicKeyItem | null) {
    const keyId = activeData.link.viewMode === "list" ? (item?.id ?? selectedItem?.id ?? null) : null;
    startTransition(async () => {
      const result = await reservePublicKeyAction({ token, keyId, recipientEmail: email, recipientLabel: label, clientFingerprint: collectClientFingerprint() });
      if (!result.ok || !result.claimToken) {
        toast.error(result.message);
        return;
      }

      const nextClaim = {
        claimToken: result.claimToken,
        title: result.keyTitle ?? null,
        platform: result.platform ?? null,
        canConfirmRedeemed: result.canConfirmRedeemed ?? true,
        canCopySecret: result.canCopy ?? true,
        redeemed: false
      };

      storeClaim(token, nextClaim);
      setSecret(result.secret ?? null);
      setClaimToken(nextClaim.claimToken);
      setClaimedTitle(nextClaim.title);
      setClaimedPlatform(nextClaim.platform);
      setCanConfirmRedeemed(nextClaim.canConfirmRedeemed);
      setCanCopySecret(nextClaim.canCopySecret);
      toast.success(result.message);
    });
  }

  return (
    <div className="w-full space-y-3">
      <section className="rounded-md border border-border bg-card shadow-panel">
        <div className="p-3 md:p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-border bg-background text-muted-foreground">
                {modeLabel(activeData.link.viewMode)}
              </Badge>
              <span>{activeData.link.claimCount}/{activeData.link.maxClaims} alındı</span>
              {expiresAt ? <span>Son tarih {expiresAt}</span> : null}
            </div>
            <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="break-words text-xl font-semibold tracking-tight sm:truncate">{activeData.link.title || previewTitle}</h1>
              <p className="shrink-0 text-xs text-muted-foreground">{modeDescription(activeData.link.viewMode, canViewList)}</p>
            </div>
          </div>
        </div>
        {activeData.link.message ? <div className="border-t border-border px-3 py-2 text-sm leading-6 text-muted-foreground md:px-4">{activeData.link.message}</div> : null}
      </section>

      <div className={cn("grid gap-3", activeData.link.viewMode === "list" ? "lg:grid-cols-2" : "lg:grid-cols-[280px_minmax(0,1fr)]")}>
        <aside className="space-y-3">
          <section className="rounded-md border border-border bg-card shadow-panel">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-sm font-semibold tracking-tight">Gönderenin istediği bilgiler</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Bu alanları link sahibi belirledi.</p>
            </div>
            <div className="space-y-3 p-3">
              {requiresEmail ? (
                <div className="space-y-1.5">
                  <Label htmlFor="recipient-email" className="inline-flex items-center gap-1.5 text-xs">
                    <Mail className="size-3.5 text-muted-foreground" />
                    E-posta, zorunlu
                  </Label>
                  <Input id="recipient-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@mail.com" className="h-8 text-sm" />
                  <p className="text-xs leading-5 text-muted-foreground">Gönderen bu linkte e-posta istedi.</p>
                </div>
              ) : activeData.link.requiresMember ? (
                <div className="rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                  <p className="font-medium text-foreground">Vultkey hesabınla doğrulandın.</p>
                  {activeData.link.viewerEmail ? <p className="mt-0.5 break-all">{activeData.link.viewerEmail}</p> : null}
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">E-posta gerekmiyor. Not bırakmak isteğe bağlı.</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="recipient-label" className="inline-flex items-center gap-1.5 text-xs">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  İsim veya not
                </Label>
                <Input id="recipient-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="İsteğe bağlı" className="h-8 text-sm" />
              </div>
              {maxClaimsPerRecipient > 0 ? (
                <p className="rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                  Tekrar alma cihaz veya oturum sinyalleriyle sıkı şekilde sınırlandırılır.
                </p>
              ) : null}
            </div>
          </section>

          {activeData.link.viewMode === "list" ? (
            <section className="rounded-md border border-border bg-card shadow-panel">
              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                  <Hash className="size-3.5 text-muted-foreground" />
                  Kodlar
                </h2>
                <span className="text-xs text-muted-foreground">{items.length} kayıt</span>
              </div>
              <div className="p-1.5">
                {showList ? (
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = selectedItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedKeyId(item.id)}
                        className={cn(
                          "grid min-h-12 w-full grid-cols-[24px_minmax(0,1fr)_64px] items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          !item.available ? "opacity-55" : ""
                        )}
                      >
                        <PlatformLogo platform={item.platform ?? "Dijital key"} className="mt-0.5 size-5 shrink-0 rounded-sm" />
                        <span className="min-w-0 space-y-0.5">
                          <span className="block break-words font-medium leading-5">{item.title || item.keyMask || "Gizli kayıt"}</span>
                          {item.category ? <span className="block break-words text-xs leading-4 text-muted-foreground">{item.category}</span> : null}
                        </span>
                        <span className="pt-0.5 text-right text-xs text-muted-foreground">{item.available ? "Uygun" : "Alındı"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
                  Liste görünümü gönderici tarafından kapalı.
                </div>
              )}
              </div>
            </section>
          ) : null}
        </aside>

        <section className="min-w-0 rounded-md border border-border bg-card shadow-panel">
          <div className="border-b border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <PlatformLogo platform={platform} className="size-8 shrink-0 rounded-md" />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-semibold tracking-tight sm:truncate">{previewTitle}</h2>
                    {selectedItem?.status ? <Badge className={cn("shrink-0 border text-xs", statusTone[selectedItem.status as KeyStatus])}>{statusLabels[selectedItem.status as KeyStatus] ?? selectedItem.status}</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{canReserve ? "Kodu aldığında kayıt ayrılır." : "Bu link sadece görüntüleme izni veriyor."}</p>
                </div>
              </div>
              {!claimToken ? (
                <Button type="button" className="h-9 w-full sm:w-auto" onClick={() => reserve(selectedItem)} disabled={reserveDisabled}>
                  <KeyRound className="size-4" />
                  {claimLabel(activeData.link.viewMode, canRevealAfterReserve)}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 p-4">
            {selectedItem ? (
              <div className="space-y-2 text-sm">
                <DetailFieldGrid fields={detailFields} />
                {selectedItem.notes ? (
                  <div className="rounded-md border border-border bg-background px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Not</p>
                    <p className="mt-1 leading-6">{selectedItem.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">Bu linkte uygun kod bulunamadı.</div>
            )}

            {showClaimHint ? (
              <div className="rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                {selectedUnavailable ? (
                  <p className="inline-flex items-center gap-2">
                    <AlertTriangle className="size-3.5" />
                    Bu kayıt artık uygun değil.
                  </p>
                ) : null}
              </div>
            ) : null}

            {claimToken && secret ? (
              <div className="space-y-3">
                <div className="rounded-md border border-primary/25 bg-background p-3">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="size-4 text-primary" />
                    Kod hazır
                  </p>
                  <p className="mt-2 break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground">{secret}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {canCopySecret ? (
                    <Button type="button" variant="outline" className="flex-1" onClick={copySecret}>
                      <Copy className="size-4" />
                      Kopyala
                    </Button>
                  ) : null}
                  {canConfirmRedeemed ? (
                    <Button type="button" className="flex-1" onClick={confirmRedeemed} disabled={isPending || redeemed}>
                      <CheckCircle2 className="size-4" />
                      {redeemed ? "Onaylandı" : "Kullandım"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : claimToken ? (
              <div className="space-y-3 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                <p>Kod alındı olarak işaretlendi. Gönderen raw kod gösterimini kapatmış.</p>
                {canConfirmRedeemed ? (
                  <Button type="button" className="w-full sm:w-auto" onClick={confirmRedeemed} disabled={isPending || redeemed}>
                    <CheckCircle2 className="size-4" />
                    {redeemed ? "Onaylandı" : "Kullandım"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
              <CalendarClock className="mt-0.5 size-4 shrink-0" />
              <p>Kodu kopyalamadan sayfayı kapatma. Gönderici izin vermediyse raw kod tekrar gösterilmez.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ClaimResult({
  title,
  platform,
  secret,
  canCopySecret,
  canConfirmRedeemed,
  redeemed,
  isPending,
  onCopy,
  onConfirm
}: {
  title: string;
  platform: string;
  secret: string | null;
  canCopySecret: boolean;
  canConfirmRedeemed: boolean;
  redeemed: boolean;
  isPending: boolean;
  onCopy: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-md border border-border bg-card shadow-panel">
      <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <PlatformLogo platform={platform} className="size-9 shrink-0 rounded-md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight sm:truncate">{title}</h1>
              <Badge className="border border-primary/25 bg-primary/10 text-primary">Alındı</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Bu kod bu oturumda alındı. Kopyalamadan sayfayı kapatma.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {secret ? (
          <div className="rounded-md border border-primary/25 bg-background p-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              Kod hazır
            </p>
            <p className="mt-2 break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-sm text-foreground">{secret}</p>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
            Kod alındı olarak işaretlendi. Gönderen raw kod gösterimini kapatmış.
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {secret && canCopySecret ? (
            <Button type="button" variant="outline" className="flex-1" onClick={onCopy}>
              <Copy className="size-4" />
              Kopyala
            </Button>
          ) : null}
          {canConfirmRedeemed ? (
            <Button type="button" className="flex-1" onClick={onConfirm} disabled={isPending || redeemed}>
              <CheckCircle2 className="size-4" />
              {redeemed ? "Onaylandı" : "Kullandım"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailFieldGrid({ fields }: { fields: PublicDetailField[] }) {
  if (fields.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
        Gönderen detay alanlarını gizledi.
      </div>
    );
  }

  const lastIndex = fields.length - 1;
  const shouldSpanLast = fields.length % 2 === 1;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((field, index) => (
        <DetailField key={`${field.label}:${field.value}`} field={field} className={shouldSpanLast && index === lastIndex ? "sm:col-span-2" : undefined} />
      ))}
    </div>
  );
}

function DetailField({ field, className }: { field: PublicDetailField; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-md border border-border bg-background px-3 py-2.5", className)}>
      <p className="text-xs text-muted-foreground">{field.label}</p>
      <p className={cn("mt-1 whitespace-normal leading-5", field.mono ? "break-all font-mono text-sm" : "break-words")}>{field.value}</p>
    </div>
  );
}
