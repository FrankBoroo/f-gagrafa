import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { TeamManager, type TeamMember } from "@/components/admin/TeamManager";

export default async function AdminTeamPage() {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") {
    return (
      <div>
        <h1 className="text-3xl">Team</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can manage the team.</p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "staff"]);

  // Emails and sign-in times live in Supabase Auth, not in profiles.
  const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const byId = new Map<string, { email?: string; last_sign_in_at?: string | null }>(
    (authData?.users ?? []).map((u: any) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at }])
  );

  const members: TeamMember[] = (profiles ?? [])
    .map((p: any) => ({
      id: p.id,
      name: p.full_name,
      email: byId.get(p.id)?.email ?? "(unknown email)",
      role: p.role,
      lastSignIn: byId.get(p.id)?.last_sign_in_at ?? null,
    }))
    .sort((a: TeamMember, b: TeamMember) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "admin" ? -1 : 1));

  return (
    <div>
      <h1 className="text-3xl">Team</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Invite people to the admin and control what they can do. Staff can run day-to-day bookings;
        only admins see payments, refunds, settings, reports and this page.
      </p>
      <div className="mt-8">
        <TeamManager members={members} currentUserId={me.id} />
      </div>
    </div>
  );
}
