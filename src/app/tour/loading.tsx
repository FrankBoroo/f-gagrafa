import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function TourLoading() {
  return (
    <LoadingRegion label="Loading the tour">
      <div className="h-[78svh] min-h-[520px] bg-navy" />
      <div className="container-gagrafa grid gap-10 py-24 md:grid-cols-12 md:py-32">
        <div className="space-y-3 md:col-span-5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
        <div className="space-y-3 md:col-span-6 md:col-start-7">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </LoadingRegion>
  );
}
