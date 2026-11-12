// The Paystack reference a guest comes back to the portal with, only when it is a balance
// reference of this very booking. Anything else (another booking's, a plain code, junk) is ignored.
import { parseBalanceReference } from "@/lib/payments/balance";

export function returnReferenceFor(
  code: string,
  params: { reference?: string; trxref?: string }
): string | null {
  const reference = params.reference || params.trxref;
  if (!reference || typeof reference !== "string") return null;
  return parseBalanceReference(reference) === code ? reference : null;
}
