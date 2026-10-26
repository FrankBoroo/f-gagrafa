import Link from "next/link";

// Full-page message after Paystack sends the guest back: paid, failed, cancelled, etc.
export function BookingStatusScreen({
  icon, title, body, code, ctaHref, ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  code?: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="container-gagrafa flex min-h-[70vh] max-w-xl flex-col items-center py-24 text-center">
      {icon}
      <h1 className="mt-6 text-3xl">{title}</h1>
      <p className="mt-4 text-navy/60">{body}</p>
      {code && (
        <p className="mt-6 rounded-full border border-champagne/40 bg-champagne/10 px-6 py-3 font-display text-xl tracking-wide">
          {code}
        </p>
      )}
      <Link href={ctaHref} className="btn-primary mt-10">
        {ctaLabel}
      </Link>
    </div>
  );
}
