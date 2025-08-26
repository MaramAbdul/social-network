package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"social-network/backend/pkg/auth"
)

type UsersHandler struct{ DB *sql.DB }

type userBrief struct {
	ID        string  `json:"id"`
	FirstName *string `json:"firstName,omitempty"`
	LastName  *string `json:"lastName,omitempty"`
	Nickname  *string `json:"nickname,omitempty"`
	IsPublic  bool    `json:"isPublic"`
	Relation  string  `json:"relation"` // "none" | "requested" | "following"
}

// GET /api/users/search?q=<term>&limit=100
// If q is empty, returns latest users (up to limit).
func (h *UsersHandler) Search(w http.ResponseWriter, r *http.Request) {
	me, _ := auth.FromRequest(h.DB, r) // optional; still works if not logged in
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	limitStr := strings.TrimSpace(r.URL.Query().Get("limit"))
	limit := 100
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	// Build base SQL: we LEFT JOIN follows where the requester is the follower.
	// This lets us compute relation per row.
	base := `
SELECT u.id, u.first_name, u.last_name, u.nickname,
       CASE WHEN u.is_private = 0 THEN 1 ELSE 0 END AS is_public,
       COALESCE(f.status, '') AS rel_status
FROM users u
LEFT JOIN follows f
  ON f.follower_id = ? AND f.followee_id = u.id
`

	params := []any{""}
	if me != nil {
		params[0] = me.ID
	}

	where := `WHERE 1=1 `
	if me != nil {
		where += `AND u.id <> ? `
		params = append(params, me.ID) // exclude self
	}

	if q == "" {
		where += ``
	} else {
		where += `AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.nickname LIKE ?) `
		like := "%" + q + "%"
		params = append(params, like, like, like, like)
	}

	orderLimit := `ORDER BY u.created_at DESC LIMIT ?`
	params = append(params, limit)

	sqlStr := base + where + orderLimit

	rows, err := h.DB.Query(sqlStr, params...)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	out := []userBrief{}
	for rows.Next() {
		var u userBrief
		var relStatus string
		if err := rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Nickname, &u.IsPublic, &relStatus); err != nil {
			continue
		}
		switch strings.ToLower(relStatus) {
		case "accepted":
			u.Relation = "following"
		case "pending":
			u.Relation = "requested"
		default:
			u.Relation = "none"
		}
		out = append(out, u)
	}
	JSON(w, 200, out)
}

// GET /api/users/brief?id=<userId>
func (h *UsersHandler) Brief(w http.ResponseWriter, r *http.Request) {
	me, _ := auth.FromRequest(h.DB, r) // optional
	targetID := r.URL.Query().Get("id")
	if targetID == "" {
		Err(w, 400, "id required")
		return
	}

	meID := ""
	if me != nil {
		meID = me.ID
	}
	
	row := h.DB.QueryRow(`
		SELECT u.id, u.first_name, u.last_name, u.nickname, u.avatar_url,
			   CASE WHEN u.is_private = 0 THEN 1 ELSE 0 END as is_public,
		       COALESCE(f.status, '') AS rel_status
		FROM users u
		LEFT JOIN follows f ON f.follower_id = ? AND f.followee_id = u.id
		WHERE u.id = ?`, meID, targetID)

	var user struct {
		ID          string  `json:"id"`
		FirstName   *string `json:"firstName,omitempty"`
		LastName    *string `json:"lastName,omitempty"`
		Nickname    *string `json:"nickname,omitempty"`
		AvatarURL   *string `json:"avatarUrl,omitempty"`
		IsPublic    bool    `json:"isPublic"`
		DisplayName string  `json:"displayName"`
		Relation    string  `json:"relation"`
	}
	
	var relStatus string
	if err := row.Scan(&user.ID, &user.FirstName, &user.LastName, 
		&user.Nickname, &user.AvatarURL, &user.IsPublic, &relStatus); err != nil {
		if strings.Contains(err.Error(), "no rows") {
			Err(w, 404, "user not found")
			return
		}
		Err(w, 500, "db")
		return
	}

	// Compute display name
	if user.Nickname != nil && *user.Nickname != "" {
		user.DisplayName = *user.Nickname
	} else if user.FirstName != nil && *user.FirstName != "" {
		name := *user.FirstName
		if user.LastName != nil && *user.LastName != "" {
			name += " " + *user.LastName
		}
		user.DisplayName = name
	} else {
		user.DisplayName = user.ID
	}

	// Compute relation
	if me != nil && me.ID == user.ID {
		user.Relation = "self"
	} else {
		switch strings.ToLower(relStatus) {
		case "accepted":
			user.Relation = "following"
		case "pending":
			user.Relation = "requested"
		default:
			user.Relation = "none"
		}
	}

	JSON(w, 200, user)
}
