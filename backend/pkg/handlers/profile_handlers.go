package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"social-network/backend/pkg/auth"
	"social-network/backend/pkg/ws"
)

type ProfileHandler struct {
	DB  *sql.DB
	Hub *ws.Hub // <-- add this so we can push WS notifications

}

type profileUser struct {
	ID        string  `json:"id"`
	FirstName *string `json:"firstName,omitempty"`
	LastName  *string `json:"lastName,omitempty"`
	Nickname  *string `json:"nickname,omitempty"`
	AboutMe   *string `json:"aboutMe,omitempty"` // maps from column 'about'
	AvatarURL *string `json:"avatarUrl,omitempty"`
	IsPublic  bool    `json:"isPublic"` // computed from column 'is_private'
}

type profileStats struct {
	Followers int `json:"followers"`
	Following int `json:"following"`
}

type profileResponse struct {
	User     profileUser  `json:"user"`
	Stats    profileStats `json:"stats"`
	Relation string       `json:"relation"` // "self" | "none" | "requested" | "following"
}

// GET /api/profile?id=<userId>
func (h *ProfileHandler) Get(w http.ResponseWriter, r *http.Request) {
	targetID := r.URL.Query().Get("id")
	if targetID == "" {
		Err(w, 400, "id required")
		return
	}

	// requester (optional)
	reqUser, _ := auth.FromRequest(h.DB, r)

	// NOTE: your users table has columns: about, is_private (NOT about_me / is_public)
	row := h.DB.QueryRow(`
		SELECT id, first_name, last_name, nickname, about, avatar_url,
			CASE WHEN is_private = 0 THEN 1 ELSE 0 END AS is_public
		FROM users WHERE id = ?`, targetID)

	var u profileUser
	if err := row.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Nickname, &u.AboutMe, &u.AvatarURL, &u.IsPublic); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			Err(w, 404, "not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	// stats
	var stats profileStats
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM follows WHERE followee_id=? AND status='accepted'`, u.ID).Scan(&stats.Followers)
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM follows WHERE follower_id=? AND status='accepted'`, u.ID).Scan(&stats.Following)

	// relation from requester to target
	rel := "none"
	if reqUser != nil {
		if reqUser.ID == u.ID {
			rel = "self"
		} else {
			var status string
			_ = h.DB.QueryRow(`SELECT status FROM follows WHERE follower_id=? AND followee_id=?`, reqUser.ID, u.ID).Scan(&status)
			switch strings.ToLower(status) {
			case "accepted":
				rel = "following"
			case "pending":
				rel = "requested"
			default:
				rel = "none"
			}
		}
	}

	JSON(w, 200, profileResponse{User: u, Stats: stats, Relation: rel})
}

