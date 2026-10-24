// No 0/O or 1/I, so guests can read the code back over the phone. 32 symbols divide 256
// evenly, so every symbol is equally likely.
const BOOKING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BOOKING_CODE_LENGTH = 6;

// Also the Paystack reference. Six random symbols (about a billion combinations) keep
// collisions with the unique `booking_code` column out of reach.
export function generateBookingCode(now: Date = new Date()): string {
  const bytes = new Uint8Array(BOOKING_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b: number) => BOOKING_CODE_ALPHABET[b % BOOKING_CODE_ALPHABET.length]).join("");
  return `GAG-${now.getUTCFullYear()}-${rand}`;
}
