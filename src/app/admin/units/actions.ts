"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import {
  unitUpdateSchema, unitDetailsSchema, type UnitUpdateInput, type UnitDetailsInput,
} from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { isStaff, isAdmin, UNAUTHORIZED } from "@/lib/auth";

export async function updateUnit(input: UnitUpdateInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = unitUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid unit details" };
  }
  const { id, ...fields } = parsed.data;

  const supabase = createServiceClient();
  const { error } = await supabase.from("units").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.updated", "unit", id, fields);
  revalidatePath("/admin/units");
  revalidatePath("/units");
  return { ok: true };
}

export async function toggleUnitActive(id: string, isActive: boolean) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();
  const { error } = await supabase.from("units").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.active_toggled", "unit", id, { is_active: isActive });
  revalidatePath("/admin/units");
  revalidatePath("/units");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Create / edit / delete a residence, and manage its photos
// ---------------------------------------------------------------------------

const BUCKET = "unit-images";
const MAX_PHOTOS = 12;
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "residence"
  );
}

// Public URL -> path inside our bucket (null for anything else, e.g. the seed photos).
function bucketPathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// Door codes live in their own locked-down table (see the migration): putting one on
// `units` would expose it through the public API.
async function saveAccessCode(supabase: any, unitId: string, code: string): Promise<string | null> {
  const { error } = code
    ? await supabase
        .from("unit_access_codes")
        .upsert({ unit_id: unitId, access_code: code, updated_at: new Date().toISOString() })
    : await supabase.from("unit_access_codes").delete().eq("unit_id", unitId);
  if (!error) return null;
  return MISSING_TABLE.has(error.code)
    ? "The door code couldn't be saved: run supabase/migration-portal-and-ops.sql in the Supabase SQL Editor first."
    : error.message;
}

function refreshUnitPages(id?: string) {
  revalidatePath("/admin/units");
  if (id) revalidatePath(`/admin/units/${id}`);
  revalidatePath("/units", "layout");
  revalidatePath("/");
}

export async function createUnit(input: UnitDetailsInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = unitDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid unit details" };
  }
  const { access_code, ...fields } = parsed.data;
  const supabase = createServiceClient();

  const base = slugify(fields.name);
  const { data: similar } = await supabase.from("units").select("slug").like("slug", `${base}%`);
  const taken = new Set((similar ?? []).map((row: { slug: string }) => row.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  const { data: last } = await supabase
    .from("units")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: unit, error } = await supabase
    .from("units")
    .insert({ ...fields, slug, images: [], sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error || !unit) return { ok: false, error: error?.message ?? "Could not create the unit" };

  const codeProblem = access_code ? await saveAccessCode(supabase, unit.id, access_code) : null;

  await logAudit("unit.created", "unit", unit.id, { name: fields.name, slug });
  refreshUnitPages(unit.id);
  return { ok: true, id: unit.id as string, warning: codeProblem ?? undefined };
}

export async function updateUnitDetails(id: string, input: UnitDetailsInput) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const parsed = unitDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid unit details" };
  }
  const { access_code, ...fields } = parsed.data;
  const supabase = createServiceClient();

  const { error } = await supabase.from("units").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const codeProblem = await saveAccessCode(supabase, id, access_code);

  // The door code itself is never written to the audit log.
  await logAudit("unit.details_updated", "unit", id, { ...fields, door_code_set: Boolean(access_code) });
  refreshUnitPages(id);
  return { ok: true, warning: codeProblem ?? undefined };
}

