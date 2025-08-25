// backend/pkg/handlers/presence.go
package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Presence struct {
	DB *sql.DB

	mu       sync.Mutex
	counts   map[string]int   // userID -> open connection count
	lastSeen map[string]int64 // userID -> unix seconds (heartbeat)
	ttl      time.Duration
}

func NewPresence(db *sql.DB) *Presence {
	p := &Presence{
		DB:       db,
		counts:   map[string]int{},
		lastSeen: map[string]int64{},
		ttl:      60 * time.Second, // consider offline if no heartbeat in 60s
	}
	// background janitor
	go p.pruneLoop()
	return p
}

func (p *Presence) pruneLoop() {
	t := time.NewTicker(20 * time.Second)
	defer t.Stop()
	for range t.C {
		now := time.Now().Unix()
		var changed []string
		p.mu.Lock()
		for uid, seen := range p.lastSeen {
			if now-int64(p.ttl.Seconds()) > seen {
				// stale -> force offline
				delete(p.lastSeen, uid)
				if p.counts[uid] > 0 {
					// unknown stale sockets; set to 0
					p.counts[uid] = 0
					changed = append(changed, uid)
				}
			}
		}
		p.mu.Unlock()
		// We only change internal state here. Broadcasting is done by WS handler when it knows transitions.
		_ = changed
	}
}

func (p *Presence) inc(userID string) (wentOnline bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	old := p.counts[userID]
	p.counts[userID] = old + 1
	p.lastSeen[userID] = time.Now().Unix()
	return old == 0
}

func (p *Presence) dec(userID string) (wentOffline bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	old := p.counts[userID]
	if old <= 1 {
		delete(p.counts, userID)
		delete(p.lastSeen, userID)
		return old == 1 // only broadcast offline if we actually crossed 1 -> 0
	}
	p.counts[userID] = old - 1
	// keep lastSeen
	return false
}

func (p *Presence) touch(userID string) {
	p.mu.Lock()
	if _, ok := p.counts[userID]; ok {
		p.lastSeen[userID] = time.Now().Unix()
	}
	p.mu.Unlock()
}

// GET /api/presence/online -> [{id, displayName, avatarUrl}]
type presenceUser struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	AvatarURL   *string `json:"avatarUrl,omitempty"`
}

func (p *Presence) Online(w http.ResponseWriter, r *http.Request) {
	// snapshot ids
	p.mu.Lock()
	ids := make([]string, 0, len(p.counts))
	for uid := range p.counts {
		// treat as online only if heartbeat is fresh
		if time.Now().Unix()-p.lastSeen[uid] <= int64(p.ttl.Seconds()) {
			ids = append(ids, uid)
		}
	}
	p.mu.Unlock()

	if len(ids) == 0 {
		JSON(w, 200, []presenceUser{})
		return
	}

	ph := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		ph[i] = "?"
		args[i] = id
	}
	inClause := strings.Join(ph, ",")

	q := `
SELECT
  id,
  COALESCE(
    NULLIF(nickname,''),
    NULLIF(TRIM((COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))), ''),
    CASE WHEN instr(email,'@') > 1 THEN substr(email,1,instr(email,'@')-1) ELSE email END
  ) AS display_name,
  avatar_url
FROM users
WHERE id IN (` + inClause + `)
`
	rows, err := p.DB.Query(q, args...)
	if err != nil {
		Err(w, 500, "db")
		return
	}
	defer rows.Close()

	out := []presenceUser{}
	for rows.Next() {
		var u presenceUser
		if err := rows.Scan(&u.ID, &u.DisplayName, &u.AvatarURL); err == nil {
			out = append(out, u)
		}
	}
	JSON(w, 200, out)
}
