"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not set your password.");
      setDone(true);
      window.setTimeout(() => router.replace("/login"), 1800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not set your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5E6EA] px-6 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-7 flex flex-col items-center">
          <div className="mb-3 h-16 w-16 overflow-hidden rounded-full shadow">
            <Image src="/logo.png" alt="Wedding and Event Venue" width={64} height={64} className="h-full w-full object-cover" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900">Set your password</h1>
          <p className="mt-1 text-center text-sm text-gray-500">Create a password to finish setting up your staff account.</p>
        </div>
        {done ? (
          <p role="status" className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">Password created. Redirecting you to log in…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <label className="block text-sm font-medium text-gray-700">New password
              <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#9B2C4A] focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]/20" />
            </label>
            <label className="block text-sm font-medium text-gray-700">Confirm password
              <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-[#9B2C4A] focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]/20" />
            </label>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#9B2C4A] px-4 py-3 font-semibold text-white hover:bg-[#7A1F38] disabled:opacity-50">
              {loading ? "Saving…" : "Set password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
