import { describe, expect, it, vi } from "vitest";
import { chooseRoomForNewDates, tryRoomsInOrder } from "@/lib/booking/rooms";

const taken = { data: null, error: { code: "23P01" } };

describe("tryRoomsInOrder", () => {
  it("uses the first room when it is free", async () => {
    const attempt = vi.fn().mockResolvedValue({ data: "booking", error: null });
    const result = await tryRoomsInOrder(["r1", "r2"], attempt);
    expect(result).toEqual({ data: "booking", error: null, roomId: "r1" });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("falls through to the next room on 23P01", async () => {
    const attempt = vi.fn().mockResolvedValueOnce(taken).mockResolvedValueOnce({ data: "booking", error: null });
    const result = await tryRoomsInOrder(["r1", "r2"], attempt);
    expect(result.roomId).toBe("r2");
    expect(result.data).toBe("booking");
  });

  it("stops on any other error", async () => {
    const attempt = vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } });
    const result = await tryRoomsInOrder(["r1", "r2"], attempt);
    expect(result.error).toEqual({ code: "23505" });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("reports 23P01 when every room was taken", async () => {
    const attempt = vi.fn().mockResolvedValue(taken);
    const result = await tryRoomsInOrder(["r1", "r2"], attempt);
    expect(result).toEqual({ data: null, error: { code: "23P01" }, roomId: null });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("reports 23P01 when there are no rooms", async () => {
    const attempt = vi.fn();
    const result = await tryRoomsInOrder([], attempt);
    expect(result).toEqual({ data: null, error: { code: "23P01" }, roomId: null });
    expect(attempt).not.toHaveBeenCalled();
  });
});

describe("chooseRoomForNewDates", () => {
  const free = [{ id: "r2", number: 2 }, { id: "r5", number: 5 }];

  it("keeps the booking's room when it is still free", () => {
    expect(chooseRoomForNewDates(free, "r5")).toEqual({ roomId: "r5", moved: false });
  });

  it("takes the lowest free room when its room is gone", () => {
    expect(chooseRoomForNewDates(free, "r9")).toEqual({ roomId: "r2", moved: true });
  });

  it("returns null when nothing is free", () => {
    expect(chooseRoomForNewDates([], "r9")).toBeNull();
  });
});
