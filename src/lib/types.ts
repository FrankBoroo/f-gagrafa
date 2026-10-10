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

export function generateBookingCode(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GAG-${year}-${rand}`;
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  return Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
}
