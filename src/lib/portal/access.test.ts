import { describe, expect, it } from "vitest";
import { ACCESS_MESSAGES, accessState, roomText } from "@/lib/portal/access";

const TODAY = "2026-12-10";
const stay = {
  status: "confirmed",
  check_in: "2026-12-11",
  check_out: "2026-12-14",
  room_id: "room-1" as string | null,
  room_confirmed: true,
};

describe("accessState", () => {
  it("shows for a confirmed stay with a confirmed room the day before check-in", () => {
    expect(accessState(stay, TODAY)).toBe("show");
  });
  it("needs a confirmed room", () => {
    expect(accessState({ ...stay, room_confirmed: false }, TODAY)).toBe("no_room");
    expect(accessState({ ...stay, room_id: null }, TODAY)).toBe("no_room");
  });
  it("is too early more than a day before check-in", () => {
    expect(accessState({ ...stay, check_in: "2026-12-12" }, TODAY)).toBe("too_early");
  });
  it("shows for an early arrival who is checked in", () => {
    expect(accessState({ ...stay, status: "checked_in", check_in: "2026-12-20", check_out: "2026-12-25" }, TODAY)).toBe("show");
  });
  it("is over after check-out, cancelled, no-show or checked out", () => {
    expect(accessState({ ...stay, check_in: "2026-12-05", check_out: "2026-12-09" }, TODAY)).toBe("over");
    expect(accessState({ ...stay, status: "cancelled" }, TODAY)).toBe("over");
    expect(accessState({ ...stay, status: "no_show" }, TODAY)).toBe("over");
    expect(accessState({ ...stay, status: "checked_out" }, TODAY)).toBe("over");
  });
  it("is pending for an unconfirmed booking", () => {
    expect(accessState({ ...stay, status: "pending" }, TODAY)).toBe("pending");
  });
  it("has a message for every hidden state", () => {
    expect(Object.keys(ACCESS_MESSAGES).sort()).toEqual(["no_room", "over", "pending", "too_early"]);
  });
});

describe("roomText", () => {
  it("names a confirmed room", () => {
    expect(roomText({ room_confirmed: true, room_number: 8 })).toBe("Room 8");
  });
  it("says reception will assign an unconfirmed one", () => {
    expect(roomText({ room_confirmed: false, room_number: 8 })).toBe("Reception will assign it before you arrive");
    expect(roomText({ room_confirmed: true, room_number: null })).toBe("Reception will assign it before you arrive");
  });
});
