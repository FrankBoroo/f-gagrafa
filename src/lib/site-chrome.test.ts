import { describe, expect, it } from "vitest";
import { showsSiteChrome } from "@/lib/site-chrome";

describe("showsSiteChrome", () => {
  it("hides the public header and footer on admin pages", () => {
    expect(showsSiteChrome("/admin")).toBe(false);
    expect(showsSiteChrome("/admin/bookings/123")).toBe(false);
  });

  it("keeps them on public pages, including ones that only start with the letters", () => {
    expect(showsSiteChrome("/")).toBe(true);
    expect(showsSiteChrome("/units/studio")).toBe(true);
    expect(showsSiteChrome("/administrator")).toBe(true);
    expect(showsSiteChrome("/login")).toBe(true);
  });
});
