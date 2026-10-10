import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { GuestSearch } from "@/components/admin/GuestSearch";

interface GuestSummary {
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  bookingCount: number;
  totalSpent: number;
  lastStay: string;
  statuses: Set<string>;
}

export default async function AdminGuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from("bookings")
    .select("guest_name, guest_email, guest_phone, total_amount, currency, check_in, status, payment_status")
    .order("check_in", { ascending: false });

  if (params.q) {
    const term = params.q.replace(/[%,]/g, "");
    query = query.or(`guest_name.ilike.%${term}%,guest_email.ilike.%${term}%`);
  }

  const { data: bookings } = await query.limit(500);

  // Group bookings by guest_email — The Gagrafa doesn't require guest accounts,
  // so the email on each booking is the closest thing to a guest record.
  const guestMap = new Map<string, GuestSummary>();
  for (const b of bookings ?? []) {
    const key = b.guest_email;
    const existing = guestMap.get(key);
    if (existing) {
      existing.bookingCount += 1;
      if (b.payment_status === "paid") existing.totalSpent += Number(b.total_amount);
      if (b.check_in > existing.lastStay) existing.lastStay = b.check_in;
      existing.statuses.add(b.status);
    } else {
      guestMap.set(key, {
        guest_name: b.guest_name,
        guest_email: b.guest_email,
        guest_phone: b.guest_phone,
        bookingCount: 1,
        totalSpent: b.payment_status === "paid" ? Number(b.total_amount) : 0,
        lastStay: b.check_in,
        statuses: new Set([b.status]),
      });
    }
  }
  const guests = Array.from(guestMap.values()).sort((a, b) => (a.lastStay < b.lastStay ? 1 : -1));

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
              <th className="px-5 py-3">Current status</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.guest_email} className="border-b border-navy/5">
                <td className="px-5 py-4">{g.guest_name}</td>
                <td className="px-5 py-4">
                  <p>{g.guest_email}</p>
                  <p className="text-navy/50">{g.guest_phone}</p>
                </td>
                <td className="px-5 py-4">{g.bookingCount}</td>
                <td className="px-5 py-4">{formatCurrency(g.totalSpent)}</td>
                <td className="px-5 py-4">{g.lastStay}</td>
                <td className="px-5 py-4 capitalize">{Array.from(g.statuses).join(", ").replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!guests.length && <p className="p-8 text-center text-navy/40">No guests yet.</p>}
      </div>
    </div>
  );
}
