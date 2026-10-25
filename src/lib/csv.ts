import "server-only";

// Minimal CSV serializer — good enough for admin exports without pulling in
// a dependency. Escapes quotes/commas/newlines per RFC 4180.
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const escape = (value: unknown) => {
    let str = value === null || value === undefined ? "" : String(value);
    // Text a guest typed (a name like "=HYPERLINK(...)") must not run as a formula when
    // the export is opened in Excel or Sheets. A leading ' makes it plain text. Numbers
    // are left alone so refunds (-1200) still add up.
    if (typeof value === "string" && /^[=+\-@\t\r＝＋－＠]/.test(str)) str = `'${str}`;
    if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape((row as any)[c.key])).join(","));
  return [header, ...lines].join("\n");
}
