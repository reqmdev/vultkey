import type { Metadata } from "next";
import Script from "next/script";
import { Barlow } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { getSiteUrl, withSiteUrl } from "@/lib/site-url";
import { themeCookieName } from "@/lib/theme-script";
import "./globals.css";

const sans = Barlow({
  subsets: ["latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans"
});

const siteUrl = getSiteUrl();
const ogImage = withSiteUrl("/brand/vultkey-lockup.png");

export const metadata: Metadata = {
  title: {
    default: "Vultkey | Dijital key yönetimi",
    template: "%s | Vultkey"
  },
  description:
    "Vultkey, oyun, yazılım ve dijital ürün keylerini maskeli biçimde saklamanıza; düzenli bir şekilde takip edip gerektiğinde güvenli bağlantıyla paylaşmanıza yardımcı olan sade bir beta platformudur.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: siteUrl,
    siteName: "Vultkey",
    title: "Vultkey | Dijital key yönetimi",
    description:
      "Oyun, yazılım ve dijital ürün keylerinizi tek kasada toplayın. Maskeli saklayın, düzenli takip edin, gerektiğinde kontrollü paylaşın.",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Vultkey dijital key yönetim platformu"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Vultkey | Dijital key yönetimi",
    description:
      "Oyun, yazılım ve dijital ürün keylerini sakla, düzenle ve paylaş. Vultkey şu an beta aşamasında.",
    images: [ogImage]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
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
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
        <Script src="/_vercel/speed-insights/script.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
