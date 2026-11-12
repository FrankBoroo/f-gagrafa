import { describe, it, expect } from "vitest";
import { stayIcs } from "@/lib/portal/ics";

const base = {
  code: "GAG-ABC123",
  unitName: "Studio, Deluxe",
  checkIn: "2026-12-20",
  checkOut: "2026-12-23",
  address: "Militia Street, Mango Link; Tema",
  portalUrl: "https://thegagrafa.com/portal/GAG-ABC123",
  now: new Date("2026-11-12T09:30:00Z"),
};

describe("stayIcs", () => {
  const ics = stayIcs(base);

  it("uses 2 PM check-in and 11 AM check-out", () => {
    expect(ics).toContain("DTSTART:20261220T140000Z");
    expect(ics).toContain("DTEND:20261223T110000Z");
    expect(ics).toContain("DTSTAMP:20261112T093000Z");
    expect(ics).toContain("UID:GAG-ABC123@thegagrafa");
  });

  it("ends every line with CRLF", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("escapes commas and semicolons", () => {
    expect(ics).toContain("LOCATION:Militia Street\\, Mango Link\; Tema");
    expect(ics).toContain("SUMMARY:Stay at The Gagrafa (Studio\\, Deluxe)");
  });

  it("holds no door code or Wi-Fi", () => {
    expect(ics.toLowerCase()).not.toContain("door");
    expect(ics.toLowerCase()).not.toContain("wi-fi");
  });
});
