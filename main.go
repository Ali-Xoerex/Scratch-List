package main

import (
	"encoding/json"
	"strconv"
	"strings"
	"database/sql"
	"fmt"
	"html/template"
	"log"
	"net/http"
	_ "modernc.org/sqlite"
)

type Task struct {
	ID int64
	Name string
	Deadline string
	Category string
	IsDone bool
}

type PageData struct {
	Tasks []Task
	Categories []string
}

func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("Failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("Failed to connect to database: %w", err)
	}

	createTableQuery := `
	CREATE TABLE IF NOT EXISTS tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		task_name TEXT NOT NULL,
		task_deadline TEXT,
		category TEXT,
		is_done BOOLEAN NOT NULL DEFAULT 0
	)
	`
	if _, err := db.Exec(createTableQuery); err != nil {
		db.Close()
		return nil, fmt.Errorf("Failed to create table tasks: %w", err)
	}

	return db, nil
}

func getTasks(db *sql.DB) ([]Task, error){
	rows, err := db.Query(`
		SELECT id,
			   task_name,
			   COALESCE(task_deadline,''),
			   COALESCE(category, ''),
			   is_done
		FROM tasks
		ORDER BY is_done ASC, id DESC	   
	`)
	if err != nil {
		return nil,err
	}
	defer rows.Close()
	
	tasks := []Task{}
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Name, &t.Deadline, &t.Category, &t.IsDone); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func handleCreateTask(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name     string `json:"name"`
			Category string `json:"category"`
			Deadline string `json:"deadline"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		body.Name = strings.TrimSpace(body.Name)
		body.Category = strings.TrimSpace(body.Category)
		if body.Name == "" || body.Category == "" {
			http.Error(w, "name and category required", http.StatusBadRequest)
			return
		}

		var deadline any
		if body.Deadline != "" {
			deadline = body.Deadline
		}

		res, err := db.Exec(
			`INSERT INTO tasks (task_name, category, task_deadline) VALUES (?, ?, ?)`,
			body.Name, body.Category, deadline,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		id, _ := res.LastInsertId()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"id": id})
	}
}

func handleUpdateTask(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		var body struct {
			IsDone bool `json:"is_done"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if _, err := db.Exec(`UPDATE tasks SET is_done = ? WHERE id = ?`, body.IsDone, id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handleDeleteTask(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "bad id", http.StatusBadRequest)
			return
		}
		if _, err := db.Exec(`DELETE FROM tasks WHERE id = ?`, id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func getCategories(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`
		SELECT DISTINCT category
		FROM tasks
		WHERE category IS NOT NULL AND category != ''
		ORDER BY category
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cats := []string{}
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, rows.Err()
}

func main() {
	//Initialize db
	DB_NAME := "tasks.db"
	db, err := InitDB(DB_NAME)

	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	tmpl, err := template.ParseFiles("index.html")
	if err != nil {
		log.Fatal(err)
	}


	http.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w,r)
			return
		}

		tasks, err := getTasks(db)
		if err != nil{
			log.Println("getTasks: ",err)
			http.Error(w,"failed to load tasks", http.StatusInternalServerError)
			return
		}

		cats, err := getCategories(db)
		if err != nil {
			log.Println("getCategories: ",err)
			http.Error(w,"Failed to load categories", http.StatusInternalServerError)
			return
		}

		data := PageData{Tasks: tasks, Categories: cats}
		if err:= tmpl.Execute(w, data); err != nil {
			log.Println("template: ", err)
		}
	})

	http.HandleFunc("POST /api/tasks",      handleCreateTask(db))
	http.HandleFunc("PATCH /api/tasks/{id}", handleUpdateTask(db))
	http.HandleFunc("DELETE /api/tasks/{id}", handleDeleteTask(db))

	fs := http.FileServer(http.Dir("static/"))
	http.Handle("GET /static/", http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		fs.ServeHTTP(w, r)
	})))
	fmt.Println("Server is running on 8080 port")
	err = http.ListenAndServe(":8080",nil)
	if err != nil {
		fmt.Println("Server error: ",err)
	}
}