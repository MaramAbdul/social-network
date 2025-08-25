package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"social-network/backend/pkg/auth"
)

type NotificationsHandler struct{ DB *sql.DB }

type Notification struct {
	ID        int64   `json:"id"`
	Type      string  `json:"type"`
	ActorID   *string `json:"actorId,omitempty"`
	PostID    *int64  `json:"postId,omitempty"`
	CommentID *int64  `json:"commentId,omitempty"`
	CreatedAt string  `json:"createdAt"`
	ReadAt    *string `json:"readAt,omitempty"`
}

// GET /api/notifications?unread=1&limit=50
func (h *NotificationsHandler) List(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}

	onlyUnread := r.URL.Query().Get("unread") == "1"
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, _ := strconv.Atoi(l); n > 0 && n <= 200 {
			limit = n
		}
	}

	q := `SELECT id, type, actor_id, post_id, comment_id, created_at, read_at
	      FROM notifications WHERE user_id=? `
	if onlyUnread {
		q += `AND read_at IS NULL `
	}
	q += `ORDER BY created_at DESC LIMIT ?`

	rows, err := h.DB.Query(q, u.ID, limit)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	var out []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Type, &n.ActorID, &n.PostID, &n.CommentID, &n.CreatedAt, &n.ReadAt); err == nil {
			out = append(out, n)
		}
	}
	JSON(w, 200, out)
}

// POST /api/notifications/mark_read { "ids": [1,2,3] }
func (h *NotificationsHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var body struct {
		IDs []int64 `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		Err(w, 400, "bad json")
		return
	}

	tx, _ := h.DB.Begin()
	stmt, _ := tx.Prepare(`UPDATE notifications SET read_at=? WHERE id=? AND user_id=?`)
	now := time.Now().UTC().Format("2006-01-02 15:04:05")
	for _, id := range body.IDs {
		_, _ = stmt.Exec(now, id, u.ID)
	}
	stmt.Close()
	_ = tx.Commit()

	JSON(w, 200, map[string]any{"ok": true})
}
