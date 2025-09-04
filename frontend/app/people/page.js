"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FollowButton from "../../components/FollowButton";

export default function PeoplePage() {
  const [all, setAll] = useState([]); // full list from server (already excludes self if logged in)
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setBusy(true);
      setErr("");
      try {
        const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
        const res = await fetch(`${API}/api/users/search?limit=200`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        const list = await res.json();
        setAll(list);
      } catch (e) {
        setErr("Failed to load users.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((u) => {
      const hay = [
        u.nickname || "",
        u.firstName || "",
        u.lastName || "",
        u.id || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [q, all]);

  return (
    <section className="grid gap-4">
      <div className="card grid gap-3">
        <h1 className="text-xl font-semibold">People</h1>
        <input
          className="input"
          placeholder="Search by email, name, nickname…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {err && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
            {err}
          </div>
        )}
      </div>

      {busy ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="card text-gray-600">No people found.</div>
      ) : (
        <div className="grid gap-3">
          {results.map((u) => (
            <div key={u.id} className="card flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {u.nickname || "@" + u.id.slice(0, 6)}
                </div>
                <div className="text-sm text-gray-600">
                  <Link href={`/profile/${u.id}`} className="underline">
                    View profile
                  </Link>
                  <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                    {u.isPublic ? "Public" : "Private"}
                  </span>
                  {u.relation !== "none" && (
                    <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      {u.relation === "following" ? "Following" : "Requested"}
                    </span>
                  )}
                </div>
              </div>

              <FollowButton
                targetId={u.id}
                initialRelation={u.relation} // <-- use backend relation
                isPublic={u.isPublic}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
