"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updatePropertySettings } from "@/app/admin/settings/actions";

interface Settings {
  id: string;
  property_name: string;
  tagline: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  admin_notification_email: string | null;
  whatsapp_number: string | null;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState({
    property_name: settings.property_name ?? "",
    tagline: settings.tagline ?? "",
    contact_phone: settings.contact_phone ?? "",
    contact_email: settings.contact_email ?? "",
    address: settings.address ?? "",
    admin_notification_email: settings.admin_notification_email ?? "",
    whatsapp_number: settings.whatsapp_number ?? "",
  });
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updatePropertySettings({ id: settings.id, ...form });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save settings");
        return;
      }
      toast.success("Settings saved");
    });
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="card space-y-4 p-6">
        <h2 className="text-lg">Property info</h2>
        <Field label="Property name" value={form.property_name} onChange={(v) => update("property_name", v)} required />
        <Field label="Tagline" value={form.tagline} onChange={(v) => update("tagline", v)} />
        <Field label="Address" value={form.address} onChange={(v) => update("address", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact phone" value={form.contact_phone} onChange={(v) => update("contact_phone", v)} />
          <Field label="Contact email" type="email" value={form.contact_email} onChange={(v) => update("contact_email", v)} />
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg">Notifications</h2>
        <p className="text-sm text-navy/50">
          Where new-booking, contact, and service-request alerts are sent. Leave blank to
          fall back to the <code>ADMIN_NOTIFICATION_EMAIL</code> environment variable.
        </p>
        <Field
          label="Admin notification email"
          type="email"
          value={form.admin_notification_email}
          onChange={(v) => update("admin_notification_email", v)}
        />
        <Field
          label="WhatsApp number (for guest confirmations)"
          value={form.whatsapp_number}
          onChange={(v) => update("whatsapp_number", v)}
          hint="Informational for now — guest confirmations are sent to the booking's own phone number."
        />
      </div>

      <button className="btn-primary" disabled={isPending}>
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function Field({
  label, value, onChange, type = "text", required, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-sm text-navy/60">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
      />
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}
