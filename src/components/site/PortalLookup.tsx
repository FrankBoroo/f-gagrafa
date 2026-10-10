"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PortalLookup({ defaultCode }: { defaultCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(defaultCode ?? "");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    if (!code || !contact) {
      toast.error("Enter your booking code and email or phone");
      return;
    }
    setLoading(true);
    try {
      router.push(`/portal/${code.trim().toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mt-8 space-y-4 p-6">
      <div>
        <label className="text-sm text-navy/60">Booking code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GAG-2026-XXXX"
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      <div>
        <label className="text-sm text-navy/60">Email or phone used to book</label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      <button className="btn-primary w-full" onClick={handleLookup} disabled={loading}>
        {loading ? "Looking up…" : "View my stay"}
      </button>
      <p className="text-center text-xs text-navy/40">
        Prefer a link? We can also send a magic sign-in link to your email.
      </p>
    </div>
  );
}
