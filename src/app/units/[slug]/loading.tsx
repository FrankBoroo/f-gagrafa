import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function UnitLoading() {
  return (
    <LoadingRegion label="Loading apartment">
      <div className="px-1.5 pt-1.5">
        <Skeleton className="h-72 w-full md:h-[34rem]" />
      </div>
      <div className="container-gagrafa grid gap-12 py-12 md:py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="mt-5 h-12 w-2/3" />
          <Skeleton className="mt-5 h-4 w-1/2" />
          <Skeleton className="mt-10 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-5/6" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </LoadingRegion>
  );
}
