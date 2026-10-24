import { beforeEach, describe, expect, it, vi } from "vitest";

// A one-row promo_codes table with Postgres-style conditional updates: an update matches only
// when every .eq() filter holds, which is what makes claimPromoUse's compare-and-set safe.
interface PromoRow {
  code: string;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
}

const mocks = vi.hoisted(() => ({
  row: null as PromoRow | null,
  // Runs between a read and the next update, to simulate another booking getting in first.
  beforeUpdate: null as (() => void) | null,
  updates: 0,
}));

class FakeQuery {
  private filters: [string, unknown][] = [];
  private patch: Partial<PromoRow> | null = null;
  select() { return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  maybeSingle() { return this; }
  update(patch: Partial<PromoRow>) { this.patch = patch; return this; }
  then<T>(resolve: (value: { data: unknown; error: null }) => T) {
    return Promise.resolve(this.run()).then(resolve);
  }
  private matches(): boolean {
    const row = mocks.row;
    return !!row && this.filters.every(([col, val]: [string, unknown]) => row[col as keyof PromoRow] === val);
  }
  private run(): { data: unknown; error: null } {
    if (!this.patch) return { data: this.matches() ? { ...mocks.row } : null, error: null };
    mocks.beforeUpdate?.();
    mocks.beforeUpdate = null;
    mocks.updates++;
    if (!this.matches() || !mocks.row) return { data: [], error: null };
    Object.assign(mocks.row, this.patch);
    return { data: [{ code: mocks.row.code }], error: null };
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => new FakeQuery() }),
}));

const { claimPromoUse, releasePromoUse } = await import("@/lib/booking/promo");

function promo(overrides: Partial<PromoRow> = {}): PromoRow {
  return { code: "STAYFREE", is_active: true, used_count: 0, max_uses: 1, ...overrides };
}

beforeEach(() => {
  mocks.row = promo();
  mocks.beforeUpdate = null;
  mocks.updates = 0;
});

describe("claimPromoUse", () => {
  it("takes a use when the code has one left", async () => {
    expect(await claimPromoUse("STAYFREE")).toBe(true);
    expect(mocks.row?.used_count).toBe(1);
  });

  it("refuses a code at its limit", async () => {
    mocks.row = promo({ used_count: 1 });
    expect(await claimPromoUse("STAYFREE")).toBe(false);
    expect(mocks.row?.used_count).toBe(1);
  });

  it("refuses an inactive or unknown code", async () => {
    mocks.row = promo({ is_active: false });
    expect(await claimPromoUse("STAYFREE")).toBe(false);
    expect(await claimPromoUse("NOPE")).toBe(false);
  });

  it("never lets two guests take a single-use code's last use", async () => {
    // Another booking claims the use after we read used_count = 0 but before our update.
    mocks.beforeUpdate = () => { mocks.row!.used_count = 1; };
    expect(await claimPromoUse("STAYFREE")).toBe(false);
    expect(mocks.row?.used_count).toBe(1);
  });

  it("retries when another booking won the race but uses remain", async () => {
    mocks.row = promo({ max_uses: 5, used_count: 2 });
    mocks.beforeUpdate = () => { mocks.row!.used_count = 3; };
    expect(await claimPromoUse("STAYFREE")).toBe(true);
    expect(mocks.row?.used_count).toBe(4);
    expect(mocks.updates).toBe(2);
  });

  it("has no limit when max_uses is empty", async () => {
    mocks.row = promo({ max_uses: null, used_count: 99 });
    expect(await claimPromoUse("STAYFREE")).toBe(true);
    expect(mocks.row?.used_count).toBe(100);
  });
});

describe("releasePromoUse", () => {
  it("gives back a claimed use", async () => {
    mocks.row = promo({ used_count: 1 });
    await releasePromoUse("STAYFREE");
    expect(mocks.row?.used_count).toBe(0);
  });

  it("never goes below zero", async () => {
    await releasePromoUse("STAYFREE");
    expect(mocks.row?.used_count).toBe(0);
    expect(mocks.updates).toBe(0);
  });
});
