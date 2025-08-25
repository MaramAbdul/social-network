package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// UploadImage handles POST /api/upload with form-data field "file".
// Saves JPEG/PNG/GIF to uploadDir and returns {"url": "/uploads/<name>"}.
func UploadImage(uploadDir string) http.Handler {
	// ensure dir exists
	_ = os.MkdirAll(uploadDir, 0755)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			Err(w, http.StatusMethodNotAllowed, "method")
			return
		}

		// Limit request body size (e.g. 10MB)
		r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

		file, header, err := r.FormFile("file")
		if err != nil {
			Err(w, http.StatusBadRequest, "no file")
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".gif":
		default:
			Err(w, http.StatusBadRequest, "unsupported type")
			return
		}

		// generate unique filename
		name := fmt.Sprintf("%d_%d%s", time.Now().UnixNano(), os.Getpid(), ext)
		path := filepath.Join(uploadDir, name)

		out, err := os.Create(path)
		if err != nil {
			Err(w, http.StatusInternalServerError, "save error")
			return
		}
		defer out.Close()

		if _, err := io.Copy(out, file); err != nil {
			Err(w, http.StatusInternalServerError, "save error")
			return
		}

		JSON(w, http.StatusOK, map[string]string{"url": "/uploads/" + name})
	})
}