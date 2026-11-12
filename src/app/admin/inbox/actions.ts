"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

const id = z.string().uuid();

// Mark a contact-form message read or unread. Service requests keep
// updateServiceRequestStatus in src/app/admin/service-requests/actions.ts.
export async function setContactMessageRead(messageId: string, isRead: boolean) {
  if (!(await isStaff())) return UNAUTHORIZED;
  if (!id.safeParse(messageId).success || typeof isRead !== "boolean") {
    return { ok: false, error: "Message not found" };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("contact_messages").update({ is_read: isRead }).eq("id", messageId);
  if (error) return { ok: false, error: "Could not update the message. Please try again." };

  await logAudit(isRead ? "contact.read" : "contact.unread", "contact_message", messageId);
  revalidatePath("/admin/inbox");
  return { ok: true };
}
