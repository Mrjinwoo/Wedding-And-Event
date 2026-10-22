"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordSchema } from "@/lib/validation";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const urlError = searchParams.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setFieldErrors({});

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed.error.issues.forEach((e: any) => { if (e.path[0]) errs[String(e.path[0])] = e.message; });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword: password }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401 || json.error?.toLowerCase().includes("unauthorized")) {
          setError("The reset session could not be verified. Open the newest password email link again in this browser, then try once more.");
        } else {
          setError(json.error);
        }
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
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

          {/* Expired link */}
          {urlError === "auth_callback_failed" ? (
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="font-display text-2xl font-bold text-[#1a1a1a] mb-2">Link Expired</h2>
              <p className="text-sm text-gray-500 mb-6">
                This password reset link is invalid or has expired.<br />Please request a new one.
              </p>
              <Link href="/forgot-password"
                className="block w-full py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-semibold text-center transition-colors">
                Request New Link
              </Link>
            </div>

          ) : done ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="font-display text-2xl font-bold text-[#1a1a1a] mb-2">Password Updated!</h2>
              <p className="text-sm text-gray-500">Redirecting you to login…</p>
            </div>

          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">New Password</h2>
                <p className="text-xs text-gray-500 mt-1">Choose a strong new password for your account.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">New Password</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="New password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({...p, password: ""})); }}
                      required
                      className={`w-full pl-9 pr-10 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] placeholder-gray-400 ${fieldErrors.password ? "border-red-400" : "border-gray-300"}`}
                    />
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
                    : <p className="text-[11px] text-gray-400 mt-1">Min 8 chars, 1 uppercase, 1 number, 1 special character</p>
                  }
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({...p, confirmPassword: ""})); }}
                      required
                      className={`w-full pl-9 pr-10 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] placeholder-gray-400 ${fieldErrors.confirmPassword ? "border-red-400" : "border-gray-300"}`}
                    />
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
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] disabled:opacity-60 text-white font-display text-lg font-semibold tracking-wide transition-colors">
                  {loading ? "Updating…" : "Update Password"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 mt-6">
                <Link href="/login" className="font-medium text-[#9B2C4A] hover:underline">← Back to Login</Link>
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
