"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseAuthCookieName } from "@/lib/supabase/auth-session";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey, {
    cookieOptions: {
      name: supabaseAuthCookieName(url),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  });
}
