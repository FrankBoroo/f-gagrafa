"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { updateBookingStatus } from "@/app/admin/bookings/actions";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  checked_in: "bg-sky-100 text-sky-700",
  checked_out: "bg-navy/10 text-navy/60",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
};

const paymentColor: Record<string, string> = {
  unpaid: "text-red-600",
  paid: "text-emerald-600",
  partial: "text-amber-600",
  refunded: "text-navy/50",
};

export function BookingCard({ booking }: { booking: any }) {
  const [status, setStatus] = useState(booking.status);
  const [isPending, startTransition] = useTransition();

  function act(next: string) {
    startTransition(async () => {
      const result = await updateBookingStatus(booking.id, next);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update booking");
        return;
      }
      setStatus(next);
      toast.success(`Booking ${next.replace("_", " ")}`);
    });
  }

  const actions: { label: string; next: string; style: string }[] = [];
  if (status === "pending") actions.push({ label: "Confirm", next: "confirmed", style: "btn-primary" });
  if (status === "confirmed") actions.push({ label: "Check In", next: "checked_in", style: "btn-primary" });
  if (status === "checked_in") actions.push({ label: "Check Out", next: "checked_out", style: "btn-primary" });
  if (!["cancelled", "checked_out", "no_show"].includes(status)) {
    actions.push({ label: "Cancel", next: "cancelled", style: "btn-secondary" });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">{booking.guest_name}</p>
          <p className="text-xs text-navy/50">{booking.guest_email} · {booking.guest_phone}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${statusColor[status]}`}>
          {status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-navy/70 sm:grid-cols-4">
        <Field label="Code" value={booking.booking_code} />
        <Field label="Unit" value={booking.units?.name ?? "—"} />
        <Field label="Dates" value={`${booking.check_in} → ${booking.check_out}`} />
        <Field label="Guests" value={`${booking.adults + (booking.children ?? 0)}`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy/10 pt-4">
        <div className="text-sm">
          <span className="text-navy">{formatCurrency(booking.total_amount, booking.currency)}</span>
          <span className={`ml-2 capitalize ${paymentColor[booking.payment_status]}`}>
            {booking.payment_status}
          </span>
        </div>
        <div className="flex gap-2">
          {actions.map((a) => (
            <button
              key={a.next}
              className={`${a.style} px-4 py-2 text-xs`}
              disabled={isPending}
              onClick={() => act(a.next)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {booking.special_requests && (
        <p className="mt-4 rounded-lg bg-sand px-4 py-3 text-sm text-navy/70">
          <span className="text-xs uppercase tracking-widest text-navy/40">Special requests </span>
          {booking.special_requests}
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-navy/40">{label}</p>
      <p>{value}</p>
    </div>
  );
}
