"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { joinRoom } from "../lib/ws";
import PostItem from "./PostItem";
import { api } from "../lib/api";

export default function PostList({ me, initial = [] }) {
  const [posts, setPosts] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const wsRef = useRef(null);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // helpers
  const upsert = (arr, item) => {
    const idx = arr.findIndex((p) => p.id === item.id);
    if (idx >= 0) {
      const next = arr.slice();
      next[idx] = { ...arr[idx], ...item };
      return next;
    }
    return [item, ...arr];
  };

  const loadPosts = async (pageNum = 0, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const limit = 10;
      const offset = pageNum * limit;
      const list = await api(`/api/posts?limit=${limit}&offset=${offset}`);
      
      if (isLoadMore) {
        // Append new posts, avoiding duplicates
        setPosts(prev => {
          const seen = new Set(prev.map(p => p.id));
          const newPosts = list.filter(p => !seen.has(p.id));
          return [...prev, ...newPosts];
        });
      } else {
        // Initial load
        setPosts(list);
      }
      
      setHasMore(list.length >= limit);
      setPage(pageNum);
    } catch {
      // ignore
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPosts(0, false);

    // WS room
    if (!wsRef.current) {
      wsRef.current = joinRoom("feed", (msg) => {
        if (msg.type === "post_created" && msg.payload) {
          setPosts((prev) => upsert(prev, msg.payload));
        }
        if (msg.type === "post_deleted" && msg.payload?.id) {
          setPosts((prev) => prev.filter((p) => p.id !== msg.payload.id));
        }
        if (msg.type === "like_updated" && msg.payload?.postId != null) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === msg.payload.postId ? { ...p, likeCount: msg.payload.likes } : p
            )
          );
        }
      });
    }

    return () => {
      // keep the single feed socket alive across re-renders; close only on unmount
    };
  }, []); // only run once on mount

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPosts(page + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [page, hasMore, loadingMore]);

  function onDeleted(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function onLikeChanged(id, likes, liked) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likeCount: likes, liked } : p))
    );
  }

  // UI bits
  const Loading = useMemo(
    () => (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-accent/10 to-accent-light/20 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-accent/10 rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted/10 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 bg-accent/10 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-accent/10 rounded animate-pulse" />
            </div>
            <div className="h-48 bg-gradient-to-br from-accent/5 to-accent-light/10 rounded-2xl animate-pulse" />
          </div>
        ))}
      </div>
    ),
    []
  );

  const Empty = (
    <div className="card text-center py-12 space-y-4">
      <div className="text-6xl opacity-50">📝</div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">No posts yet</h3>
        <p className="text-muted">Be the first to share something amazing!</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {loading && posts.length === 0 ? (
        <>{Loading}</>
      ) : posts.length === 0 ? (
        Empty
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((p) => (
              <PostItem
                key={p.id}
                post={p}
                me={me}
                onDeleted={onDeleted}
                onLikeChanged={onLikeChanged}
              />
            ))}
          </div>
          
          {/* Infinite scroll trigger */}
          {hasMore && (
            <div 
              ref={loadMoreRef}
              className="flex justify-center pt-6 pb-4"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2 text-muted">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Loading more posts…
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => loadPosts(page + 1, true)}
                    className="btn btn-secondary"
                    disabled={loadingMore}
                  >
                    Load More Posts
                  </button>
                  <div className="flex items-center gap-2 text-muted text-xs opacity-50">
                    <div className="text-sm">↓</div>
                    Or scroll to load automatically
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!hasMore && posts.length > 0 && (
            <div className="text-center pt-6 pb-4 text-muted">
              You've reached the end! 🎉
            </div>
          )}
        </>
      )}
    </div>
  );
}