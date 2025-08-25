package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"social-network/backend/pkg/auth"
	"social-network/backend/pkg/ws"
)

type GroupHandler struct {
	DB  *sql.DB
	Hub *ws.Hub
}

type Group struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	OwnerID     string  `json:"ownerId"`
	CreatedAt   string  `json:"createdAt"`
}

type GroupMessage struct {
	ID        int64  `json:"id"`
	GroupID   int64  `json:"groupId"`
	SenderID  string `json:"senderId"`
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
}

// POST /api/groups/create {title, description}
func (h *GroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}
	var b struct {
		Title       string
		Description *string
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Title == "" {
		Err(w, 400, "bad json")
		return
	}
	res, err := h.DB.Exec(`INSERT INTO groups (owner_id, title, description) VALUES (?,?,?)`,
		u.ID, b.Title, b.Description)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	gid, _ := res.LastInsertId()
	_, _ = h.DB.Exec(`INSERT INTO group_members (group_id, user_id, role, status) VALUES (?,?, 'owner','accepted')`,
		gid, u.ID)
	JSON(w, 200, map[string]any{"ok": true, "id": gid})
}

// GET /api/groups/my
func (h *GroupHandler) MyGroups(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	rows, err := h.DB.Query(`
SELECT g.id, g.title, g.description, g.owner_id, g.created_at
FROM groups g
JOIN group_members m ON m.group_id = g.id AND m.user_id=? AND m.status='accepted'
ORDER BY datetime(g.created_at) DESC`, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()
	out := []Group{}
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Title, &g.Description, &g.OwnerID, &g.CreatedAt); err == nil {
			out = append(out, g)
		}
	}
	JSON(w, 200, out)
}

// GET /api/groups/messages?groupId=123&limit=50
func (h *GroupHandler) History(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}

	gid := r.URL.Query().Get("groupId")
	if gid == "" {
		Err(w, 400, "groupId required")
		return
	}

	// (Optional) ensure user is a member:
	var n int
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, gid, u.ID).Scan(&n)
	if n == 0 {
		Err(w, 403, "not a member")
		return
	}

	limit := 50
	rows, err := h.DB.Query(`
SELECT id, group_id, sender_id, body, created_at
FROM group_messages WHERE group_id=?
ORDER BY datetime(created_at) DESC LIMIT ?`, gid, limit)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()
	out := []GroupMessage{}
	for rows.Next() {
		var m GroupMessage
		if err := rows.Scan(&m.ID, &m.GroupID, &m.SenderID, &m.Body, &m.CreatedAt); err == nil {
			out = append(out, m)
		}
	}
	JSON(w, 200, out)
}

// POST /api/groups/send {groupId, body}
func (h *GroupHandler) Send(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}
	var b struct {
		GroupId int64  `json:"groupId"`
		Body    string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.GroupId == 0 || b.Body == "" {
		Err(w, 400, "bad json")
		return
	}
	// (Optional) check membership
	var n int
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, b.GroupId, u.ID).Scan(&n)
	if n == 0 {
		Err(w, 403, "not a member")
		return
	}

	res, err := h.DB.Exec(`INSERT INTO group_messages(group_id, sender_id, body, created_at)
		VALUES (?,?,?, datetime('now'))`, b.GroupId, u.ID, b.Body)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	id, _ := res.LastInsertId()

	msg := GroupMessage{
		ID: id, GroupID: b.GroupId, SenderID: u.ID, Body: b.Body,
		CreatedAt: time.Now().UTC().Format("2006-01-02 15:04:05"),
	}
	JSON(w, 200, msg)

	if h.Hub != nil {
		room := "group:" + strconv.FormatInt(b.GroupId, 10)
		h.Hub.Broadcast(room, ws.Message{Type: "group_message", Payload: msg})
	}
}

// GET /api/groups/members?groupId=123
func (h *GroupHandler) Members(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}

	gid := r.URL.Query().Get("groupId")
	if gid == "" {
		Err(w, 400, "groupId required")
		return
	}

	// Check if user is a member
	var n int
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, gid, u.ID).Scan(&n)
	if n == 0 {
		Err(w, 403, "not a member")
		return
	}

	rows, err := h.DB.Query(`
SELECT m.user_id, m.role, m.status, m.created_at
FROM group_members m 
WHERE m.group_id=? AND m.status='accepted'
ORDER BY 
  CASE m.role 
    WHEN 'owner' THEN 1 
    WHEN 'admin' THEN 2 
    ELSE 3 
  END, 
  datetime(m.created_at) ASC`, gid)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	type Member struct {
		UserID    string `json:"userId"`
		Role      string `json:"role"`
		Status    string `json:"status"`
		CreatedAt string `json:"createdAt"`
	}

	out := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.UserID, &m.Role, &m.Status, &m.CreatedAt); err == nil {
			out = append(out, m)
		}
	}
	JSON(w, 200, out)
}

