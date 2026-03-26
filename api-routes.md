# Project Planner — API Routes

All backend routes are organized into **Flask Blueprints**. Every blueprint maps to one feature module. The base URL prefix for all API routes is `/api`.

---

## Blueprint Summary

| Blueprint     | Prefix          | File                         | Description                      |
| ------------- | --------------- | ---------------------------- | -------------------------------- |
| `projects_bp` | `/api/projects` | `backend/routes/projects.py` | Project CRUD + sync              |
| `tasks_bp`    | `/api/tasks`    | `backend/routes/tasks.py`    | Task operations within a project |
| `notes_bp`    | `/api/notes`    | `backend/routes/notes.py`    | Note CRUD within a project       |
| `ai_bp`       | `/api/ai`       | `backend/routes/ai.py`       | Azure OpenAI-powered features    |
| `users_bp`    | `/api/users`    | `backend/routes/users.py`    | User profile management          |
| `settings_bp` | `/api/settings` | `backend/routes/settings.py` | App configuration                |
| `calendar_bp` | `/api/calendar` | `backend/routes/calendar.py` | Aggregated calendar data         |

---

## Utility Routes (on root app)

| Method | Path      | Description                                                            |
| ------ | --------- | ---------------------------------------------------------------------- |
| `GET`  | `/health` | Health check for cloud uptime probes. Returns `{ "status": "ok" }`     |
| `GET`  | `/*`      | SPA catch-all — returns `frontend/index.html` for all undefined routes |

---

## 1. Projects Blueprint — `/api/projects`

| Method   | Path                         | Request Body                               | Response                      | Description                                                         |
| -------- | ---------------------------- | ------------------------------------------ | ----------------------------- | ------------------------------------------------------------------- |
| `GET`    | `/api/projects`              | Query: `user_id`                           | `{ projects: [ProjectMeta] }` | List all project metadata (name, id, status, task count) for a user |
| `POST`   | `/api/projects/save`         | `{ user_id, projects: { [id]: Project } }` | `{ success: true }`           | Save/overwrite all project files for a user (full auto-sync)        |
| `GET`    | `/api/projects/export`       | Query: `project_id`                        | File download (JSON)          | Export a single project as a downloadable `.json` file              |
| `POST`   | `/api/projects/import`       | `multipart/form-data: file`                | `{ success, project_id }`     | Import a project from a `.json` file upload                         |
| `DELETE` | `/api/projects/<project_id>` | —                                          | `{ success: true }`           | Permanently delete a project file from disk                         |
| `POST`   | `/api/projects/rename`       | `{ project_id, new_name }`                 | `{ success: true }`           | Rename a project (updates name in its JSON file)                    |
| `POST`   | `/api/projects/duplicate`    | `{ project_id }`                           | `{ new_project_id }`          | Deep-copy a project with a new ID and `"copy"` suffix on name       |

---

## 2. Tasks Blueprint — `/api/tasks`

> Note: Tasks are embedded in project JSON files. These endpoints provide convenience operations that read/write into the correct project file.

| Method   | Path                        | Request Body                                 | Response              | Description                                              |
| -------- | --------------------------- | -------------------------------------------- | --------------------- | -------------------------------------------------------- |
| `POST`   | `/api/tasks/create`         | `{ project_id, task: TaskObject }`           | `{ task_id }`         | Append a new task to a project's task array              |
| `PUT`    | `/api/tasks/update`         | `{ project_id, task_id, updates: {...} }`    | `{ success: true }`   | Patch specific fields on a task                          |
| `DELETE` | `/api/tasks/<task_id>`      | Query: `project_id`                          | `{ success: true }`   | Soft-delete a task (sets `deleted: true`)                |
| `DELETE` | `/api/tasks/<task_id>/hard` | Query: `project_id`                          | `{ success: true }`   | Permanently remove a task from project JSON              |
| `POST`   | `/api/tasks/restore`        | `{ project_id, task_id }`                    | `{ success: true }`   | Restore a soft-deleted task (sets `deleted: false`)      |
| `PUT`    | `/api/tasks/reorder`        | `{ project_id, ordered_ids: [string] }`      | `{ success: true }`   | Reorder tasks array on disk (after kanban drag-and-drop) |
| `POST`   | `/api/tasks/bulk-status`    | `{ project_id, task_ids: [string], status }` | `{ updated: number }` | Set status on multiple tasks at once                     |

---

## 3. Notes Blueprint — `/api/notes`

| Method   | Path                   | Request Body                              | Response            | Description                                 |
| -------- | ---------------------- | ----------------------------------------- | ------------------- | ------------------------------------------- |
| `POST`   | `/api/notes/create`    | `{ project_id, note: NoteObject }`        | `{ note_id }`       | Add a new note to a project                 |
| `PUT`    | `/api/notes/update`    | `{ project_id, note_id, updates: {...} }` | `{ success: true }` | Update note title, content, or pinned state |
| `DELETE` | `/api/notes/<note_id>` | Query: `project_id`                       | `{ success: true }` | Permanently delete a note from a project    |

