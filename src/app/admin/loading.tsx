import { CardSkeleton, LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

// Shown inside the admin layout (the sidebar stays put) while any admin page loads.
export default function AdminLoading() {
  return (
    <LoadingRegion label="Loading">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-full max-w-md" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i: number) => <CardSkeleton key={i} image={false} />)}
      </div>
    </LoadingRegion>
  );
}
