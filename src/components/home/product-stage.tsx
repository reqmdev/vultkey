"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, FolderTree, GripVertical, Search, Vault } from "lucide-react";
import { KeyQuickActions } from "@/components/home/key-quick-actions";
import { PlatformLogo } from "@/components/platform-logo";
import { Button } from "@/components/ui/button";
import { statusLabels, statusTone } from "@/features/keys/constants";
import { keyStatuses } from "@/lib/validations/domain";
import { cn } from "@/lib/utils";
import type { KeyStatus } from "@/types/database";

export type HomePreviewKey = {
  id: string;
  title: string;
  platform: string;
  status: KeyStatus;
  keyMask: string;
  categoryId: string | null;
  categoryName: string | null;
  updatedAt: string;
  demoSecret?: string;
};

export type HomeData = {
  email: string | null;
  previewKeys: HomePreviewKey[];
  total: number;
  available: number;
  finished: number;
};

type HomeLocale = "tr" | "en";

const stageCopy = {
  tr: {
    sampleKeys: [
      { title: "OpenAI API kredisi", categoryName: "API kredileri" },
      { title: "Windows 11 Pro lisansı", categoryName: "Lisanslar" },
      { title: "Steam oyun keyi", categoryName: "Oyun keyleri" }
    ],
    recent: "Yakın zamanda",
    uncategorized: "Kategorisiz",
    stats: ["Toplam", "Hazır", "Bitmiş"],
    vault: "Kod kasası",
    signedInIntro: "Kasandaki son kayıtlar burada kısa bir önizleme olarak görünür.",
    demoIntro: "Dashboard düzeninin kısa önizlemesi: arama, durum ve maskeli kod listesi.",
    more: "Daha fazla",
    createVault: "Kasa oluştur",
    search: "Key, servis veya kategori ara",
    allStatuses: "Tüm durumlar",
    allCategories: "Tüm kategoriler",
    emptyTitle: "Kasanda henüz kod yok.",
    emptyText: "Dashboard'a geçip ilk kodunu ekleyebilirsin.",
    noResultsTitle: "Filtreyle eşleşen kayıt yok.",
    noResultsText: "Durum veya kategori filtresini değiştir.",
    clearFilters: "Filtreleri temizle",
    keyCount: "kod",
    locale: "tr-TR",
    statuses: statusLabels
  },
  en: {
    sampleKeys: [
      { title: "OpenAI API credits", categoryName: "API credits" },
      { title: "Windows 11 Pro license", categoryName: "Licenses" },
      { title: "Steam game key", categoryName: "Game keys" }
    ],
    recent: "Recently",
    uncategorized: "Uncategorized",
    stats: ["Total", "Ready", "Finished"],
    vault: "Code vault",
    signedInIntro: "Your latest vault records appear here as a compact preview.",
    demoIntro: "A compact preview of the dashboard: search, status filters, and masked code rows.",
    more: "View more",
    createVault: "Create vault",
    search: "Search key, service, or category",
    allStatuses: "All statuses",
    allCategories: "All categories",
    emptyTitle: "Your vault is empty.",
    emptyText: "Open the dashboard and add your first code.",
    noResultsTitle: "No records match these filters.",
    noResultsText: "Change the status or category filter.",
    clearFilters: "Clear filters",
    keyCount: "codes",
    locale: "en-US",
    statuses: {
      available: "Ready",
      reserved: "Reserved",
      redeemed: "Used",
      archived: "Archived"
    } satisfies Record<KeyStatus, string>
  }
};

const samplePreviewKeysBase: HomePreviewKey[] = [
  {
    id: "sample-1",
    title: "OpenAI API kredisi",
    platform: "OpenAI",
    status: "reserved",
    keyMask: "sk-****-****-44T",
    categoryId: "sample-api",
    categoryName: "API kredileri",
    demoSecret: "sk-demo-44t-key",
    updatedAt: "2026-05-22T15:20:00.000Z"
  },
  {
    id: "sample-2",
    title: "Windows 11 Pro lisansı",
    platform: "Microsoft",
    status: "available",
    keyMask: "WIN**-****-91K",
    categoryId: "sample-license",
    categoryName: "Lisanslar",
    demoSecret: "WIN91-DEMO-LICENSE",
    updatedAt: "2026-05-21T11:10:00.000Z"
  },
  {
    id: "sample-3",
    title: "Steam oyun keyi",
    platform: "Steam",
    status: "archived",
    keyMask: "STM**-****-18M",
    categoryId: "sample-game",
    categoryName: "Oyun keyleri",
    demoSecret: "STM18-DEMO-GAME",
    updatedAt: "2026-05-18T09:45:00.000Z"
  }
];

function samplePreviewKeys(locale: HomeLocale): HomePreviewKey[] {
  const copy = stageCopy[locale];
  return samplePreviewKeysBase.map((key, index) => ({
    ...key,
    title: copy.sampleKeys[index]?.title ?? key.title,
    categoryName: copy.sampleKeys[index]?.categoryName ?? key.categoryName
  }));
}

function formatPreviewDate(value: string, locale: HomeLocale) {
  const date = new Date(value);
  const copy = stageCopy[locale];

  if (Number.isNaN(date.getTime())) return copy.recent;

  return new Intl.DateTimeFormat(copy.locale, { day: "2-digit", month: "short" }).format(date);
}

function categoryOptionsFor(rows: HomePreviewKey[]) {
  const categoryById = new Map<string, string>();

  rows.forEach((row) => {
    if (row.categoryId && row.categoryName) categoryById.set(row.categoryId, row.categoryName);
  });

  return Array.from(categoryById, ([id, name]) => ({ id, name })).sort((first, second) => first.name.localeCompare(second.name, "tr"));
}

