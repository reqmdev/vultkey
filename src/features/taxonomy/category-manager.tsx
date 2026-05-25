"use client";

import { useEffect, useState, useTransition, type DragEvent } from "react";
import { FolderPlus, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buildCategoryTree, canMoveCategory, flattenCategoryTree, type CategoryTreeNode } from "@/features/keys/category-tree";
import type { VaultCategory } from "@/features/keys/types";
import { createCategoryAction, deleteCategoryAction, moveCategoryAction, updateCategoryAction } from "@/features/taxonomy/actions";
import { categoryColorSoftTone, categoryColorTone } from "@/features/keys/constants";
import { categoryColors } from "@/lib/validations/domain";
import type { CategoryColor } from "@/types/database";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const categoryDragType = "application/vnd.vultkey.category-id";

function getDraggedCategoryId(event: DragEvent) {
  return event.dataTransfer.getData(categoryDragType);
}

function parentLabel(category: CategoryTreeNode) {
  return `${"  ".repeat(category.depth)}${category.depth > 0 ? "- " : ""}${category.name}`;
}

function CategoryRow({
  category,
  categories,
  parentOptions,
  isMoving,
  onCreateChild,
  onMoveCategory
}: {
  category: CategoryTreeNode;
  categories: VaultCategory[];
  parentOptions: CategoryTreeNode[];
  isMoving: boolean;
  onCreateChild: (parentId: string) => void;
  onMoveCategory: (categoryId: string, parentId: string | null) => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState<CategoryColor>(category.color);
  const [sortOrder, setSortOrder] = useState(category.sortOrder);
  const [parentId, setParentId] = useState(category.parentId ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setName(category.name);
      setColor(category.color);
      setSortOrder(category.sortOrder);
      setParentId(category.parentId ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [category.color, category.id, category.name, category.parentId, category.sortOrder]);

  function save() {
    startTransition(async () => {
      const result = await updateCategoryAction({ id: category.id, parentId: parentId || null, name, color, sortOrder });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function remove() {
    if (!window.confirm("Kategori silinsin mi? Bağlı kodlar kategorisiz kalır, alt kategoriler en dış seviyeye çıkar.")) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function dropCategory(event: DragEvent<HTMLDivElement>) {
    const draggedId = getDraggedCategoryId(event);
    if (!draggedId) return;
    event.preventDefault();

    if (!canMoveCategory(categories, draggedId, category.id)) {
      toast.error("Kategori buraya taşınamaz.");
      return;
    }

    onMoveCategory(draggedId, category.id);
  }

  const selectableParents = parentOptions.filter((option) => option.id !== category.id && canMoveCategory(categories, category.id, option.id));

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropCategory}
      className="rounded-md border border-border bg-card p-4"
      style={{ marginLeft: category.depth * 18 }}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_90px_auto] lg:items-center">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(categoryDragType, category.id);
                event.dataTransfer.setData("text/plain", category.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Kategoriyi sürükle"
            >
              <GripVertical className="size-4" />
            </button>
            <Label htmlFor={`category-${category.id}`}>Kategori</Label>
            {category.children.length > 0 ? <span className="text-xs text-muted-foreground">{category.children.length} alt</span> : null}
          </div>
          <Input id={`category-${category.id}`} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`parent-${category.id}`}>Üst kategori</Label>
          <select
            id={`parent-${category.id}`}
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-ring/55 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">En dış seviye</option>
            {selectableParents.map((option) => (
              <option key={option.id} value={option.id}>
                {parentLabel(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`sort-${category.id}`}>Sıra</Label>
          <Input id={`sort-${category.id}`} type="number" min={0} max={999} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} />
        </div>
        <div className="flex items-center gap-2 lg:justify-end">
          <Badge variant="outline" className={cn("border", categoryColorSoftTone[color])}>
            {category.totalKeyCount} kod
          </Badge>
          <Button type="button" size="icon" variant="outline" onClick={() => onCreateChild(category.id)} disabled={isPending || isMoving} aria-label="Alt kategori ekle">
            <FolderPlus className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={save} disabled={isPending || isMoving} aria-label="Kategoriyi kaydet">
            {isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
          </Button>
          <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={isPending || isMoving} aria-label="Kategoriyi sil">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {categoryColors.map((item) => (
          <button
            key={item}
            type="button"
            aria-label={item}
            onClick={() => setColor(item)}
            className={cn("size-7 rounded-sm border transition-colors", categoryColorTone[item], color === item ? "border-foreground" : "border-transparent")}
          />
        ))}
      </div>
    </div>
  );
}

export function CategoryManager({ categories }: { categories: VaultCategory[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<CategoryColor>("violet");
  const [parentId, setParentId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isMoving, startMoveTransition] = useTransition();
  const categoryTree = buildCategoryTree(categories);
  const categoryOptions = flattenCategoryTree(categoryTree);

  function create() {
    startTransition(async () => {
      const result = await createCategoryAction({ parentId: parentId || null, name, color, sortOrder: categories.length });
      if (result.ok) {
        toast.success(result.message);
        setName("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function createChild(nextParentId: string) {
    setParentId(nextParentId);
    setName("");
  }

  function moveCategory(categoryId: string, nextParentId: string | null) {
    if (!canMoveCategory(categories, categoryId, nextParentId)) {
      toast.error("Kategori buraya taşınamaz.");
      return;
    }

    startMoveTransition(async () => {
      const result = await moveCategoryAction({ id: categoryId, parentId: nextParentId });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  function dropOnRoot(event: DragEvent<HTMLDivElement>) {
    const draggedId = getDraggedCategoryId(event);
    if (!draggedId) return;
    event.preventDefault();
    moveCategory(draggedId, null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5 shadow-panel">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="new-category">Yeni kategori</Label>
            <Input id="new-category" value={name} onChange={(event) => setName(event.target.value)} placeholder="Bekleyenler, hediye, çekiliş" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-category-parent">Üst kategori</Label>
            <select
              id="new-category-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-ring/55 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">En dış seviye</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {parentLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Renk sistemi</Label>
            <div className="flex flex-wrap gap-1.5">
              {categoryColors.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={item}
                  onClick={() => setColor(item)}
                  className={cn("size-8 rounded-sm border transition-colors", categoryColorTone[item], color === item ? "border-foreground" : "border-transparent")}
                />
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={isPending || name.trim().length === 0}>
            {isPending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
            Kategori ekle
          </Button>
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="space-y-3">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropOnRoot}
            className="flex items-center justify-between rounded-md border border-dashed border-border bg-background p-4 text-sm"
          >
            <div>
              <p className="font-medium">En dış seviye</p>
              <p className="mt-1 text-xs text-muted-foreground">Kategoriyi buraya bırakınca root seviyeye taşınır.</p>
            </div>
            {isMoving ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <span className="text-xs text-muted-foreground">Root</span>}
          </div>

          {categoryOptions.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              categories={categories}
              parentOptions={categoryOptions}
              isMoving={isMoving}
              onCreateChild={createChild}
              onMoveCategory={moveCategory}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Kategoriler kodları bağlam içinde tutar. İlk kategoriyle kasa düzenini kur.
        </div>
      )}
    </div>
  );
}
