"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSpecialPrice, deleteSpecialPrice } from "@/app/admin/special-prices/actions";
import { asResult } from "@/lib/action-result";
import { addDays, calculateNights } from "@/lib/booking/dates";
import { formatDate, formatMoney } from "@/lib/format";

export interface SpecialPriceRow {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string; // exclusive: the morning after the last special night
  nightly_price: number | null;
  min_nights: number | null;
  label: string | null;
}

interface UnitOption {
  id: string;
  name: string;
  base_price_per_night: number;
}

const FIELD = "mt-2 block w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-sm text-navy";
const EMPTY = { firstNight: "", lastNight: "", price: "", minNights: "", label: "" };

function describe(s: SpecialPriceRow, currency: string): string {
  const parts: string[] = [];
  if (s.nightly_price !== null) parts.push(`${formatMoney(s.nightly_price, currency)} a night`);
  if (s.min_nights !== null) parts.push(`at least ${s.min_nights} night${s.min_nights === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

// Special prices and minimum stays, listed per apartment type. Admins add and delete;
// staff can read. Dates are entered as first and last night; the stored end date is the
// morning after the last night.
export function SpecialPricesManager({
  specials,
  units,
  currency,
  isAdmin,
}: {
  specials: SpecialPriceRow[];
  units: UnitOption[];
  currency: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [form, setForm] = useState(EMPTY);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((current: typeof EMPTY) => ({ ...current, [key]: value }));
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.price && !form.minNights) {
      toast.error("Set a price, minimum nights, or both");
      return;
    }
    startTransition(async () => {
      const result = asResult(
        await createSpecialPrice({
          unit_id: unitId,
          start_date: form.firstNight,
          end_date: form.lastNight ? addDays(form.lastNight, 1) : "",
          nightly_price: form.price ? Number(form.price) : null,
          min_nights: form.minNights ? Number(form.minNights) : null,
          label: form.label.trim() || null,
        })
      );
      if (!result.ok) {
        toast.error(result.error ?? "Could not save the special price");
        return;
      }
      toast.success("Special price added");
      setForm(EMPTY);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = asResult(await deleteSpecialPrice(id));
      setConfirmingId(null);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete the special price");
        return;
      }
      toast.success("Special price deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {units.map((unit: UnitOption) => {
        const rows = specials.filter((s: SpecialPriceRow) => s.unit_id === unit.id);
        return (
          <section key={unit.id} className="card p-5" aria-labelledby={`special-${unit.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`special-${unit.id}`} className="font-sans text-base font-medium text-navy">{unit.name}</h2>
              <p className="text-xs text-navy/50">Usual price {formatMoney(unit.base_price_per_night, currency)} a night</p>
            </div>

            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-navy/50">No special prices. The usual price applies on every date.</p>
            ) : (
              <ul className="mt-3 divide-y divide-navy/5">
                {rows.map((s: SpecialPriceRow) => {
                  const nights = calculateNights(s.start_date, s.end_date);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-navy">
                          {formatDate(s.start_date)}
                          {nights > 1 && <> – {formatDate(addDays(s.end_date, -1))}</>}
                          <span className="text-navy/50"> · {nights} night{nights === 1 ? "" : "s"}</span>
                        </p>
                        <p className="mt-0.5 break-words text-sm text-navy/70">
                          {describe(s, currency)}
                          {s.label && <span className="text-navy/50"> · {s.label}</span>}
                        </p>
                      </div>
                      {isAdmin &&
                        (confirmingId === s.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => remove(s.id)}
                              className="min-h-11 rounded-lg bg-red-700 px-4 text-xs text-white hover:bg-red-800"
                            >
                              Yes, delete
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => setConfirmingId(null)}
                              className="btn-secondary min-h-11 px-4 py-2 text-xs"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setConfirmingId(s.id)}
                            className="min-h-11 px-3 text-xs text-red-700 underline"
                          >
                            Delete
                          </button>
                        ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {!units.length && <p className="card p-5 text-sm text-navy/60">Add an apartment type first.</p>}

      {isAdmin && units.length > 0 && (
        <form onSubmit={add} className="card p-5">
          <h2 className="font-sans text-base font-medium text-navy">Add a special price</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="sp-type" className="text-sm text-navy/60">Apartment type</label>
              <select id="sp-type" value={unitId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setUnitId(e.target.value)} className={FIELD}>
                {units.map((u: UnitOption) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sp-first" className="text-sm text-navy/60">First night</label>
              <input
                id="sp-first"
                type="date"
                required
                value={form.firstNight}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("firstNight", e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="sp-last" className="text-sm text-navy/60">Last night</label>
              <input
                id="sp-last"
                type="date"
                required
                min={form.firstNight || undefined}
                value={form.lastNight}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("lastNight", e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="sp-price" className="text-sm text-navy/60">Price a night ({currency}), optional</label>
              <input
                id="sp-price"
                type="number"
                inputMode="decimal"
                min={0.01}
                step={0.01}
                value={form.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("price", e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="sp-min" className="text-sm text-navy/60">Minimum nights, optional</label>
              <input
                id="sp-min"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                value={form.minNights}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("minNights", e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="sp-label" className="text-sm text-navy/60">Label, optional</label>
              <input
                id="sp-label"
                type="text"
                maxLength={80}
                placeholder="Christmas week"
                value={form.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("label", e.target.value)}
                className={FIELD}
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-navy/50">
            Guests see the new price straight away. Bookings already made keep the price they were booked at.
          </p>
          <button type="submit" disabled={isPending || !unitId} className="btn-primary mt-4 min-h-11 px-5 py-2.5 text-sm">
            {isPending ? "Saving…" : "Add special price"}
          </button>
        </form>
      )}
    </div>
  );
}
