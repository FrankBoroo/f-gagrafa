import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/env";
import { requireServerEnv } from "@/lib/env.server";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabasePublicConfig().url,
    supabasePublicConfig().anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore with middleware refresh
          }
        },
      },
    }
  );
}

// Service-role client for privileged server actions (webhooks, admin writes).
// Never import this in client components.
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    supabasePublicConfig().url,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}
