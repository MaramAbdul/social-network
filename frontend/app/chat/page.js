"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useChatList } from "../../lib/useChat";
import { useMe } from "../../lib/useMe";
import ThreeColumnLayout from "../../components/ThreeColumnLayout";
import ChatList from "../../components/chat/ChatList";
import ChatWindow from "../../components/chat/ChatWindow";
import OnlineUsersCard from "../../components/OnlineUsersCard";
import CreateGroupModal from "../../components/chat/CreateGroupModal";

export default function ChatPage() {
  const { me, loading: meLoading } = useMe();
  const {
    dmChats,
    groups,
    groupInvitations,
    loading,
    createGroup,
    acceptGroupInvitation,
    declineGroupInvitation,
    startDMChat,
  } = useChatList();
  const [selectedChat, setSelectedChat] = useState(null); // { id, type, title }
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const searchParams = useSearchParams();

  // Handle URL parameters for direct DM links
  useEffect(() => {
    const dmUserId = searchParams.get("dm");
    const groupId = searchParams.get("group");
    const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";

    if (dmUserId && me) {
      (async () => {
        let title = dmUserId;
        try {
          const res = await fetch(`${API}/api/users/brief?id=${dmUserId}`, {
            credentials: "include",
          });
          if (res.ok) {
            const d = await res.json();
            title = d.displayName || dmUserId;
          }
        } catch {}

        startDMChat(dmUserId, title);
        setSelectedChat({ id: dmUserId, type: "dm", title });
      })();
    } else if (groupId) {
      setSelectedChat({
        id: groupId,
        type: "group",
        title: "Group Chat",
      });
    }
  }, [searchParams, me, startDMChat]);
  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-foreground">
          Please sign in to access chat
        </h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ThreeColumnLayout
        left={
          <div className="space-y-4">
            {/* Chat List Header */}
            <div className="card">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center">
                  <span className="mr-2">💬</span>
                  Messages
                </h3>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="btn btn-primary text-xs px-3 py-1 h-8 flex items-center gap-1"
                  title="Create Group"
                >
                  <span className="text-sm">+</span>
                  <span>New</span>
                </button>
              </div>
            </div>

            {/* Chat List */}
            <div className="h-[70vh] overflow-hidden">
              <ChatList
                dmChats={dmChats}
                groups={groups}
                groupInvitations={groupInvitations}
                acceptGroupInvitation={acceptGroupInvitation}
                declineGroupInvitation={declineGroupInvitation}
                loading={loading}
                selectedChat={selectedChat}
                onChatSelect={setSelectedChat}
                onStartDM={startDMChat}
              />
            </div>
          </div>
        }
        right={<OnlineUsersCard />}
      >
        {/* Main Chat Window */}
        <div className="h-[80vh] bg-card rounded-3xl shadow-lg overflow-hidden">
          {selectedChat ? (
            <ChatWindow
              chatId={selectedChat.id}
              type={selectedChat.type}
              title={selectedChat.title}
              me={me}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted h-full">
              <div className="text-center space-y-4">
                <div className="text-6xl opacity-50">💬</div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Select a conversation
                  </h2>
                  <p className="text-sm">
                    Choose a chat from the sidebar to start messaging
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ThreeColumnLayout>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreateGroup={createGroup}
        />
      )}
    </div>
  );
}
