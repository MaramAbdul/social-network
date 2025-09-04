"use client";

import { useState } from "react";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import { api } from "../lib/api";

export default function ProfileHeader({ me, profile }) {
  const mine = me?.id === profile.user.id;
  const [isPublic, setIsPublic] = useState(!!profile.user.isPublic);
  const [busy, setBusy] = useState(false);

  async function togglePrivacy() {
    setBusy(true);
    try {
      await api("/api/profile/privacy", {
        method: "POST",
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      setIsPublic(!isPublic);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <Avatar
          src={profile.user.avatarUrl}
          label={profile.user.nickname || profile.user.firstName || profile.user.id}
          size={64}
        />
        <div className="flex-1 grid gap-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {profile.user.nickname || `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim() || profile.user.id.slice(0,6)}
              </h1>
              <div className="text-sm text-gray-500">
                @{profile.user.id.slice(0, 8)}
                <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                  {isPublic ? "Public" : "Private"}
                </span>
              </div>
            </div>

            {mine ? (
              <button className="btn" onClick={togglePrivacy} disabled={busy}>
                {busy ? "…" : isPublic ? "Make Private" : "Make Public"}
              </button>
            ) : (
              <FollowButton
                targetId={profile.user.id}
                initialRelation={profile.relation}
                isPublic={isPublic}
              />
            )}
          </div>

          {profile.user.aboutMe && (
            <p className="text-gray-700 mt-1 whitespace-pre-wrap">{profile.user.aboutMe}</p>
          )}

          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <b>{profile.stats.followers}</b> Followers
            </span>
            <span className="inline-flex items-center gap-1">
              <b>{profile.stats.following}</b> Following
            </span>
            <button
              className="btn"
              onClick={async () => {
                  if (!confirm("Make all my public posts visible to followers only?")) return;
                  const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
                  const res = await fetch(`${API}/api/profile/restrict_posts`, {
                      method: "POST",
                      credentials: "include",
                  });
                  const json = await res.json();
                  alert(`Updated ${json.updated || 0} posts.`);
              } }
          >
              Restrict all past posts
          </button>
          {/* <button
  className="btn"
  onClick={async () => {
    if (!confirm("Make all my past posts public?")) return;
    const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
    const res = await fetch(`${API}/api/profile/make_posts_public`, {
      method: "POST",
      credentials: "include",
    });
    const json = await res.json();
    alert(`Made ${json.updated || 0} posts public.`);
  }}
>
  Make all past posts public
</button> */}
          </div>
        </div>
      </div>
    </div>
  );
}