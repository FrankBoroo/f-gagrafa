"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";

const statuses = ["all", "pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"];
const paymentStatuses = ["all", "unpaid", "paid", "partial", "refunded"];

export function BookingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", q);
  }

  return (
    <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, or booking code…"
          className="w-full rounded-lg border border-navy/15 bg-white py-2.5 pl-9 pr-3 text-sm"
        />
      </div>
      <select
        defaultValue={searchParams.get("status") ?? "all"}
        onChange={(e) => updateParam("status", e.target.value)}
        className="rounded-lg border border-navy/15 bg-white px-3 py-2.5 text-sm capitalize"
      >
        {statuses.map((s) => (
          <option key={s} value={s} className="capitalize">{s === "all" ? "All statuses" : s.replace("_", " ")}</option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("payment_status") ?? "all"}
        onChange={(e) => updateParam("payment_status", e.target.value)}
        className="rounded-lg border border-navy/15 bg-white px-3 py-2.5 text-sm capitalize"
      >
        {paymentStatuses.map((s) => (
          <option key={s} value={s} className="capitalize">{s === "all" ? "All payments" : s}</option>
        ))}
      </select>
      <button type="submit" className="btn-secondary py-2.5 sm:w-auto">Search</button>
    </form>
  );
}
