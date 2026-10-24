import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function BookingLoading() {
  return (
    <LoadingRegion label="Loading booking" className="container-gagrafa max-w-4xl py-24">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-10 w-72" />
      <div className="card mt-10 space-y-6 p-6 md:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i: number) => <Skeleton key={i} className="h-12" />)}
        </div>
        {Array.from({ length: 3 }, (_, i: number) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </LoadingRegion>
  );
}
