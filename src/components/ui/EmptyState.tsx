import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// A calm, deliberate "nothing here yet" panel for lists, so an empty list never looks broken.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-xl border border-dashed border-navy/15 bg-ivory/60 text-center ${
        compact ? "px-6 py-8" : "px-6 py-14"
      } ${className}`}
    >
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-champagne/15 text-champagne-dark" aria-hidden="true">
          <Icon size={22} strokeWidth={1.5} />
        </span>
      )}
      <p className={`font-display text-navy ${compact ? "text-lg" : "text-xl"} ${Icon ? "mt-4" : ""}`}>{title}</p>
      {description && <p className="mt-2 max-w-md text-sm text-navy/55">{description}</p>}
      {action && (
        <Link href={action.href} className="btn-secondary mt-6 px-5 py-2.5">
          {action.label}
        </Link>
      )}
    </div>
  );
}
