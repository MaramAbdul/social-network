
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";

function NavLink({ href, children }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`
        relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105
        ${active 
          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30" 
          : "text-slate-600 hover:text-slate-900 hover:bg-white/60 hover:shadow-md hover:shadow-slate-500/10"
        }
      `}
    >
      {active && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/10 rounded-xl animate-pulse" />
      )}
      <span className="relative">{children}</span>
    </Link>
  );
}

export default function Header() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          (process.env.NEXT_PUBLIC_API || "http://localhost:8080") + "/api/me",
          { credentials: "include" }
        );
        setMe(res.ok ? await res.json() : null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function logout() {
    await fetch(
      (process.env.NEXT_PUBLIC_API || "http://localhost:8080") + "/api/logout",
      { method: "POST", credentials: "include" }
    );
    setMe(null);
    location.href = "/login";
  }

  const userChip =
    !loading && me ? (
      <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-white/80 to-blue-50/60 rounded-xl border border-white/40 shadow-lg shadow-blue-500/5 backdrop-blur-sm">
        <div className="relative">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
            <span className="text-white font-bold text-xs">
              {me.id.slice(0, 2)}
            </span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm" />
        </div>
        <span className="text-slate-700 font-medium text-sm">
          {me.id.slice(0, 8)}
        </span>
      </div>
    ) : null;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-white/20 shadow-lg shadow-slate-500/5">
      {/* Subtle top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      
      <div className="container relative">
        <div className="flex h-16 items-center justify-between">
          {/* Enhanced Brand */}
          <Link
            href="/"
            className="group flex items-center gap-3 hover:opacity-90 transition-opacity duration-300 z-10"
            aria-label="SocialNet Home"
          >
            {/* Logo icon */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow duration-300">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            
            {/* Brand text - Hidden on very small screens */}
            <span className="font-bold text-xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight hidden sm:block">
              SocialNet
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-50/60 rounded-2xl backdrop-blur-sm border border-white/40 shadow-inner">
              <NavLink href="/">Home</NavLink>
              {!loading && me && <NavLink href="/my">My posts</NavLink>}
              {!loading && me && (
                <NavLink href="/profile/me">
                  Profile
                </NavLink>
              )}
              <NavLink href="/people">People</NavLink>
              {!loading && me && <NavLink href="/groups">Groups</NavLink>}
              {!loading && me && (
                <NavLink href="/profile/me/requests">
                  Requests
                </NavLink>
              )}
              {!loading && me && <NavLink href="/chat">Chat</NavLink>}
              {!loading && me && <Link href="/profile/settings" className="btn-ghost">Settings</Link>}
            </div>

            {/* User info - Desktop */}
            {userChip}

            {/* Enhanced Auth actions - Desktop */}
            <div className="flex items-center gap-2 ml-4">
              {loading ? (
                <div className="flex gap-2">
                  <div className="h-10 w-20 animate-pulse rounded-xl bg-gradient-to-r from-slate-100 to-slate-200" />
                  <div className="h-10 w-24 animate-pulse rounded-xl bg-gradient-to-r from-blue-100 to-indigo-100" />
                </div>
              ) : me ? (
                <button 
                  onClick={logout} 
                  className="group px-4 py-2 bg-gradient-to-r from-slate-100 to-white text-slate-700 hover:text-slate-900 font-medium rounded-xl border border-slate-200/60 hover:border-slate-300 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                  aria-label="Logout"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="hidden xl:inline">Logout</span>
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Link 
                    href="/login" 
                    className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium rounded-xl hover:bg-white/60 transition-all duration-300 transform hover:scale-105"
                  >
                    Login
                  </Link>
                  <Link 
                    href="/register" 
                    className="group relative overflow-hidden px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <span className="relative">Register</span>
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Mobile Navigation Elements */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Notifications for mobile */}
            {!loading && me && <NotificationBell me={me} />}
            
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-white/20 shadow-lg">
            <div className="px-4 py-6 space-y-4">
              {/* Mobile Navigation Links */}
              <div className="space-y-3">
                <Link 
                  href="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                >
                  🏠 Home
                </Link>
                
                {!loading && me && (
                  <Link 
                    href="/my" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                  >
                    📝 My posts
                  </Link>
                )}

                {!loading && me && (
                  <Link 
                    href="/profile/me" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                  >
                    👤 Profile
                  </Link>
                )}

                <Link 
                  href="/people" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                >
                  👥 People
                </Link>

                {!loading && me && (
                  <Link 
                    href="/groups" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                  >
                    🏢 Groups
                  </Link>
                )}

                {!loading && me && (
                  <Link 
                    href="/profile/me/requests" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                  >
                    📨 Requests
                  </Link>
                )}

                {!loading && me && (
                  <Link 
                    href="/chat" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                  >
                    💬 Chat
                  </Link>
                )}

                {!loading && me && (
                  <Link 
                    href="/profile/settings" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all"
                  >
                    ⚙️ Settings
                  </Link>
                )}
              </div>

              {/* Mobile User Info & Auth */}
              <div className="pt-4 border-t border-slate-200/60">
                {loading ? (
                  <div className="space-y-3">
                    <div className="h-12 animate-pulse rounded-xl bg-gradient-to-r from-slate-100 to-slate-200" />
                    <div className="h-10 animate-pulse rounded-xl bg-gradient-to-r from-blue-100 to-indigo-100" />
                  </div>
                ) : me ? (
                  <div className="space-y-4">
                    {/* Mobile User Chip */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-white/80 to-blue-50/60 rounded-xl border border-white/40 shadow-lg shadow-blue-500/5">
                      <div className="relative">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                          <span className="text-white font-bold text-sm">
                            {me.id.slice(0, 2)}
                          </span>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                      </div>
                      <span className="text-slate-700 font-medium">
                        {me.id.slice(0, 12)}
                      </span>
                    </div>
                    
                    {/* Mobile Logout */}
                    <button 
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Link 
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 text-slate-700 hover:text-slate-900 font-medium rounded-xl hover:bg-white/60 transition-all text-center border border-slate-200"
                    >
                      Login
                    </Link>
                    <Link 
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all text-center"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}