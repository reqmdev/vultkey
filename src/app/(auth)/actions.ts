"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guards";
import { assertServerActionSameOrigin } from "@/lib/security/server-action";

export async function logoutAction() {
  await assertServerActionSameOrigin();

  const { supabase, user } = await requireUser();

  await recordAudit(supabase, user.id, {
    eventType: "auth.logout",
    entityType: "user",
    entityId: user.id
  });

  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