// Admin-only, and refused outright if the unit has any booking history (the database
// would refuse too). Deactivating is the right way to retire a residence that has had guests.
export async function deleteUnit(id: string) {
  if (!(await isAdmin())) return { ok: false, error: "Only admins can delete a residence." };
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `This residence has ${count} booking${count === 1 ? "" : "s"} on record, so it can't be deleted. Deactivate it instead to hide it from the site.`,
    };
  }

  const { data: unit } = await supabase.from("units").select("name, images").eq("id", id).maybeSingle();
  const { error } = await supabase.from("units").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Best-effort tidy-up of uploaded photos.
  const paths = ((unit?.images ?? []) as string[]).map(bucketPathFromUrl).filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  await logAudit("unit.deleted", "unit", id, { name: unit?.name });
  refreshUnitPages();
  return { ok: true };
}

async function ensureBucket(supabase: any) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: Object.keys(ALLOWED_TYPES),
  });
}

// Step 1 of an upload: hand the browser a one-time signed URL so the photo goes straight
// to Supabase Storage. (Sending it through this server would hit Vercel's ~4.5 MB request limit.)
export async function createUnitImageUpload(unitId: string, contentType: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const extension = ALLOWED_TYPES[contentType];
  if (!extension) return { ok: false, error: "Use a JPG, PNG or WebP photo." };

  const supabase = createServiceClient();
  const { data: unit } = await supabase.from("units").select("images").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "Residence not found" };
  if (((unit.images ?? []) as string[]).length >= MAX_PHOTOS) {
    return { ok: false, error: `A residence can have up to ${MAX_PHOTOS} photos.` };
  }

  await ensureBucket(supabase);
  const path = `${unitId}/${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start the upload" };

  return { ok: true, path: data.path as string, token: data.token as string };
}

// Step 2: once the browser has uploaded the file, attach it to the unit.
export async function registerUnitImage(unitId: string, path: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  if (!path.startsWith(`${unitId}/`) || path.includes("..")) return { ok: false, error: "Invalid photo path" };

  const supabase = createServiceClient();
  const folder = unitId;
  const fileName = path.slice(unitId.length + 1);
  const { data: found } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, search: fileName });
  if (!found?.some((f: { name: string }) => f.name === fileName)) {
    return { ok: false, error: "The photo didn't finish uploading — please try again." };
  }

  const { data: unit } = await supabase.from("units").select("images").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "Residence not found" };
  const images = (unit.images ?? []) as string[];
  if (images.length >= MAX_PHOTOS) return { ok: false, error: `A residence can have up to ${MAX_PHOTOS} photos.` };

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;
  const next = [...images, publicUrl];
  const { error } = await supabase.from("units").update({ images: next }).eq("id", unitId);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.photo_added", "unit", unitId, { path });
  refreshUnitPages(unitId);
  return { ok: true, images: next };
}

export async function removeUnitImage(unitId: string, url: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();

  const { data: unit } = await supabase.from("units").select("images").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "Residence not found" };

  const next = ((unit.images ?? []) as string[]).filter((u) => u !== url);
  const { error } = await supabase.from("units").update({ images: next }).eq("id", unitId);
  if (error) return { ok: false, error: error.message };

  const path = bucketPathFromUrl(url);
  if (path) await supabase.storage.from(BUCKET).remove([path]); // seed/placeholder URLs aren't ours to delete

  await logAudit("unit.photo_removed", "unit", unitId, { url });
  refreshUnitPages(unitId);
  return { ok: true, images: next };
}

// The first photo is the "main" one shown on cards, so this just moves one to the front.
export async function setPrimaryUnitImage(unitId: string, url: string) {
  if (!(await isStaff())) return UNAUTHORIZED;
  const supabase = createServiceClient();

  const { data: unit } = await supabase.from("units").select("images").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "Residence not found" };

  const images = (unit.images ?? []) as string[];
  if (!images.includes(url)) return { ok: false, error: "Photo not found" };
  const next = [url, ...images.filter((u) => u !== url)];

  const { error } = await supabase.from("units").update({ images: next }).eq("id", unitId);
  if (error) return { ok: false, error: error.message };

  await logAudit("unit.photo_primary_set", "unit", unitId, { url });
  refreshUnitPages(unitId);
  return { ok: true, images: next };
}
