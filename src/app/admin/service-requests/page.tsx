import { createServiceClient } from "@/lib/supabase/server";
import { ServiceRequestCard } from "@/components/admin/ServiceRequestCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConciergeBell } from "lucide-react";

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
      {!requests?.length && (
        <EmptyState
          icon={ConciergeBell}
          title="No service requests yet"
          description="When guests ask for cleaning, maintenance or anything else from the portal, it lands here."
        />
      )}
    </div>
  );
}
