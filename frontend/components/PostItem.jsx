
"use client";

import { useMemo, useState } from "react";
import { api } from "../lib/api";
import CommentsPanel from "./CommentsPanel";
import Link from "next/link";

function formatWhen(s) {
  if (!s) return "";
  const t = s.replace(" ", "T") + "Z";
  const d = new Date(t);
  if (isNaN(d)) return s;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString();
}

export default function PostItem({ post, me, onDeleted, onLikeChanged }) {
  const [showComments, setShowComments] = useState(false);
  const [likes, setLikes] = useState(post.likeCount);
  const [liked, setLiked] = useState(!!post.liked);
  const when = useMemo(() => formatWhen(post.createdAt), [post.createdAt]);
  const mine = me?.id === post.userId;

  async function toggleLike() {
    try {
      const payload = { postId: parseInt(post.id) };
      console.log("Sending like payload:", payload);
      const res = await api("/api/posts/like", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setLiked(res.liked);
      setLikes(res.likes);
      onLikeChanged?.(post.id, res.likes, res.liked);
    } catch (e) {
      console.error("Like failed:", e);
    }
  }

  async function del() {
    if (!confirm("Delete this post?")) return;
    try {
      await api("/api/posts/delete", {
        method: "POST",
        body: JSON.stringify({ id: parseInt(post.id) }),
      });
      onDeleted?.(post.id);
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to delete post: " + (e?.message || "Unknown error"));
    }
  }

  return (
    <article className="card space-y-4 hover:shadow-lg transition-all duration-300">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
        <Link href={`/profile/${post.userId}`} className="flex items-center gap-3 hover:opacity-90">
       Add
        </Link>
          <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-accent/20 to-accent-light/30 border-2 border-accent/20 flex items-center justify-center font-bold text-accent">
            {post.userId.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{post.userId.slice(0, 8)}</span>
              <span className="text-muted">•</span>
              <span className="text-sm text-muted">{when}</span>
              {/* Privacy indicator */}
              {post.visibility && post.visibility !== "public" && (
                <span className="flex items-center gap-1">
                  <span className="text-muted">•</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    post.visibility === "followers" 
                      ? "bg-blue-100 text-blue-800" 
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {post.visibility === "followers" ? "👥 Followers" : "🔒 Private"}
                  </span>
                </span>
              )}
            </div>
            <div className="text-xs text-muted opacity-60">
              #{String(post.id).slice(0, 8)}
            </div>
          </div>
        </div>

        {mine && (
          <button
            className="btn-ghost text-error hover:bg-error/10 hover:text-error"
            onClick={del}
            aria-label="Delete post"
            title="Delete post"
          >
            ✕
          </button>
        )}
      </div>

      {/* body */}
      {post.body && (
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground m-0">
            {post.body}
          </p>
        </div>
      )}

      {/* image */}
      {post.imageUrl && (
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full max-h-[420px] object-cover bg-gradient-to-br from-card to-card-hover"
            loading="lazy"
          />
        </div>
      )}

      {/* actions */}
      <div className="flex items-center gap-1 pt-2 border-t border-border/30">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${ 
            liked 
              ? 'bg-accent/10 text-accent hover:bg-accent/20' 
              : 'hover:bg-accent/10 hover:text-accent text-muted'
          }`}
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <span className={liked ? "animate-pulse" : ""}>{liked ? "❤️" : "🤍"}</span>
          <span>{likes}</span>
        </button>

        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-muted hover:bg-muted/10 hover:text-accent transition-all"
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-controls={`comments-${post.id}`}
        >
          <span>💬</span>
          <span>{post.commentCount}</span>
        </button>
        
        <div className="flex-1" />
        
        <Link 
          href={`/chat?dm=${post.userId}`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-muted hover:bg-muted/10 hover:text-accent transition-all"
        >
          <span>💬</span>
          <span className="text-sm">Message</span>
        </Link>
      </div>

      {/* comments */}
      {showComments && (
        <div id={`comments-${post.id}`} className="border-t border-border/30 pt-4">
          <CommentsPanel postId={post.id} />
        </div>
      )}
    </article>
  );
}