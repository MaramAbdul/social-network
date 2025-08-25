package sqlite

import (
	"bufio"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// We are in: backend/pkg/db/sqlite.go
// Migrations live in: backend/pkg/db/migrations/sqlite/*.sql

//go:embed migrations/sqlite/*.sql
var migFS embed.FS

// Open connects to SQLite, turns on FKs, ensures schema_migrations, then applies *.up.sql
func Open(dbPath string) (*sql.DB, error) {
	dsn := fmt.Sprintf("file:%s?_fk=1&_busy_timeout=5000", dbPath)
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		return nil, err
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return nil, err
	}
	if err := applyMigrations(db); err != nil {
		return nil, err
	}
	return db, nil
}

type migFile struct {
	name    string // e.g. 000001_create_users.up.sql
	version string // e.g. 000001
	up      bool
	path    string // e.g. migrations/sqlite/000001_create_users.up.sql
}

func applyMigrations(db *sql.DB) error {
	// Read embedded directory; no ".." (which go:embed disallows)
	entries, err := fs.ReadDir(migFS, "migrations/sqlite")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var files []migFile
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		up := strings.Contains(name, ".up.")
		if !up {
			continue
		}
		parts := strings.SplitN(name, "_", 2)
		if len(parts) < 2 {
			continue
		}
		files = append(files, migFile{
			name:    name,
			version: parts[0],
			up:      up,
			path:    filepath.ToSlash("migrations/sqlite/" + name),
		})
	}

	// Sort by filename to guarantee order 000001, 000002, ...
	sort.Slice(files, func(i, j int) bool { return files[i].name < files[j].name })

	log.Printf("Migrations found: %d", len(files))

	// Load applied versions
	applied := map[string]bool{}
	rows, err := db.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		_ = rows.Scan(&v)
		applied[v] = true
	}

	for _, f := range files {
		if applied[f.version] {
			continue
		}
		b, err := fs.ReadFile(migFS, f.path)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", f.name, err)
		}
		sqls := splitSQL(string(b))

		tx, err := db.Begin()
		if err != nil {
			return err
		}
		for _, stmt := range sqls {
			if strings.TrimSpace(stmt) == "" {
				continue
			}
			if _, err := tx.Exec(stmt); err != nil {
				_ = tx.Rollback()
				return fmt.Errorf("migration %s failed: %w", f.name, err)
			}
		}
		if _, err := tx.Exec(
			`INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)`,
			f.version, time.Now().UTC().Format("2006-01-02 15:04:05"),
		); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		log.Printf("Applied migration %s", f.name)
	}
	return nil
}

func splitSQL(s string) []string {
	var out []string
	sc := bufio.NewScanner(strings.NewReader(s))
	sc.Split(bufio.ScanLines)
	var b strings.Builder
	for sc.Scan() {
		line := sc.Text()
		b.WriteString(line)
		b.WriteString("\n")
		if strings.HasSuffix(strings.TrimSpace(line), ";") {
			out = append(out, b.String())
			b.Reset()
		}
	}
	if strings.TrimSpace(b.String()) != "" {
		out = append(out, b.String())
	}
	return out
}
