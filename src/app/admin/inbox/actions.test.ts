import { beforeEach, describe, expect, it, vi } from "vitest";

const MESSAGE_ID = "00000000-0000-0000-0000-0000000000c1";

const mocks = vi.hoisted(() => ({
  isStaff: vi.fn(),
  logAudit: vi.fn(),
  updates: [] as { table: string; payload: Record<string, unknown>; id: unknown }[],
  error: null as { message: string } | null,
}));

class FakeQuery {
  private payload: Record<string, unknown> = {};
  constructor(private table: string) {}
  update(payload: Record<string, unknown>) {
    this.payload = payload;
    return this;
  }
  eq(_column: string, value: unknown) {
    mocks.updates.push({ table: this.table, payload: this.payload, id: value });
    return Promise.resolve({ data: null, error: mocks.error });
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/auth", () => ({ isStaff: mocks.isStaff, UNAUTHORIZED: { ok: false, error: "Unauthorized" } }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));

const { setContactMessageRead } = await import("@/app/admin/inbox/actions");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStaff.mockResolvedValue(true);
  mocks.updates = [];
  mocks.error = null;
});

describe("setContactMessageRead", () => {
  it("refuses anyone who isn't staff and writes nothing", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await setContactMessageRead(MESSAGE_ID, true)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.updates).toEqual([]);
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("marks a message read and records it without the message text", async () => {
    expect(await setContactMessageRead(MESSAGE_ID, true)).toEqual({ ok: true });
    expect(mocks.updates).toEqual([{ table: "contact_messages", payload: { is_read: true }, id: MESSAGE_ID }]);
    expect(mocks.logAudit).toHaveBeenCalledWith("contact.read", "contact_message", MESSAGE_ID);
  });

  it("marks a message unread", async () => {
    expect(await setContactMessageRead(MESSAGE_ID, false)).toEqual({ ok: true });
    expect(mocks.updates[0].payload).toEqual({ is_read: false });
    expect(mocks.logAudit).toHaveBeenCalledWith("contact.unread", "contact_message", MESSAGE_ID);
  });

  it("refuses an id that isn't a uuid", async () => {
    expect((await setContactMessageRead("nope", true)).ok).toBe(false);
    expect(mocks.updates).toEqual([]);
  });

  it("doesn't show a database error to staff", async () => {
    mocks.error = { message: 'relation "contact_messages" does not exist' };
    const result = await setContactMessageRead(MESSAGE_ID, true);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("relation");
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });
});
