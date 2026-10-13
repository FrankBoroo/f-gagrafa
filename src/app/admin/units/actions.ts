"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { unitUpdateSchema, type UnitUpdateInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

export async function updateUnit(input: UnitUpdateInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = unitUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid unit details" };
  }
  const { id, ...fields } = parsed.data;

  const supabase = createServiceClient();
  const { error } = await supabase.from("units").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.updated", "unit", id, fields);
  revalidatePath("/admin/units");
  revalidatePath("/units");
  return { ok: true };
}

export async function toggleUnitActive(id: string, isActive: boolean) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();
  const { error } = await supabase.from("units").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.active_toggled", "unit", id, { is_active: isActive });
  revalidatePath("/admin/units");
  revalidatePath("/units");
  return { ok: true };
}
