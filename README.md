# Scratch List

A personal to-do list with a handwritten scratch-pad feel. Built with Go, SQLite, and a paper-styled UI.

## Features

- Add tasks with a name, category, and optional deadline
- Mark tasks as done with a checkbox
- Filter tasks by category
- Delete tasks
- Handwritten notebook aesthetic with ruled lines and torn-paper effects
- Server-rendered page with lightweight JavaScript

## Tech Stack

- **Go** (1.27+) with standard `net/http`
- **SQLite** (`modernc.org/sqlite` driver)
- **HTML/CSS/JS** — server-rendered templates, no build step

## Getting Started

### Prerequisites

- Go 1.27 or newer

### Run from source

```bash
go run main.go
```

The server starts on `http://localhost:8080`.

### Build binary

```bash
go build -o scratchlist
./scratchlist
```

The app creates `tasks.db` in the working directory automatically.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | HTML page |
| `POST` | `/api/tasks` | Create a task (`name`, `category`, `deadline`) |
| `PATCH` | `/api/tasks/{id}` | Toggle done (`is_done`) |
| `DELETE` | `/api/tasks/{id}` | Delete a task |

Static assets are served at `/static/`.

## Project Structure

```
main.go         — HTTP handlers, DB logic, templates
index.html      — Server-rendered page
static/
  styles.css    — Notebook/theme styling
  script.js     — Client-side interactivity
```
