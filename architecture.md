# Project Planner — Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Single Page Application (SPA)           │   │
│  │                                                     │   │
│  │  ┌──────────────┐   ┌──────────────┐  ┌─────────┐  │   │
│  │  │  localStorage │   │  JS Modules  │  │  CSS    │  │   │
│  │  │  (app state)  │◄──│  (features)  │  │ Modules │  │   │
│  │  └──────┬────────┘   └──────┬───────┘  └─────────┘  │   │
│  │         │ auto-sync (1s)    │ fetch()                │   │
│  └─────────┼───────────────────┼────────────────────────┘   │
│            │                   │                             │
└────────────┼───────────────────┼─────────────────────────────┘
             │                   │
             ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Flask REST API (Backend)                   │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌──────┐ ┌─────────┐  │
│  │ /api/    │ │ /api/    │ │/api/ │ │/api/ │ │ /api/   │  │
│  │projects  │ │  tasks   │ │notes │ │  ai  │ │ users   │  │
│  └────┬─────┘ └────┬─────┘ └──┬───┘ └──┬───┘ └────┬────┘  │
│       │             │          │        │           │        │
│       └─────────────┴──────────┴────────┘           │        │
│                       │                              │        │
│               ┌───────▼──────┐              ┌───────▼──────┐ │
│               │  JSON Files  │              │  users.json  │ │
│               │  data/projects/ │           │  data/       │ │
│               └──────────────┘              └──────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Azure OpenAI API (external)            │   │
│  │          (task suggestion, summary, ask AI)          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Request / Response Flow

### 1. Initial Load

```
Browser → GET /
Flask serves → frontend/index.html
Browser loads → CSS files (all component stylesheets)
Browser loads → JS files (all feature modules)
JS init → reads localStorage ('project-planner-app')
JS init → if no currentUser → show User Selection screen
JS init → if currentUser → load Dashboard
```

### 2. Offline Data Flow

```
User action (create task, update status)
  → JS updates appData object in memory
  → saveData() writes appData to localStorage
  → scheduleSync() debounces 1000ms
  → autoSaveToServer() POST /api/projects/save
  → Flask writes JSON to disk
  → UI shows: Syncing → Synced / Error
```

### 3. AI Request Flow

```
User clicks "Suggest Tasks"
  → Frontend collects project context
  → POST /api/ai/suggest-tasks { project_title, description, existing_tasks }
  → Flask ai_bp → Azure OpenAI chat completion
  → Response streamed or returned as JSON
  → Frontend renders suggestions as clickable chips
  → User clicks chip → task added to project
```

### 4. Import / Export Flow

```
Export:
  User clicks Export → GET /api/projects/export?name=<project>
  Flask reads project JSON → returns as file download
  Browser saves as <project-name>.json

Import:
  User selects .json file → POST /api/projects/import (multipart/form-data)
  Flask validates JSON structure → writes to data/projects/
  Frontend refreshes project list
```

---

## Frontend Architecture

### State Management

All application state lives in a single JavaScript object `appData`, persisted in `localStorage`:

```javascript
// Singleton state object — shared across all JS modules (no import/export)
window.appData = {
  projects: {}, // { projectId: ProjectObject }
  config: {}, // { theme, defaultLanguage }
};
window.currentUser = null; // { id, name }
window.currentProjectId = null; // active project
window.currentTaskId = null; // active task (detail panel)
window.currentView = "dashboard"; // dashboard | projects | calendar | settings
```

### Module Loading Order (in `index.html`)

Scripts must be loaded in dependency order (no bundler):

```
1. data.js          — appData, localStorage, auto-sync engine
2. users.js         — user profile selection, PIN verification
3. projects.js      — project CRUD, project list rendering
4. tasks.js         — task CRUD, kanban board, task list
5. subtasks.js      — subtask checklist within tasks
6. notes.js         — note CRUD, markdown renderer
7. calendar.js      — date-based task view
8. ai.js            — fetch helpers for all /api/ai/* endpoints
9. detail-panel.js  — slide-in right panel for task detail + AI
10. toc.js          — project sidebar / task group navigation
11. events.js       — global event listeners, keyboard shortcuts
12. settings.js     — settings UI, theme toggle
13. dashboard.js    — dashboard stats, upcoming task list
```

### Rendering Pattern

