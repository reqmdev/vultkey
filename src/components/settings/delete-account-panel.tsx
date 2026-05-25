"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { FormStatus } from "@/components/auth/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountPanel({ email }: { email: string | null }) {
  const router = useRouter();
  const confirmationText = email ?? "hesabi sil";
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const canDelete = confirmation.trim().toLowerCase() === confirmationText.toLowerCase();

  function deleteAccount() {
    if (!canDelete) return;

    setStatus(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/delete-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation })
        });
        const result = (await response.json()) as { ok: boolean; message: string; redirectTo?: string };

        if (result.ok) {
          router.replace(result.redirectTo ?? "/login?account_deleted=1");
          router.refresh();
          return;
        }

        setStatus({ message: result.message, ok: false });
      } catch {
        setStatus({ message: "Hesap silinemedi.", ok: false });
      }
    });
  }

  return (
    <div className="space-y-4 p-4">
      <div className="text-sm leading-6 text-muted-foreground">
        <p>Hesap silinirse kasa, kategoriler, etiketler ve yayın linkleri kalıcı olarak silinir.</p>
        <p>Devam etmek için <span className="break-all font-medium text-foreground">{confirmationText}</span> yaz.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="delete-confirmation">Onay</Label>
        <Input
          id="delete-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={confirmationText}
          autoComplete="off"
        />
      </div>

      <FormStatus message={status?.message ?? null} ok={status?.ok} />

      <Button type="button" variant="destructive" className="h-9 w-full justify-start" disabled={!canDelete || isPending} onClick={deleteAccount}>
        {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Hesabı sil
      </Button>
    </div>
  );
}
