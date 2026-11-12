export type PaymentReturnOutcome = "paid" | "failed" | "needs_review";

const TONE: Record<PaymentReturnOutcome, string> = {
  paid: "border-champagne bg-champagne/10",
  failed: "border-navy/15 bg-white",
  needs_review: "border-champagne bg-champagne/10",
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
        ? "Your payment wasn't completed, so you haven't been charged."
        : "We've received your payment. Our team will be in touch shortly.";
  return (
    <div role="status" className={`rounded-xl border p-4 text-sm text-navy ${TONE[outcome]}`}>
      {message}
    </div>
  );
}
