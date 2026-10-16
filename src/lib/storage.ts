import "server-only";

// Small helpers for public image buckets in Supabase Storage (used by the Tour gallery;
// the unit photo actions keep their own equivalent copies).

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Creates the bucket on first use so there's no manual Supabase setup step.
export async function ensurePublicBucket(supabase: any, bucket: string): Promise<void> {
  const { data } = await supabase.storage.getBucket(bucket);
  if (data) return;
  await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: Object.keys(IMAGE_TYPES),
  });
}

// Public URL -> path inside the bucket (null for any URL that isn't ours).
export function pathInBucket(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}
