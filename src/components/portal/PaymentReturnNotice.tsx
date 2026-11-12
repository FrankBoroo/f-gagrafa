// "checking": we couldn't reach Paystack to confirm the return; the webhook will finish it.
export type PaymentReturnOutcome = "paid" | "failed" | "needs_review" | "checking";

const TONE: Record<PaymentReturnOutcome, string> = {
  paid: "border-champagne bg-champagne/10",
  failed: "border-navy/15 bg-white",
  needs_review: "border-champagne bg-champagne/10",
  checking: "border-navy/15 bg-white",
};

export function PaymentReturnNotice({
  outcome,
  amountText,
}: {
  outcome: PaymentReturnOutcome;
  amountText: string | null;
}) {
  const message =
    outcome === "paid"
      ? amountText
        ? `Thank you. We've received your payment of ${amountText}.`
        : "Thank you. We've received your payment."
      : outcome === "failed"
        ? "We haven't received this payment yet. If you completed it, it will show here shortly; otherwise you haven't been charged."
        : outcome === "checking"
          ? "We're confirming your payment. It will appear here shortly."
          : "We've received your payment. Our team will be in touch shortly.";
  return (
    <div role="status" className={`rounded-xl border p-4 text-sm text-navy ${TONE[outcome]}`}>
      {message}
    </div>
  );
}
