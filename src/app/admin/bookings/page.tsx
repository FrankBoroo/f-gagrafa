import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { BookingFilters } from "@/components/admin/BookingFilters";
import { BookingCard } from "@/components/admin/BookingCard";
import { getPublicSettings } from "@/lib/site-settings";
import { oneOf, searchTerm } from "@/lib/db-values";
import { Constants } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarDays, SearchX } from "lucide-react";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment_status?: string }>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();
  const { pricing } = await getPublicSettings();

  let query = supabase
    .from("bookings")
    .select("*, units(name, base_price_per_night), payments(amount, status, method, paystack_reference)")
    .order("created_at", { ascending: false });

  const status = oneOf(Constants.public.Enums.booking_status, params.status);
  const paymentStatus = oneOf(Constants.public.Enums.payment_status, params.payment_status);
  if (status) query = query.eq("status", status);
  if (paymentStatus) query = query.eq("payment_status", paymentStatus);
  const term = searchTerm(params.q);
  if (term) {
    query = query.or(
      `guest_name.ilike.%${term}%,guest_email.ilike.%${term}%,booking_code.ilike.%${term}%`
    );
  }

  const { data: rawBookings } = await query.limit(100);
  const admin = await isAdmin();

  // Net money received per booking: successful payments minus refund rows (stored negative).
  const bookings = (rawBookings ?? []).map((b: any) => ({
    ...b,
    net_paid: (b.payments ?? [])
      .filter((p: any) => p.status === "success" || p.status === "refunded")
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Bookings</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-navy/50">{bookings?.length ?? 0} results</span>
          <a href="/api/admin/export/bookings" className="btn-secondary px-5 py-2.5 text-sm">Export CSV</a>
          <Link href="/admin/bookings/new" className="btn-primary px-5 py-2.5 text-sm">+ New booking</Link>
        </div>
      </div>

      <div className="mt-6">
        <BookingFilters />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {bookings.map((b: any) => (
          // The key includes the fields that change after an action, so the card re-mounts fresh.
          <BookingCard
            key={`${b.id}-${b.status}-${b.payment_status}-${b.check_in}-${b.check_out}-${b.total_amount}-${b.net_paid}`}
            booking={b}
            isAdmin={admin}
            pricing={pricing}
          />
        ))}
      </div>

      {!bookings.length &&
        (term || status || paymentStatus ? (
          <EmptyState
            icon={SearchX}
            title="No bookings match these filters"
            description="Try a different name, email or booking code, or clear the filters."
            action={{ href: "/admin/bookings", label: "Clear filters" }}
          />
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No bookings yet"
            description="Bookings made on the website appear here as soon as the guest starts checkout."
            action={{ href: "/admin/bookings/new", label: "Add a booking by hand" }}
          />
        ))}
    </div>
  );
}
