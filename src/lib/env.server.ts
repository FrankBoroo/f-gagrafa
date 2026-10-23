import "server-only";
import { z } from "zod";
import { envValue } from "@/lib/env";

// Server-only secrets, validated once in one place. Integrations that are optional (email,
// WhatsApp, payments in local dev) stay undefined when unset, and each caller decides
// whether that means "skip" or "fail"; `requireServerEnv` is for the ones that must exist.

const optional = z.string().optional().transform(envValue);
const optionalEmail = z
  .string()
  .optional()
  .transform(envValue)
  .refine((v) => v === undefined || v.includes("@"), "must be an email address");

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optional,
  PAYSTACK_SECRET_KEY: optional,
  RESEND_API_KEY: optional,
  RESEND_FROM_EMAIL: optionalEmail,
  ADMIN_NOTIFICATION_EMAIL: optionalEmail,
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_WHATSAPP_FROM: optional,
  PORTAL_SESSION_SECRET: optional,
  CRON_SECRET: optional,
});

export type ServerEnv = z.infer<typeof schema>;

function parse(): ServerEnv {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((i: z.ZodIssue) => `${i.path.join(".")} ${i.message}`).join("; ");
    throw new Error(`Invalid environment variables: ${problems}`);
  }
  return result.data;
}

export const serverEnv: ServerEnv = parse();

export function requireServerEnv(name: keyof ServerEnv): string {
  const value = serverEnv[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local (and to Vercel's environment variables).`);
  return value;
}
