"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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
  reception_hours: z.string().max(120).optional(),
  wifi_network: z.string().max(100).optional(),
  wifi_password: z.string().max(100).optional(),
  entry_instructions: z.string().max(1500).optional(),
  house_rules: z.string().max(1500).optional(),
  emergency_contact: z.string().max(300).optional(),
  deposit_percent: z.coerce.number().int().min(0).max(90).optional(),
  price_currency: z.enum(["GHS", "USD"]).optional(),
  // Blank clears the rate; otherwise cedis per dollar.
  usd_to_ghs_rate: z
    .union([z.literal(""), z.coerce.number().positive("The exchange rate must be above 0").max(10000)])
    .optional(),
}).refine((s) => s.price_currency !== "USD" || (typeof s.usd_to_ghs_rate === "number" && s.usd_to_ghs_rate > 0), {
  message: "Add the exchange rate (GH₵ per $1) before switching prices to USD",
});

export async function updatePropertySettings(input: z.infer<typeof settingsSchema>) {
  if (!(await isAdmin())) return { ok: false, error: "Only admins can change settings" };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }
  const { id, usd_to_ghs_rate, ...rest } = parsed.data;
  const fields = {
    ...rest,
    ...(usd_to_ghs_rate !== undefined ? { usd_to_ghs_rate: usd_to_ghs_rate === "" ? null : usd_to_ghs_rate } : {}),
  };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("property_settings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    // 42703 / PGRST204 = a column is missing: the newest migration hasn't been run yet.
    if (error.code === "42703" || error.code === "PGRST204") {
      return { ok: false, error: "The database is missing some settings columns. Run the migrations listed in the README in the Supabase SQL Editor, then try again." };
    }
    console.error("settings update failed", error);
    return { ok: false, error: "Could not save settings. Please try again." };
  }

  // Never write the Wi-Fi password into the audit log.
  const { wifi_password: _omit, ...auditFields } = fields;
  await logAudit("settings.updated", "property_settings", id, auditFields);
  revalidateTag("settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
