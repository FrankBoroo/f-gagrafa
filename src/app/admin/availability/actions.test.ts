import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "00000000-0000-0000-0000-000000000003";
const UNIT_ID = "00000000-0000-0000-0000-00000000000a";

const mocks = vi.hoisted(() => ({
  isStaff: vi.fn(),
  rpc: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  room: null as { unit_id: string } | null,
}));

class FakeQuery {
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  maybeSingle() { return Promise.resolve({ data: mocks.room, error: null }); }
  single() { return Promise.resolve({ data: { id: "block-1" }, error: null }); }
  insert(payload: Record<string, unknown>) {
    if (this.table === "blocked_dates") mocks.inserts.push(payload);
    return this;
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isStaff: mocks.isStaff, UNAUTHORIZED: { ok: false, error: "Unauthorized" } }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
    rpc: mocks.rpc,
  }),
}));

const { addBlockedDate } = await import("@/app/admin/availability/actions");

const input = { room_id: ROOM_ID, start_date: "2026-12-01", end_date: "2026-12-03", reason: "Repairs" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStaff.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.inserts.length = 0;
  mocks.room = { unit_id: UNIT_ID };
});

describe("addBlockedDate", () => {
  it("returns UNAUTHORIZED for non-staff", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await addBlockedDate(input)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.inserts).toEqual([]);
  });

  it("refuses dates that clash with a booking on that room", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const result = await addBlockedDate(input);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("This room has a booking");
    expect(mocks.rpc).toHaveBeenCalledWith("is_room_available", {
      p_room_id: ROOM_ID, p_check_in: "2026-12-01", p_check_out: "2026-12-03",
    });
    expect(mocks.inserts).toEqual([]);
  });

  it("refuses when the availability lookup fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect((await addBlockedDate(input)).ok).toBe(false);
    expect(mocks.inserts).toEqual([]);
  });

  it("refuses an unknown room", async () => {
    mocks.room = null;
    expect((await addBlockedDate(input)).ok).toBe(false);
    expect(mocks.inserts).toEqual([]);
  });

  it("stores the room and its type", async () => {
    expect(await addBlockedDate(input)).toEqual({ ok: true });
    expect(mocks.inserts).toEqual([{ ...input, unit_id: UNIT_ID }]);
  });
});
