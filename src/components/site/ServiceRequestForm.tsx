"use client";

import { useState } from "react";
import { toast } from "sonner";

const types = [
  { value: "cleaning", label: "Extra cleaning" },
  { value: "towels", label: "More towels" },
  { value: "maintenance", label: "Maintenance issue" },
  { value: "other", label: "Something else" },
];

export function ServiceRequestForm({ bookingId }: { bookingId: string }) {
  const [type, setType] = useState("cleaning");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, type, description }),
      });
      if (!res.ok) throw new Error("Could not send request");
      setSent(true);
      setDescription("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-4 rounded-xl border border-champagne/40 bg-champagne/10 p-5 text-sm">
        Request sent — our team will follow up shortly.{" "}
        <button className="underline" onClick={() => setSent(false)}>Send another</button>
      </div>
    );
  }

  return (
    <div className="card mt-4 space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full border px-4 py-2 text-sm ${type === t.value ? "border-navy bg-navy text-ivory" : "border-navy/20 text-navy/70"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add any details…"
        rows={3}
        className="w-full rounded-lg border border-navy/15 px-4 py-3"
      />
      <button className="btn-primary" onClick={submit} disabled={submitting}>
        {submitting ? "Sending…" : "Send request"}
      </button>
    </div>
  );
}
