const FALLBACK_URL = "https://vultkey.com";

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return FALLBACK_URL;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const normalized = new URL(withProtocol);
    normalized.pathname = "";
    normalized.search = "";
    normalized.hash = "";
    return normalized.toString().replace(/\/$/, "");
  } catch {
    return FALLBACK_URL;
  }
}

export function getSiteUrl(): string {
  return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK_URL);
}

export function withSiteUrl(pathname: string): string {
  const base = getSiteUrl();
  return new URL(pathname, `${base}/`).toString();
}
