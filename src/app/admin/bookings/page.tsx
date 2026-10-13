import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { BookingFilters } from "@/components/admin/BookingFilters";
import { BookingCard } from "@/components/admin/BookingCard";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment_status?: string }>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from("bookings")
    .select("*, units(name)")
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);
  if (params.payment_status) query = query.eq("payment_status", params.payment_status);
  if (params.q) {
    const term = params.q.replace(/[%,]/g, "");
    query = query.or(
      `guest_name.ilike.%${term}%,guest_email.ilike.%${term}%,booking_code.ilike.%${term}%`
    );
  }

  const { data: bookings } = await query.limit(100);

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
        {bookings?.map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
      </div>

      {!bookings?.length && (
        <p className="mt-14 text-center text-navy/40">No bookings match these filters.</p>
      )}
    </div>
  );
}
