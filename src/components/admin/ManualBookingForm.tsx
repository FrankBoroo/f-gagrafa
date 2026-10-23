"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { calculateNights } from "@/lib/types";
import { defaultCheckOut } from "@/lib/dates";
import { createManualBooking } from "@/app/admin/bookings/actions";
import type { Unit } from "@/lib/types";

export function ManualBookingForm({ units }: { units: Unit[] }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    unit_id: units[0]?.id ?? "",
    check_in: "",
    check_out: "",
    adults: 2,
    children: 0,
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    special_requests: "",
    admin_notes: "",
    mark_as_paid: false,
    payment_method: "cash" as "cash" | "bank" | "momo",
  });

  const unit = units.find((u) => u.id === form.unit_id);
  const nights = form.check_in && form.check_out ? Math.max(calculateNights(form.check_in, form.check_out), 0) : 0;
  const total = unit ? nights * unit.base_price_per_night : 0;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCheckIn(value: string) {
    setForm((f) => ({
      ...f,
      check_in: value,
      check_out: defaultCheckOut(value, f.check_out),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createManualBooking(form);
      if (result && !result.ok) {
        toast.error(result.error ?? "Could not create booking");
      }
      // On success the action itself redirects to /admin/bookings.
    });
  }

  return (
    <form onSubmit={submit} className="card mt-8 max-w-2xl space-y-6 p-6">
      <div>
        <label className="text-sm text-navy/60">Residence</label>
        <select value={form.unit_id} onChange={(e) => update("unit_id", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3">
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name} — {formatCurrency(u.base_price_per_night)}/night</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-navy/60">Check-in</label>
          <input type="date" required value={form.check_in} onChange={(e) => handleCheckIn(e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
        <div>
          <label className="text-sm text-navy/60">Check-out</label>
          <input type="date" required value={form.check_out} onChange={(e) => update("check_out", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
        <div>
          <label className="text-sm text-navy/60">Adults</label>
          <input type="number" min={1} value={form.adults} onChange={(e) => update("adults", Number(e.target.value))} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
        <div>
          <label className="text-sm text-navy/60">Children</label>
          <input type="number" min={0} value={form.children} onChange={(e) => update("children", Number(e.target.value))} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm text-navy/60">Guest name</label>
          <input required value={form.guest_name} onChange={(e) => update("guest_name", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
        <div>
          <label className="text-sm text-navy/60">Email</label>
          <input type="email" required value={form.guest_email} onChange={(e) => update("guest_email", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
        <div>
          <label className="text-sm text-navy/60">Phone</label>
          <input required value={form.guest_phone} onChange={(e) => update("guest_phone", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
        </div>
      </div>

      <div>
        <label className="text-sm text-navy/60">Special requests</label>
        <textarea rows={2} value={form.special_requests} onChange={(e) => update("special_requests", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
      </div>
      <div>
        <label className="text-sm text-navy/60">Admin notes (internal only)</label>
        <textarea rows={2} value={form.admin_notes} onChange={(e) => update("admin_notes", e.target.value)} className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
      </div>

      <div className="rounded-lg bg-sand p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.mark_as_paid} onChange={(e) => update("mark_as_paid", e.target.checked)} />
          Mark as already paid
        </label>
        {form.mark_as_paid && (
          <select
            value={form.payment_method}
            onChange={(e) => update("payment_method", e.target.value as any)}
            className="mt-3 w-full rounded-lg border border-navy/15 px-4 py-2.5 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="momo">Mobile Money</option>
          </select>
        )}
      </div>

      {nights > 0 && unit && (
        <div className="flex justify-between border-t border-navy/10 pt-4 text-lg">
          <span>Total ({nights} nights)</span>
          <span>{formatCurrency(total)}</span>
        </div>
      )}

      <div className="flex gap-4">
        <Link href="/admin/bookings" className="btn-secondary w-full text-center">Cancel</Link>
        <button className="btn-primary w-full" disabled={isPending}>
          {isPending ? "Creating…" : "Create booking"}
        </button>
      </div>
    </form>
  );
}
