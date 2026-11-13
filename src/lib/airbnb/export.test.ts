import { describe, expect, it } from "vitest";
import { roomExportIcs } from "./export";

const now = new Date("2026-11-13T09:30:00Z");

describe("roomExportIcs", () => {
  const withExtras = {
    id: "b1",
    check_in: "2026-12-10",
    check_out: "2026-12-13",
    guest_name: "Ama Mensah",
    guest_email: "ama@example.com",
  };
  const ics = roomExportIcs({
    roomNumber: 8,
    bookings: [withExtras],
    blocks: [{ id: "k1", start_date: "2026-12-20", end_date: "2026-12-22" }],
    now,
  });

  it("lists a booking as a reserved all-day event", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261210\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261213\r\n");
    expect(ics).toContain("SUMMARY:Reserved\r\n");
    expect(ics).toContain("UID:booking-b1@thegagrafa\r\n");
  });

  it("lists a block as not available", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261220\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261222\r\n");
    expect(ics).toContain("SUMMARY:Not available\r\n");
    expect(ics).toContain("UID:block-k1@thegagrafa\r\n");
  });

  it("never includes guest details", () => {
    expect(ics).not.toContain("Ama");
    expect(ics).not.toContain("ama@example.com");
  });

  it("is a CRLF calendar named after the room", () => {
    expect(ics).toContain("X-WR-CALNAME:The Gagrafa Room 8\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(ics).toContain("DTSTAMP:20261113T093000Z");
  });

  it("is a valid empty calendar with no events", () => {
    const empty = roomExportIcs({ roomNumber: 1, bookings: [], blocks: [], now });
    expect(empty).not.toContain("BEGIN:VEVENT");
    expect(empty).toContain("END:VCALENDAR");
  });
});
