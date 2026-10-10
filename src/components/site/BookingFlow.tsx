"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { calculateNights } from "@/lib/types";
import type { Unit } from "@/lib/types";
import { createBookingAndInitializePayment, previewPromoCode } from "@/app/booking/actions";

const guestSchema = z.object({
  guest_name: z.string().min(2, "Enter your full name"),
  guest_email: z.string().email("Enter a valid email"),
  guest_phone: z.string().min(9, "Enter a valid phone number"),
  special_requests: z.string().optional(),
});

type GuestForm = z.infer<typeof guestSchema>;

export function BookingFlow({ units }: { units: Unit[] }) {
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [unitId, setUnitId] = useState(units.find((u) => u.slug === params.get("unit"))?.id ?? "");
  const [checkIn, setCheckIn] = useState(params.get("checkIn") ?? "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") ?? "");
  const [guests, setGuests] = useState(Number(params.get("guests") ?? 2));
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<{ checking: boolean; applied?: { code: string; discountAmount: number }; error?: string }>({ checking: false });

  const unit = units.find((u) => u.id === unitId);
  const nights = checkIn && checkOut ? Math.max(calculateNights(checkIn, checkOut), 0) : 0;
  const subtotal = unit ? nights * unit.base_price_per_night : 0;
  const total = promoStatus.applied ? Math.max(subtotal - promoStatus.applied.discountAmount, 0) : subtotal;

  async function applyPromoCode() {
    if (!promoCode.trim()) return;
    setPromoStatus({ checking: true });
    const result = await previewPromoCode(promoCode, subtotal);
    if (!result.valid) {
      setPromoStatus({ checking: false, error: result.error });
      return;
    }
    setPromoStatus({ checking: false, applied: { code: result.code!, discountAmount: result.discountAmount! } });
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestForm>({ resolver: zodResolver(guestSchema) });

  async function onSubmit(guestDetails: GuestForm) {
    if (!unit || nights <= 0) return;
    setSubmitting(true);
    try {
      const result = await createBookingAndInitializePayment({
        unit_id: unit.id,
        check_in: checkIn,
        check_out: checkOut,
        adults: guests,
        children: 0,
        promo_code: promoStatus.applied?.code,
        honeypot,
        renderedAt,
        ...guestDetails,
      });

      if (!result.ok || !result.authorization_url) {
        toast.error(result.error ?? "Could not start payment");
        setSubmitting(false);
        return;
      }

      // Hand off to Paystack's hosted checkout (card, Mobile Money, bank transfer).
      // It redirects back to /booking/success, which verifies the transaction.
      window.location.href = result.authorization_url;
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-12">
      <Steps step={step} />

      {step === 1 && (
        <div className="mt-10 space-y-6">
          <div>
            <label className="text-sm text-navy/60">Residence</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
            >
              <option value="">Select a residence</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {formatCurrency(u.base_price_per_night)}/night</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-navy/60">Check-in</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
            </div>
            <div>
              <label className="text-sm text-navy/60">Check-out</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
            </div>
          </div>
          <div>
            <label className="text-sm text-navy/60">Guests</label>
            <input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
          </div>
          <button
            className="btn-primary w-full"
            disabled={!unitId || !checkIn || !checkOut || nights <= 0}
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <form className="mt-10 space-y-6" onSubmit={handleSubmit(() => setStep(3))}>
          {/* Honeypot — hidden from real guests via CSS, not `hidden`, so simple bots still fill it */}
          <div className="absolute left-[-9999px]" aria-hidden="true">
            <label htmlFor="booking_company_website">Company website</label>
            <input
              id="booking_company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-navy/60">Full name</label>
            <input {...register("guest_name")} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
            {errors.guest_name && <p className="mt-1 text-xs text-red-600">{errors.guest_name.message}</p>}
          </div>
          <div>
            <label className="text-sm text-navy/60">Email</label>
            <input {...register("guest_email")} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
            {errors.guest_email && <p className="mt-1 text-xs text-red-600">{errors.guest_email.message}</p>}
          </div>
          <div>
            <label className="text-sm text-navy/60">Phone</label>
            <input {...register("guest_phone")} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
            {errors.guest_phone && <p className="mt-1 text-xs text-red-600">{errors.guest_phone.message}</p>}
          </div>
          <div>
            <label className="text-sm text-navy/60">Special requests (optional)</label>
            <textarea {...register("special_requests")} rows={3} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
          </div>
          <div className="flex gap-4">
            <button type="button" className="btn-secondary w-full" onClick={() => setStep(1)}>Back</button>
            <button type="submit" className="btn-primary w-full">Review &amp; Pay</button>
          </div>
        </form>
      )}

      {step === 3 && unit && (
        <div className="mt-10">
          <div className="card p-6">
            <h3 className="text-lg">{unit.name}</h3>
            <p className="mt-1 text-sm text-navy/60">{checkIn} → {checkOut} · {nights} nights · {guests} guests</p>

            <div className="mt-5 flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="flex-1 rounded-lg border border-navy/15 px-3 py-2 text-sm uppercase"
                disabled={!!promoStatus.applied}
              />
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs"
                onClick={applyPromoCode}
                disabled={promoStatus.checking || !!promoStatus.applied || !promoCode.trim()}
              >
                {promoStatus.applied ? "Applied" : promoStatus.checking ? "Checking…" : "Apply"}
              </button>
            </div>
            {promoStatus.error && <p className="mt-1 text-xs text-red-600">{promoStatus.error}</p>}
            {promoStatus.applied && (
              <p className="mt-1 text-xs text-emerald-600">Code {promoStatus.applied.code} applied</p>
            )}

            <div className="mt-5 space-y-1.5 border-t border-navy/10 pt-4 text-sm text-navy/70">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {promoStatus.applied && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(promoStatus.applied.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg text-navy">
                <span>Total due</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-navy/50">
            Paystack checkout (card, Mobile Money, Vodafone Cash) opens on submit. Payment
            confirmation triggers your booking confirmation email and WhatsApp message.
          </p>
          <div className="mt-6 flex gap-4">
            <button className="btn-secondary w-full" onClick={() => setStep(2)}>Back</button>
            <button
              className="btn-gold w-full"
              disabled={submitting}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? "Processing…" : `Pay ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Dates & Residence", "Your Details", "Review & Pay"];
  return (
    <div className="flex gap-8 border-b border-navy/10 pb-6">
      {labels.map((label, i) => (
        <div key={label} className={`flex items-center gap-2 text-sm ${step === i + 1 ? "text-navy" : "text-navy/35"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === i + 1 ? "bg-navy text-ivory" : "border border-navy/20"}`}>
            {i + 1}
          </span>
          {label}
        </div>
      ))}
    </div>
  );
}
