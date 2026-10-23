import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { bookedPriceSuffix } from "@/lib/pricing";
import { hasPortalAccess } from "@/lib/portal-session";
import { REFUND_TIERS, refundPercentFor } from "@/lib/cancellation-policy";
import { ServiceRequestForm } from "@/components/site/ServiceRequestForm";
import { ReviewForm } from "@/components/site/ReviewForm";
import { CancellationRequest } from "@/components/site/CancellationRequest";
import type { Unit } from "@/lib/types";

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function PortalDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  // Not verified (or the cookie expired): ask who they are. Same response for real and
  // made-up codes, so this page can't be used to discover which booking codes exist.
  if (!(await hasPortalAccess(code))) {
    redirect(`/portal?code=${encodeURIComponent(code)}&verify=1`);
  }

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, units(*)")
    .eq("booking_code", code)
    .single();

  if (!booking) notFound();

  const unit = booking.units as Unit;
  const today = new Date().toISOString().slice(0, 10);
  const status: string = booking.status;
  const isCancelled = status === "cancelled" || status === "no_show";

  // Door code, Wi-Fi and entry details: only for a confirmed stay, from the day before
  // check-in until check-out — so past guests and unconfirmed bookings never see them.
  const stayIsLive = (status === "confirmed" || status === "checked_in") && today <= booking.check_out;
  const canSeeAccess = stayIsLive && (status === "checked_in" || today >= addDays(booking.check_in, -1));

  const { data: settings } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();

  let doorCode: string | null = null;
  if (canSeeAccess) {
    const { data: codeRow } = await supabase
      .from("unit_access_codes")
      .select("access_code")
      .eq("unit_id", booking.unit_id)
      .maybeSingle();
    doorCode = codeRow?.access_code ?? null;
  }

  // Money actually received so far (refunds are stored as negative rows).
  const { data: paymentRows } = await supabase.from("payments").select("amount, status").eq("booking_id", booking.id);
  const paidNet = (paymentRows ?? [])
    .filter((p: any) => p.status === "success" || p.status === "refunded")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(Number(booking.total_amount) - paidNet, 0);

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating, comment")
    .eq("booking_id", booking.id)
    .maybeSingle();

  const { data: cancelRequests } = await supabase
    .from("service_requests")
    .select("id")
    .eq("booking_id", booking.id)
    .like("description", "CANCELLATION REQUEST%")
    .in("status", ["pending", "in_progress"])
    .limit(1);
  const cancellationRequested = Boolean(cancelRequests && cancelRequests.length > 0);

  const canRequestCancellation = status === "pending" || status === "confirmed";
  const refundPercent = refundPercentFor(booking.check_in);
  const wasPaid = paidNet > 0.005;
  const refundedAmount = Number(booking.refunded_amount ?? 0);

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
          <span className="text-navy/60">Booking status</span>
          <span className="capitalize">{status.replace("_", " ")}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-navy/60">Payment status</span>
          <span className="capitalize">{booking.payment_status === "partial" ? "Deposit paid" : booking.payment_status}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-navy/60">Total</span>
          <span>{formatCurrency(booking.total_amount, booking.currency)}{bookedPriceSuffix(booking)}</span>
        </div>
        {paidNet > 0.005 && balanceDue > 0.005 && !isCancelled && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-navy/60">Balance due at check-in</span>
            <span>{formatCurrency(balanceDue, booking.currency)}</span>
          </div>
        )}
        {refundedAmount > 0 && (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-navy/60">Refunded</span>
            <span>{formatCurrency(refundedAmount, booking.currency)}</span>
          </div>
        )}
      </div>

      {isCancelled ? (
        <div className="card mt-6 p-6 text-sm text-navy/70">
          This booking was cancelled
          {booking.cancelled_at ? ` on ${String(booking.cancelled_at).slice(0, 10)}` : ""}.
          {refundedAmount > 0
            ? ` A refund of ${formatCurrency(refundedAmount, booking.currency)} has been issued.`
            : " No refund applied."}{" "}
          Questions? Please get in touch and we&rsquo;ll help.
        </div>
      ) : (
        <>
          {/* Access details — gated */}
          <section className="mt-10">
            <h2 className="text-2xl">Your stay</h2>
            {canSeeAccess ? (
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {settings?.entry_instructions && (
                  <InfoCard title="Check-in & entry" body={settings.entry_instructions} />
                )}
                {doorCode && <InfoCard title="Your door code" body={doorCode} emphasize />}
                {(settings?.wifi_network || settings?.wifi_password) && (
                  <InfoCard
                    title="Wi-Fi"
                    body={[
                      settings?.wifi_network && `Network: ${settings.wifi_network}`,
                      settings?.wifi_password && `Password: ${settings.wifi_password}`,
                    ].filter(Boolean).join("\n")}
                  />
                )}
                {!settings?.entry_instructions && !doorCode && !settings?.wifi_network && !settings?.wifi_password && (
                  <InfoCard title="Check-in" body="Our team will share your entry details shortly. Contact the front desk if you need them sooner." />
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-navy/10 p-5 text-sm text-navy/60">
                {stayIsLive
                  ? "Your door code, Wi-Fi and entry details will appear here from the day before check-in."
                  : status === "pending"
                    ? "Your door code, Wi-Fi and entry details appear here once your booking is confirmed."
                    : "Access details are only shown during your stay."}
              </p>
            )}
          </section>

          {(settings?.house_rules || settings?.emergency_contact) && (
            <section className="mt-6 grid gap-6 sm:grid-cols-2">
              {settings?.house_rules && <InfoCard title="House rules" body={settings.house_rules} />}
              {settings?.emergency_contact && <InfoCard title="Emergency contacts" body={settings.emergency_contact} />}
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-2xl">Request a service</h2>
            <ServiceRequestForm bookingId={booking.id} />
          </section>

          {canRequestCancellation && (
            <section className="mt-10">
              <h2 className="text-2xl">Need to cancel?</h2>
              <div className="card mt-4 p-6 text-sm text-navy/70">
                <ul className="space-y-1">
                  {REFUND_TIERS.map((tier) => (
                    <li key={tier.label} className="flex justify-between gap-4">
                      <span>{tier.label}</span>
                      <span className="shrink-0 text-navy">{tier.percent}% refund</span>
                    </li>
                  ))}
                </ul>
                {wasPaid ? (
                  <p className="mt-4 border-t border-navy/10 pt-4">
                    If you cancel today you&rsquo;d be refunded{" "}
                    <strong>
                      {formatCurrency((paidNet * refundPercent) / 100, booking.currency)}
                    </strong>{" "}
                    ({refundPercent}% of the {formatCurrency(paidNet, booking.currency)} you&rsquo;ve paid).
                  </p>
                ) : (
                  <p className="mt-4 border-t border-navy/10 pt-4">
                    No payment has been taken yet, so cancelling simply releases your dates.
                  </p>
                )}
                <CancellationRequest bookingId={booking.id} alreadyRequested={cancellationRequested} />
              </div>
            </section>
          )}
        </>
      )}

      {status === "checked_out" && (
        <section className="mt-10">
          <h2 className="text-2xl">Your review</h2>
          {existingReview ? (
            <div className="card mt-4 p-6 text-sm text-navy/70">
              You rated this stay {existingReview.rating}/5.
              {existingReview.comment && <p className="mt-2">&ldquo;{existingReview.comment}&rdquo;</p>}
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

function InfoCard({ title, body, emphasize }: { title: string; body: string; emphasize?: boolean }) {
  return (
    <div className="rounded-xl border border-navy/10 p-5">
      <p className="text-sm text-champagne-dark">{title}</p>
      <p className={`mt-2 whitespace-pre-line ${emphasize ? "font-display text-2xl tracking-widest text-navy" : "text-sm text-navy/70"}`}>
        {body}
      </p>
    </div>
  );
}
