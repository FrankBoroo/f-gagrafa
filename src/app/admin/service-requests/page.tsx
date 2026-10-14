import { createServiceClient } from "@/lib/supabase/server";
import { ServiceRequestCard } from "@/components/admin/ServiceRequestCard";

export default async function AdminServiceRequestsPage() {
  const supabase = createServiceClient();
  const { data: requests } = await supabase
    .from("service_requests")
    .select("*, bookings(guest_name, booking_code)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl">Service Requests</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {requests?.map((r: any) => <ServiceRequestCard key={r.id} request={r} />)}
      </div>
      {!requests?.length && <p className="mt-14 text-center text-navy/40">No service requests yet.</p>}
    </div>
  );
}
