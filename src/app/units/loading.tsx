import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function UnitsLoading() {
  return (
    <LoadingRegion label="Loading apartments" className="container-gagrafa py-20 md:py-28">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-5 h-12 w-72" />
      <div className="mt-14 space-y-16">
        {Array.from({ length: 2 }, (_, i: number) => (
          <div key={i} className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr] md:gap-12">
            <Skeleton className="aspect-[4/3] w-full" />
            <div>
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="mt-4 h-4 w-1/2" />
              <Skeleton className="mt-3 h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
