import "server-only";

// Structured server logs: one JSON line per event, which Vercel's log view can search
// and filter. Nothing personal or secret may reach the logs, so every context object
// and error message passes through `redact` first. Log booking codes and ids, never
// names, emails, phones, tokens or door codes.

type Level = "info" | "warn" | "error";
type Context = Record<string, unknown>;

const SENSITIVE_KEY =
  /pass|secret|token|auth|cookie|key|signature|email|phone|name|wifi|access_code|door|card|otp|address|message|comment|description|reason|subject/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Digit runs split by spaces/dashes; masked when they hold 9+ digits (Ghana numbers have 10,
// or 12 with +233), so dates like 2026-11-02 (8 digits) stay readable.
const DIGIT_RUN = /\+?\d[\d\s-]{6,}\d/g;
const BEARER = /(bearer\s+)[\w.-]+/gi;
const MAX_STRING = 500;

export function redactText(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(BEARER, "$1[token]")
    .replace(DIGIT_RUN, (run: string) => (run.replace(/\D/g, "").length >= 9 ? "[number]" : run))
    .slice(0, MAX_STRING);
}

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactText(value);
  if (value instanceof Error) return serializeError(value);
  if (depth > 3) return "[nested]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v: unknown) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Context = {};
    for (const [k, v] of Object.entries(value as Context)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function serializeError(err: unknown): Context {
  if (err instanceof Error) {
    const code = (err as Error & { code?: unknown }).code;
    return {
      name: err.name,
      message: redactText(err.message),
      ...(code != null ? { code: String(code) } : {}),
      stack: err.stack?.split("\n").slice(1, 6).map((l: string) => redactText(l.trim())),
    };
  }
  if (err && typeof err === "object") {
    // Supabase / PostgREST errors are plain objects: { code, message, details, hint }.
    const e = err as { code?: unknown; message?: unknown };
    return { code: e.code != null ? String(e.code) : undefined, message: redactText(String(e.message ?? "")) };
  }
  return { message: redactText(String(err)) };
}

function write(level: Level, event: string, context?: Context, err?: unknown) {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...(context ? (redact(context) as Context) : {}),
    ...(err !== undefined ? { error: serializeError(err) } : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, context?: Context) => write("info", event, context),
  warn: (event: string, context?: Context, err?: unknown) => write("warn", event, context, err),
  error: (event: string, context?: Context, err?: unknown) => write("error", event, context, err),
};
