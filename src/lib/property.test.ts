import { describe, expect, it } from "vitest";
import { nextLoadedSlide } from "@/lib/property";

describe("nextLoadedSlide", () => {
  it("moves to the next photo", () => {
    expect(nextLoadedSlide(0, 3, new Set([0, 1, 2]))).toBe(1);
  });

  it("wraps round to the first photo", () => {
    expect(nextLoadedSlide(2, 3, new Set([0, 1, 2]))).toBe(0);
  });

  it("skips a photo that hasn't finished loading", () => {
    expect(nextLoadedSlide(0, 3, new Set([0, 2]))).toBe(2);
  });

  it("stays put when no other photo is ready, so the hero never fades to blank", () => {
    expect(nextLoadedSlide(0, 3, new Set([0]))).toBe(0);
  });
});
