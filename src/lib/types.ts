import type { Enums, Tables } from "@/types/database";

// Row and enum types come from the generated src/types/database.ts (`npm run db:types`).
export type UnitType = Enums<"unit_type">;
export type BookingStatus = Enums<"booking_status">;
export type PaymentStatus = Enums<"payment_status">;
export type PaymentMethod = Enums<"payment_method">;
export type ServiceRequestType = Enums<"service_request_type">;
export type ServiceRequestStatus = Enums<"service_request_status">;
export type Currency = Enums<"booking_currency">;
export type UserRole = Enums<"user_role">;

// amenities and images are jsonb columns that always hold lists of strings.
export type Unit = Omit<Tables<"units">, "amenities" | "images"> & { amenities: string[]; images: string[] };
// Totals are in cedis; display_currency / display_total / exchange_rate are set only for
// bookings made with USD prices (migration-usd-pricing.sql).
export type Booking = Tables<"bookings">;
export type ServiceRequest = Tables<"service_requests">;

// No 0/O or 1/I, so guests can read the code back over the phone. 32 symbols divide 256
// evenly, so every symbol is equally likely.
const BOOKING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BOOKING_CODE_LENGTH = 6;

// Also the Paystack reference. Six random symbols (about a billion combinations) keep
// collisions with the unique `booking_code` column out of reach.
export function generateBookingCode(now: Date = new Date()): string {
  const bytes = new Uint8Array(BOOKING_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b: number) => BOOKING_CODE_ALPHABET[b % BOOKING_CODE_ALPHABET.length]).join("");
  return `GAG-${now.getUTCFullYear()}-${rand}`;
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  return Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
}
