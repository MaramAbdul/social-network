"use client";
import { useState, useEffect } from "react";
import { api } from "./api";

export function useGroupDiscovery() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGroups = async (query = "") => {
    setLoading(true);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : "";
      const data = await api(`/api/groups/discover${params}`);
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups(searchQuery);
  }, [searchQuery]);

  const requestJoin = async (groupId) => {
    try {
      await api("/api/groups/request-join", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(groupId) }),
      });
      // Refresh the groups list to update the status
      await fetchGroups(searchQuery);
    } catch (error) {
      console.error("Failed to request join:", error);
      throw error;
    }
  };

  const refresh = () => {
    fetchGroups(searchQuery);
  };

  return {
    groups,
    loading,
    searchQuery,
    setSearchQuery,
    requestJoin,
    refresh,
  };
}