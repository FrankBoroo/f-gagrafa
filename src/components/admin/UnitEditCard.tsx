"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { updateUnit, toggleUnitActive } from "@/app/admin/units/actions";
import type { Unit } from "@/lib/types";
import type { PriceCurrency } from "@/lib/booking/pricing";

export function UnitEditCard({ unit, currency }: { unit: Unit; currency: PriceCurrency }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: unit.name,
    short_description: unit.short_description ?? "",
    base_price_per_night: unit.base_price_per_night,
    max_guests: unit.max_guests,
  });
  const [isActive, setIsActive] = useState(unit.is_active);

  function save() {
    startTransition(async () => {
      const result = await updateUnit({ id: unit.id, is_active: isActive, ...form });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save changes");
        return;
      }
      toast.success("Unit updated");
      setEditing(false);
    });
  }

  function cancel() {
    setForm({
      name: unit.name,
      short_description: unit.short_description ?? "",
      base_price_per_night: unit.base_price_per_night,
      max_guests: unit.max_guests,
    });
    setEditing(false);
  }

  function toggleActive() {
    const next = !isActive;
    setIsActive(next);
    startTransition(async () => {
      const result = await toggleUnitActive(unit.id, next);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update");
        setIsActive(!next);
        return;
      }
      toast.success(next ? "Unit activated — now visible on the public site" : "Unit deactivated — hidden from the public site");
    });
  }

  return (
    <div className={`card p-5 ${!isActive ? "opacity-60" : ""}`}>
      <Link
        href={`/admin/units/${unit.id}#photos`}
        className="group relative mb-4 block aspect-[16/9] overflow-hidden rounded-lg bg-sand"
        aria-label={`Edit photos for ${unit.name}`}
      >
        <Image
          src={unit.images?.[0] ?? "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267"}
          alt={`Main photo of ${unit.name}`}
          fill
          sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute bottom-2 right-2 rounded-full bg-navy/80 px-3 py-1 text-xs text-ivory">
          {unit.images?.length ?? 0} photo{(unit.images?.length ?? 0) === 1 ? "" : "s"} · Edit photos
        </span>
      </Link>

      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-navy/15 px-3 py-2 font-display text-lg"
          />
        ) : (
          <p className="font-display text-lg">{unit.name}</p>
        )}
        {!editing && (
          <button onClick={() => setEditing(true)} className="shrink-0 rounded-lg border border-navy/15 p-2 hover:bg-navy/5" aria-label="Edit unit">
            <Pencil size={15} />
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          value={form.short_description}
          onChange={(e) => setForm({ ...form, short_description: e.target.value })}
          rows={2}
          className="mt-3 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
        />
      ) : (
        <p className="mt-2 text-sm text-navy/60">{unit.short_description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-navy/10 pt-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Price / night ({currency})</p>
          {editing ? (
            <input
              type="number"
              min={0}
              value={form.base_price_per_night}
              onChange={(e) => setForm({ ...form, base_price_per_night: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-navy/15 px-2 py-1"
            />
          ) : (
            <p>{formatCurrency(unit.base_price_per_night, currency)}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Max guests</p>
          {editing ? (
            <input
              type="number"
              min={1}
              value={form.max_guests}
              onChange={(e) => setForm({ ...form, max_guests: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-navy/15 px-2 py-1"
            />
          ) : (
            <p>{unit.max_guests}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Beds</p>
          <p>{unit.bedrooms}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/40">Size</p>
          <p>{unit.size_sqm ? `${unit.size_sqm} m²` : "—"}</p>
        </div>
      </div>

      <Link href={`/admin/units/${unit.id}`} className="mt-4 inline-block text-xs text-champagne-dark underline underline-offset-2">
        Photos, amenities &amp; door code →
      </Link>

      <div className="mt-4 flex items-center justify-between border-t border-navy/10 pt-4">
        <label className="flex items-center gap-2 text-sm text-navy/70">
          <input type="checkbox" checked={isActive} onChange={toggleActive} disabled={isPending} />
          {isActive ? "Active — visible on site" : "Inactive — hidden"}
        </label>

        {editing && (
          <div className="flex gap-2">
            <button onClick={cancel} className="btn-secondary px-4 py-2 text-xs" disabled={isPending}>
              <X size={14} className="mr-1 inline" /> Cancel
            </button>
            <button onClick={save} className="btn-primary px-4 py-2 text-xs" disabled={isPending}>
              <Check size={14} className="mr-1 inline" /> Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
