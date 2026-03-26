# Project Planner — File Structure

Complete annotated project folder tree. Mirrors the LearningApp `backend/` + `frontend/` pattern.

---

## Root Directory

```
ProjectPlanner/
├── run.py                      # Entry point: creates Flask app and starts dev server
├── Procfile                    # Production deploy: "web: gunicorn run:app"
├── requirements.txt            # Python dependencies
├── .env                        # Secret keys (never committed to git)
├── .env.example                # Template showing all required env vars
├── .gitignore                  # Exclude: venv/, data/, .env, __pycache__/
├── readme.md                   # Setup and running instructions
│
├── backend/                    # Flask API (Python)
│   ├── __init__.py
│   ├── app.py                  # Application factory: create_app()
│   ├── config.py               # Config resolution: data_dir, env vars, app_config.json
│   ├── routes/                 # Feature blueprints
│   │   ├── __init__.py
│   │   ├── projects.py         # /api/projects  — Project CRUD + save + export/import
│   │   ├── tasks.py            # /api/tasks     — Task operations (create, update, delete, reorder)
│   │   ├── notes.py            # /api/notes     — Note CRUD within a project
│   │   ├── ai.py               # /api/ai        — Azure OpenAI: suggest, summarize, ask, blockers
│   │   ├── users.py            # /api/users     — User profiles, PIN login, delete
│   │   ├── settings.py         # /api/settings  — app_config.json read/write, disk status
│   │   └── calendar.py         # /api/calendar  — Aggregated task calendar data
│   ├── services/               # Business logic decoupled from routes
│   │   ├── __init__.py
│   │   └── ai_service.py       # Azure OpenAI client, prompt templates, response formatting
│   └── utils/                  # Shared helpers
│       ├── __init__.py
│       └── file_utils.py       # JSON read/write, path safety, uid helpers
│
├── frontend/                   # SPA frontend (HTML + CSS + Vanilla JS)
│   ├── index.html              # Single HTML entry point — loads all CSS and JS
│   └── static/
│       └── views/
│           └── components/
│               ├── css/        # One CSS file per UI component
│               │   ├── base.css            # Reset, :root CSS variables, global typography
│               │   ├── layout.css          # App shell: header, sidebar, main area
│               │   ├── sidebar.css         # Left nav sidebar
│               │   ├── dashboard.css       # Dashboard stats cards, recent/upcoming lists
│               │   ├── projects.css        # Project list cards, progress bar, labels
│               │   ├── tasks.css           # Task rows, status/priority badges, due dates
│               │   ├── kanban.css          # Kanban board columns and card drag states
│               │   ├── detail-panel.css    # Slide-in right panel, tabs, overlay
│               │   ├── subtasks.css        # Subtask checklist inside detail panel
│               │   ├── notes.css           # Notes list, editor, markdown preview
│               │   ├── calendar.css        # Monthly/weekly calendar grid, date cells
│               │   ├── users.css           # User selection screen, PIN input
│               │   ├── modals.css          # Shared modal overlay and dialog box
│               │   ├── ai.css              # AI suggestion chips, chat bubbles, spinner
│               │   └── responsive.css      # @media queries for all mobile breakpoints
│               │
│               └── js/         # One JS file per feature module
│                   ├── data.js             # appData, localStorage, auto-sync engine
│                   ├── users.js            # User selection, login, create, delete
│                   ├── projects.js         # Project list, CRUD, export, import, navigate
│                   ├── tasks.js            # Task list, kanban, CRUD, filter, drag-drop
│                   ├── subtasks.js         # Subtask checklist within task detail
│                   ├── notes.js            # Note list, editor, markdown preview, CRUD
│                   ├── calendar.js         # Calendar grid, date task list, quick create
│                   ├── ai.js               # AI fetch helpers, suggestion chips, AI panel
│                   ├── detail-panel.js     # Slide-in panel: task fields, subtasks, AI tab
│                   ├── toc.js              # Sidebar mini project nav, active states
│                   ├── dashboard.js        # Dashboard stats, recent projects, upcoming tasks
│                   ├── settings.js         # Settings view, theme toggle, disk status
│                   └── events.js           # All global event listeners, keyboard shortcuts
│
└── data/                       # Runtime data (created on first run, NOT committed)
    ├── users.json              # All user profiles [ { id, name, pin, projects } ]
    ├── app_config.json         # Runtime settings { data_dir, theme, ai_response_language }
    └── projects/               # One JSON file per project
        ├── proj_<id>.json
        └── ...
```

