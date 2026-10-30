"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import type { Unit } from "@/lib/types";
import { addDays, calculateNights, defaultCheckOut } from "@/lib/booking/dates";
import { MIN_NIGHTS } from "@/lib/booking/stay-limits";
import { canOfferDeposit, depositAmount } from "@/lib/booking/deposit";
import { toChargeAmount, type Pricing } from "@/lib/booking/pricing";
import { stayPrice, unitRates } from "@/lib/booking/stay-price";
import { createBookingAndInitializePayment, previewPromoCode, checkUnitsAvailability } from "@/app/booking/actions";
import { UnitPicker, getUnitBlockReason } from "@/components/site/UnitPicker";

const guestSchema = z.object({
  guest_name: z.string().min(2, "Enter your full name"),
  guest_email: z.string().email("Enter a valid email"),
  guest_phone: z.string().min(9, "Enter a valid phone number"),
  special_requests: z.string().optional(),
});

type GuestForm = z.infer<typeof guestSchema>;

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267";

function parseGuests(raw: string | null) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

type PaymentOption = "full" | "deposit";

export function BookingFlow({
  units, depositPercent, pricing,
}: {
  units: Unit[];
  depositPercent: number;
  pricing: Pricing;
}) {
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const initialUnitId = units.find((u) => u.slug === params.get("unit"))?.id ?? "";
  const [unitId, setUnitId] = useState(initialUnitId);
  const [checkIn, setCheckIn] = useState(params.get("checkIn") ?? "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") ?? "");
  const [guests, setGuests] = useState(parseGuests(params.get("guests")));
  const [today, setToday] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean> | null>(null);
  const [checking, setChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<{ checking: boolean; applied?: { code: string; discountAmount: number }; error?: string }>({ checking: false });
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("full");

  const unit = units.find((u) => u.id === unitId);
  const nights = checkIn && checkOut ? Math.max(calculateNights(checkIn, checkOut), 0) : 0;
  const subtotal = unit ? stayPrice(nights, unitRates(unit)) : 0;
  const total = promoStatus.applied ? Math.max(subtotal - promoStatus.applied.discountAmount, 0) : subtotal;
  const selectedBlockReason = unit ? getUnitBlockReason(unit, guests, availability) : null;
  const canContinue =
    Boolean(unit) && nights >= MIN_NIGHTS && guests >= 1 && !checking && selectedBlockReason === null;

  // Deposit option (shown on step 3). The server re-checks
  // the same rules from `lib/deposit.ts`, so this only decides what the guest sees.
  const deposit = depositAmount(total, depositPercent);
  const depositOffered = canOfferDeposit(depositPercent) && deposit > 0 && deposit < total;
  const payingDeposit = depositOffered && paymentOption === "deposit";
  const dueNow = payingDeposit ? deposit : total;

  // Paystack charges cedis. With USD prices, show what will actually be charged, using the
  // same conversion and deposit rounding as the server (which uses the rate at booking time).
  const currency = pricing.currency;
  const chargeTotal = toChargeAmount(total, pricing);
  const chargeDueNow =
    chargeTotal === null ? null : payingDeposit ? depositAmount(chargeTotal, depositPercent) : chargeTotal;
  const convertsToCedis = currency === "USD" && chargeDueNow !== null;
  // A promo covering the whole stay: no Paystack step, the server confirms it directly.
  const isFreeStay = Boolean(promoStatus.applied) && chargeTotal === 0;
  const money = (amount: number) => formatMoney(amount, currency);

  // `min` for the date inputs. Set after mount so server and client markup match.
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  // Arriving from a residence page: bring the pre-selected card into view.
  const cameWithUnit = useRef(Boolean(initialUnitId));
  useEffect(() => {
    if (!cameWithUnit.current) return;
    requestAnimationFrame(() =>
      document.getElementById(`unit-${initialUnitId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    );
  }, [initialUnitId]);

  // Whenever the dates change, ask which residences are free for them.
  useEffect(() => {
    setAvailability(null);
    setAvailabilityError(null);
    if (!checkIn || !checkOut || calculateNights(checkIn, checkOut) <= 0) {
      setChecking(false);
      return;
    }
    let cancelled = false; // ignore answers that arrive after the dates changed again
    setChecking(true);
    checkUnitsAvailability(checkIn, checkOut)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setAvailability(res.availability);
        else setAvailabilityError(res.error);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Don't block the guest: the payment step re-checks availability anyway.
        setAvailabilityError("Couldn't check availability just now — we'll confirm it at payment.");
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut]);

  // Drop a selection that stopped being valid (taken dates, or too many guests).
  useEffect(() => {
    if (!unit) return;
    const reason = getUnitBlockReason(unit, guests, availability);
    if (reason) {
      setUnitId("");
      toast.info(`${unit.name} was deselected: ${reason.toLowerCase()}.`);
    }
  }, [unit, guests, availability]);

  // A promo discount was calculated for one subtotal — never carry it to another.
  useEffect(() => {
    setPromoStatus({ checking: false });
  }, [unitId, checkIn, checkOut]);

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    setCheckOut((current: string) => defaultCheckOut(value, current, MIN_NIGHTS));
  }

  const availableCount = availability ? units.filter((u) => availability[u.id] !== false).length : 0;
  let statusText = "Pick your dates to see availability and totals.";
  if (checking) statusText = "Checking availability…";
  else if (availabilityError) statusText = availabilityError;
  else if (availability) statusText = `${availableCount} of ${units.length} available for your dates`;

  const selectionSummary =
    unit && nights > 0
      ? `${unit.name} · ${nights} night${nights === 1 ? "" : "s"} · ${money(subtotal)}`
      : unit
        ? `${unit.name} selected — now choose your dates`
        : "Choose your dates and a residence to continue";

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
        payment_option: payingDeposit ? "deposit" : "full",
        honeypot,
        renderedAt,
        ...guestDetails,
      });

      const next = result.authorization_url ?? result.redirect_url;
      if (!result.ok || !next) {
        toast.error(result.error ?? "Could not start payment");
        setSubmitting(false);
        return;
      }

      // Hand off to Paystack's hosted checkout (card, Mobile Money, bank transfer).
      // It redirects back to /booking/success, which verifies the transaction. A free
      // stay is already confirmed and goes straight to the success page.
      window.location.href = next;
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-12">
      <Steps step={step} />

      {step === 1 && (
        <div className="mt-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm text-navy/60" htmlFor="check-in">Check-in</label>
              <input
                id="check-in"
                type="date"
                min={today || undefined}
                value={checkIn}
                onChange={(e) => handleCheckInChange(e.target.value)}
                className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
              />
            </div>
            <div>
              <label className="text-sm text-navy/60" htmlFor="check-out">Check-out</label>
              <input
                id="check-out"
                type="date"
                min={checkIn ? addDays(checkIn, MIN_NIGHTS) : today || undefined}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
              />
            </div>
            <div>
              <label className="text-sm text-navy/60" htmlFor="guests">Guests</label>
              <input
                id="guests"
                type="number"
                min={1}
                step={1}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
              />
            </div>
          </div>

          <div className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl">Choose your residence</h2>
              <p
                className={`text-sm ${availabilityError ? "text-amber-700" : "text-navy/50"}`}
                aria-live="polite"
              >
                {statusText}
              </p>
            </div>
            <div className="mt-5">
              <UnitPicker
                units={units}
                selectedId={unitId}
                onSelect={setUnitId}
                guests={guests}
                nights={nights}
                availability={availability}
                currency={currency}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-navy/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy/70">{selectionSummary}</p>
            <button className="btn-primary w-full sm:w-auto sm:px-12" disabled={!canContinue} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form className="mt-10 max-w-2xl space-y-6" onSubmit={handleSubmit(() => setStep(3))}>
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
        <div className="mt-10 max-w-2xl">
          <div className="card p-6">
            <div className="flex gap-4">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-sand">
                <Image
                  src={unit.images?.[0] ?? FALLBACK_IMAGE}
                  alt={unit.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg">{unit.name}</h3>
                <p className="mt-1 text-sm text-navy/60">{checkIn} → {checkOut} · {nights} nights · {guests} guests</p>
              </div>
            </div>

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
                <span>{money(subtotal)}</span>
              </div>
              {promoStatus.applied && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{money(promoStatus.applied.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg text-navy">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
              {convertsToCedis && chargeTotal !== null && (
                <div className="flex justify-between text-xs text-navy/50">
                  <span>Charged in Ghana cedis at $1 = GH₵{pricing.usdToGhsRate}</span>
                  <span>{formatMoney(chargeTotal)}</span>
                </div>
              )}
              {chargeTotal === null && (
                <p className="text-xs text-amber-700">
                  Online booking is paused while we update our rates. Please contact us to book.
                </p>
              )}
            </div>

            {depositOffered && (
              <fieldset className="mt-5 border-t border-navy/10 pt-4">
                <legend className="sr-only">How would you like to pay?</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PaymentChoice
                    checked={!payingDeposit}
                    onSelect={() => setPaymentOption("full")}
                    title="Pay in full"
                    amount={money(total)}
                    note="Nothing more to pay at check-in."
                  />
                  <PaymentChoice
                    checked={payingDeposit}
                    onSelect={() => setPaymentOption("deposit")}
                    title={`Reserve with ${depositPercent}%`}
                    amount={money(deposit)}
                    note={`The remaining ${money(total - deposit)} is due at check-in.`}
                  />
                </div>
              </fieldset>
            )}
          </div>
          <p className="mt-4 text-xs text-navy/50">
            {isFreeStay
              ? "Your promo code covers the full stay, so there's nothing to pay. Your booking is confirmed straight away, with a confirmation email and WhatsApp message."
              : "Paystack checkout (card, Mobile Money, Vodafone Cash) opens on submit. Payment confirmation triggers your booking confirmation email and WhatsApp message."}
          </p>
          <div className="mt-6 flex gap-4">
            <button className="btn-secondary w-full" onClick={() => setStep(2)}>Back</button>
            <button
              className="btn-gold w-full"
              disabled={submitting || chargeDueNow === null}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting
                ? "Processing…"
                : isFreeStay
                  ? "Confirm booking"
                  : convertsToCedis
                  ? `Pay ${formatMoney(chargeDueNow ?? 0)} (${money(dueNow)})${payingDeposit ? " now" : ""}`
                  : `Pay ${money(dueNow)}${payingDeposit ? " now" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentChoice({
  checked,
  onSelect,
  title,
  amount,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  amount: string;
  note: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
        checked ? "border-champagne bg-champagne/10" : "border-navy/15 hover:border-navy/30"
      }`}
    >
      <input type="radio" name="payment_option" checked={checked} onChange={onSelect} className="mt-1 accent-navy" />
      <span>
        <span className="block text-sm text-navy">{title}</span>
        <span className="mt-0.5 block text-lg text-navy">{amount}</span>
        <span className="mt-1 block text-xs text-navy/60">{note}</span>
      </span>
    </label>
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
