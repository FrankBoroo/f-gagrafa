// Balance payments: what's left on a booking, paid later from the Guest Portal through
// Paystack. Pure, so it can be tested without a database or Paystack.

const SUFFIX_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SUFFIX_LENGTH = 6;

// 36 symbols don't divide 256, so bytes of 252 and above are skipped to keep every symbol
// equally likely.
function randomSuffix(): string {
  let out = "";
  while (out.length < SUFFIX_LENGTH) {
    const bytes = new Uint8Array(SUFFIX_LENGTH * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 252 && out.length < SUFFIX_LENGTH) out += SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length];
    }
  }
  return out;
}

// The Paystack reference of one balance payment: the booking code, "-B" and six random
// characters, e.g. "GAG-2026-AB12CD-BZZ99ZZ". Each attempt gets its own reference because
// Paystack refuses to reuse one, and `payments.paystack_reference` is unique.
export function balanceReference(bookingCode: string, random: () => string = randomSuffix): string {
  return `${bookingCode}-B${random()}`;
}

const BALANCE_REFERENCE = /^(GAG-\d{4}-[A-Z0-9]+)-B[A-Z0-9]{6}$/;

// The booking code inside a balance reference, or null for anything else (a plain booking
// code, a refund reference, a malformed suffix).
export function parseBalanceReference(reference: string): string | null {
  return BALANCE_REFERENCE.exec(reference)?.[1] ?? null;
}

const PAYABLE_STATUSES = ["confirmed", "checked_in", "checked_out"];

// Why this booking's balance can't be paid online, or null when it can. `payment_status`
// isn't trusted for what's owed: a stay whose total went up after a date change reads
// "paid" but owes the difference.
export function balanceProblem(
  b: { status: string; payment_status: string; total_amount: number },
  netPaid: number
): string | null {
  if (!PAYABLE_STATUSES.includes(b.status) || b.payment_status === "refunded") {
    return "This booking can't be paid online. Please contact us.";
  }
  if (Number(b.total_amount) - netPaid <= 0.005) return "There's nothing left to pay on this booking.";
  return null;
}