// POST /api/profile/privacy  {isPublic: bool}
// POST /api/profile/privacy  { "isPublic": true, "convertOldPosts": true }
func (h *ProfileHandler) SetPrivacy(w http.ResponseWriter, r *http.Request) {
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
		IsPublic        bool `json:"isPublic"`
		ConvertOldPosts bool `json:"convertOldPosts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		Err(w, 400, "bad json")
		return
	}

	// Map to your schema: is_private = 0 when public, 1 when private
	newIsPrivate := 0
	if !body.IsPublic {
		newIsPrivate = 1
	}

	// Fetch current to know if we're changing state
	var currIsPrivate int
	if err := h.DB.QueryRow(`SELECT is_private FROM users WHERE id=?`, u.ID).Scan(&currIsPrivate); err != nil {
		Err(w, 500, "db")
		return
	}

	// Update profile privacy
	if _, err := h.DB.Exec(`UPDATE users SET is_private=? WHERE id=?`, newIsPrivate, u.ID); err != nil {
		Err(w, 500, "db")
		return
	}

	updated := int64(0)
	// Handle bulk post conversion based on privacy change direction
	if body.ConvertOldPosts {
		if body.IsPublic && currIsPrivate == 1 {
			// Converting from private profile to public profile: make posts public
			res, err := h.DB.Exec(`
				UPDATE posts
				   SET visibility='public'
				 WHERE user_id=?
				   AND visibility IN ('followers','private')`, u.ID)
			if err != nil {
				JSON(w, 200, map[string]any{"ok": true, "isPublic": body.IsPublic, "converted": 0, "note": "privacy updated; post conversion failed"})
				return
			}
			updated, _ = res.RowsAffected()
		} else if !body.IsPublic && currIsPrivate == 0 {
			// Converting from public profile to private profile: make posts followers-only
			res, err := h.DB.Exec(`
				UPDATE posts
				   SET visibility='followers'
				 WHERE user_id=?
				   AND visibility='public'`, u.ID)
			if err != nil {
				JSON(w, 200, map[string]any{"ok": true, "isPublic": body.IsPublic, "converted": 0, "note": "privacy updated; post conversion failed"})
				return
			}
			updated, _ = res.RowsAffected()
		}
	}

	JSON(w, 200, map[string]any{
		"ok":        true,
		"isPublic":  body.IsPublic,
		"converted": updated, // number of posts flipped to public
	})
}

// POST /api/follow/request  {userId: "<target>"}
func (h *ProfileHandler) FollowRequest(w http.ResponseWriter, r *http.Request) {
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
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		Err(w, 400, "bad json")
		return
	}
	if body.UserID == u.ID {
		Err(w, 400, "cannot follow self")
		return
	}

	// determine target privacy from is_private
	var isPrivate int
	if err := h.DB.QueryRow(`SELECT CASE WHEN is_private=1 THEN 1 ELSE 0 END FROM users WHERE id=?`, body.UserID).Scan(&isPrivate); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			Err(w, 404, "user not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	status := "pending"
	if isPrivate == 0 { // public target -> auto-accept
		status = "accepted"
	}

	_, err = h.DB.Exec(`
		INSERT INTO follows (follower_id, followee_id, status)
		VALUES (?,?,?)
		ON CONFLICT(follower_id, followee_id)
		DO UPDATE SET status=excluded.status
	`, u.ID, body.UserID, status)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	// after the INSERT/UPSERT that sets `status`
	if status == "pending" {
		// notify target user (they received a follow request)
		res, _ := h.DB.Exec(
			`INSERT INTO notifications (user_id, type, actor_id, created_at)
		 VALUES (?, 'follow_request', ?, datetime('now'))`,
			body.UserID, u.ID,
		)
		if h.Hub != nil && res != nil {
			id, _ := res.LastInsertId()
			h.Hub.Broadcast("user:"+body.UserID, ws.Message{
				Type: "notification",
				Payload: map[string]any{
					"id":       id,
					"type":     "follow_request",
					"actorId":  u.ID,
					"createdAt": time.Now().UTC().Format("2006-01-02 15:04:05"),
				},
			})
		}
	} else if status == "accepted" {
		// public target auto-accepts → optionally notify them someone followed
		res, _ := h.DB.Exec(
			`INSERT INTO notifications (user_id, type, actor_id, created_at)
		 VALUES (?, 'new_follower', ?, datetime('now'))`,
			body.UserID, u.ID,
		)
		if h.Hub != nil && res != nil {
			id, _ := res.LastInsertId()
			h.Hub.Broadcast("user:"+body.UserID, ws.Message{
				Type: "notification",
				Payload: map[string]any{
					"id":       id,
					"type":     "new_follower",
					"actorId":  u.ID,
					"createdAt": time.Now().UTC().Format("2006-01-02 15:04:05"),
				},
			})
		}
	}
	JSON(w, 200, map[string]any{"ok": true, "status": status})
}

// POST /api/follow/unfollow  {userId:"<target>"}
func (h *ProfileHandler) Unfollow(w http.ResponseWriter, r *http.Request) {
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
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		Err(w, 400, "bad json")
		return
	}
	if _, err := h.DB.Exec(`DELETE FROM follows WHERE follower_id=? AND followee_id=?`, u.ID, body.UserID); err != nil {
		Err(w, 500, "db")
		return
	}
	JSON(w, 200, map[string]any{"ok": true})
}

// POST /api/follow/accept   {userId:"<followerId>"}
func (h *ProfileHandler) Accept(w http.ResponseWriter, r *http.Request) {
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
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		Err(w, 400, "bad json")
		return
	}
	// ensure there's a pending row where *body.UserID follows u.ID*
	res, err := h.DB.Exec(`UPDATE follows SET status='accepted'
		WHERE follower_id=? AND followee_id=? AND status='pending'`, body.UserID, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		JSON(w, 200, map[string]any{"ok": true, "status": "noop"})
		return
	}
	// notify follower that they were accepted
	res2, _ := h.DB.Exec(
		`INSERT INTO notifications (user_id, type, actor_id, created_at)
	 VALUES (?, 'follow_accepted', ?, datetime('now'))`,
		body.UserID, u.ID, // recipient = follower, actor = me (the followee)
	)
	if h.Hub != nil && res2 != nil {
		id, _ := res2.LastInsertId()
		h.Hub.Broadcast("user:"+body.UserID, ws.Message{
			Type: "notification",
			Payload: map[string]any{
				"id":       id,
				"type":     "follow_accepted",
				"actorId":  u.ID,
				"createdAt": time.Now().UTC().Format("2006-01-02 15:04:05"),
			},
		})
	}
	JSON(w, 200, map[string]any{"ok": true, "status": "accepted"})
}

// POST /api/follow/decline {userId:"<followerId>"}
func (h *ProfileHandler) Decline(w http.ResponseWriter, r *http.Request) {
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
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		Err(w, 400, "bad json")
		return
	}
	_, err = h.DB.Exec(`DELETE FROM follows
		WHERE follower_id=? AND followee_id=? AND status='pending'`, body.UserID, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	JSON(w, 200, map[string]any{"ok": true, "status": "declined"})
}

// GET /api/follow/requests
func (h *ProfileHandler) ListRequests(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}

	rows, err := h.DB.Query(`
		SELECT f.follower_id, COALESCE(u.nickname, '') AS nickname,
		       u.first_name, u.last_name
		FROM follows f
		LEFT JOIN users u ON u.id = f.follower_id
		WHERE f.followee_id=? AND f.status='pending'
		ORDER BY f.created_at ASC
		LIMIT 200
	`, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	type req struct {
		UserID    string  `json:"userId"`
		Nickname  *string `json:"nickname,omitempty"`
		FirstName *string `json:"firstName,omitempty"`
		LastName  *string `json:"lastName,omitempty"`
	}
	var out []req
	for rows.Next() {
		var r req
		if err := rows.Scan(&r.UserID, &r.Nickname, &r.FirstName, &r.LastName); err == nil {
			out = append(out, r)
		}
	}
	JSON(w, 200, out)
}

// POST /api/profile/restrict_posts
// Makes all of the user's *public* posts become 'followers'
func (h *ProfileHandler) RestrictAllPosts(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	res, err := h.DB.Exec(`UPDATE posts SET visibility='followers' WHERE user_id=? AND visibility='public'`, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	n, _ := res.RowsAffected()
	JSON(w, 200, map[string]any{"ok": true, "updated": n})
}

// POST /api/profile/make_posts_public
func (h *ProfileHandler) MakePostsPublic(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauthenticated")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	res, err := h.DB.Exec(`UPDATE posts SET visibility='public'
		WHERE user_id=? AND visibility IN ('followers','private')`, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	n, _ := res.RowsAffected()
	JSON(w, 200, map[string]any{"ok": true, "updated": n})
}

// Enhanced profile data structure
type EnhancedProfileUser struct {
	ID        string  `json:"id"`
	Email     *string `json:"email,omitempty"`     // Only shown to self
	FirstName *string `json:"firstName,omitempty"`
	LastName  *string `json:"lastName,omitempty"`
	Nickname  *string `json:"nickname,omitempty"`
	AboutMe   *string `json:"aboutMe,omitempty"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
	DOB       *string `json:"dateOfBirth,omitempty"` // Only shown to self
	IsPublic  bool    `json:"isPublic"`
	CreatedAt string  `json:"createdAt"`
}

