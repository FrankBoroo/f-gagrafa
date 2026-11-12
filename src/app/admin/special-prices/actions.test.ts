import { beforeEach, describe, expect, it, vi } from "vitest";

const UNIT_ID = "00000000-0000-0000-0000-00000000000a";
const SPECIAL_ID = "00000000-0000-0000-0000-0000000000e1";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  logAudit: vi.fn(),
  inserts: [] as Record<string, unknown>[],
  deletes: [] as unknown[],
  error: null as { code?: string; message?: string } | null,
}));

class FakeQuery {
  private deleting = false;
  insert(payload: Record<string, unknown>) {
    mocks.inserts.push(payload);
    return this;
  }
  delete() {
    this.deleting = true;
    return this;
  }
  select() {
    return this;
  }
  eq(_column: string, value: unknown) {
    if (this.deleting) mocks.deletes.push(value);
    return this;
  }
  single() {
    return Promise.resolve({ data: mocks.error ? null : { id: SPECIAL_ID }, error: mocks.error });
  }
  then(resolve: (v: { data: null; error: unknown }) => unknown) {
    return Promise.resolve({ data: null, error: mocks.error }).then(resolve);
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/auth", () => ({
  isAdmin: mocks.isAdmin,
  isStaff: vi.fn().mockResolvedValue(true),
  UNAUTHORIZED: { ok: false, error: "Unauthorized" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => new FakeQuery() }),
}));

const { createSpecialPrice, deleteSpecialPrice } = await import("@/app/admin/special-prices/actions");

const input = {
  unit_id: UNIT_ID,
  start_date: "2026-12-24",
  end_date: "2026-12-27",
  nightly_price: 250,
  min_nights: 3,
  label: "Christmas",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.inserts = [];
  mocks.deletes = [];
  mocks.error = null;
});

describe("createSpecialPrice", () => {
  it("returns UNAUTHORIZED for a staff user and writes nothing", async () => {
    mocks.isAdmin.mockResolvedValue(false);
    expect(await createSpecialPrice(input)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.inserts).toEqual([]);
  });

  it("saves a special price and records it", async () => {
    expect(await createSpecialPrice(input)).toEqual({ ok: true });
    expect(mocks.inserts).toEqual([input]);
    expect(mocks.logAudit).toHaveBeenCalledWith("special_price.created", "special_price", SPECIAL_ID, expect.any(Object));
  });

  it("says so when the type already has a special price on some of the dates", async () => {
    mocks.error = { code: "23P01" };
    expect(await createSpecialPrice(input)).toEqual({
      ok: false,
      error: "This type already has a special price on some of these dates.",
    });
  });

  it("refuses a range with neither a price nor minimum nights", async () => {
    const result = await createSpecialPrice({ ...input, nightly_price: null, min_nights: null });
    expect(result.ok).toBe(false);
    expect(mocks.inserts).toEqual([]);
  });

  it("accepts minimum nights alone", async () => {
    expect((await createSpecialPrice({ ...input, nightly_price: null })).ok).toBe(true);
  });

  it.each([
    ["an end date that isn't after the start", { end_date: "2026-12-24" }],
    ["a date that doesn't exist", { start_date: "2026-02-30" }],
    ["a price of 0", { nightly_price: 0 }],
    ["minimum nights above 365", { min_nights: 366 }],
    ["a label over 80 characters", { label: "x".repeat(81) }],
  ])("refuses %s", async (_name: string, change: Record<string, unknown>) => {
    const result = await createSpecialPrice({ ...input, ...change } as typeof input);
    expect(result.ok).toBe(false);
    expect(mocks.inserts).toEqual([]);
  });

  it("doesn't show a database error", async () => {
    mocks.error = { code: "42P01", message: 'relation "special_prices" does not exist' };
    const result = await createSpecialPrice(input);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("relation");
  });
});

describe("deleteSpecialPrice", () => {
  it("returns UNAUTHORIZED for a staff user and deletes nothing", async () => {
    mocks.isAdmin.mockResolvedValue(false);
    expect(await deleteSpecialPrice(SPECIAL_ID)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.deletes).toEqual([]);
  });

  it("deletes the special price and records it", async () => {
    expect(await deleteSpecialPrice(SPECIAL_ID)).toEqual({ ok: true });
    expect(mocks.deletes).toEqual([SPECIAL_ID]);
    expect(mocks.logAudit).toHaveBeenCalledWith("special_price.deleted", "special_price", SPECIAL_ID);
  });

  it("refuses an id that isn't a uuid", async () => {
    expect((await deleteSpecialPrice("nope")).ok).toBe(false);
    expect(mocks.deletes).toEqual([]);
  });
});
