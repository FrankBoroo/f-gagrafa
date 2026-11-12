"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { calculateNights, defaultCheckOut } from "@/lib/booking/dates";
import { createManualBooking } from "@/app/admin/bookings/actions";
import type { Unit } from "@/lib/types";
import { toChargeAmount, type Pricing } from "@/lib/booking/pricing";
import { unitStayPrice } from "@/lib/booking/special-prices";
import { roomLabel } from "@/lib/booking/room-assignment";

export interface RoomOption {
  id: string;
  number: number;
  unit_id: string;
}

export function ManualBookingForm({ units, rooms, pricing }: { units: Unit[]; rooms: RoomOption[]; pricing: Pricing }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    unit_id: units[0]?.id ?? "",
    room_id: "",
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
  const total = unit && nights > 0 ? unitStayPrice(unit, form.check_in, form.check_out) : 0;
  // Stored and recorded in cedis, like online bookings.
  const chargeTotal = toChargeAmount(total, pricing);

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
      const result = await createManualBooking({ ...form, room_id: form.room_id || undefined });
      if (result && !result.ok) {
        toast.error(result.error ?? "Could not create booking");
      }
      // On success the action itself redirects to /admin/bookings.
    });
  }

  return (
    <form onSubmit={submit} className="card mt-8 max-w-2xl space-y-6 p-6">
      <div>
        <label className="text-sm text-navy/60" htmlFor="manual-unit">Apartment type</label>
        <select
          id="manual-unit"
          value={form.unit_id}
          onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value, room_id: "" }))}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name} — {formatMoney(u.base_price_per_night, pricing.currency)}/night</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm text-navy/60" htmlFor="manual-room">Room</label>
        <select
          id="manual-room"
          value={form.room_id}
          onChange={(e) => update("room_id", e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        >
          <option value="">Any free room</option>
          {rooms
            .filter((r: RoomOption) => r.unit_id === form.unit_id)
            .map((r: RoomOption) => (
              <option key={r.id} value={r.id}>{roomLabel(r.number)}</option>
            ))}
        </select>
        <p className="mt-1 text-xs text-navy/50">A room you pick is confirmed at once. &ldquo;Any free room&rdquo; pencils in the lowest free one.</p>
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
          <span>
            {formatMoney(total, pricing.currency)}
            {pricing.currency === "USD" && chargeTotal !== null && (
              <span className="ml-2 text-sm text-navy/50">= {formatMoney(chargeTotal)}</span>
            )}
          </span>
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
