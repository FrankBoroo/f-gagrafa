import { beforeEach, describe, expect, it, vi } from "vitest";

const BOOKING_ID = "00000000-0000-0000-0000-0000000000b1";
const STAFF_ID = "00000000-0000-0000-0000-0000000000a1";

const mocks = vi.hoisted(() => ({
  isStaff: vi.fn(),
  getCurrentProfile: vi.fn(),
  logAudit: vi.fn(),
  booking: null as { guest_email: string; booking_code: string } | null,
  upserts: [] as { table: string; payload: Record<string, unknown>; options: unknown }[],
  upsertError: null as { message: string } | null,
}));

class FakeQuery {
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: mocks.booking, error: null });
  }
  upsert(payload: Record<string, unknown>, options: unknown) {
    mocks.upserts.push({ table: this.table, payload, options });
    return Promise.resolve({ data: null, error: mocks.upsertError });
  }
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/auth", () => ({
  isStaff: mocks.isStaff,
  getCurrentProfile: mocks.getCurrentProfile,
  UNAUTHORIZED: { ok: false, error: "Unauthorized" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));

const { saveGuestNotes } = await import("@/app/admin/guests/actions");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStaff.mockResolvedValue(true);
  mocks.getCurrentProfile.mockResolvedValue({ id: STAFF_ID, email: "staff@example.com", full_name: "Staff", role: "staff" });
  mocks.booking = { guest_email: " Ama@Example.com", booking_code: "GAG-2026-AB12" };
  mocks.upserts = [];
  mocks.upsertError = null;
});

describe("saveGuestNotes", () => {
  it("refuses anyone who isn't staff and writes nothing", async () => {
    mocks.isStaff.mockResolvedValue(false);
    expect(await saveGuestNotes({ bookingId: BOOKING_ID, notes: "Likes a late check-out" })).toEqual({
      ok: false,
      error: "Unauthorized",
    });
    expect(mocks.upserts).toEqual([]);
  });

  it("refuses notes longer than 2000 characters", async () => {
    const result = await saveGuestNotes({ bookingId: BOOKING_ID, notes: "x".repeat(2001) });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("2,000");
    expect(mocks.upserts).toEqual([]);
  });

  it("accepts exactly 2000 characters", async () => {
    expect((await saveGuestNotes({ bookingId: BOOKING_ID, notes: "x".repeat(2000) })).ok).toBe(true);
  });

  it("saves the notes under the lower-cased email with who saved them", async () => {
    expect(await saveGuestNotes({ bookingId: BOOKING_ID, notes: "  Likes a late check-out  " })).toEqual({ ok: true });
    expect(mocks.upserts).toHaveLength(1);
    expect(mocks.upserts[0].table).toBe("guest_notes");
    expect(mocks.upserts[0].payload).toMatchObject({
      email: "ama@example.com",
      notes: "Likes a late check-out",
      updated_by: STAFF_ID,
    });
    expect(mocks.upserts[0].options).toEqual({ onConflict: "email" });
  });

  it("records the save with the booking code only, never the notes or the email", async () => {
    await saveGuestNotes({ bookingId: BOOKING_ID, notes: "Allergic to nuts" });
    expect(mocks.logAudit).toHaveBeenCalledWith("guest.notes_saved", "booking", BOOKING_ID, {
      booking_code: "GAG-2026-AB12",
    });
    expect(JSON.stringify(mocks.logAudit.mock.calls)).not.toMatch(/nuts|ama@/i);
  });

  it("refuses a booking id that isn't a uuid or doesn't exist", async () => {
    expect((await saveGuestNotes({ bookingId: "nope", notes: "x" })).ok).toBe(false);
    mocks.booking = null;
    expect(await saveGuestNotes({ bookingId: BOOKING_ID, notes: "x" })).toEqual({ ok: false, error: "Guest not found" });
    expect(mocks.upserts).toEqual([]);
  });

  it("doesn't show a database error to staff", async () => {
    mocks.upsertError = { message: 'relation "guest_notes" does not exist' };
    const result = await saveGuestNotes({ bookingId: BOOKING_ID, notes: "x" });
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("relation");
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });
});