// POST /api/groups/invite {groupId, userId}
func (h *GroupHandler) Invite(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var b struct {
		GroupId int64  `json:"groupId"`
		UserId  string `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.GroupId == 0 || b.UserId == "" {
		Err(w, 400, "bad json")
		return
	}

	// Check if requester is admin/owner
	var role string
	err = h.DB.QueryRow(`SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, b.GroupId, u.ID).Scan(&role)
	if err != nil || (role != "owner" && role != "admin") {
		Err(w, 403, "not admin")
		return
	}

	// Check if user already exists in group
	var existing int
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id=? AND user_id=?`, b.GroupId, b.UserId).Scan(&existing)
	if existing > 0 {
		Err(w, 409, "already member or invited")
		return
	}

	// Add user as invited
	_, err = h.DB.Exec(`INSERT INTO group_members (group_id, user_id, role, status) VALUES (?, ?, 'member', 'invited')`, b.GroupId, b.UserId)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	JSON(w, 200, map[string]any{"ok": true})

	// Notify invited user via WebSocket
	if h.Hub != nil {
		h.Hub.Broadcast("user:"+b.UserId, ws.Message{
			Type:    "group_invite",
			Payload: map[string]any{"groupId": b.GroupId, "invitedBy": u.ID},
		})
	}
}

// POST /api/groups/join {groupId} - accept invitation
func (h *GroupHandler) Join(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var b struct {
		GroupId int64 `json:"groupId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.GroupId == 0 {
		Err(w, 400, "bad json")
		return
	}

	// Update invitation status to accepted
	res, err := h.DB.Exec(`UPDATE group_members SET status='accepted' WHERE group_id=? AND user_id=? AND status='invited'`, b.GroupId, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		Err(w, 404, "no invitation found")
		return
	}

	JSON(w, 200, map[string]any{"ok": true})
}

// POST /api/groups/leave {groupId}
func (h *GroupHandler) Leave(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var b struct {
		GroupId int64 `json:"groupId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.GroupId == 0 {
		Err(w, 400, "bad json")
		return
	}

	// Check if user is owner (owners can't leave, must transfer ownership first)
	var role string
	err = h.DB.QueryRow(`SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, b.GroupId, u.ID).Scan(&role)
	if err != nil {
		Err(w, 404, "not a member")
		return
	}
	if role == "owner" {
		Err(w, 400, "owner cannot leave group")
		return
	}

	// Remove from group
	_, err = h.DB.Exec(`DELETE FROM group_members WHERE group_id=? AND user_id=?`, b.GroupId, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	JSON(w, 200, map[string]any{"ok": true})
}

// GET /api/groups/invitations - get pending invitations for current user
func (h *GroupHandler) PendingInvitations(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}

	rows, err := h.DB.Query(`
SELECT g.id, g.title, g.description, g.owner_id, g.created_at
FROM groups g
JOIN group_members m ON m.group_id = g.id AND m.user_id=? AND m.status='invited'
ORDER BY datetime(g.created_at) DESC`, u.ID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()
	out := []Group{}
	for rows.Next() {
		var g Group
		if err := rows.Scan(&g.ID, &g.Title, &g.Description, &g.OwnerID, &g.CreatedAt); err == nil {
			out = append(out, g)
		}
	}
	JSON(w, 200, out)
}

// POST /api/groups/promote {groupId, userId} - promote member to admin (owner only)
func (h *GroupHandler) Promote(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var b struct {
		GroupId int64  `json:"groupId"`
		UserId  string `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.GroupId == 0 || b.UserId == "" {
		Err(w, 400, "bad json")
		return
	}

	// Check if requester is owner
	var role string
	err = h.DB.QueryRow(`SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, b.GroupId, u.ID).Scan(&role)
	if err != nil || role != "owner" {
		Err(w, 403, "only owner can promote")
		return
	}

	// Promote user to admin
	res, err := h.DB.Exec(`UPDATE group_members SET role='admin' WHERE group_id=? AND user_id=? AND status='accepted' AND role='member'`, b.GroupId, b.UserId)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		Err(w, 404, "user not found or already admin")
		return
	}

	JSON(w, 200, map[string]any{"ok": true})
}
