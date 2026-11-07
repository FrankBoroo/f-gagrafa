import { describe, expect, it } from "vitest";
import { roomAssignmentError, roomLabel } from "@/lib/booking/room-assignment";

describe("roomAssignmentError", () => {
  it("refuses closed bookings", () => {
    for (const status of ["cancelled", "no_show", "checked_out"]) {
      expect(roomAssignmentError({ status, payment_status: "paid" })).toBe("This booking is closed, so its room can't change.");
    }
  });

  it("refuses a checkout that is still waiting for payment", () => {
    expect(roomAssignmentError({ status: "pending", payment_status: "unpaid" })).toBe("This booking is still waiting for payment.");
  });

  it("allows live bookings", () => {
    expect(roomAssignmentError({ status: "confirmed", payment_status: "partial" })).toBeNull();
    expect(roomAssignmentError({ status: "checked_in", payment_status: "paid" })).toBeNull();
    expect(roomAssignmentError({ status: "pending", payment_status: "paid" })).toBeNull();
  });
});

describe("roomLabel", () => {
  it("names the room, or says there is none", () => {
    expect(roomLabel(8)).toBe("Room 8");
    expect(roomLabel(null)).toBe("No room");
    expect(roomLabel(undefined)).toBe("No room");
  });
});
