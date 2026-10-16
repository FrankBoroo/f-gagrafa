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
  reception_hours?: string | null;
  wifi_network?: string | null;
  wifi_password?: string | null;
  entry_instructions?: string | null;
  house_rules?: string | null;
  emergency_contact?: string | null;
  deposit_percent?: number | null;
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
    reception_hours: settings.reception_hours ?? "",
    wifi_network: settings.wifi_network ?? "",
    wifi_password: settings.wifi_password ?? "",
    entry_instructions: settings.entry_instructions ?? "",
    house_rules: settings.house_rules ?? "",
    emergency_contact: settings.emergency_contact ?? "",
  });
  const [isPending, startTransition] = useTransition();
  // Only present once the deposits migration has been run; until then we leave it out of the
  // save, so the rest of Settings keeps saving normally.
  const depositAvailable = settings.deposit_percent !== undefined && settings.deposit_percent !== null;
  const [depositPercent, setDepositPercent] = useState<number>(settings.deposit_percent ?? 50);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updatePropertySettings({
        id: settings.id,
        ...form,
        ...(depositAvailable ? { deposit_percent: depositPercent } : {}),
      });
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
        <Field
          label="Reception hours"
          value={form.reception_hours}
          onChange={(v) => update("reception_hours", v)}
          hint="Shown on the Contact page. Phone and email only appear on the site once you fill them in."
        />
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg">Guest information</h2>
        <p className="text-sm text-navy/50">
          Shown in the Guest Portal. Wi-Fi and entry details are only revealed to a verified guest
          with a paid, active stay — never on the public site. Each residence's door code is set on
          its own page under Units.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wi-Fi network" value={form.wifi_network} onChange={(v) => update("wifi_network", v)} />
          <Field label="Wi-Fi password" value={form.wifi_password} onChange={(v) => update("wifi_password", v)} />
        </div>
        <Field
          label="Check-in & entry instructions"
          multiline
          value={form.entry_instructions}
          onChange={(v) => update("entry_instructions", v)}
          hint="e.g. gate code, where to collect keys, parking directions."
        />
        <Field
          label="House rules"
          multiline
          value={form.house_rules}
          onChange={(v) => update("house_rules", v)}
        />
        <Field
          label="Emergency contacts"
          multiline
          value={form.emergency_contact}
          onChange={(v) => update("emergency_contact", v)}
          hint="e.g. Front desk: +233 … (24/7)."
        />
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg">Deposits</h2>
        <p className="text-sm text-navy/50">
          Guests can reserve by paying this share of the total now and the rest at check-in. It's only
          offered when check-in is at least 7 days away; closer than that, guests pay in full. Set 0 to
          turn deposits off.
        </p>
        <div>
          <label className="text-sm text-navy/60" htmlFor="deposit-percent">Deposit (% of the total)</label>
          <input
            id="deposit-percent"
            type="number"
            min={0}
            max={90}
            step={1}
            disabled={!depositAvailable}
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3 disabled:bg-sand disabled:text-navy/40"
          />
          {!depositAvailable && (
            <p className="mt-1 text-xs text-amber-700">
              Deposits aren't switched on yet. Run <code>supabase/migration-deposits.sql</code> in the Supabase SQL Editor, then reload this page.
            </p>
          )}
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
  label, value, onChange, type = "text", required, hint, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-sm text-navy/60">{label}</label>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      )}
      {hint && <p className="mt-1 text-xs text-navy/40">{hint}</p>}
    </div>
  );
}
