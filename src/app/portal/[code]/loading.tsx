import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function PortalLoading() {
  return (
    <LoadingRegion label="Loading your stay" className="container-gagrafa max-w-3xl py-24">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-10 w-64" />
      {Array.from({ length: 2 }, (_, i: number) => (
        <div key={i} className="card mt-10 space-y-4 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}
