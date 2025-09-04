"use client";
import { useState, useEffect } from "react";
import { api } from "./api";

export function useProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await api(`/api/profile/enhanced?id=${encodeURIComponent(userId)}`);
      setProfile(data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const updatePrivacy = async (isPublic, convertOldPosts = false) => {
    try {
      await api("/api/profile/privacy", {
        method: "POST",
        body: JSON.stringify({ isPublic, convertOldPosts }),
      });
      // Refresh profile data
      await fetchProfile();
    } catch (error) {
      console.error("Failed to update privacy:", error);
      throw error;
    }
  };

  const followUser = async () => {
    if (!profile || profile.relation !== "none") return;
    
    try {
      const result = await api("/api/follow/request", {
        method: "POST",
        body: JSON.stringify({ userId: profile.user.id }),
      });
      
      // Update local state based on response
      setProfile(prev => ({
        ...prev,
        relation: result.status === "accepted" ? "following" : "requested",
        stats: result.status === "accepted" ? {
          ...prev.stats,
          followers: prev.stats.followers + 1
        } : prev.stats
      }));
    } catch (error) {
      console.error("Failed to follow user:", error);
      throw error;
    }
  };

  const unfollowUser = async () => {
    if (!profile || (profile.relation !== "following" && profile.relation !== "requested")) return;
    
    try {
      await api("/api/follow/unfollow", {
        method: "POST",
        body: JSON.stringify({ userId: profile.user.id }),
      });
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        relation: "none",
        stats: prev.relation === "following" ? {
          ...prev.stats,
          followers: Math.max(0, prev.stats.followers - 1)
        } : prev.stats
      }));
    } catch (error) {
      console.error("Failed to unfollow user:", error);
      throw error;
    }
  };

  return {
    profile,
    loading,
    error,
    updatePrivacy,
    followUser,
    unfollowUser,
    refresh: fetchProfile,
  };
}

export function useFollowList(userId, type = "followers") {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = type === "followers" ? "followers" : "following";
      const data = await api(`/api/profile/${endpoint}?id=${encodeURIComponent(userId)}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Failed to fetch ${type}:`, err);
      setError(err.message || `Failed to load ${type}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [userId, type]);

  return {
    users,
    loading,
    error,
    refresh: fetchUsers,
  };
}