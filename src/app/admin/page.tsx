import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: checkIns }, { count: checkOuts }, { count: pendingRequests }, { data: monthPayments }] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("check_in", today),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("check_out", today),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payments").select("amount").gte("paid_at", new Date(new Date().setDate(1)).toISOString()),
  ]);

  const revenueThisMonth = (monthPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const cards = [
    { label: "Check-ins today", value: checkIns ?? 0 },
    { label: "Check-outs today", value: checkOuts ?? 0 },
    { label: "Revenue this month", value: formatCurrency(revenueThisMonth) },
    { label: "Pending requests", value: pendingRequests ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-3xl">Overview</h1>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-6">
            <p className="text-xs uppercase tracking-widest text-navy/50">{c.label}</p>
            <p className="mt-3 text-3xl">{c.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-sm text-navy/50">
        Occupancy %, a bookings calendar, and recent activity feed slot in here next.
      </p>
    </div>
  );
}
