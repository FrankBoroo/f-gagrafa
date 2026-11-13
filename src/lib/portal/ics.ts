// A calendar file for one stay (RFC 5545). Times are Ghana time, which is UTC+0:
// check-in 2 PM, check-out 11 AM. Never put a door code or Wi-Fi in here.

import { escapeText, fold, stamp } from "@/lib/ical/text";

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

export function stayIcs(input: {
  code: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  address: string;
  portalUrl: string;
  now: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Gagrafa//Guest portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.code}@thegagrafa`,
    `DTSTAMP:${stamp(input.now)}`,
    `DTSTART:${compactDate(input.checkIn)}T140000Z`,
    `DTEND:${compactDate(input.checkOut)}T110000Z`,
    `SUMMARY:${escapeText(`Stay at The Gagrafa (${input.unitName})`)}`,
    `LOCATION:${escapeText(input.address)}`,
    `DESCRIPTION:${escapeText(`Booking code ${input.code}. Your stay details: ${input.portalUrl}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
