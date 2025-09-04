"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("u1@x.com");
  const [password, setPassword] = useState("P@ssw0rd!");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwOK = password.trim().length >= 6; // len check only; backend enforces real auth
  const canSubmit = emailOK && pwOK && !busy;

  useEffect(() => {
    // clear error as user edits
    setErr("");
  }, [email, password]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API || "http://localhost:8080") + "/api/login",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      location.href = "/";
    } catch (e) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      onSubmit(e);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
        </div>

        {err && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-text-muted">Email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
              aria-invalid={!emailOK}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-text-muted">Password</span>
            <div className="flex items-stretch gap-2">
              <input
                className="input flex-1"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
                aria-invalid={!pwOK}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowPw((s) => !s)}
                aria-pressed={showPw}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <span className="text-xs text-text-muted">
              Minimum 6 characters.
            </span>
          </label>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-text-muted">
              New here?{" "}
              <Link href="/register" className="underline">
                Create an account
              </Link>
            </span>
            <button
              className="btn btn-primary disabled:opacity-60"
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
