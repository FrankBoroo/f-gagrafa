// Placeholder blocks shown while a page streams in. Soft sand tones, a gentle pulse,
// and no motion at all for people who ask for reduced motion.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-navy/[0.06] motion-reduce:animate-none ${className}`} />;
}

// Wraps a page's skeleton so screen readers hear one "Loading" instead of empty blocks.
export function LoadingRegion({ label = "Loading", className = "", children }: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function CardSkeleton({ image = true }: { image?: boolean }) {
  return (
    <div className="card overflow-hidden">
      {image && <Skeleton className="h-64 w-full rounded-none" />}
      <div className="space-y-3 p-6">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-navy/10 px-5 py-4">
        <Skeleton className="h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }, (_, i: number) => (
        <div key={i} className="flex gap-6 border-b border-navy/5 px-5 py-4 last:border-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-32 sm:block" />
        </div>
      ))}
    </div>
  );
}

// Admin pages built around one table (payments, guests, audit log).
export function TablePageSkeleton() {
  return (
    <LoadingRegion label="Loading">
      <Skeleton className="h-9 w-48" />
      <div className="mt-8">
        <TableSkeleton />
      </div>
    </LoadingRegion>
  );
}
