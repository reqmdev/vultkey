import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { auditFingerprint } from "@/lib/security/crypto";
import { getClientIp } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AuditInput = {
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, Json | undefined>;
};

function cleanMetadata(metadata: Record<string, Json | undefined> | undefined) {
  if (!metadata) return {};

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key, value]) => value !== undefined && !/key|secret|password|token/i.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value])
  ) as Json;
}

export async function recordAudit(supabase: SupabaseClient<Database>, userId: string, input: AuditInput) {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent");
  const ip = await getClientIp();
  let auditClient: SupabaseClient<Database> = supabase;

  try {
    auditClient = createSupabaseAdminClient();
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }

  const { error } = await auditClient.from("audit_logs").insert({
    user_id: userId,
    event_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    ip_hash: auditFingerprint(ip),
    user_agent_hash: auditFingerprint(userAgent),
    metadata: cleanMetadata(input.metadata)
  });

  if (error && process.env.NODE_ENV === "production") {
    throw error;
  }
}
