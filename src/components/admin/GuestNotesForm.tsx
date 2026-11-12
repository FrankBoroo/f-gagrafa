"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveGuestNotes } from "@/app/admin/guests/actions";
import { asResult } from "@/lib/action-result";
import { formatDateTime } from "@/lib/format";

const MAX = 2000;

// Private staff notes about a guest (preferences, things to remember). Guests never see them.
export function GuestNotesForm({
  bookingId,
  initialNotes,
  updatedAt,
}: {
  bookingId: string;
  initialNotes: string;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();
  const changed = notes.trim() !== initialNotes.trim();

  function save() {
    startTransition(async () => {
      const result = asResult(await saveGuestNotes({ bookingId, notes }));
      if (!result.ok) {
        toast.error(result.error ?? "Could not save the notes");
        return;
      }
      toast.success("Notes saved");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        save();
      }}
    >
      <label htmlFor="guest-notes" className="text-sm font-medium text-navy">
        Staff notes
      </label>
      <p id="guest-notes-help" className="mt-1 text-xs text-navy/50">
        Only staff see these. They stay with the guest across all their bookings.
      </p>
      <textarea
        id="guest-notes"
        aria-describedby="guest-notes-help"
        value={notes}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)}
        maxLength={MAX}
        rows={6}
        placeholder="Preferences, allergies, how they like to be reached…"
        className="mt-3 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/40"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-navy/50">
          {notes.length} / {MAX}
          {updatedAt && <> · Last saved {formatDateTime(updatedAt)}</>}
        </p>
        <button type="submit" disabled={isPending || !changed} className="btn-primary min-h-11 px-5 py-2 text-xs">
          {isPending ? "Saving…" : "Save notes"}
        </button>
      </div>
    </form>
  );
}
