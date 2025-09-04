package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"time"

	"social-network/backend/pkg/auth"
	"social-network/backend/pkg/ws"
)

type DMHandler struct {
	DB  *sql.DB
	Hub *ws.Hub
}

type DMMessage struct {
	ID          int64  `json:"id"`
	SenderID    string `json:"senderId"`
	RecipientID string `json:"recipientId"`
	Body        string `json:"body"`
	CreatedAt   string `json:"createdAt"`
}

// GET /api/dm/history?userId=<peer>&limit=10
func (h *DMHandler) History(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}

	peer := r.URL.Query().Get("userId")
	if peer == "" {
		Err(w, 400, "userId required")
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, _ := strconv.Atoi(l); n > 0 && n <= 100 {
			limit = n
		}
	}

	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, _ := strconv.Atoi(o); n >= 0 {
			offset = n
		}
	}

	rows, err := h.DB.Query(`
SELECT id, sender_id, recipient_id, body, created_at
FROM dm_messages
WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
ORDER BY datetime(created_at) DESC
LIMIT ? OFFSET ?`, u.ID, peer, peer, u.ID, limit, offset)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	out := []DMMessage{}
	for rows.Next() {
		var m DMMessage
		if err := rows.Scan(&m.ID, &m.SenderID, &m.RecipientID, &m.Body, &m.CreatedAt); err == nil {
			out = append(out, m)
		}
	}
	JSON(w, 200, out)
}

// POST /api/dm/send { "to": "<peerId>", "body": "hello" }
func (h *DMHandler) Send(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var body struct{ To, Body string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.To == "" || body.Body == "" {
		Err(w, 400, "bad json")
		return
	}

	res, err := h.DB.Exec(`INSERT INTO dm_messages (sender_id, recipient_id, body, created_at)
		VALUES (?,?,?, datetime('now'))`, u.ID, body.To, body.Body)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	id, _ := res.LastInsertId()

	msg := DMMessage{
		ID: id, SenderID: u.ID, RecipientID: body.To, Body: body.Body,
		CreatedAt: time.Now().UTC().Format("2006-01-02 15:04:05"),
	}
	JSON(w, 200, msg)

	// WS fanout
	ids := []string{u.ID, body.To}
	sort.Strings(ids)
	room := "dm:" + ids[0] + ":" + ids[1]
	if h.Hub != nil {
		h.Hub.Broadcast(room, ws.Message{
			Type:    "dm_message",
			Payload: msg,
		})
	}
	// Optional: also nudge recipient on their user channel
	if h.Hub != nil {
		h.Hub.Broadcast("user:"+body.To, ws.Message{
			Type:    "notification",
			Payload: map[string]any{"type": "dm", "from": u.ID},
		})
	}
}

// GET /api/dm/partners - returns users I've chatted with recently
func (h *DMHandler) Partners(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}

	// Get recent chat partners with last message timestamp
	rows, err := h.DB.Query(`
		SELECT DISTINCT 
			CASE 
				WHEN sender_id = ? THEN recipient_id 
				ELSE sender_id 
			END as partner_id,
			MAX(datetime(created_at)) as last_message_at
		FROM dm_messages 
		WHERE sender_id = ? OR recipient_id = ?
		GROUP BY partner_id
		ORDER BY last_message_at DESC
		LIMIT 10
	`, u.ID, u.ID, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	type ChatPartner struct {
		ID            string `json:"id"`
		LastMessageAt string `json:"lastMessageAt"`
	}
	partners := []ChatPartner{}
	for rows.Next() {
		var p ChatPartner
		if err := rows.Scan(&p.ID, &p.LastMessageAt); err == nil {
			partners = append(partners, p)
		}
	}
	JSON(w, 200, partners)
}
