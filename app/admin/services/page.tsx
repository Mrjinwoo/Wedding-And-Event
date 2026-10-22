"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Service = {
  id: string;
  icon: string;
  title: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

const EMPTY: Omit<Service, "id"> = { icon: "🎉", title: "", description: "", is_active: true, sort_order: 0 };

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState<Omit<Service, "id">>(EMPTY);
  const [editId, setEditId]     = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("sort_order");
    setServices(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY);
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setForm({ icon: s.icon, title: s.title, description: s.description, is_active: s.is_active, sort_order: s.sort_order });
    setEditId(s.id);
    setError("");
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { error: err } = editId
      ? await supabase.from("services").update(form).eq("id", editId)
      : await supabase.from("services").insert(form);
    if (err) setError(err.message);
    else { setShowForm(false); load(); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this service?")) return;
    await supabase.from("services").delete().eq("id", id);
    load();
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <div className="bg-[#1a1a1a] py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-white/60 text-sm hover:text-white">← Admin</Link>
            <h1 className="text-white font-display text-2xl font-bold mt-1">Services</h1>
          </div>
          <button onClick={openCreate}
            className="bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            + Add Service
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-display font-semibold text-[#1a1a1a]">{editId ? "Edit Service" : "Add Service"}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={save} className="p-6 space-y-4">
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Icon (emoji)</label>
                    <input required value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                    <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                  <textarea required rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] resize-none" />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    className="accent-[#9B2C4A] w-4 h-4" />
                  Active (visible to clients)
                </label>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold transition-colors disabled:opacity-60">
                    {saving ? "Saving…" : editId ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm mb-4">No services yet.</p>
            <button onClick={openCreate} className="bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
              + Add First Service
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {services.map(s => (
              <div key={s.id} className={`bg-white rounded-2xl p-5 shadow-sm border flex gap-4 items-start ${!s.is_active ? "opacity-60 border-gray-200" : "border-gray-100"}`}>
                <span className="text-3xl flex-shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-display font-semibold text-[#1a1a1a] text-sm">{s.title}</p>
                    {!s.is_active && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{s.description}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#9B2C4A] hover:text-[#9B2C4A] transition-colors">
                    Edit
                  </button>
                  <button onClick={() => remove(s.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
