"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaff, UNAUTHORIZED } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { IMAGE_TYPES, ensurePublicBucket, pathInBucket } from "@/lib/storage";

const BUCKET = "gallery-images";
const MAX_ITEMS = 120;
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);
const MIGRATION_MESSAGE =
  "The Tour gallery table doesn't exist yet. Run supabase/migration-tour-gallery.sql in the Supabase SQL Editor, then try again.";
const categorySchema = z.enum(["property", "neighbourhood"]);

function fail(error: { code?: string; message: string }) {
  return { ok: false, error: MISSING_TABLE.has(error.code ?? "") ? MIGRATION_MESSAGE : error.message };
}

function refresh() {
  revalidatePath("/tour");
  revalidatePath("/admin/tour");
}

// Step 1 of an upload: a one-time signed URL so the photo goes straight from the browser
// to Supabase Storage (sending it through this server would hit Vercel's ~4.5 MB limit).
export async function createGalleryUpload(contentType: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const extension = IMAGE_TYPES[contentType];
  if (!extension) return { ok: false, error: "Use a JPG, PNG or WebP photo." };

  const supabase = createServiceClient();
  const { count, error: countError } = await supabase
    .from("gallery_items")
    .select("id", { count: "exact", head: true });
  if (countError) return fail(countError);
  if ((count ?? 0) >= MAX_ITEMS) {
    return { ok: false, error: `The gallery is full (${MAX_ITEMS} photos). Remove some first.` };
  }

  await ensurePublicBucket(supabase, BUCKET);
  const path = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start the upload" };

  return { ok: true, path: data.path as string, token: data.token as string };
}

// Step 2: once the browser has uploaded the file, add it to the gallery.
export async function registerGalleryItem(path: string, category: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const cat = categorySchema.safeParse(category);
  if (!cat.success) return { ok: false, error: "Choose a section for this photo." };
  if (!/^[\w.-]+$/.test(path)) return { ok: false, error: "Invalid photo path" };

  const supabase = createServiceClient();
  const { data: found } = await supabase.storage.from(BUCKET).list("", { limit: 100, search: path });
  if (!found?.some((f: { name: string }) => f.name === path)) {
    return { ok: false, error: "The photo didn't finish uploading — please try again." };
  }

  const { data: last } = await supabase
    .from("gallery_items")
    .select("sort_order")
    .eq("category", cat.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;
  const { data: item, error } = await supabase
    .from("gallery_items")
    .insert({ category: cat.data, image_url: publicUrl, caption: null, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("*")
    .single();
  if (error || !item) return fail(error ?? { message: "Could not save the photo" });

  await logAudit("gallery.photo_added", "gallery_item", item.id, { category: cat.data });
  refresh();
  return { ok: true, item };
}

// Edit a caption and/or move the photo to the other section (it goes to the end of it).
export async function updateGalleryItem(id: string, caption: string, category: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const cat = categorySchema.safeParse(category);
  if (!cat.success) return { ok: false, error: "Invalid section" };
  const cleanCaption = caption.trim().slice(0, 200);

  const supabase = createServiceClient();
  const { data: existing } = await supabase.from("gallery_items").select("category").eq("id", id).maybeSingle();
  if (!existing) return { ok: false, error: "Photo not found" };

  const update: Record<string, unknown> = { caption: cleanCaption || null };
  if (existing.category !== cat.data) {
    const { data: last } = await supabase
      .from("gallery_items")
      .select("sort_order")
      .eq("category", cat.data)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    update.category = cat.data;
    update.sort_order = (last?.sort_order ?? 0) + 1;
  }

  const { data: item, error } = await supabase.from("gallery_items").update(update).eq("id", id).select("*").single();
  if (error || !item) return fail(error ?? { message: "Could not save" });

  await logAudit("gallery.photo_updated", "gallery_item", id, { category: cat.data });
  refresh();
  return { ok: true, item };
}

// Moves a photo one place earlier ("up") or later ("down") within its section.
export async function moveGalleryItem(id: string, direction: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  if (direction !== "up" && direction !== "down") return { ok: false, error: "Invalid direction" };

  const supabase = createServiceClient();
  const { data: target } = await supabase.from("gallery_items").select("category").eq("id", id).maybeSingle();
  if (!target) return { ok: false, error: "Photo not found" };

  const { data: siblings } = await supabase
    .from("gallery_items")
    .select("id, sort_order")
    .eq("category", target.category)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const list = [...(siblings ?? [])] as { id: string; sort_order: number }[];
  const from = list.findIndex((row) => row.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= list.length) return { ok: true }; // already at the end

  [list[from], list[to]] = [list[to], list[from]];
  // Renumber the whole section 1..n so order stays unambiguous.
  const changes = list
    .map((row, position) => ({ id: row.id, order: position + 1, was: row.sort_order }))
    .filter((row) => row.order !== row.was);
  for (const row of changes) {
    const { error } = await supabase.from("gallery_items").update({ sort_order: row.order }).eq("id", row.id);
    if (error) return fail(error);
  }

  refresh();
  return { ok: true };
}

export async function deleteGalleryItem(id: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();

  const { data: item } = await supabase.from("gallery_items").select("image_url").eq("id", id).maybeSingle();
  if (!item) return { ok: false, error: "Photo not found" };

  const { error } = await supabase.from("gallery_items").delete().eq("id", id);
  if (error) return fail(error);

  const path = pathInBucket(item.image_url, BUCKET);
  if (path) await supabase.storage.from(BUCKET).remove([path]); // best-effort tidy-up

  await logAudit("gallery.photo_deleted", "gallery_item", id);
  refresh();
  return { ok: true };
}
