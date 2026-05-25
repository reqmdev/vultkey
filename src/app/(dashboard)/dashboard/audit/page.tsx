import { Monitor, Smartphone, Tablet, Globe2, Mail, StickyNote, UserRound, CheckCircle2, Clock3, KeyRound } from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { getAuditLogs, getPublicClaimLogs } from "@/features/keys/queries";
import type { PublicClaimLog } from "@/features/keys/types";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    "auth.login_success": "Giriş başarılı",
    "auth.logout": "Çıkış yapıldı",
    "auth.password_updated": "Şifre güncellendi",
    "key.created": "Kod oluşturuldu",
    "key.updated": "Kod güncellendi",
    "key.deleted": "Kod silindi",
    "key.revealed": "Kod gösterildi",
    "key.copied": "Kod kopyalandı",
    "public_link.created": "Yayın linki oluşturuldu",
    "public_link.copied": "Yayın linki kopyalandı",
    "public_link.disabled": "Yayın linki kapatıldı",
    "public_link.reserved": "Public kod alındı",
    "public_link.redeemed": "Public kod kullanıldı",
    "category.created": "Kategori oluşturuldu",
    "category.updated": "Kategori güncellendi",
    "category.deleted": "Kategori silindi",
    "tag.created": "Etiket oluşturuldu",
    "tag.updated": "Etiket güncellendi",
    "tag.deleted": "Etiket silindi"
  };

  return labels[eventType] ?? eventType.replaceAll(".", " / ");
}

function entityLabel(entityType: string | null) {
  const labels: Record<string, string> = {
    key: "Kod",
    category: "Kategori",
    tag: "Etiket"
  };

  return entityType ? (labels[entityType] ?? entityType) : "-";
}

function claimStatusLabel(status: string) {
  if (status === "redeemed") return "Kullanıldı";
  if (status === "reserved") return "Alındı";
  if (status === "cancelled") return "İptal";
  return status;
}

function deviceLabel(type: string | null) {
  if (type === "mobile") return "Telefon";
  if (type === "tablet") return "Tablet";
  if (type === "desktop") return "Bilgisayar";
  return "Bilinmiyor";
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="size-4 text-muted-foreground" />;
  if (type === "tablet") return <Tablet className="size-4 text-muted-foreground" />;
  return <Monitor className="size-4 text-muted-foreground" />;
}

function environmentLine(claim: PublicClaimLog) {
  const os = [claim.osName, claim.osVersion].filter(Boolean).join(" ") || "OS bilinmiyor";
  const browser = [claim.browserName, claim.browserVersion].filter(Boolean).join(" ") || "Tarayıcı bilinmiyor";
  return `${os} / ${browser}`;
}

function metadataText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "{}";
  const value = metadata as Record<string, unknown>;
  const pairs = Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && item !== "")
    .slice(0, 5)
    .map(([key, item]) => `${key}: ${String(item)}`);
  return pairs.length > 0 ? pairs.join(" | ") : "{}";
}

