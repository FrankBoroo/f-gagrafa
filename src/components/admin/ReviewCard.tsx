"use client";

import { useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setReviewPublished, deleteReview } from "@/app/admin/reviews/actions";

export function ReviewCard({ review }: { review: any }) {
  const [isPending, startTransition] = useTransition();

  function togglePublish() {
    startTransition(async () => {
      const result = await setReviewPublished(review.id, !review.is_published);
      if (!result.ok) toast.error(result.error ?? "Could not update review");
      else toast.success(review.is_published ? "Unpublished" : "Published");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteReview(review.id);
      if (!result.ok) toast.error(result.error ?? "Could not delete review");
    });
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={15} className={review.rating >= n ? "fill-champagne text-champagne" : "text-navy/20"} />
            ))}
          </div>
          <p className="mt-2 text-sm text-navy/50">
            {review.bookings?.guest_name} · {review.bookings?.booking_code}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${review.is_published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {review.is_published ? "Published" : "Pending"}
        </span>
      </div>

      {review.comment && <p className="mt-4 text-sm text-navy/70">"{review.comment}"</p>}

      <div className="mt-4 flex gap-2 border-t border-navy/10 pt-4">
        <button onClick={togglePublish} className="btn-secondary flex-1 px-4 py-2 text-xs" disabled={isPending}>
          {review.is_published ? "Unpublish" : "Publish"}
        </button>
        <button onClick={remove} className="rounded-lg p-2 text-navy/40 hover:bg-red-50 hover:text-red-600" disabled={isPending} aria-label="Delete review">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
