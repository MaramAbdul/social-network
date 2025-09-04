"use client";
import { useEffect, useState } from "react";
import { useMe } from "./useMe";
import { api } from "./api";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";

// chatId -> { messages: [], ws, listeners:Set, type, isConnected, isLoading, pingTimer }
let globalChats = new Map();
let globalChatListeners = new Set();

function notifyChatListeners(chatId) {
  const chat = globalChats.get(chatId);
  if (!chat) return;
  const snapshot = {
    messages: chat.messages,
    isConnected: !!chat.isConnected,
    isLoading: !!chat.isLoading,
    loadingMore: !!chat.loadingMore,
    hasMoreMessages: chat.hasMoreMessages !== false,
  };
  chat.listeners.forEach((fn) => fn(snapshot));
}

function notifyGlobalListeners() {
  const list = Array.from(globalChats.keys());
  globalChatListeners.forEach((fn) => fn(list));
}

export function useChat(chatId, type = "dm") {
  const { me } = useMe();
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // subscribe/create
  useEffect(() => {
    if (!chatId) return;
    if (!globalChats.has(chatId)) {
      globalChats.set(chatId, {
        messages: [],
        ws: null,
        listeners: new Set(),
        type,
        isConnected: false,
        isLoading: true,
        loadingMore: false,
        hasMoreMessages: true,
        page: 0,
        lastLoadTime: 0,
        pingTimer: null,
      });
      notifyGlobalListeners();
    }
    const chat = globalChats.get(chatId);
    const listener = (s) => {
      setMessages(s.messages);
      setIsConnected(s.isConnected);
      setIsLoading(s.isLoading);
      setLoadingMore(s.loadingMore || false);
      setHasMoreMessages(s.hasMoreMessages !== false);
    };
    chat.listeners.add(listener);
    // push current snapshot
    listener({
      messages: chat.messages,
      isConnected: chat.isConnected,
      isLoading: chat.isLoading,
      loadingMore: chat.loadingMore || false,
      hasMoreMessages: chat.hasMoreMessages !== false,
    });

    return () => {
      chat.listeners.delete(listener);
    };
  }, [chatId, type]);

  // init history + ws
  useEffect(() => {
    if (!chatId || !me) return;
    initializeChat(chatId, type, me);
  }, [chatId, type, me]);

  const sendMessage = async (body) => {
    if (!body.trim() || !chatId || !me) return;
    if (type === "dm") {
      await api("/api/dm/send", {
        method: "POST",
        body: JSON.stringify({ to: chatId, body: body.trim() }),
      });
    } else {
      await api("/api/groups/send", {
        method: "POST",
        body: JSON.stringify({ groupId: parseInt(chatId), body: body.trim() }),
      });
    }
  };

  const loadMoreMessages = async () => {
    if (!chatId || !me || loadingMore) return;
    const chat = globalChats.get(chatId);
    if (!chat || !chat.hasMoreMessages) return;
    
    await loadMoreChatMessages(chatId, type, me);
  };

  return { 
    messages, 
    sendMessage, 
    isConnected, 
    isLoading,
    loadMoreMessages,
    hasMoreMessages,
    loadingMore
  };
}

export function useChatList() {
  const { me } = useMe();
  const [dmChats, setDmChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupInvitations, setGroupInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const [groupsData, invitationsData] = await Promise.all([
          api("/api/groups/my"),
          api("/api/groups/invitations"),
        ]);
        setGroups(Array.isArray(groupsData) ? groupsData : []);
        setGroupInvitations(
          Array.isArray(invitationsData) ? invitationsData : []
        );
      } catch (e) {
        setGroups([]);
        setGroupInvitations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

  const createGroup = async (title, description) => {
    const result = await api("/api/groups/create", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    });
    const [groupsData, invitationsData] = await Promise.all([
      api("/api/groups/my"),
      api("/api/groups/invitations"),
    ]);
    setGroups(Array.isArray(groupsData) ? groupsData : []);
    setGroupInvitations(Array.isArray(invitationsData) ? invitationsData : []);
    return result;
  };

  const acceptGroupInvitation = async (groupId) => {
    await api("/api/groups/join", {
      method: "POST",
      body: JSON.stringify({ groupId: parseInt(groupId) }),
    });
    const [groupsData, invitationsData] = await Promise.all([
      api("/api/groups/my"),
      api("/api/groups/invitations"),
    ]);
    setGroups(Array.isArray(groupsData) ? groupsData : []);
    setGroupInvitations(Array.isArray(invitationsData) ? invitationsData : []);
  };

  const declineGroupInvitation = async (groupId) => {
    await api("/api/groups/leave", {
      method: "POST",
      body: JSON.stringify({ groupId: parseInt(groupId) }),
    });
    const invitationsData = await api("/api/groups/invitations");
    setGroupInvitations(Array.isArray(invitationsData) ? invitationsData : []);
  };

  const startDMChat = (userId, title) => {
    setDmChats((prev) => {
      if (prev.find((c) => c.userId === userId)) return prev;
      return [...prev, { userId, type: "dm", title }];
    });
  };

  return {
    dmChats,
    groups,
    groupInvitations,
    loading,
    createGroup,
    acceptGroupInvitation,
    declineGroupInvitation,
    startDMChat,
  };
}

