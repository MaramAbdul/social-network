"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGroupDiscovery } from "../../lib/useGroupDiscovery";
import { useMe } from "../../lib/useMe";
import Header from "../../components/Header";

export default function GroupDiscoveryPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const { groups, loading, searchQuery, setSearchQuery, requestJoin, refresh } =
    useGroupDiscovery();
  const [joinRequests, setJoinRequests] = useState(new Set());

  useEffect(() => {
    if (!meLoading && !me) {
      router.push("/login");
    }
  }, [me, meLoading, router]);

  if (meLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!me) return null;

  const handleRequestJoin = async (groupId) => {
    if (joinRequests.has(groupId)) return;

    setJoinRequests((prev) => new Set([...prev, groupId]));
    try {
      await requestJoin(groupId);
    } catch (error) {
      console.error("Failed to request join:", error);
    } finally {
      setJoinRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "accepted":
        return "Member";
      case "invited":
        return "Invited";
      case "requested":
        return "Requested";
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "invited":
        return "bg-blue-100 text-blue-800";
      case "requested":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Discover Groups
          </h1>
          <p className="text-muted">Find and join groups that interest you</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-3 border border-border rounded-xl bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-card rounded-xl p-6 border border-border"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-accent/10 rounded-xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-accent/10 rounded w-1/3"></div>
                    <div className="h-4 bg-accent/5 rounded w-2/3"></div>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="h-4 bg-accent/5 rounded w-20"></div>
                      <div className="h-8 bg-accent/10 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Groups List */}
        {!loading && (
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {searchQuery ? "No groups found" : "No groups available"}
                </h3>
                <p className="text-muted">
                  {searchQuery
                    ? "Try adjusting your search terms"
                    : "Groups will appear here when they're created"}
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="bg-card rounded-xl p-6 border border-border hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent-light/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-accent text-2xl font-bold">👥</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-foreground truncate">
                          {group.title}
                        </h3>
                        {group.myStatus !== "none" && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              group.myStatus
                            )}`}
                          >
                            {getStatusText(group.myStatus)}
                          </span>
                        )}
                      </div>

                      {group.description && (
                        <p className="text-muted text-sm mb-3 line-clamp-2">
                          {group.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted">
                          <span className="flex items-center gap-1">
                            👥 {group.memberCount} member
                            {group.memberCount !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            📅 {new Date(group.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {group.myStatus === "none" && (
                            <button
                              onClick={() => handleRequestJoin(group.id)}
                              disabled={joinRequests.has(group.id)}
                              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {joinRequests.has(group.id) ? (
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                  Requesting...
                                </span>
                              ) : (
                                "Request to Join"
                              )}
                            </button>
                          )}

                          {group.myStatus === "accepted" && (
                            <button
                              onClick={() => router.push("/chat")}
                              className="px-4 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors"
                            >
                              Open Chat
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Refresh Button */}
        {!loading && groups.length > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={refresh}
              className="px-6 py-2 text-muted hover:text-foreground transition-colors text-sm"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
