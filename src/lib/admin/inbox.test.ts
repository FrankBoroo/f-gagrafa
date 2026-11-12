import { describe, expect, it } from "vitest";
import { buildInbox, CANCELLATION_REQUEST_PREFIX } from "@/lib/admin/inbox";

type Input = Parameters<typeof buildInbox>[0];
type ServiceRow = Input["serviceRequests"][number];
type ContactRow = Input["contactMessages"][number];

function request(over: Partial<ServiceRow> = {}): ServiceRow {
  return {
    id: "sr-1",
    type: "cleaning",
    status: "pending",
    description: "Please clean after 10 AM",
    created_at: "2026-11-10T09:00:00Z",
    bookings: { booking_code: "GAG-AAAA", guest_name: "Ama Mensah" },
    ...over,
  };
}

function message(over: Partial<ContactRow> = {}): ContactRow {
  return {
    id: "cm-1",
    name: "Kofi Boateng",
    email: "kofi@example.com",
    message: "Do you have parking?",
    is_read: false,
    created_at: "2026-11-10T08:00:00Z",
    ...over,
  };
}

const build = (serviceRequests: ServiceRow[], contactMessages: ContactRow[], filter: "open" | "all" = "all") =>
  buildInbox({ serviceRequests, contactMessages, filter });

describe("buildInbox", () => {
  it("reads a request that starts with the prefix as a cancellation request, with the reason as its body", () => {
    const [item] = build([request({ type: "other", description: `${CANCELLATION_REQUEST_PREFIX}: Flight cancelled` })], []);
    expect(item.kind).toBe("cancellation_request");
    expect(item.title).toBe("Cancellation request · Ama Mensah");
    expect(item.body).toBe("Flight cancelled");
    expect(item.bookingCode).toBe("GAG-AAAA");
    expect(item.email).toBeNull();
  });

  it("says no reason was given when the description is only the prefix", () => {
    const [item] = build([request({ type: "other", description: CANCELLATION_REQUEST_PREFIX })], []);
    expect(item.kind).toBe("cancellation_request");
    expect(item.body).toBe("No reason given");
  });

  it("names each kind of service request in words", () => {
    const titles = (["cleaning", "towels", "maintenance", "other"] as const).map(
      (type) => build([request({ type })], [])[0].title
    );
    expect(titles).toEqual([
      "Housekeeping · Ama Mensah",
      "Towels · Ama Mensah",
      "Repair · Ama Mensah",
      "Request · Ama Mensah",
    ]);
    expect(build([request()], [])[0].kind).toBe("service_request");
  });

  it("copes with a request that has no description or no booking", () => {
    const [item] = build([request({ description: null, bookings: null })], []);
    expect(item.title).toBe("Housekeeping · Guest");
    expect(item.body).toBe("");
    expect(item.bookingCode).toBeNull();
  });

  it("turns a contact message into an item with the sender's email", () => {
    const [item] = build([], [message()]);
    expect(item).toMatchObject({
      kind: "contact_message",
      id: "cm-1",
      title: "Message from Kofi Boateng",
      body: "Do you have parking?",
      email: "kofi@example.com",
      bookingCode: null,
      open: true,
      status: "unread",
    });
  });

  it("counts pending and in-progress requests and unread messages as open", () => {
    const open = (status: string) => build([request({ status })], [])[0].open;
    expect(open("pending")).toBe(true);
    expect(open("in_progress")).toBe(true);
    expect(open("completed")).toBe(false);
    expect(open("cancelled")).toBe(false);
    expect(build([], [message({ is_read: true })])[0]).toMatchObject({ open: false, status: "read" });
  });

  it("keeps only open items under the open filter", () => {
    const items = build(
      [request({ id: "open" }), request({ id: "done", status: "completed" })],
      [message({ id: "unread" }), message({ id: "read", is_read: true })],
      "open"
    );
    expect(items.map((i) => i.id).sort()).toEqual(["open", "unread"]);
  });

  it("lists open items first, then newest first", () => {
    const items = build(
      [
        request({ id: "closed-newest", status: "completed", created_at: "2026-11-11T12:00:00Z" }),
        request({ id: "open-old", created_at: "2026-11-01T12:00:00Z" }),
      ],
      [
        message({ id: "open-new", created_at: "2026-11-09T12:00:00Z" }),
        message({ id: "closed-old", is_read: true, created_at: "2026-10-01T12:00:00Z" }),
      ]
    );
    expect(items.map((i) => i.id)).toEqual(["open-new", "open-old", "closed-newest", "closed-old"]);
  });

  it("returns an empty list when there is nothing", () => {
    expect(build([], [])).toEqual([]);
    expect(build([], [], "open")).toEqual([]);
  });
});
