"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isAdmin } from "@/lib/auth";

const settingsSchema = z.object({
  id: z.string().uuid(),
  property_name: z.string().min(2),
  tagline: z.string().max(200).optional(),
  contact_phone: z.string().max(40).optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(300).optional(),
  admin_notification_email: z.string().email().optional().or(z.literal("")),
  whatsapp_number: z.string().max(40).optional(),
});

export async function updatePropertySettings(input: z.infer<typeof settingsSchema>) {
  if (!(await isAdmin())) return { ok: false, error: "Only admins can change settings" };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }
  const { id, ...fields } = parsed.data;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("property_settings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await logAudit("settings.updated", "property_settings", id, fields);
  revalidatePath("/admin/settings");
  return { ok: true };
}
