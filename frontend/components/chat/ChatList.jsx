"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { usePresence } from "../../lib/usePresence";
import { api } from "../../lib/api";

export default function ChatList({ 
  dmChats, 
  groups, 
  groupInvitations,
  acceptGroupInvitation,
  declineGroupInvitation,
  loading, 
  selectedChat, 
  onChatSelect, 
  onStartDM 
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { onlineUsers } = usePresence();
  const [activeTab, setActiveTab] = useState("groups"); // "groups" | "dms"
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [recentPartners, setRecentPartners] = useState([]);
  const lastFetchTime = useRef(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Fetch all users for DM list (only when tab changes, not on presence updates)
  useEffect(() => {
    if (activeTab === "dms") {
      fetchAllUsers();
    }
  }, [activeTab]);

  // Update online status when presence changes (without refetching)
  useEffect(() => {
    if (allUsers.length > 0) {
      const onlineUserIds = new Set(onlineUsers.map(u => u.id));
      setAllUsers(prev => 
        prev.map(user => ({
          ...user,
          isOnline: onlineUserIds.has(user.id)
        }))
      );
    }
  }, [onlineUsers]);

const fetchAllUsers = async () => {
  // Prevent multiple simultaneous calls and respect cache
  if (loadingUsers) return;
  
  const now = Date.now();
  if (now - lastFetchTime.current < CACHE_DURATION && allUsers.length > 0) {
    return; // Use cached data
  }
  
  setLoadingUsers(true);
  try {
    const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
    
    // Fetch recent chat partners and all users in parallel
    const [partnersData, usersData] = await Promise.all([
      fetch(`${API}/api/dm/partners`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/users/search?limit=50`, { credentials: "include" }).then(r => r.ok ? r.json() : []) // Reduced from 200 to 50
    ]);

    setRecentPartners(partnersData || []);
    const onlineUserIds = new Set(onlineUsers.map(u => u.id));

    // Create a map for quick lookup of chat partners
    const partnerMap = new Map();
    (partnersData || []).forEach(p => {
      partnerMap.set(p.id, p.lastMessageAt);
    });

    // Combine all users with online status and chat history
    const enrichedUsers = await Promise.all(
      (usersData || []).map(async (user) => {
        const isOnline = onlineUserIds.has(user.id);
        const lastChatAt = partnerMap.get(user.id);
        
        // Get display name from user data or fetch if needed
        let displayName = '';
        if (user.nickname) {
          displayName = user.nickname;
        } else if (user.firstName) {
          displayName = user.firstName;
          if (user.lastName) displayName += ' ' + user.lastName;
        } else {
          displayName = user.id;
        }

        return {
          id: user.id,
          displayName,
          isOnline,
          lastChatAt,
          hasChattedBefore: !!lastChatAt
        };
      })
    );

    setAllUsers(enrichedUsers);
    lastFetchTime.current = Date.now(); // Update cache timestamp
  } catch (error) {
    console.error("Failed to fetch users:", error);
  } finally {
    setLoadingUsers(false);
  }
};

  // Sort users: recent chats first, then online status, then alphabetically
  const sortedUsers = useMemo(() => {
    return allUsers
      .filter(user => 
        (user.displayName || user.id).toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        // Recent chat partners first
        if (a.hasChattedBefore && !b.hasChattedBefore) return -1;
        if (!a.hasChattedBefore && b.hasChattedBefore) return 1;
        
        // Among recent chat partners, sort by most recent conversation
        if (a.hasChattedBefore && b.hasChattedBefore) {
          const dateA = new Date(a.lastChatAt);
          const dateB = new Date(b.lastChatAt);
          if (dateB.getTime() !== dateA.getTime()) return dateB.getTime() - dateA.getTime();
        }
        
        // Then online users first
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        
        // Finally alphabetically by display name
        const nameA = (a.displayName || a.id).toLowerCase();
        const nameB = (b.displayName || b.id).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [allUsers, searchQuery]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5">
              <div className="w-10 h-10 bg-accent/10 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-accent/10 rounded mb-1"></div>
                <div className="h-3 bg-accent/5 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filteredGroups = groups.filter(group =>
    group.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDMs = dmChats.filter(chat =>
    chat.userId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input text-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "groups"
              ? "text-accent border-b-2 border-accent bg-accent/5"
              : "text-muted hover:text-foreground"
          }`}
        >
          Groups ({filteredGroups.length})
        </button>
        <button
          onClick={() => setActiveTab("dms")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "dms"
              ? "text-accent border-b-2 border-accent bg-accent/5"
              : "text-muted hover:text-foreground"
          }`}
        >
          DMs ({filteredDMs.length})
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "groups" && (
          <div className="p-2">
            {/* Group Invitations Section */}
            {groupInvitations && groupInvitations.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-accent mb-2 px-2 flex items-center gap-1">
                  🎉 Group Invitations ({groupInvitations.length})
                </div>
                <div className="space-y-2">
                  {groupInvitations.map((group) => (
                    <div
                      key={group.id}
                      className="p-3 rounded-xl bg-accent/10 border border-accent/20"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent/20 to-accent-light/30 rounded-lg flex items-center justify-center">
                          <span className="text-accent text-xs font-bold">👥</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {group.title}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {group.description || "Group chat invitation"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await acceptGroupInvitation(group.id);
                            } catch (error) {
                              console.error("Failed to accept invitation:", error);
                            }
                          }}
                          className="flex-1 text-xs px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await declineGroupInvitation(group.id);
                            } catch (error) {
                              console.error("Failed to decline invitation:", error);
                            }
                          }}
                          className="flex-1 text-xs px-3 py-2 bg-muted/20 text-muted rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Groups Section */}
            {filteredGroups.length === 0 && (!groupInvitations || groupInvitations.length === 0) ? (
              <div className="text-center py-8 text-muted">
                <div className="text-3xl mb-2">👥</div>
                <div className="text-sm">No groups yet</div>
                <div className="text-xs">Create a group to start chatting</div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredGroups.length > 0 && (
                  <div className="text-xs font-medium text-muted mb-2 px-2">
                    My Groups ({filteredGroups.length})
                  </div>
                )}
                {filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => onChatSelect({
                      id: group.id.toString(),
                      type: "group",
                      title: group.title
                    })}
                    className={`w-full text-left p-3 rounded-xl transition-all hover:bg-accent/10 ${
                      selectedChat?.id === group.id.toString() && selectedChat?.type === "group"
                        ? "bg-accent/15 border border-accent/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-accent/20 to-accent-light/30 rounded-xl flex items-center justify-center">
                        <span className="text-accent text-sm font-bold">👥</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {group.title}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {group.description || "Group chat"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "dms" && (
          <div className="p-2">
            {loadingUsers ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-accent/5">
                    <div className="w-10 h-10 bg-accent/10 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-accent/10 rounded mb-1"></div>
                      <div className="h-3 bg-accent/5 rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <div className="text-3xl mb-2">👥</div>
                <div className="text-sm">No users found</div>
                <div className="text-xs">All registered users will appear here for messaging</div>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Recent Chats Section */}
                {sortedUsers.filter(u => u.hasChattedBefore).length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-accent mb-2 px-2 flex items-center gap-1">
                      💬 Recent Chats ({sortedUsers.filter(u => u.hasChattedBefore).length})
                    </div>
                  </div>
                )}

                {/* All Users Section */}
                {sortedUsers.filter(u => !u.hasChattedBefore).length > 0 && 
                 sortedUsers.filter(u => u.hasChattedBefore).length > 0 && (
                  <div className="mt-6 mb-3">
                    <div className="text-xs font-medium text-muted mb-2 px-2 flex items-center gap-1">
                      👥 All Users ({sortedUsers.filter(u => !u.hasChattedBefore).length})
                    </div>
                  </div>
                )}

                {/* All Users List */}
                {sortedUsers.map((user) => {
                  const displayName = user.displayName || user.id;
                  
                  return (
                    <button
                      key={user.id}
                      // onClick={() => {
                      //   onStartDM(user.id);
                      //   onChatSelect({
                      //     id: user.id,
                      //     type: "dm",
                      //     title: displayName
                      //   });
                      // }}
                      onClick={() => {
                          const title = user.displayName || user.id;
                          onStartDM(user.id, title);
                          onChatSelect({
                            id: user.id,
                            type: "dm",
                            title,
                          });
                        }}
                      className={`w-full text-left p-3 rounded-xl transition-all hover:bg-accent/10 ${
                        selectedChat?.id === user.id && selectedChat?.type === "dm"
                          ? "bg-accent/15 border border-accent/30"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-gradient-to-br from-accent/20 to-accent-light/30 rounded-full flex items-center justify-center">
                          <span className="text-accent text-sm font-bold">
                            {displayName.slice(0, 2).toUpperCase()}
                          </span>
                          {user.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate flex items-center gap-2">
                            {user.displayName ? user.displayName.slice(0, 12) : user.id.slice(0, 12)}
                            <div className="flex gap-1">
                              {user.isOnline && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                  Online
                                </span>
                              )}
                              {user.hasChattedBefore && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                  Recent
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted">
                            ID: {user.id.slice(0, 8)}
                            {user.lastChatAt && (
                              <span className="ml-2 text-accent">
                                • Last: {new Date(user.lastChatAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}