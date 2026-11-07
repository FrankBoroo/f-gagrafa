import { beforeEach, describe, expect, it, vi } from "vitest";

const SETTINGS_ID = "00000000-0000-0000-0000-0000000000c1";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  savedCurrency: "GHS" as "GHS" | "USD",
  updates: [] as Record<string, unknown>[],
}));

class FakeQuery {
  select() { return this; }
  eq() { return this; }
  limit() { return this; }
  maybeSingle() {
    return Promise.resolve({ data: { price_currency: mocks.savedCurrency }, error: null });
  }
  update(payload: Record<string, unknown>) {
    mocks.updates.push(payload);
    return { eq: () => Promise.resolve({ error: null }) };
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => new FakeQuery() }),
}));

const { updatePropertySettings } = await import("@/app/admin/settings/actions");

const base = { id: SETTINGS_ID, property_name: "The Gagrafa" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockResolvedValue(true);
  mocks.savedCurrency = "GHS";
  mocks.updates = [];
});

describe("changing the price currency", () => {
  it("is refused without the confirmation tick, and nothing is saved", async () => {
    const result = await updatePropertySettings({ ...base, price_currency: "USD", usd_to_ghs_rate: 11.6 });
    expect(result).toEqual({
      ok: false,
      error: "Changing the price currency changes what every apartment price means. Tick the box to confirm, then re-enter every price.",
    });
    expect(mocks.updates).toEqual([]);
  });

  it("is saved with the confirmation tick", async () => {
    const result = await updatePropertySettings({ ...base, price_currency: "USD", usd_to_ghs_rate: 11.6, confirm_currency_change: true });
    expect(result).toEqual({ ok: true });
    expect(mocks.updates[0]).toMatchObject({ price_currency: "USD", usd_to_ghs_rate: 11.6 });
    expect(mocks.updates[0]).not.toHaveProperty("confirm_currency_change");
  });

  it("needs no tick when the currency stays the same", async () => {
    mocks.savedCurrency = "USD";
    const result = await updatePropertySettings({ ...base, price_currency: "USD", usd_to_ghs_rate: 12 });
    expect(result).toEqual({ ok: true });
  });
});
