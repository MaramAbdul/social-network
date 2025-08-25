package handlers

import (
	"net/http"
	"time"

	"social-network/backend/pkg/ws"

	"github.com/gorilla/websocket"
)

// NEW: add Presence field
type WSHandler struct {
	Hub      *ws.Hub
	Presence *Presence
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type wsClient struct{ *websocket.Conn }

func (c wsClient) Send(b []byte) error { return c.WriteMessage(websocket.TextMessage, b) }
func (c wsClient) Close() error        { return c.Conn.Close() }

func (h *WSHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	room := r.URL.Query().Get("room")
	if room == "" {
		http.Error(w, "room required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	client := wsClient{conn}

	// presence tracking
	if h.Presence != nil && room == "presence" {
		userID := r.URL.Query().Get("user")
		if userID != "" {
			if h.Presence.inc(userID) {
				// only broadcast "online" when first connection appears
				h.Hub.Broadcast("presence", ws.Message{
					Type: "online", Room: "presence", At: time.Now().Unix(),
					Payload: map[string]any{"userId": userID},
				})
			}
			// mark offline when this socket closes; only broadcast if last connection
			defer func(uid string) {
				if h.Presence.dec(uid) {
					h.Hub.Broadcast("presence", ws.Message{
						Type: "offline", Room: "presence", At: time.Now().Unix(),
						Payload: map[string]any{"userId": uid},
					})
				}
			}(userID)
			
			// single pong handler for both presence and keepalive
			conn.SetPongHandler(func(string) error {
				h.Presence.touch(userID)
				_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
				return nil
			})
			
			// send periodic pings
			go func(c *websocket.Conn, uid string) {
				ticker := time.NewTicker(25 * time.Second)
				defer ticker.Stop()
				for range ticker.C {
					if err := c.WriteMessage(websocket.PingMessage, []byte("p")); err != nil {
						return
					}
				}
			}(conn, userID)
		}
	} else {
		// regular keepalive for non-presence rooms
		conn.SetPongHandler(func(string) error {
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			return nil
		})
	}

	h.Hub.Join(room, client)
	defer h.Hub.Leave(room, client)

	// keepalive
	conn.SetReadLimit(1 << 20)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))

	for {
		mt, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if mt == websocket.TextMessage {
			h.Hub.Broadcast(room, ws.Message{
				Type:    "echo",
				Room:    room,
				Payload: string(data),
				At:      time.Now().Unix(),
			})
		}
	}
}
