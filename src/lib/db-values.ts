import type { Json } from "@/types/database";

// jsonb columns that hold a list of strings (units.amenities, units.images).
export function stringList(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// A URL or form value narrowed to one of a column's allowed values (see `Constants` in
// src/types/database.ts), or undefined when it isn't one of them.
export function oneOf<T extends string>(allowed: readonly T[], value: string | null | undefined): T | undefined {
  return allowed.find((v: T) => v === value);
}

// Free text from a search box, made safe to put inside a PostgREST `.or()` / `ilike` filter:
// commas, parentheses, quotes and backslashes are filter syntax, and % / _ / * are wildcards.
export function searchTerm(raw: string | undefined, maxLength = 80): string {
  return (raw ?? "").replace(/[%_*,()"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
