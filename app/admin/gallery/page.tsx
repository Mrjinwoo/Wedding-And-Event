"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GalleryPhoto } from "@/app/gallery/GalleryGrid";

type ManagedPhoto = GalleryPhoto & {
  storage_path: string | null;
  sort_order: number;
  is_active: boolean;
};

type Form = Pick<ManagedPhoto, "title" | "category" | "caption" | "sort_order" | "is_active">;
const EMPTY: Form = { title: "", category: "wedding", caption: "", sort_order: 0, is_active: true };
const CATEGORIES = ["wedding", "reception", "birthday", "corporate", "venue"] as const;

export default function AdminGalleryPage() {
  const [photos, setPhotos] = useState<ManagedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<ManagedPhoto | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/gallery?management=1", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load gallery photos.");
      setPhotos(result.data ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load gallery photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPhotos(); }, [loadPhotos]);

  function startNew() {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: photos.length + 1 });
    setFile(null);
    setPreview("");
    setError("");
    setNotice("");
  }

  function startEdit(photo: ManagedPhoto) {
    setEditing(photo);
    setForm({ title: photo.title, category: photo.category, caption: photo.caption, sort_order: photo.sort_order, is_active: photo.is_active });
    setFile(null);
    setPreview(photo.image_url);
    setError("");
    setNotice("");
  }

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (selected.size > 5 * 1024 * 1024) { setError("Images must be 5 MB or smaller."); return; }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError("");
  }

  async function savePhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !file) { setError("Choose a photo to upload."); return; }
    setSaving(true);
    setError("");
    try {
      let imageUrl = editing?.image_url ?? "";
      let storagePath = editing?.storage_path ?? null;
      if (file) {
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        storagePath = `events/${crypto.randomUUID()}.${extension}`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage.from("gallery").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        imageUrl = supabase.storage.from("gallery").getPublicUrl(storagePath).data.publicUrl;
      }

      const response = await fetch("/api/gallery", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image_url: imageUrl, storage_path: storagePath, ...(editing ? { id: editing.id } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save photo.");
      setNotice(editing ? "Gallery photo updated." : "Photo added to the gallery.");
      setEditing(null);
      setFile(null);
      setPreview("");
      setForm(EMPTY);
      await loadPhotos();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save photo.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePhoto(photo: ManagedPhoto) {
    if (!window.confirm(`Remove “${photo.title}” from the gallery?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/gallery?id=${encodeURIComponent(photo.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not remove photo.");
      setNotice("Photo removed from the gallery.");
      await loadPhotos();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove photo.");
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <header className="bg-[#1a1a1a] px-6 py-6 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-sm text-white/55">Workspace / Content</p><h1 className="mt-1 font-display text-2xl font-bold">Gallery Management</h1></div>
          <button type="button" onClick={startNew} className="rounded-lg bg-[#9B2C4A] px-5 py-2.5 text-sm font-semibold hover:bg-[#7A1F38]">+ Add Photo</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
        <section>
          {notice && <p role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
          {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mb-4 flex items-end justify-between"><div><h2 className="font-display text-xl font-semibold">Photos</h2><p className="mt-1 text-sm text-gray-500">Manage what visitors see in the public gallery.</p></div><span className="text-sm text-gray-500">{photos.length} total</span></div>
          {loading ? <p className="rounded-2xl bg-white p-8 text-sm text-gray-500">Loading photos…</p> : photos.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map(photo => (
                <article key={photo.id} className="overflow-hidden rounded-2xl border border-[#eee6e3] bg-white shadow-sm">
                  <div className="relative aspect-[4/3] bg-[#eee6e3]"><Image src={photo.image_url} alt={photo.title} fill unoptimized sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>
                  <div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-[#211D1E]">{photo.title}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${photo.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{photo.is_active ? "Visible" : "Hidden"}</span></div>
                    <p className="mt-1 text-xs capitalize text-gray-500">{photo.category} · order {photo.sort_order}</p>
                    <div className="mt-4 flex gap-3"><button type="button" onClick={() => startEdit(photo)} className="text-sm font-semibold text-[#9B2C4A] hover:underline">Edit details</button><button type="button" onClick={() => void deletePhoto(photo)} className="text-sm font-semibold text-gray-500 hover:text-red-600">Remove</button></div>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="rounded-2xl border border-dashed border-[#e4d5d9] bg-white p-12 text-center text-sm text-gray-500">No gallery photos yet. Add your first photo to get started.</div>}
        </section>

        <aside className="h-fit rounded-2xl border border-[#eee6e3] bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-display text-xl font-semibold">{editing ? "Edit photo details" : "Add a photo"}</h2>
          <p className="mt-1 text-sm text-gray-500">Use event photos you have permission to share. JPG, PNG, WebP, or GIF up to 5 MB.</p>
          <form onSubmit={savePhoto} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-gray-700">Photo {!editing && "*"}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => selectFile(event.target.files?.[0])} required={!editing}
                className="mt-1.5 block w-full rounded-lg border border-gray-200 p-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[#F5E6EA] file:px-3 file:py-2 file:font-semibold file:text-[#9B2C4A]" />
            </label>
            {preview && <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-gray-100"><Image src={preview} alt="Selected gallery preview" fill unoptimized sizes="380px" className="object-cover" /></div>}
            <label className="block text-sm font-medium text-gray-700">Title *<input required minLength={2} maxLength={120} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#9B2C4A]" /></label>
            <label className="block text-sm font-medium text-gray-700">Event type *<select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value as Form["category"] }))} className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-normal capitalize outline-none focus:border-[#9B2C4A]">{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="block text-sm font-medium text-gray-700">Caption<textarea maxLength={300} rows={3} value={form.caption} onChange={event => setForm(current => ({ ...current, caption: event.target.value }))} className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#9B2C4A]" /></label>
            <label className="block text-sm font-medium text-gray-700">Display order<input type="number" min={0} max={10000} value={form.sort_order} onChange={event => setForm(current => ({ ...current, sort_order: Number(event.target.value) }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-normal outline-none focus:border-[#9B2C4A]" /></label>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} className="accent-[#9B2C4A]" />Show in public gallery</label>
            <div className="flex gap-2"><button disabled={saving} type="submit" className="flex-1 rounded-lg bg-[#9B2C4A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7A1F38] disabled:opacity-60">{saving ? "Saving…" : editing ? "Save Changes" : "Upload Photo"}</button>
              {(editing || file) && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); setFile(null); setPreview(""); }} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600">Cancel</button>}</div>
          </form>
        </aside>
      </div>
    </main>
  );
}
