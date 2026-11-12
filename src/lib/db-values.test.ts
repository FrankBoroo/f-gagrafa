import { describe, expect, it } from "vitest";
import { likeExact, searchTerm } from "./db-values";
import { jsonLd } from "./json-ld";

describe("searchTerm", () => {
  it("keeps names, emails and booking codes", () => {
    expect(searchTerm("Ama Mensah")).toBe("Ama Mensah");
    expect(searchTerm("ama@example.com")).toBe("ama@example.com");
    expect(searchTerm("GAG-2026-ABCDEF")).toBe("GAG-2026-ABCDEF");
  });

  it("removes filter syntax and wildcards", () => {
    expect(searchTerm("x),status.eq.(cancelled")).toBe("x status.eq. cancelled");
    expect(searchTerm('a%b_c*d"e\\f:g')).toBe("a b c d e f g");
  });

  it("handles empty input and caps the length", () => {
    expect(searchTerm(undefined)).toBe("");
    expect(searchTerm("a".repeat(200))).toHaveLength(80);
  });
});

describe("jsonLd", () => {
  it("cannot close the script tag and still parses to the same data", () => {
    const data = { description: "Nice </script><script>alert(1)</script>" };
    const out = jsonLd(data);
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual(data);
  });
});

describe("likeExact", () => {
  it("escapes the wildcards and the escape character", () => {
    expect(likeExact("a_b%c\\d")).toBe("a\\_b\\%c\\\\d");
  });

  it("leaves an ordinary email alone", () => {
    expect(likeExact("ama.mensah+trip@example.com")).toBe("ama.mensah+trip@example.com");
  });
});