export default async function AuditPage() {
  const [claimLogs, logs] = await Promise.all([getPublicClaimLogs(), getAuditLogs()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">İşlem kayıtları</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gösterme, kopyalama, değişiklik ve oturum işlemleri kullanıcı izolasyonu içinde izlenir. Gizli kod değerleri kayıt verisine yazılmaz.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Kod alım kayıtları</h2>
            <p className="mt-1 text-sm text-muted-foreground">Public linkten alınan kodların alıcı, cihaz ve oturum bilgileri.</p>
          </div>
          <Badge variant="outline" className="border-border bg-background text-muted-foreground">
            {claimLogs.length} kayıt
          </Badge>
        </div>

        <div className="rounded-md border border-border bg-card shadow-panel">
          {claimLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Kod</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Alıcı</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Cihaz</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Konum</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Zaman</th>
                  </tr>
                </thead>
                <tbody>
                  {claimLogs.map((claim) => (
                    <tr key={claim.id} className="transition-colors hover:bg-accent/30">
                      <td className="border-b border-border/70 px-4 py-3 align-top">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <PlatformLogo platform={claim.platform ?? "Dijital key"} className="mt-0.5 size-7 shrink-0 rounded-md" />
                          <div className="min-w-0">
                            <p className="max-w-52 truncate font-medium text-foreground">{claim.keyTitle ?? "Silinmiş kod"}</p>
                            <p className="mt-0.5 max-w-52 truncate font-mono text-xs text-muted-foreground">{claim.keyMask ?? "Maske yok"}</p>
                            <Badge variant="outline" className="mt-2 border-primary/20 bg-primary/10 text-primary">
                              {claimStatusLabel(claim.status)}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-border/70 px-4 py-3 align-top">
                        <div className="space-y-1.5 text-xs leading-5">
                          {claim.recipientMemberEmail ? (
                            <p className="flex max-w-64 items-center gap-1.5 text-foreground">
                              <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{claim.recipientMemberEmail}</span>
                            </p>
                          ) : null}
                          {claim.recipientEmail ? (
                            <p className="flex max-w-64 items-center gap-1.5 text-muted-foreground">
                              <Mail className="size-3.5 shrink-0" />
                              <span className="truncate">{claim.recipientEmail}</span>
                            </p>
                          ) : null}
                          {claim.recipientLabel ? (
                            <p className="flex max-w-64 items-center gap-1.5 text-muted-foreground">
                              <StickyNote className="size-3.5 shrink-0" />
                              <span className="truncate">{claim.recipientLabel}</span>
                            </p>
                          ) : null}
                          {!claim.recipientMemberEmail && !claim.recipientEmail && !claim.recipientLabel ? <span className="text-muted-foreground">Alıcı bilgisi yok</span> : null}
                        </div>
                      </td>
                      <td className="border-b border-border/70 px-4 py-3 align-top">
                        <div className="space-y-1.5 text-xs leading-5 text-muted-foreground">
                          <p className="flex items-center gap-1.5 text-foreground">
                            <DeviceIcon type={claim.deviceType} />
                            {deviceLabel(claim.deviceType)}
                          </p>
                          <p>{environmentLine(claim)}</p>
                          {claim.clientPlatform ? <p className="max-w-64 truncate">Platform: {claim.clientPlatform}</p> : null}
                        </div>
                      </td>
                      <td className="border-b border-border/70 px-4 py-3 align-top">
                        <div className="space-y-1.5 text-xs leading-5 text-muted-foreground">
                          <p className="flex items-center gap-1.5 text-foreground">
                            <Globe2 className="size-3.5 text-muted-foreground" />
                            {claim.countryCode ?? "Ülke yok"}
                          </p>
                          {claim.timezone ? <p>{claim.timezone}</p> : null}
                          {claim.language ? <p>{claim.language}</p> : null}
                        </div>
                      </td>
                      <td className="border-b border-border/70 px-4 py-3 align-top text-xs leading-5 text-muted-foreground">
                        <p className="flex items-center gap-1.5 text-foreground">
                          <Clock3 className="size-3.5 text-muted-foreground" />
                          {formatDateTime(claim.reservedAt)}
                        </p>
                        {claim.redeemedAt ? (
                          <p className="mt-1 flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5" />
                            {formatDateTime(claim.redeemedAt)}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <KeyRound className="size-8 text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold tracking-tight">Henüz public claim yok.</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Public linkten kod alan kişiler burada görünecek.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Genel işlem kayıtları</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kasa, kategori, etiket ve oturum işlemleri.</p>
        </div>

        <div className="rounded-md border border-border bg-card shadow-panel">
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Olay</th>
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Varlık</th>
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Veri</th>
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Zaman</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-accent/40">
                    <td className="border-b border-border/70 px-4 py-3">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        {eventLabel(log.eventType)}
                      </Badge>
                    </td>
                    <td className="border-b border-border/70 px-4 py-3 text-muted-foreground">{entityLabel(log.entityType)}</td>
                    <td className="max-w-sm truncate border-b border-border/70 px-4 py-3 font-mono text-xs text-muted-foreground">
                      {metadataText(log.metadata)}
                    </td>
                    <td className="border-b border-border/70 px-4 py-3 text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <h2 className="text-xl font-semibold tracking-tight">Henüz işlem kaydı yok.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Giriş, kod oluşturma, gösterme, kopyalama ve sınıflandırma işlemleri burada görünecek.
            </p>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
