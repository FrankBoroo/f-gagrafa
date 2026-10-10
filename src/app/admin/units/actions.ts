"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { unitUpdateSchema, type UnitUpdateInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

export async function updateUnit(input: UnitUpdateInput) {
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
  const supabase = createServiceClient();
  const { error } = await supabase.from("units").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.active_toggled", "unit", id, { is_active: isActive });
  revalidatePath("/admin/units");
  revalidatePath("/units");
  return { ok: true };
}
