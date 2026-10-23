import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = { GHS: "GH₵", USD: "$" };

// Fixed format (no Intl/locale), so server and browser render the same text.
// Whole amounts show no decimals; anything with pesewas/cents shows two.
export function formatCurrency(amount: number, currency: string = "GHS") {
  const value = Number(amount) || 0;
  const abs = Math.abs(value);
  const [whole, cents] = abs.toFixed(Math.round(abs * 100) % 100 === 0 ? 0 : 2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${value < 0 ? "-" : ""}${symbol}${grouped}${cents ? `.${cents}` : ""}`;
}
