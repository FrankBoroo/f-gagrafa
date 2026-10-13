"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestCancellation } from "@/app/portal/actions";

export function CancellationRequest({ bookingId, alreadyRequested }: { bookingId: string; alreadyRequested: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(alreadyRequested);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await requestCancellation(bookingId, reason);
      if (!result.ok) {
        toast.error(result.error ?? "Could not send your request");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <p className="mt-4 rounded-lg bg-sand px-4 py-3 text-sm text-navy/70">
        Your cancellation request has been received. Our team will confirm it and any refund by email.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary mt-4" onClick={() => setOpen(true)}>
        Request cancellation
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Reason (optional)"
        className="w-full rounded-lg border border-navy/15 px-4 py-3 text-sm"
      />
      <div className="flex gap-3">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={isPending}>
          Keep my booking
        </button>
        <button type="button" className="btn-primary" onClick={submit} disabled={isPending}>
          {isPending ? "Sending…" : "Send cancellation request"}
        </button>
      </div>
    </div>
  );
}
