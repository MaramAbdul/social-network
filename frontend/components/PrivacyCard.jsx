"use client";

import { useEffect, useState } from "react";

export default function PrivacyCard({ me }) {
  const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [converted, setConverted] = useState(null);

  // Load current profile to read isPublic
  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const res = await fetch(`${API}/api/profile?id=${me.id}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          setIsPublic(!!json?.user?.isPublic);
        }
      } catch {}
    })();
  }, [me, API]);

  async function setPrivacy(nextIsPublic, withConvert) {
    setLoading(true);
    setConverted(null);
    try {
      const res = await fetch(`${API}/api/profile/privacy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublic: nextIsPublic,
          convertOldPosts: nextIsPublic ? !!withConvert : false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update privacy");
      setIsPublic(nextIsPublic);
      if (nextIsPublic && withConvert) setConverted(json?.converted ?? 0);
      alert(
        nextIsPublic
          ? `Profile is now public.${withConvert ? ` Converted ${json?.converted || 0} past posts.` : ""}`
          : "Profile is now private."
      );
    } catch (e) {
      alert(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card grid gap-3">
      <h2 className="text-lg font-semibold">Privacy</h2>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{isPublic ? "Public profile" : "Private profile"}</div>
          <div className="text-sm text-gray-600">
            {isPublic
              ? "Anyone can follow you and see public posts."
              : "People must be accepted to follow you. Followers-only posts are visible to accepted followers."}
          </div>
        </div>
        <div className="flex gap-2">
          {isPublic ? (
            <button className="btn" disabled={loading} onClick={() => setPrivacy(false, false)}>
              Make Private
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                className="btn"
                disabled={loading}
                onClick={() => setPrivacy(true, false)}
                title="Switch to public (keep old posts as-is)"
              >
                Make Public
              </button>
              <button
                className="btn"
                disabled={loading}
                onClick={() => {
                  if (!confirm("Make profile public and convert ALL past posts to public?")) return;
                  setPrivacy(true, true);
                }}
                title="Switch to public and convert all past posts to public"
              >
                Make Public + Convert Posts
              </button>
            </div>
          )}
        </div>
      </div>
      {converted !== null && (
        <div className="text-sm text-gray-600">
          Converted <span className="font-medium">{converted}</span> posts to public.
        </div>
      )}
    </div>
  );
}