"use client";

import "./globals.css";

// Last resort when the root layout itself fails, so it renders its own <html>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-ivory text-navy">
        <div className="container-gagrafa max-w-2xl py-32 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">The Gagrafa</p>
          <h1 className="mt-3 text-4xl">Something went wrong</h1>
          <p className="mx-auto mt-6 max-w-md opacity-60">Please try again in a moment.</p>
          <button type="button" onClick={() => reset()} className="btn-primary mt-10">Try again</button>
          {error.digest && <p className="mt-10 text-xs opacity-40">Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
