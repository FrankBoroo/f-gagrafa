import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  env: { PAYSTACK_SECRET_KEY: "sk_test_secret" } as Record<string, string | undefined>,
}));

vi.mock("@/lib/booking-payment", () => ({ confirmPaymentByReference: mocks.confirm }));
vi.mock("@/lib/env.server", () => ({ serverEnv: mocks.env }));

import { POST } from "./route";

function request(body: string, signature?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== undefined) headers.set("x-paystack-signature", signature);
  return new Request("http://localhost/api/webhooks/paystack", { method: "POST", body, headers }) as never;
}
const sign = (body: string, secret = "sk_test_secret") => crypto.createHmac("sha512", secret).update(body).digest("hex");
const charge = JSON.stringify({ event: "charge.success", data: { reference: "GAG-2026-ABCDEF" } });

describe("Paystack webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.PAYSTACK_SECRET_KEY = "sk_test_secret";
    mocks.confirm.mockResolvedValue({ outcome: "paid" });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("confirms the payment when the signature is valid", async () => {
    const res = await POST(request(charge, sign(charge)));
    expect(res.status).toBe(200);
    expect(mocks.confirm).toHaveBeenCalledWith("GAG-2026-ABCDEF");
  });

  it("rejects a missing, wrong-length or forged signature without touching the booking", async () => {
    for (const sig of [undefined, "abc", sign(charge, "someone-elses-key")]) {
      const res = await POST(request(charge, sig));
      expect(res.status).toBe(401);
    }
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("answers 400 to a signed but malformed body", async () => {
    const body = "not json";
    expect((await POST(request(body, sign(body)))).status).toBe(400);
  });

  it("ignores events other than charge.success", async () => {
    const body = JSON.stringify({ event: "transfer.success", data: { reference: "X" } });
    expect((await POST(request(body, sign(body)))).status).toBe(200);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("answers 500 when confirmation throws, so Paystack retries", async () => {
    mocks.confirm.mockRejectedValue(new Error("database down"));
    expect((await POST(request(charge, sign(charge)))).status).toBe(500);
  });

  it("refuses to run without a secret key", async () => {
    mocks.env.PAYSTACK_SECRET_KEY = undefined;
    expect((await POST(request(charge, sign(charge)))).status).toBe(500);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
