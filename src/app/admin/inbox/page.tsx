import Link from "next/link";
import { Inbox } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { buildInbox, type InboxFilter, type InboxItem } from "@/lib/admin/inbox";
import { InboxItemCard } from "@/components/admin/InboxItemCard";
import { EmptyState } from "@/components/ui/EmptyState";

// "All" shows the most recent of each kind; older closed items stay in the database.
const ALL_LIMIT = 200;

const VIEWS: { filter: InboxFilter; label: string; href: string }[] = [
  { filter: "open", label: "Open", href: "/admin/inbox" },
  { filter: "all", label: "All", href: "/admin/inbox?show=all" },
];

export default async function AdminInboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const params = await searchParams;
  const filter: InboxFilter = params.show === "all" ? "all" : "open";
  const supabase = createServiceClient();

  let requestQuery = supabase
    .from("service_requests")
    .select("id, type, status, description, created_at, bookings(booking_code, guest_name)")
    .order("created_at", { ascending: false })
    .limit(ALL_LIMIT);
  let messageQuery = supabase
    .from("contact_messages")
    .select("id, name, email, message, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(ALL_LIMIT);
  if (filter === "open") {
    requestQuery = requestQuery.in("status", ["pending", "in_progress"]);
    messageQuery = messageQuery.eq("is_read", false);
  }

  const [{ data: requests, error: requestError }, { data: messages, error: messageError }] = await Promise.all([
    requestQuery,
    messageQuery,
  ]);

  const items = buildInbox({ serviceRequests: requests ?? [], contactMessages: messages ?? [], filter });
  const failed = Boolean(requestError || messageError);

  return (
    <div>
      <h1 className="text-3xl">Inbox</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Cancellation requests and service requests from the guest portal, and messages from the contact form.
      </p>

      <nav aria-label="Inbox view" className="mt-6">
        <ul className="flex gap-1 border-b border-navy/10">
          {VIEWS.map((view: { filter: InboxFilter; label: string; href: string }) => {
            const isActive = view.filter === filter;
            return (
              <li key={view.filter}>
                <Link
                  href={view.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm transition-colors ${
                    isActive ? "border-champagne text-navy" : "border-transparent text-navy/60 hover:text-navy"
                  }`}
                >
                  {view.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {failed && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Part of the Inbox could not be loaded. Refresh the page to try again.
        </p>
      )}

      {items.length > 0 ? (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item: InboxItem) => (
            <InboxItemCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      ) : (
        !failed && (
          <EmptyState
            className="mt-6"
            icon={Inbox}
            title={filter === "open" ? "Nothing waiting for you" : "Nothing here yet"}
            description={
              filter === "open"
                ? "New requests from guests and messages from the contact form appear here."
                : "Requests from the guest portal and messages from the contact form will be listed here."
            }
            action={filter === "open" ? { href: "/admin/inbox?show=all", label: "See all" } : undefined}
          />
        )
      )}
    </div>
  );
}
