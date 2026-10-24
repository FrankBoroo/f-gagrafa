import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/env";
import { requireServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
  return createSupabaseClient<Database>(
    supabasePublicConfig().url,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}
