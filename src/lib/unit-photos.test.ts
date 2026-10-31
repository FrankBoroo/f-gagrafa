import { describe, expect, it } from "vitest";
import { withNewPhoto } from "@/lib/unit-photos";

const NEW = "https://x.supabase.co/storage/v1/object/public/unit-images/u/new.jpg";

describe("withNewPhoto", () => {
  it("adds to the end, so a real cover photo stays the cover", () => {
    expect(withNewPhoto(["/apartments/penthouse/1.jpg"], NEW)).toEqual(["/apartments/penthouse/1.jpg", NEW]);
  });

  it("becomes the cover when the type only has stock placeholders", () => {
    const stock = "https://images.unsplash.com/photo-1";
    expect(withNewPhoto([stock], NEW)).toEqual([NEW, stock]);
  });

  it("is the only photo on an empty gallery", () => {
    expect(withNewPhoto([], NEW)).toEqual([NEW]);
  });
});
