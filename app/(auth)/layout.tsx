import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Back to home bar — sits above every auth page */}
      <div className="fixed top-0 left-0 z-50 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-10 flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#9B2C4A] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>

      {/* Push content down so it isn't hidden behind the bar */}
      <div className="pt-10">
        {children}
      </div>
    </>
  );
}
