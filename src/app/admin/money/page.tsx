import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Wallet } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { formatDate, formatMoney, formatMonthYear } from "@/lib/format";
import { toISODate } from "@/lib/booking/dates";
import { roomLabel } from "@/lib/booking/room-assignment";
import { netPaid } from "@/lib/admin/guests";
import {
  balancesOwed,
  monthRange,
  occupancyByRoom,
  occupancyPercent,
  revenueByType,
  type BalanceOwed,
  type MoneyBooking,
  type RoomOccupancy,
  type TypeRevenue,
} from "@/lib/admin/money";
import { EmptyState } from "@/components/ui/EmptyState";

const BOOKING_SELECT =
  "id, booking_code, guest_name, unit_id, room_id, check_in, check_out, status, payment_status, total_amount, currency, units(name), rooms(number), payments(amount, status)";

// Rows from Supabase, shaped for the Money functions.
function toMoneyBooking(b: any): MoneyBooking {
  return {
    id: b.id,
    booking_code: b.booking_code,
    guest_name: b.guest_name,
    unit_id: b.unit_id,
    unit_name: b.units?.name ?? "Apartment",
    room_id: b.room_id,
    room_number: b.rooms?.number ?? null,
    check_in: b.check_in,
    check_out: b.check_out,
    status: b.status,
    payment_status: b.payment_status,
    total_amount: Number(b.total_amount),
    net_paid: netPaid(b.payments),
    currency: b.currency ?? "GHS",
  };
}

