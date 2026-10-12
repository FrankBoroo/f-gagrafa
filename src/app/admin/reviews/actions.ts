"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";

export async function setReviewPublished(id: string, isPublished: boolean) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();
  const { error } = await supabase.from("reviews").update({ is_published: isPublished }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("review.publish_toggled", "review", id, { is_published: isPublished });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteReview(id: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("review.deleted", "review", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true };
}
