export function supabaseAuthCookieName(supabaseUrl: string) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

export function isSupabaseAuthCookie(name: string, authCookieName: string) {
  return name === authCookieName || name.startsWith(`${authCookieName}.`) || name === `${authCookieName}-code-verifier` || name.startsWith(`${authCookieName}-code-verifier.`);
}

export function isInvalidRefreshTokenError(error: unknown) {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";

  return code === "refresh_token_not_found" || /invalid refresh token|refresh token not found/i.test(message);
}
