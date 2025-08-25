package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"time"
)

const SessionCookie = "sid"

func randomID(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func CreateSession(db *sql.DB, userID string, w http.ResponseWriter) error {
	id, err := randomID(32)
	if err != nil {
		return err
	}

	exp := time.Now().UTC().Add(30 * 24 * time.Hour)
	expStr := exp.Format("2006-01-02 15:04:05") // ✅ SQLite-friendly

	_, err = db.Exec(
		`INSERT INTO sessions(id, user_id, expires_at, created_at)
         VALUES(?,?,?,datetime('now'))`,
		id, userID, expStr,
	)
	if err != nil {
		return err
	}

	c := &http.Cookie{
		Name:     SessionCookie,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  exp,
	}
	http.SetCookie(w, c)
	return nil
}
func ClearSession(db *sql.DB, r *http.Request, w http.ResponseWriter) {
	if c, err := r.Cookie(SessionCookie); err == nil {
		_, _ = db.Exec(`DELETE FROM sessions WHERE id = ?`, c.Value)
	}
	c := &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	}
	http.SetCookie(w, c)
}

type AuthedUser struct{ ID string }

func FromRequest(db *sql.DB, r *http.Request) (*AuthedUser, error) {
	c, err := r.Cookie(SessionCookie)
	if err != nil {
		return nil, errors.New("no session")
	}
	var uid string
	err = db.QueryRow(
		`SELECT user_id FROM sessions WHERE id = ? AND datetime(expires_at) > datetime('now')`,
		c.Value,
	).Scan(&uid)
	if err != nil {
		return nil, errors.New("invalid session")
	}
	return &AuthedUser{ID: uid}, nil
}
