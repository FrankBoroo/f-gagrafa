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
