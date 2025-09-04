"use client";

import { useMe } from "../lib/useMe";

export default function GreetingCard() {
  const { me } = useMe();

  if (!me) return null; // don’t show if not logged in

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white/90 to-blue-50/60 backdrop-blur-sm border border-white/40 shadow-lg shadow-blue-500/5">
      {/* subtle animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/30 to-indigo-50/20" />

      <div className="relative p-6">
        <div className="flex items-center gap-4">
          {/* avatar */}
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white font-bold text-sm">
                {me?.id?.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
          </div>

          {/* greeting text */}
          <div className="space-y-1">
            <div className="font-semibold text-slate-800 text-lg">
              Welcome back!
            </div>
            <div className="text-slate-600 text-sm flex items-center gap-2">
              <svg
                className="w-4 h-4 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              Ready to share something amazing?
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}