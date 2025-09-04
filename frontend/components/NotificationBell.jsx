"use client";
import { useEffect, useRef, useState } from "react";
import { useMe } from "../lib/useMe";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";

export default function NotificationBell() {
  const { me } = useMe();
  const [items, setItems] = useState([]);     // always an array
  const [unread, setUnread] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!me?.id) return;
    
    let alive = true;
    
    // Load initial notifications
    (async () => {
      try {
        const res = await fetch(`${API}/api/notifications`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("fetch notifications failed");

        const data = await res.json().catch(() => null);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];

        if (!alive) return;
        setItems(list);
        setUnread(list.filter((n) => !n.readAt).length);
      } catch {
        if (!alive) return;
        setItems([]);
        setUnread(0);
      }
    })();

    // Set up WebSocket connection for real-time notifications
    const wsUrl = API.replace(/^http/i, "ws") + `/ws?room=user:${me.id}&user=${encodeURIComponent(me.id)}`;
    console.log("🔔 Connecting to notification WebSocket:", wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("✅ Notification WebSocket connected");
      };
      
      wsRef.current.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          console.log("🔔 New notification:", msg);
          
          if (msg.type === "notification" || msg.Type === "notification") {
            // Add new notification to the list
            setItems(prev => [msg.payload, ...prev]);
            setUnread(prev => prev + 1);
          }
        } catch (error) {
          console.error("Failed to parse notification message:", error);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error("Notification WebSocket error:", error);
      };
      
      wsRef.current.onclose = () => {
        console.log("❌ Notification WebSocket disconnected");
      };
    } catch (error) {
      console.error("Failed to create notification WebSocket:", error);
    }

    return () => {
      alive = false;
      try { 
        wsRef.current?.close(); 
      } catch {}
    };
  }, [me?.id]);

  async function markAllRead() {
    try {
      // Get unread notification IDs
      const unreadIds = items.filter(n => !n.readAt).map(n => n.id);
      if (unreadIds.length === 0) return;

      const res = await fetch(`${API}/api/notifications/mark_read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds })
      });
      if (!res.ok) return;
      
      // Update local state - set readAt to current time
      const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
      setItems((prev) => prev.map((n) => 
        unreadIds.includes(n.id) ? { ...n, readAt: now } : n
      ));
      setUnread(0);
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  }

  const formatNotification = (notification) => {
    const time = new Date(notification.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    switch (notification.type) {
      case 'follow_request':
        return {
          icon: '👤',
          text: `${notification.actorId} sent you a follow request`,
          time
        };
      case 'follow_accepted':
        return {
          icon: '✅',
          text: `${notification.actorId} accepted your follow request`,
          time
        };
      case 'new_follower':
        return {
          icon: '✅',
          text: `${notification.actorId} started following you`,
          time
        };
      case 'group_invite':
        return {
          icon: '👥',
          text: `You were invited to a group`,
          time
        };
      case 'event_created':
        return {
          icon: '🎉',
          text: `${notification.actorId} created a new event: ${notification.title}`,
          time
        };
      case 'group_join_request':
        return {
          icon: '📨',
          text: `${notification.actorId} wants to join your group`,
          time
        };
      case 'group_join_approved':
        return {
          icon: '✅',
          text: `${notification.actorId} approved your group join request`,
          time
        };
      case 'kicked_from_group':
        return {
          icon: '⚠️',
          text: `You were removed from a group by ${notification.actorId}`,
          time
        };
      default:
        return {
          icon: '🔔',
          text: 'New notification',
          time
        };
    }
  };

  return (
    <div className="relative">
      <button 
        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" 
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full px-2 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs px-3 py-1 bg-sky-600 text-white rounded-full hover:bg-sky-700 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {items.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <div className="text-3xl mb-2">🔔</div>
                <div className="text-sm">No notifications yet</div>
              </div>
            ) : (
              <div>
                {items.slice(0, 10).map((notification) => {
                  const formatted = formatNotification(notification);
                  return (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        !notification.readAt ? 'bg-sky-50 dark:bg-sky-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-lg">{formatted.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${!notification.readAt ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {formatted.text}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatted.time}
                          </div>
                        </div>
                        {!notification.readAt && (
                          <div className="w-2 h-2 bg-sky-500 rounded-full mt-2"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        ></div>
      )}
    </div>
  );
}