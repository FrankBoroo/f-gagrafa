// JSON for a <script type="application/ld+json"> tag. JSON.stringify leaves "<" alone, so a
// value containing "</script>" would end the tag early; escaping it keeps the JSON identical.
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
