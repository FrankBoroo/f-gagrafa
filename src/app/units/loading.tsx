import { CardSkeleton, LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function UnitsLoading() {
  return (
    <LoadingRegion label="Loading residences" className="container-gagrafa py-24">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-5 h-10 w-64" />
      <Skeleton className="mt-5 h-4 w-full max-w-xl" />
      <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i: number) => <CardSkeleton key={i} />)}
      </div>
    </LoadingRegion>
  );
}
