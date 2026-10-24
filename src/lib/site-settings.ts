import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { GHS_PRICING, pricingFromSettings, type Pricing } from "@/lib/booking/pricing";

// Only the details that are fine for anyone to see. Wi-Fi passwords, entry
// instructions and the like live in the same table but are NEVER returned here —
// the guest portal reads those separately, and only for a verified, active stay.
export interface PublicSettings {
  property_name: string;
  tagline: string;
  address: string;
  contact_phone: string;
  contact_email: string;
  reception_hours: string;
  deposit_percent: number; // 0 = deposits off
  pricing: Pricing;
}

const DEFAULTS: PublicSettings = {
  property_name: "The Gagrafa",
  tagline: "Live Luxuriously, Stay Serenely",
  address: "Spintex, Community 20, Accra, Ghana",
  contact_phone: "",
  contact_email: "",
  reception_hours: "24/7 — someone is always at the desk",
  deposit_percent: 0,
  pricing: GHS_PRICING,
};

async function loadPublicSettings(): Promise<PublicSettings> {
  try {
    const supabase = createServiceClient();
    // select("*") on purpose: keeps working even before the newest columns exist.
    const { data } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();
    if (!data) return DEFAULTS;
    return {
      property_name: data.property_name || DEFAULTS.property_name,
      tagline: data.tagline || DEFAULTS.tagline,
      address: data.address || DEFAULTS.address,
      contact_phone: data.contact_phone || "",
      contact_email: data.contact_email || "",
      reception_hours: data.reception_hours || DEFAULTS.reception_hours,
      deposit_percent: Math.min(90, Math.max(0, Math.round(Number(data.deposit_percent ?? 0)) || 0)),
      pricing: pricingFromSettings(data),
    };
  } catch {
    return DEFAULTS;
  }
}

// Cached for 5 minutes; saving Settings busts the cache immediately (tag "settings").
export const getPublicSettings = unstable_cache(loadPublicSettings, ["public-settings"], {
  revalidate: 300,
  tags: ["settings"],
});
