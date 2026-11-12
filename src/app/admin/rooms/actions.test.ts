import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "00000000-0000-0000-0000-000000000103";
const UNIT_ID = "00000000-0000-0000-0000-00000000000a";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  isStaff: vi.fn(),
  logAudit: vi.fn(),
  bookingCount: 0,
  insertError: null as { code?: string; message?: string } | null,
  writes: [] as { table: string; op: string; payload?: unknown }[],
}));

class FakeQuery {
  private op = "select";
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  gte() { return this; }
  not() { return this; }
  maybeSingle() {
    return Promise.resolve({ data: { id: ROOM_ID, number: 3 }, error: null });
  }
  insert(payload: unknown) {
    this.op = "insert";
    mocks.writes.push({ table: this.table, op: "insert", payload });
    return this;
  }
  update(payload: unknown) {
    this.op = "update";
    mocks.writes.push({ table: this.table, op: "update", payload });
    return this;
  }
  upsert(payload: unknown) {
    this.op = "upsert";
    mocks.writes.push({ table: this.table, op: "upsert", payload });
    return this;
  }
  delete() {
    this.op = "delete";
    mocks.writes.push({ table: this.table, op: "delete" });
    return this;
  }
  then(resolve: (v: unknown) => unknown) {
    if (this.op === "select") return Promise.resolve({ count: mocks.bookingCount, data: null, error: null }).then(resolve);
    if (this.op === "insert") return Promise.resolve({ data: null, error: mocks.insertError }).then(resolve);
    return Promise.resolve({ data: null, error: null }).then(resolve);
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/auth", () => ({ isAdmin: mocks.isAdmin, isStaff: mocks.isStaff, UNAUTHORIZED: { ok: false, error: "Unauthorized" } }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));

const { createRoom, deleteRoom, setRoomActive, setRoomDoorCode } = await import("@/app/admin/rooms/actions");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.isStaff.mockResolvedValue(true);
  mocks.bookingCount = 0;
  mocks.insertError = null;
  mocks.writes = [];
});

describe("room actions", () => {
  it("are admin-only", async () => {
    mocks.isAdmin.mockResolvedValue(false);
    expect(await createRoom({ number: 14, unit_id: UNIT_ID })).toEqual({ ok: false, error: "Unauthorized" });
    expect(await setRoomActive(ROOM_ID, false)).toEqual({ ok: false, error: "Unauthorized" });
    expect(await deleteRoom(ROOM_ID)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.writes).toEqual([]);
  });

  it("won't deactivate a room with upcoming bookings", async () => {
    mocks.bookingCount = 1;
    expect(await setRoomActive(ROOM_ID, false)).toEqual({
      ok: false,
      error: "Room 3 has 1 upcoming booking. Move it to another room first.",
    });
    expect(mocks.writes).toEqual([]);
  });

  it("deactivates a room with nothing upcoming", async () => {
    expect(await setRoomActive(ROOM_ID, false)).toEqual({ ok: true });
    expect(mocks.writes).toEqual([{ table: "rooms", op: "update", payload: { is_active: false } }]);
  });

  it("won't delete a room that has bookings on record", async () => {
    mocks.bookingCount = 4;
    expect(await deleteRoom(ROOM_ID)).toEqual({
      ok: false,
      error: "Room 3 has bookings on record, so it can't be deleted. Deactivate it instead.",
    });
    expect(mocks.writes).toEqual([]);
  });

  it("says when a room number is already taken", async () => {
    mocks.insertError = { code: "23505" };
    expect(await createRoom({ number: 3, unit_id: UNIT_ID })).toEqual({ ok: false, error: "Room 3 already exists." });
  });

  it("refuses a room number that isn't a whole number from 1 to 999", async () => {
    expect((await createRoom({ number: 0, unit_id: UNIT_ID })).ok).toBe(false);
    expect((await createRoom({ number: 2.5, unit_id: UNIT_ID })).ok).toBe(false);
    expect(mocks.writes).toEqual([]);
  });
});

describe("setRoomDoorCode", () => {
  it("is staff-only", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await setRoomDoorCode({ roomId: ROOM_ID, code: "1234" })).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.writes).toEqual([]);
  });

  it("saves a trimmed code and audits without the code", async () => {
    expect(await setRoomDoorCode({ roomId: ROOM_ID, code: " 4821# " })).toEqual({ ok: true });
    const w = mocks.writes[0];
    expect(w.table).toBe("room_access_codes");
    expect(w.op).toBe("upsert");
    expect((w.payload as { access_code: string; room_id: string }).access_code).toBe("4821#");
    expect(mocks.logAudit).toHaveBeenCalledTimes(1);
    const [action, , , payload] = mocks.logAudit.mock.calls[0];
    expect(action).toBe("room.door_code_set");
    expect(payload).toEqual({ number: 3 });
    expect(JSON.stringify(mocks.logAudit.mock.calls[0])).not.toContain("4821");
  });

  it("deletes the row for an empty code and does not upsert", async () => {
    expect(await setRoomDoorCode({ roomId: ROOM_ID, code: "   " })).toEqual({ ok: true });
    expect(mocks.writes.map((w: { op: string }) => w.op)).toEqual(["delete"]);
    expect(mocks.logAudit.mock.calls[0][0]).toBe("room.door_code_cleared");
    expect(mocks.logAudit.mock.calls[0][3]).not.toHaveProperty("code");
  });

  it("refuses a 41-character code", async () => {
    expect((await setRoomDoorCode({ roomId: ROOM_ID, code: "x".repeat(41) })).ok).toBe(false);
    expect(mocks.writes).toEqual([]);
  });
});
