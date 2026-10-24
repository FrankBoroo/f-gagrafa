import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function UnitLoading() {
  return (
    <LoadingRegion label="Loading residence">
      <div className="container-gagrafa pt-8">
        <Skeleton className="h-[50svh] min-h-[320px] w-full rounded-xl" />
      </div>
      <div className="container-gagrafa grid gap-16 py-16 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-10 w-2/3" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-5/6" />
          <div className="mt-10 grid grid-cols-2 gap-6 border-y border-navy/10 py-8 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i: number) => <Skeleton key={i} className="h-10" />)}
          </div>
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </LoadingRegion>
  );
}
