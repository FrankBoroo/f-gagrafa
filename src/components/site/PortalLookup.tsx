"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyPortalAccess } from "@/app/portal/actions";

export function PortalLookup({ defaultCode, needsVerification }: { defaultCode?: string; needsVerification?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(defaultCode ?? "");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await verifyPortalAccess(code, contact);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/portal/${result.code}`);
  }

  return (
    <form onSubmit={handleLookup} className="card mt-8 space-y-4 p-6">
      {needsVerification && !error && (
        <p className="rounded-lg bg-sand px-4 py-3 text-sm text-navy/70">
          To protect your booking, please confirm the email or phone number you booked with.
        </p>
      )}
      <div>
        <label className="text-sm text-navy/60" htmlFor="portal-code">Booking code</label>
        <input
          id="portal-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GAG-2026-XXXXXX"
          autoCapitalize="characters"
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      <div>
        <label className="text-sm text-navy/60" htmlFor="portal-contact">Email or phone used to book</label>
        <input
          id="portal-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={loading || !code.trim() || !contact.trim()}>
        {loading ? "Checking…" : "View my stay"}
      </button>
      <p className="text-center text-xs text-navy/40">
        Your confirmation email also has a direct link that signs you straight in.
      </p>
    </form>
  );
}
