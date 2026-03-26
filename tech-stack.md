# Project Planner — Tech Stack

## Overview

ProjectPlanner uses the same proven stack as **LearningApp**: a Python Flask REST API backend serving a Vanilla JavaScript SPA frontend. No build pipeline, no bundler, no frontend framework.

---

## Backend

### Language

- **Python 3.11+**

### Framework & Core Libraries

| Package         | Version      | Purpose                                                     |
| --------------- | ------------ | ----------------------------------------------------------- |
| `flask`         | `>=3.0,<4`   | Web framework and request routing                           |
| `flask-cors`    | `>=4.0,<5`   | Enable cross-origin requests from frontend dev server       |
| `gunicorn`      | `>=21.0,<24` | Production WSGI server (replaces Flask dev server on cloud) |
| `python-dotenv` | `>=1.0,<2`   | Load `.env` file into `os.environ` at startup               |
| `openai`        | `>=1.30,<2`  | Azure OpenAI SDK (task suggestion, AI summary, ask AI)      |

### Optional / AI-related

| Package                          | Version | Purpose                                     |
| -------------------------------- | ------- | ------------------------------------------- |
| `azure-cognitiveservices-speech` | —       | Not required for ProjectPlanner v1 (no TTS) |

### Architecture Pattern

- **Flask Application Factory** (`create_app()` in `backend/app.py`)
- **Blueprints** for each feature module (projects, tasks, notes, ai, users, settings, calendar)
- **JSON file storage** — no ORM, no SQL database needed
- **`python-dotenv`** reads `.env` for all secret credentials

---

## Frontend

### Language

- **Vanilla JavaScript (ES6+)** — no transpilation required
- **HTML5** — semantic markup
- **CSS3** — custom variables, grid, flexbox, no utility framework

### No Frameworks / No Bundler

- No React, Vue, Angular, or Svelte
- No webpack, Vite, or Parcel
- No npm / package.json
- All external assets fetched from CDN at runtime

### External CDN Dependencies (frontend only)

| Library                     | Version | Purpose                           |
| --------------------------- | ------- | --------------------------------- |
| Font Awesome                | 6.5.1   | Icons throughout the UI           |
| Google Fonts — Inter        | latest  | Primary UI font (clean, readable) |
| Google Fonts — Merriweather | latest  | Note content body font (optional) |

### Browser APIs Used

| API                | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `localStorage`     | Primary offline data store for all app state |
| `fetch()`          | REST API calls to Flask backend              |
| `FormData`         | File import/export (project JSON)            |
| `DragEvent`        | Kanban drag-and-drop task reordering         |
| `MutationObserver` | Auto-resize note editor textarea             |
| `Date` / `Intl`    | Calendar calculations and date formatting    |

---

## Environment & Configuration

### Environment Variables (`.env`)

| Variable               | Required        | Default      | Description                              |
| ---------------------- | --------------- | ------------ | ---------------------------------------- |
| `AZURE_OPENAI_API_KEY` | For AI features | —            | Azure OpenAI API key                     |
| `ENDPOINT_URL`         | For AI features | —            | Azure OpenAI endpoint URL                |
| `DEPLOYMENT_NAME`      | For AI features | `gpt-4o`     | Azure OpenAI deployment (model name)     |
| `API_VERSION`          | No              | `2024-02-01` | Azure OpenAI API version                 |
| `DATA_DIR`             | No              | `data`       | Root folder for all JSON/file storage    |
| `APP_AUTH_USER`        | No              | —            | Optional Basic Auth username (for cloud) |
| `APP_AUTH_PASS`        | No              | —            | Optional Basic Auth password (for cloud) |
| `PORT`                 | No              | `5000`       | Server port                              |

### Runtime Configuration (`app_config.json`)

A JSON file written by the Settings UI that persists user-editable settings without a restart:

```json
{
  "data_dir": "C:\\Users\\user\\my-planner-data",
  "ai_response_language": "English",
  "theme": "dark"
}
```

Configuration resolution order (same as LearningApp):

1. `app_config.json` (user-set via Settings UI)
2. `DATA_DIR` environment variable (from `.env`)
3. Default: `"data"` folder next to the server

---

## Deployment

### Development

```
python run.py
```

Starts Flask dev server on `http://localhost:5000`.

### Production (Cloud)

| Platform    | Method                                                            |
| ----------- | ----------------------------------------------------------------- |
| Render      | `gunicorn run:app` via `Procfile`                                 |
| Railway     | `gunicorn run:app` via `Procfile`                                 |
| Docker      | `FROM python:3.11-slim`, install `requirements.txt`, run gunicorn |
| Self-hosted | gunicorn behind nginx reverse proxy                               |

**`Procfile`:**

```
web: gunicorn run:app
```

---

## Developer Tooling (optional, not required to run app)

| Tool             | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| VS Code          | Recommended editor                             |
| Python `venv`    | Isolate dependencies (`python -m venv venv`)   |
| Postman / Bruno  | Test REST API endpoints manually               |
| Browser DevTools | Debug frontend JS, network calls, localStorage |

---

## Version Compatibility Matrix

| Component     | Minimum      | Recommended |
| ------------- | ------------ | ----------- |
| Python        | 3.10         | 3.11+       |
| Flask         | 3.0          | 3.0.x       |
| Chrome / Edge | 110+         | Latest      |
| Firefox       | 110+         | Latest      |
| Safari        | 16+          | Latest      |
| Node.js       | Not required | —           |
