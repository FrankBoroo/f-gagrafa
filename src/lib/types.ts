export type UnitType = "studio" | "1bed_standard" | "1bed_executive" | "2bed" | "penthouse";
export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
export type PaymentStatus = "unpaid" | "paid" | "partial" | "refunded";
export type PaymentMethod = "paystack" | "momo" | "cash" | "bank";
export type ServiceRequestType = "cleaning" | "towels" | "maintenance" | "other";
export type ServiceRequestStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type Currency = "GHS" | "USD";
export type UserRole = "guest" | "admin" | "staff";

export interface Unit {
  id: string;
  name: string;
  slug: string;
  type: UnitType;
  description: string | null;
  short_description: string | null;
  base_price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number | null;
  amenities: string[];
  images: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Booking {
  id: string;
  booking_code: string;
  unit_id: string;
  guest_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  total_amount: number;
  currency: Currency;
  status: BookingStatus;
  payment_status: PaymentStatus;
  special_requests: string | null;
  admin_notes: string | null;
}

export interface ServiceRequest {
  id: string;
  booking_id: string;
  type: ServiceRequestType;
  description: string | null;
  status: ServiceRequestStatus;
  created_at: string;
}

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
