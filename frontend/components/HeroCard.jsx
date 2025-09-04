"use client";

import Link from "next/link";

export default function HeroCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 via-white/60 to-blue-50/40 backdrop-blur-sm border border-white/20 shadow-xl shadow-blue-500/10">
      {/* background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/10" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-l from-blue-200/30 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-r from-indigo-200/30 to-transparent rounded-full blur-2xl" />
      </div>

      <div className="relative p-8 sm:p-12 text-center space-y-8">
        {/* badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 backdrop-blur-sm">
          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse" />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-semibold text-sm">
            Welcome to SocialNet
          </span>
          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse" />
        </div>

        {/* headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Connect
            </span>
            <span className="text-slate-700">, </span>
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Share
            </span>
            <span className="text-slate-700">, </span>
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
              Inspire
            </span>
          </h1>
          <p className="text-slate-600 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Join our vibrant community to create meaningful posts, engage in
            real-time conversations, and build lasting connections.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/register"
            className="group relative overflow-hidden px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105 w-full sm:w-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <span className="relative flex items-center justify-center gap-2">
              Get Started
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>

          <Link
            href="/login"
            className="group px-8 py-4 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 font-semibold rounded-xl border border-slate-200/60 hover:border-slate-300 shadow-lg shadow-slate-500/5 hover:shadow-xl hover:shadow-slate-500/10 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm w-full sm:w-auto"
          >
            <span className="flex items-center justify-center gap-2">
              Sign In
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}