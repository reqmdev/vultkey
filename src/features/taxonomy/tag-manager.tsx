"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createTagAction, deleteTagAction, updateTagAction } from "@/features/taxonomy/actions";
import type { VaultTag } from "@/features/keys/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function TagRow({ tag }: { tag: VaultTag }) {
  const [name, setName] = useState(tag.name);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateTagAction({ id: tag.id, name });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
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
    <div className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="space-y-2">
        <Label htmlFor={`tag-${tag.id}`}>Etiket</Label>
        <Input id={`tag-${tag.id}`} value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <Badge variant="muted">{tag.keyCount ?? 0} kod</Badge>
        <Button type="button" size="icon" variant="outline" onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={isPending}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function TagManager({ tags }: { tags: VaultTag[] }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createTagAction({ name });
      if (result.ok) {
        toast.success(result.message);
        setName("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-5 shadow-panel">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="new-tag">Yeni etiket</Label>
            <Input id="new-tag" value={name} onChange={(event) => setName(event.target.value)} placeholder="takas, bekleyen, hediye, kullanıldı" />
          </div>
          <Button onClick={create} disabled={isPending || name.trim().length === 0}>
            {isPending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
            Etiket ekle
          </Button>
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Etiketler hızlı filtreleme için kullanılır. Kısa ve tutarlı isimler seç.
        </div>
      )}
    </div>
  );
}
