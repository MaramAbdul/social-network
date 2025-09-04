"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [dob, setDOB] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // simple client-side checks (backend still the source of truth)
  const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pwOK = password.length >= 8; // suggest 8+, backend accepts 6+, but stronger is better
  const firstOK = firstName.trim().length >= 1;
  const lastOK = lastName.trim().length >= 1;
  const dobOK = !!dob; // browser date input ensures format
  const canSubmit = emailOK && pwOK && firstOK && lastOK && dobOK && !busy;

  useEffect(() => {
    setErr("");
  }, [email, password, firstName, lastName, dob]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API || "http://localhost:8080") +
          "/api/register",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dob, // YYYY-MM-DD from <input type="date">
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      location.href = "/";
    } catch (e) {
      setErr(e?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const pwStrength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0..5
  }, [password]);

  return (
    <section className="grid gap-4">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Create your account</h1>
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
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-text-muted">First name</span>
              <input
                className="input"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirst(e.target.value)}
                aria-invalid={!firstOK}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-text-muted">Last name</span>
              <input
                className="input"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLast(e.target.value)}
                aria-invalid={!lastOK}
              />
            </label>
          </div>

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
              aria-invalid={!emailOK}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-text-muted">Password</span>
            <div className="flex items-stretch gap-2">
              <input
                className="input flex-1"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            {/* strength bar */}
            <div className="mt-1 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-full rounded ${
                    i < pwStrength ? "bg-accent" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-text-muted">
              Use at least 8 characters, including a number and a symbol.
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-text-muted">Date of birth</span>
            <input
              className="input"
              type="date"
              value={dob}
              onChange={(e) => setDOB(e.target.value)}
              aria-invalid={!dobOK}
            />
          </label>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-text-muted">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </span>
            <button
              className="btn btn-primary disabled:opacity-60"
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
            >
              {busy ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
