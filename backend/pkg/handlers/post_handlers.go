package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"social-network/backend/pkg/auth"
	"social-network/backend/pkg/ws"
)

type PostHandler struct {
	DB  *sql.DB
	Hub *ws.Hub // can be nil if you don't want realtime
}

type Post struct {
	ID           int64   `json:"id"`
	UserID       string  `json:"userId"`
	Body         string  `json:"body"`
	ImageURL     *string `json:"imageUrl,omitempty"`
	Visibility   string  `json:"visibility"` // NEW
	CreatedAt    string  `json:"createdAt"`
	LikeCount    int     `json:"likeCount"`
	CommentCount int     `json:"commentCount"`
	Liked        bool    `json:"liked,omitempty"`
}

// canViewPost checks if viewer can see post according to visibility rules.
// If viewerID is empty (not logged in), only 'public' is visible.
func canViewPost(db *sql.DB, postID string, viewerID string) (bool, error) {
	var authorID, visibility string
	if err := db.QueryRow(`SELECT user_id, visibility FROM posts WHERE id=?`, postID).
		Scan(&authorID, &visibility); err != nil {
		return false, err
	}
	if viewerID == "" {
		return visibility == "public", nil
	}
	if viewerID == authorID {
		return true, nil
	}
	switch visibility {
	case "public":
		return true, nil
	case "followers":
		// viewer must be an accepted follower of the author
		var n int
		err := db.QueryRow(`SELECT COUNT(*) FROM follows WHERE follower_id=? AND followee_id=? AND status='accepted'`,
			viewerID, authorID).Scan(&n)
		return err == nil && n > 0, err
	case "private":
		var n int
		err := db.QueryRow(`SELECT COUNT(*) FROM post_allowed WHERE post_id=? AND user_id=?`,
			postID, viewerID).Scan(&n)
		return err == nil && n > 0, err
	default:
		return false, nil
	}
}
func (h *PostHandler) Create(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var p struct {
		Body       string   `json:"body"`
		ImageURL   *string  `json:"imageUrl"`
		Visibility string   `json:"visibility"`           // "public" | "followers" | "private"
		AllowedIDs []string `json:"allowedIds,omitempty"` // only for "private"
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil || p.Body == "" {
		Err(w, 400, "bad json")
		return
	}

	vis := p.Visibility
	if vis == "" {
		vis = "public"
	}
	if vis != "public" && vis != "followers" && vis != "private" {
		Err(w, 400, "bad visibility")
		return
	}

	res, err := h.DB.Exec(
		`INSERT INTO posts (user_id, body, image_url, visibility, created_at)
		 VALUES (?,?,?,?,datetime('now'))`,
		u.ID, p.Body, p.ImageURL, vis,
	)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	id, _ := res.LastInsertId()

	// If private, add allow-list entries
	if vis == "private" && len(p.AllowedIDs) > 0 {
		tx, _ := h.DB.Begin()
		stmt, _ := tx.Prepare(`INSERT OR IGNORE INTO post_allowed (post_id, user_id) VALUES (?,?)`)
		for _, aid := range p.AllowedIDs {
			aid = strings.TrimSpace(aid)
			if aid == "" || aid == u.ID {
				continue
			}
			_, _ = stmt.Exec(id, aid)
		}
		stmt.Close()
		_ = tx.Commit()
	}

	out := Post{
		ID:         id,
		UserID:     u.ID,
		Body:       p.Body,
		ImageURL:   p.ImageURL,
		Visibility: vis,
		CreatedAt:  time.Now().UTC().Format("2006-01-02 15:04:05"),
	}
	JSON(w, 200, out)

	if h.Hub != nil {
		h.Hub.Broadcast("feed", ws.Message{
			Type: "post_created", Room: "feed", From: u.ID, At: time.Now().Unix(),
			Payload: out,
		})
	}
}
func (h *PostHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, _ := strconv.Atoi(l); n > 0 && n <= 100 {
			limit = n
		}
	}
	viewerID := ""
	if u, err := auth.FromRequest(h.DB, r); err == nil {
		viewerID = u.ID
	}

	// Base: newest first
	// Visibility rule:
	// - public
	// - OR author == viewer
	// - OR followers & viewer follows author (accepted)
	// - OR private & viewer in post_allowed
	rows, err := h.DB.Query(`
SELECT p.id, p.user_id, p.body, p.image_url, p.visibility, p.created_at,
  IFNULL(l.cnt,0) as like_count,
  IFNULL(c.cnt,0) as comment_count,
  CASE WHEN ul.post_id IS NULL THEN 0 ELSE 1 END as liked
FROM posts p
LEFT JOIN (SELECT post_id, COUNT(*) cnt FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
LEFT JOIN (SELECT post_id, COUNT(*) cnt FROM comments GROUP BY post_id) c ON c.post_id = p.id
LEFT JOIN (SELECT post_id FROM post_likes WHERE user_id=? ) ul ON ul.post_id = p.id
WHERE
  p.visibility = 'public'
  OR (? <> '' AND p.user_id = ?)
  OR (? <> '' AND p.visibility = 'followers' AND EXISTS (
      SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followee_id=p.user_id AND f.status='accepted'
  ))
  OR (? <> '' AND p.visibility = 'private' AND EXISTS (
      SELECT 1 FROM post_allowed pa WHERE pa.post_id=p.id AND pa.user_id=?
  ))
ORDER BY p.created_at DESC
LIMIT ?`,
		viewerID,           // ul subquery
		viewerID, viewerID, // author == viewer
		viewerID, viewerID, // followers branch
		viewerID, viewerID, // private branch
		limit,
	)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	type postRow struct {
		ID, UserID, Body string
		ImageURL         *string
		Visibility       string
		CreatedAt        string
		LikeCount        int
		CommentCount     int
		Liked            int
	}
	out := []map[string]any{}
	for rows.Next() {
		var r postRow
		if err := rows.Scan(&r.ID, &r.UserID, &r.Body, &r.ImageURL, &r.Visibility, &r.CreatedAt, &r.LikeCount, &r.CommentCount, &r.Liked); err != nil {
			continue
		}
		out = append(out, map[string]any{
			"id": r.ID, "userId": r.UserID, "body": r.Body, "imageUrl": r.ImageURL,
			"visibility": r.Visibility, "createdAt": r.CreatedAt,
			"likeCount": r.LikeCount, "commentCount": r.CommentCount,
			"liked": r.Liked == 1,
		})
	}
	JSON(w, 200, out)
}
func (h *PostHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	rows, err := h.DB.Query(`
	SELECT
		p.id, p.user_id, p.body, p.image_url, p.visibility, p.created_at,
		(SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id),
		(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)
	FROM posts p WHERE p.user_id = ?
	ORDER BY datetime(p.created_at) DESC`, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	var list []Post
	for rows.Next() {
		var x Post
		if err := rows.Scan(
			&x.ID, &x.UserID, &x.Body, &x.ImageURL, &x.Visibility,
			&x.CreatedAt, &x.LikeCount, &x.CommentCount,
		); err == nil {
			list = append(list, x)
		}
	}
	JSON(w, 200, list)
}

func (h *PostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		Err(w, 405, "method")
		return
	}

	var payload struct {
		ID int64 `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.ID == 0 {
		Err(w, 400, "bad json")
		return
	}
	res, err := h.DB.Exec(`DELETE FROM posts WHERE id = ? AND user_id = ?`, payload.ID, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	aff, _ := res.RowsAffected()
	if aff == 0 {
		Err(w, 404, "not found")
		return
	}
	JSON(w, 200, map[string]any{"ok": true, "id": payload.ID})

	if h.Hub != nil {
		h.Hub.Broadcast("feed", ws.Message{
			Type: "post_deleted", Room: "feed", From: u.ID, At: time.Now().Unix(),
			Payload: map[string]any{"id": payload.ID},
		})
	}
}

func (h *PostHandler) ToggleLike(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var payload struct {
		PostID int64 `json:"postId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.PostID == 0 {
		Err(w, 400, "bad json")
		return
	}
	ok, err := canViewPost(h.DB, strconv.FormatInt(payload.PostID, 10), u.ID)
	if err != nil || !ok {
		Err(w, 403, "forbidden")
		return
	}
	// Check if user already liked
	var exists int
	_ = h.DB.QueryRow(`SELECT COUNT(1) FROM post_likes WHERE post_id=? AND user_id=?`, payload.PostID, u.ID).Scan(&exists)

	if exists > 0 {
		// Unlike
		_, err = h.DB.Exec(`DELETE FROM post_likes WHERE post_id=? AND user_id=?`, payload.PostID, u.ID)
		if err != nil {
			Err(w, 500, "db delete")
			return
		}
	} else {
		// Like
		_, err = h.DB.Exec(`INSERT INTO post_likes(post_id, user_id, created_at) VALUES(?,?,datetime('now'))`, payload.PostID, u.ID)
		if err != nil {
			Err(w, 500, "db insert")
			return
		}
	}

	// Return current state
	var liked int
	_ = h.DB.QueryRow(`SELECT COUNT(1) FROM post_likes WHERE post_id=? AND user_id=?`, payload.PostID, u.ID).Scan(&liked)

	var total int
	_ = h.DB.QueryRow(`SELECT COUNT(1) FROM post_likes WHERE post_id=?`, payload.PostID).Scan(&total)

	JSON(w, 200, map[string]any{
		"liked": liked == 1,
		"likes": total,
	})

	// Broadcast via WebSocket
	if h.Hub != nil {
		room := "post:" + strconv.FormatInt(payload.PostID, 10)
		h.Hub.Broadcast(room, ws.Message{
			Type: "like_updated", Room: room, From: u.ID, At: time.Now().Unix(),
			Payload: map[string]any{"postId": payload.PostID, "liked": liked == 1, "likes": total},
		})
		h.Hub.Broadcast("feed", ws.Message{
			Type: "like_updated", Room: "feed", From: u.ID, At: time.Now().Unix(),
			Payload: map[string]any{"postId": payload.PostID, "liked": liked == 1, "likes": total},
		})
	}
}