function groupedPreviewRows(rows: HomePreviewKey[], locale: HomeLocale) {
  const copy = stageCopy[locale];
  const groups = new Map<string, { id: string; name: string; rows: HomePreviewKey[] }>();

  rows.forEach((row) => {
    const id = row.categoryId ?? "none";
    const name = row.categoryName ?? copy.uncategorized;
    const group = groups.get(id) ?? { id, name, rows: [] };

    group.rows.push(row);
    groups.set(id, group);
  });

  return Array.from(groups.values());
}

export function ProductStage({ email, previewKeys, total, available, finished, locale = "tr" }: HomeData & { locale?: HomeLocale }) {
  const copy = stageCopy[locale];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<KeyStatus | "all">("all");
  const [categoryId, setCategoryId] = useState("all");
  const isSignedIn = Boolean(email);
  const demoRows = samplePreviewKeys(locale);
  const rows = isSignedIn ? previewKeys : demoRows;
  const categoryOptions = categoryOptionsFor(rows);
  const hasUncategorized = rows.some((row) => !row.categoryId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const haystack = [row.title, row.platform, row.keyMask, row.categoryName, copy.statuses[row.status]].filter(Boolean).join(" ").toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    const matchesStatus = status === "all" || row.status === status;
    const matchesCategory = categoryId === "all" || (categoryId === "none" ? !row.categoryId : row.categoryId === categoryId);

    return matchesQuery && matchesStatus && matchesCategory;
  });
  const stats = [
    [copy.stats[0], isSignedIn ? total : demoRows.length],
    [copy.stats[1], isSignedIn ? available : demoRows.filter((key) => key.status === "available").length],
    [copy.stats[2], isSignedIn ? finished : demoRows.filter((key) => key.status === "redeemed" || key.status === "archived").length]
  ];
  const previewGroups = groupedPreviewRows(filteredRows, locale);

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setCategoryId("all");
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-panel">
      <div className="grid gap-4 bg-background/35 p-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="inline-flex items-center gap-2 whitespace-nowrap text-2xl font-semibold tracking-tight">
            <Vault className="size-6 text-muted-foreground" />
            {copy.vault}
          </p>
          <div className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
            {stats.map(([label, value]) => (
              <div key={label} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground lg:text-center">
          {isSignedIn ? copy.signedInIntro : copy.demoIntro}
        </p>
        <div className="lg:justify-self-end">
          <Button asChild size="lg" className="h-11 w-full border border-primary/30 bg-primary px-4 text-primary-foreground shadow-[0_8px_24px_oklch(var(--primary)/0.22)] hover:bg-primary/90 sm:w-auto">
            <Link href={isSignedIn ? "/dashboard" : "/signup"}>
              {isSignedIn ? copy.more : copy.createVault}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-soft transition-colors placeholder:text-muted-foreground hover:border-ring/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={copy.search}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as KeyStatus | "all")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft transition-colors hover:border-ring/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            <option value="all">{copy.allStatuses}</option>
            {keyStatuses.map((keyStatus) => (
              <option key={keyStatus} value={keyStatus}>
                {copy.statuses[keyStatus]}
              </option>
            ))}
          </select>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-soft transition-colors hover:border-ring/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            <option value="all">{copy.allCategories}</option>
            {hasUncategorized ? <option value="none">{copy.uncategorized}</option> : null}
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[430px] items-center justify-center px-6 text-center">
          <div>
            <p className="font-medium">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.emptyText}</p>
            <Button asChild className="mt-5" variant="outline">
              <Link href="/dashboard">{copy.more}</Link>
            </Button>
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex min-h-[430px] items-center justify-center px-6 text-center">
          <div>
            <p className="font-medium">{copy.noResultsTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{copy.noResultsText}</p>
            <Button className="mt-5" variant="outline" onClick={clearFilters}>
              {copy.clearFilters}
            </Button>
          </div>
        </div>
      ) : (
        <div className="min-h-[430px] bg-background/20 p-3">
          <div className="space-y-1">
            {previewGroups.map((group) => (
              <section key={group.id} className="space-y-0.5">
                <div className="flex h-7 items-center gap-1 rounded border-b border-transparent px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-background/70">
                    <ChevronDown className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left font-medium">{group.name.toLocaleUpperCase(copy.locale)}</span>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
                    {group.rows.length} {copy.keyCount}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {group.rows.map((row, rowIndex) => {
                    const categoryLabel = row.categoryName ?? copy.uncategorized;

                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-transparent px-2 py-2 text-sm transition-colors hover:border-border hover:bg-muted/60",
                          rowIndex === 0 ? "bg-muted/35" : "bg-card/60"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/70">
                            <GripVertical className="size-4" />
                          </span>
                          <PlatformLogo platform={row.platform} className="size-6 shrink-0 rounded-sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{row.title}</p>
                            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                               <span className="truncate">{row.platform} · {formatPreviewDate(row.updatedAt, locale)}</span>
                              <span aria-hidden="true" className="text-muted-foreground/60">·</span>
                              <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground/90">
                                <FolderTree className="size-3.5 shrink-0" />
                                <span className="max-w-44 truncate">{categoryLabel}</span>
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <KeyQuickActions id={row.id} keyMask={row.keyMask} signedIn={isSignedIn} demoSecret={row.demoSecret} locale={locale} />
                          <span className={cn("hidden shrink-0 rounded-md border px-2 py-1 text-xs font-medium sm:inline-flex", statusTone[row.status])}>{copy.statuses[row.status]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
