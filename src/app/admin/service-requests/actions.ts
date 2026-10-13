"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

const statusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);

export async function updateServiceRequestStatus(id: string, status: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("service_requests")
    .update({
      status: parsed.data,
      resolved_at: parsed.data === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await logAudit("service_request.status_changed", "service_request", id, { status: parsed.data });
  revalidatePath("/admin/service-requests");
  return { ok: true };
}
