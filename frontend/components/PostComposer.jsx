// components/PostComposer.js (JS/JSX)
"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";

export default function PostComposer({ onCreated }) {
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          imageUrl: imageUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();

      // optimistic insert for UX
      onCreated?.(created);
      setBody("");
      setImageUrl("");
    } catch (err) {
      alert("Failed to post: " + (err?.message || "error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid gap-3">
      <textarea
        className="input"
        rows={3}
        placeholder="What's happening?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <input
        className="input"
        placeholder="Image URL (optional)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      <div className="flex justify-end">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}