---

## File Descriptions

### Root Files

| File               | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `run.py`           | Imports `create_app()` from `backend/app.py`, starts Flask dev server on `PORT` (default 5000) |
| `Procfile`         | `web: gunicorn run:app` — used by Render, Railway, Heroku                                      |
| `requirements.txt` | `flask`, `flask-cors`, `gunicorn`, `openai`, `python-dotenv`                                   |
| `.env`             | All secrets: `AZURE_OPENAI_API_KEY`, `ENDPOINT_URL`, `DEPLOYMENT_NAME`, etc.                   |
| `.env.example`     | Committed to git — shows every variable name with empty values and comments                    |
| `.gitignore`       | Excludes `venv/`, `data/`, `.env`, `__pycache__/`, `*.pyc`, `.DS_Store`                        |
| `readme.md`        | Setup guide: install deps, configure `.env`, run `python run.py`                               |

---

### Backend Files

#### `backend/app.py`

The Flask **application factory**. Responsible for:

- Creating the Flask app instance with correct `static_folder` pointing to `frontend/static`
- Registering all 7 blueprints
- Enabling CORS
- Optionally enabling Basic Auth (from `APP_AUTH_USER` / `APP_AUTH_PASS`)
- Adding `/health` endpoint
- Adding SPA catch-all route (`GET /*` → `frontend/index.html`)

---

#### `backend/config.py`

Configuration resolution with fallback chain:

1. Read `app_config.json` from disk → use `data_dir` value
2. Fall back to `DATA_DIR` environment variable
3. Fall back to default `"data"` folder

Also exposes:

- `get_azure_openai_client()` — returns configured `AzureOpenAI` client or `None`
- `is_ai_available()` → `bool`
- `get_app_config()` → full config dict
- `save_app_config(updates)` → write changes to `app_config.json`

---

#### `backend/routes/projects.py`

Blueprint `projects_bp` with prefix `/api/projects`:

- `GET /` — list all project metadata for a `user_id`
- `POST /save` — write all project files for the current user (full sync dump)
- `GET /export` — return single project JSON as a file download
- `POST /import` — accept file upload, validate, write to disk
- `DELETE /<project_id>` — delete project file from disk
- `POST /rename` — rename project in its JSON
- `POST /duplicate` — deep-copy project with new IDs

---

#### `backend/routes/tasks.py`

Blueprint `tasks_bp` with prefix `/api/tasks`:

- Thin wrapper that opens the project JSON file, mutates the tasks array, and writes it back
- Handles: create, update (patch), soft delete, hard delete, restore, reorder, bulk-status

---

#### `backend/routes/notes.py`

Blueprint `notes_bp` with prefix `/api/notes`:

- Same pattern as `tasks.py` — reads project file, mutates notes array, writes back
- Handles: create, update, delete

---

#### `backend/routes/ai.py`

Blueprint `ai_bp` with prefix `/api/ai`:

- All routes call `ai_service.py` functions
- Returns `503` with clear message if `AZURE_OPENAI_API_KEY` not set
- No streaming in v1 (full JSON response only)
- Routes: `suggest-tasks`, `summarize`, `smart-deadline`, `detect-blockers`, `ask`

---

#### `backend/routes/users.py`

Blueprint `users_bp` with prefix `/api/users`:

- Reads/writes `data/users.json`
- PIN is stored as plaintext in v1 (sufficient for lightweight profile separation)
  - Future: bcrypt hash if security requirements increase
- `POST /login` verifies PIN and returns user metadata (never the PIN itself)

---

#### `backend/routes/settings.py`

Blueprint `settings_bp` with prefix `/api/settings`:

- Reads/writes `app_config.json` via `config.py`
- Validates new `data_dir` path before saving (must be a valid writable directory)
- Returns disk usage from `os.stat` / `os.walk()` on the data folder

