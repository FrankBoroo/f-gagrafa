import type { AccessState } from "@/lib/portal/access";
import { CHECK_IN_LABEL, CHECK_OUT_LABEL } from "@/lib/property";

export function ArrivalCard({
  roomText,
  accessState,
  accessMessage,
  doorCode,
  wifi,
  entryInstructions,
  address,
}: {
  roomText: string;
  accessState: AccessState;
  accessMessage: string | null;
  doorCode: string | null;
  wifi: string | null;
  entryInstructions: string | null;
  address: string | null;
}) {
  const show = accessState === "show";
  return (
    <section className="card p-6" aria-label="Your arrival">
      <h2 className="text-xl">Your room</h2>
      <p className="mt-1 text-navy/80">{roomText}</p>

      <dl className="mt-5 grid gap-4 border-t border-navy/10 pt-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-champagne-ink">Check-in</dt>
          <dd className="mt-1 text-navy/80">from {CHECK_IN_LABEL}</dd>
        </div>
        <div>
          <dt className="text-champagne-ink">Check-out</dt>
          <dd className="mt-1 text-navy/80">by {CHECK_OUT_LABEL}</dd>
        </div>
        {address && (
          <div className="sm:col-span-2">
            <dt className="text-champagne-ink">Address</dt>
            <dd className="mt-1 whitespace-pre-line text-navy/80">{address}</dd>
          </div>
        )}
      </dl>

      {show ? (
        <dl className="mt-5 grid gap-4 border-t border-navy/10 pt-5 text-sm">
          {doorCode && (
            <div>
              <dt className="text-champagne-ink">Door code</dt>
              <dd className="mt-1 font-display text-2xl tracking-widest text-navy">{doorCode}</dd>
            </div>
          )}
          {wifi && (
            <div>
              <dt className="text-champagne-ink">Wi-Fi</dt>
              <dd className="mt-1 whitespace-pre-line text-navy/80">{wifi}</dd>
            </div>
          )}
          {entryInstructions && (
            <div>
              <dt className="text-champagne-ink">Check-in and entry</dt>
              <dd className="mt-1 whitespace-pre-line text-navy/80">{entryInstructions}</dd>
            </div>
          )}
          {!doorCode && !wifi && !entryInstructions && (
            <p className="text-navy/70">
              Our team will share your entry details shortly. Contact the front desk if you need them sooner.
            </p>
          )}
        </dl>
      ) : (
        accessMessage && <p className="mt-5 border-t border-navy/10 pt-5 text-sm text-navy/60">{accessMessage}</p>
      )}
    </section>
  );
}
