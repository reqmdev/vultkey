"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

type Theme = "light" | "dark" | "system";

export function Providers({ children, initialTheme }: { children: ReactNode; initialTheme: Theme }) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      {children}
      <Toaster richColors position="top-right" toastOptions={{ duration: 3600 }} />
    </ThemeProvider>
  );
}
