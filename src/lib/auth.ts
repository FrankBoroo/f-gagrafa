import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CurrentProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "guest" | "admin" | "staff";
}

// Uses the signed-in user's own session (not the service-role client), so
// this reflects exactly what middleware already verified for /admin/* —
// safe to call again inside a page that needs to know *which* role, not
// just that the user passed the gate.
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { id: profile.id, email: user.email ?? null, full_name: profile.full_name, role: profile.role };
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "admin";
}

export async function isStaff(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "admin" || profile?.role === "staff";
}

// Returned by server actions when the caller isn't signed in as staff or admin.
export const UNAUTHORIZED = { ok: false as const, error: "You don't have permission to do that." };
