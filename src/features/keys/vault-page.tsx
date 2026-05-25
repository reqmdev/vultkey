"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, Copy, Eye, EyeOff, FolderPlus, GripVertical, Link2, LockKeyhole, MoreHorizontal, PencilLine, Plus, RotateCcw, Search, Tag, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PlatformLogo } from "@/components/platform-logo";
import { copyKeyAction, deleteKeyAction, moveKeyToCategoryAction, revealKeyAction, setKeyStatusAction } from "@/features/keys/actions";
import { buildCategoryTree, getCategoryDescendantIds, type CategoryTreeNode } from "@/features/keys/category-tree";
import { statusLabels, statusTone } from "@/features/keys/constants";
import { KeyEditorDialog } from "@/features/keys/key-editor-dialog";
import type { VaultCategory, VaultKey, VaultPublicLink, VaultTag } from "@/features/keys/types";
import { PublishLinkDialog } from "@/features/public-links/publish-link-dialog";
import { copyPublicKeyLinkAction, createPublicKeyLinkAction, disablePublicKeyLinkAction } from "@/features/public-links/actions";
import { createCategoryAction, createTagAction, deleteCategoryAction, deleteTagAction, updateTagAction } from "@/features/taxonomy/actions";
import type { KeyStatus } from "@/types/database";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type VaultPageProps = {
  keys: VaultKey[];
  categories: VaultCategory[];
  tags: VaultTag[];
};

