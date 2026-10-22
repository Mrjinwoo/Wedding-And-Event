"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Venue = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  price: number;
  image_url: string | null;
  is_active: boolean;
  review_status: "pending_review" | "approved" | "rejected";
  description: string | null;
};

type VenueForm = Pick<Venue, "name" | "location" | "capacity" | "price" | "image_url" | "description" | "is_active">;

const EMPTY: VenueForm = {
  name: "", location: "", capacity: 0, price: 0,
  image_url: "", description: "", is_active: true,
};

export default function AdminVenuesPage() {
  const [venues, setVenues]     = useState<Venue[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [form, setForm]         = useState<VenueForm>(EMPTY);
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState("");
  const [notice, setNotice]     = useState("");
  const [canReview, setCanReview] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewing, setReviewing] = useState<string | null>(null);

  // Image upload state
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVenues = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({ management: "1", limit: "1000", page: "1" });
    if (search) query.set("search", search);
    const params = `?${query.toString()}`;
    try {
      const res  = await fetch(`/api/venues${params}`);
      const json = await res.json();
      setVenues(json.data ?? []);
      setCanReview(Boolean(json.canReview));
      if (!res.ok) setError(json.error ?? "Could not load venues.");
      else setError("");
    } catch {
      setError("Could not load venues. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadVenues(); }, [loadVenues]);

  function openCreate() {
    setForm(EMPTY);
    setEditId(null);
    setImageFile(null);
    setImagePreview("");
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function openEdit(v: Venue) {
    setForm({
      name: v.name, location: v.location, capacity: v.capacity,
      price: v.price, image_url: v.image_url ?? "",
      description: v.description ?? "", is_active: v.is_active,
    });
    setEditId(v.id);
    setImageFile(null);
    setImagePreview(v.image_url ?? "");
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate type and size (max 5 MB)
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }

  async function uploadImage(file: File): Promise<string | null> {
    const supabase = createClient();
    const ext      = file.name.split(".").pop() ?? "jpg";
    const path     = `venues/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("venues")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      return null;
    }

    const { data } = supabase.storage.from("venues").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveVenue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    let imageUrl = form.image_url;

    // Upload new image if one was selected
    if (imageFile) {
      setUploading(true);
      const uploaded = await uploadImage(imageFile);
      setUploading(false);
      if (!uploaded) { setSaving(false); return; }
      imageUrl = uploaded;
    }

    const payload = {
      ...(editId ? { id: editId } : {}),
      name:        form.name,
      location:    form.location,
      description: form.description,
      capacity:    form.capacity,
      price:       form.price,
      imageUrl:    imageUrl,
      ...(canReview ? { isActive: form.is_active } : {}),
    };

    const res  = await fetch("/api/venues", {
      method:  editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Failed to save venue.");
    } else {
      setShowForm(false);
      setImageFile(null);
      setImagePreview("");
      setNotice(editId && !canReview
        ? "Venue changes saved as a draft for admin review."
        : !canReview
          ? "Venue created as a draft. An admin must approve it before customers can see it."
          : "Venue saved.");
      loadVenues();
    }
    setSaving(false);
  }

  async function deactivateVenue(id: string) {
    if (!confirm("Deactivate this venue? It will no longer appear to clients.")) return;
    try {
      const response = await fetch(`/api/venues?id=${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not deactivate venue.");
      setNotice("Venue deactivated.");
      await loadVenues();
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : "Could not deactivate venue.");
    }
  }

  async function reviewVenue(id: string, reviewStatus: "approved" | "rejected") {
    setReviewing(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/venues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update venue review status.");
      setNotice(reviewStatus === "approved" ? "Venue approved and published." : "Venue returned to staff for changes.");
      await loadVenues();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not update venue review status.");
    } finally {
      setReviewing(null);
    }
  }

  const visibleVenues = venues.filter(venue => reviewFilter === "all" || venue.review_status === reviewFilter);

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      {/* Header */}
      <div className="bg-[#1a1a1a] py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-white/60 text-sm hover:text-white">← Admin</Link>
            <h1 className="text-white font-display text-2xl font-bold mt-1">Venue Management</h1>
          </div>
          <button onClick={openCreate}
            className="bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            + Add Venue
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search venues…"
          className="mb-6 w-full max-w-sm px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />

        {notice && <div role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
        {error && !showForm && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All venues" },
            { id: "pending_review", label: "Needs review" },
            { id: "approved", label: "Published" },
            { id: "rejected", label: "Returned" },
          ].map(filter => (
            <button key={filter.id} type="button" onClick={() => setReviewFilter(filter.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${reviewFilter === filter.id ? "bg-[#1a1a1a] text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-[#9B2C4A]"}`}>
              {filter.label}{filter.id === "pending_review" ? ` (${venues.filter(venue => venue.review_status === "pending_review").length})` : ""}
            </button>
          ))}
        </div>

        {/* ── Add / Edit Modal ── */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-display font-semibold text-[#1a1a1a]">
                  {editId ? "Edit Venue" : "Add New Venue"}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <form onSubmit={saveVenue} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Venue Name *</label>
                  <input type="text" required value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location *</label>
                  <input type="text" required value={form.location}
                    onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea rows={3} value={form.description ?? ""}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] resize-none" />
                </div>

                {/* Capacity + Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Capacity *</label>
                    <input type="number" required min={1} value={form.capacity}
                      onChange={e => setForm(p => ({ ...p, capacity: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price (₱) *</label>
                    <input type="number" required min={0} value={form.price}
                      onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </div>
                </div>

                {/* Image upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Venue Image</label>

                  {/* Preview */}
                  {imagePreview && (
                    <div className="relative w-full h-40 rounded-xl overflow-hidden mb-3 bg-gray-100">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        fill
                        sizes="400px"
                        className="object-cover"
                        unoptimized={imagePreview.startsWith("blob:")}
                      />
                      <button
                        type="button"
                        onClick={() => { setImagePreview(""); setImageFile(null); setForm(p => ({ ...p, image_url: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-full transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Upload button */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 hover:border-[#9B2C4A] rounded-xl p-5 text-center cursor-pointer transition-colors group"
                  >
                    <svg className="w-8 h-8 mx-auto text-gray-300 group-hover:text-[#9B2C4A] mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-400 group-hover:text-[#9B2C4A] transition-colors">
                      {imageFile ? imageFile.name : "Click to upload a photo"}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-1">JPG, PNG, WEBP — max 5 MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Manual URL fallback */}
                  <div className="mt-3">
                    <label className="block text-[10px] text-gray-400 mb-1">Or paste an image URL</label>
                    <input type="url" value={form.image_url ?? ""}
                      placeholder="https://… or /public-path.jpg"
                      onChange={e => {
                        setForm(p => ({ ...p, image_url: e.target.value }));
                        if (e.target.value) { setImagePreview(e.target.value); setImageFile(null); }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </div>
                </div>

                {canReview ? (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                      className="accent-[#9B2C4A] w-4 h-4" />
                    Active (visible to clients after approval)
                  </label>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                    This listing will be saved as a draft. An admin must approve it before customers can see or book it.
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || uploading}
                    className="flex-1 py-2.5 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {(saving || uploading) && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                    )}
                    {uploading ? "Uploading…" : saving ? "Saving…" : editId ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Venue Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : visibleVenues.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm mb-4">{venues.length ? "No venues in this review status." : "No venues yet."}</p>
            {!venues.length && <button onClick={openCreate}
              className="bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
              + Add Your First Venue
            </button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleVenues.map(v => (
              <div key={v.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${v.review_status !== "approved" || !v.is_active ? "border-amber-200" : "border-gray-100"}`}>
                <div className="relative h-44 bg-gray-100">
                  {v.image_url ? (
                    <Image src={v.image_url} alt={v.name} fill sizes="33vw" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🏛️</div>
                  )}
                  <span className={`absolute top-2 right-2 text-[10px] font-bold px-2.5 py-1 rounded-full ${v.review_status === "pending_review" ? "bg-amber-100 text-amber-800" : v.review_status === "rejected" ? "bg-red-100 text-red-700" : v.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                    {v.review_status === "pending_review" ? "Needs review" : v.review_status === "rejected" ? "Returned" : v.is_active ? "Published" : "Inactive"}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-display font-semibold text-[#1a1a1a] text-sm">{v.name}</h3>
                    <span className="text-sm font-bold text-[#9B2C4A] flex-shrink-0">
                      ₱{Number(v.price).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{v.location}</p>
                  <p className="text-xs text-gray-400 mb-3">👥 {v.capacity} guests</p>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(v)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#9B2C4A] hover:text-[#9B2C4A] transition-colors">
                      Edit
                    </button>
                    {canReview && v.review_status !== "approved" && (
                      <>
                        <button onClick={() => void reviewVenue(v.id, "approved")} disabled={reviewing === v.id}
                          className="flex-1 py-2 rounded-lg bg-green-700 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                          {reviewing === v.id ? "Saving…" : "Approve & publish"}
                        </button>
                        {v.review_status === "pending_review" && <button onClick={() => void reviewVenue(v.id, "rejected")} disabled={reviewing === v.id}
                          className="py-2 px-3 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Return</button>}
                      </>
                    )}
                    {canReview && v.review_status === "approved" && v.is_active && (
                      <button onClick={() => deactivateVenue(v.id)}
                        className="flex-1 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
