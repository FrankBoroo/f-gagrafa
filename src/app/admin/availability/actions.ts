"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

const blockSchema = z.object({
  unit_id: z.string().uuid(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  reason: z.string().max(200).optional(),
}).refine((d) => new Date(d.end_date) > new Date(d.start_date), {
  message: "End date must be after start date",
  path: ["end_date"],
});

export async function addBlockedDate(input: z.infer<typeof blockSchema>) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid dates" };
  }

  const supabase = createServiceClient();

  // Reuse the same availability function bookings rely on, so an admin
  // can't block dates that overlap an existing confirmed stay unnoticed.
  const { data: available } = await supabase.rpc("is_unit_available", {
    p_unit_id: parsed.data.unit_id,
    p_check_in: parsed.data.start_date,
    p_check_out: parsed.data.end_date,
  });

  if (!available) {
    return { ok: false, error: "These dates overlap an existing booking or block" };
  }

  const { data: block, error } = await supabase.from("blocked_dates").insert(parsed.data).select().single();
  if (error) return { ok: false, error: error.message };

  await logAudit("availability.blocked", "blocked_dates", block?.id ?? null, parsed.data);
  revalidatePath("/admin/availability");
  return { ok: true };
}

export async function removeBlockedDate(id: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("availability.unblocked", "blocked_dates", id);
  revalidatePath("/admin/availability");
  return { ok: true };
}
