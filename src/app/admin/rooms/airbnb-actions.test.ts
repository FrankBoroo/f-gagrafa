import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "00000000-0000-0000-0000-000000000103";
const EXT_ID = "00000000-0000-0000-0000-000000000777";
const GOOD_URL = "https://www.airbnb.com/calendar/ical/123.ics?s=secret";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  isStaff: vi.fn(),
  logAudit: vi.fn(),
  syncRoom: vi.fn(),
  syncRooms: vi.fn(),
  writes: [] as { table: string; op: string; payload?: unknown }[],
}));

class FakeQuery {
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  maybeSingle() {
    return Promise.resolve({ data: { id: ROOM_ID, number: 3, airbnb_ical_url: GOOD_URL, airbnb_sync_error: null }, error: null });
  }
  update(payload: unknown) {
    mocks.writes.push({ table: this.table, op: "update", payload });
    return this;
  }
  then(resolve: (v: unknown) => unknown) {
    return Promise.resolve({ data: null, error: null }).then(resolve);
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/auth", () => ({ isAdmin: mocks.isAdmin, isStaff: mocks.isStaff, UNAUTHORIZED: { ok: false, error: "Unauthorized" } }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));
vi.mock("@/lib/airbnb/sync", () => ({ syncRoom: mocks.syncRoom, syncRooms: mocks.syncRooms }));

const { setRoomAirbnbUrl, newRoomExportLink, syncAirbnbNow, updateAirbnbBooking } = await import("@/app/admin/rooms/actions");

function auditKeys(): string[] {
  return mocks.logAudit.mock.calls.flatMap((c: unknown[]) => Object.keys((c[3] as Record<string, unknown>) ?? {}));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.isStaff.mockResolvedValue(true);
  mocks.syncRoom.mockResolvedValue({ ok: true, added: 1, updated: 0, removed: 0 });
  mocks.syncRooms.mockResolvedValue({ synced: 2, failed: 0 });
  mocks.writes = [];
});

describe("Airbnb room actions", () => {
  it("refuse a guest, and staff on the admin-only ones", async () => {
    mocks.isAdmin.mockResolvedValue(false);
    mocks.isStaff.mockResolvedValue(false);
    const denied = { ok: false, error: "Unauthorized" };
    expect(await setRoomAirbnbUrl({ roomId: ROOM_ID, url: GOOD_URL })).toEqual(denied);
    expect(await newRoomExportLink(ROOM_ID)).toEqual(denied);
    expect(await syncAirbnbNow(ROOM_ID)).toEqual(denied);
    expect(await updateAirbnbBooking({ id: EXT_ID, guest_name: "A", notes: "" })).toEqual(denied);
    mocks.isStaff.mockResolvedValue(true);
    expect(await setRoomAirbnbUrl({ roomId: ROOM_ID, url: GOOD_URL })).toEqual(denied);
    expect(await newRoomExportLink(ROOM_ID)).toEqual(denied);
    expect(mocks.writes).toEqual([]);
    expect(mocks.syncRoom).not.toHaveBeenCalled();
  });

  it("refuses a bad URL and saves nothing", async () => {
    const result = await setRoomAirbnbUrl({ roomId: ROOM_ID, url: "https://evil.example.com/a.ics" });
    expect(result.ok).toBe(false);
    expect(mocks.writes).toEqual([]);
    expect(mocks.syncRoom).not.toHaveBeenCalled();
  });

  it("clears the link and its error without syncing", async () => {
    expect(await setRoomAirbnbUrl({ roomId: ROOM_ID, url: "  " })).toEqual({ ok: true });
    expect(mocks.writes).toEqual([{ table: "rooms", op: "update", payload: { airbnb_ical_url: null, airbnb_sync_error: null } }]);
    expect(mocks.syncRoom).not.toHaveBeenCalled();
  });

  it("saves a good URL, syncs, and reports a failed first sync", async () => {
    expect(await setRoomAirbnbUrl({ roomId: ROOM_ID, url: GOOD_URL })).toEqual({ ok: true });
    expect(mocks.writes[0]).toEqual({ table: "rooms", op: "update", payload: { airbnb_ical_url: GOOD_URL } });
    expect(mocks.syncRoom).toHaveBeenCalledTimes(1);

    mocks.syncRoom.mockResolvedValue({ ok: false, error: "Airbnb answered 404." });
    expect(await setRoomAirbnbUrl({ roomId: ROOM_ID, url: GOOD_URL })).toEqual({
      ok: false,
      error: "Saved, but the first sync failed: Airbnb answered 404.",
    });
  });

  it("writes a different 64-character export token", async () => {
    expect(await newRoomExportLink(ROOM_ID)).toEqual({ ok: true });
    const first = (mocks.writes[0].payload as { ical_export_token: string }).ical_export_token;
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    await newRoomExportLink(ROOM_ID);
    expect((mocks.writes[1].payload as { ical_export_token: string }).ical_export_token).not.toBe(first);
  });

  it("never puts the URL or the token in an audit entry", async () => {
    await setRoomAirbnbUrl({ roomId: ROOM_ID, url: GOOD_URL });
    await setRoomAirbnbUrl({ roomId: ROOM_ID, url: "" });
    await newRoomExportLink(ROOM_ID);
    expect(mocks.logAudit).toHaveBeenCalled();
    const text = JSON.stringify(mocks.logAudit.mock.calls);
    expect(text).not.toContain("secret");
    expect(auditKeys().filter((k) => /url|token/i.test(k))).toEqual([]);
  });

  it("syncs one room or all of them for staff", async () => {
    expect(await syncAirbnbNow(ROOM_ID)).toEqual({ ok: true });
    expect(mocks.syncRoom).toHaveBeenCalledTimes(1);
    expect(await syncAirbnbNow()).toEqual({ ok: true });
    expect(mocks.syncRooms).toHaveBeenCalledTimes(1);
    mocks.syncRooms.mockResolvedValue({ synced: 1, failed: 1 });
    expect((await syncAirbnbNow()).ok).toBe(false);
    mocks.syncRoom.mockResolvedValue({ ok: false, error: "Airbnb answered 500." });
    expect(await syncAirbnbNow(ROOM_ID)).toEqual({ ok: false, error: "Airbnb answered 500." });
  });

  it("updates a name and notes, refusing a 121-character name", async () => {
    expect((await updateAirbnbBooking({ id: EXT_ID, guest_name: "x".repeat(121), notes: "" })).ok).toBe(false);
    expect((await updateAirbnbBooking({ id: EXT_ID, guest_name: "a", notes: "y".repeat(1001) })).ok).toBe(false);
    expect(mocks.writes).toEqual([]);
    expect(await updateAirbnbBooking({ id: EXT_ID, guest_name: " Ama ", notes: "Late arrival" })).toEqual({ ok: true });
    expect(mocks.writes).toEqual([
      { table: "external_reservations", op: "update", payload: { guest_name: "Ama", notes: "Late arrival" } },
    ]);
  });
});
