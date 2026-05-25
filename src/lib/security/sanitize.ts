const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value: string, maxLength: number) {
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeOptionalText(value: string | null | undefined, maxLength: number) {
  const sanitized = sanitizeText(value ?? "", maxLength);
  return sanitized.length > 0 ? sanitized : null;
}

export function sanitizeMultiline(value: string | null | undefined, maxLength: number) {
  const sanitized = (value ?? "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

  return sanitized.length > 0 ? sanitized : null;
}

export function normalizeGameKey(value: string) {
  return value.replace(/[\s-]+/g, "").toUpperCase();
}

export function createKeyMask(value: string) {
  const segments = value
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);

  if (segments.length > 1) {
    return segments.map(() => "*****").join("-");
  }

  const normalized = normalizeGameKey(value);
  const groups = Math.max(1, Math.min(4, Math.ceil(normalized.length / 5)));
  return Array.from({ length: groups }, () => "*****").join("-");
}

export function sanitizeSafePath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  return value;
}
