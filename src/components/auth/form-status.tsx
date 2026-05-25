import { cn } from "@/lib/utils";

export function FormStatus({ message, ok }: { message: string | null; ok?: boolean }) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        ok
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/25 bg-destructive/10 text-destructive"
      )}
    >
      {message}
    </div>
  );
}
