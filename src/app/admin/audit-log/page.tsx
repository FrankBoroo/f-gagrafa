import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";

export default async function AuditLogPage() {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div>
        <h1 className="text-3xl">Audit Log</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can view the audit log.</p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: entries } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);

  return (
    <div>
      <h1 className="text-3xl">Audit Log</h1>
      <p className="mt-2 text-sm text-navy/50">Every change made through the admin dashboard, most recent first.</p>

      <div className="card mt-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
            <tr>
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Who</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Entity</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((e: any) => (
              <tr key={e.id} className="border-b border-navy/5 align-top">
                <td className="whitespace-nowrap px-5 py-4">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-5 py-4">{e.actor_email ?? "system"}</td>
                <td className="px-5 py-4">{e.action}</td>
                <td className="px-5 py-4">{e.entity_type}{e.entity_id ? ` · ${e.entity_id.slice(0, 8)}` : ""}</td>
                <td className="max-w-xs truncate px-5 py-4 text-navy/50" title={JSON.stringify(e.details)}>
                  {e.details ? JSON.stringify(e.details) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries?.length && <p className="p-8 text-center text-navy/40">No activity logged yet.</p>}
      </div>
    </div>
  );
}
