"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { usePresence } from "../../lib/usePresence";
import { useEvents } from "../../lib/useEvents";
import CreateEventModal from "../events/CreateEventModal";
import EventList from "../events/EventList";

export default function GroupSettings({ groupId, groupTitle, me, onClose }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviting, setInviting] = useState(false);

  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef(null);

  const [activeTab, setActiveTab] = useState("members"); // "members" | "events" | "requests"
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const { onlineUsers = [] } = usePresence();
  const {
    events = [],
    loading: eventsLoading,
    createEvent,
    respondToEvent,
    deleteEvent,
  } = useEvents(groupId);

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function fetchMembers() {
    try {
      const data = await api(`/api/groups/members?groupId=${groupId}`);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch members:", err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers(query) {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api(
        `/api/users/search?q=${encodeURIComponent(q)}&limit=10`
      );
      const filtered = (results || []).filter(
        (u) => !members.some((m) => m.userId === u.id)
      );
      setSearchResults(filtered);
    } catch (err) {
      console.error("Failed to search users:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(q), 300);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteUserId.trim() || inviting) return;

    setInviting(true);
    try {
      await api("/api/groups/invite", {
        method: "POST",
        body: JSON.stringify({
          groupId: parseInt(groupId),
          userId: inviteUserId.trim(),
        }),
      });
      setInviteUserId("");
      setSearchQuery("");
      setSearchResults([]);
      // Optional: toast success
    } catch (err) {
      console.error("Failed to invite user:", err);
      // Optional: toast error
    } finally {
      setInviting(false);
    }
  }

  function selectUserToInvite(user) {
    setInviteUserId(user.id);
    const label =
      user.nickname ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.id;
    setSearchQuery(label);
    setSearchResults([]);
  }

  async function handlePromote(userId) {
    try {
      await api("/api/groups/promote", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(groupId), userId }),
      });
      await fetchMembers();
    } catch (err) {
      console.error("Failed to promote user:", err);
    }
  }

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      await api("/api/groups/leave", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(groupId) }),
      });
      onClose?.();
    } catch (err) {
      console.error("Failed to leave group:", err);
    }
  }

  async function fetchJoinRequests() {
    if (!groupId) return;
    setLoadingRequests(true);
    try {
      const data = await api(`/api/groups/join-requests?groupId=${groupId}`);
      setJoinRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch join requests:", err);
      setJoinRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function approveJoinRequest(userId) {
    try {
      await api("/api/groups/approve-join", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(groupId), userId }),
      });
      // Remove from requests and refresh members
      setJoinRequests(prev => prev.filter(req => req.userId !== userId));
      fetchMembers();
    } catch (err) {
      console.error("Failed to approve join request:", err);
    }
  }

  async function rejectJoinRequest(userId) {
    try {
      await api("/api/groups/reject-join", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(groupId), userId }),
      });
      // Remove from requests
      setJoinRequests(prev => prev.filter(req => req.userId !== userId));
    } catch (err) {
      console.error("Failed to reject join request:", err);
    }
  }

  async function kickMember(userId) {
    try {
      await api("/api/groups/kick", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(groupId), userId }),
      });
      // Refresh members list
      fetchMembers();
    } catch (err) {
      console.error("Failed to kick member:", err);
    }
  }

  const myRole = members.find((m) => m.userId === me?.id)?.role;
  const isOwner = myRole === "owner";
  const isAdmin = isOwner || myRole === "admin";

  // Fetch join requests when user becomes admin/owner
  useEffect(() => {
    if (isAdmin && members.length > 0) {
      fetchJoinRequests();
    }
  }, [isAdmin, members.length]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>⚙️</span>
                Group Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                {groupTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900 flex items-center justify-center text-gray-500 hover:text-red-600 transition-colors"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "members"
                ? "text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            👥 Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "events"
                ? "text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/20"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            🎉 Events ({events.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === "requests"
                  ? "text-sky-600 border-b-2 border-sky-600 bg-sky-50 dark:bg-sky-900/20"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              📨 Requests
              {joinRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {joinRequests.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6 bg-white dark:bg-gray-800">
          {/* MEMBERS TAB */}
          {activeTab === "members" && (
            <div className="space-y-6">
              {/* Members list */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Members ({members.length})
                  </h3>
                  <div className="text-xs px-3 py-1 bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 rounded-full">
                    Your role: {myRole || "member"}
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse flex items-center gap-3 p-4 rounded-xl bg-gray-100 dark:bg-gray-700"
                      >
                        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {members.map((member) => {
                      const isOnline = onlineUsers.some(
                        (u) => u.id === member.userId
                      );
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-bold">
                                  {member.userId.slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              {isOnline && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {member.userId}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 capitalize flex items-center gap-2 mt-1">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    member.role === "owner"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                      : member.role === "admin"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                                  }`}
                                >
                                  {member.role}
                                </span>
                              </div>
                            </div>
                          </div>

                          {isOwner && member.userId !== me?.id && (
                            <div className="flex gap-2">
                              {member.role === "member" && (
                                <button
                                  onClick={() => handlePromote(member.userId)}
                                  className="text-xs px-3 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium"
                                >
                                  Make Admin
                                </button>
                              )}
                              <button
                                onClick={() => kickMember(member.userId)}
                                className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                              >
                                Kick
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Invite users */}
              {isAdmin && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Invite Users
                  </h3>

                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Search users by name, nickname, or email..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {searching && (
                      <div className="absolute right-3 top-2.5">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-sky-500 rounded-full animate-spin" />
                      </div>
                    )}

                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => selectUserToInvite(user)}
                            className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 flex items-center gap-3"
                          >
                            <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-bold">
                                {(user.firstName || user.id)
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {user.nickname ||
                                  `${user.firstName || ""} ${
                                    user.lastName || ""
                                  }`.trim() ||
                                  user.id}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                @{user.id}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleInvite} className="flex gap-3">
                    <input
                      type="text"
                      value={inviteUserId}
                      onChange={(e) => setInviteUserId(e.target.value)}
                      placeholder="User ID will appear here..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      disabled={inviting}
                      readOnly
                    />
                    <button
                      type="submit"
                      disabled={!inviteUserId.trim() || inviting}
                      className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {inviting ? "Inviting..." : "Invite"}
                    </button>
                  </form>

                  {onlineUsers.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Quick invite from online users:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {onlineUsers.slice(0, 6).map((user) => {
                          const alreadyMember = members.some(
                            (m) => m.userId === user.id
                          );
                          if (alreadyMember) return null;
                          return (
                            <button
                              key={user.id}
                              onClick={() =>
                                selectUserToInvite({
                                  id: user.id,
                                  displayName: user.displayName,
                                })
                              }
                              className="text-xs px-3 py-2 bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200 rounded-full hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors border border-sky-200 dark:border-sky-700"
                            >
                              {user.displayName || user.id.slice(0, 8)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Group actions */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Group Actions
                </h3>
                <div className="space-y-3">
                  {!isOwner ? (
                    <button
                      onClick={handleLeave}
                      className="w-full px-4 py-3 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-800 border border-red-200 dark:border-red-700 rounded-lg transition-colors font-medium"
                    >
                      Leave Group
                    </button>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg border border-yellow-200 dark:border-yellow-700">
                      As the owner, you cannot leave the group. Transfer
                      ownership to another admin first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === "events" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Group Events
                </h3>
                {(isAdmin || isOwner) && (
                  <button
                    onClick={() => setShowCreateEvent(true)}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium text-sm flex items-center gap-2"
                  >
                    <span>+</span>
                    Create Event
                  </button>
                )}
              </div>

              <EventList
                events={events}
                loading={eventsLoading}
                onRespondToEvent={respondToEvent}
                onDeleteEvent={deleteEvent}
                currentUserId={me?.id}
                userRole={myRole}
              />
            </div>
          )}

          {/* REQUESTS TAB */}
          {activeTab === "requests" && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Join Requests ({joinRequests.length})
                </h3>
              </div>

              {loadingRequests ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-2/3"></div>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-16 h-8 bg-gray-200 dark:bg-gray-600 rounded"></div>
                        <div className="w-16 h-8 bg-gray-200 dark:bg-gray-600 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : joinRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No join requests
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    When users request to join this group, they'll appear here
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map((request) => (
                    <div
                      key={request.userId}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-sky-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg font-bold">
                          {(request.firstName || request.userId).slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {request.nickname || 
                           `${request.firstName || ""} ${request.lastName || ""}`.trim() || 
                           request.userId}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{request.userId}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveJoinRequest(request.userId)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectJoinRequest(request.userId)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <CreateEventModal
          onClose={() => setShowCreateEvent(false)}
          onCreateEvent={createEvent}
        />
      )}
    </div>
  );
}