---

## 4. AI Blueprint — `/api/ai`

All AI routes require `AZURE_OPENAI_API_KEY` and `ENDPOINT_URL` set in the environment.

| Method | Path                      | Request Body                                               | Response                                        | Description                                                   |
| ------ | ------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| `POST` | `/api/ai/suggest-tasks`   | `{ project_title, description, existing_tasks: [string] }` | `{ suggestions: [string] }`                     | Given project context, return a list of suggested task titles |
| `POST` | `/api/ai/summarize`       | `{ project_name, tasks: [TaskObject] }`                    | `{ summary: string }`                           | Generate a brief project status summary in plain language     |
| `POST` | `/api/ai/smart-deadline`  | `{ task_title, description, project_context: string }`     | `{ suggested_date: string, reasoning: string }` | Estimate a realistic due date for a task                      |
| `POST` | `/api/ai/detect-blockers` | `{ tasks: [TaskObject] }`                                  | `{ blockers: [{ task_id, reason }] }`           | Identify tasks likely to be blocked based on descriptions     |
| `POST` | `/api/ai/ask`             | `{ question: string, context: { project, tasks, notes } }` | `{ answer: string }`                            | Free-form question about the current project or task          |

### Error Response (all AI endpoints)

```json
{
  "error": "AI service not configured",
  "detail": "AZURE_OPENAI_API_KEY is not set"
}
```

Status: `503 Service Unavailable`

---

## 5. Users Blueprint — `/api/users`

| Method   | Path                   | Request Body        | Response                      | Description                                          |
| -------- | ---------------------- | ------------------- | ----------------------------- | ---------------------------------------------------- |
| `GET`    | `/api/users`           | —                   | `{ users: [UserMeta] }`       | List all user profiles (name, id — no PINs returned) |
| `POST`   | `/api/users`           | `{ name, pin? }`    | `{ user: UserMeta }`          | Create a new user profile                            |
| `POST`   | `/api/users/login`     | `{ user_id, pin? }` | `{ success, user: UserMeta }` | Verify PIN for a user; returns user info if correct  |
| `DELETE` | `/api/users/<user_id>` | —                   | `{ success: true }`           | Delete a user profile and all their project files    |
| `PUT`    | `/api/users/<user_id>` | `{ name?, pin? }`   | `{ success: true }`           | Update user name or PIN                              |

### UserMeta Object (returned in listing)

```json
{
  "id": "usr_1711234567_abc",
  "name": "Alice",
  "project_count": 3
}
```

> PINs are stored server-side in `users.json` only. Never returned to the client.

---

## 6. Settings Blueprint — `/api/settings`

| Method | Path                   | Request Body                                   | Response                                    | Description                                    |
| ------ | ---------------------- | ---------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `GET`  | `/api/settings`        | —                                              | `{ data_dir, ai_response_language, theme }` | Get current `app_config.json` values           |
| `POST` | `/api/settings`        | `{ data_dir?, ai_response_language?, theme? }` | `{ success: true }`                         | Update `app_config.json` with new values       |
| `GET`  | `/api/settings/status` | —                                              | `{ data_dir, project_count, disk_used_mb }` | Disk usage and project count summary           |
| `GET`  | `/api/settings/files`  | —                                              | `{ files: [{ name, size_kb, modified }] }`  | List all project JSON files in the data folder |

---

## 7. Calendar Blueprint — `/api/calendar`

| Method | Path                  | Request Body                  | Response                    | Description                                                                  |
| ------ | --------------------- | ----------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `GET`  | `/api/calendar/tasks` | Query: `user_id, year, month` | `{ tasks: [CalendarTask] }` | Return all tasks with due dates in a given month, across all user's projects |

### CalendarTask Object

```json
{
  "task_id": "task_1711234600_abc",
  "task_title": "Design hero section",
  "project_id": "proj_1711234567_xyz",
  "project_name": "Website Redesign",
  "project_color": "#6366f1",
  "due_date": "2026-04-10",
  "status": "in-progress",
  "priority": "high"
}
```

---

## Common Response Patterns

### Success

```json
{ "success": true }
```

### Error

```json
{
  "error": "Project not found",
  "detail": "No project file found for id: proj_xxx"
}
```

Status codes: `400` (bad request), `404` (not found), `409` (conflict), `500` (server error), `503` (AI unavailable)

---

## CORS Policy

All `/api/*` routes have CORS enabled for `*` origins (Open development mode). For production, restrict to the domain the app is served from.

---

## Rate Limiting (recommended for production)

| Endpoint             | Rate Limit                                   |
| -------------------- | -------------------------------------------- |
| `/api/ai/*`          | 10 req/min per user (AI calls are expensive) |
| `/api/projects/save` | 60 req/min (debounced already on client)     |
| All others           | No limit in v1                               |
