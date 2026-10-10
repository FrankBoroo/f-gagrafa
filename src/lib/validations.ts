import { z } from "zod";

export const guestDetailsSchema = z.object({
  guest_name: z.string().min(2, "Enter your full name"),
  guest_email: z.string().email("Enter a valid email"),
  guest_phone: z.string().min(9, "Enter a valid phone number"),
  special_requests: z.string().max(1000).optional(),
});
export type GuestDetails = z.infer<typeof guestDetailsSchema>;

export const createBookingSchema = guestDetailsSchema.extend({
  unit_id: z.string().uuid("Select a residence"),
  check_in: z.string().min(1, "Select a check-in date"),
  check_out: z.string().min(1, "Select a check-out date"),
  adults: z.coerce.number().int().min(1, "At least 1 adult"),
  children: z.coerce.number().int().min(0).default(0),
  promo_code: z.string().optional(),
  honeypot: z.string().optional(),
  renderedAt: z.number().optional(),
}).refine((data) => new Date(data.check_out) > new Date(data.check_in), {
  message: "Check-out must be after check-in",
  path: ["check_out"],
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const contactMessageSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  message: z.string().min(10, "Message should be at least 10 characters").max(2000),
});
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export const unitUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, "Name is required"),
  short_description: z.string().max(300).optional().nullable(),
  base_price_per_night: z.coerce.number().positive("Price must be greater than 0"),
  max_guests: z.coerce.number().int().min(1, "At least 1 guest"),
  is_active: z.coerce.boolean(),
});
export type UnitUpdateInput = z.infer<typeof unitUpdateSchema>;

export const bookingStatusSchema = z.enum([
  "pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show",
]);

export const promoCodeSchema = z.object({
  code: z.string().min(3, "At least 3 characters").max(30).transform((v) => v.toUpperCase().trim()),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().positive("Must be greater than 0"),
  max_uses: z.coerce.number().int().positive().optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
}).refine(
  (d) => d.discount_type !== "percent" || d.discount_value <= 100,
  { message: "Percent discount can't exceed 100", path: ["discount_value"] }
);
export type PromoCodeInput = z.infer<typeof promoCodeSchema>;
