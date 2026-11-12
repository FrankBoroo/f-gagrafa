import { CalendarPlus, MapPin, MessageCircle, Receipt } from "lucide-react";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy transition-colors hover:border-champagne hover:bg-ivory";

// Four small shortcuts under the balance card. Each is a plain link, so they work without scripts.
export function QuickActions({
  directionsHref,
  whatsappHref,
  calendarHref,
  receiptHref,
}: {
  directionsHref: string;
  whatsappHref: string | null;
  calendarHref: string | null;
  receiptHref: string;
}) {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:[&>*]:flex-1">
      <a href={directionsHref} target="_blank" rel="noopener noreferrer" className={BUTTON}>
        <MapPin className="h-4 w-4 text-champagne-ink" aria-hidden="true" /> Directions
      </a>
      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={BUTTON}>
          <MessageCircle className="h-4 w-4 text-champagne-ink" aria-hidden="true" /> WhatsApp
        </a>
      )}
      {calendarHref && (
        <a href={calendarHref} className={BUTTON}>
          <CalendarPlus className="h-4 w-4 text-champagne-ink" aria-hidden="true" /> Add to calendar
        </a>
      )}
      <a href={receiptHref} className={BUTTON}>
        <Receipt className="h-4 w-4 text-champagne-ink" aria-hidden="true" /> Receipt
      </a>
    </nav>
  );
}
