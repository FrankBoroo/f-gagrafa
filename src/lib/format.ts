// Display formatting in one place. Fixed formats, no Intl/locale and always UTC, so the
// server, the browser and emails all produce the same text (no hydration mismatches).

const CURRENCY_SYMBOLS: Record<string, string> = { GHS: "GH₵", USD: "$" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Whole amounts show no decimals; anything with pesewas/cents shows two.
export function formatMoney(amount: number, currency: string = "GHS") {
  const value = Number(amount) || 0;
  const abs = Math.abs(value);
  const [whole, cents] = abs.toFixed(Math.round(abs * 100) % 100 === 0 ? 0 : 2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${value < 0 ? "-" : ""}${symbol}${grouped}${cents ? `.${cents}` : ""}`;
}

function toDate(value: string | Date): Date | null {
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

// "24 Oct 2026". Takes a "YYYY-MM-DD" date or a timestamp; "" for anything unreadable.
export function formatDate(value: string | Date) {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

// "24 Oct 2026, 13:05 UTC".
export function formatDateTime(value: string | Date) {
  const d = toDate(value);
  if (!d) return "";
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${formatDate(d)}, ${time} UTC`;
}

// "October 2026"; month is 1-12.
export function formatMonthYear(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}