// PUT /api/posts/{id}/privacy - Update privacy of a specific post
func (h *PostHandler) UpdatePrivacy(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPut {
		Err(w, 405, "method")
		return
	}

	postIDStr := strings.TrimPrefix(r.URL.Path, "/api/posts/")
	postIDStr = strings.TrimSuffix(postIDStr, "/privacy")
	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		Err(w, 400, "invalid post ID")
		return
	}

	var req struct {
		Visibility string   `json:"visibility"`           // "public" | "followers" | "private"
		AllowedIDs []string `json:"allowedIds,omitempty"` // only for "private"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Err(w, 400, "bad json")
		return
	}

	// Validate visibility
	if req.Visibility != "public" && req.Visibility != "followers" && req.Visibility != "private" {
		Err(w, 400, "invalid visibility")
		return
	}

	// Check if user owns the post
	var authorID string
	if err := h.DB.QueryRow(`SELECT user_id FROM posts WHERE id=?`, postID).Scan(&authorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			Err(w, 404, "post not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	if authorID != u.ID {
		Err(w, 403, "not your post")
		return
	}

	// Update post visibility
	if _, err := h.DB.Exec(`UPDATE posts SET visibility=? WHERE id=?`, req.Visibility, postID); err != nil {
		Err(w, 500, "db")
		return
	}

	// Handle private post allowed users
	if req.Visibility == "private" {
		// Clear existing allowed users
		if _, err := h.DB.Exec(`DELETE FROM post_allowed WHERE post_id=?`, postID); err != nil {
			Err(w, 500, "db")
			return
		}

		// Add new allowed users if provided
		if len(req.AllowedIDs) > 0 {
			tx, err := h.DB.Begin()
			if err != nil {
				Err(w, 500, "db")
				return
			}
			defer tx.Rollback()

			stmt, err := tx.Prepare(`INSERT OR IGNORE INTO post_allowed (post_id, user_id) VALUES (?,?)`)
			if err != nil {
				Err(w, 500, "db")
				return
			}
			defer stmt.Close()

			for _, allowedID := range req.AllowedIDs {
				allowedID = strings.TrimSpace(allowedID)
				if allowedID == "" || allowedID == u.ID {
					continue
				}
				if _, err := stmt.Exec(postID, allowedID); err != nil {
					Err(w, 500, "db")
					return
				}
			}

			if err := tx.Commit(); err != nil {
				Err(w, 500, "db")
				return
			}
		}
	} else {
		// For non-private posts, clear allowed users
		if _, err := h.DB.Exec(`DELETE FROM post_allowed WHERE post_id=?`, postID); err != nil {
			Err(w, 500, "db")
			return
		}
	}

	JSON(w, 200, map[string]any{"ok": true, "visibility": req.Visibility})
}
