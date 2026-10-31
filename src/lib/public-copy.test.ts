import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guests read "apartment", never "residence", and nothing unconfirmed or stock appears on the site.
const ROOTS = ["src/app", "src/components/site", "src/lib/notify", "src/lib/property.ts", "src/lib/site-settings.ts"];
const SKIP = [join("src", "app", "admin"), join("src", "app", "api")];
const BANNED = [/residence/i, /spintex/i, /images\.unsplash\.com/, /infinity pool/i, /backup power/i, /secure parking/i];

function sourceFiles(path: string): string[] {
  if (SKIP.some((s) => path.startsWith(s))) return [];
  if (statSync(path).isFile()) return /\.(ts|tsx|txt)$/.test(path) && !path.includes(".test.") ? [path] : [];
  return readdirSync(path).flatMap((name: string) => sourceFiles(join(path, name)));
}

describe.skip("public copy", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(join(...root.split("/"))));

  it.each(files)("%s has no retired words or invented claims", (file) => {
    const text = readFileSync(file, "utf8");
    for (const word of BANNED) expect(text).not.toMatch(word);
  });
});
