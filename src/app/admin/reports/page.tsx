import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { BarChart } from "@/components/admin/BarChart";
import { isAdmin } from "@/lib/auth";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminReportsPage() {
  if (!(await isAdmin())) {
    return (
      <div>
        <h1 className="text-3xl">Reports</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can view reports.</p>
      </div>
    );
  }

  const supabase = createServiceClient();

  const days = 30;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const startKey = dateKey(start);

  const [{ data: payments }, { data: bookings }, { count: activeUnitCount }] = await Promise.all([
    supabase.from("payments").select("amount, paid_at").in("status", ["success", "refunded"]).gte("paid_at", start.toISOString()),
    supabase.from("bookings").select("unit_id, check_in, check_out, status").not("status", "in", "(cancelled,no_show)").gte("check_out", startKey),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const unitCount = activeUnitCount || 1;

  const dayLabels: string[] = [];
  const revenueByDay = new Map<string, number>();
  const occupiedUnitsByDay = new Map<string, Set<string>>();

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    dayLabels.push(key);
    revenueByDay.set(key, 0);
    occupiedUnitsByDay.set(key, new Set());
  }

  for (const p of payments ?? []) {
    const key = (p.paid_at ?? "").slice(0, 10);
    if (revenueByDay.has(key)) revenueByDay.set(key, revenueByDay.get(key)! + Number(p.amount));
  }

  // Occupancy: for each day in range, which distinct units have a booking covering that night.
  for (const label of dayLabels) {
    const occupied = occupiedUnitsByDay.get(label)!;
    for (const b of bookings ?? []) {
      if (b.check_in <= label && label < b.check_out) occupied.add(b.unit_id);
    }
  }

  const revenueData = dayLabels.map((d) => ({ label: d.slice(5), value: revenueByDay.get(d) ?? 0 }));
  const occupancyData = dayLabels.map((d) => ({
    label: d.slice(5),
    value: Math.round(((occupiedUnitsByDay.get(d)?.size ?? 0) / unitCount) * 100),
  }));

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.value, 0);
  const avgOccupancy = Math.round(occupancyData.reduce((sum, d) => sum + d.value, 0) / occupancyData.length);
  const totalBookingsInRange = (bookings ?? []).length;

  return (
    <div>
      <h1 className="text-3xl">Reports</h1>
      <p className="mt-2 text-sm text-navy/50">Last {days} days.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <StatCard label="Revenue (net of refunds)" value={formatCurrency(totalRevenue)} />
        <StatCard label="Average occupancy" value={`${avgOccupancy}%`} />
        <StatCard label="Active bookings" value={String(totalBookingsInRange)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg">Daily revenue</h2>
          <div className="mt-6">
            <BarChart data={revenueData} valueFormatter={(v) => formatCurrency(v)} color="#C9A66B" />
          </div>
        </div>
        <div className="card p-6">
          <h2 className="text-lg">Daily occupancy</h2>
          <div className="mt-6">
            <BarChart data={occupancyData} valueFormatter={(v) => `${v}%`} color="#0F1620" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-6">
      <p className="text-xs uppercase tracking-widest text-navy/50">{label}</p>
      <p className="mt-3 text-3xl">{value}</p>
    </div>
  );
}
