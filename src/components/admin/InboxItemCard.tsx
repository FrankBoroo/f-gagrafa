"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setContactMessageRead } from "@/app/admin/inbox/actions";
import { updateServiceRequestStatus } from "@/app/admin/service-requests/actions";
import { formatDateTime } from "@/lib/format";
import type { InboxItem, InboxKind } from "@/lib/admin/inbox";

const KIND: Record<InboxKind, { label: string; className: string }> = {
  cancellation_request: { label: "Cancellation request", className: "bg-red-100 text-red-700" },
  service_request: { label: "Service request", className: "bg-sand text-navy/70" },
  contact_message: { label: "Message", className: "bg-champagne/20 text-navy/80" },
};

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "New", className: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In progress", className: "bg-sky-100 text-sky-700" },
  completed: { label: "Done", className: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Closed", className: "bg-navy/10 text-navy/60" },
  unread: { label: "Unread", className: "bg-amber-100 text-amber-700" },
  read: { label: "Read", className: "bg-navy/10 text-navy/60" },
};

function requestSteps(status: string): { label: string; next: string }[] {
  const steps: { label: string; next: string }[] = [];
  if (status === "pending") steps.push({ label: "Start", next: "in_progress" });
  if (status === "pending" || status === "in_progress") {
    steps.push({ label: "Mark done", next: "completed" });
    steps.push({ label: "Close", next: "cancelled" });
  }
  return steps;
}

// One Inbox entry. The body is guest-written text and is always shown as plain text.
export function InboxItemCard({ item }: { item: InboxItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const kind = KIND[item.kind];
  const status = STATUS[item.status] ?? { label: item.status, className: "bg-navy/10 text-navy/60" };

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Could not update");
        return;
      }
      router.refresh();
    });
  }

  const isContact = item.kind === "contact_message";
  const mailto = item.email
    ? `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Your message to The Gagrafa")}`
    : null;

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${kind.className}`}>{kind.label}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${status.className}`}>{status.label}</span>
      </div>

      <h2 className="mt-3 font-sans text-base font-medium text-navy">{item.title}</h2>
      <p className="mt-1 text-xs text-navy/50">
        {formatDateTime(item.createdAt)}
        {item.bookingCode && <> · {item.bookingCode}</>}
        {item.email && <> · {item.email}</>}
      </p>

      {item.body && <p className="mt-3 whitespace-pre-line break-words text-sm text-navy/70">{item.body}</p>}

      {item.kind === "cancellation_request" && item.open && (
        <p className="mt-3 text-xs text-navy/50">
          Open the booking and use Cancel &amp; refund, then mark this done.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-navy/10 pt-4">
        {item.kind === "cancellation_request" && item.bookingCode && (
          <Link
            href={`/admin/bookings?q=${encodeURIComponent(item.bookingCode)}`}
            className="btn-primary min-h-11 px-4 py-2 text-xs"
          >
            Open booking
          </Link>
        )}

        {!isContact &&
          requestSteps(item.status).map((step: { label: string; next: string }) => (
            <button
              key={step.next}
              type="button"
              onClick={() => run(() => updateServiceRequestStatus(item.id, step.next))}
              disabled={isPending}
              className="btn-secondary min-h-11 px-4 py-2 text-xs"
            >
              {step.label}
            </button>
          ))}

        {!isContact && !item.open && (
          <button
            type="button"
            onClick={() => run(() => updateServiceRequestStatus(item.id, "pending"))}
            disabled={isPending}
            className="btn-secondary min-h-11 px-4 py-2 text-xs"
          >
            Reopen
          </button>
        )}

        {isContact && mailto && (
          <a href={mailto} className="btn-primary min-h-11 px-4 py-2 text-xs">
            Reply by email
          </a>
        )}
        {isContact && (
          <button
            type="button"
            onClick={() => run(() => setContactMessageRead(item.id, item.open))}
            disabled={isPending}
            className="btn-secondary min-h-11 px-4 py-2 text-xs"
          >
            {item.open ? "Mark read" : "Mark unread"}
          </button>
        )}
      </div>
    </li>
  );
}
