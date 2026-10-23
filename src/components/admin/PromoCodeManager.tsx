"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPromoCode, togglePromoCodeActive } from "@/app/admin/promo-codes/actions";
import type { PriceCurrency } from "@/lib/pricing";

interface PromoCode {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

export function PromoCodeManager({ codes, currency }: { codes: PromoCode[]; currency: PriceCurrency }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: 10,
    max_uses: "",
    valid_from: "",
    valid_until: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPromoCode({
        code: form.code,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not create code");
        return;
      }
      toast.success("Promo code created");
      setForm({ code: "", discount_type: "percent", discount_value: 10, max_uses: "", valid_from: "", valid_until: "" });
    });
  }

  function toggle(id: string, next: boolean) {
    startTransition(async () => {
      const result = await togglePromoCodeActive(id, next);
      if (!result.ok) toast.error(result.error ?? "Could not update");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="text-lg">New promo code</h2>
        <div>
          <label className="text-sm text-navy/60">Code</label>
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="WELCOME10"
            className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm uppercase"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-navy/60">Type</label>
            <select
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percent" | "fixed" })}
              className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount ({currency})</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-navy/60">Value</label>
            <input
              type="number"
              min={1}
              required
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
              className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-navy/60">Max uses (optional)</label>
          <input
            type="number"
            min={1}
            value={form.max_uses}
            onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            placeholder="Unlimited"
            className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-navy/60">Valid from</label>
            <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-sm text-navy/60">Valid until</label>
            <input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="mt-2 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm" />
          </div>
        </div>
        <button className="btn-primary w-full" disabled={isPending}>
          {isPending ? "Creating…" : "Create code"}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="text-lg">Existing codes</h2>
        <div className="mt-4 space-y-3">
          {codes.map((c) => (
            <div key={c.id} className="rounded-lg border border-navy/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg">{c.code}</p>
                <label className="flex items-center gap-2 text-xs text-navy/60">
                  <input type="checkbox" checked={c.is_active} onChange={(e) => toggle(c.id, e.target.checked)} disabled={isPending} />
                  Active
                </label>
              </div>
              <p className="mt-1 text-sm text-navy/50">
                {c.discount_type === "percent" ? `${c.discount_value}% off` : `${currency} ${c.discount_value} off`}
                {" · "}
                {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""} used
                {c.valid_until ? ` · expires ${c.valid_until}` : ""}
              </p>
            </div>
          ))}
          {!codes.length && <p className="text-sm text-navy/40">No promo codes yet.</p>}
        </div>
      </div>
    </div>
  );
}
