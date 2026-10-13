// Server actions return small unions like { ok: false; error } | { ok: true; images }.
// On the client we only ever want "did it work, and what came back?", so this gives
// every result one predictable shape: `ok` and `error` always exist; extra fields are optional.
export type ActionResult<T extends object = {}> = { ok: boolean; error?: string } & Partial<T>;

export function asResult<T extends object = {}>(value: unknown): ActionResult<T> {
  return value as ActionResult<T>;
}
