import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { groupGuests, netPaid, type GuestSummary } from "@/lib/admin/guests";
import { searchTerm } from "@/lib/db-values";
import { GuestSearch } from "@/components/admin/GuestSearch";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchX, Users } from "lucide-react";

export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from("bookings")
    .select("id, guest_name, guest_email, guest_phone, currency, check_in, status, payments(amount, status)")
    .order("check_in", { ascending: false });

  const term = searchTerm(params.q);
  if (term) {
    query = query.or(`guest_name.ilike.%${term}%,guest_email.ilike.%${term}%`);
  }

  const { data: bookings } = await query.limit(500);

  // Guests have no accounts, so everyone who booked with the same email is one guest.
  const guests = groupGuests(
    (bookings ?? []).map((b: any) => ({
      id: b.id,
      guest_name: b.guest_name,
      guest_email: b.guest_email,
      guest_phone: b.guest_phone ?? "",
      check_in: b.check_in,
      status: b.status,
      currency: b.currency ?? "GHS",
      net_paid: netPaid(b.payments),
    }))
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Guests</h1>
        <span className="text-sm text-navy/50">{guests.length} guests</span>
      </div>

      <div className="mt-6 max-w-md">
        <GuestSearch />
      </div>

      <div className="card mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
            <tr>
              <th className="px-5 py-3">Guest</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Stays</th>
              <th className="px-5 py-3">Total paid</th>
              <th className="px-5 py-3">Last check-in</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g: GuestSummary) => (
              <tr key={g.key} className="border-b border-navy/5">
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/guests/${g.latestBookingId}`}
                    className="text-navy underline decoration-champagne underline-offset-4 hover:decoration-navy"
                  >
                    {g.guest_name}
                  </Link>
                  {g.isReturning && (
                    <span className="ml-2 whitespace-nowrap rounded-full bg-champagne/20 px-2.5 py-0.5 text-xs text-navy/80">
                      Returning
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <p>{g.guest_email}</p>
                  <p className="text-navy/50">{g.guest_phone}</p>
                </td>
                <td className="px-5 py-4">{g.stays}</td>
                <td className="px-5 py-4">{formatMoney(g.totalPaid, g.currency)}</td>
                <td className="whitespace-nowrap px-5 py-4">{formatDate(g.lastStay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!guests.length && (term ? (
          <EmptyState compact icon={SearchX} title="No guests match that search" action={{ href: "/admin/guests", label: "Clear search" }} className="m-5" />
        ) : (
          <EmptyState compact icon={Users} title="No guests yet" description="Everyone who books appears here, grouped by email." className="m-5" />
        ))}
      </div>
    </div>
  );
}
