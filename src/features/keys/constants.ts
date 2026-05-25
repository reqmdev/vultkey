import type { CategoryColor, KeyStatus } from "@/types/database";

export const statusLabels: Record<KeyStatus, string> = {
  available: "Hazır",
  reserved: "Alındı",
  redeemed: "Kullanıldı",
  archived: "Arşivde"
};

export const statusTone: Record<KeyStatus, string> = {
  available: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  reserved: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  redeemed: "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300",
  archived: "border-border bg-muted/70 text-muted-foreground"
};

export const categoryColorTone: Record<CategoryColor, string> = {
  slate: "bg-slate-400",
  violet: "bg-violet-400",
  blue: "bg-zinc-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  cyan: "bg-teal-400"
};

export const categoryColorSoftTone: Record<CategoryColor, string> = {
  slate: "border-slate-400/20 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  violet: "border-violet-400/20 bg-violet-400/10 text-violet-700 dark:text-violet-300",
  blue: "border-zinc-400/20 bg-zinc-400/10 text-zinc-700 dark:text-zinc-300",
  emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  rose: "border-rose-400/20 bg-rose-400/10 text-rose-700 dark:text-rose-300",
  cyan: "border-teal-400/20 bg-teal-400/10 text-teal-700 dark:text-teal-300"
};