type PostSummary struct {
	ID        int64   `json:"id"`
	Body      string  `json:"body"`
	ImageURL  *string `json:"imageUrl,omitempty"`
	CreatedAt string  `json:"createdAt"`
	LikeCount int     `json:"likeCount"`
	IsLiked   bool    `json:"isLiked"`
}

type FollowUser struct {
	ID        string  `json:"id"`
	FirstName *string `json:"firstName,omitempty"`
	LastName  *string `json:"lastName,omitempty"`
	Nickname  *string `json:"nickname,omitempty"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
	IsPublic  bool    `json:"isPublic"`
}

type EnhancedProfileResponse struct {
	User       EnhancedProfileUser `json:"user"`
	Stats      profileStats        `json:"stats"`
	Relation   string              `json:"relation"`
	Posts      []PostSummary       `json:"posts"`
	CanViewAll bool                `json:"canViewAll"` // Whether requester can see private content
}

// GET /api/profile/enhanced?id=<userId>
func (h *ProfileHandler) GetEnhanced(w http.ResponseWriter, r *http.Request) {
	targetID := r.URL.Query().Get("id")
	if targetID == "" {
		Err(w, 400, "id required")
		return
	}

	// requester (optional)
	reqUser, _ := auth.FromRequest(h.DB, r)

	// Get user details
	row := h.DB.QueryRow(`
		SELECT id, email, first_name, last_name, nickname, about, avatar_url, dob,
			CASE WHEN is_private = 0 THEN 1 ELSE 0 END AS is_public, created_at
		FROM users WHERE id = ?`, targetID)

	var u EnhancedProfileUser
	if err := row.Scan(&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Nickname, 
		&u.AboutMe, &u.AvatarURL, &u.DOB, &u.IsPublic, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			Err(w, 404, "not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	// stats
	var stats profileStats
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM follows WHERE followee_id=? AND status='accepted'`, u.ID).Scan(&stats.Followers)
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM follows WHERE follower_id=? AND status='accepted'`, u.ID).Scan(&stats.Following)

	// relation from requester to target
	rel := "none"
	canViewAll := false
	isSelf := false

	if reqUser != nil {
		if reqUser.ID == u.ID {
			rel = "self"
			canViewAll = true
			isSelf = true
		} else {
			var status string
			_ = h.DB.QueryRow(`SELECT status FROM follows WHERE follower_id=? AND followee_id=?`, reqUser.ID, u.ID).Scan(&status)
			switch strings.ToLower(status) {
			case "accepted":
				rel = "following"
				canViewAll = true // followers can see private profiles
			case "pending":
				rel = "requested"
			default:
				rel = "none"
			}
		}
	}

	// If profile is public OR requester can view all OR no auth required, allow access
	if u.IsPublic || canViewAll {
		canViewAll = true
	}

	// Hide sensitive info if not self
	if !isSelf {
		u.Email = nil
		u.DOB = nil
	}

	// Get posts (only if can view)
	posts := []PostSummary{}
	if canViewAll {
		// Build visibility filter based on relationship
		visibilityFilter := ""
		if isSelf {
			visibilityFilter = "" // can see all own posts
		} else if rel == "following" {
			visibilityFilter = "AND (p.visibility IN ('public', 'followers'))"
		} else {
			visibilityFilter = "AND p.visibility = 'public'"
		}

		query := `
			SELECT p.id, p.body, p.image_url, p.created_at,
				   COALESCE(like_counts.count, 0) as like_count,
				   CASE WHEN user_likes.post_id IS NOT NULL THEN 1 ELSE 0 END as is_liked
			FROM posts p
			LEFT JOIN (
				SELECT post_id, COUNT(*) as count 
				FROM likes 
				GROUP BY post_id
			) like_counts ON like_counts.post_id = p.id
			LEFT JOIN likes user_likes ON user_likes.post_id = p.id AND user_likes.user_id = ?
			WHERE p.user_id = ? ` + visibilityFilter + `
			ORDER BY p.created_at DESC 
			LIMIT 20`

		requesterID := ""
		if reqUser != nil {
			requesterID = reqUser.ID
		}

		rows, err := h.DB.Query(query, requesterID, targetID)
		if err != nil {
			// Don't fail the whole request, just return empty posts
			posts = []PostSummary{}
		} else {
			defer rows.Close()
			for rows.Next() {
				var post PostSummary
				if err := rows.Scan(&post.ID, &post.Body, &post.ImageURL, &post.CreatedAt, 
					&post.LikeCount, &post.IsLiked); err == nil {
					posts = append(posts, post)
				}
			}
		}
	}

	JSON(w, 200, EnhancedProfileResponse{
		User:       u,
		Stats:      stats,
		Relation:   rel,
		Posts:      posts,
		CanViewAll: canViewAll,
	})
}

// GET /api/profile/followers?id=<userId>
func (h *ProfileHandler) GetFollowers(w http.ResponseWriter, r *http.Request) {
	targetID := r.URL.Query().Get("id")
	if targetID == "" {
		Err(w, 400, "id required")
		return
	}

	// requester (optional)
	reqUser, _ := auth.FromRequest(h.DB, r)

	// Check if target exists and get privacy
	var isPrivate int
	if err := h.DB.QueryRow(`SELECT is_private FROM users WHERE id=?`, targetID).Scan(&isPrivate); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			Err(w, 404, "user not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	// Check access permissions
	canView := false
	if reqUser != nil && reqUser.ID == targetID {
		canView = true // can see own followers
	} else if isPrivate == 0 {
		canView = true // public profile
	} else if reqUser != nil {
		// Check if requester follows target
		var followStatus string
		_ = h.DB.QueryRow(`SELECT status FROM follows WHERE follower_id=? AND followee_id=?`, reqUser.ID, targetID).Scan(&followStatus)
		if followStatus == "accepted" {
			canView = true
		}
	}

	if !canView {
		JSON(w, 200, []FollowUser{}) // Return empty list for private profiles
		return
	}

	rows, err := h.DB.Query(`
		SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar_url,
			   CASE WHEN u.is_private = 0 THEN 1 ELSE 0 END as is_public
		FROM follows f
		JOIN users u ON u.id = f.follower_id
		WHERE f.followee_id = ? AND f.status = 'accepted'
		ORDER BY u.first_name, u.last_name, u.id
		LIMIT 200`, targetID)

	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	followers := []FollowUser{}
	for rows.Next() {
		var user FollowUser
		if err := rows.Scan(&user.ID, &user.FirstName, &user.LastName, 
			&user.Nickname, &user.AvatarURL, &user.IsPublic); err == nil {
			followers = append(followers, user)
		}
	}

	JSON(w, 200, followers)
}

// GET /api/profile/following?id=<userId>
func (h *ProfileHandler) GetFollowing(w http.ResponseWriter, r *http.Request) {
	targetID := r.URL.Query().Get("id")
	if targetID == "" {
		Err(w, 400, "id required")
		return
	}

	// requester (optional)
	reqUser, _ := auth.FromRequest(h.DB, r)

	// Check if target exists and get privacy
	var isPrivate int
	if err := h.DB.QueryRow(`SELECT is_private FROM users WHERE id=?`, targetID).Scan(&isPrivate); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			Err(w, 404, "user not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	// Check access permissions
	canView := false
	if reqUser != nil && reqUser.ID == targetID {
		canView = true // can see own following
	} else if isPrivate == 0 {
		canView = true // public profile
	} else if reqUser != nil {
		// Check if requester follows target
		var followStatus string
		_ = h.DB.QueryRow(`SELECT status FROM follows WHERE follower_id=? AND followee_id=?`, reqUser.ID, targetID).Scan(&followStatus)
		if followStatus == "accepted" {
			canView = true
		}
	}

	if !canView {
		JSON(w, 200, []FollowUser{}) // Return empty list for private profiles
		return
	}

	rows, err := h.DB.Query(`
		SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar_url,
			   CASE WHEN u.is_private = 0 THEN 1 ELSE 0 END as is_public
		FROM follows f
		JOIN users u ON u.id = f.followee_id
		WHERE f.follower_id = ? AND f.status = 'accepted'
		ORDER BY u.first_name, u.last_name, u.id
		LIMIT 200`, targetID)

	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	following := []FollowUser{}
	for rows.Next() {
		var user FollowUser
		if err := rows.Scan(&user.ID, &user.FirstName, &user.LastName, 
			&user.Nickname, &user.AvatarURL, &user.IsPublic); err == nil {
			following = append(following, user)
		}
	}

	JSON(w, 200, following)
}
