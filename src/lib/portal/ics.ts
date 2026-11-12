// A calendar file for one stay (RFC 5545). Times are Ghana time, which is UTC+0:
// check-in 2 PM, check-out 11 AM. Never put a door code or Wi-Fi in here.

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Lines longer than 75 octets are split: CRLF plus one space continues the line.
// Counts UTF-8 bytes and never splits a multi-byte character.
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, "utf8");
    // Continuation lines start with a space, which counts toward their 75.
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
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
