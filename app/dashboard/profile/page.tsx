"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Profile = { full_name: string; phone: string | null; role: string; created_at: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setForm({ full_name: data.full_name, phone: data.phone ?? "" });
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("profiles")
      .update({ full_name: form.full_name, phone: form.phone || null })
      .eq("id", user.id);
    if (err) setError(err.message);
    else { setSuccess("Profile updated successfully!"); setProfile(p => p ? {...p, ...form} : p); }
    setSaving(false);
  }

  if (loading) return <div className="min-h-screen bg-[#FAF7F5] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#9B2C4A] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <div className="bg-[#9B2C4A] py-8 px-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/dashboard" className="text-white/70 text-sm hover:text-white">← Dashboard</Link>
          <h1 className="text-white font-display text-2xl font-bold mt-1">My Profile</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100">
            <div className="w-16 h-16 rounded-full bg-[#F5E6EA] flex items-center justify-center text-3xl">👤</div>
            <div>
              <p className="font-display font-semibold text-[#1a1a1a] text-lg">{profile?.full_name}</p>
              <p className="text-sm text-gray-500">{email}</p>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 inline-block ${profile?.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                {profile?.role}
              </span>
            </div>
          </div>

          {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">✓ {success}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))} required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input value={email} disabled className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="09171234567"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Member Since</label>
              <input value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ""} disabled
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-semibold transition-colors disabled:opacity-60">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <Link href="/forgot-password"
                className="flex-1 py-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:border-[#9B2C4A] hover:text-[#9B2C4A] text-center transition-colors">
                Change Password
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
