"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { asResult } from "@/lib/action-result";
import { prepareImage } from "@/lib/image-prepare";
import {
  createGalleryUpload, registerGalleryItem, updateGalleryItem, moveGalleryItem, deleteGalleryItem,
} from "@/app/admin/tour/actions";

export type GalleryCategory = "property" | "neighbourhood";

export interface GalleryRow {
  id: string;
  category: GalleryCategory;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

const BUCKET = "gallery-images";
const SECTIONS: { key: GalleryCategory; title: string; hint: string }[] = [
  { key: "property", title: "The property", hint: "Pool, gym, lounge, lobby, parking, the building itself." },
  { key: "neighbourhood", title: "The neighbourhood", hint: "Restaurants, shops, the area around Spintex and Community 20." },
];

export function TourManager({ initialItems }: { initialItems: GalleryRow[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<GalleryRow[]>(initialItems);
  const [category, setCategory] = useState<GalleryCategory>("property");
  const [progress, setProgress] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialItems.map((i: GalleryRow) => [i.id, i.caption ?? ""]))
  );

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    const supabase = createClient();
    let added = 0;

    for (let i = 0; i < list.length; i++) {
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const blob = await prepareImage(list[i]);
        const slot = asResult<{ path: string; token: string }>(await createGalleryUpload(blob.type));
        if (!slot.ok || !slot.path || !slot.token) throw new Error(slot.error ?? "Could not start the upload");

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(slot.path, slot.token, blob, { contentType: blob.type });
        if (uploadError) throw new Error(uploadError.message);

        const saved = asResult<{ item: GalleryRow }>(await registerGalleryItem(slot.path, category));
        if (!saved.ok || !saved.item) throw new Error(saved.error ?? "Could not save the photo");
        const item = saved.item;
        setItems((prev: GalleryRow[]) => [...prev, item]);
        setCaptions((prev: Record<string, string>) => ({ ...prev, [item.id]: "" }));
        added++;
      } catch (err: any) {
        toast.error(err.message ?? "Upload failed");
        break; // stop on the first failure (e.g. gallery full, or the table is missing)
      }
    }

    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (added > 0) {
      toast.success(`${added} photo${added === 1 ? "" : "s"} added — add captions below`);
      router.refresh();
    }
  }

  async function saveCaption(item: GalleryRow) {
    const next = (captions[item.id] ?? "").trim();
    if (next === (item.caption ?? "")) return; // nothing changed
    setBusyId(item.id);
    try {
      const result = asResult<{ item: GalleryRow }>(await updateGalleryItem(item.id, next, item.category));
      if (!result.ok || !result.item) {
        toast.error(result.error ?? "Could not save the caption");
        return;
      }
      const saved = result.item;
      setItems((prev: GalleryRow[]) => prev.map((i: GalleryRow) => (i.id === saved.id ? saved : i)));
      toast.success("Caption saved");
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeSection(item: GalleryRow, next: GalleryCategory) {
    setBusyId(item.id);
    try {
      const result = asResult<{ item: GalleryRow }>(await updateGalleryItem(item.id, captions[item.id] ?? "", next));
      if (!result.ok || !result.item) {
        toast.error(result.error ?? "Could not move the photo");
        return;
      }
      const saved = result.item;
      setItems((prev: GalleryRow[]) => prev.map((i: GalleryRow) => (i.id === saved.id ? saved : i)));
      toast.success("Photo moved");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function move(item: GalleryRow, direction: "up" | "down") {
    setBusyId(item.id);
    try {
      const result = asResult(await moveGalleryItem(item.id, direction));
      if (!result.ok) {
        toast.error(result.error ?? "Could not reorder");
        return;
      }
      // Mirror the swap locally (the server did the same within this section).
      setItems((prev: GalleryRow[]) => {
        const sameSection = prev.filter((i: GalleryRow) => i.category === item.category);
        const at = sameSection.findIndex((i: GalleryRow) => i.id === item.id);
        const other = sameSection[direction === "up" ? at - 1 : at + 1];
        if (!other) return prev;
        const next = [...prev];
        const a = next.findIndex((i: GalleryRow) => i.id === item.id);
        const b = next.findIndex((i: GalleryRow) => i.id === other.id);
        [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: GalleryRow) {
    if (!window.confirm("Remove this photo from the Tour page?")) return;
    setBusyId(item.id);
    try {
      const result = asResult(await deleteGalleryItem(item.id));
      if (!result.ok) {
        toast.error(result.error ?? "Could not remove the photo");
        return;
      }
      setItems((prev: GalleryRow[]) => prev.filter((i: GalleryRow) => i.id !== item.id));
      toast.success("Photo removed");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="card max-w-2xl p-6">
        <h2 className="text-lg">Add photos</h2>
        <p className="mt-1 text-sm text-navy/50">
          Choose where they go, then pick one or several photos. They're shrunk automatically before upload.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm text-navy/60" htmlFor="tour-section">Section</label>
            <select
              id="tour-section"
              value={category}
              onChange={(e) => setCategory(e.target.value as GalleryCategory)}
              className="mt-2 block rounded-lg border border-navy/15 px-4 py-3 text-sm"
            >
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>{s.title}</option>
              ))}
            </select>
          </div>
          <label className={`btn-primary cursor-pointer px-5 py-3 text-sm ${progress ? "pointer-events-none opacity-50" : ""}`}>
            <Upload size={15} className="mr-2" />
            {progress ?? "Add photos"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="sr-only"
              disabled={Boolean(progress)}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>
        <p className="mt-4 text-xs text-navy/50">
          Residence photos aren't managed here: they appear on the Tour page automatically from each
          residence under Units.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const sectionItems = items.filter((i: GalleryRow) => i.category === section.key);
        return (
          <section key={section.key}>
            <h2 className="text-xl">{section.title} <span className="text-sm text-navy/40">({sectionItems.length})</span></h2>
            <p className="mt-1 text-sm text-navy/50">{section.hint}</p>

            {sectionItems.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-navy/20 p-8 text-center text-sm text-navy/50">
                No photos in this section yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sectionItems.map((item: GalleryRow, position: number) => (
                  <div key={item.id} className="card overflow-hidden">
                    <div className="relative aspect-[4/3] bg-sand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt={item.caption ?? "Tour photo"} loading="lazy" className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-3 p-3">
                      <input
                        value={captions[item.id] ?? ""}
                        maxLength={200}
                        placeholder="Caption (optional)"
                        onChange={(e) => setCaptions((prev: Record<string, string>) => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={() => saveCaption(item)}
                        className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busyId === item.id || position === 0}
                            onClick={() => move(item, "up")}
                            aria-label="Move earlier"
                            className="rounded p-1.5 text-navy/60 hover:bg-sand disabled:opacity-30"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id || position === sectionItems.length - 1}
                            onClick={() => move(item, "down")}
                            aria-label="Move later"
                            className="rounded p-1.5 text-navy/60 hover:bg-sand disabled:opacity-30"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        <select
                          value={item.category}
                          disabled={busyId === item.id}
                          onChange={(e) => changeSection(item, e.target.value as GalleryCategory)}
                          aria-label="Section"
                          className="min-w-0 rounded border border-navy/15 bg-white px-2 py-1 text-xs"
                        >
                          {SECTIONS.map((s) => (
                            <option key={s.key} value={s.key}>{s.title}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => remove(item)}
                          aria-label="Remove photo"
                          className="rounded p-1.5 text-navy/40 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
