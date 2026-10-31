import { describe, expect, it } from "vitest";
import { bookingHref, canContinueToDetails, parseBookingParams, withApartmentTaken } from "@/lib/booking/booking-link";
import { addDays, toISODate } from "@/lib/booking/dates";

const units = [
  { id: "u1", slug: "penthouse", max_guests: 2 },
  { id: "u2", slug: "studio", max_guests: 3 },
];
const inDays = (n: number) => addDays(toISODate(new Date()), n);
const params = (values: Record<string, string>) => new URLSearchParams(values);
const valid = { unit: "penthouse", checkIn: inDays(10), checkOut: inDays(13), guests: "2" };

describe("parseBookingParams", () => {
  it("starts at the guest's details when the link is complete", () => {
    expect(parseBookingParams(params(valid), units)).toEqual({
      unitId: "u1", checkIn: valid.checkIn, checkOut: valid.checkOut, guests: 2, pay: "deposit", startStep: 2,
    });
  });

  it("selects the down payment unless the link says full", () => {
    expect(parseBookingParams(params({ ...valid, pay: "full" }), units).pay).toBe("full");
    expect(parseBookingParams(params({ ...valid, pay: "xyz" }), units).pay).toBe("deposit");
  });

  it("starts at step 1 for an unknown apartment", () => {
    expect(parseBookingParams(params({ ...valid, unit: "nope" }), units)).toMatchObject({ unitId: "", startStep: 1 });
  });

  it("drops dates that aren't dates", () => {
    expect(parseBookingParams(params({ ...valid, checkIn: "banana" }), units)).toMatchObject({ checkIn: "", checkOut: "", startStep: 1 });
    expect(parseBookingParams(params({ ...valid, checkIn: "2030-02-31" }), units)).toMatchObject({ checkIn: "", startStep: 1 });
  });

  it("starts at step 1 for stays the rules refuse", () => {
    const backwards = { ...valid, checkIn: inDays(13), checkOut: inDays(10) };
    const oneNight = { ...valid, checkIn: inDays(10), checkOut: inDays(11) };
    const past = { ...valid, checkIn: inDays(-5), checkOut: inDays(-2) };
    for (const link of [backwards, oneNight, past]) {
      expect(parseBookingParams(params(link), units).startStep).toBe(1);
    }
  });

  it("clears dates already in the past", () => {
    const past = { ...valid, checkIn: inDays(-5), checkOut: inDays(-2) };
    expect(parseBookingParams(params(past), units)).toMatchObject({ checkIn: "", checkOut: "" });
  });

  it("caps guests at what the apartment allows", () => {
    expect(parseBookingParams(params({ ...valid, guests: "99" }), units).guests).toBe(2);
  });

  it("caps guests at the largest apartment when none is chosen, so nothing is blocked by a bad link", () => {
    expect(parseBookingParams(params({ unit: "nope", guests: "99" }), units).guests).toBe(3);
  });

  it("uses 2 guests when the number is unusable", () => {
    expect(parseBookingParams(params({ ...valid, guests: "0" }), units).guests).toBe(2);
    expect(parseBookingParams(params({ ...valid, guests: "abc" }), units).guests).toBe(2);
    expect(parseBookingParams(params({}), units).guests).toBe(2);
  });
});

describe("canContinueToDetails", () => {
  const ready = { apartmentChosen: true, checkIn: inDays(10), checkOut: inDays(13), guests: 2, checking: false, blocked: false };

  it("lets a valid choice through", () => {
    expect(canContinueToDetails(ready)).toBe(true);
  });

  it("stops dates the server would refuse", () => {
    expect(canContinueToDetails({ ...ready, checkIn: inDays(-5), checkOut: inDays(-2) })).toBe(false);
    expect(canContinueToDetails({ ...ready, checkIn: inDays(10), checkOut: inDays(11) })).toBe(false);
    expect(canContinueToDetails({ ...ready, checkOut: inDays(500) })).toBe(false);
    expect(canContinueToDetails({ ...ready, checkIn: inDays(800), checkOut: inDays(803) })).toBe(false);
  });

  it("waits for an apartment, the availability check and a free apartment", () => {
    expect(canContinueToDetails({ ...ready, apartmentChosen: false })).toBe(false);
    expect(canContinueToDetails({ ...ready, checking: true })).toBe(false);
    expect(canContinueToDetails({ ...ready, blocked: true })).toBe(false);
  });
});

describe("withApartmentTaken", () => {
  it("marks one apartment taken and keeps the others", () => {
    expect(withApartmentTaken({ u1: true, u2: true }, "u1")).toEqual({ u1: false, u2: true });
  });

  it("works before any availability answer has arrived", () => {
    expect(withApartmentTaken(null, "u1")).toEqual({ u1: false });
  });
});

describe("bookingHref", () => {
  it("round-trips through parseBookingParams", () => {
    const href = bookingHref({ slug: "studio", checkIn: valid.checkIn, checkOut: valid.checkOut, guests: 1, pay: "full" });
    expect(href.startsWith("/booking?")).toBe(true);
    expect(parseBookingParams(new URLSearchParams(href.split("?")[1]), units)).toEqual({
      unitId: "u2", checkIn: valid.checkIn, checkOut: valid.checkOut, guests: 1, pay: "full", startStep: 2,
    });
  });

  it("leaves the apartment out when none is given", () => {
    const href = bookingHref({ checkIn: valid.checkIn, checkOut: valid.checkOut, guests: 2, pay: "deposit" });
    expect(href).not.toContain("unit=");
  });
});
