"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearAttention } from "@/app/admin/today/actions";
import { RoomAssignment } from "@/components/admin/RoomAssignment";
import type { AttentionItem, TodayBooking } from "@/lib/admin/today";

// Needs attention: rooms to confirm (Confirm / Change right here), payment problems
// (open the booking, then Mark handled), Airbnb clashes (open the booking), and cancellation requests (to the Inbox).
export function AttentionList({ items, bookings }: { items: AttentionItem[]; bookings: Record<string, TodayBooking> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handled(bookingId: string) {
    startTransition(async () => {
      const result = await clearAttention(bookingId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update");
        return;
      }
      toast.success("Marked as handled");
      router.refresh();
    });
  }

  if (!items.length) {
    return <p className="py-2 text-sm text-navy/60">Nothing needs you right now.</p>;
  }

  return (
    <ul className="divide-y divide-sand">
      {items.map((item) => {
        const booking = bookings[item.bookingId];
        return (
          <li key={`${item.kind}-${item.bookingId}-${item.detail}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium text-navy">{item.title}:</span> <span className="text-navy/70">{item.detail}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {item.kind === "room_to_confirm" && booking && (
                <RoomAssignment
                  booking={{
                    id: booking.id,
                    room_number: booking.room_number,
                    room_confirmed: booking.room_confirmed,
                    status: booking.status,
                    payment_status: booking.payment_status,
                  }}
                />
              )}
              {item.kind === "cancellation_request" && (
                <Link href="/admin/inbox" className="btn-secondary min-h-11 px-4 py-2 text-xs">Open Inbox</Link>
              )}
              {item.kind !== "room_to_confirm" && item.kind !== "cancellation_request" && (
                <>
                  <Link href={`/admin/bookings?q=${encodeURIComponent(item.bookingCode)}`} className="btn-secondary min-h-11 px-4 py-2 text-xs">
                    Open booking
                  </Link>
                  {item.kind !== "airbnb_clash" && (
                    <button
                      type="button"
                      onClick={() => handled(item.bookingId)}
                      disabled={isPending}
                      className="btn-primary min-h-11 px-4 py-2 text-xs"
                    >
                      Mark handled
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
