// Public settings (NEXT_PUBLIC_*), safe to import from client and server code. Each variable
// is read by its full name so Next.js can inline it into browser bundles. Server-only secrets
// live in `env.server.ts`. Empty strings count as unset, because .env.example ships blanks.

const PRODUCTION_SITE_URL = "https://www.thegagrafa.com";

export function envValue(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  return v ? v : undefined;
}

export const publicEnv = {
  supabaseUrl: envValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: envValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  // Only what was actually configured; use `siteUrl()` when a fallback is fine.
  configuredSiteUrl: envValue(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, ""),
  googleMapsEmbedUrl: envValue(process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL),
};

// Absolute site URL for links, metadata and the Paystack callback.
export function siteUrl(): string {
  if (publicEnv.configuredSiteUrl) return publicEnv.configuredSiteUrl;
  return process.env.NODE_ENV === "production" ? PRODUCTION_SITE_URL : "http://localhost:3000";
}

export function supabasePublicConfig(): { url: string; anonKey: string } {
  const { supabaseUrl, supabaseAnonKey } = publicEnv;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. Copy .env.example to .env.local."
    );
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}