- **No virtual DOM** — direct DOM manipulation via `innerHTML`, `appendChild`, `classList`
- **Component render functions** — e.g., `renderTaskList()`, `renderKanban()`, `renderCalendar()`
- **Lazy rendering** — only active view is rendered; others cleared on view switch
- **Immediate optimistic updates** — UI updates first, server sync happens in background

---

## Backend Architecture

### Application Factory (`backend/app.py`)

```python
def create_app():
    app = Flask(__name__, static_folder='../frontend/static', ...)
    CORS(app)
    register_blueprints(app)          # 7 feature blueprints
    setup_optional_basic_auth(app)    # APP_AUTH_USER / APP_AUTH_PASS
    add_health_check(app)             # GET /health
    add_spa_catchall(app)             # GET /* → index.html
    return app
```

### Blueprint Registration

```python
from backend.routes.projects  import projects_bp    # /api/projects
from backend.routes.tasks      import tasks_bp       # /api/tasks
from backend.routes.notes      import notes_bp       # /api/notes
from backend.routes.ai         import ai_bp          # /api/ai
from backend.routes.users      import users_bp       # /api/users
from backend.routes.settings   import settings_bp    # /api/settings
from backend.routes.calendar   import calendar_bp    # /api/calendar
```

### Config Resolution (same as LearningApp)

```
get_data_dir()
  ├─ check app_config.json on disk
  ├─ fallback to DATA_DIR env var
  └─ fallback to ./data/
```

---

## Data Storage Layout

```
data/
├── users.json                  # All user profiles
├── app_config.json             # Runtime settings (theme, data_dir, etc.)
└── projects/
    ├── <project-id>.json       # One file per project (all tasks + notes inside)
    └── ...
```

### File Naming

- Project files: `{project_id}.json` where `project_id` is a short UUID generated client-side (`uid()`)
- Users file: single `users.json` at root of data dir
- No nested directories (flat `projects/` folder)

---

## Security Considerations

| Concern                          | Mitigation                                                               |
| -------------------------------- | ------------------------------------------------------------------------ |
| Secret keys in source            | All credentials in `.env`, never committed                               |
| Path traversal (file read/write) | `os.path.basename()` applied to all user-supplied filenames              |
| JSON injection                   | `flask.jsonify` / `json.dumps` handles escaping                          |
| Basic auth for cloud deploy      | Optional `APP_AUTH_USER` / `APP_AUTH_PASS` checked before all routes     |
| XSS via note content             | Note content rendered with `textContent` or sanitized before `innerHTML` |
| AI prompt injection              | User inputs sanitized before appending to system prompts                 |

---

## Offline-First Sync Engine

Mirrors LearningApp's proven pattern:

```javascript
let syncTimer = null;
let syncStatus = "idle"; // idle | syncing | synced | error

function saveData() {
  localStorage.setItem("project-planner-app", JSON.stringify(appData));
  scheduleSync();
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(autoSaveToServer, 1000);
}

async function autoSaveToServer() {
  setSyncStatus("syncing");
  try {
    await fetch("/api/projects/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appData),
    });
    setSyncStatus("synced");
  } catch (e) {
    setSyncStatus("error");
  }
}
```

---

## Multi-User Architecture

```
App Load
  │
  ├─ localStorage has currentUser?
  │     YES → load user's projects → Dashboard
  │     NO  → show User Selection screen
  │
User Selection screen:
  ├─ GET /api/users → list all profiles
  ├─ User clicks profile → POST /api/users/login { user_id, pin }
  │     Success → store currentUser in localStorage → load Dashboard
  │     Fail    → show PIN error
  └─ "New User" → POST /api/users { name, pin } → re-render list
```

User data isolation: every project JSON file contains a `user_id` field. Server filters `GET /api/projects` by `user_id` from request body/query param. Client-side `appData` only stores projects belonging to the current user.

---

## Deployment Architecture

```
Internet
  │
  ▼
Render / Railway / VPS
  │
  ▼
gunicorn (WSGI)
  │
  ▼
Flask app (create_app())
  ├── /health          → 200 OK  (uptime probe)
  ├── /api/*           → Feature blueprints
  └── /*               → Serves frontend/index.html (SPA catch-all)
           │
           ▼
      frontend/static/  (CSS, JS, fonts cached by browser)
```

Static files are served directly by Flask in dev and by gunicorn in production. For higher traffic, a CDN or nginx layer can be placed in front to cache static assets.