const keyDragType = "application/vnd.vultkey.key-id";
const quickLinkVisibility = {
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
const quickLinkPermissions = {
  canViewList: true,
  canReserve: true,
  canRevealAfterReserve: true,
  canConfirmRedeemed: true,
  canCopy: true,
  showUnavailable: false,
  maxClaimsPerRecipient: 1
};

function getDraggedKeyId(event: DragEvent) {
  return event.dataTransfer.getData(keyDragType);
}

function allowKeyDrop(event: DragEvent) {
  if (!Array.from(event.dataTransfer.types).includes(keyDragType)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function setDraggedKey(event: DragEvent, keyId: string) {
  event.dataTransfer.setData(keyDragType, keyId);
  event.dataTransfer.effectAllowed = "move";
}

function setDragPreview(event: DragEvent, title: string) {
  const preview = document.createElement("div");
  preview.textContent = title;
  preview.style.position = "fixed";
  preview.style.left = "-1000px";
  preview.style.top = "-1000px";
  preview.style.maxWidth = "240px";
  preview.style.padding = "7px 10px";
  preview.style.borderRadius = "6px";
  preview.style.border = "1px solid oklch(var(--border))";
  preview.style.background = "oklch(var(--card) / 0.9)";
  preview.style.color = "oklch(var(--foreground))";
  preview.style.boxShadow = "0 8px 22px rgb(0 0 0 / 0.28)";
  preview.style.font = "500 13px var(--font-sans), system-ui, sans-serif";
  preview.style.opacity = "0.86";
  preview.style.pointerEvents = "none";
  preview.style.whiteSpace = "nowrap";
  preview.style.overflow = "hidden";
  preview.style.textOverflow = "ellipsis";
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 14, 14);
  window.setTimeout(() => preview.remove(), 0);
}

function publicLinkIsUsable(publicLink: VaultPublicLink | null | undefined) {
  if (!publicLink || publicLink.status !== "active" || publicLink.disabledAt) return false;
  if (publicLink.claimCount >= publicLink.maxClaims) return false;
  if (publicLink.expiresAt && new Date(publicLink.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

function CategoryGroup({
  node,
  closedCategoryIds,
  keysByCategoryId,
  visibleCategoryIds,
  hasListFilter,
  depth = 0,
  onToggle,
  onDeleteCategory,
  onQuickLinkCategory,
  onCreateCategoryLink,
  onOpenCategoryPublish,
  onDisablePublicLink,
  onPrepareSubcategory,
  onMoveKey,
  onDragTarget,
  dragTargetCategoryId,
  isDeletingCategory,
  isUpdatingLink,
  renderKey
}: {
  node: CategoryTreeNode;
  closedCategoryIds: Record<string, boolean>;
  keysByCategoryId: Map<string | null, VaultKey[]>;
  visibleCategoryIds: Set<string>;
  hasListFilter: boolean;
  depth?: number;
  onToggle: (categoryId: string) => void;
  onDeleteCategory: (category: CategoryTreeNode) => void;
  onQuickLinkCategory: (categoryId: string) => void;
  onCreateCategoryLink: (categoryId: string) => void;
  onOpenCategoryPublish: (categoryId: string) => void;
  onDisablePublicLink: (linkId: string) => void;
  onPrepareSubcategory: (categoryId: string) => void;
  onMoveKey: (keyId: string, categoryId: string | null) => void;
  onDragTarget: (categoryId: string | null) => void;
  dragTargetCategoryId: string | null;
  isDeletingCategory: boolean;
  isUpdatingLink: boolean;
  renderKey: (key: VaultKey, depth: number) => ReactNode;
}) {
  const hasChildren = node.children.length > 0;
  const isClosed = closedCategoryIds[node.id] ?? false;
  const isDragTarget = dragTargetCategoryId === node.id;
  const categoryKeys = keysByCategoryId.get(node.id) ?? [];
  const visibleChildren = node.children.filter((child) => !hasListFilter || visibleCategoryIds.has(child.id));
  const publicLink = node.publicLink ?? null;
  const publicLinkActive = publicLinkIsUsable(publicLink);

  if (hasListFilter && !visibleCategoryIds.has(node.id)) return null;

  function dropKey(event: DragEvent<HTMLElement>) {
    const keyId = getDraggedKeyId(event);
    if (!keyId) return;
    event.preventDefault();
    onDragTarget(null);
    onMoveKey(keyId, node.id);
  }

  function markDragTarget(event: DragEvent<HTMLElement>) {
    if (!Array.from(event.dataTransfer.types).includes(keyDragType)) return;
    allowKeyDrop(event);
    onDragTarget(node.id);
  }

  function clearDragTarget(event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    onDragTarget(null);
  }

  return (
    <div className="space-y-1">
      <div
        onDragEnter={markDragTarget}
        onDragOver={markDragTarget}
        onDragLeave={clearDragTarget}
        onDrop={dropKey}
        style={{ paddingLeft: 2 + depth * 18 }}
        className={cn(
          "group flex h-8 items-center gap-1 rounded border-b px-1 text-xs font-semibold transition-colors",
          "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          isDragTarget ? "border-emerald-400/80 bg-emerald-500/10 text-emerald-200 shadow-[0_8px_22px_rgba(16,185,129,0.12)]" : "border-transparent"
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isClosed ? "Kategoriyi aç" : "Kategoriyi kapat"}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", isClosed || (!hasChildren && categoryKeys.length === 0) ? "-rotate-90" : "rotate-0")} />
        </button>
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        </button>
        <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {node.totalKeyCount}
        </span>
        {publicLink ? (
          <Badge variant="outline" className={cn("hidden h-6 shrink-0 gap-1 border px-1.5 text-[11px] sm:inline-flex", publicLinkActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-background text-muted-foreground")}>
            <Link2 className="size-3" />
            {publicLinkActive ? "Yayında" : "Kapalı"}
          </Badge>
        ) : null}
        <button
          type="button"
          onClick={() => onQuickLinkCategory(node.id)}
          disabled={isUpdatingLink}
          className="flex h-6 shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          title={publicLinkActive ? "Kategori linkini kopyala" : "Kategori linki oluştur"}
        >
          <Link2 className="size-3.5" />
          <span className="hidden lg:inline">{publicLinkActive ? "Kopyala" : "Link al"}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex size-6 shrink-0 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground data-[state=open]:border-border data-[state=open]:bg-background"
              aria-label="Kategori işlemleri"
              title="Kategori işlemleri"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1.5">
            <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Kategori</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onQuickLinkCategory(node.id)} disabled={isUpdatingLink}>
              <Copy className="size-4" />
              {publicLinkActive ? "Linki kopyala" : "Link al"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenCategoryPublish(node.id)}>
              <Link2 className="size-4" />
              Link ayarları
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateCategoryLink(node.id)} disabled={isUpdatingLink}>
              <Plus className="size-4" />
              Yeni link
            </DropdownMenuItem>
            {publicLink && publicLinkActive ? (
              <DropdownMenuItem onClick={() => onDisablePublicLink(publicLink.id)} disabled={isUpdatingLink}>
                <XCircle className="size-4" />
                Linki kapat
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPrepareSubcategory(node.id)}>
              <FolderPlus className="size-4" />
              Alt kategori ekle
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteCategory(node)} disabled={isDeletingCategory}>
              <Trash2 className="size-4" />
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => onDeleteCategory(node)}
          disabled={isDeletingCategory}
          className="flex size-6 shrink-0 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-red-300"
          aria-label="Kategoriyi sil"
          title="Kategoriyi sil"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {!isClosed ? (
        <div className="space-y-0.5">
          {categoryKeys.map((key) => renderKey(key, depth + 1))}
          {visibleChildren.map((child) => (
            <CategoryGroup
              key={child.id}
              node={child}
              closedCategoryIds={closedCategoryIds}
              keysByCategoryId={keysByCategoryId}
              visibleCategoryIds={visibleCategoryIds}
              hasListFilter={hasListFilter}
              depth={depth + 1}
              onToggle={onToggle}
              onDeleteCategory={onDeleteCategory}
              onQuickLinkCategory={onQuickLinkCategory}
              onCreateCategoryLink={onCreateCategoryLink}
              onOpenCategoryPublish={onOpenCategoryPublish}
              onDisablePublicLink={onDisablePublicLink}
              onPrepareSubcategory={onPrepareSubcategory}
              onMoveKey={onMoveKey}
              onDragTarget={onDragTarget}
              dragTargetCategoryId={dragTargetCategoryId}
              isDeletingCategory={isDeletingCategory}
              isUpdatingLink={isUpdatingLink}
              renderKey={renderKey}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyVault({ onCreate, onCategoryFocus }: { onCreate: () => void; onCategoryFocus: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-6 py-12 text-center">
      <h2 className="text-xl font-semibold tracking-tight">Önce bir kategori aç.</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Toplu kodları bir kategoriye bağladığında link üretmek ve kopyalamak kategori satırından tek adıma iner.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onCategoryFocus}>
          <FolderPlus className="size-4" />
          Kategori ekle
        </Button>
        <Button variant="outline" onClick={onCreate}>
          <Plus className="size-4" />
          Kod ekle
        </Button>
      </div>
    </div>
  );
}

function TagPill({ tag }: { tag: VaultTag }) {
  const [name, setName] = useState(tag.name);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    const nextName = name.trim();
    if (!nextName) return;
    if (nextName === tag.name) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updateTagAction({ id: tag.id, name: nextName });
      if (result.ok) {
        toast.success(result.message);
        setEditing(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove() {
    if (!window.confirm("Etiket silinsin mi? Kod ilişkileri kaldırılır.")) return;

    startTransition(async () => {
      const result = await deleteTagAction(tag.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="flex h-7 min-w-0 shrink-0 items-center rounded-md border border-border bg-background text-xs">
      {editing ? (
        <>
          <Input
            aria-label="Etiket adı"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                setName(tag.name);
                setEditing(false);
              }
            }}
            className="h-6 w-28 border-0 bg-transparent px-2 text-xs focus-visible:ring-1"
          />
          <Button type="button" size="icon" variant="ghost" className="size-6" onClick={save} disabled={isPending || name.trim().length === 0}>
            <Check className="size-3.5" />
            <span className="sr-only">Kaydet</span>
          </Button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="flex min-w-0 items-center gap-1.5 px-2 text-left text-muted-foreground hover:text-foreground">
          <span className="truncate font-medium">{tag.name}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">{tag.keyCount ?? 0}</span>
        </button>
      )}
      <Button type="button" size="icon" variant="ghost" className="size-6 text-muted-foreground hover:text-destructive" onClick={remove} disabled={isPending}>
        <Trash2 className="size-3.5" />
        <span className="sr-only">Sil</span>
      </Button>
    </div>
  );
}

export function VaultPage({ keys, categories, tags }: VaultPageProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<KeyStatus | "all">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<VaultKey | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishingKey, setPublishingKey] = useState<VaultKey | null>(null);
  const [publishingCategoryId, setPublishingCategoryId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [closedCategoryIds, setClosedCategoryIds] = useState<Record<string, boolean>>({});
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [draggingKeyId, setDraggingKeyId] = useState<string | null>(null);
  const [dragTargetCategoryId, setDragTargetCategoryId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDeletingCategory, startDeleteCategoryTransition] = useTransition();
  const [isMovingKey, startMoveKeyTransition] = useTransition();
  const [isCreatingCategory, startCreateCategoryTransition] = useTransition();
  const [isCreatingTag, startCreateTagTransition] = useTransition();
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [isUpdatingLink, startLinkTransition] = useTransition();
  const timers = useRef<Record<string, number>>({});
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const categoryPathById = useMemo(() => {
    const paths = new Map<string, string>();

    categories.forEach((category) => {
      const names: string[] = [];
      const visited = new Set<string>();
      let current: VaultCategory | undefined = category;

      while (current && !visited.has(current.id)) {
        names.unshift(current.name);
        visited.add(current.id);
        current = current.parentId ? categoryById.get(current.parentId) : undefined;
      }

      paths.set(category.id, names.join(" / "));
    });

    return paths;
  }, [categories, categoryById]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => Object.values(activeTimers).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const filteredKeys = useMemo(() => {
    const normalizedQuery = deferredQuery.toLowerCase().trim();

    return keys.filter((key) => {
      const haystack = [key.title, key.platform, key.source, key.notes, key.category?.name, key.status, ...key.tags.map((tag) => tag.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      const matchesStatus = status === "all" || key.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [deferredQuery, keys, status]);
  const keysByCategoryId = useMemo(() => {
    const grouped = new Map<string | null, VaultKey[]>();

    filteredKeys.forEach((key) => {
      const current = grouped.get(key.categoryId) ?? [];
      current.push(key);
      grouped.set(key.categoryId, current);
    });

    return grouped;
  }, [filteredKeys]);
  const visibleCategoryIds = useMemo(() => {
    const visible = new Set<string>();

    filteredKeys.forEach((key) => {
      let currentId = key.categoryId;
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visible.add(currentId);
        visited.add(currentId);
        currentId = categoryById.get(currentId)?.parentId ?? null;
      }
    });

    return visible;
  }, [categoryById, filteredKeys]);
  const rootKeys = keysByCategoryId.get(null) ?? [];
  const hasListFilter = deferredQuery.trim().length > 0 || status !== "all";
  const newCategoryParent = newCategoryParentId ? (categoryById.get(newCategoryParentId) ?? null) : null;
  const newCategoryParentPath = newCategoryParent ? (categoryPathById.get(newCategoryParent.id) ?? newCategoryParent.name) : null;

  function openCreate() {
    setEditingKey(null);
    setEditorOpen(true);
  }

  function openEdit(key: VaultKey) {
    setEditingKey(key);
    setEditorOpen(true);
  }

  function openPublish(key: VaultKey) {
    setPublishingKey(key);
    setPublishingCategoryId(key.categoryId);
    setPublishOpen(true);
  }

  function openCategoryPublish(nextCategoryId?: string | null) {
    setPublishingKey(null);
    setPublishingCategoryId(nextCategoryId ?? categories[0]?.id ?? null);
    setPublishOpen(true);
  }

  function focusCategoryInput() {
    setNewCategoryParentId(null);
    categoryInputRef.current?.focus();
  }

  function prepareSubcategory(categoryId: string) {
    setNewCategoryParentId(categoryId);
    setClosedCategoryIds((current) => ({ ...current, [categoryId]: false }));
    window.setTimeout(() => categoryInputRef.current?.focus(), 0);
  }

  function hideSecret(id: string) {
    setRevealed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    if (timers.current[id]) window.clearTimeout(timers.current[id]);
  }

  async function revealSecret(id: string) {
    if (revealed[id]) {
      hideSecret(id);
      return;
    }

    setPendingAction(`reveal:${id}`);
    const result = await revealKeyAction(id);
    setPendingAction(null);

    if (!result.ok || !result.secret) {
      toast.error(result.message);
      return;
    }

    setRevealed((current) => ({ ...current, [id]: result.secret ?? "" }));
    if (timers.current[id]) window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => hideSecret(id), 30_000);
  }

  async function copySecret(id: string) {
    setPendingAction(`copy:${id}`);
    const result = await copyKeyAction(id);
    setPendingAction(null);

    if (!result.ok || !result.secret) {
      toast.error(result.message);
      return;
    }

    try {
      await navigator.clipboard.writeText(result.secret);
      toast.success("Kod panoya kopyalandı.");
    } catch {
      toast.error("Pano erişimi başarısız oldu. HTTPS veya tarayıcı iznini kontrol et.");
    }
  }

  function deleteKey(id: string) {
    if (!window.confirm("Bu kod kalıcı olarak silinsin mi?")) return;

    startDeleteTransition(async () => {
      const result = await deleteKeyAction(id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function updateKeyStatus(id: string, nextStatus: KeyStatus) {
    startStatusTransition(async () => {
      const result = await setKeyStatusAction({ id, status: nextStatus });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function copyPublicLink(linkId: string) {
    startLinkTransition(async () => {
      const result = await copyPublicKeyLinkAction(linkId);
      if (!result.ok || !result.url) {
        toast.error(result.message);
        return;
      }

      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Yayın linki kopyalandı.");
      } catch {
        toast.error("Pano erişimi başarısız oldu.");
      }
    });
  }

  function createCategoryLink(categoryId: string) {
    const category = categoryById.get(categoryId);
    if (!category) {
      toast.error("Kategori bulunamadı.");
      return;
    }

    const categoryIds = getCategoryDescendantIds(categories, categoryId);
    const availableCount = keys.filter((key) => key.status === "available" && key.categoryId && categoryIds.has(key.categoryId)).length;
    const includeSubcategories = categories.some((item) => item.parentId === categoryId);

    if (availableCount === 0) {
      toast.error("Bu kategoride hazır kod yok.");
      return;
    }

    startLinkTransition(async () => {
      const result = await createPublicKeyLinkAction({
        targetType: "category",
        viewMode: "list",
        keyId: null,
        categoryId,
        accessMode: "anyone",
        requireEmailVerification: false,
        allowedEmails: [],
        title: category.name,
        message: "",
        expiresAt: null,
        maxClaims: availableCount,
        includeSubcategories,
        visibility: quickLinkVisibility,
        permissions: quickLinkPermissions
      });

      if (!result.ok || !result.url) {
        toast.error(result.message);
        return;
      }

      router.refresh();
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Kategori linki oluşturuldu ve kopyalandı.");
      } catch {
        toast.error("Link oluşturuldu ama panoya kopyalanamadı.");
      }
    });
  }

  function copyOrCreateCategoryLink(categoryId: string) {
    const publicLink = categoryById.get(categoryId)?.publicLink ?? null;
    if (publicLink && publicLinkIsUsable(publicLink)) {
      copyPublicLink(publicLink.id);
      return;
    }

    createCategoryLink(categoryId);
  }

  function disablePublicLink(linkId: string) {
    if (!window.confirm("Yayın linki kapatılsın mı? Linke girenler artık kod alamaz.")) return;

    startLinkTransition(async () => {
      const result = await disablePublicKeyLinkAction(linkId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function moveKey(keyId: string, nextCategoryId: string | null) {
    setDraggingKeyId(null);
    setDragTargetCategoryId(null);
    startMoveKeyTransition(async () => {
      const result = await moveKeyToCategoryAction({ id: keyId, categoryId: nextCategoryId });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function deleteCategory(category: CategoryTreeNode) {
    if (category.totalKeyCount > 0 || category.children.length > 0) {
      const details = [
        category.totalKeyCount > 0 ? `${category.totalKeyCount} key/kod kategorisiz kalacak` : null,
        category.children.length > 0 ? `${category.children.length} alt kategori en dış seviyeye çıkacak` : null
      ].filter(Boolean);

      if (!window.confirm(`Dikkat: "${category.name}" boş değil. ${details.join(". ")}. Yine de silinsin mi?`)) return;
    } else if (!window.confirm(`"${category.name}" kategorisi silinsin mi?`)) {
      return;
    }

    startDeleteCategoryTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.ok) {
        toast.success(result.message);
        if (newCategoryParentId === category.id) setNewCategoryParentId(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function toggleCategory(categoryId: string) {
    setClosedCategoryIds((current) => ({ ...current, [categoryId]: !current[categoryId] }));
  }

  function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    startCreateCategoryTransition(async () => {
      const result = await createCategoryAction({
        parentId: newCategoryParentId,
        name,
        color: "slate",
        sortOrder: categories.length
      });

      if (result.ok) {
        toast.success(result.message);
        setNewCategoryName("");
        setNewCategoryParentId(null);
      } else {
        toast.error(result.message);
      }
    });
  }

  function createTag() {
    const name = newTagName.trim();
    if (!name) return;

    startCreateTagTransition(async () => {
      const result = await createTagAction({ name });
      if (result.ok) {
        toast.success(result.message);
        setNewTagName("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function startKeyDrag(event: DragEvent, key: VaultKey) {
    setDraggedKey(event, key.id);
    setDragPreview(event, key.title);
    setDraggingKeyId(key.id);
    setDragTargetCategoryId(null);
  }

  function endKeyDrag() {
    setDraggingKeyId(null);
    setDragTargetCategoryId(null);
  }

  function renderKeyRow(key: VaultKey, depth = 0) {
    const secret = revealed[key.id];
    const revealPending = pendingAction === `reveal:${key.id}`;
    const copyPending = pendingAction === `copy:${key.id}`;
    const publicLink = key.publicLink;
    const publicLinkActive = publicLinkIsUsable(publicLink);
    const isRedeemed = key.status === "redeemed";

    return (
      <div
        key={key.id}
        className={cn(
          "group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-transparent px-2 py-2 text-sm transition-colors hover:border-border hover:bg-muted/60",
          isRedeemed ? "border-red-500/25 bg-red-500/5 hover:border-red-500/35 hover:bg-red-500/10" : "",
          draggingKeyId === key.id ? "bg-muted/50 opacity-45" : "opacity-100"
        )}
        style={{ marginLeft: depth * 18 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            draggable
            onDragStart={(event) => startKeyDrag(event, key)}
            onDragEnd={endKeyDrag}
            className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground opacity-70 transition-colors hover:bg-background hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Kodu kategoriye taşı"
          >
            <GripVertical className="size-4" />
          </button>
          <PlatformLogo platform={key.platform} className="size-6 shrink-0 rounded-sm" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-foreground">{key.title}</span>
              {isRedeemed ? <Badge className={cn("shrink-0 border text-[11px]", statusTone.redeemed)}>Kullanıldı</Badge> : null}
            </div>
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <span className="truncate">{key.platform} · {formatDate(key.updatedAt)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1">
          <span
            title={secret ?? key.keyMask}
            className={cn(
              "hidden h-8 min-w-44 max-w-72 items-center justify-center overflow-hidden rounded-md border px-3 font-mono text-[12px] font-medium tracking-[0.02em] shadow-sm md:inline-flex xl:min-w-56",
              secret ? "border-primary/35 bg-primary/10 text-foreground" : "border-border bg-background text-foreground/80"
            )}
          >
            {secret ?? key.keyMask}
          </span>
          {publicLink ? (
            <Badge variant="outline" className={cn("hidden shrink-0 gap-1 border text-[11px] lg:inline-flex", publicLinkActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-border bg-muted/40 text-muted-foreground")}>
              <Link2 className="size-3" />
              {publicLinkActive ? "Yayında" : "Kapalı"}
            </Badge>
          ) : null}
          {!isRedeemed ? <Badge className={cn("hidden shrink-0 border text-[11px] sm:inline-flex", statusTone[key.status])}>{statusLabels[key.status]}</Badge> : null}
          {isRedeemed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-red-500/30 bg-red-500/5 px-2 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
              onClick={() => deleteKey(key.id)}
              disabled={isDeleting}
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Sil</span>
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => revealSecret(key.id)} disabled={revealPending}>
            {secret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <span className="sr-only">{secret ? "Gizle" : "Göster"}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 border border-transparent hover:border-border hover:bg-muted data-[state=open]:border-border data-[state=open]:bg-muted"
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only">İşlemler</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1.5">
              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Kod işlemleri</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openEdit(key)}>
                <PencilLine className="size-4" />
                Düzenle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openPublish(key)}>
                <Link2 className="size-4" />
                Link olarak yayınla
              </DropdownMenuItem>
              {publicLink ? (
                <>
                  <DropdownMenuItem onClick={() => copyPublicLink(publicLink.id)} disabled={isUpdatingLink}>
                    <Copy className="size-4" />
                    Yayın linkini kopyala
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => disablePublicLink(publicLink.id)} disabled={isUpdatingLink}>
                    <XCircle className="size-4" />
                    Yayından kaldır
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem onClick={() => copySecret(key.id)} disabled={copyPending}>
                <Copy className="size-4" />
                Güvenli kopyala
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => updateKeyStatus(key.id, "reserved")} disabled={isUpdatingStatus || key.status === "reserved"}>
                <LockKeyhole className="size-4" />
                Alındı yap
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateKeyStatus(key.id, "redeemed")} disabled={isUpdatingStatus || key.status === "redeemed"}>
                <CheckCircle2 className="size-4" />
                Kullanıldı yap
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateKeyStatus(key.id, "available")} disabled={isUpdatingStatus || key.status === "available"}>
                <RotateCcw className="size-4" />
                Hazır yap
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteKey(key.id)} disabled={isDeleting}>
                <Trash2 className="size-4" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  const available = keys.filter((key) => key.status === "available").length;
  const attention = keys.filter((key) => key.status === "reserved").length;
  const vaultStats = [
    { label: "Toplam", value: keys.length },
    { label: "Hazır", value: available },
    { label: "Alınan", value: attention }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kasa</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Keyleri maskeli tut, kategoriyle düzenle ve gerektiğinde güvenli paylaş.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            {vaultStats.map(({ label, value }) => (
              <span key={label} className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5">
                <span className="font-semibold tabular-nums text-foreground">{value}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
        <Button onClick={openCreate} className="h-10 shrink-0 sm:mt-0">
          <Plus className="size-4" />
          Key/kod ekle
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card shadow-panel">
        <div className="border-b border-border px-3 py-2.5">
          <form
            className="flex flex-col gap-2 md:flex-row md:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              createCategory();
            }}
          >
            <label htmlFor="new-category" className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <FolderPlus className="size-4 text-muted-foreground" />
              Kategori
            </label>
            <Input
              ref={categoryInputRef}
              id="new-category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder={newCategoryParentPath ? `${newCategoryParentPath} altında alt kategori` : "Yeni kategori adı"}
              className="h-9 min-w-0 flex-1 md:max-w-xl"
            />
            <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">
              {newCategoryParent ? (
                <button
                  type="button"
                  onClick={() => setNewCategoryParentId(null)}
                  className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Alt kategori hedefini temizle"
                >
                  <FolderPlus className="size-3.5 shrink-0" />
                  <span className="max-w-36 truncate">{newCategoryParent.name}</span>
                  <XCircle className="size-3.5 shrink-0" />
                </button>
              ) : null}
              {isMovingKey ? <span className="shrink-0 text-xs text-muted-foreground">Taşınıyor...</span> : null}
              <Button type="submit" className="h-9" disabled={isCreatingCategory || newCategoryName.trim().length === 0}>
                <Plus className="size-4" />
                Ekle
              </Button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Key, servis, etiket veya kategori ara" className="h-9 pl-9" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as KeyStatus | "all")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:border-ring/55 focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              <option value="all">Tüm durumlar</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {keys.length === 0 && categories.length === 0 ? (
          <div className="p-4">
            <EmptyVault onCreate={openCreate} onCategoryFocus={focusCategoryInput} />
          </div>
        ) : filteredKeys.length === 0 && hasListFilter ? (
          <div className="flex min-h-80 items-center justify-center px-6 text-center">
            <div>
              <p className="font-medium">Filtreyle eşleşen kod yok.</p>
              <p className="mt-2 text-sm text-muted-foreground">Aramayı sadeleştir veya filtreleri temizle.</p>
              <Button
                className="mt-5"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Filtreleri temizle
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 p-3">
            {categoryTree.map((category) => (
              <CategoryGroup
                key={category.id}
                node={category}
                closedCategoryIds={closedCategoryIds}
                keysByCategoryId={keysByCategoryId}
                visibleCategoryIds={visibleCategoryIds}
                hasListFilter={hasListFilter}
                onToggle={toggleCategory}
                onDeleteCategory={deleteCategory}
                onQuickLinkCategory={copyOrCreateCategoryLink}
                onCreateCategoryLink={createCategoryLink}
                onOpenCategoryPublish={openCategoryPublish}
                onDisablePublicLink={disablePublicLink}
                onPrepareSubcategory={prepareSubcategory}
                onMoveKey={moveKey}
                onDragTarget={setDragTargetCategoryId}
                dragTargetCategoryId={dragTargetCategoryId}
                isDeletingCategory={isDeletingCategory}
                isUpdatingLink={isUpdatingLink}
                renderKey={renderKeyRow}
              />
            ))}
            {rootKeys.map((key) => renderKeyRow(key, 0))}
            {categoryTree.length === 0 && rootKeys.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
                Henüz görünür kayıt yok. Kategori veya kod ekleyerek başlayabilirsin.
              </div>
            ) : null}
          </div>
        )}

        <details className="border-t border-border [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40">
            <span className="inline-flex items-center gap-2">
              <Tag className="size-4 text-muted-foreground" />
              Etiketler
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
              {tags.length}
              <ChevronDown className="size-4" />
            </span>
          </summary>
          <div className="border-t border-border p-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2 py-2">
              <form
                className="flex min-w-0 shrink-0 gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  createTag();
                }}
              >
                <Input id="new-tag" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Yeni etiket" className="h-8 w-36 text-xs" />
                <Button type="submit" size="icon" variant="outline" className="size-8" disabled={isCreatingTag || newTagName.trim().length === 0}>
                  <Plus className="size-3.5" />
                  <span className="sr-only">Etiket ekle</span>
                </Button>
              </form>
              {tags.length > 0 ? (
                <div className="flex min-w-44 flex-1 gap-1.5 overflow-x-auto border-t border-border pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
                  {tags.map((tag) => (
                    <TagPill key={tag.id} tag={tag} />
                  ))}
                </div>
              ) : (
                <span className="border-t border-border pt-2 text-xs text-muted-foreground sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">Henüz etiket yok.</span>
              )}
            </div>
          </div>
        </details>
      </div>

      <KeyEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        keyRecord={editingKey}
        initialCategoryId={null}
        categories={categories}
        tags={tags}
      />
      <PublishLinkDialog
        open={publishOpen}
        onOpenChange={(open) => {
          setPublishOpen(open);
          if (!open) {
            setPublishingKey(null);
            setPublishingCategoryId(null);
          }
        }}
        keyRecord={publishingKey}
        initialCategoryId={publishingCategoryId}
        categories={categories}
        keys={keys}
      />
    </div>
  );
}
