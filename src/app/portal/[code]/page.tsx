import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { ServiceRequestForm } from "@/components/site/ServiceRequestForm";
import { ReviewForm } from "@/components/site/ReviewForm";
import type { Booking, Unit } from "@/lib/types";

export default async function PortalDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, units(*)")
    .eq("booking_code", code)
    .single();

  if (!booking) notFound();

  const unit = booking.units as Unit;

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating, comment")
    .eq("booking_id", booking.id)
    .maybeSingle();

  return (
    <div className="container-gagrafa max-w-3xl py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">{booking.booking_code}</p>
      <h1 className="mt-3 text-4xl">Welcome, {booking.guest_name.split(" ")[0]}</h1>

      <div className="card mt-10 p-6">
        <h2 className="text-xl">{unit?.name}</h2>
        <p className="mt-1 text-sm text-navy/60">
          {booking.check_in} → {booking.check_out} · {booking.nights} nights · {booking.adults} guests
        </p>
        <div className="mt-4 flex justify-between border-t border-navy/10 pt-4 text-sm">
          <span className="text-navy/60">Payment status</span>
          <span className="capitalize">{booking.payment_status}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-navy/60">Total</span>
          <span>{formatCurrency(booking.total_amount, booking.currency)}</span>
        </div>
      </div>

      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        <InfoCard title="Check-in instructions" body="Digital access code and building entry instructions are sent 24 hours before check-in." />
        <InfoCard title="Wi-Fi" body="Network: Gagrafa-Guest · Password provided at check-in." />
        <InfoCard title="House rules" body="No smoking indoors. Quiet hours 10pm–7am. Max occupancy as booked." />
        <InfoCard title="Emergency contacts" body="Front desk: +233 XX XXX XXXX (24/7)" />
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">Request a service</h2>
        <ServiceRequestForm bookingId={booking.id} />
      </section>

      {booking.status === "checked_out" && (
        <section className="mt-10">
          <h2 className="text-2xl">Your review</h2>
          {existingReview ? (
            <div className="card mt-4 p-6 text-sm text-navy/70">
              You rated this stay {existingReview.rating}/5.
              {existingReview.comment && <p className="mt-2">"{existingReview.comment}"</p>}
            </div>
          ) : (
            <ReviewForm bookingId={booking.id} />
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-2xl">Nearby</h2>
        <p className="mt-2 text-sm text-navy/60">
          Curated recommendations for restaurants and things to do near Spintex —
          coming soon.
        </p>
      </section>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-navy/10 p-5">
      <p className="text-sm text-champagne-dark">{title}</p>
      <p className="mt-2 text-sm text-navy/70">{body}</p>
    </div>
  );
}
