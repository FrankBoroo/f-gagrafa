import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    supabasePublicConfig().url,
    supabasePublicConfig().anonKey
  );
}
