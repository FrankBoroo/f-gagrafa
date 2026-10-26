import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { PORTAL_SESSION_SECRET: "test-secret" } as Record<string, string | undefined>,
}));

vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("@/lib/env.server", () => ({ serverEnv: mocks.env }));

import { createCheckoutToken, verifyCheckoutToken } from "./checkout-session";
import { createPortalToken } from "./portal-session";

const CODE = "GAG-2026-ABCDEF";

describe("checkout token", () => {
  it("is valid only for its own booking code", () => {
    const token = createCheckoutToken(CODE);
    expect(verifyCheckoutToken(token, CODE)).toBe(true);
    expect(verifyCheckoutToken(token, CODE.toLowerCase())).toBe(true);
    expect(verifyCheckoutToken(token, "GAG-2026-ZZZZZZ")).toBe(false);
  });

  it("rejects missing, tampered and expired tokens", () => {
    expect(verifyCheckoutToken(undefined, CODE)).toBe(false);
    expect(verifyCheckoutToken("junk", CODE)).toBe(false);
    const [payload, signature] = createCheckoutToken(CODE).split(".");
    const forged = Buffer.from(JSON.stringify({ c: CODE, e: Date.now() + 1e9 })).toString("base64url");
    expect(verifyCheckoutToken(`${forged}.${signature}`, CODE)).toBe(false);
    expect(verifyCheckoutToken(`${payload}.${signature}x`, CODE)).toBe(false);
    expect(verifyCheckoutToken(createCheckoutToken(CODE, -1), CODE)).toBe(false);
  });

  it("is not interchangeable with a guest portal token", () => {
    expect(verifyCheckoutToken(createPortalToken(CODE), CODE)).toBe(false);
  });
});
