package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"social-network/backend/pkg/auth"
	"social-network/backend/pkg/ws"
)

type Comment struct {
	ID        int64  `json:"id"`
	PostID    int64  `json:"postId"`
	UserID    string `json:"userId"`
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
}

type CommentHandler struct {
	DB  *sql.DB
	Hub *ws.Hub
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var req struct {
		PostID int64  `json:"postId"`
		Body   string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PostID == 0 || req.Body == "" {
		Err(w, 400, "bad json")
		return
	}
	res, err := h.DB.Exec(`INSERT INTO comments(post_id, user_id, body, created_at) VALUES(?,?,?,datetime('now'))`,
		req.PostID, u.ID, req.Body)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	id, _ := res.LastInsertId()
	out := Comment{ID: id, PostID: req.PostID, UserID: u.ID, Body: req.Body, CreatedAt: time.Now().UTC().Format("2006-01-02 15:04:05")}
	JSON(w, 200, out)

	// Broadcast via WebSocket (in goroutine to avoid blocking HTTP response)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in comment broadcast: %v", r)
			}
		}()
		if h.Hub != nil {
			room := "post:" + strconv.FormatInt(req.PostID, 10)
			h.Hub.Broadcast(room, ws.Message{
				Type: "comment_created", Room: room, From: u.ID, At: time.Now().Unix(),
				Payload: out,
			})
		}
	}()
}

func (h *CommentHandler) ListByPost(w http.ResponseWriter, r *http.Request) {
	postIDStr := r.URL.Query().Get("postId")
	if postIDStr == "" {
		Err(w, 400, "postId required")
		return
	}
	pid, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		Err(w, 400, "bad postId")
		return
	}

	rows, err := h.DB.Query(`SELECT id, post_id, user_id, body, created_at FROM comments WHERE post_id = ? ORDER BY datetime(created_at) ASC`, pid)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	var list []Comment
	for rows.Next() {
		var c Comment
		if err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.Body, &c.CreatedAt); err == nil {
			list = append(list, c)
		}
	}
	JSON(w, 200, list)
}
