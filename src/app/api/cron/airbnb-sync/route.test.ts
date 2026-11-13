import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  secret: undefined as string | undefined,
  syncRooms: vi.fn(),
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    get CRON_SECRET() {
      return mocks.secret;
    },
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/lib/airbnb/sync", () => ({ syncRooms: mocks.syncRooms }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { GET } = await import("@/app/api/cron/airbnb-sync/route");

function request(auth?: string) {
  return new NextRequest("https://example.test/api/cron/airbnb-sync", {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.secret = "s3cret";
  mocks.syncRooms.mockResolvedValue({ synced: 3, failed: 1 });
});

describe("GET /api/cron/airbnb-sync", () => {
  it("fails closed with 500 when CRON_SECRET is not set", async () => {
    mocks.secret = undefined;
    const res = await GET(request("Bearer anything"));
    expect(res.status).toBe(500);
    expect(mocks.syncRooms).not.toHaveBeenCalled();
  });

  it("refuses a wrong or missing header with 401", async () => {
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.syncRooms).not.toHaveBeenCalled();
  });

  it("syncs every room and returns the counts", async () => {
    const res = await GET(request("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ synced: 3, failed: 1 });
    expect(mocks.syncRooms).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ olderThanMinutes: 0 }));
  });
});
