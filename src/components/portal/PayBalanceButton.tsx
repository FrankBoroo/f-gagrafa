"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { payBalance } from "@/app/portal/actions";
import { formatMoney } from "@/lib/format";

export function PayBalanceButton({
  bookingId,
  owed,
  currency,
}: {
  bookingId: string;
  owed: number;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  // Stays disabled after a successful start while the browser leaves for Paystack.
  const [redirecting, setRedirecting] = useState(false);

  // Coming back from Paystack with Back restores this page from the back/forward cache with
  // the button still disabled; re-enable it.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setRedirecting(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function pay() {
    startTransition(async () => {
      const result = await payBalance(bookingId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRedirecting(true);
      window.location.assign(result.url);
    });
  }

  return (
    <button type="button" onClick={pay} disabled={pending || redirecting} className="btn-gold w-full sm:w-auto">
      {pending || redirecting ? "Opening secure payment…" : `Pay balance · ${formatMoney(owed, currency)}`}
    </button>
  );
}
