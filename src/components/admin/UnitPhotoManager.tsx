"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { asResult } from "@/lib/action-result";
import { prepareImage } from "@/lib/image-prepare";
import {
  createUnitImageUpload, registerUnitImage, removeUnitImage, setPrimaryUnitImage,
} from "@/app/admin/units/actions";

const BUCKET = "unit-images";
const MAX_PHOTOS = 12;

export function UnitPhotoManager({ unitId, images: initialImages }: { unitId: string; images: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>(initialImages);
  const [progress, setProgress] = useState<string | null>(null);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const supabase = createClient();
    let uploaded = 0;

    for (let i = 0; i < list.length; i++) {
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const blob = await prepareImage(list[i]);
        const slot = asResult<{ path: string; token: string }>(await createUnitImageUpload(unitId, blob.type));
        if (!slot.ok || !slot.path || !slot.token) throw new Error(slot.error ?? "Could not start the upload");

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(slot.path, slot.token, blob, { contentType: blob.type });
        if (uploadError) throw new Error(uploadError.message);

        const saved = asResult<{ images: string[] }>(await registerUnitImage(unitId, slot.path));
        if (!saved.ok || !saved.images) throw new Error(saved.error ?? "Could not save the photo");
        setImages(saved.images);
        uploaded++;
      } catch (err: any) {
        toast.error(err.message ?? "Upload failed");
        break; // don't keep hammering after a failure (e.g. photo limit reached)
      }
    }

    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (uploaded > 0) {
      toast.success(`${uploaded} photo${uploaded === 1 ? "" : "s"} added`);
      router.refresh();
    }
  }

  // Both handlers catch failures: a dropped connection or a server error must show a
  // message, never leave the button looking dead.
  async function makeMain(url: string) {
    setBusyUrl(url);
    try {
      const result = asResult<{ images: string[] }>(await setPrimaryUnitImage(unitId, url));
      if (!result.ok || !result.images) {
        toast.error(result.error ?? "Could not update the main photo");
        return;
      }
      setImages(result.images);
      toast.success("Main photo updated — it now shows on the cards and the residence page");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyUrl(null);
    }
  }

  async function remove(url: string) {
    if (!window.confirm("Remove this photo?")) return;
    setBusyUrl(url);
    try {
      const result = asResult<{ images: string[] }>(await removeUnitImage(unitId, url));
      if (!result.ok || !result.images) {
        toast.error(result.error ?? "Could not remove the photo");
        return;
      }
      setImages(result.images);
      toast.success("Photo removed");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyUrl(null);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Photos</h2>
          <p className="mt-1 text-xs text-navy/50">
            {images.length} of {MAX_PHOTOS}. The first photo is the main one shown on cards.
          </p>
        </div>
        <label className={`btn-primary cursor-pointer px-5 py-2.5 text-sm ${progress || images.length >= MAX_PHOTOS ? "pointer-events-none opacity-50" : ""}`}>
          <Upload size={15} className="mr-2" />
          {progress ?? "Add photos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="sr-only"
            disabled={Boolean(progress) || images.length >= MAX_PHOTOS}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>

      {images.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-navy/20 p-8 text-center text-sm text-navy/50">
          No photos yet. Cards currently show a placeholder image.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((url: string, i: number) => (
            <div key={url} className="overflow-hidden rounded-lg border border-navy/10">
              <div className="relative aspect-[4/3] bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-champagne px-2.5 py-0.5 text-[11px] text-navy">Main</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                {i === 0 ? (
                  <span className="px-2 text-xs text-navy/40">Main photo</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeMain(url)}
                    disabled={busyUrl === url}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-navy/70 hover:bg-sand"
                  >
                    <Star size={13} /> Make main
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(url)}
                  disabled={busyUrl === url}
                  aria-label="Remove photo"
                  className="rounded p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