export default async function AdminMoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  if (!(await isAdmin())) {
    return (
      <div>
        <h1 className="text-3xl">Money</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can view money.</p>
      </div>
    );
  }

  const params = await searchParams;
  const today = toISODate(new Date());
  const month = monthRange(params.month, today);
  const monthName = formatMonthYear(month.year, month.month);
  const supabase = createServiceClient();

  const [open, inMonth, monthPayments, activeRooms] = await Promise.all([
    // Every stay that could still owe money, whatever its dates.
    supabase.from("bookings").select(BOOKING_SELECT).in("status", ["pending", "confirmed", "checked_in"]).order("check_in").limit(1000),
    // Stays with at least one night in the month.
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .not("status", "in", "(cancelled,no_show)")
      .lt("check_in", month.to)
      .gt("check_out", month.from)
      .limit(1000),
    supabase
      .from("payments")
      .select("amount, status")
      .in("status", ["success", "refunded"])
      .gte("paid_at", `${month.from}T00:00:00Z`)
      .lt("paid_at", `${month.to}T00:00:00Z`),
    supabase.from("rooms").select("id, number, units(name)").eq("is_active", true).order("number"),
  ]);
  const failed = Boolean(open.error || inMonth.error || monthPayments.error || activeRooms.error);

  const owedList = balancesOwed((open.data ?? []).map(toMoneyBooking), today);
  const monthStays = (inMonth.data ?? []).map(toMoneyBooking);
  const rooms = (activeRooms.data ?? []).map((r: any) => ({ id: r.id, number: r.number, unit_name: r.units?.name ?? "" }));
  const occupancy = occupancyByRoom({ rooms, bookings: monthStays, from: month.from, to: month.to });
  const revenue = revenueByType(monthStays);

  const payments = monthPayments.data ?? [];
  const received = netPaid(payments.filter((p: { status: string }) => p.status === "success"));
  const refunded = Math.abs(netPaid(payments.filter((p: { status: string }) => p.status === "refunded")));
  const owedTotal = Math.round(owedList.reduce((sum: number, b: BalanceOwed) => sum + b.owed, 0) * 100) / 100;
  const occupancyRate = occupancyPercent(
    occupancy.reduce((sum: number, r: RoomOccupancy) => sum + r.nightsBooked, 0),
    occupancy.reduce((sum: number, r: RoomOccupancy) => sum + r.nightsInRange, 0)
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Money</h1>
        <nav aria-label="Month" className="flex items-center gap-1">
          <Link href={`/admin/money?month=${month.previous}`} aria-label="Previous month" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-navy/60 hover:bg-white hover:text-navy">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="min-w-[9rem] text-center text-sm text-navy">{monthName}</p>
          <Link href={`/admin/money?month=${month.next}`} aria-label="Next month" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-navy/60 hover:bg-white hover:text-navy">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </nav>
      </div>

      {failed && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Some of these numbers could not be loaded. Refresh the page to try again.
        </p>
      )}

      <dl className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={`Received in ${monthName}`} value={formatMoney(received, "GHS")} />
        <Stat label={`Refunded in ${monthName}`} value={formatMoney(refunded, "GHS")} />
        <Stat label="Balances owed now" value={formatMoney(owedTotal, "GHS")} note={`${owedList.length} booking${owedList.length === 1 ? "" : "s"}`} />
        <Stat label={`Occupancy in ${monthName}`} value={`${occupancyRate}%`} note={`${rooms.length} room${rooms.length === 1 ? "" : "s"} in use`} />
      </dl>

      <section className="mt-10" aria-labelledby="money-owed">
        <h2 id="money-owed" className="text-xl">Balances owed</h2>
        <p className="mt-1 text-sm text-navy/50">Due by arrival. Open the booking to record a payment.</p>
        {owedList.length === 0 ? (
          <EmptyState compact className="mt-4" icon={Wallet} title="Nobody owes a balance" description="Stays paid in part appear here until the rest is recorded." />
        ) : (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
                <tr>
                  <th scope="col" className="px-5 py-3 font-normal">Guest</th>
                  <th scope="col" className="px-5 py-3 font-normal">Apartment</th>
                  <th scope="col" className="px-5 py-3 font-normal">Check-in</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Owed</th>
                  <th scope="col" className="px-5 py-3 font-normal"><span className="sr-only">Booking</span></th>
                </tr>
              </thead>
              <tbody>
                {owedList.map((b: BalanceOwed) => (
                  <tr key={b.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-4">
                      <p className="text-navy">{b.guest_name}</p>
                      <p className="text-xs text-navy/50">{b.booking_code}</p>
                    </td>
                    <td className="px-5 py-4 text-navy/70">
                      {b.unit_name}
                      {typeof b.room_number === "number" && <> · {roomLabel(b.room_number)}</>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-navy/70">
                      {formatDate(b.check_in)}
                      {b.overdue && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Due now</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-navy">{formatMoney(b.owed, b.currency)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/bookings?q=${encodeURIComponent(b.booking_code)}`} className="inline-flex min-h-11 items-center text-xs text-navy underline decoration-champagne underline-offset-4">
                        Open booking
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="money-types">
          <h2 id="money-types" className="text-xl">Paid by apartment type</h2>
          <p className="mt-1 text-sm text-navy/50">What stays with a night in {monthName} have paid so far, net of refunds.</p>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
                <tr>
                  <th scope="col" className="px-5 py-3 font-normal">Type</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Nightly stays</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Monthly stays</th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r: TypeRevenue) => (
                  <tr key={r.unitId} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-3 text-navy">{r.unitName}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-navy/70">{formatMoney(r.nightly, "GHS")}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-navy/70">{formatMoney(r.monthly, "GHS")}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-navy">{formatMoney(r.total, "GHS")}</td>
                  </tr>
                ))}
                {revenue.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-navy/60">No stays in {monthName}.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="money-rooms">
          <h2 id="money-rooms" className="text-xl">Occupancy by room</h2>
          <p className="mt-1 text-sm text-navy/50">Nights booked in {monthName}, per room in use.</p>
          <div className="card mt-4 p-5">
            {occupancy.length === 0 ? (
              <p className="py-3 text-center text-sm text-navy/60">No rooms are in use. Add or switch on rooms in Apartments.</p>
            ) : (
              <ul className="space-y-3">
                {occupancy.map((r: RoomOccupancy) => (
                  <li key={r.roomId} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
                    <div>
                      <p className="text-navy">{r.label}</p>
                      <p className="truncate text-xs text-navy/50">{r.unitName}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                      <div className="h-full rounded-full bg-champagne" style={{ width: `${Math.min(r.percent, 100)}%` }} />
                    </div>
                    <p className="whitespace-nowrap text-right text-navy/70">
                      {r.percent}% <span className="text-xs text-navy/50">· {r.nightsBooked} of {r.nightsInRange}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="mt-10" aria-labelledby="money-export">
        <h2 id="money-export" className="text-xl">Download</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/admin/export/bookings" className="btn-secondary min-h-11 gap-2 px-5 py-2 text-xs">
            <Download className="h-4 w-4" aria-hidden="true" /> All bookings (CSV)
          </a>
          <a href="/api/admin/export/payments" className="btn-secondary min-h-11 gap-2 px-5 py-2 text-xs">
            <Download className="h-4 w-4" aria-hidden="true" /> All payments (CSV)
          </a>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card p-6">
      <dt className="text-xs uppercase tracking-widest text-navy/50">{label}</dt>
      <dd className="mt-3 text-3xl text-navy">{value}</dd>
      {note && <dd className="mt-1 text-xs text-navy/50">{note}</dd>}
    </div>
  );
}
