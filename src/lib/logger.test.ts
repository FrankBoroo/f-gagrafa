import { afterEach, describe, expect, it, vi } from "vitest";
import { log, redact, redactText } from "./logger";

describe("redactText", () => {
  it("masks emails, phone numbers and bearer tokens", () => {
    expect(redactText("send to ama@example.com failed")).toBe("send to [email] failed");
    expect(redactText("WhatsApp to +233 24 123 4567")).toBe("WhatsApp to [number]");
    expect(redactText("Authorization: Bearer sk_live_abc.def")).toBe("Authorization: Bearer [token]");
  });
  it("keeps booking codes, dates and short numbers readable", () => {
    expect(redactText("GAG-7K2Q9 on 2026-11-02, 3 nights")).toBe("GAG-7K2Q9 on 2026-11-02, 3 nights");
  });
});

describe("redact", () => {
  it("hides sensitive keys at any depth", () => {
    expect(
      redact({ booking_code: "GAG-1", guest_email: "a@b.co", nested: { wifi_password: "x", guest_phone: "0241234567" } })
    ).toEqual({ booking_code: "GAG-1", guest_email: "[redacted]", nested: { wifi_password: "[redacted]", guest_phone: "[redacted]" } });
  });
  it("turns errors into name, message, code and a short stack", () => {
    const err = Object.assign(new Error("insert for ama@example.com failed"), { code: "23P01" });
    const out = redact({ err }) as { err: { message: string; code: string; stack: string[] } };
    expect(out.err.message).toBe("insert for [email] failed");
    expect(out.err.code).toBe("23P01");
    expect(out.err.stack.length).toBeLessThanOrEqual(5);
  });
});

describe("log", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes one JSON line without personal data", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log.error("booking.insert_failed", { booking_code: "GAG-1", guest_email: "a@b.co" }, { code: "500", message: "boom for a@b.co" });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      level: "error",
      event: "booking.insert_failed",
      booking_code: "GAG-1",
      guest_email: "[redacted]",
      error: { code: "500", message: "boom for [email]" },
    });
    expect(spy.mock.calls[0][0]).not.toContain("a@b.co");
  });
});
