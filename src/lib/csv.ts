import "server-only";

// Minimal CSV serializer — good enough for admin exports without pulling in
// a dependency. Escapes quotes/commas/newlines per RFC 4180.
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape((row as any)[c.key])).join(","));
  return [header, ...lines].join("\n");
}
