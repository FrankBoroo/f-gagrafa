import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; html: string }[] }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (m: { to: string; subject: string; html: string }) => void mocks.sent.push(m) };
  },
}));
vi.mock("@/lib/env.server", () => ({ serverEnv: { RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "The Gagrafa <a@b.test>" } }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/portal-session", () => ({ portalMagicLink: (code: string) => `https://example.test/portal-link/${code}` }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ takeToken: vi.fn() }));

const { sendPreArrivalReminder, sendBalancePaymentLinkEmail } = await import("@/lib/notify/email");

const booking = {
  booking_code: "GAG-2026-TEST01",
  guest_name: "Ama",
  guest_email: "ama@example.com",
  check_in: "2026-12-10",
  check_out: "2026-12-13",
  currency: "GHS",
  room_confirmed: false,
  rooms: { number: 8 },
};

beforeEach(() => {
  mocks.sent.length = 0;
});

describe("sendPreArrivalReminder", () => {
  it("links to Pay balance when money is owed", async () => {
    await sendPreArrivalReminder(booking, "1-Bed", 300);
    const html = mocks.sent[0].html;
    expect(html).toContain("Pay balance");
    expect(html).toContain("https://example.test/portal-link/GAG-2026-TEST01");
    expect(html).toContain("front desk");
  });

  it("has no Pay balance link when nothing is owed", async () => {
    await sendPreArrivalReminder(booking, "1-Bed", 0);
    expect(mocks.sent[0].html).not.toContain("Pay balance");
  });

  it("shows the room only once it is confirmed", async () => {
    await sendPreArrivalReminder(booking, "1-Bed", 0);
    expect(mocks.sent[0].html).not.toContain("Room 8");
    await sendPreArrivalReminder({ ...booking, room_confirmed: true }, "1-Bed", 0);
    expect(mocks.sent[1].html).toContain("Your room:");
    expect(mocks.sent[1].html).toContain("Room 8");
  });
});

describe("sendBalancePaymentLinkEmail", () => {
  it("sends the owed amount, dates and a Pay balance link", async () => {
    await sendBalancePaymentLinkEmail(booking, "1-Bed", 450);
    const m = mocks.sent[0];
    expect(m.to).toBe("ama@example.com");
    expect(m.subject).toBe("Your balance for GAG-2026-TEST01");
    expect(m.html).toContain("450");
    expect(m.html).toContain("Pay balance");
    expect(m.html).toContain("https://example.test/portal-link/GAG-2026-TEST01");
    expect(m.html).toContain("cash, bank transfer or Mobile Money");
  });
});
