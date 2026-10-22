"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MFAChallengePageWrapper() {
  return (
    <Suspense>
      <MFAChallengePage />
    </Suspense>
  );
}

// ── Staff MFA Challenge (aal1 → aal2 step-up) ─────────────────────────────────
// Reached after password login when the staff account has an enrolled TOTP factor.
// Flow:
//   1. GET /api/auth/mfa/verify?factorId=…  → gets challengeId
//   2. Staff enters 6-digit TOTP code
//   3. POST /api/auth/mfa/verify → session elevated to aal2 → redirect to /admin
//
// If staff lost their phone:  "Use recovery code" toggles to a text input that
//   POSTs to /api/auth/mfa/recovery and, on success, redirects to /admin/mfa/enroll.
// ─────────────────────────────────────────────────────────────────────────────

function MFAChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/admin";

  type Mode = "totp" | "recovery";

  const [mode, setMode] = useState<Mode>("totp");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── On mount: list enrolled factors and issue a challenge ──
  useEffect(() => {
    initChallenge();
  }, []);

  async function initChallenge() {
    setFetching(true);
    setError("");
    try {
      // Ask the server which factor to challenge.
      // The server lists factors via supabase.auth.mfa.listFactors and returns the first verified TOTP.
      const listRes = await fetch("/api/auth/mfa/status");
      const listJson = await listRes.json();

      if (!listRes.ok || !listJson.factorId) {
        // No enrolled factor — redirect to enroll
        router.replace(`/admin/mfa/enroll?next=${encodeURIComponent(next)}`);
        return;
      }

      const fid: string = listJson.factorId;
      setFactorId(fid);

      // Issue a challenge
      const chalRes = await fetch(`/api/auth/mfa/verify?factorId=${fid}`);
      const chalJson = await chalRes.json();

      if (!chalRes.ok) {
        setError(chalJson.error ?? "Failed to start MFA challenge.");
        return;
      }
      setChallengeId(chalJson.challengeId);
    } finally {
      setFetching(false);
    }
  }

  function handleDigitChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next2 = [...digits];
    next2[i] = char;
    setDigits(next2);
    setError("");
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleDigitKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const arr = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, idx) => { arr[idx] = c; });
    setDigits(arr);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleTOTP(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    if (!factorId || !challengeId) { setError("Challenge not ready. Please refresh."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, challengeId, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Verification failed.");
        // If challenge expired, re-issue
        if (json.error?.includes("expired")) {
          await initChallenge();
        }
        setDigits(["","","","","",""]);
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryCode.trim()) { setError("Please enter your recovery code."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: recoveryCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Recovery failed.");
        return;
      }
      // Factor has been removed — redirect to re-enroll
      router.push(`/admin/mfa/enroll?next=${encodeURIComponent(next)}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="bg-[#1a1a1a] px-8 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔑</span>
            <h1 className="text-white font-display text-xl font-bold">
              {mode === "totp" ? "Two-Factor Authentication" : "Account Recovery"}
            </h1>
          </div>
          <p className="text-white/50 text-xs">
            {mode === "totp"
              ? "Enter the code from your authenticator app to continue."
              : "Enter one of your saved recovery codes."}
          </p>
        </div>

        <div className="px-8 py-8">

          {fetching ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-4 border-[#9B2C4A] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading…</p>
            </div>
          ) : mode === "totp" ? (
            <div className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleTOTP} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-3 text-center">
                    Authenticator Code
                  </label>
                  <div className="flex gap-2 justify-center" onPaste={handleDigitPaste}>
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => handleDigitChange(i, e.target.value)}
                        onKeyDown={e => handleDigitKeyDown(i, e)}
                        autoFocus={i === 0}
                        className={`w-11 h-13 text-center text-xl font-bold rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent transition-colors
                          ${error ? "border-red-400" : d ? "border-[#9B2C4A]" : "border-gray-300"}`}
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Open your authenticator app for the 6-digit code.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || digits.join("").length < 6}
                  className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying…" : "Verify & Continue"}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  onClick={() => { setMode("recovery"); setError(""); }}
                  className="text-xs text-gray-500 hover:text-[#9B2C4A] hover:underline"
                >
                  Lost your phone? Use a recovery code
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                onClick={() => { setMode("totp"); setError(""); setRecoveryCode(""); }}
                className="text-xs text-gray-500 hover:text-[#9B2C4A] flex items-center gap-1"
              >
                ← Back to authenticator code
              </button>

              <p className="text-sm text-gray-600">
                Enter one of the 8 recovery codes you saved during setup.
                <br />
                <span className="text-xs text-gray-400">
                  The code will be consumed and your authenticator will be unlinked. You&apos;ll need to re-enroll.
                </span>
              </p>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleRecovery} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Recovery Code</label>
                  <input
                    type="text"
                    placeholder="XXXX-XXXX-XXXX"
                    value={recoveryCode}
                    onChange={e => { setRecoveryCode(e.target.value); setError(""); }}
                    required
                    className={`w-full px-4 py-2.5 rounded-lg border bg-white text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent uppercase placeholder-gray-400
                      ${error ? "border-red-400" : "border-gray-300"}`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !recoveryCode.trim()}
                  className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying…" : "Use Recovery Code"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-8 py-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-xs text-gray-400 tracking-widest uppercase">Event Venue · Staff Portal</span>
        </div>
      </div>
    </main>
  );
}
