"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Staff TOTP Enrollment ─────────────────────────────────────────────────────
// Three-stage flow:
//   Stage 1 — Fetch QR code (GET /api/auth/mfa/enroll)
//   Stage 2 — Staff scans QR, enters live 6-digit TOTP to confirm
//             (POST /api/auth/mfa/enroll)
//   Stage 3 — Recovery codes displayed ONCE; staff must save them before continuing
// ─────────────────────────────────────────────────────────────────────────────

export default function MFAEnrollPage() {
  const router = useRouter();

  function requestedNext() {
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
  }

  type Stage = "loading" | "scan" | "confirm" | "recovery" | "error";

  const [stage, setStage] = useState<Stage>("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    beginEnrollment();
  }, []);

  async function beginEnrollment() {
    setStage("loading");
    setError("");
    try {
      // AAL2 is required for sensitive admin actions, so accounts without a
      // verified factor must be able to enroll here.
      const statusRes = await fetch("/api/auth/mfa/status");
      const statusJson = await statusRes.json();
      if (statusRes.ok && statusJson.factorId) {
        router.replace(`/admin/mfa/challenge?next=${encodeURIComponent(requestedNext())}`);
        return;
      }
      const enrollRes = await fetch("/api/auth/mfa/enroll");
      const enrollJson = await enrollRes.json();
      if (!enrollRes.ok) {
        setError(enrollJson.error ?? "Could not start authenticator setup.");
        setStage("error");
        return;
      }
      setFactorId(enrollJson.factorId);
      setQrCode(enrollJson.qrCode);
      setSecret(enrollJson.secret);
      setStage("scan");
    } catch {
      setError("Could not connect to start authenticator setup. Please try again.");
      setStage("error");
    }
  }

  function handleDigitChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
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
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, idx) => { next[idx] = c; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Enrollment failed. Please try again.");
        return;
      }
      setRecoveryCodes(json.recoveryCodes ?? []);
      setStage("recovery");
    } finally {
      setLoading(false);
    }
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="bg-[#1a1a1a] px-8 py-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔐</span>
            <h1 className="text-white font-display text-xl font-bold">
              Set Up Two-Factor Authentication
            </h1>
          </div>
          <p className="text-white/50 text-xs">
            Staff accounts require an authenticator app to access admin features.
          </p>
        </div>

        <div className="px-8 py-8">

          {/* ── Stage: loading ── */}
          {stage === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-4 border-[#9B2C4A] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Generating QR code…</p>
            </div>
          )}

          {/* ── Stage: error ── */}
          {stage === "error" && (
            <div className="text-center py-8">
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button
                onClick={beginEnrollment}
                className="bg-[#9B2C4A] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7A1F38] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── Stage: scan ── */}
          {stage === "scan" && (
            <div className="space-y-6">
              <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                <li>Install <span className="font-medium text-[#1a1a1a]">Google Authenticator</span> or <span className="font-medium text-[#1a1a1a]">Authy</span> on your phone.</li>
                <li>Tap <span className="font-medium text-[#1a1a1a]">"Add account"</span> → <span className="font-medium text-[#1a1a1a]">"Scan QR code"</span>.</li>
                <li>Scan the code below, then tap <span className="font-medium text-[#1a1a1a]">Continue</span>.</li>
              </ol>

              {/* QR code */}
              {qrCode && (
                <div className="flex justify-center">
                  {/* qrCode is an SVG data URI from Supabase */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt="TOTP QR code — scan with your authenticator app"
                    className="w-48 h-48 border-2 border-gray-100 rounded-xl p-2"
                  />
                </div>
              )}

              {/* Manual entry secret */}
              <div>
                <button
                  type="button"
                  onClick={() => setSecretVisible(v => !v)}
                  className="text-xs text-[#9B2C4A] hover:underline"
                >
                  {secretVisible ? "Hide" : "Can't scan? Enter code manually"}
                </button>
                {secretVisible && (
                  <div className="mt-2 bg-gray-50 rounded-lg px-4 py-3 font-mono text-sm tracking-widest text-[#1a1a1a] break-all select-all border border-gray-200">
                    {secret}
                  </div>
                )}
              </div>

              <button
                onClick={() => { setStage("confirm"); setDigits(["","","","","",""]); }}
                className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors"
              >
                I&apos;ve Scanned the Code →
              </button>
            </div>
          )}

          {/* ── Stage: confirm ── */}
          {stage === "confirm" && (
            <div className="space-y-6">
              <div>
                <button
                  onClick={() => { setStage("scan"); setError(""); }}
                  className="text-xs text-gray-500 hover:text-[#9B2C4A] mb-3 flex items-center gap-1"
                >
                  ← Back to QR code
                </button>
                <p className="text-sm text-gray-600">
                  Open your authenticator app, find <span className="font-medium text-[#1a1a1a]">Event Venue</span>, and enter the 6-digit code shown.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={confirmEnrollment} className="space-y-5">
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
                        className={`w-11 h-13 text-center text-xl font-bold rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent transition-colors
                          ${error ? "border-red-400" : d ? "border-[#9B2C4A]" : "border-gray-300"}`}
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || digits.join("").length < 6}
                  className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Confirming…" : "Confirm & Enable 2FA"}
                </button>
              </form>
            </div>
          )}

          {/* ── Stage: recovery codes ── */}
          {stage === "recovery" && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-xl mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Save these recovery codes now</p>
                  <p className="text-xs text-amber-700 mt-1">
                    These 8 codes are shown <strong>once only</strong>. Each is single-use. If you lose your phone, use one to regain access and re-enroll.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-2">
                  {recoveryCodes.map((code, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm tracking-widest text-[#1a1a1a] bg-white border border-gray-200 rounded-lg px-3 py-2 text-center"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={copyRecoveryCodes}
                className="w-full border border-[#9B2C4A] text-[#9B2C4A] hover:bg-[#9B2C4A]/5 font-semibold text-sm py-2.5 rounded-lg transition-colors"
              >
                {copied ? "✓ Copied!" : "Copy All Codes"}
              </button>

              <button
                onClick={() => router.push(requestedNext())}
                className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors"
              >
                I&apos;ve Saved My Codes — Go to Admin
              </button>
            </div>
          )}
        </div>

        {/* Footer brand */}
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
