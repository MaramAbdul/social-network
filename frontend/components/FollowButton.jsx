"use client";

import { useState } from "react";
import { api } from "../lib/api";

/**
 * relation: "self" | "none" | "requested" | "following"
 */
export default function FollowButton({ 
  targetId, 
  initialRelation, 
  isPublic, 
  onFollow, 
  onUnfollow 
}) {
  const [rel, setRel] = useState(initialRelation || "none");
  const [busy, setBusy] = useState(false);

  async function act(path, body) {
    setBusy(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (rel === "self") return null;

  if (rel === "following") {
    return (
      <button
        className="btn"
        onClick={async () => {
          if (onUnfollow) {
            setBusy(true);
            try {
              await onUnfollow();
              setRel("none");
            } catch (error) {
              console.error("Failed to unfollow:", error);
            } finally {
              setBusy(false);
            }
          } else {
            if (await act("/api/follow/unfollow", { userId: targetId })) {
              setRel("none");
            }
          }
        }}
        disabled={busy}
      >
        {busy ? "…" : "Unfollow"}
      </button>
    );
  }

  if (rel === "requested") {
    return <button className="btn" disabled>Requested</button>;
  }

  // rel === "none"
  return (
    <button
      className="btn btn-primary"
      onClick={async () => {
        if (onFollow) {
          setBusy(true);
          try {
            await onFollow();
            setRel(isPublic ? "following" : "requested");
          } catch (error) {
            console.error("Failed to follow:", error);
          } finally {
            setBusy(false);
          }
        } else {
          if (await act("/api/follow/request", { userId: targetId })) {
            setRel(isPublic ? "following" : "requested");
          }
        }
      }}
      disabled={busy}
    >
      {busy ? "…" : "Follow"}
    </button>
  );
}