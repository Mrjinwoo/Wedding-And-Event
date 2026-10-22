"use client";

import { useCallback, useEffect, useState } from "react";

type VenuePackage = {
  id: string;
  name: string;
  price: number;
  guest_capacity: number | null;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
};

type PackageForm = Omit<VenuePackage, "id">;

const EMPTY_FORM: PackageForm = {
  name: "",
  price: 0,
  guest_capacity: null,
  features: [],
  is_popular: false,
  is_active: true,
  sort_order: 0,
};

export default function PackagesManager() {
  const [packages, setPackages] = useState<VenuePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [featuresText, setFeaturesText] = useState("");
  const [error, setError] = useState("");

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/packages");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load packages.");
      setPackages(result.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load packages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPackages(); }, [loadPackages]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeaturesText("");
    setError("");
    setFormOpen(true);
  }

  function startEdit(item: VenuePackage) {
    const { id, ...values } = item;
    setEditingId(id);
    setForm(values);
    setFeaturesText(values.features.join("\n"));
    setError("");
    setFormOpen(true);
  }

  async function savePackage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      features: featuresText.split("\n").map(feature => feature.trim()).filter(Boolean),
    };

    try {
      const response = await fetch("/api/admin/packages", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save package.");
      setFormOpen(false);
      await loadPackages();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save package.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item: VenuePackage) {
    setError("");
    try {
      const response = await fetch("/api/admin/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, is_active: !item.is_active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update package availability.");
      await loadPackages();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update package availability.");
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <header className="bg-[#1a1a1a] px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Package Management</h1>
            <p className="mt-1 text-sm text-white/60">Manage package prices, guest limits, features, and availability.</p>
          </div>
          <button type="button" onClick={startCreate} className="shrink-0 rounded-lg bg-[#9B2C4A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7A1F38]">+ Add package</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && !formOpen && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="package-form-title" className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <h2 id="package-form-title" className="font-display text-lg font-semibold text-gray-900">{editingId ? "Edit package" : "Create package"}</h2>
                <button type="button" onClick={() => setFormOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={savePackage} className="space-y-4 p-6">
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-medium text-gray-600">Package name
                    <input required minLength={2} maxLength={100} value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Price (₱)
                    <input required type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(current => ({ ...current, price: Number(e.target.value) }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Guest capacity <span className="font-normal text-gray-400">(optional)</span>
                    <input type="number" min={1} step={1} value={form.guest_capacity ?? ""} onChange={e => setForm(current => ({ ...current, guest_capacity: e.target.value ? Number(e.target.value) : null }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Display order
                    <input type="number" min={0} step={1} value={form.sort_order} onChange={e => setForm(current => ({ ...current, sort_order: Number(e.target.value) }))} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </label>
                </div>

                <label className="block text-xs font-medium text-gray-600">Features <span className="font-normal text-gray-400">(one per line)</span>
                  <textarea rows={6} maxLength={5000} value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder={"Venue setup\nEvent coordinator\nSound system"} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                </label>

                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.is_popular} onChange={e => setForm(current => ({ ...current, is_popular: e.target.checked }))} className="h-4 w-4 accent-[#9B2C4A]" />
                    Mark as popular
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(current => ({ ...current, is_active: e.target.checked }))} className="h-4 w-4 accent-[#9B2C4A]" />
                    Available to customers
                  </label>
                </div>

                <div className="flex gap-3 border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => setFormOpen(false)} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#9B2C4A] py-2.5 text-sm font-semibold text-white hover:bg-[#7A1F38] disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save changes" : "Create package"}</button>
                </div>
              </form>
            </section>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(item => <div key={item} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}</div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
            <p className="mb-4 text-sm text-gray-400">No packages yet.</p>
            <button type="button" onClick={startCreate} className="rounded-lg bg-[#9B2C4A] px-5 py-2.5 text-sm font-semibold text-white">Create your first package</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {packages.map(item => (
              <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${item.is_active ? "border-gray-100" : "border-gray-200 opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold text-gray-900">{item.name}</h2>
                      {item.is_popular && <span className="rounded-full bg-[#F5E6EA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9B2C4A]">Popular</span>}
                      {!item.is_active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Unavailable</span>}
                    </div>
                    <p className="mt-1 text-2xl font-bold text-[#9B2C4A]">₱{Number(item.price).toLocaleString()}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.guest_capacity ? `Up to ${item.guest_capacity} guests` : "No package guest limit"} · Order {item.sort_order}</p>
                  </div>
                  <button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-[#9B2C4A] hover:text-[#9B2C4A]">Edit</button>
                </div>
                <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-sm text-gray-600">
                  {item.features.length ? item.features.map((feature, index) => <li key={`${index}-${feature}`} className="flex gap-2"><span className="text-green-600">✓</span>{feature}</li>) : <li className="text-xs text-gray-400">No features listed.</li>}
                </ul>
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <button type="button" onClick={() => void toggleAvailability(item)} className={`text-xs font-semibold hover:underline ${item.is_active ? "text-red-600" : "text-green-700"}`}>
                    {item.is_active ? "Make unavailable to customers" : "Make available to customers"}
                  </button>
                  <p className="mt-1 text-[11px] text-gray-400">Past bookings keep their recorded total when a package is edited or hidden.</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
