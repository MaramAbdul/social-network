"use client";

import { useState, useEffect } from "react";
import { api } from "../lib/api";

function FollowerSelector({ isOpen, onClose, onSelect, selectedFollowers = [] }) {
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchFollowers();
    }
  }, [isOpen]);

  const fetchFollowers = async () => {
    setLoading(true);
    try {
      // Get current user's ID first
      const me = await api("/api/me");
      // Get followers list
      const followersList = await api(`/api/profile/followers?id=${me.id}`);
      setFollowers(Array.isArray(followersList) ? followersList : []);
    } catch (error) {
      console.error("Failed to fetch followers:", error);
      setFollowers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFollowers = followers.filter(follower =>
    (follower.nickname || `${follower.firstName || ''} ${follower.lastName || ''}`.trim() || follower.id)
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const handleToggleFollower = (followerId) => {
    const newSelected = selectedFollowers.includes(followerId)
      ? selectedFollowers.filter(id => id !== followerId)
      : [...selectedFollowers, followerId];
    onSelect(newSelected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0  text-black backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-border">
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-foreground">Select Followers</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-accent/10 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="Search followers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-accent/10 rounded mb-1"></div>
                    <div className="h-3 bg-accent/5 rounded w-2/3"></div>
                  </div>
                  <div className="w-5 h-5 bg-accent/10 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredFollowers.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="text-2xl mb-2">👥</div>
              <p>{searchQuery ? "No followers found" : "You don't have any followers yet"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFollowers.map((follower) => {
                const displayName = follower.nickname || 
                  `${follower.firstName || ""} ${follower.lastName || ""}`.trim() || 
                  follower.id;
                const isSelected = selectedFollowers.includes(follower.id);
                
                return (
                  <label
                    key={follower.id}
                    className="flex items-center gap-3 p-2 hover:bg-accent/5 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-accent/20 to-accent-light/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-sm font-bold">
                        {displayName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {displayName}
                      </div>
                      <div className="text-sm text-muted">@{follower.id}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleFollower(follower.id)}
                      className="w-5 h-5 text-accent rounded border-border focus:ring-2 focus:ring-accent"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">
              {selectedFollowers.length} selected
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnhancedPostComposer({ onCreated }) {
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [selectedFollowers, setSelectedFollowers] = useState([]);
  const [showFollowerSelector, setShowFollowerSelector] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    
    // Validation for private posts
    if (visibility === "private" && selectedFollowers.length === 0) {
      alert("Please select at least one follower for private posts");
      return;
    }

    setBusy(true);
    try {
      const postData = {
        body: body.trim(),
        imageUrl: imageUrl.trim() || null,
        visibility,
      };

      // Add allowed IDs for private posts
      if (visibility === "private") {
        postData.allowedIds = selectedFollowers;
      }

      const created = await api("/api/posts", {
        method: "POST",
        body: JSON.stringify(postData),
      });

      // Reset form
      setBody("");
      setImageUrl("");
      setVisibility("public");
      setSelectedFollowers([]);
      
      // Notify parent component
      onCreated?.(created);
    } catch (err) {
      alert("Failed to post: " + (err?.message || "error"));
    } finally {
      setBusy(false);
    }
  }

  const getVisibilityIcon = (vis) => {
    switch (vis) {
      case "public": return "🌍";
      case "followers": return "👥";
      case "private": return "🔒";
      default: return "🌍";
    }
  };

  const getVisibilityDescription = (vis) => {
    switch (vis) {
      case "public": return "Anyone can see this post";
      case "followers": return "Only your followers can see this post";
      case "private": return `Only ${selectedFollowers.length} selected follower${selectedFollowers.length !== 1 ? 's' : ''} can see this post`;
      default: return "Anyone can see this post";
    }
  };

  return (
    <>
      <form onSubmit={submit} className="bg-card rounded-xl p-6 border border-border shadow-sm">
        <div className="space-y-4">
          {/* Post Content */}
          <textarea
            className="w-full px-4 py-3 border border-border rounded-lg bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            rows={3}
            placeholder="What's happening?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          
          {/* Image URL */}
          <input
            className="w-full px-4 py-3 border border-border rounded-lg bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Image URL (optional)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />

          {/* Privacy Controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Who can see this:</span>
              <span className="text-xs text-muted">{getVisibilityDescription(visibility)}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {/* Public */}
              <button
                type="button"
                onClick={() => {
                  setVisibility("public");
                  setSelectedFollowers([]);
                }}
                className={`p-3 rounded-lg border transition-all text-center ${
                  visibility === "public"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-muted hover:bg-accent/5"
                }`}
              >
                <div className="text-xl mb-1">🌍</div>
                <div className="text-xs font-medium">Public</div>
              </button>

              {/* Followers */}
              <button
                type="button"
                onClick={() => {
                  setVisibility("followers");
                  setSelectedFollowers([]);
                }}
                className={`p-3 rounded-lg border transition-all text-center ${
                  visibility === "followers"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-muted hover:bg-accent/5"
                }`}
              >
                <div className="text-xl mb-1">👥</div>
                <div className="text-xs font-medium">Followers</div>
              </button>

              {/* Private */}
              <button
                type="button"
                onClick={() => {
                  setVisibility("private");
                  setShowFollowerSelector(true);
                }}
                className={`p-3 rounded-lg border transition-all text-center ${
                  visibility === "private"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-muted hover:bg-accent/5"
                }`}
              >
                <div className="text-xl mb-1">🔒</div>
                <div className="text-xs font-medium">Private</div>
              </button>
            </div>

            {/* Selected Followers Preview */}
            {visibility === "private" && selectedFollowers.length > 0 && (
              <div className="bg-accent/5 rounded-lg p-3 border border-accent/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    Selected {selectedFollowers.length} follower{selectedFollowers.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFollowerSelector(true)}
                    className="text-xs text-accent hover:text-accent-hover"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>{getVisibilityIcon(visibility)}</span>
              <span>{visibility.charAt(0).toUpperCase() + visibility.slice(1)} post</span>
            </div>
            <button 
              className="px-6 py-2 bg-purple-200 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
              type="submit" 
              disabled={busy || !body.trim()}
            >
              {busy ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </form>

      {/* Follower Selector Modal */}
      <FollowerSelector
        isOpen={showFollowerSelector}
        onClose={() => setShowFollowerSelector(false)}
        onSelect={setSelectedFollowers}
        selectedFollowers={selectedFollowers}
      />
    </>
  );
}