async function initializeChat(chatId, type, me) {
  const chat = globalChats.get(chatId);
  if (!chat) return;

  chat.isLoading = true;
  notifyChatListeners(chatId);

  try {
    let msgs = [];
    const limit = 10;
    if (type === "dm") {
      msgs = await api(`/api/dm/history?userId=${chatId}&limit=${limit}`);
    } else {
      msgs = await api(`/api/groups/messages?groupId=${chatId}&limit=${limit}`);
    }
    const messageArray = Array.isArray(msgs) ? msgs : [];
    chat.messages = messageArray.reverse();
    chat.hasMoreMessages = messageArray.length >= limit;
    chat.page = 0;
  } catch (e) {
    chat.messages = [];
    chat.hasMoreMessages = false;
  } finally {
    chat.isLoading = false;
    notifyChatListeners(chatId);
  }

  if (!chat.ws || chat.ws.readyState === WebSocket.CLOSED) {
    setupChatWebSocket(chatId, type, me);
  }
}

async function loadMoreChatMessages(chatId, type, me) {
  const chat = globalChats.get(chatId);
  if (!chat || chat.loadingMore) return;
  
  // Prevent rapid consecutive loading (minimum 500ms between loads)
  const now = Date.now();
  if (now - chat.lastLoadTime < 500) return;

  chat.loadingMore = true;
  chat.lastLoadTime = now;
  notifyChatListeners(chatId);

  try {
    const limit = 10;
    const offset = (chat.page + 1) * limit;
    let msgs = [];
    
    if (type === "dm") {
      msgs = await api(`/api/dm/history?userId=${chatId}&limit=${limit}&offset=${offset}`);
    } else {
      msgs = await api(`/api/groups/messages?groupId=${chatId}&limit=${limit}&offset=${offset}`);
    }
    
    const messageArray = Array.isArray(msgs) ? msgs : [];
    if (messageArray.length > 0) {
      // Prepend older messages (reverse because DB returns DESC order)
      chat.messages = [...messageArray.reverse(), ...chat.messages];
      chat.page += 1;
    }
    chat.hasMoreMessages = messageArray.length >= limit;
  } catch (e) {
    console.error("Failed to load more messages:", e);
  } finally {
    chat.loadingMore = false;
    notifyChatListeners(chatId);
  }
}

function setupChatWebSocket(chatId, type, me) {
  const chat = globalChats.get(chatId);
  if (!chat) return;

  let room;
  if (type === "dm") {
    const ids = [me.id, chatId].sort();
    room = `dm:${ids[0]}:${ids[1]}`;
  } else {
    room = `group:${chatId}`;
  }

  const wsUrl =
    API.replace(/^http/i, "ws") + `/ws?room=${encodeURIComponent(room)}`;
  const ws = new WebSocket(wsUrl);
  chat.ws = ws;

  if (chat.pingTimer) {
    clearInterval(chat.pingTimer);
    chat.pingTimer = null;
  }

  ws.onopen = () => {
    chat.isConnected = true;
    notifyChatListeners(chatId);
    chat.pingTimer = setInterval(() => {
      try {
        ws.send("ping");
      } catch {}
    }, 25000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "dm_message" && type === "dm") {
        chat.messages = [...chat.messages, data.payload];
        notifyChatListeners(chatId);
      } else if (data.type === "group_message" && type === "group") {
        chat.messages = [...chat.messages, data.payload];
        notifyChatListeners(chatId);
      }
    } catch {}
  };

  ws.onclose = () => {
    chat.isConnected = false;
    notifyChatListeners(chatId);
    if (chat.pingTimer) {
      clearInterval(chat.pingTimer);
      chat.pingTimer = null;
    }
    setTimeout(() => {
      if (globalChats.has(chatId)) setupChatWebSocket(chatId, type, me);
    }, 3000);
  };

  ws.onerror = () => {
    // keep it simple; onclose will reconnect
  };
}

export function cleanupChat(chatId) {
  const chat = globalChats.get(chatId);
  if (!chat) return;
  if (chat.pingTimer) {
    clearInterval(chat.pingTimer);
    chat.pingTimer = null;
  }
  if (chat.ws) {
    try {
      chat.ws.close();
    } catch {}
  }
  globalChats.delete(chatId);
  notifyGlobalListeners();
}
