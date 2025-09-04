"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function FollowRequestsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
      const res = await fetch(`${API}/api/follow/requests`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load requests:", e);
      setErr(e.message || "Failed to load requests.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(path, userId) {
    const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
    await fetch(`${API}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setItems((prev) => prev.filter((x) => x.userId !== userId));
  }

  return (
    <section className="grid gap-4">
      <div className="card flex items-center justify-between">
        <h1 className="text-xl font-semibold">Follow requests</h1>
        <div className="flex items-center gap-2">
          <span className="chip">{items.length} pending</span>
          <button className="btn-ghost" onClick={load} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && <div className="card text-red-600">{err}</div>}

      {busy ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-gray-600">No pending requests.</div>
      ) : (
        <div className="grid gap-2">
          {items.map((u) => (
            <div
              key={u.userId}
              className="card flex items-center justify-between"
            >
              <div>
                <div className="font-medium">
                  {u.nickname ||
                    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                    "@" + u.userId.slice(0, 6)}
                </div>
                <div className="text-sm text-gray-600">
                  <Link className="underline" href={`/profile/${u.userId}`}>
                    View profile
                  </Link>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => act("/api/follow/accept", u.userId)}
                >
                  Accept
                </button>
                <button
                  className="btn"
                  onClick={() => act("/api/follow/decline", u.userId)}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
