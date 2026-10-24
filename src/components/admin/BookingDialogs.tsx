"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/admin/Modal";
import { formatCurrency } from "@/lib/utils";
import { asResult } from "@/lib/action-result";
import { addDays, calculateNights } from "@/lib/booking/dates";
import { toChargeAmount, type Pricing } from "@/lib/booking/pricing";
import { daysUntilCheckIn, refundPercentFor, suggestedRefund } from "@/lib/booking/cancellation-policy";
import { cancelBookingWithRefund, updateBookingDates, recordPayment } from "@/app/admin/bookings/actions";

interface DialogProps {
  booking: any;
  open: boolean;
  onClose: () => void;
}

const inputClass = "mt-2 w-full rounded-lg border border-navy/15 px-4 py-3 text-sm";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-navy/60">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Edit dates
export function EditDatesDialog({ booking, open, onClose, pricing }: DialogProps & { pricing: Pricing }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkIn, setCheckIn] = useState<string>(booking.check_in);
  const [checkOut, setCheckOut] = useState<string>(booking.check_out);
  const [total, setTotal] = useState<number>(Number(booking.total_amount));

  const nights = checkIn && checkOut ? Math.max(calculateNights(checkIn, checkOut), 0) : 0;
  const rate = Number(booking.units?.base_price_per_night ?? 0);
  // The total is in cedis. A booking made with USD prices keeps its own rate; otherwise use today's.
  const bookingRate = Number(booking.exchange_rate) || null;
  const suggested =
    toChargeAmount(nights * rate, bookingRate ? { currency: "USD", usdToGhsRate: bookingRate } : pricing) ?? 0;
  const paid = Number(booking.net_paid ?? 0);
  const balance = total - paid;

  function handleCheckIn(value: string) {
    setCheckIn(value);
    // Keep a later check-out already chosen; otherwise default to the next day.
    if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
  }

  function submit() {
    startTransition(async () => {
      const result = asResult(
        await updateBookingDates({ bookingId: booking.id, check_in: checkIn, check_out: checkOut, total_amount: total })
      );
      if (!result.ok) {
        toast.error(result.error ?? "Could not change the dates");
        return;
      }
      toast.success("Dates updated — the guest has been emailed");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Change dates">
      <p className="text-sm text-navy/60">{booking.guest_name} · {booking.units?.name} · {booking.booking_code}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-navy/60">Check-in</label>
          <input type="date" value={checkIn} onChange={(e) => handleCheckIn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-navy/60">Check-out</label>
          <input type="date" value={checkOut} min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="mt-4">
        <label className="text-sm text-navy/60">New total ({booking.currency})</label>
        <input type="number" min={0} step="any" value={total} onChange={(e) => setTotal(Number(e.target.value))} className={inputClass} />
        {rate > 0 && nights > 0 && (
          <p className="mt-1 text-xs text-navy/50">
            {nights} night{nights === 1 ? "" : "s"} at the standard rate = {formatCurrency(suggested, booking.currency)}
            {booking.promo_code ? " (before this booking's promo discount)" : ""}.{" "}
            <button type="button" className="underline" onClick={() => setTotal(suggested)}>Use this</button>
          </p>
        )}
      </div>

      <div className="mt-4 space-y-1 rounded-lg bg-sand p-4">
        <Row label="Paid so far" value={formatCurrency(paid, booking.currency)} />
        <Row label={balance > 0 ? "Balance due" : balance < 0 ? "Overpaid by" : "Balance"} value={formatCurrency(Math.abs(balance), booking.currency)} />
        {balance > 0 && <p className="pt-1 text-xs text-navy/50">Use “Record payment” on the booking when the balance is received.</p>}
        {balance < 0 && <p className="pt-1 text-xs text-navy/50">Use Cancel / Refund → refund to return the difference.</p>}
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isPending}>Close</button>
        <button type="button" className="btn-primary flex-1" onClick={submit} disabled={isPending || nights <= 0}>
          {isPending ? "Saving…" : "Save new dates"}
        </button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ Record payment
export function RecordPaymentDialog({ booking, open, onClose }: DialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const outstanding = Math.max(Number(booking.total_amount) - Number(booking.net_paid ?? 0), 0);
  const [amount, setAmount] = useState<number>(outstanding);
  const [method, setMethod] = useState<"cash" | "bank" | "momo">("cash");

  function submit() {
    startTransition(async () => {
      const result = asResult(await recordPayment({ bookingId: booking.id, amount, method }));
      if (!result.ok) {
        toast.error(result.error ?? "Could not record the payment");
        return;
      }
      toast.success("Payment recorded");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <p className="text-sm text-navy/60">{booking.guest_name} · {booking.booking_code}</p>
      <div className="mt-4 space-y-1 rounded-lg bg-sand p-4">
        <Row label="Total" value={formatCurrency(Number(booking.total_amount), booking.currency)} />
        <Row label="Paid so far" value={formatCurrency(Number(booking.net_paid ?? 0), booking.currency)} />
        <Row label="Outstanding" value={formatCurrency(outstanding, booking.currency)} />
      </div>
      <div className="mt-4">
        <label className="text-sm text-navy/60">Amount received ({booking.currency})</label>
        <input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
      </div>
      <div className="mt-4">
        <label className="text-sm text-navy/60">Received by</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bank" | "momo")} className={inputClass}>
          <option value="cash">Cash</option>
          <option value="bank">Bank transfer</option>
          <option value="momo">Mobile Money</option>
        </select>
      </div>
      <div className="mt-6 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isPending}>Close</button>
        <button type="button" className="btn-primary flex-1" onClick={submit} disabled={isPending || amount <= 0}>
          {isPending ? "Saving…" : "Record payment"}
        </button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------- Cancel / refund
export function CancelRefundDialog({ booking, open, onClose, isAdmin }: DialogProps & { isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const alreadyCancelled = booking.status === "cancelled" || booking.status === "no_show";
  const paid = Math.max(Number(booking.net_paid ?? 0), 0);
  const payments: any[] = booking.payments ?? [];
  const canUsePaystack = payments.some((p) => p.method === "paystack" && p.status === "success" && p.paystack_reference);

  // Suggest what the published policy gives; for an already-cancelled booking suggest the full balance.
  const suggestion = alreadyCancelled ? paid : suggestedRefund(paid, booking.check_in);
  const canRefund = paid > 0 && isAdmin;

  const [choice, setChoice] = useState<"none" | "paystack" | "manual">(
    canRefund && suggestion > 0 ? (canUsePaystack ? "paystack" : "manual") : "none"
  );
  const [manualMethod, setManualMethod] = useState<"cash" | "bank" | "momo">("cash");
  const [amount, setAmount] = useState<number>(suggestion);
  const [reason, setReason] = useState("");

  const refundMethod = choice === "manual" ? manualMethod : choice;
  const days = daysUntilCheckIn(booking.check_in);

  function submit() {
    startTransition(async () => {
      const result = asResult(
        await cancelBookingWithRefund({ bookingId: booking.id, refundMethod, refundAmount: choice === "none" ? 0 : amount, reason })
      );
      if (!result.ok) {
        toast.error(result.error ?? "Could not complete that");
        return;
      }
      toast.success(alreadyCancelled ? "Refund recorded" : choice === "none" ? "Booking cancelled" : "Booking cancelled and refund recorded");
      onClose();
      router.refresh();
    });
  }

  const confirmLabel = isPending
    ? "Working…"
    : alreadyCancelled
      ? `Refund ${formatCurrency(amount, booking.currency)}`
      : choice === "none"
        ? "Cancel booking"
        : `Cancel & refund ${formatCurrency(amount, booking.currency)}`;

  return (
    <Modal open={open} onClose={onClose} title={alreadyCancelled ? "Refund" : "Cancel booking"}>
      <p className="text-sm text-navy/60">{booking.guest_name} · {booking.units?.name} · {booking.booking_code}</p>

      <div className="mt-4 space-y-1 rounded-lg bg-sand p-4">
        <Row label="Paid so far (net)" value={formatCurrency(paid, booking.currency)} />
        {!alreadyCancelled && paid > 0 && (
          <Row
            label={days >= 0 ? `Policy: ${days} day${days === 1 ? "" : "s"} before check-in` : "Policy: stay has started"}
            value={`${refundPercentFor(booking.check_in)}% = ${formatCurrency(suggestedRefund(paid, booking.check_in), booking.currency)}`}
          />
        )}
      </div>

      {paid > 0 && !isAdmin && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Only admins can issue refunds. You can cancel now, and an admin can refund it afterwards.
        </p>
      )}

      {canRefund && (
        <fieldset className="mt-5 space-y-2 text-sm">
          <legend className="mb-1 text-sm text-navy/60">Refund</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="refund-choice" checked={choice === "paystack"} disabled={!canUsePaystack} onChange={() => setChoice("paystack")} className="mt-1" />
            <span className={canUsePaystack ? "" : "text-navy/40"}>
              Refund to the guest through Paystack
              {!canUsePaystack && <span className="block text-xs">No Paystack payment on this booking.</span>}
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="refund-choice" checked={choice === "manual"} onChange={() => setChoice("manual")} className="mt-1" />
            <span>I&rsquo;ve refunded them myself (record it)</span>
          </label>
          {choice === "manual" && (
            <select value={manualMethod} onChange={(e) => setManualMethod(e.target.value as "cash" | "bank" | "momo")} className={inputClass}>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="momo">Mobile Money</option>
            </select>
          )}
          {!alreadyCancelled && (
            <label className="flex items-start gap-2">
              <input type="radio" name="refund-choice" checked={choice === "none"} onChange={() => setChoice("none")} className="mt-1" />
              <span>No refund</span>
            </label>
          )}
        </fieldset>
      )}

      {canRefund && choice !== "none" && (
        <div className="mt-4">
          <label className="text-sm text-navy/60">Refund amount ({booking.currency})</label>
          <input type="number" min={0} max={paid} step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputClass} />
          <p className="mt-1 text-xs text-navy/50">Up to {formatCurrency(paid, booking.currency)}.</p>
        </div>
      )}

      <div className="mt-4">
        <label className="text-sm text-navy/60">Reason (optional)</label>
        <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
      </div>

      <p className="mt-4 text-xs text-navy/50">The guest will be emailed. {alreadyCancelled ? "" : "Cancelling frees these dates straight away."}</p>

      <div className="mt-6 flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isPending}>Close</button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={submit}
          disabled={isPending || (alreadyCancelled && (choice === "none" || amount <= 0))}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
