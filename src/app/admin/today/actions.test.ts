import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "00000000-0000-0000-0000-000000000103";
const BOOKING_ID = "00000000-0000-0000-0000-0000000000b1";

const mocks = vi.hoisted(() => ({
  isStaff: vi.fn(),
  updates: [] as { table: string; payload: Record<string, unknown> }[],
}));

class FakeQuery {
  constructor(private table: string) {}
  update(payload: Record<string, unknown>) {
    mocks.updates.push({ table: this.table, payload });
    return this;
  }
  eq() {
    return Promise.resolve({ data: null, error: null });
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isStaff: mocks.isStaff, UNAUTHORIZED: { ok: false, error: "Unauthorized" } }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));

const { clearAttention, markRoomCleaned } = await import("@/app/admin/today/actions");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStaff.mockResolvedValue(true);
  mocks.updates = [];
});

describe("Today actions", () => {
  it("refuse anyone who isn't staff and write nothing", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await markRoomCleaned(ROOM_ID)).toEqual({ ok: false, error: "Unauthorized" });
    expect(await clearAttention(BOOKING_ID)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.updates).toEqual([]);
  });

  it("marking a room cleaned only sets its cleaning time", async () => {
    expect(await markRoomCleaned(ROOM_ID)).toEqual({ ok: true });
    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].table).toBe("rooms");
    expect(Object.keys(mocks.updates[0].payload)).toEqual(["last_cleaned_at"]);
  });

  it("clearing attention only sets the handled time on the booking", async () => {
    expect(await clearAttention(BOOKING_ID)).toEqual({ ok: true });
    expect(mocks.updates[0].table).toBe("bookings");
    expect(Object.keys(mocks.updates[0].payload)).toEqual(["attention_cleared_at"]);
  });

  it("refuses an id that isn't a uuid", async () => {
    expect((await markRoomCleaned("nope")).ok).toBe(false);
    expect(mocks.updates).toEqual([]);
  });
});