---

#### `backend/routes/calendar.py`

Blueprint `calendar_bp` with prefix `/api/calendar`:

- Reads all project files for a `user_id`
- Filters tasks that have a `due_date` in the requested month range
- Returns flattened list of `CalendarTask` objects (task + project name + color)

---

#### `backend/services/ai_service.py`

Azure OpenAI service layer:

- `suggest_tasks(project_title, description, existing_tasks)` → `list[str]`
- `summarize_project(project_name, tasks)` → `str`
- `estimate_deadline(task_title, description)` → `{ date, reasoning }`
- `detect_blockers(tasks)` → `list[{ task_id, reason }]`
- `ask_question(question, context)` → `str`

Each function builds a system prompt + user prompt, calls the Azure OpenAI API, and returns the parsed result. Prompts include the `ai_response_language` from config.

---

#### `backend/utils/file_utils.py`

Shared file I/O helpers:

- `read_json(path)` → dict (returns `{}` if file not found)
- `write_json(path, data)` → None (creates directories if needed)
- `safe_filename(name)` → sanitized filename (strips `../`, trims to basename)
- `ensure_dir(path)` → creates folder if it does not exist
- `list_project_files(data_dir)` → list of project JSON file paths

---

### Frontend Files

#### `frontend/index.html`

The single HTML file for the entire SPA. Contains:

- `<head>`: charset, viewport, title, CDN links (Font Awesome, Google Fonts)
- `<link>` tags for all CSS files (in order: base → layout → components)
- `<body>`: app shell skeleton (header, sidebar, main, detail panel, modal container)
- `<script>` tags for all JS files (in dependency order)

Does **not** contain any dynamic content — all rendering is done by JavaScript.

---

#### `frontend/static/views/components/js/data.js`

The backbone of the entire frontend. Must be loaded first. Defines:

- `window.appData` — the single source of truth
- `saveData()` — persists to localStorage + triggers sync
- `scheduleSync()` — 1s debounce wrapper
- `autoSaveToServer()` — POSTs data to `/api/projects/save`
- `loadData()` — reads from localStorage on startup
- `uid(prefix)` — ID generator
- Sync status management (`syncing`, `synced`, `error` indicator in header)

---

## Key Naming Conventions

| Convention        | Example                                                       |
| ----------------- | ------------------------------------------------------------- |
| JS function names | `camelCase` — `renderTaskList()`, `createProject()`           |
| CSS class names   | `kebab-case` — `.task-card`, `.project-list`, `.detail-panel` |
| HTML element IDs  | `kebab-case` — `#view-dashboard`, `#modal-overlay`            |
| JSON field names  | `snake_case` — `project_id`, `due_date`, `created_at`         |
| ID prefixes       | `usr_`, `proj_`, `task_`, `note_`, `sub_`, `cmt_`             |
| Python variables  | `snake_case` — `data_dir`, `project_id`, `ai_service`         |
| Blueprint names   | `snake_case` + `_bp` — `projects_bp`, `ai_bp`                 |
| CSS files         | `component-name.css` matching the JS module they style        |

---

## `requirements.txt`

```
flask>=3.0,<4
flask-cors>=4.0,<5
gunicorn>=21.0,<24
openai>=1.30,<2
python-dotenv>=1.0,<2
```

---

## `.env.example`

```dotenv
# Azure OpenAI (required for AI features)
AZURE_OPENAI_API_KEY=
ENDPOINT_URL=
DEPLOYMENT_NAME=gpt-4o
API_VERSION=2024-02-01

# Data storage (optional — defaults to ./data)
DATA_DIR=data

# Optional Basic Auth for cloud deployments
APP_AUTH_USER=
APP_AUTH_PASS=

# Server port
PORT=5000
```

---

## File Count Summary

| Category                    | Count  |
| --------------------------- | ------ |
| Python backend files        | 13     |
| JavaScript frontend modules | 13     |
| CSS modules                 | 15     |
| Config/deploy files         | 5      |
| **Total source files**      | **46** |

(Excludes `data/` directory contents which are runtime-generated)
