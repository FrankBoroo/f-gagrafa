"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateServiceRequestStatus } from "@/app/admin/service-requests/actions";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export function ServiceRequestCard({ request }: { request: any }) {
  const [status, setStatus] = useState(request.status);
  const [isPending, startTransition] = useTransition();

  function act(next: string) {
    startTransition(async () => {
      const result = await updateServiceRequestStatus(request.id, next);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update");
        return;
      }
      setStatus(next);
    });
  }

  const actions: { label: string; next: string }[] = [];
  if (status === "pending") actions.push({ label: "Start", next: "in_progress" });
  if (status === "in_progress") actions.push({ label: "Mark complete", next: "completed" });
  if (!["completed", "cancelled"].includes(status)) actions.push({ label: "Cancel", next: "cancelled" });

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="capitalize">{request.type}</p>
          <p className="mt-1 text-xs text-navy/50">
            {request.bookings?.guest_name} · {request.bookings?.booking_code}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs capitalize ${statusColor[status]}`}>
          {status.replace("_", " ")}
        </span>
      </div>
      {request.description && <p className="mt-3 text-sm text-navy/70">{request.description}</p>}
      {actions.length > 0 && (
        <div className="mt-4 flex gap-2 border-t border-navy/10 pt-4">
          {actions.map((a) => (
            <button key={a.next} onClick={() => act(a.next)} className="btn-secondary px-4 py-2 text-xs" disabled={isPending}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
