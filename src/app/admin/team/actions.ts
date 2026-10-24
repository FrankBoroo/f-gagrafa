"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendStaffInviteEmail } from "@/lib/email";
import { inviteTeamMemberSchema, type InviteTeamMemberInput } from "@/lib/validations";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { TablesInsert } from "@/types/database";

// Everything here is admin-only, and checked inside each action (not just on the page).
async function requireAdmin() {
  const me = await getCurrentProfile();
  return me?.role === "admin" ? me : null;
}

const NOT_ADMIN = { ok: false as const, error: "Only admins can manage the team." };

// Makes a one-time sign-in link on OUR domain (so Supabase's redirect-URL settings don't
// matter), for either a brand-new person (invite) or an existing user (password reset).
// Supabase doesn't email anything for generateLink — we send it ourselves, and also hand
// the link back so an admin can pass it on by WhatsApp if email isn't working.
async function createSignInLink(supabase: any, email: string, fullName: string) {
  const site = publicEnv.configuredSiteUrl;
  if (!site) return { error: "NEXT_PUBLIC_SITE_URL isn't set, so a link can't be built." };

  let result = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: fullName ? { full_name: fullName } : {} },
  });

  if (result.error) {
    // Already registered: a recovery link lets them set a (new) password instead.
    result = await supabase.auth.admin.generateLink({ type: "recovery", email });
  }
  if (result.error || !result.data?.user || !result.data?.properties?.hashed_token) {
    return { error: result.error?.message ?? "Could not create the sign-in link." };
  }

  const { properties, user } = result.data;
  const link = `${site}/auth/confirm?token_hash=${encodeURIComponent(properties.hashed_token)}&type=${properties.verification_type}`;
  return { link, userId: user.id as string };
}

export async function inviteTeamMember(input: InviteTeamMemberInput) {
  const me = await requireAdmin();
  if (!me) return NOT_ADMIN;

  const parsed = inviteTeamMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  const { email, fullName, role } = parsed.data;

  if (email === (me.email ?? "").toLowerCase()) return { ok: false, error: "That's your own account." };

  const supabase = createServiceClient();
  const made = await createSignInLink(supabase, email, fullName);
  if ("error" in made && made.error) return { ok: false, error: made.error };
  const { link, userId } = made as { link: string; userId: string };

  // Don't quietly change the role of someone who's already on the team.
  const { data: existing } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (existing && (existing.role === "admin" || existing.role === "staff")) {
    return { ok: false, error: `${email} is already on the team as ${existing.role}. Change their role in the list below.` };
  }

  const profile: TablesInsert<"profiles"> = { id: userId, role };
  if (fullName) profile.full_name = fullName;
  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };

  await sendStaffInviteEmail(email, fullName, role, link);
  await logAudit("team.invited", "profile", userId, { email, role });
  revalidatePath("/admin/team");
  return { ok: true, link, emailAttempted: Boolean(serverEnv.RESEND_API_KEY) };
}

// A fresh link for someone already on the team (invite expired, password forgotten, or an
// email scanner used up the first one).
export async function newSignInLink(userId: string) {
  const me = await requireAdmin();
  if (!me) return NOT_ADMIN;

  const supabase = createServiceClient();
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", userId).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "That person isn't on the team." };
  }
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (!email) return { ok: false, error: "Couldn't find that account's email." };

  const made = await createSignInLink(supabase, email, profile.full_name ?? "");
  if ("error" in made && made.error) return { ok: false, error: made.error };
  const { link } = made as { link: string };

  await sendStaffInviteEmail(email, profile.full_name ?? "", profile.role, link);
  await logAudit("team.link_sent", "profile", userId, { email });
  return { ok: true, link, emailAttempted: Boolean(serverEnv.RESEND_API_KEY) };
}

// Never let the team end up with no admin, and never let someone lock themselves out.
async function guardRoleChange(supabase: any, me: { id: string }, userId: string) {
  if (userId === me.id) return "You can't change your own access. Ask another admin.";
  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target) return "That person wasn't found.";
  if (target.role === "admin") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return "There must always be at least one admin.";
  }
  return null;
}

export async function changeTeamRole(userId: string, role: string) {
  const me = await requireAdmin();
  if (!me) return NOT_ADMIN;
  if (role !== "admin" && role !== "staff") return { ok: false, error: "Invalid role" };

  const supabase = createServiceClient();
  const problem = await guardRoleChange(supabase, me, userId);
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit("team.role_changed", "profile", userId, { role });
  revalidatePath("/admin/team");
  return { ok: true };
}

// Removes admin access (they keep no dashboard rights). Their login still exists; it just
// no longer opens /admin. Takes effect on their very next page load.
export async function removeTeamAccess(userId: string) {
  const me = await requireAdmin();
  if (!me) return NOT_ADMIN;

  const supabase = createServiceClient();
  const problem = await guardRoleChange(supabase, me, userId);
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase.from("profiles").update({ role: "guest" }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit("team.access_removed", "profile", userId);
  revalidatePath("/admin/team");
  return { ok: true };
}
