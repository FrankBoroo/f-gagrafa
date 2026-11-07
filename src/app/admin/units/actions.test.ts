import { beforeEach, describe, expect, it, vi } from "vitest";

const UNIT_ID = "00000000-0000-0000-0000-00000000000a";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  counts: { rooms: 0, bookings: 0 } as Record<string, number>,
  deletes: [] as string[],
}));

class FakeQuery {
  private op = "select";
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  maybeSingle() { return Promise.resolve({ data: { name: "1-Bed Standard", images: [] }, error: null }); }
  delete() {
    this.op = "delete";
    mocks.deletes.push(this.table);
    return this;
  }
  then(resolve: (v: unknown) => unknown) {
    if (this.op === "delete") return Promise.resolve({ error: null }).then(resolve);
    return Promise.resolve({ count: mocks.counts[this.table] ?? 0, data: null, error: null }).then(resolve);
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAdmin: mocks.isAdmin, isStaff: vi.fn(), UNAUTHORIZED: { ok: false, error: "Unauthorized" } }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
    storage: { from: () => ({ remove: vi.fn() }) },
  }),
}));

const { deleteUnit } = await import("@/app/admin/units/actions");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.counts = { rooms: 0, bookings: 0 };
  mocks.deletes = [];
});

describe("deleteUnit", () => {
  it("refuses a type that still has rooms", async () => {
    mocks.counts.rooms = 2;
    expect(await deleteUnit(UNIT_ID)).toEqual({
      ok: false,
      error: "This type has 2 room(s). Delete or move them in Rooms first.",
    });
    expect(mocks.deletes).toEqual([]);
  });

  it("deletes a type with no rooms and no bookings", async () => {
    expect(await deleteUnit(UNIT_ID)).toEqual({ ok: true });
    expect(mocks.deletes).toEqual(["units"]);
  });
});
