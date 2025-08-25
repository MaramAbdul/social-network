package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"social-network/backend/pkg/auth"
)

type AuthHandler struct{ DB *sql.DB }

type registerReq struct {
	Email     string  `json:"email"`
	Password  string  `json:"password"`
	FirstName string  `json:"firstName"`
	LastName  string  `json:"lastName"`
	DOB       string  `json:"dob"`
	AvatarURL *string `json:"avatarUrl"`
	Nickname  *string `json:"nickname"`
	About     *string `json:"about"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		Err(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Err(w, http.StatusBadRequest, "bad json")
		return
	}
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.DOB == "" {
		Err(w, http.StatusBadRequest, "missing fields")
		return
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	id := uuid.New().String()
	_, err := h.DB.Exec(
		`INSERT INTO users(id,email,password_hash,first_name,last_name,dob,avatar_url,nickname,about,is_private,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,0,datetime('now'))`,
		id, req.Email, string(hash), req.FirstName, req.LastName, req.DOB, req.AvatarURL, req.Nickname, req.About,
	)
	if err != nil {
		Err(w, http.StatusBadRequest, "email exists?")
		return
	}
	_ = auth.CreateSession(h.DB, id, w)
	JSON(w, 200, map[string]string{"id": id})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		Err(w, http.StatusMethodNotAllowed, "method")
		return
	}
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Err(w, http.StatusBadRequest, "bad json")
		return
	}
	var id, hash string
	err := h.DB.QueryRow(`SELECT id, password_hash FROM users WHERE email = ?`, req.Email).Scan(&id, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		Err(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	_ = auth.CreateSession(h.DB, id, w)
	JSON(w, 200, map[string]string{"id": id})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	auth.ClearSession(h.DB, r, w)
	JSON(w, 200, map[string]string{"ok": "true"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	u, err := auth.FromRequest(h.DB, r)
	if err != nil {
		Err(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	JSON(w, 200, map[string]string{"id": u.ID})
}