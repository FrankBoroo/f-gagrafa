import { createServiceClient } from "@/lib/supabase/server";
import { ReviewCard } from "@/components/admin/ReviewCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageSquareQuote } from "lucide-react";

export default async function AdminReviewsPage() {
  const supabase = createServiceClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, bookings(guest_name, booking_code)")
    .order("created_at", { ascending: false });

  const pending = reviews?.filter((r: any) => !r.is_published) ?? [];
  const published = reviews?.filter((r: any) => r.is_published) ?? [];

  return (
    <div>
      <h1 className="text-3xl">Reviews</h1>

      <h2 className="mt-8 text-lg text-navy/60">Pending ({pending.length})</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pending.map((r: any) => <ReviewCard key={r.id} review={r} />)}
        {!pending.length && (
          <EmptyState compact icon={MessageSquareQuote} title="Nothing waiting for review" className="md:col-span-2 xl:col-span-3" />
        )}
      </div>

      <h2 className="mt-10 text-lg text-navy/60">Published ({published.length})</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {published.map((r: any) => <ReviewCard key={r.id} review={r} />)}
        {!published.length && (
          <EmptyState
            compact
            title="No published reviews yet"
            description="Guests can leave a review from the portal after their stay; publish the good ones here."
            className="md:col-span-2 xl:col-span-3"
          />
        )}
      </div>
    </div>
  );
}
