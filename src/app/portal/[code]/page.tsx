import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { formatMoney, formatDate } from "@/lib/format";
import { bookedPriceSuffix } from "@/lib/booking/pricing";
import { hasPortalAccess } from "@/lib/portal-session";
import { CANCELLATION_POLICY, suggestedRefund } from "@/lib/booking/cancellation-policy";
import { ServiceRequestForm } from "@/components/site/ServiceRequestForm";
import { ReviewForm } from "@/components/site/ReviewForm";
import { CancellationRequest } from "@/components/site/CancellationRequest";
import type { Unit } from "@/lib/types";
import { toISODate, calculateNights } from "@/lib/booking/dates";
import { accessState, ACCESS_MESSAGES } from "@/lib/portal/access";
import { CANCELLATION_REQUEST_PREFIX } from "@/lib/admin/inbox";
import { APARTMENT_FALLBACK_IMAGE } from "@/lib/property";
import { netPaid } from "@/lib/admin/guests";
import { balanceProblem } from "@/lib/payments/balance";
import { confirmPaymentByReference } from "@/lib/payments/booking-payment";
import { isOverLimit } from "@/lib/rate-limit";
import { returnReferenceFor } from "@/lib/portal/return";
import { roomText } from "@/lib/portal/access";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { BalanceCard } from "@/components/portal/BalanceCard";
import { ArrivalCard } from "@/components/portal/ArrivalCard";
import { PaymentReturnNotice, type PaymentReturnOutcome } from "@/components/portal/PaymentReturnNotice";

