"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12 bg-[#F5E6EA]">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full overflow-hidden mb-4 shadow-md">
              <Image src="/logo.png" alt="Logo" width={80} height={80} className="w-full h-full object-cover" />
            </div>
            <h1 className="font-display text-xl font-bold tracking-widest uppercase text-[#1a1a1a]">Event Venue</h1>
            <p className="font-script text-sm italic text-gray-500 mt-0.5">Make Every Moment Magical</p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="font-display text-2xl font-bold text-[#1a1a1a] mb-2">Check Your Email</h2>
              <p className="text-sm text-gray-500 mb-6">We sent a password reset link to <span className="font-semibold text-[#9B2C4A]">{email}</span>. Check your spam folder if you don&apos;t see it.</p>
              <Link href="/login" className="block w-full py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-semibold text-center transition-colors">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Forgot Password</h2>
                <p className="text-xs text-gray-500 mt-1">Enter your email and we&apos;ll send you a reset link.</p>
              </div>

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Email Address</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉</span>
                    <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] placeholder-gray-400" />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] disabled:opacity-60 text-white font-display text-lg font-semibold tracking-wide transition-colors">
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 mt-6">
                Remember your password? <Link href="/login" className="font-medium text-[#9B2C4A] hover:underline">Log In</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        <Image src="/wed.jpg" alt="Wedding venue" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        <div className="absolute bottom-16 left-0 right-0 text-center px-10">
          <span className="text-white text-4xl opacity-60">&ldquo;</span>
          <p className="text-white text-xl font-light leading-relaxed mt-1">We don&apos;t just<br />find venues,</p>
          <p className="font-script text-white text-2xl italic mt-1">we create memories.</p>
          <div className="mt-4 text-white opacity-70">♥</div>
        </div>
      </div>
    </div>
  );
}
