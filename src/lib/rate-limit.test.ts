import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  headers: new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
  env: { PORTAL_SESSION_SECRET: "test-secret" } as Record<string, string | undefined>,
}));

vi.mock("next/headers", () => ({ headers: async () => mocks.headers }));
vi.mock("@/lib/env.server", () => ({ serverEnv: mocks.env }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));

import { clientIpFrom, hashVisitor, isOverLimit, RATE_LIMITS } from "./rate-limit";

describe("clientIpFrom", () => {
  it("takes the first x-forwarded-for entry", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});

describe("hashVisitor", () => {
  it("never contains the raw IP and depends on the secret", () => {
    const a = hashVisitor("203.0.113.7", "one");
    expect(a).not.toContain("203.0.113.7");
    expect(a).toHaveLength(32);
    expect(hashVisitor("203.0.113.7", "one")).toBe(a);
    expect(hashVisitor("203.0.113.7", "two")).not.toBe(a);
  });
});

describe("isOverLimit", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.env.PORTAL_SESSION_SECRET = "test-secret";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("passes the bucket's limits and a hashed key to the database", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect(await isOverLimit("booking")).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_bucket: "booking",
      p_key: hashVisitor("203.0.113.7", "test-secret"),
      p_max: RATE_LIMITS.booking.max,
      p_window_seconds: RATE_LIMITS.booking.windowSeconds,
    });
  });

  it("blocks when the database says the limit is used up", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await isOverLimit("contact")).toBe(true);
  });

  it("fails open when the function is missing or the call throws", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } });
    expect(await isOverLimit("portal")).toBe(false);
    mocks.rpc.mockRejectedValueOnce(new Error("network"));
    expect(await isOverLimit("portal")).toBe(false);
  });

  it("does nothing without a secret to hash with", async () => {
    mocks.env.PORTAL_SESSION_SECRET = undefined;
    expect(await isOverLimit("promo")).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
