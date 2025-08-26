package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"social-network/backend/pkg/auth"
	"social-network/backend/pkg/ws"
)

type EventsHandler struct {
	DB  *sql.DB
	Hub *ws.Hub
}

type Event struct {
	ID           int64           `json:"id"`
	GroupID      int64           `json:"groupId"`
	CreatorID    string          `json:"creatorId"`
	Title        string          `json:"title"`
	Description  *string         `json:"description,omitempty"`
	EventDate    string          `json:"eventDate"`
	CreatedAt    string          `json:"createdAt"`
	Responses    *EventResponses `json:"responses,omitempty"`
	UserResponse *string         `json:"userResponse,omitempty"`
}

type EventResponses struct {
	Going    int `json:"going"`
	NotGoing int `json:"notGoing"`
}

type EventResponse struct {
	ID        int64  `json:"id"`
	EventID   int64  `json:"eventId"`
	UserID    string `json:"userId"`
	Response  string `json:"response"`
	CreatedAt string `json:"createdAt"`
}

// POST /api/events/create
func (h *EventsHandler) Create(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var body struct {
		GroupID     int64   `json:"groupId"`
		Title       string  `json:"title"`
		Description *string `json:"description"`
		EventDate   string  `json:"eventDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.GroupID == 0 || body.Title == "" || body.EventDate == "" {
		Err(w, 400, "bad json")
		return
	}

	// Validate event date format
	if _, err := time.Parse("2006-01-02T15:04", body.EventDate); err != nil {
		Err(w, 400, "invalid event date format")
		return
	}

	// Check if user is admin/owner of the group
	var role string
	err = h.DB.QueryRow(`SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, body.GroupID, u.ID).Scan(&role)
	if err != nil || (role != "owner" && role != "admin") {
		Err(w, 403, "not admin")
		return
	}

	// Create event
	res, err := h.DB.Exec(`INSERT INTO events (group_id, creator_id, title, description, event_date) 
		VALUES (?, ?, ?, ?, ?)`, body.GroupID, u.ID, body.Title, body.Description, body.EventDate)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	eventID, _ := res.LastInsertId()
	event := Event{
		ID:          eventID,
		GroupID:     body.GroupID,
		CreatorID:   u.ID,
		Title:       body.Title,
		Description: body.Description,
		EventDate:   body.EventDate,
		CreatedAt:   time.Now().UTC().Format("2006-01-02 15:04:05"),
	}

	JSON(w, 200, event)

	// Notify all group members about new event
	if h.Hub != nil {
		// Get all group members
		rows, err := h.DB.Query(`SELECT user_id FROM group_members WHERE group_id=? AND status='accepted' AND user_id<>?`, body.GroupID, u.ID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var memberID string
				if err := rows.Scan(&memberID); err == nil {
					h.Hub.Broadcast("user:"+memberID, ws.Message{
						Type: "notification",
						Payload: map[string]any{
							"type":      "event_created",
							"actorId":   u.ID,
							"eventId":   eventID,
							"groupId":   body.GroupID,
							"title":     body.Title,
							"createdAt": time.Now().UTC().Format("2006-01-02 15:04:05"),
						},
					})
				}
			}
		}
	}
}

// GET /api/events/group?groupId=123
func (h *EventsHandler) GetGroupEvents(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}

	groupID := r.URL.Query().Get("groupId")
	if groupID == "" {
		Err(w, 400, "groupId required")
		return
	}

	// Check if user is a member of the group
	var n int
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, groupID, u.ID).Scan(&n)
	if n == 0 {
		Err(w, 403, "not a member")
		return
	}

	// Get events with response counts and user's response
	rows, err := h.DB.Query(`
		SELECT 
			e.id, e.group_id, e.creator_id, e.title, e.description, e.event_date, e.created_at,
			(SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'going') as going_count,
			(SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'not_going') as not_going_count,
			(SELECT response FROM event_responses WHERE event_id = e.id AND user_id = ?) as user_response
		FROM events e 
		WHERE e.group_id = ? 
		ORDER BY e.event_date ASC`, u.ID, groupID)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var event Event
		var goingCount, notGoingCount int
		var userResponse sql.NullString

		err := rows.Scan(&event.ID, &event.GroupID, &event.CreatorID, &event.Title, &event.Description,
			&event.EventDate, &event.CreatedAt, &goingCount, &notGoingCount, &userResponse)
		if err != nil {
			continue
		}

		event.Responses = &EventResponses{
			Going:    goingCount,
			NotGoing: notGoingCount,
		}

		if userResponse.Valid {
			event.UserResponse = &userResponse.String
		}

		events = append(events, event)
	}

	JSON(w, 200, events)
}

// POST /api/events/respond
func (h *EventsHandler) Respond(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodPost {
		Err(w, 405, "method")
		return
	}

	var body struct {
		EventID  int64  `json:"eventId"`
		Response string `json:"response"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.EventID == 0 {
		Err(w, 400, "bad json")
		return
	}

	if body.Response != "going" && body.Response != "not_going" {
		Err(w, 400, "invalid response")
		return
	}

	// Check if user is member of the group that owns this event
	var groupID int64
	err = h.DB.QueryRow(`SELECT group_id FROM events WHERE id=?`, body.EventID).Scan(&groupID)
	if err != nil {
		Err(w, 404, "event not found")
		return
	}

	var n int
	_ = h.DB.QueryRow(`SELECT COUNT(*) FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, groupID, u.ID).Scan(&n)
	if n == 0 {
		Err(w, 403, "not a member")
		return
	}

	// Insert or update response
	_, err = h.DB.Exec(`INSERT OR REPLACE INTO event_responses (event_id, user_id, response) VALUES (?, ?, ?)`,
		body.EventID, u.ID, body.Response)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	JSON(w, 200, map[string]any{"ok": true, "response": body.Response})
}

// DELETE /api/events/delete?eventId=123
func (h *EventsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, 401, "unauth")
		return
	}
	if r.Method != http.MethodDelete {
		Err(w, 405, "method")
		return
	}

	eventID := r.URL.Query().Get("eventId")
	if eventID == "" {
		Err(w, 400, "eventId required")
		return
	}

	// Check if user is the creator or admin/owner of the group
	var creatorID string
	var groupID int64
	err = h.DB.QueryRow(`SELECT creator_id, group_id FROM events WHERE id=?`, eventID).Scan(&creatorID, &groupID)
	if err != nil {
		Err(w, 404, "event not found")
		return
	}

	// Allow deletion if user is creator OR admin/owner of the group
	canDelete := false
	if creatorID == u.ID {
		canDelete = true
	} else {
		var role string
		err = h.DB.QueryRow(`SELECT role FROM group_members WHERE group_id=? AND user_id=? AND status='accepted'`, groupID, u.ID).Scan(&role)
		if err == nil && (role == "owner" || role == "admin") {
			canDelete = true
		}
	}

	if !canDelete {
		Err(w, 403, "not authorized")
		return
	}

	// Delete event (cascade will delete responses)
	_, err = h.DB.Exec(`DELETE FROM events WHERE id=?`, eventID)
	if err != nil {
		Err(w, 500, "db")
		return
	}

	JSON(w, 200, map[string]any{"ok": true})
}

