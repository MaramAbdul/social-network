"use client";

import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function PostPrivacyManager() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(new Set());

  useEffect(() => {
    fetchMyPosts();
  }, []);

  const fetchMyPosts = async () => {
    setLoading(true);
    try {
      const data = await api("/api/my/posts");
      setPosts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const updatePostPrivacy = async (postId, newVisibility, allowedIds = []) => {
    const updateKey = `${postId}-${newVisibility}`;
    if (updating.has(updateKey)) return;

    setUpdating(prev => new Set([...prev, updateKey]));
    
    try {
      // This would require a new backend endpoint
      await api(`/api/posts/${postId}/privacy`, {
        method: "PUT",
        body: JSON.stringify({
          visibility: newVisibility,
          allowedIds: allowedIds,
        }),
      });

      // Update local state
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, visibility: newVisibility }
            : post
        )
      );
    } catch (error) {
      console.error("Failed to update privacy:", error);
      alert("Failed to update privacy settings");
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const bulkUpdatePrivacy = async (visibility) => {
    if (!confirm(`Make all your posts ${visibility}? This cannot be undone.`)) {
      return;
    }

    setUpdating(prev => new Set([...prev, "bulk"]));
    
    try {
      const endpoint = visibility === "public" 
        ? "/api/profile/make_posts_public"
        : "/api/profile/restrict_posts";
      
      const result = await api(endpoint, { method: "POST" });
      alert(`Updated ${result.updated || 0} posts.`);
      
      // Refresh the list
      await fetchMyPosts();
    } catch (error) {
      console.error("Failed to bulk update:", error);
      alert("Failed to update posts");
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev);
        newSet.delete("bulk");
        return newSet;
      });
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case "public": return "🌍";
      case "followers": return "👥";
      case "private": return "🔒";
      default: return "🌍";
    }
  };

  const getVisibilityColor = (visibility) => {
    switch (visibility) {
      case "public": return "bg-green-100 text-green-800";
      case "followers": return "bg-blue-100 text-blue-800";
      case "private": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Manage Post Privacy</h3>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-accent/5 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="h-4 bg-accent/10 rounded mb-2"></div>
                  <div className="h-16 bg-accent/5 rounded"></div>
                </div>
                <div className="w-20 h-8 bg-accent/10 rounded ml-4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Manage Post Privacy</h3>
      
      {/* Bulk Actions */}
      <div className="mb-6 p-4 bg-accent/5 rounded-lg border border-accent/20">
        <h4 className="font-medium text-foreground mb-3">Bulk Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => bulkUpdatePrivacy("public")}
            disabled={updating.has("bulk")}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
          >
            {updating.has("bulk") ? "Updating..." : "Make All Public"}
          </button>
          <button
            onClick={() => bulkUpdatePrivacy("followers")}
            disabled={updating.has("bulk")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            {updating.has("bulk") ? "Updating..." : "Make All Followers-Only"}
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          These actions will update all your existing posts at once.
        </p>
      </div>

      {/* Individual Posts */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <div className="text-4xl mb-2">📝</div>
            <p>You haven't created any posts yet</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-accent/5 rounded-lg p-4 border border-accent/10">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getVisibilityColor(post.visibility || "public")}`}>
                      {getVisibilityIcon(post.visibility || "public")} {(post.visibility || "public").charAt(0).toUpperCase() + (post.visibility || "public").slice(1)}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                    {post.body}
                  </p>
                  {post.imageUrl && (
                    <div className="mt-2 text-xs text-muted">📷 Contains image</div>
                  )}
                </div>
                
                <div className="flex flex-col gap-1 min-w-0">
                  {["public", "followers", "private"].map((visibility) => (
                    <button
                      key={visibility}
                      onClick={() => updatePostPrivacy(post.id, visibility)}
                      disabled={
                        post.visibility === visibility || 
                        updating.has(`${post.id}-${visibility}`)
                      }
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        post.visibility === visibility
                          ? "bg-accent text-white cursor-default"
                          : "bg-muted/20 text-muted hover:bg-muted/30"
                      } disabled:opacity-50`}
                    >
                      {updating.has(`${post.id}-${visibility}`) 
                        ? "..." 
                        : `${getVisibilityIcon(visibility)} ${visibility.charAt(0).toUpperCase() + visibility.slice(1)}`
                      }
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}