package ws

import (
	"encoding/json"
	"log"
	"sync"
)

type Message struct {
	Type   string      `json:"type"`   // e.g. "post_created", "comment_created", "like_updated"
	Room   string      `json:"room"`   // e.g. "feed", "post:123"
	From   string      `json:"from"`   // user id (optional)
	At     int64       `json:"at"`     // unix time
	Payload interface{} `json:"payload,omitempty"`
}

type Client interface {
	Send([]byte) error
	Close() error
}

type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[Client]bool
}

func NewHub() *Hub { return &Hub{rooms: map[string]map[Client]bool{}} }

func (h *Hub) Join(room string, c Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[room] == nil {
		h.rooms[room] = map[Client]bool{}
	}
	h.rooms[room][c] = true
}

func (h *Hub) Leave(room string, c Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m := h.rooms[room]; m != nil {
		delete(m, c)
		if len(m) == 0 {
			delete(h.rooms, room)
		}
	}
}

func (h *Hub) Broadcast(room string, msg Message) {
	b, _ := json.Marshal(msg)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[room] {
		if err := c.Send(b); err != nil {
			log.Println("ws send:", err)
		}
	}
}