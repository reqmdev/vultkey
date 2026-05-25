import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-session";

export async function getVerifiedUser() {
  const supabase = await createSupabaseServerClient();

  let user: User | null = null;
  let error: unknown = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
  } catch (caught) {
    error = caught;
  }

  if (error || !user) {
    if (error && !isInvalidRefreshTokenError(error)) {
      console.warn("Supabase user verification failed.", error);
    }

    return { supabase, user: null as User | null };
  }

  return { supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getVerifiedUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
