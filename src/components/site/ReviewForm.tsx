"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/app/portal/actions";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitReview({ booking_id: bookingId, rating, comment });
      if (!result.ok) {
        toast.error(result.error ?? "Could not submit review");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="card mt-4 p-6 text-sm text-navy/70">
        Thank you for your review — it'll appear on the site once approved.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-4 space-y-4 p-6">
      <div>
        <p className="text-sm text-navy/60">How was your stay?</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <Star
                size={28}
                className={(hoverRating || rating) >= n ? "fill-champagne text-champagne" : "text-navy/20"}
              />
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Tell us about your stay (optional)…"
        className="w-full rounded-lg border border-navy/15 px-4 py-3"
      />
      <button className="btn-primary" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
