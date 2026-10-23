"use client";

import { useEffect } from "react";
import Link from "next/link";

// Shown when a page throws. The real error goes to the server/browser logs only;
// guests see a calm message, never a stack trace. `digest` lets us match it in the logs.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-gagrafa max-w-2xl py-32 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Something went wrong</p>
      <h1 className="mt-3 text-4xl md:text-5xl">We couldn&apos;t load this page</h1>
      <p className="mx-auto mt-6 max-w-md text-navy/60">
        Please try again in a moment. If you were making a booking, no payment is taken until Paystack confirms it.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={() => reset()} className="btn-primary">Try again</button>
        <Link href="/contact" className="btn-secondary">Contact us</Link>
      </div>
      {error.digest && <p className="mt-10 text-xs text-navy/40">Reference: {error.digest}</p>}
    </div>
  );
}
