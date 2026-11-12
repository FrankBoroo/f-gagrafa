import { describe, expect, it } from "vitest";
import { phoneNumbers, telHref, whatsappHref } from "@/lib/contact-links";

describe("phoneNumbers", () => {
  it("splits Settings phone text on a slash or a dot", () => {
    expect(phoneNumbers("0303 400 535 / 059 381 0182")).toEqual(["0303 400 535", "059 381 0182"]);
    expect(phoneNumbers("0303 400 535 · 059 381 0182")).toHaveLength(2);
  });

  it("returns nothing for blank text", () => {
    expect(phoneNumbers("")).toEqual([]);
    expect(phoneNumbers("  /  ")).toEqual([]);
  });
});

describe("telHref", () => {
  it("turns a local Ghana number into an international link", () => {
    expect(telHref("0303 400 535")).toBe("tel:+233303400535");
  });

  it("keeps a number that is already international", () => {
    expect(telHref("+233 59 381 0182")).toBe("tel:+233593810182");
  });

  it("refuses text that is not a phone number", () => {
    expect(telHref("call us")).toBeNull();
    expect(telHref("")).toBeNull();
  });
});

describe("whatsappHref", () => {
  it("turns a local Ghana number into a WhatsApp link", () => {
    expect(whatsappHref("059 381 0182")).toBe("https://wa.me/233593810182");
  });

  it("keeps the country code of an international number", () => {
    expect(whatsappHref("+44 20 7946 0000")).toBe("https://wa.me/442079460000");
  });

  it("refuses text that is not a phone number", () => {
    expect(whatsappHref("call us")).toBeNull();
    expect(whatsappHref("")).toBeNull();
  });
});
