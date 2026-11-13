import { escapeText, fold, stamp } from "@/lib/ical/text";

// The calendar Airbnb polls for one room. Only dates go out: no guest names, emails or
// booking codes, because the link is shared with a third party.
const compactDate = (iso: string): string => iso.replace(/-/g, "");

export function roomExportIcs(input: {
  roomNumber: number;
  bookings: { id: string; check_in: string; check_out: string }[];
  blocks: { id: string; start_date: string; end_date: string }[];
  now: Date;
}): string {
  const dtstamp = stamp(input.now);
  const event = (uid: string, start: string, end: string, summary: string): string[] => [
    "BEGIN:VEVENT",
    `UID:${uid}@thegagrafa`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compactDate(start)}`,
    `DTEND;VALUE=DATE:${compactDate(end)}`,
    `SUMMARY:${summary}`,
    "END:VEVENT",
  ];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Gagrafa//Room calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`The Gagrafa Room ${input.roomNumber}`)}`,
    ...input.bookings.flatMap((b: { id: string; check_in: string; check_out: string }) =>
      event(`booking-${b.id}`, b.check_in, b.check_out, "Reserved")
    ),
    ...input.blocks.flatMap((b: { id: string; start_date: string; end_date: string }) =>
      event(`block-${b.id}`, b.start_date, b.end_date, "Not available")
    ),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
