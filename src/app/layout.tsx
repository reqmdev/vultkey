import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { themeCookieName } from "@/lib/theme-script";
import "./globals.css";

const sans = Barlow({
  subsets: ["latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: {
    default: "Vultkey",
    template: "%s | Vultkey"
  },
  description: "Bireysel ve ekip kullanımına uygun, maskeli ve işlem kayıtlı dijital key, oyun kodu ve lisans kasası.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  icons: {
    icon: "/brand/vultkey-icon.png",
    shortcut: "/brand/vultkey-icon.png",
    apple: "/brand/vultkey-icon.png"
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get(themeCookieName)?.value === "light" ? "light" : "dark";

  return (
    <html lang="tr" className={`${sans.variable}${theme === "dark" ? " dark" : ""}`} style={{ colorScheme: theme }} suppressHydrationWarning>
      <body>
        <Providers initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}
