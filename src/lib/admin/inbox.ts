// The admin Inbox: cancellation requests, service requests and contact-form messages
// in one list, worked out from plain rows. Pure, so it can be tested without a database
// and imported by client code.

// A guest's cancellation request is stored as a service request whose description
// starts with this text (written by the guest portal).
export const CANCELLATION_REQUEST_PREFIX = "CANCELLATION REQUEST";

export type InboxKind = "cancellation_request" | "service_request" | "contact_message";

export interface InboxItem {
  kind: InboxKind;
  id: string;
  createdAt: string;
  title: string;
  body: string;
  open: boolean;
  bookingCode: string | null;
  email: string | null;
  // Service request status (pending / in_progress / completed / cancelled), or
  // "unread" / "read" for a contact message.
  status: string;
}

export type InboxFilter = "open" | "all";

interface ServiceRequestRow {
  id: string;
  type: string;
  status: string;
  description: string | null;
  created_at: string;
  bookings: { booking_code: string; guest_name: string } | null;
}

interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_WORDS: Record<string, string> = {
  cleaning: "Housekeeping",
  towels: "Towels",
  maintenance: "Repair",
  other: "Request",
};

const OPEN_REQUEST_STATUSES = ["pending", "in_progress"];

function fromServiceRequest(row: ServiceRequestRow): InboxItem {
  const guest = row.bookings?.guest_name?.trim() || "Guest";
  const description = row.description ?? "";
  const isCancellation = description.startsWith(CANCELLATION_REQUEST_PREFIX);
  const reason = description.slice(CANCELLATION_REQUEST_PREFIX.length).replace(/^:?\s*/, "").trim();

  return {
    kind: isCancellation ? "cancellation_request" : "service_request",
    id: row.id,
    createdAt: row.created_at,
    title: isCancellation ? `Cancellation request · ${guest}` : `${TYPE_WORDS[row.type] ?? "Request"} · ${guest}`,
    body: isCancellation ? reason || "No reason given" : description.trim(),
    open: OPEN_REQUEST_STATUSES.includes(row.status),
    bookingCode: row.bookings?.booking_code ?? null,
    email: null,
    status: row.status,
  };
}

function fromContactMessage(row: ContactMessageRow): InboxItem {
  return {
    kind: "contact_message",
    id: row.id,
    createdAt: row.created_at,
    title: `Message from ${row.name.trim() || "a visitor"}`,
    body: row.message.trim(),
    open: !row.is_read,
    bookingCode: null,
    email: row.email,
    status: row.is_read ? "read" : "unread",
  };
}

// Open items first, then newest first.
export function buildInbox(input: {
  serviceRequests: ServiceRequestRow[];
  contactMessages: ContactMessageRow[];
  filter: InboxFilter;
}): InboxItem[] {
  const items: InboxItem[] = [
    ...input.serviceRequests.map(fromServiceRequest),
    ...input.contactMessages.map(fromContactMessage),
  ];
  const kept = input.filter === "open" ? items.filter((item: InboxItem) => item.open) : items;
  return kept.sort((a: InboxItem, b: InboxItem) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