export default async function PortalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { code: rawCode } = await params;
  const query = await searchParams;
  const code = rawCode.toUpperCase();

  // Not verified (or the cookie expired): ask who they are. Same response for real and
  // made-up codes, so this page can't be used to discover which booking codes exist.
  if (!(await hasPortalAccess(code))) {
    redirect(`/portal?code=${encodeURIComponent(code)}&verify=1`);
  }

  const supabase = createServiceClient();

  // Back from Paystack after paying a balance: confirm it first so the page shows the new
  // balance. Only a balance reference of this very booking is considered.
  let returnOutcome: PaymentReturnOutcome | null = null;
  let returnAmountText: string | null = null;
  const returnReference = returnReferenceFor(code, query);
  if (returnReference && !(await isOverLimit("paymentCheck"))) {
    const confirmation = await confirmPaymentByReference(returnReference);
    if (
      confirmation.outcome === "paid" ||
      confirmation.outcome === "failed" ||
      confirmation.outcome === "needs_review"
    ) {
      returnOutcome = confirmation.outcome;
    }
    if (confirmation.outcome === "paid") {
      const { data: paymentRow } = await supabase
        .from("payments")
        .select("amount, currency")
        .eq("paystack_reference", returnReference)
        .maybeSingle();
      if (paymentRow) returnAmountText = formatMoney(Number(paymentRow.amount), paymentRow.currency || "GHS");
    }
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, units(*), rooms(number)")
    .eq("booking_code", code)
    .single();

  if (!booking) notFound();

  const unit = booking.units as Unit;
  const today = toISODate(new Date());
  const status: string = booking.status;
  const isCancelled = status === "cancelled" || status === "no_show";

  // Door code, Wi-Fi and entry details: only for a confirmed stay with a confirmed room,
  // from the day before check-in until check-out.
  const access = accessState(booking, today);
  const canSeeAccess = access === "show";

  const { data: settings } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();

  let doorCode: string | null = null;
  if (canSeeAccess) {
    const { data: codeRow } = await supabase
      .from("room_access_codes")
      .select("access_code")
      .eq("room_id", booking.room_id as string)
      .maybeSingle();
    doorCode = codeRow?.access_code ?? null;
  }

  // Money actually received so far (refunds are stored as negative rows).
  const { data: paymentRows } = await supabase.from("payments").select("amount, status").eq("booking_id", booking.id);
  const paidNet = netPaid(paymentRows);
  const balanceDue = Math.max(Math.round((Number(booking.total_amount) - paidNet) * 100) / 100, 0);
  const canPay = balanceProblem(booking, paidNet) === null;
  const accessMessage = access === "show" ? null : ACCESS_MESSAGES[access];
  const wifi =
    [
      settings?.wifi_network && `Network: ${settings.wifi_network}`,
      settings?.wifi_password && `Password: ${settings.wifi_password}`,
    ]
      .filter(Boolean)
      .join("\n") || null;

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id, rating, comment")
    .eq("booking_id", booking.id)
    .maybeSingle();

  const { data: cancelRequests } = await supabase
    .from("service_requests")
    .select("id")
    .eq("booking_id", booking.id)
    .like("description", `${CANCELLATION_REQUEST_PREFIX}%`)
    .in("status", ["pending", "in_progress"])
    .limit(1);
  const cancellationRequested = Boolean(cancelRequests && cancelRequests.length > 0);

  const canRequestCancellation = status === "pending" || status === "confirmed";
  const refundEstimate = suggestedRefund(paidNet, { ...booking, nights: booking.nights ?? 1 });
  const wasPaid = paidNet > 0.005;
  const refundedAmount = Number(booking.refunded_amount ?? 0);

  return (
    <div>
      <PortalHeader
        imageSrc={unit?.images?.[0] ?? APARTMENT_FALLBACK_IMAGE}
        unitName={unit?.name ?? ""}
        checkIn={formatDate(booking.check_in)}
        checkOut={formatDate(booking.check_out)}
        nights={booking.nights ?? calculateNights(booking.check_in, booking.check_out)}
        guests={booking.adults}
        code={booking.booking_code}
        firstName={booking.guest_name.split(" ")[0]}
      />

      <div className="container-gagrafa max-w-3xl space-y-6 py-10 sm:py-14">
        {returnOutcome && <PaymentReturnNotice outcome={returnOutcome} amountText={returnAmountText} />}

        {isCancelled ? (
          <div className="card p-6 text-sm text-navy/70">
            This booking was cancelled
            {booking.cancelled_at ? ` on ${formatDate(String(booking.cancelled_at).slice(0, 10))}` : ""}.
            {refundedAmount > 0
              ? ` A refund of ${formatMoney(refundedAmount, booking.currency)} has been issued.`
              : " No refund applied."}{" "}
            Questions? Please get in touch and we&rsquo;ll help.
          </div>
        ) : (
          <BalanceCard
            total={Number(booking.total_amount)}
            paid={paidNet}
            owed={balanceDue}
            currency={booking.currency}
            bookedSuffix={bookedPriceSuffix(booking)}
            canPay={canPay}
            bookingId={booking.id}
          />
        )}

        {/* Task 6: QuickActions row goes here, right under the balance card. */}

        {!isCancelled && (
          <>
            <ArrivalCard
              roomText={roomText({
                room_confirmed: booking.room_confirmed,
                room_number: (booking.rooms as { number: number } | null)?.number ?? null,
              })}
              accessState={access}
              accessMessage={accessMessage}
              doorCode={doorCode}
              wifi={wifi}
              entryInstructions={settings?.entry_instructions ?? null}
              address={settings?.address ?? null}
            />

            {(settings?.house_rules || settings?.emergency_contact) && (
              <section className="grid gap-6 sm:grid-cols-2">
                {settings?.house_rules && <InfoCard title="House rules" body={settings.house_rules} />}
                {settings?.emergency_contact && <InfoCard title="Emergency contacts" body={settings.emergency_contact} />}
              </section>
            )}

            <section className="pt-4">
              <h2 className="text-2xl">Request a service</h2>
              <ServiceRequestForm bookingId={booking.id} />
            </section>

            {canRequestCancellation && (
              <section className="pt-4">
                <h2 className="text-2xl">Need to cancel?</h2>
                <div className="card mt-4 p-6 text-sm text-navy/70">
                  <ul className="space-y-1">
                    {CANCELLATION_POLICY.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {wasPaid ? (
                    <p className="mt-4 border-t border-navy/10 pt-4">
                      If you cancel today you&rsquo;d be refunded{" "}
                      <strong>{formatMoney(refundEstimate, booking.currency)}</strong>{" "}
                      of the {formatMoney(paidNet, booking.currency)} you&rsquo;ve paid.
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
        <section className="pt-4">
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
      </div>
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
