import { Monitor, Smartphone, Tablet, Globe2, Mail, StickyNote, UserRound, CheckCircle2, Clock3, KeyRound } from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { getAuditLogs, getPublicClaimLogs } from "@/features/keys/queries";
import type { PublicClaimLog } from "@/features/keys/types";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    "auth.login_success": "Sign-in succeeded",
    "auth.logout": "Signed out",
    "auth.password_updated": "Password updated",
    "key.created": "Code created",
    "key.updated": "Code updated",
    "key.deleted": "Code deleted",
    "key.revealed": "Code revealed",
    "key.copied": "Code copied",
    "public_link.created": "Publish link created",
    "public_link.copied": "Publish link copied",
    "public_link.disabled": "Publish link disabled",
    "public_link.reserved": "Public code claimed",
    "public_link.redeemed": "Public code used",
    "category.created": "Category created",
    "category.updated": "Category updated",
    "category.deleted": "Category deleted",
    "tag.created": "Tag created",
    "tag.updated": "Tag updated",
    "tag.deleted": "Tag deleted"
  };

  return labels[eventType] ?? eventType.replaceAll(".", " / ");
}

function entityLabel(entityType: string | null) {
  const labels: Record<string, string> = {
    key: "Code",
    category: "Category",
    tag: "Tag"
  };

  return entityType ? (labels[entityType] ?? entityType) : "-";
}

function claimStatusLabel(status: string) {
  if (status === "redeemed") return "Used";
  if (status === "reserved") return "Claimed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function deviceLabel(type: string | null) {
  if (type === "mobile") return "Phone";
  if (type === "tablet") return "Tablet";
  if (type === "desktop") return "Desktop";
  return "Unknown";
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="size-4 text-muted-foreground" />;
  if (type === "tablet") return <Tablet className="size-4 text-muted-foreground" />;
  return <Monitor className="size-4 text-muted-foreground" />;
}

function environmentLine(claim: PublicClaimLog) {
  const os = [claim.osName, claim.osVersion].filter(Boolean).join(" ") || "Unknown OS";
  const browser = [claim.browserName, claim.browserVersion].filter(Boolean).join(" ") || "Unknown browser";
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

export default async function EnglishAuditPage() {
  const [claimLogs, logs] = await Promise.all([getPublicClaimLogs(), getAuditLogs()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit logs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Reveal, copy, change, and session actions are tracked per user. Secret code values are not written to audit data.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Code claim logs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Recipient, device, and session details for codes claimed through public links.</p>
          </div>
          <Badge variant="outline" className="border-border bg-background text-muted-foreground">
            {claimLogs.length} records
          </Badge>
        </div>

        <div className="rounded-md border border-border bg-card shadow-panel">
          {claimLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Recipient</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Device</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Location</th>
                    <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {claimLogs.map((claim) => (
                    <tr key={claim.id} className="transition-colors hover:bg-accent/30">
                      <td className="border-b border-border/70 px-4 py-3 align-top">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <PlatformLogo platform={claim.platform ?? "Digital key"} className="mt-0.5 size-7 shrink-0 rounded-md" />
                          <div className="min-w-0">
                            <p className="max-w-52 truncate font-medium text-foreground">{claim.keyTitle ?? "Deleted code"}</p>
                            <p className="mt-0.5 max-w-52 truncate font-mono text-xs text-muted-foreground">{claim.keyMask ?? "No mask"}</p>
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
                          {!claim.recipientMemberEmail && !claim.recipientEmail && !claim.recipientLabel ? <span className="text-muted-foreground">Recipient bilgisi yok</span> : null}
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
                            {claim.countryCode ?? "No country"}
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
              <h3 className="mt-3 text-base font-semibold tracking-tight">No public claims yet.</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">People who claim codes from public links will appear here.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">General audit logs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Vault, category, tag, and session actions.</p>
        </div>

        <div className="rounded-md border border-border bg-card shadow-panel">
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left">
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Event</th>
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Entity</th>
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">Time</th>
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
            <h2 className="text-xl font-semibold tracking-tight">No audit logs yet.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Sign-in, code creation, reveal, copy, and classification actions will appear here.
            </p>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
