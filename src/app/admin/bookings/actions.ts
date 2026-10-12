"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { bookingStatusSchema, guestDetailsSchema } from "@/lib/validations";
import { generateBookingCode } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

export async function updateBookingStatus(bookingId: string, status: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = bookingStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: parsed.data })
    .eq("id", bookingId);

  if (error) {
    // 23P01 = the database's double-booking guard: these dates were taken since.
    if (error.code === "23P01") {
      return { ok: false, error: "Those dates are now booked by someone else, so this booking can't be restored." };
    }
    return { ok: false, error: error.message };
  }

  await logAudit("booking.status_changed", "booking", bookingId, { status: parsed.data });
  revalidatePath("/admin/bookings");
  return { ok: true };
}

const manualBookingSchema = guestDetailsSchema.extend({
  unit_id: z.string().uuid("Select a residence"),
  check_in: z.string().min(1),
  check_out: z.string().min(1),
  adults: z.coerce.number().int().min(1),
  children: z.coerce.number().int().min(0).default(0),
  mark_as_paid: z.coerce.boolean().default(false),
  payment_method: z.enum(["cash", "bank", "momo"]).optional(),
  admin_notes: z.string().max(1000).optional(),
}).refine((d) => new Date(d.check_out) > new Date(d.check_in), {
  message: "Check-out must be after check-in",
  path: ["check_out"],
});
export type ManualBookingInput = z.infer<typeof manualBookingSchema>;

export async function createManualBooking(input: ManualBookingInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = manualBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid booking details" };
  }
  const data = parsed.data;

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, name, base_price_per_night")
    .eq("id", data.unit_id)
    .single();

  if (!unit) return { ok: false, error: "Residence not found" };

  // Release unpaid checkouts that were abandoned, so a ghost hold can't block these dates.
  await supabase.rpc("expire_stale_pending_bookings");

  const { data: available } = await supabase.rpc("is_unit_available", {
    p_unit_id: data.unit_id,
    p_check_in: data.check_in,
    p_check_out: data.check_out,
  });
  if (!available) return { ok: false, error: "Not available for the selected dates" };

  const nights = Math.round(
    (new Date(data.check_out).getTime() - new Date(data.check_in).getTime()) / 86_400_000
  );
  const totalAmount = nights * Number(unit.base_price_per_night);
  const bookingCode = generateBookingCode();

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      booking_code: bookingCode,
      unit_id: data.unit_id,
      check_in: data.check_in,
      check_out: data.check_out,
      adults: data.adults,
      children: data.children,
      guest_name: data.guest_name,
      guest_email: data.guest_email,
      guest_phone: data.guest_phone,
      special_requests: data.special_requests,
      admin_notes: data.admin_notes,
      total_amount: totalAmount,
      currency: "GHS",
      status: "confirmed",
      payment_status: data.mark_as_paid ? "paid" : "unpaid",
    })
    .select()
    .single();

  if (error || !booking) {
    if (error?.code === "23P01") {
      return { ok: false, error: "Those dates were just booked by someone else." };
    }
    return { ok: false, error: error?.message ?? "Could not create booking" };
  }

  if (data.mark_as_paid && data.payment_method) {
    await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: totalAmount,
      currency: "GHS",
      method: data.payment_method,
      status: "success",
      paid_at: new Date().toISOString(),
    });
  }

  await logAudit("booking.created_manually", "booking", booking.id, {
    booking_code: bookingCode, guest_email: data.guest_email, mark_as_paid: data.mark_as_paid,
  });

  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}
