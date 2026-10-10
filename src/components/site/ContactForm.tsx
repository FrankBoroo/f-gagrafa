"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitContactMessage } from "@/app/contact/actions";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitContactMessage({ ...form, honeypot, renderedAt });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong — please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <CheckCircle2 className="text-champagne" size={40} />
        <p className="mt-4 text-lg">Message sent</p>
        <p className="mt-2 text-sm text-navy/60">
          Thank you, {form.name.split(" ")[0]} — our team will get back to you shortly.
        </p>
        <button
          className="btn-secondary mt-6"
          onClick={() => {
            setForm({ name: "", email: "", message: "" });
            setSent(false);
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      {/* Honeypot — hidden from real guests via CSS, not `hidden`, so simple bots still fill it */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm text-navy/60">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      <div>
        <label className="text-sm text-navy/60">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      <div>
        <label className="text-sm text-navy/60">Message</label>
        <textarea
          required
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
