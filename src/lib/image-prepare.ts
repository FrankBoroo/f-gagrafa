// Shrinks a photo in the browser before upload (max 1920px, JPEG): a 5 MB phone photo
// becomes a few hundred KB, which matters on mobile networks and for page speed.
// Client-side only (uses the canvas), shared by the unit photo and Tour uploaders.
export async function prepareImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      if (blob) return blob;
    }
  } catch {
    // fall through to the original file
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`"${file.name}" isn't a JPG, PNG or WebP photo.`);
  }
  if (file.size > 8 * 1024 * 1024) throw new Error(`"${file.name}" is larger than 8 MB.`);
  return file;
}
