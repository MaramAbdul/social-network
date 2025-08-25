package main

import (
	"log"
	"net/http"
	"os"
	"time"

	sqlite "social-network/backend/pkg/db"
	"social-network/backend/pkg/handlers"
	"social-network/backend/pkg/ws"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	port := env("PORT", "8080")
	dbPath := env("SQLITE_PATH", "./socialnet.db")
	frontend := env("FRONTEND_ORIGIN", "http://localhost:3000")

	db, err := sqlite.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	mux := http.NewServeMux()

	hub := ws.NewHub()
	presence := handlers.NewPresence(db)
	wsh := &handlers.WSHandler{Hub: hub, Presence: presence}

	mux.Handle("/ws", wsh)
	mux.HandleFunc("/api/presence/online", presence.Online)

	dm := &handlers.DMHandler{DB: db, Hub: hub}
	gh := &handlers.GroupHandler{DB: db, Hub: hub}
	eh := &handlers.EventsHandler{DB: db, Hub: hub}

	mux.HandleFunc("/api/dm/history", dm.History) // GET
	mux.HandleFunc("/api/dm/send", dm.Send)       // POST

	mux.HandleFunc("/api/groups/create", gh.Create)             // POST
	mux.HandleFunc("/api/groups/my", gh.MyGroups)               // GET
	mux.HandleFunc("/api/groups/invitations", gh.PendingInvitations) // GET
	mux.HandleFunc("/api/groups/messages", gh.History)          // GET
	mux.HandleFunc("/api/groups/send", gh.Send)                 // POST
	mux.HandleFunc("/api/groups/members", gh.Members)           // GET
	mux.HandleFunc("/api/groups/invite", gh.Invite)             // POST
	mux.HandleFunc("/api/groups/join", gh.Join)                 // POST
	mux.HandleFunc("/api/groups/leave", gh.Leave)               // POST
	mux.HandleFunc("/api/groups/promote", gh.Promote)           // POST

	mux.HandleFunc("/api/events/create", eh.Create)             // POST
	mux.HandleFunc("/api/events/group", eh.GetGroupEvents)      // GET
	mux.HandleFunc("/api/events/respond", eh.Respond)           // POST
	mux.HandleFunc("/api/events/delete", eh.Delete)             // DELETE

	// presence HTTP already added earlier:
	// mux.HandleFunc("/api/presence/online", presence.Online)
	ph := &handlers.PostHandler{DB: db, Hub: hub}
	ch := &handlers.CommentHandler{DB: db, Hub: hub}
	// phProf := &handlers.ProfileHandler{DB: db}
	uh := &handlers.UsersHandler{DB: db}
	nh := &handlers.NotificationsHandler{DB: db}
	phProf := &handlers.ProfileHandler{DB: db, Hub: hub}

	// mux.HandleFunc("/api/presence/online", presence.Online)
	mux.HandleFunc("/api/notifications", nh.List)               // GET
	mux.HandleFunc("/api/notifications/mark_read", nh.MarkRead) // POST

	mux.HandleFunc("/api/users/search", uh.Search) // GET ?q=
	// profile & follow routes
	mux.HandleFunc("/api/profile", phProf.Get)                  // GET ?id=<userId>
	mux.HandleFunc("/api/profile/privacy", phProf.SetPrivacy)   // POST {isPublic}
	mux.HandleFunc("/api/follow/request", phProf.FollowRequest) // POST {userId}
	mux.HandleFunc("/api/follow/unfollow", phProf.Unfollow)     // POST {userId}

	mux.HandleFunc("/api/follow/requests", phProf.ListRequests) // GET
	mux.HandleFunc("/api/follow/accept", phProf.Accept)         // POST {userId}
	mux.HandleFunc("/api/follow/decline", phProf.Decline)       // POST {userId}

	mux.HandleFunc("/api/profile/restrict_posts", phProf.RestrictAllPosts) // POST
	mux.HandleFunc("/api/profile/make_posts_public", phProf.MakePostsPublic)

	// uploads
	uploadDir := env("UPLOAD_DIR", "./uploads")
	mux.Handle("/api/upload", handlers.UploadImage(uploadDir))
	mux.Handle("/api/upload/", handlers.UploadImage(uploadDir)) // handle trailing slash too
	// serve uploaded files
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	// posts
	mux.HandleFunc("/api/posts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			ph.Create(w, r)
			return
		}
		ph.ListAll(w, r) // GET default
	})
	mux.HandleFunc("/api/my/posts", ph.ListMine)
	mux.HandleFunc("/api/posts/delete", ph.Delete)
	mux.HandleFunc("/api/posts/like", ph.ToggleLike)

	// comments
	mux.HandleFunc("/api/comments", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			ch.Create(w, r)
			return
		}
		ch.ListByPost(w, r) // GET ?postId=
	})

	// websocket
	// mux.Handle("/ws", wsh) // ws://localhost:8080/ws?room=feed or post:123

	// mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
	// 	w.Write([]byte("ok"))
	// })

	// 👇 auth routes
	ah := &handlers.AuthHandler{DB: db}
	mux.HandleFunc("/api/register", ah.Register)
	mux.HandleFunc("/api/login", ah.Login)
	mux.HandleFunc("/api/logout", ah.Logout)
	mux.HandleFunc("/api/me", ah.Me)

	// simple CORS
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", frontend)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		mux.ServeHTTP(w, r)
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	log.Println("Backend listening on", port)
	log.Fatal(srv.ListenAndServe())
}
