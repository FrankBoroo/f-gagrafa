"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createUnit, updateUnitDetails } from "@/app/admin/units/actions";
import { asResult } from "@/lib/action-result";
import type { UnitType } from "@/lib/types";

export interface UnitFormValues {
  name: string;
  type: UnitType;
  short_description: string;
  description: string;
  base_price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number | null;
  amenities: string[];
  access_code: string;
  is_active: boolean;
}

const TYPE_LABELS: Record<UnitType, string> = {
  studio: "Studio",
  "1bed_standard": "1 Bedroom Standard",
  "1bed_executive": "1 Bedroom Executive",
  "2bed": "2 Bedroom",
  penthouse: "Penthouse",
};

const EMPTY: UnitFormValues = {
  name: "",
  type: "studio",
  short_description: "",
  description: "",
  base_price_per_night: 0,
  max_guests: 2,
  bedrooms: 1,
  bathrooms: 1,
  size_sqm: null,
  amenities: [],
  access_code: "",
  is_active: false, // new residences start as drafts until photos are added
};

export function UnitForm({ unitId, initial }: { unitId?: string; initial?: UnitFormValues }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<UnitFormValues>(initial ?? EMPTY);
  const [amenitiesText, setAmenitiesText] = useState((initial?.amenities ?? []).join("\n"));
  const editing = Boolean(unitId);

  function update<K extends keyof UnitFormValues>(key: K, value: UnitFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: UnitFormValues = {
      ...form,
      amenities: amenitiesText.split("\n").map((a: string) => a.trim()).filter(Boolean),
    };
    startTransition(async () => {
      const result = asResult<{ id: string; warning: string }>(
        editing ? await updateUnitDetails(unitId as string, payload) : await createUnit(payload)
      );
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      if (result.warning) toast.warning(result.warning);
      if (editing) {
        toast.success("Residence saved");
        router.refresh();
      } else if (result.id) {
        toast.success("Residence created — now add photos");
        router.push(`/admin/units/${result.id}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <h2 className="text-lg">{editing ? "Details" : "New residence"}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input required value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => update("type", e.target.value as UnitType)} className={inputClass}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Short description" hint="One line shown on cards.">
        <input
          maxLength={300}
          value={form.short_description}
          onChange={(e) => update("short_description", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Full description">
        <textarea
          rows={5}
          maxLength={3000}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price per night (GHS)">
          <input
            type="number" min={1} step="any" required
            value={form.base_price_per_night || ""}
            onChange={(e) => update("base_price_per_night", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Max guests">
          <input type="number" min={1} max={30} required value={form.max_guests}
            onChange={(e) => update("max_guests", Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Size (m²)">
          <input type="number" min={0} step="any" value={form.size_sqm ?? ""}
            onChange={(e) => update("size_sqm", e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Bedrooms" hint="0 for a studio.">
          <input type="number" min={0} max={20} required value={form.bedrooms}
            onChange={(e) => update("bedrooms", Number(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Bathrooms">
          <input type="number" min={0} max={20} step="0.5" required value={form.bathrooms}
            onChange={(e) => update("bathrooms", Number(e.target.value))} className={inputClass} />
        </Field>
      </div>

      <Field label="Amenities" hint="One per line, e.g. Free Wi-Fi.">
        <textarea rows={6} value={amenitiesText} onChange={(e) => setAmenitiesText(e.target.value)} className={inputClass} />
      </Field>

      <Field
        label="Door code"
        hint="Shown only to a verified guest with a confirmed stay, from the day before check-in until check-out. Never shown on the public site."
      >
        <input value={form.access_code} onChange={(e) => update("access_code", e.target.value)} autoComplete="off" className={inputClass} />
      </Field>

      <label className="flex items-start gap-2 text-sm text-navy/70">
        <input type="checkbox" className="mt-1" checked={form.is_active} onChange={(e) => update("is_active", e.target.checked)} />
        <span>
          Visible on the public site and open for booking
          {!editing && <span className="block text-xs text-navy/40">Leave off until you've added photos, then switch it on.</span>}
        </span>
      </label>

      <button className="btn-primary" disabled={isPending}>
        {isPending ? "Saving…" : editing ? "Save changes" : "Create residence"}
      </button>
    </form>
  );
}

const inputClass = "mt-2 w-full rounded-lg border border-navy/15 px-4 py-3";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-navy/60">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}
