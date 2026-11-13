import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAirbnbIcs } from "./parse";

const fixture = readFileSync(
  path.join(process.cwd(), "src/lib/airbnb/fixtures/airbnb-sample.ics"),
  "utf8",
);

function cal(...events: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
}
function ev(...lines: string[]): string {
  return ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
}

describe("parseAirbnbIcs", () => {
  it("reads exactly one reservation from the fixture", () => {
    expect(parseAirbnbIcs(fixture)).toEqual({
      ok: true,
      reservations: [
        {
          uid: "1418fb94e984-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6@airbnb.com",
          checkIn: "2026-12-10",
          checkOut: "2026-12-15",
          summary: "Reserved",
        },
      ],
    });
  });

  it("skips the not available block", () => {
    const r = parseAirbnbIcs(
      cal(ev("UID:x@airbnb.com", "DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261212", "SUMMARY:Airbnb (Not available)")),
    );
    expect(r).toEqual({ ok: true, reservations: [] });
  });

  it("accepts a reservation URL in the description with another summary", () => {
    const r = parseAirbnbIcs(
      cal(ev("UID:y@airbnb.com", "DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261212", "SUMMARY:Guest", "DESCRIPTION:https://www.airbnb.com/hosting/reservations/details/HM1")),
    );
    expect(r.ok && r.reservations).toHaveLength(1);
  });

  it("accepts Reserved in any case with spaces", () => {
    const r = parseAirbnbIcs(
      cal(ev("UID:z", "DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261212", "SUMMARY:  rEsErVeD ")),
    );
    expect(r.ok && r.reservations).toHaveLength(1);
  });

  it("reads date and date-time forms", () => {
    const a = parseAirbnbIcs(cal(ev("UID:a", "DTSTART:20261210T000000Z", "DTEND:20261212T000000Z", "SUMMARY:Reserved")));
    const b = parseAirbnbIcs(cal(ev("UID:a", "DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261212", "SUMMARY:Reserved")));
    expect(a).toEqual(b);
    expect(a.ok && a.reservations[0].checkIn).toBe("2026-12-10");
  });

  it("joins folded lines", () => {
    const r = parseAirbnbIcs(
      cal(ev("UID:fold", "DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261212", "SUMMARY:Res", " erved")),
    );
    expect(r.ok && r.reservations).toHaveLength(1);
  });

  it("works with LF-only line endings", () => {
    const r = parseAirbnbIcs(fixture.replace(/\r\n/g, "\n"));
    expect(r.ok && r.reservations).toHaveLength(1);
  });

  it("skips events without a UID or with check-out not after check-in", () => {
    const r = parseAirbnbIcs(
      cal(
        ev("DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261212", "SUMMARY:Reserved"),
        ev("UID:same", "DTSTART;VALUE=DATE:20261210", "DTEND;VALUE=DATE:20261210", "SUMMARY:Reserved"),
        ev("UID:back", "DTSTART;VALUE=DATE:20261212", "DTEND;VALUE=DATE:20261210", "SUMMARY:Reserved"),
      ),
    );
    expect(r).toEqual({ ok: true, reservations: [] });
  });

  it("rejects text that is not a calendar", () => {
    expect(parseAirbnbIcs("<html><body>Sign in</body></html>").ok).toBe(false);
  });

  it("returns an empty list for a calendar with no events", () => {
    expect(parseAirbnbIcs(cal())).toEqual({ ok: true, reservations: [] });
  });
});
