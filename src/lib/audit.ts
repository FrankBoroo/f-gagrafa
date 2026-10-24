import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { log } from "@/lib/logger";
import type { Json } from "@/types/database";

// Fire-and-forget: a failed audit write should never block the action it's
// logging. Call this from server actions, after the real write succeeds.
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, Json | undefined>
) {
  try {
    const profile = await getCurrentProfile();
    const supabase = createServiceClient();
    await supabase.from("audit_log").insert({
      actor_id: profile?.id ?? null,
      actor_email: profile?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ?? null,
    });
  } catch (err) {
    log.error("audit.write_failed", { action, entity_type: entityType, entity_id: entityId }, err);
  }
}
