import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    supabasePublicConfig().url,
    supabasePublicConfig().anonKey
  );
}
