import { netPaid } from "@/lib/admin/guests";
import { balanceOwed } from "@/lib/admin/today";
import { calculateNights } from "@/lib/booking/dates";
import { phoneNumbers } from "@/lib/contact-links";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export interface ReceiptBooking {
  booking_code: string;
  guest_name: string;
  unit_name: string;
  room: string | null; // "Room 8", only once staff have confirmed it
  check_in: string;
  check_out: string;
  total_amount: number;
  currency: string;
  status: string;
}

export interface ReceiptPayment {
  id: string;
  date: string | null;
  method: string;
  amount: number; // refunds are negative
  status: string;
}

export interface ReceiptSettings {
  property_name: string;
  address: string;
  contact_phone: string;
  contact_email: string;
}

const METHODS: Record<string, string> = { paystack: "Card / Mobile Money (Paystack)", momo: "Mobile Money", cash: "Cash", bank: "Bank transfer" };

// A printable receipt for one booking. Plain props and no data loading, so the admin and
// the guest portal can both render it. Only money that was received or refunded is listed.
export function Receipt({
  booking,
  payments,
  settings,
}: {
  booking: ReceiptBooking;
  payments: ReceiptPayment[];
  settings: ReceiptSettings;
}) {
  const money = (amount: number) => formatMoney(amount, booking.currency);
  const lines = payments.filter((p: ReceiptPayment) => p.status === "success" || p.status === "refunded");
  const paid = netPaid(lines);
  const closed = booking.status === "cancelled" || booking.status === "no_show";
  const balance = closed ? 0 : balanceOwed({ total_amount: booking.total_amount, net_paid: paid });
  const nights = calculateNights(booking.check_in, booking.check_out);
  const phones = phoneNumbers(settings.contact_phone);

  return (
    <article className="mx-auto max-w-2xl bg-white p-8 text-sm text-navy shadow-soft print:max-w-none print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-champagne pb-6">
        <div>
          <p className="font-display text-2xl">{settings.property_name}</p>
          <p className="mt-1 text-navy/70">{settings.address}</p>
          <p className="text-navy/70">{[...phones, settings.contact_email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-navy/50">Receipt</p>
          <p className="mt-1 font-medium">{booking.booking_code}</p>
        </div>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/50">Guest</dt>
          <dd className="mt-1 break-words">{booking.guest_name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/50">Apartment</dt>
          <dd className="mt-1">
            {booking.unit_name}
            {booking.room && <> · {booking.room}</>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/50">Check-in</dt>
          <dd className="mt-1">{formatDate(booking.check_in)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy/50">Check-out</dt>
          <dd className="mt-1">
            {formatDate(booking.check_out)} · {nights} night{nights === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>

      {closed && (
        <p className="mt-6 rounded-lg bg-sand px-4 py-3 text-navy/70">
          This booking was {booking.status === "no_show" ? "a no-show" : "cancelled"}.
        </p>
      )}

      <table className="mt-8 w-full text-left">
        <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
          <tr>
            <th scope="col" className="py-2 font-normal">Date</th>
            <th scope="col" className="py-2 font-normal">Payment</th>
            <th scope="col" className="py-2 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((p: ReceiptPayment) => (
            <tr key={p.id} className="border-b border-navy/5">
              <td className="py-2 pr-3">{p.date ? formatDateTime(p.date) : ""}</td>
              <td className="py-2 pr-3">
                {p.status === "refunded" ? "Refund" : METHODS[p.method] ?? p.method}
              </td>
              <td className="whitespace-nowrap py-2 text-right">{money(p.amount)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-navy/50">No payments received yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 w-full max-w-xs space-y-2">
        <div className="flex justify-between">
          <dt className="text-navy/70">Stay total</dt>
          <dd>{money(booking.total_amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-navy/70">Paid</dt>
          <dd>{money(paid)}</dd>
        </div>
        <div className="flex justify-between border-t border-navy/10 pt-2 font-medium">
          <dt>Balance</dt>
          <dd>{money(balance)}</dd>
        </div>
      </dl>

      <p className="mt-10 text-xs text-navy/50">Issued {formatDate(new Date())}. Thank you for staying with us.</p>
    </article>
  );
}
