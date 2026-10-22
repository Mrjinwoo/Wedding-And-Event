"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Profile = {
  id: string; full_name: string; phone: string | null;
  role: string; is_active: boolean; created_at: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const mfaRedirecting = useRef(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const goToMfa = useCallback(async () => {
    if (mfaRedirecting.current) return;
    mfaRedirecting.current = true;
    const next = "/admin/users";
    try {
      const response = await fetch("/api/auth/mfa/status");
      const status = await response.json();
      const destination = response.ok && status.enrolled
        ? `/admin/mfa/challenge?next=${encodeURIComponent(next)}`
        : next;
      router.replace(destination);
    } catch {
      mfaRedirecting.current = false;
      setError("Could not check MFA. Refresh the page and try again.");
    }
  }, [router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    const res = await fetch(`/api/admin/users?${params}`);
    const json = await res.json();
    if (res.status === 403 && json.error === "AAL2 required") {
      await goToMfa();
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Could not load users.");
      setLoading(false);
      return;
    }
    setError("");
    setUsers(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, search, role, goToMfa]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function updateUser(userId: string, updates: Record<string, unknown>) {
    setUpdating(userId); setError(""); setNotice("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...updates }),
    });
    const json = await res.json();
    if (res.status === 403 && json.error === "AAL2 required") await goToMfa();
    else if (!res.ok) setError(json.error);
    else loadUsers();
    setUpdating(null);
  }

  async function inviteStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: inviteName, email: inviteEmail }),
      });
      const result = await response.json();
      if (response.status === 403 && result.error === "AAL2 required") {
        await goToMfa();
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Could not send the staff invitation.");
      setNotice(result.message);
      setInviteName(""); setInviteEmail(""); setShowInvite(false);
      await loadUsers();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Could not send the staff invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function resendInvite(userId: string) {
    setResending(userId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/users/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (response.status === 403 && result.error === "AAL2 required") {
        await goToMfa();
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Could not resend the staff invitation.");
      setNotice(result.message ?? "A new invitation was sent.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not resend the staff invitation.");
    } finally {
      setResending(null);
    }
  }

  const totalPages = Math.ceil(total / 10);

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <div className="bg-[#1a1a1a] py-6 px-6">
        <div className="max-w-6xl mx-auto">
          <Link href="/admin" className="text-white/60 text-sm hover:text-white">← Admin</Link>
          <h1 className="text-white font-display text-2xl font-bold mt-1">User Management</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name…"
            className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
          <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]">
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="client">Client</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button type="button" onClick={() => { setShowInvite(value => !value); setError(""); }}
            className="rounded-lg bg-[#9B2C4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7A1F38]">
            + Add staff
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}

        {showInvite && (
          <form onSubmit={inviteStaff} className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs font-semibold text-gray-600">Staff member name
              <input required minLength={2} maxLength={100} value={inviteName} onChange={event => setInviteName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
            </label>
            <label className="text-xs font-semibold text-gray-600">Email address
              <input required type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
            </label>
            <button type="submit" disabled={inviting} className="rounded-lg bg-[#9B2C4A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {inviting ? "Sending invite…" : "Send invite"}
            </button>
            <p className="text-xs text-gray-500 sm:col-span-3">We’ll email them a secure link to set their password. They’ll be added with the Staff role.</p>
          </form>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Phone</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({length:5}).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No users found.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[#1a1a1a]">{u.full_name}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{u.phone ?? "—"}</td>
                  <td className="px-5 py-3">
                    <select value={u.role} onChange={e => updateUser(u.id, { role: e.target.value })}
                      disabled={updating === u.id}
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#9B2C4A]">
                      <option value="user">user</option>
                      <option value="client">client</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => updateUser(u.id, { isActive: !u.is_active })} disabled={updating === u.id}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${u.is_active ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600" : "bg-red-100 text-red-600 hover:bg-green-100 hover:text-green-700"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs hidden lg:table-cell">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {u.role === "staff" && u.is_active && (
                        <button onClick={() => resendInvite(u.id)} disabled={resending === u.id || updating === u.id}
                          className="text-xs font-semibold text-[#9B2C4A] hover:underline disabled:opacity-50">
                          {resending === u.id ? "Sending…" : "Resend invite / setup link"}
                        </button>
                      )}
                      <button onClick={() => updateUser(u.id, { isActive: false })} disabled={updating === u.id || resending === u.id}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50">
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#9B2C4A] disabled:opacity-40">← Prev</button>
            <span className="px-4 py-2 text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#9B2C4A] disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </main>
  );
}
