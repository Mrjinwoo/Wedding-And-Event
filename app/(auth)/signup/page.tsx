"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerSchema } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    fullName: "", email: "", phone: "",
    password: "", confirmPassword: "", agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setFieldErrors(prev => ({ ...prev, [name]: "" }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setFieldErrors({});

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed.error.issues.forEach((i: any) => { if (i.path[0]) errs[String(i.path[0])] = i.message; });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      // Redirect to OTP verification — Supabase sends the code to the email
      router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12 bg-[#F5E6EA] overflow-y-auto">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden mb-4 shadow-md">
              <Image src="/logo.png" alt="Event Venue Logo" width={80} height={80} className="w-full h-full object-cover" />
            </div>
            <h1 className="font-display text-xl font-bold tracking-widest uppercase text-[#1a1a1a]">Event Venue</h1>
            <p className="font-script text-sm italic text-gray-500 mt-0.5">Make Every Moment Magical</p>
          </div>

          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Create Account</h2>
            <p className="text-xs text-gray-500 mt-1">Sign up to get started</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Full Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">👤</span>
                <input type="text" name="fullName" placeholder="Enter your full name"
                  value={form.fullName} onChange={handleChange} required
                  className={`w-full pl-9 pr-4 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400 ${fieldErrors.fullName ? "border-red-400" : "border-gray-300"}`} />
              </div>
              {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Email Address</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉</span>
                <input type="email" name="email" placeholder="Enter your email"
                  value={form.email} onChange={handleChange} required
                  className={`w-full pl-9 pr-4 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400 ${fieldErrors.email ? "border-red-400" : "border-gray-300"}`} />
              </div>
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                Phone Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📞</span>
                <input type="tel" name="phone" placeholder="09171234567"
                  value={form.phone} onChange={handleChange}
                  className={`w-full pl-9 pr-4 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400 ${fieldErrors.phone ? "border-red-400" : "border-gray-300"}`} />
              </div>
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input type={showPassword ? "text" : "password"} name="password" placeholder="Create a password"
                  value={form.password} onChange={handleChange} required
                  className={`w-full pl-9 pr-10 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400 ${fieldErrors.password ? "border-red-400" : "border-gray-300"}`} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password
                ? <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
                : <p className="text-[11px] text-gray-400 mt-1">Min 8 chars · 1 uppercase · 1 number · 1 special character</p>
              }
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Confirm Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input type={showConfirm ? "text" : "password"} name="confirmPassword" placeholder="Confirm your password"
                  value={form.confirmPassword} onChange={handleChange} required
                  className={`w-full pl-9 pr-10 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400 ${fieldErrors.confirmPassword ? "border-red-400" : "border-gray-300"}`} />
                <button type="button" onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}>
                  {showConfirm ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" name="agree" checked={form.agree} onChange={handleChange} required
                className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 accent-[#9B2C4A] flex-shrink-0" />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="text-[#9B2C4A] hover:underline">Terms of service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-[#9B2C4A] hover:underline">Privacy Policy</Link>
              </span>
            </label>

            <button type="submit" disabled={loading || !form.agree}
              className="w-full py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] disabled:opacity-60 text-white font-display text-lg font-semibold tracking-wide transition-colors shadow-sm">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Creating account…
                </span>
              ) : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#9B2C4A] hover:underline">Log In</Link>
          </p>

        </div>
      </div>

      {/* ── Right: image panel ── */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        <Image src="/wed.jpg" alt="Beautiful wedding venue" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        <div className="absolute bottom-16 left-0 right-0 text-center px-10">
          <span className="text-white text-4xl leading-none opacity-60">&ldquo;</span>
          <p className="text-white font-sans text-xl font-light leading-relaxed mt-1">
            We don&apos;t just<br />find venues,
          </p>
          <p className="font-script text-white text-2xl italic mt-1">we create memories.</p>
          <div className="mt-4 text-white text-base opacity-70">♥</div>
        </div>
      </div>
    </div>
  );
}
