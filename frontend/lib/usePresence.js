"use client";
import { useEffect, useState } from "react";
import { useMe } from "./useMe";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";

// normalize any shape → { id, displayName?, avatarUrl? }
function norm(item) {
  if (!item) return null;
  if (typeof item === "string") return { id: item };
  if (typeof item === "object") {
    const id = item.id ?? item.userId ?? "";
    return {
      id,
      displayName: item.displayName ?? item.name ?? null,
      avatarUrl: item.avatarUrl ?? null,
    };
  }
  return null;
}

// Global presence state (singleton)
let globalOnlineUsers = [];
let globalConnectionStatus = "disconnected";
let globalListeners = new Set();
let globalWs = null;
let pingTimer = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let currentPresenceUser = null;

// Notify listeners
function notifyListeners() {
  const snapshot = {
    onlineUsers: [...globalOnlineUsers],
    connectionStatus: globalConnectionStatus,
  };
  globalListeners.forEach((fn) => fn(snapshot));
}

export function usePresence() {
  const { me } = useMe();
  const [state, setState] = useState({
    onlineUsers: globalOnlineUsers,
    connectionStatus: globalConnectionStatus,
  });

  // subscribe
  useEffect(() => {
    const listener = (s) => setState(s);
    globalListeners.add(listener);
    // immediate push
    listener({
      onlineUsers: globalOnlineUsers,
      connectionStatus: globalConnectionStatus,
    });
    return () => globalListeners.delete(listener);
  }, []);

  // connect once per session for this user
  useEffect(() => {
    if (!me?.id) return;

    // avoid duplicate connects for same user
    if (
      currentPresenceUser === me.id &&
      globalWs &&
      (globalWs.readyState === WebSocket.OPEN ||
        globalWs.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    initializeGlobalPresence(me);
  }, [me?.id]);

  return state;
}

export function resetPresenceConnection() {
  reconnectAttempts = 0;
  globalConnectionStatus = "disconnected";
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (globalWs) {
    try {
      globalWs.close();
    } catch {}
    globalWs = null;
  }
  currentPresenceUser = null;
  notifyListeners();
}

async function initializeGlobalPresence(me) {
  if (reconnectAttempts >= maxReconnectAttempts) {
    globalConnectionStatus = "failed";
    notifyListeners();
    return;
  }

  // close previous if any
  if (globalWs) {
    try {
      globalWs.close();
    } catch {}
    globalWs = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  currentPresenceUser = me.id;

  // initial snapshot
  try {
    const res = await fetch(`${API}/api/presence/online`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    globalOnlineUsers = (Array.isArray(data) ? data : [])
      .map(norm)
      .filter(Boolean)
      .filter((u) => u.id !== me.id);
    globalConnectionStatus = "connecting";
    notifyListeners();
  } catch {
    globalOnlineUsers = [];
    globalConnectionStatus = "error";
    notifyListeners();
  }

  // connect WS
  const url =
    API.replace(/^http/i, "ws") +
    "/ws?room=presence&user=" +
    encodeURIComponent(me.id);
  try {
    globalWs = new WebSocket(url);
    reconnectAttempts++;
  } catch (err) {
    globalConnectionStatus = "error";
    notifyListeners();
    return;
  }

  globalWs.onopen = () => {
    globalConnectionStatus = "connected";
    reconnectAttempts = 0;
    // heartbeat every 25s
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      try {
        globalWs?.send("ping");
      } catch {}
    }, 25000);
    notifyListeners();
  };

  const scheduleReconnect = (ms) => {
    setTimeout(() => {
      if (
        currentPresenceUser === me.id &&
        reconnectAttempts < maxReconnectAttempts
      ) {
        initializeGlobalPresence(me);
      }
    }, ms);
  };

  globalWs.onclose = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    globalConnectionStatus = "disconnected";
    notifyListeners();
    scheduleReconnect(5000);
  };

  globalWs.onerror = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    globalConnectionStatus = "error";
    notifyListeners();
    scheduleReconnect(3000);
  };

  globalWs.onmessage = async (e) => {
    try {
      const msg = JSON.parse(e.data);
      const t = msg.type || msg.Type;
      const userId = msg?.payload?.userId;
      if (!t || !userId) return;

      if (userId === me.id) return; // ignore self

      if (t === "online") {
        // Just add user as online (WebSocket already provides basic info)
        upsertUser(msg.user || { id: userId });
      } else if (t === "offline") {
        removeUser(userId);
      }
    } catch {}
  };
}

function upsertUser(user) {
  const u = norm(user);
  if (!u || !u.id) return;
  const i = globalOnlineUsers.findIndex((x) => x.id === u.id);
  if (i === -1) globalOnlineUsers.push(u);
  else globalOnlineUsers[i] = { ...globalOnlineUsers[i], ...u };
  notifyListeners();
}

function removeUser(userId) {
  globalOnlineUsers = globalOnlineUsers.filter((u) => u.id !== userId);
  notifyListeners();
}
