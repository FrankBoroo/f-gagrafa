import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

const columns = [{ key: "v", label: "Value" }];
const cell = (v: unknown) => toCsv([{ v }], columns).slice("Value\n".length);

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(cell('a, "b"')).toBe('"a, ""b"""');
    expect(cell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("leaves ordinary values and numbers alone", () => {
    expect(cell("Ama Mensah")).toBe("Ama Mensah");
    expect(cell(-1200)).toBe("-1200");
    expect(cell(null)).toBe("");
  });

  it("stops spreadsheet formulas in text a guest typed", () => {
    expect(cell("=HYPERLINK(\"http://x\",\"y\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\",\"\"y\"\")\"");
    expect(cell("+233 24 000")).toBe("'+233 24 000");
    expect(cell("-2+3")).toBe("'-2+3");
    expect(cell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(cell("\t=1")).toBe("'\t=1");
    expect(cell("＝1")).toBe("'＝1");
  });
});
