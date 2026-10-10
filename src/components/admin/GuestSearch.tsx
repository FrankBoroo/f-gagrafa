"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function GuestSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/40" size={16} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full rounded-lg border border-navy/15 bg-white py-2.5 pl-9 pr-3 text-sm"
      />
    </form>
  );
}
