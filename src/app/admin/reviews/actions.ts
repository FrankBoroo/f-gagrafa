"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function setReviewPublished(id: string, isPublished: boolean) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("reviews").update({ is_published: isPublished }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("review.publish_toggled", "review", id, { is_published: isPublished });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteReview(id: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("review.deleted", "review", id);
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true };
}
