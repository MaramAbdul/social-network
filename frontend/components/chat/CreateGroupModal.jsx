"use client";
import { useState } from "react";

export default function CreateGroupModal({ onClose, onCreateGroup }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    setError("");

    try {
      await onCreateGroup(title.trim(), description.trim() || null);
      onClose();
    } catch (err) {
      setError("Failed to create group. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-3xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>👥</span>
              Create Group
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-accent/10 flex items-center justify-center text-muted hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Group Name *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter group name..."
                className="input"
                maxLength={50}
                required
                autoFocus
              />
              <div className="text-xs text-muted mt-1">
                {title.length}/50 characters
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this group is about..."
                className="input resize-none"
                rows={3}
                maxLength={200}
              />
              <div className="text-xs text-muted mt-1">
                {description.length}/200 characters
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-error/20 bg-error/10 p-3 flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <div className="text-sm text-error">{error}</div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary flex-1"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={!title.trim() || creating}
              >
                {creating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating...
                  </div>
                ) : (
                  "Create Group"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}