import { formatMoney } from "@/lib/format";
import { PayBalanceButton } from "@/components/portal/PayBalanceButton";

export function BalanceCard({
  total,
  paid,
  owed,
  currency,
  bookedSuffix,
  canPay,
  bookingId,
  awaitingPayment = false,
  refunded = 0,
  afterArrival = false,
}: {
  total: number;
  paid: number;
  owed: number;
  currency: string;
  bookedSuffix: string;
  canPay: boolean;
  bookingId: string;
  awaitingPayment?: boolean;
  refunded?: number;
  /** Checked in or out: the balance is simply due, no longer "by arrival". */
  afterArrival?: boolean;
}) {
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((paid / total) * 100))) : 0;
  const settled = owed <= 0.005;

  return (
    <section className="card p-6" aria-label="Payment">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl">Payment</h2>
        <p className="text-sm text-navy/60">
          Total {formatMoney(total, currency)}
          {bookedSuffix}
        </p>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Share of the total paid"
      >
        <div className="h-full rounded-full bg-champagne" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-sm text-navy/70">Paid {formatMoney(paid, currency)}</p>

      {settled ? (
        <p className="mt-4 border-t border-navy/10 pt-4 text-sm text-navy">Paid in full</p>
      ) : (
        <div className="mt-4 border-t border-navy/10 pt-4">
          <p className="text-sm text-navy/70">
            {afterArrival ? "Balance due" : "Balance due by arrival"} <span className="font-medium text-navy">{formatMoney(owed, currency)}</span>
          </p>
          {canPay && (
            <div className="mt-4">
              <PayBalanceButton bookingId={bookingId} owed={owed} currency={currency} />
            </div>
          )}
        </div>
      )}

      {awaitingPayment && <p className="mt-3 text-xs text-navy/60">Your booking is waiting for payment.</p>}
      {refunded > 0 && <p className="mt-3 text-xs text-navy/60">Refunded {formatMoney(refunded, currency)}</p>}
    </section>
  );
}
