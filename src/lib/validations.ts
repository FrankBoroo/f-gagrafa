import { z } from "zod";

export const guestDetailsSchema = z.object({
  guest_name: z.string().trim().min(2, "Enter your full name").max(100, "Name is too long"),
  guest_email: z.string().trim().max(254, "Email is too long").email("Enter a valid email"),
  guest_phone: z.string().trim().min(9, "Enter a valid phone number").max(30, "Enter a valid phone number"),
  special_requests: z.string().max(1000).optional(),
});
export type GuestDetails = z.infer<typeof guestDetailsSchema>;

export const createBookingSchema = guestDetailsSchema.extend({
  unit_id: z.string().uuid("Select a residence"),
  check_in: z.string().min(1, "Select a check-in date"),
  check_out: z.string().min(1, "Select a check-out date"),
  // The residence's own max_guests is checked in the booking action; 30 is the most any can sleep.
  adults: z.coerce.number().int().min(1, "At least 1 adult").max(30),
  children: z.coerce.number().int().min(0).max(30).default(0),
  promo_code: z.string().max(40).optional(),
  payment_option: z.enum(["full", "deposit"]).default("full"),
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

// Everything about a residence except its photos and slug (the slug is generated on
// creation and then kept stable so links and search results never break).
export const unitDetailsSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  type: z.enum(["studio", "1bed_standard", "1bed_executive", "2bed", "penthouse"]),
  short_description: z.string().trim().max(300),
  description: z.string().trim().max(3000),
  base_price_per_night: z.coerce.number().positive("Price must be greater than 0"),
  max_guests: z.coerce.number().int().min(1, "At least 1 guest").max(30),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().min(0).max(20),
  size_sqm: z.number().min(0).max(5000).nullable(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(40),
  access_code: z.string().trim().max(50),
  is_active: z.boolean(),
});
export type UnitDetailsInput = z.infer<typeof unitDetailsSchema>;

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  fullName: z.string().trim().max(100),
  role: z.enum(["admin", "staff"]),
});
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

export const cancelRefundSchema = z.object({
  bookingId: z.string().uuid(),
  refundMethod: z.enum(["none", "paystack", "cash", "bank", "momo"]),
  refundAmount: z.coerce.number().min(0),
  reason: z.string().trim().max(500),
});
export type CancelRefundInput = z.infer<typeof cancelRefundSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose valid dates");
export const bookingDatesSchema = z
  .object({
    bookingId: z.string().uuid(),
    check_in: isoDate,
    check_out: isoDate,
    total_amount: z.coerce.number().min(0, "Total can't be negative"),
  })
  .refine((d) => d.check_out > d.check_in, { message: "Check-out must be after check-in", path: ["check_out"] });
export type BookingDatesInput = z.infer<typeof bookingDatesSchema>;

export const recordPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce.number().positive("Enter an amount above 0"),
  method: z.enum(["cash", "bank", "momo"]),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

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
