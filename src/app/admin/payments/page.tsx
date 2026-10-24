import { createServiceClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { isAdmin } from "@/lib/auth";
import { oneOf } from "@/lib/db-values";
import { Constants } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";
import { Wallet } from "lucide-react";

const methodLabel: Record<string, string> = {
  paystack: "Paystack",
  momo: "Mobile Money",
  cash: "Cash",
  bank: "Bank transfer",
};

const statusColor: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  refunded: "bg-violet-100 text-violet-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string }>;
}) {
  if (!(await isAdmin())) {
    return (
      <div>
        <h1 className="text-3xl">Payments</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can view payment records.</p>
      </div>
    );
  }

  const params = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from("payments")
    .select("*, bookings(booking_code, guest_name)")
    .order("created_at", { ascending: false });

  const method = oneOf(Constants.public.Enums.payment_method, params.method);
  if (method) query = query.eq("method", method);

  const { data: payments } = await query.limit(200);

  const totalCollected = (payments ?? [])
    .filter((p: any) => p.status === "success" || p.status === "refunded")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Payments</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-navy/50">
            {payments?.length ?? 0} transactions · {formatMoney(totalCollected)} net collected
          </span>
          <a href="/api/admin/export/payments" className="btn-secondary px-5 py-2.5 text-sm">Export CSV</a>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {["all", "paystack", "momo", "cash", "bank"].map((m) => (
          <a
            key={m}
            href={m === "all" ? "/admin/payments" : `/admin/payments?method=${m}`}
            className={`rounded-full border px-4 py-2 text-sm capitalize ${
              (params.method ?? "all") === m
                ? "border-navy bg-navy text-ivory"
                : "border-navy/20 text-navy/70"
            }`}
          >
            {m === "all" ? "All methods" : methodLabel[m]}
          </a>
        ))}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Booking</th>
              <th className="px-5 py-3">Guest</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments?.map((p: any) => (
              <tr key={p.id} className="border-b border-navy/5">
                <td className="px-5 py-4">{formatDate(p.paid_at ?? p.created_at)}</td>
                <td className="px-5 py-4">{p.bookings?.booking_code ?? "—"}</td>
                <td className="px-5 py-4">{p.bookings?.guest_name ?? "—"}</td>
                <td className="px-5 py-4">{methodLabel[p.method] ?? p.method}</td>
                <td className="px-5 py-4 text-navy/50">{p.paystack_reference ?? "—"}</td>
                <td className="px-5 py-4">{formatMoney(p.amount, p.currency)}</td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs capitalize ${statusColor[p.status] ?? "bg-navy/10 text-navy/60"}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payments?.length && (
          <EmptyState compact icon={Wallet} title="No payments yet" description="Paystack payments, recorded cash or MoMo payments and refunds all show up here." className="m-5" />
        )}
      </div>
    </div>
  );
}
